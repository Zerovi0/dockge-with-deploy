import { DockgeServer } from "../dockge-server";
import { GitHandler } from "./git-handler";
import { BuildConfig } from "../models/build-config";
import { Deployment } from "../models/deployment";
import { GitRepository } from "../models/git-repository";
import { WebhookEvent } from "../models/webhook-event";
import { log } from "../log";
import R from "redbean-node";
import { 
    BUILD_COMPLETED, 
    BUILD_FAILED, 
    BUILD_IN_PROGRESS,
    BUILD_QUEUED, 
    BUILD_REQUESTED, 
    DEPLOYMENT_FAILED, 
    DEPLOYMENT_IN_PROGRESS, 
    DEPLOYMENT_SUCCEEDED 
} from "../../common/util-common";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";
import { Stack } from "../stack";
import { Terminal } from "../terminal";

const execPromise = util.promisify(exec);

/**
 * BuildEngine processes build requests and manages deployments
 */
export class BuildEngine {
    private server: DockgeServer;
    private gitHandler: GitHandler;
    private buildQueue: WebhookEvent[] = [];
    private isProcessing: boolean = false;
    
    /**
     * Create a new BuildEngine instance
     * @param server Dockge server instance
     * @param gitHandler Git handler instance
     */
    constructor(server: DockgeServer, gitHandler: GitHandler) {
        this.server = server;
        this.gitHandler = gitHandler;
        
        // Set up socket listeners
        this.setupSocketListeners();
        
        // Load pending builds from database
        this.loadPendingBuilds().catch(error => {
            log.error("build-engine", `Error loading pending builds: ${error}`);
        });
        
        log.info("build-engine", "BuildEngine initialized");
    }
    
    /**
     * Set up socket listeners for build events
     */
    private setupSocketListeners(): void {
        this.server.io.on("connection", (socket) => {
            socket.on("buildRequested", async (data: { repositoryId: number, eventId: number, buildId: string }) => {
                try {
                    const event = await WebhookEvent.findById(data.eventId);
                    if (event && event.status === BUILD_REQUESTED) {
                        this.queueBuild(event);
                    }
                } catch (error) {
                    log.error("build-engine", `Error processing build request: ${error}`);
                }
            });
        });
    }
    
    /**
     * Load pending builds from database
     */
    private async loadPendingBuilds(): Promise<void> {
        try {
            // Find all events with status BUILD_REQUESTED or BUILD_QUEUED
            const pendingEvents = await R.findAll("webhook_events", " status = ? OR status = ? ", [
                BUILD_REQUESTED,
                BUILD_QUEUED
            ]);
            
            if (pendingEvents && pendingEvents.length > 0) {
                for (const eventBean of pendingEvents) {
                    const event = await WebhookEvent.fromBean(eventBean);
                    this.queueBuild(event);
                }
                
                log.info("build-engine", `Loaded ${pendingEvents.length} pending builds`);
            }
        } catch (error) {
            log.error("build-engine", `Error loading pending builds: ${error}`);
        }
    }
    
    /**
     * Queue a build for processing
     * @param event Webhook event
     */
    private async queueBuild(event: WebhookEvent): Promise<void> {
        try {
            // Update event status to BUILD_QUEUED
            event.status = BUILD_QUEUED;
            await event.save();
            
            // Add to queue
            this.buildQueue.push(event);
            
            // Emit socket event for UI updates
            this.server.io.to(`repo:${event.repositoryId}`).emit("buildQueued", {
                repositoryId: event.repositoryId,
                eventId: event.id,
                buildId: event.buildId
            });
            
            log.info("build-engine", `Build ${event.buildId} queued for repository ${event.repositoryId}`);
            
            // Process queue if not already processing
            if (!this.isProcessing) {
                this.processQueue();
            }
        } catch (error) {
            log.error("build-engine", `Error queueing build: ${error}`);
        }
    }
    
    /**
     * Process the build queue
     */
    private async processQueue(): Promise<void> {
        if (this.buildQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Get next build from queue
        const event = this.buildQueue.shift();
        
        try {
            await this.processBuild(event);
        } catch (error) {
            log.error("build-engine", `Error processing build ${event.buildId}: ${error}`);
            
            // Update event status to BUILD_FAILED
            event.status = BUILD_FAILED;
            await event.save();
            
            // Create failed deployment record
            const deployment = new Deployment();
            deployment.repositoryId = event.repositoryId;
            deployment.eventId = event.id;
            deployment.buildId = event.buildId;
            deployment.status = DEPLOYMENT_FAILED;
            deployment.logs = `Build failed: ${error}`;
            deployment.startedAt = new Date();
            deployment.completedAt = new Date();
            await deployment.save();
            
            // Emit socket event for UI updates
            this.server.io.to(`repo:${event.repositoryId}`).emit("buildFailed", {
                repositoryId: event.repositoryId,
                eventId: event.id,
                buildId: event.buildId,
                error: `${error}`
            });
        }
        
        // Process next build in queue
        setTimeout(() => this.processQueue(), 1000);
    }
    
    /**
     * Process a build
     * @param event Webhook event
     */
    private async processBuild(event: WebhookEvent): Promise<void> {
        log.info("build-engine", `Processing build ${event.buildId} for repository ${event.repositoryId}`);
        
        // Update event status to BUILD_IN_PROGRESS
        event.status = BUILD_IN_PROGRESS;
        await event.save();
        
        // Create deployment record
        const deployment = new Deployment();
        deployment.repositoryId = event.repositoryId;
        deployment.eventId = event.id;
        deployment.buildId = event.buildId;
        deployment.status = DEPLOYMENT_IN_PROGRESS;
        deployment.logs = "";
        deployment.startedAt = new Date();
        await deployment.save();
        
        // Emit socket event for UI updates
        this.server.io.to(`repo:${event.repositoryId}`).emit("buildStarted", {
            repositoryId: event.repositoryId,
            eventId: event.id,
            buildId: event.buildId,
            deploymentId: deployment.id
        });
        
        // Get repository and build configuration
        const repoBean = await R.findOne("git_repositories", " id = ? ", [event.repositoryId]);
        if (!repoBean) {
            throw new Error(`Repository with ID ${event.repositoryId} not found`);
        }
        
        const repo = await GitRepository.fromBean(repoBean);
        
        // Get build config
        const configBean = await R.findOne("build_configs", " repository_id = ? ", [repo.id]);
        if (!configBean) {
            throw new Error(`Build configuration for repository ${repo.id} not found`);
        }
        
        const buildConfig = await BuildConfig.fromBean(configBean);
        
        // Append to deployment logs
        await this.appendToLogs(deployment, `Starting build ${event.buildId} for repository ${repo.id} (${repo.url})\n`);
        await this.appendToLogs(deployment, `Branch: ${repo.branch}\n`);
        await this.appendToLogs(deployment, `Commit: ${event.commit}\n`);
        
        // Check if repository directory exists
        const repoPath = path.join(process.env.DATA_DIR || "./data", "git", "repos", `${repo.id}`);
        
        try {
            await fs.access(repoPath);
            
            // Repository exists, pull latest changes
            await this.appendToLogs(deployment, `Repository exists, pulling latest changes...\n`);
            
            // Set up authentication
            await this.gitHandler.setupAuthentication(repo);
            
            // Pull latest changes
            const pullSuccess = await this.gitHandler.pullRepository(repo);
            if (!pullSuccess) {
                throw new Error(`Failed to pull latest changes from ${repo.url}`);
            }
            
            await this.appendToLogs(deployment, `Successfully pulled latest changes\n`);
        } catch (error) {
            // Repository does not exist, clone it
            await this.appendToLogs(deployment, `Repository does not exist, cloning...\n`);
            
            // Create directory structure
            await fs.mkdir(path.join(process.env.DATA_DIR || "./data", "git", "repos"), { recursive: true });
            
            // Clone repository
            const cloneSuccess = await this.gitHandler.cloneRepository(repo);
            if (!cloneSuccess) {
                throw new Error(`Failed to clone repository ${repo.url}`);
            }
            
            await this.appendToLogs(deployment, `Successfully cloned repository\n`);
        }
        
        // Check out the correct branch if needed
        const currentCommit = await this.gitHandler.getCurrentCommit(repo);
        if (!currentCommit || currentCommit.branch !== repo.branch) {
            await this.appendToLogs(deployment, `Checking out branch ${repo.branch}...\n`);
            
            const checkoutSuccess = await this.gitHandler.checkoutBranch(repo, repo.branch);
            if (!checkoutSuccess) {
                throw new Error(`Failed to check out branch ${repo.branch}`);
            }
            
            await this.appendToLogs(deployment, `Successfully checked out branch ${repo.branch}\n`);
        }
        
        // Execute pre-build commands if defined
        if (buildConfig.preBuildCommands && buildConfig.preBuildCommands.trim() !== "") {
            await this.appendToLogs(deployment, `Executing pre-build commands...\n`);
            
            try {
                const commands = buildConfig.preBuildCommands.split("\n").filter(cmd => cmd.trim() !== "");
                
                for (const command of commands) {
                    await this.appendToLogs(deployment, `$ ${command}\n`);
                    
                    const { stdout, stderr } = await execPromise(command, { cwd: repoPath });
                    
                    if (stdout) {
                        await this.appendToLogs(deployment, `${stdout}\n`);
                    }
                    
                    if (stderr) {
                        await this.appendToLogs(deployment, `${stderr}\n`);
                    }
                }
                
                await this.appendToLogs(deployment, `Pre-build commands completed successfully\n`);
            } catch (error) {
                throw new Error(`Pre-build command failed: ${error}`);
            }
        }
        
        // Build the application based on build type
        await this.buildApplication(buildConfig, deployment, repo, repoPath);
        
        // Execute post-build commands if defined
        if (buildConfig.postBuildCommands && buildConfig.postBuildCommands.trim() !== "") {
            await this.appendToLogs(deployment, `Executing post-build commands...\n`);
            
            try {
                const commands = buildConfig.postBuildCommands.split("\n").filter(cmd => cmd.trim() !== "");
                
                for (const command of commands) {
                    await this.appendToLogs(deployment, `$ ${command}\n`);
                    
                    const { stdout, stderr } = await execPromise(command, { cwd: repoPath });
                    
                    if (stdout) {
                        await this.appendToLogs(deployment, `${stdout}\n`);
                    }
                    
                    if (stderr) {
                        await this.appendToLogs(deployment, `${stderr}\n`);
                    }
                }
                
                await this.appendToLogs(deployment, `Post-build commands completed successfully\n`);
            } catch (error) {
                throw new Error(`Post-build command failed: ${error}`);
            }
        }
        
        // Deploy the application
        await this.deployApplication(buildConfig, deployment, repo, repoPath);
        
        // Update event status to BUILD_COMPLETED
        event.status = BUILD_COMPLETED;
        await event.save();
        
        // Update deployment status to DEPLOYMENT_SUCCEEDED
        deployment.status = DEPLOYMENT_SUCCEEDED;
        deployment.completedAt = new Date();
        await deployment.save();
        
        // Emit socket event for UI updates
        this.server.io.to(`repo:${event.repositoryId}`).emit("buildCompleted", {
            repositoryId: event.repositoryId,
            eventId: event.id,
            buildId: event.buildId,
            deploymentId: deployment.id
        });
        
        log.info("build-engine", `Build ${event.buildId} completed successfully`);
    }
    
    /**
     * Append to deployment logs
     * @param deployment Deployment record
     * @param text Text to append
     */
    private async appendToLogs(deployment: Deployment, text: string): Promise<void> {
        deployment.logs += text;
        await deployment.save();
        
        // Emit socket event for UI updates
        this.server.io.to(`repo:${deployment.repositoryId}`).emit("deploymentLogsUpdated", {
            repositoryId: deployment.repositoryId,
            deploymentId: deployment.id,
            logs: deployment.logs
        });
    }
    
    /**
     * Build the application based on build type
     * @param buildConfig Build configuration
     * @param deployment Deployment record
     * @param repo Git repository
     * @param repoPath Repository path
     */
    private async buildApplication(
        buildConfig: BuildConfig, 
        deployment: Deployment, 
        repo: GitRepository,
        repoPath: string
    ): Promise<void> {
        await this.appendToLogs(deployment, `Building application using ${buildConfig.buildType} build type...\n`);
        
        switch (buildConfig.buildType) {
            case "docker-build":
                await this.buildDocker(buildConfig, deployment, repo, repoPath);
                break;
                
            case "compose-only":
                await this.appendToLogs(deployment, `Compose-only build, no build step needed\n`);
                break;
                
            default:
                throw new Error(`Unsupported build type: ${buildConfig.buildType}`);
        }
    }
    
    /**
     * Build Docker image
     * @param buildConfig Build configuration
     * @param deployment Deployment record
     * @param repo Git repository
     * @param repoPath Repository path
     */
    private async buildDocker(
        buildConfig: BuildConfig, 
        deployment: Deployment, 
        repo: GitRepository,
        repoPath: string
    ): Promise<void> {
        await this.appendToLogs(deployment, `Building Docker image...\n`);
        
        // Determine Dockerfile path
        const dockerfilePath = buildConfig.dockerfilePath || "Dockerfile";
        
        // Check if Dockerfile exists
        try {
            await fs.access(path.join(repoPath, dockerfilePath));
        } catch (error) {
            throw new Error(`Dockerfile not found at ${dockerfilePath}`);
        }
        
        // Build Docker image
        try {
            // Get build args
            const buildArgsBean = await R.findAll("build_args", " config_id = ? ", [buildConfig.id]);
            let buildArgsString = "";
            
            if (buildArgsBean && buildArgsBean.length > 0) {
                buildArgsString = buildArgsBean.map(arg => `--build-arg ${arg.name}=${arg.value}`).join(" ");
            }
            
            // Construct image tag
            const imageTag = buildConfig.imageTag || `dockge-build-${repo.id}:latest`;
            
            // Construct build command
            const buildCommand = `docker build -t ${imageTag} ${buildArgsString} -f ${dockerfilePath} .`;
            
            await this.appendToLogs(deployment, `$ ${buildCommand}\n`);
            
            // Execute build command
            const { stdout, stderr } = await execPromise(buildCommand, { cwd: repoPath });
            
            if (stdout) {
                await this.appendToLogs(deployment, `${stdout}\n`);
            }
            
            if (stderr) {
                await this.appendToLogs(deployment, `${stderr}\n`);
            }
            
            await this.appendToLogs(deployment, `Docker image built successfully: ${imageTag}\n`);
        } catch (error) {
            throw new Error(`Docker build failed: ${error}`);
        }
    }
    
    /**
     * Deploy the application
     * @param buildConfig Build configuration
     * @param deployment Deployment record
     * @param repo Git repository
     * @param repoPath Repository path
     */
    private async deployApplication(
        buildConfig: BuildConfig, 
        deployment: Deployment, 
        repo: GitRepository,
        repoPath: string
    ): Promise<void> {
        await this.appendToLogs(deployment, `Deploying application to stack ${repo.stackId}...\n`);
        
        try {
            // Get stack
            const stack = await Stack.getStack(this.server, repo.stackId);
            
            // Copy compose file and env file from repo to stack directory
            const composeFilePath = path.join(repoPath, buildConfig.composeFilePath || "docker-compose.yml");
            const envFilePath = path.join(repoPath, buildConfig.envFilePath || ".env");
            
            // Check if compose file exists
            let composeContent: string;
            try {
                composeContent = await fs.readFile(composeFilePath, "utf-8");
            } catch (error) {
                throw new Error(`Compose file not found at ${buildConfig.composeFilePath || "docker-compose.yml"}`);
            }
            
            // Read env file if it exists
            let envContent = "";
            try {
                envContent = await fs.readFile(envFilePath, "utf-8");
            } catch (error) {
                // Env file might not exist, which is OK
                await this.appendToLogs(deployment, `No .env file found at ${buildConfig.envFilePath || ".env"}, using empty env\n`);
            }
            
            // Create a mock socket for deployment
            const mockSocket = {
                endpoint: "localhost",
                emit: () => {},
                on: () => {},
                join: () => {},
                leave: () => {}
            } as any;
            
            // Create or update stack
            const updatedStack = new Stack(this.server, repo.stackId, composeContent, envContent);
            await updatedStack.save(false); // false means update existing
            
            await this.appendToLogs(deployment, `Stack files updated, deploying stack...\n`);
            
            // Deploy stack
            await updatedStack.deploy(mockSocket);
            
            await this.appendToLogs(deployment, `Stack deployed successfully\n`);
        } catch (error) {
            throw new Error(`Deployment failed: ${error}`);
        }
    }
    
    /**
     * Save build configuration for a stack
     * @param data Build configuration data
     * @returns Saved build configuration
     */
    public async saveBuildConfig(data: any): Promise<BuildConfig> {
        try {
            log.debug("build-engine", `Saving build config for stack ${data.stackName}`);
            
            // Find existing config or create new one
            let buildConfig = await BuildConfig.findByStackName(data.stackName);
            
            if (!buildConfig) {
                buildConfig = new BuildConfig();
                buildConfig.stackName = data.stackName;
            }
            
            // Update config properties
            buildConfig.buildType = data.buildType || "compose-only";
            buildConfig.dockerfilePath = data.dockerfilePath || "Dockerfile";
            buildConfig.composeFilePath = data.composeFilePath || "docker-compose.yml";
            buildConfig.envFilePath = data.envFilePath || ".env";
            buildConfig.imageTag = data.imageTag || "";
            buildConfig.preBuildCommands = data.preBuildCommands || "";
            buildConfig.postBuildCommands = data.postBuildCommands || "";
            
            // Save the config
            await buildConfig.save();
            
            // Handle build arguments if provided
            if (data.buildArgs && Array.isArray(data.buildArgs)) {
                // Delete existing build args
                await R.exec("DELETE FROM build_args WHERE config_id = ?", [
                    buildConfig.id
                ]);
                
                // Save new build args
                for (const arg of data.buildArgs) {
                    await R.exec("INSERT INTO build_args (config_id, name, value) VALUES (?, ?, ?)", [
                        buildConfig.id,
                        arg.name,
                        arg.value
                    ]);
                }
            }
            
            return buildConfig;
        } catch (error) {
            log.error("build-engine", `Error saving build config: ${error}`);
            throw error;
        }
    }
    
    /**
     * Get build configuration for a stack
     * @param stackName Name of the stack
     * @returns Build configuration
     */
    public async getBuildConfig(stackName: string): Promise<any> {
        try {
            log.debug("build-engine", `Getting build config for stack ${stackName}`);
            
            // Find existing config
            const buildConfig = await BuildConfig.findByStackName(stackName);
            
            if (!buildConfig) {
                // Return default config if none exists
                return {
                    buildType: "compose-only",
                    dockerfilePath: "Dockerfile",
                    composeFilePath: "docker-compose.yml",
                    envFilePath: ".env",
                    imageTag: "",
                    preBuildCommands: "",
                    postBuildCommands: "",
                    buildArgs: []
                };
            }
            
            // Get build arguments
            const buildArgs = await R.findAll("build_args", " config_id = ? ", [
                buildConfig.id
            ]);
            
            // Return config with build args
            return {
                id: buildConfig.id,
                stackName: buildConfig.stackName,
                buildType: buildConfig.buildType,
                dockerfilePath: buildConfig.dockerfilePath,
                composeFilePath: buildConfig.composeFilePath,
                envFilePath: buildConfig.envFilePath,
                imageTag: buildConfig.imageTag,
                preBuildCommands: buildConfig.preBuildCommands,
                postBuildCommands: buildConfig.postBuildCommands,
                buildArgs: buildArgs.map(arg => ({
                    name: arg.name,
                    value: arg.value
                }))
            };
        } catch (error) {
            log.error("build-engine", `Error getting build config: ${error}`);
            throw error;
        }
    }
    
    /**
     * Get deployment history for a stack
     * @param stackName Name of the stack
     * @returns Deployment history
     */
    public async getDeploymentHistory(stackName: string): Promise<any[]> {
        try {
            log.debug("build-engine", `Getting deployment history for stack ${stackName}`);
            
            // Find repository by stack name
            const repo = await GitRepository.findByStackName(stackName);
            
            if (!repo) {
                return [];
            }
            
            // Get deployments for this repository
            const deployments = await R.findAll("deployments", " repository_id = ? ORDER BY id DESC LIMIT 10", [
                repo.id
            ]);
            
            if (!deployments || deployments.length === 0) {
                return [];
            }
            
            // Get webhook events for these deployments
            const deploymentIds = deployments.map(d => d.event_id);
            const events = await R.findAll("webhook_events", " id IN (" + deploymentIds.join(",") + ")");
            const eventsMap = {};
            
            for (const event of events) {
                eventsMap[event.id] = event;
            }
            
            // Return formatted deployment history
            return deployments.map(d => ({
                id: d.id,
                buildId: d.build_id,
                status: d.status,
                startedAt: d.started_at,
                completedAt: d.completed_at,
                commitSha: eventsMap[d.event_id]?.commit_sha || "N/A",
                commitMessage: eventsMap[d.event_id]?.commit_message || "Manual build",
                author: eventsMap[d.event_id]?.author || "N/A"
            }));
        } catch (error) {
            log.error("build-engine", `Error getting deployment history: ${error}`);
            throw error;
        }
    }
    
    /**
     * Trigger a manual build for a stack
     * @param stackName Name of the stack
     * @returns Build ID
     */
    public async triggerManualBuild(stackName: string): Promise<string> {
        try {
            log.debug("build-engine", `Manually triggering build for stack ${stackName}`);
            
            // Find repository by stack name
            const repo = await GitRepository.findByStackName(stackName);
            
            if (!repo) {
                throw new Error(`No repository found for stack ${stackName}`);
            }
            
            // Generate a build ID
            const buildId = `manual-${Date.now()}`;
            
            // Create a webhook event for this manual build
            const event = new WebhookEvent();
            event.repositoryId = repo.id;
            event.provider = "manual";
            event.eventType = "manual";
            event.buildId = buildId;
            event.commitSha = "manual";
            event.commitMessage = "Manual build triggered by user";
            event.author = "Dockge User";
            event.status = BUILD_REQUESTED;
            event.payload = JSON.stringify({ manual: true });
            await event.save();
            
            // Queue the build
            await this.queueBuild(event);
            
            return buildId;
        } catch (error) {
            log.error("build-engine", `Error triggering manual build: ${error}`);
            throw error;
        }
    }
}

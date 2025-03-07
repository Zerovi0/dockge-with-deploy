import { log } from "../log";
import R from "redbean-node";

/**
 * BuildConfig model class
 */
export class BuildConfig {
    id: number = 0;
    stackId: string = "";
    repositoryId: number = 0;
    buildType: string = "compose_only"; // 'docker_build', 'compose_only', 'script'
    dockerfilePath: string = "Dockerfile";
    composePath: string = "docker-compose.yml";
    timeout: number = 3600; // In seconds
    autoDeployOnPush: boolean = false;
    autoDeployBranches: string = "[]"; // JSON array of branch patterns
    healthCheckPath: string | null = null;
    healthCheckTimeout: number | null = null;
    rollbackOnFailure: boolean = true;
    preBuildCommands: string | null = null; // JSON array of commands
    postBuildCommands: string | null = null; // JSON array of commands
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    /**
     * Save the build configuration to database
     */
    async save(): Promise<void> {
        try {
            const bean = this.id ? await R.load("build_configs", this.id) : R.dispense("build_configs");
            
            bean.stack_id = this.stackId;
            bean.repository_id = this.repositoryId;
            bean.build_type = this.buildType;
            bean.dockerfile_path = this.dockerfilePath;
            bean.compose_path = this.composePath;
            bean.timeout = this.timeout;
            bean.auto_deploy_on_push = this.autoDeployOnPush;
            bean.auto_deploy_branches = this.autoDeployBranches;
            bean.health_check_path = this.healthCheckPath;
            bean.health_check_timeout = this.healthCheckTimeout;
            bean.rollback_on_failure = this.rollbackOnFailure;
            bean.pre_build_commands = this.preBuildCommands;
            bean.post_build_commands = this.postBuildCommands;
            bean.updated_at = new Date();
            
            if (!this.id) {
                bean.created_at = new Date();
            }
            
            const id = await R.store(bean);
            this.id = id;
            
            log.debug("build-config", `Saved build config ${id} for stack ${this.stackId}`);
        } catch (error) {
            log.error("build-config", `Error saving build config: ${error}`);
            throw error;
        }
    }
    
    /**
     * Find a build config by ID
     * @param id Build config ID
     * @returns BuildConfig or null if not found
     */
    static async findById(id: number): Promise<BuildConfig | null> {
        try {
            const bean = await R.load("build_configs", id);
            
            if (!bean) {
                return null;
            }
            
            return BuildConfig.fromBean(bean);
        } catch (error) {
            log.error("build-config", `Error finding build config: ${error}`);
            return null;
        }
    }

    /**
     * Find a build config by stack ID
     * @param stackId Stack ID
     * @returns BuildConfig or null if not found
     */
    static async findByStackId(stackId: string): Promise<BuildConfig | null> {
        try {
            const bean = await R.findOne("build_configs", " stack_id = ? ", [
                stackId
            ]);
            
            if (!bean) {
                return null;
            }
            
            return BuildConfig.fromBean(bean);
        } catch (error) {
            log.error("build-config", `Error finding build config: ${error}`);
            return null;
        }
    }

    /**
     * Find a build config by repository ID
     * @param repositoryId Repository ID
     * @returns BuildConfig or null if not found
     */
    static async findByRepositoryId(repositoryId: number): Promise<BuildConfig | null> {
        try {
            const bean = await R.findOne("build_configs", " repository_id = ? ", [
                repositoryId
            ]);
            
            if (!bean) {
                return null;
            }
            
            return BuildConfig.fromBean(bean);
        } catch (error) {
            log.error("build-config", `Error finding build config: ${error}`);
            return null;
        }
    }

    /**
     * Create a BuildConfig instance from database bean
     * @param bean Database bean
     * @returns BuildConfig instance
     */
    static fromBean(bean: any): BuildConfig {
        const config = new BuildConfig();
        
        config.id = bean.id;
        config.stackId = bean.stack_id;
        config.repositoryId = bean.repository_id;
        config.buildType = bean.build_type;
        config.dockerfilePath = bean.dockerfile_path;
        config.composePath = bean.compose_path;
        config.timeout = bean.timeout;
        config.autoDeployOnPush = bean.auto_deploy_on_push;
        config.autoDeployBranches = bean.auto_deploy_branches;
        config.healthCheckPath = bean.health_check_path;
        config.healthCheckTimeout = bean.health_check_timeout;
        config.rollbackOnFailure = bean.rollback_on_failure;
        config.preBuildCommands = bean.pre_build_commands;
        config.postBuildCommands = bean.post_build_commands;
        config.createdAt = bean.created_at;
        config.updatedAt = bean.updated_at;
        
        return config;
    }

    /**
     * Find a build configuration by stack name
     * @param stackName Name of the stack
     * @returns BuildConfig or null if not found
     */
    static async findByStackName(stackName: string): Promise<BuildConfig | null> {
        try {
            const bean = await R.findOne("build_configs", " stack_name = ? ", [
                stackName
            ]);
            
            if (!bean) {
                return null;
            }
            
            return BuildConfig.fromBean(bean);
        } catch (error) {
            log.error("build-config", `Error finding build config: ${error}`);
            return null;
        }
    }

    /**
     * Find a build configuration by ID
     * @param id Build configuration ID
     * @returns BuildConfig or null if not found
     */
    static async findById(id: number): Promise<BuildConfig | null> {
        try {
            const bean = await R.load("build_configs", id);
            
            if (!bean) {
                return null;
            }
            
            return BuildConfig.fromBean(bean);
        } catch (error) {
            log.error("build-config", `Error finding build config: ${error}`);
            return null;
        }
    }

    /**
     * Create a BuildConfig instance from database bean
     * @param bean Database bean
     * @returns BuildConfig instance
     */
    static fromBean(bean: any): BuildConfig {
        const config = new BuildConfig();
        
        config.id = bean.id;
        config.stackName = bean.stack_name;
        config.buildType = bean.build_type;
        config.dockerfilePath = bean.dockerfile_path;
        config.composeFilePath = bean.compose_file_path;
        config.envFilePath = bean.env_file_path;
        config.imageTag = bean.image_tag;
        config.preBuildCommands = bean.pre_build_commands;
        config.postBuildCommands = bean.post_build_commands;
        config.createdAt = bean.created_at;
        config.updatedAt = bean.updated_at;
        
        return config;
    }
}

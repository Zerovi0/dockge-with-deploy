import { log } from "../log";
import { DockgeServer } from "../dockge-server";
import { GitRepository, GitCommit, GitProvider } from "../models/git-repository";
import { GitAuth } from "./git-auth";
import { GitOperations } from "./git-operations";
import { getProviderHandler } from "./git-providers/git-provider-handler";
import path from "path";
import fs from "fs/promises";
import { initEncryptionKey } from "../utils/crypto";

/**
 * GitHandler manages all Git operations for Dockge
 */
export class GitHandler {
    private server: DockgeServer;
    
    /**
     * Create a new GitHandler instance
     * @param server Dockge server instance
     */
    constructor(server: DockgeServer) {
        this.server = server;
        
        // Initialize the encryption key
        initEncryptionKey();
        
        log.info("git-handler", "GitHandler initialized");
    }
    
    /**
     * Initialize Git directory structure
     */
    async initialize(): Promise<void> {
        try {
            // Ensure Git directory exists
            const gitDir = path.join(process.env.DATA_DIR || "./data", "git");
            await fs.mkdir(gitDir, { recursive: true });
            
            // Ensure SSH key directory exists
            const sshDir = GitAuth.getSshKeyDir();
            await fs.mkdir(sshDir, { recursive: true });
            
            log.info("git-handler", "Git directory structure initialized");
        } catch (error) {
            log.error("git-handler", `Failed to initialize Git directory structure: ${error}`);
        }
    }
    
    /**
     * Clone a Git repository
     * @param repo Repository to clone
     * @returns True if successful
     */
    async cloneRepository(repo: GitRepository): Promise<boolean> {
        try {
            log.info("git-handler", `Cloning repository ${repo.url} for stack ${repo.stackId}`);
            
            // Set up authentication
            await GitAuth.setupAuthentication(repo);
            
            // Clone the repository
            const success = await GitOperations.cloneRepository(repo);
            
            if (success) {
                // Update last synced timestamp and commit
                const currentCommit = await this.getCurrentCommit(repo);
                if (currentCommit) {
                    repo.lastSyncedAt = new Date();
                    repo.lastSyncedCommit = currentCommit.sha;
                    await repo.save();
                }
            }
            
            return success;
        } catch (error) {
            log.error("git-handler", `Failed to clone repository: ${error}`);
            return false;
        }
    }
    
    /**
     * Pull latest changes from remote
     * @param repo Repository to pull
     * @returns True if successful
     */
    async pullRepository(repo: GitRepository): Promise<boolean> {
        try {
            log.info("git-handler", `Pulling latest changes for stack ${repo.stackId}`);
            
            // Set up authentication
            await GitAuth.setupAuthentication(repo);
            
            // Pull the repository
            const success = await GitOperations.pullRepository(repo);
            
            if (success) {
                // Update last synced timestamp and commit
                const currentCommit = await this.getCurrentCommit(repo);
                if (currentCommit) {
                    repo.lastSyncedAt = new Date();
                    repo.lastSyncedCommit = currentCommit.sha;
                    await repo.save();
                }
            }
            
            return success;
        } catch (error) {
            log.error("git-handler", `Failed to pull repository: ${error}`);
            return false;
        }
    }
    
    /**
     * Check out a specific branch
     * @param repo Repository to use
     * @param branch Branch name to check out
     * @returns True if successful
     */
    async checkoutBranch(repo: GitRepository, branch: string): Promise<boolean> {
        try {
            log.info("git-handler", `Checking out branch ${branch} for stack ${repo.stackId}`);
            
            // Set up authentication
            await GitAuth.setupAuthentication(repo);
            
            // Check out the branch
            return await GitOperations.checkoutBranch(repo, branch);
        } catch (error) {
            log.error("git-handler", `Failed to check out branch: ${error}`);
            return false;
        }
    }
    
    /**
     * Get commit history
     * @param repo Repository to get history from
     * @param limit Number of commits to fetch
     * @returns Array of commits
     */
    async getCommitHistory(repo: GitRepository, limit: number = 10): Promise<GitCommit[]> {
        try {
            return await GitOperations.getCommitHistory(repo, limit);
        } catch (error) {
            log.error("git-handler", `Failed to get commit history: ${error}`);
            return [];
        }
    }
    
    /**
     * Get current commit
     * @param repo Repository to get commit from
     * @returns Current commit or null if error
     */
    async getCurrentCommit(repo: GitRepository): Promise<GitCommit | null> {
        try {
            return await GitOperations.getCurrentCommit(repo);
        } catch (error) {
            log.error("git-handler", `Failed to get current commit: ${error}`);
            return null;
        }
    }
    
    /**
     * Get file content
     * @param repo Repository to get file from
     * @param filePath Path to file in repository
     * @returns File content as string
     */
    async getFileContent(repo: GitRepository, filePath: string): Promise<string> {
        try {
            return await GitOperations.getFileContent(repo, filePath);
        } catch (error) {
            log.error("git-handler", `Failed to get file content: ${error}`);
            return "";
        }
    }
    
    /**
     * List files in directory
     * @param repo Repository to list files from
     * @param directory Directory path in repository
     * @returns Array of file paths
     */
    async listFiles(repo: GitRepository, directory: string = "."): Promise<string[]> {
        try {
            return await GitOperations.listFiles(repo, directory);
        } catch (error) {
            log.error("git-handler", `Failed to list files: ${error}`);
            return [];
        }
    }
    
    /**
     * Set up authentication
     * @param repo Repository to set up authentication for
     */
    async setupAuthentication(repo: GitRepository): Promise<void> {
        try {
            await GitAuth.setupAuthentication(repo);
        } catch (error) {
            log.error("git-handler", `Failed to set up authentication: ${error}`);
            throw error;
        }
    }
    
    /**
     * Test connection to a repository
     * @param repo Repository to test
     * @returns True if connection successful
     */
    async testConnection(repo: GitRepository): Promise<boolean> {
        try {
            return await GitAuth.testConnection(repo);
        } catch (error) {
            log.error("git-handler", `Connection test failed: ${error}`);
            return false;
        }
    }
    
    /**
     * Get provider-specific handler
     * @param provider Git provider type
     * @returns Provider handler instance
     */
    getProviderHandler(provider: GitProvider) {
        return getProviderHandler(provider);
    }
    
    /**
     * Generate webhook URL for a repository
     * @param repo Repository to generate URL for
     * @returns Webhook URL
     */
    generateWebhookUrl(repo: GitRepository): string {
        const provider = this.getProviderHandler(repo.provider);
        return provider.generateWebhookUrl(repo);
    }
    
    /**
     * Get default branch for a repository
     * @param repo Repository to get default branch for
     * @returns Default branch name
     */
    async getDefaultBranch(repo: GitRepository): Promise<string> {
        try {
            const provider = this.getProviderHandler(repo.provider);
            return await provider.getDefaultBranch(repo);
        } catch (error) {
            log.error("git-handler", `Failed to get default branch: ${error}`);
            return "main"; // Default fallback
        }
    }
    
    /**
     * Get repository details from URL
     * @param url Repository URL
     * @param provider Git provider type
     * @returns Partial repository info
     */
    async getRepositoryDetails(url: string, provider: GitProvider): Promise<Partial<GitRepository>> {
        try {
            const providerHandler = this.getProviderHandler(provider);
            return await providerHandler.getRepositoryDetails(url);
        } catch (error) {
            log.error("git-handler", `Failed to get repository details: ${error}`);
            return {};
        }
    }
}

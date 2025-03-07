import { log } from "../log";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import util from "util";
import { GitRepository, GitCommit } from "../models/git-repository";

const execPromise = util.promisify(exec);

/**
 * Common Git operations regardless of provider
 */
export class GitOperations {
    /**
     * Get the local repository path for a Git repository
     * @param repo Git repository object
     * @returns Absolute path to the local repository
     */
    static getRepositoryPath(repo: GitRepository): string {
        return path.join(process.env.DATA_DIR || "./data", "git", repo.stackId);
    }

    /**
     * Check if a local repository exists
     * @param repo Git repository object
     * @returns True if the repository exists locally
     */
    static async repositoryExists(repo: GitRepository): Promise<boolean> {
        const repoPath = this.getRepositoryPath(repo);
        try {
            const stats = await fs.stat(repoPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Execute a Git command in the repository directory
     * @param repo Git repository
     * @param command Git command to execute
     * @returns Output from the command
     */
    static async executeGitCommand(repo: GitRepository, command: string): Promise<string> {
        const repoPath = this.getRepositoryPath(repo);
        
        try {
            const { stdout, stderr } = await execPromise(`git ${command}`, {
                cwd: repoPath,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            });
            
            if (stderr) {
                log.debug("git", `Command '${command}' stderr: ${stderr}`);
            }
            
            return stdout.trim();
        } catch (error: any) {
            log.error("git", `Error executing Git command '${command}': ${error.message}`);
            throw new Error(`Git error: ${error.message}`);
        }
    }

    /**
     * Clone a repository
     * @param repo Git repository to clone
     * @returns True if successful
     */
    static async cloneRepository(repo: GitRepository): Promise<boolean> {
        const repoPath = this.getRepositoryPath(repo);
        
        try {
            // Ensure directory doesn't exist
            const exists = await this.repositoryExists(repo);
            if (exists) {
                log.warn("git", `Repository already exists at ${repoPath}`);
                return true;
            }
            
            // Ensure parent directory exists
            await fs.mkdir(path.dirname(repoPath), { recursive: true });
            
            // Build clone command
            let cloneCommand = `clone --depth 1`;
            
            // Add branch if specified
            if (repo.branch) {
                cloneCommand += ` --branch ${repo.branch}`;
            }
            
            // Add repository URL and target path
            cloneCommand += ` ${repo.url} ${repoPath}`;
            
            // Execute clone
            await execPromise(`git ${cloneCommand}`);
            
            log.info("git", `Cloned repository ${repo.url} to ${repoPath}`);
            return true;
        } catch (error: any) {
            log.error("git", `Failed to clone repository ${repo.url}: ${error.message}`);
            return false;
        }
    }

    /**
     * Pull latest changes from remote
     * @param repo Git repository to pull
     * @returns True if successful
     */
    static async pullRepository(repo: GitRepository): Promise<boolean> {
        try {
            // Check if repository exists
            const exists = await this.repositoryExists(repo);
            if (!exists) {
                log.warn("git", `Repository does not exist, cannot pull`);
                return false;
            }
            
            // Execute pull
            await this.executeGitCommand(repo, "pull --ff-only");
            
            log.info("git", `Pulled latest changes for ${repo.stackId}`);
            return true;
        } catch (error) {
            log.error("git", `Failed to pull repository: ${error}`);
            return false;
        }
    }

    /**
     * Check out a specific branch
     * @param repo Git repository
     * @param branch Branch name to check out
     * @returns True if successful
     */
    static async checkoutBranch(repo: GitRepository, branch: string): Promise<boolean> {
        try {
            // Check if repository exists
            const exists = await this.repositoryExists(repo);
            if (!exists) {
                log.warn("git", `Repository does not exist, cannot check out branch`);
                return false;
            }
            
            // Execute checkout
            await this.executeGitCommand(repo, `checkout ${branch}`);
            
            log.info("git", `Checked out branch ${branch} for ${repo.stackId}`);
            return true;
        } catch (error) {
            log.error("git", `Failed to check out branch ${branch}: ${error}`);
            return false;
        }
    }

    /**
     * Get commit history
     * @param repo Git repository
     * @param limit Number of commits to fetch
     * @returns Array of GitCommit objects
     */
    static async getCommitHistory(repo: GitRepository, limit: number = 10): Promise<GitCommit[]> {
        try {
            // Check if repository exists
            const exists = await this.repositoryExists(repo);
            if (!exists) {
                log.warn("git", `Repository does not exist, cannot get commit history`);
                return [];
            }
            
            // Format: hash, author name, date, subject
            const output = await this.executeGitCommand(
                repo, 
                `log -n ${limit} --pretty=format:"%H|%an|%ad|%s"`
            );
            
            // Parse commits
            const commits: GitCommit[] = [];
            const lines = output.split("\n");
            
            for (const line of lines) {
                const [sha, author, dateStr, message] = line.split("|");
                commits.push({
                    sha,
                    author,
                    message,
                    date: new Date(dateStr),
                });
            }
            
            return commits;
        } catch (error) {
            log.error("git", `Failed to get commit history: ${error}`);
            return [];
        }
    }

    /**
     * Get current commit
     * @param repo Git repository
     * @returns GitCommit object or null if error
     */
    static async getCurrentCommit(repo: GitRepository): Promise<GitCommit | null> {
        try {
            // Check if repository exists
            const exists = await this.repositoryExists(repo);
            if (!exists) {
                log.warn("git", `Repository does not exist, cannot get current commit`);
                return null;
            }
            
            // Get commit hash
            const sha = await this.executeGitCommand(repo, "rev-parse HEAD");
            
            // Get commit details
            const details = await this.executeGitCommand(
                repo,
                `log -1 --pretty=format:"%an|%ad|%s" ${sha}`
            );
            
            const [author, dateStr, message] = details.split("|");
            
            // Get current branch
            const branch = await this.executeGitCommand(repo, "rev-parse --abbrev-ref HEAD");
            
            return {
                sha,
                author,
                message,
                date: new Date(dateStr),
                branch,
            };
        } catch (error) {
            log.error("git", `Failed to get current commit: ${error}`);
            return null;
        }
    }

    /**
     * Get file content
     * @param repo Git repository
     * @param filePath Path to file in repository
     * @returns File content as string
     */
    static async getFileContent(repo: GitRepository, filePath: string): Promise<string> {
        try {
            // Check if repository exists
            const exists = await this.repositoryExists(repo);
            if (!exists) {
                log.warn("git", `Repository does not exist, cannot get file content`);
                return "";
            }
            
            const repoPath = this.getRepositoryPath(repo);
            const fullPath = path.join(repoPath, filePath);
            
            // Check if file exists and is within the repository
            if (!fullPath.startsWith(repoPath)) {
                log.warn("git", `File path is outside repository: ${filePath}`);
                return "";
            }
            
            const content = await fs.readFile(fullPath, "utf-8");
            return content;
        } catch (error) {
            log.error("git", `Failed to get file content: ${error}`);
            return "";
        }
    }

    /**
     * List files in directory
     * @param repo Git repository
     * @param directory Directory path in repository
     * @returns Array of file paths
     */
    static async listFiles(repo: GitRepository, directory: string = "."): Promise<string[]> {
        try {
            // Check if repository exists
            const exists = await this.repositoryExists(repo);
            if (!exists) {
                log.warn("git", `Repository does not exist, cannot list files`);
                return [];
            }
            
            const repoPath = this.getRepositoryPath(repo);
            const dirPath = path.join(repoPath, directory);
            
            // Check if directory exists and is within the repository
            if (!dirPath.startsWith(repoPath)) {
                log.warn("git", `Directory path is outside repository: ${directory}`);
                return [];
            }
            
            // List files
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            
            return files.map(file => {
                const relativePath = path.join(directory, file.name);
                return file.isDirectory() ? `${relativePath}/` : relativePath;
            });
        } catch (error) {
            log.error("git", `Failed to list files: ${error}`);
            return [];
        }
    }
}

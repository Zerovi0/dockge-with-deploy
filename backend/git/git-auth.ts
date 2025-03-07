import { log } from "../log";
import path from "path";
import fs from "fs/promises";
import { exec } from "child_process";
import util from "util";
import { GitRepository, GitAuthType } from "../models/git-repository";
import os from "os";

const execPromise = util.promisify(exec);

/**
 * Git authentication utilities
 */
export class GitAuth {
    /**
     * Get the SSH key directory path
     * @returns Path to SSH key directory
     */
    static getSshKeyDir(): string {
        return path.join(process.env.DATA_DIR || "./data", "ssh");
    }

    /**
     * Get SSH private key path for a repository
     * @param repo Git repository
     * @returns Path to SSH private key file
     */
    static getSshKeyPath(repo: GitRepository): string {
        return path.join(this.getSshKeyDir(), `${repo.stackId}.key`);
    }

    /**
     * Get SSH known hosts path
     * @returns Path to known hosts file
     */
    static getKnownHostsPath(): string {
        return path.join(this.getSshKeyDir(), "known_hosts");
    }

    /**
     * Set up authentication for a repository
     * @param repo Git repository to set up authentication for
     */
    static async setupAuthentication(repo: GitRepository): Promise<void> {
        switch (repo.authType) {
            case GitAuthType.NONE:
                // No authentication needed
                return;
                
            case GitAuthType.SSH_KEY:
                await this.setupSshKey(repo);
                break;
                
            case GitAuthType.HTTP_TOKEN:
                await this.setupHttpCredentials(repo);
                break;
                
            default:
                log.warn("git-auth", `Unknown authentication type: ${repo.authType}`);
        }
    }

    /**
     * Set up SSH key authentication
     * @param repo Git repository
     */
    private static async setupSshKey(repo: GitRepository): Promise<void> {
        if (!repo.credentials?.privateKey) {
            throw new Error("SSH private key not provided");
        }

        try {
            // Create SSH directory if it doesn't exist
            const sshDir = this.getSshKeyDir();
            await fs.mkdir(sshDir, { recursive: true });
            
            // Write private key to file
            const keyPath = this.getSshKeyPath(repo);
            await fs.writeFile(keyPath, repo.credentials.privateKey);
            
            // Set correct permissions on private key
            await fs.chmod(keyPath, 0o600);
            
            log.info("git-auth", `Created SSH key for repository ${repo.stackId}`);
            
            // Create SSH config if needed
            await this.ensureSshConfig();
            
            // Add host to known hosts if not already there
            await this.addToKnownHosts(repo);
        } catch (error) {
            log.error("git-auth", `Failed to set up SSH key: ${error}`);
            throw new Error(`Failed to set up SSH authentication: ${error}`);
        }
    }

    /**
     * Set up HTTP token authentication
     * @param repo Git repository
     */
    private static async setupHttpCredentials(repo: GitRepository): Promise<void> {
        if (!repo.credentials?.token) {
            throw new Error("HTTP token not provided");
        }

        try {
            // Extract domain from URL
            const url = new URL(repo.url);
            const domain = url.hostname;
            
            // Create netrc entry for the domain
            const username = repo.credentials.username || "git";
            
            // Using credential helper instead of .netrc
            const configCommand = [
                `git config --global credential.helper store`,
                `git config --global credential.${domain}.username ${username}`,
            ].join(" && ");
            
            await execPromise(configCommand);
            
            // Store credential
            const homeDir = os.homedir();
            const credPath = path.join(homeDir, ".git-credentials");
            
            // Ensure file exists
            try {
                await fs.access(credPath);
            } catch {
                await fs.writeFile(credPath, "", { mode: 0o600 });
            }
            
            // Add or update credential
            const credential = `https://${username}:${repo.credentials.token}@${domain}\\n`;
            await fs.appendFile(credPath, credential);
            
            log.info("git-auth", `Set up HTTP credentials for ${domain}`);
        } catch (error) {
            log.error("git-auth", `Failed to set up HTTP credentials: ${error}`);
            throw new Error(`Failed to set up HTTP authentication: ${error}`);
        }
    }

    /**
     * Ensure SSH config exists and has correct settings
     */
    private static async ensureSshConfig(): Promise<void> {
        const sshDir = this.getSshKeyDir();
        const configPath = path.join(sshDir, "config");
        
        try {
            // Check if config exists
            try {
                await fs.access(configPath);
                return; // Already exists
            } catch {
                // Create config file
                const config = [
                    "Host *",
                    "    StrictHostKeyChecking accept-new",
                    "    UserKnownHostsFile " + this.getKnownHostsPath(),
                    "    IdentityFile %d/%f",
                ].join("\\n");
                
                await fs.writeFile(configPath, config);
                await fs.chmod(configPath, 0o600);
                
                log.info("git-auth", "Created SSH config");
            }
        } catch (error) {
            log.error("git-auth", `Failed to create SSH config: ${error}`);
        }
    }

    /**
     * Add host to known hosts file
     * @param repo Git repository
     */
    private static async addToKnownHosts(repo: GitRepository): Promise<void> {
        try {
            // Extract domain from URL
            let domain = repo.url;
            if (domain.startsWith("git@")) {
                domain = domain.split("@")[1].split(":")[0];
            } else if (domain.includes("://")) {
                domain = new URL(domain).hostname;
            }
            
            // Create known hosts file if it doesn't exist
            const knownHostsPath = this.getKnownHostsPath();
            try {
                await fs.access(knownHostsPath);
            } catch {
                await fs.writeFile(knownHostsPath, "", { mode: 0o600 });
            }
            
            // Add host keys using ssh-keyscan
            const { stdout } = await execPromise(`ssh-keyscan -H ${domain}`);
            if (stdout.trim()) {
                await fs.appendFile(knownHostsPath, stdout);
                log.info("git-auth", `Added ${domain} to known hosts`);
            }
        } catch (error) {
            log.warn("git-auth", `Failed to add host to known hosts: ${error}`);
            // Continue anyway, since this is not critical
        }
    }

    /**
     * Test connection to a repository
     * @param repo Git repository
     * @returns True if connection successful
     */
    static async testConnection(repo: GitRepository): Promise<boolean> {
        try {
            // Set up authentication
            await this.setupAuthentication(repo);
            
            // Test connection using git ls-remote
            let command = "git ls-remote --heads";
            
            // Add SSH options if using SSH
            if (repo.authType === GitAuthType.SSH_KEY) {
                const keyPath = this.getSshKeyPath(repo);
                command += ` -o "ssh -i ${keyPath} -o StrictHostKeyChecking=accept-new"`;
            }
            
            command += ` ${repo.url}`;
            
            await execPromise(command);
            return true;
        } catch (error) {
            log.error("git-auth", `Connection test failed: ${error}`);
            return false;
        }
    }
}

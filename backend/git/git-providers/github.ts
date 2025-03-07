import { log } from "../../log";
import { GitRepository } from "../../models/git-repository";
import { GitProviderHandler, WebhookPayloadMetadata } from "./git-provider-handler";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

/**
 * GitHub-specific provider implementation
 */
export class GitHubProvider implements GitProviderHandler {
    /**
     * Generate webhook URL for a GitHub repository
     * @param repo Git repository
     * @returns Full webhook URL
     */
    generateWebhookUrl(repo: GitRepository): string {
        // Construct the base URL from environment or use a default
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        return `${baseUrl}/api/webhooks/github/${repo.id}`;
    }
    
    /**
     * Parse GitHub webhook payload
     * @param payload Request body payload
     * @param headers HTTP headers
     * @param secret Webhook secret for verification
     * @returns Webhook payload metadata
     */
    parseWebhookPayload(payload: any, headers: any, secret?: string): WebhookPayloadMetadata {
        const result: WebhookPayloadMetadata = {
            eventType: headers["x-github-event"] || "unknown",
            verified: false
        };
        
        // Verify signature if a secret is provided
        if (secret) {
            const signature = headers["x-hub-signature-256"] || "";
            result.verified = this.verifySignature(payload, signature, secret);
        }
        
        // Extract information based on event type
        switch (result.eventType) {
            case "push":
                // Handle push event
                if (payload.ref && payload.ref.startsWith("refs/heads/")) {
                    result.branch = payload.ref.replace("refs/heads/", "");
                }
                
                if (payload.after && payload.after !== "0000000000000000000000000000000000000000") {
                    result.commit = payload.after;
                    
                    // Get head commit info if available
                    if (payload.head_commit) {
                        result.commitMessage = payload.head_commit.message;
                        result.author = payload.head_commit.author?.name || payload.head_commit.committer?.name;
                    }
                }
                break;
                
            case "release":
                // Handle release event
                if (payload.release?.tag_name) {
                    result.tag = payload.release.tag_name;
                }
                break;
                
            case "ping":
                // Ping event is just for testing the webhook
                log.info("github", "Received ping event from GitHub");
                break;
                
            default:
                log.warn("github", `Unhandled GitHub event type: ${result.eventType}`);
        }
        
        return result;
    }
    
    /**
     * Verify webhook signature
     * @param payload Request body payload
     * @param signature X-Hub-Signature-256 header
     * @param secret Webhook secret
     * @returns True if signature is valid
     */
    private verifySignature(payload: any, signature: string, secret: string): boolean {
        if (!signature || !signature.startsWith("sha256=")) {
            return false;
        }
        
        try {
            const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
            const hmac = crypto.createHmac("sha256", secret);
            const digest = "sha256=" + hmac.update(payloadString).digest("hex");
            
            return crypto.timingSafeEqual(
                Buffer.from(digest),
                Buffer.from(signature)
            );
        } catch (error) {
            log.error("github", `Signature verification failed: ${error}`);
            return false;
        }
    }
    
    /**
     * Get default branch for a GitHub repository
     * @param repo Git repository
     * @returns Promise resolving to default branch name
     */
    async getDefaultBranch(repo: GitRepository): Promise<string> {
        try {
            // Extract owner and repo name from URL
            const { owner, repoName } = this.extractRepoInfo(repo.url);
            if (!owner || !repoName) {
                return "main"; // Fallback to main if extraction fails
            }
            
            // Use API if credentials are provided
            if (repo.credentials?.token) {
                const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
                const curlCommand = `curl -s -H "Authorization: token ${repo.credentials.token}" ${apiUrl}`;
                
                const { stdout } = await execPromise(curlCommand);
                const response = JSON.parse(stdout);
                
                if (response.default_branch) {
                    return response.default_branch;
                }
            }
            
            // Fallback to git command
            const { stdout } = await execPromise(`git ls-remote --symref ${repo.url} HEAD`);
            const match = stdout.match(/ref: refs\/heads\/([^\s]+)/);
            return match ? match[1] : "main";
        } catch (error) {
            log.error("github", `Failed to get default branch: ${error}`);
            return "main"; // Default fallback
        }
    }
    
    /**
     * Get repository details from GitHub URL
     * @param url Repository URL
     * @returns Promise resolving to partial repository info
     */
    async getRepositoryDetails(url: string): Promise<Partial<GitRepository>> {
        const details: Partial<GitRepository> = {};
        
        try {
            // Extract owner and repo name from URL
            const { owner, repoName } = this.extractRepoInfo(url);
            if (!owner || !repoName) {
                return details;
            }
            
            // Use git command to get default branch
            const { stdout } = await execPromise(`git ls-remote --symref ${url} HEAD`);
            const match = stdout.match(/ref: refs\/heads\/([^\s]+)/);
            if (match) {
                details.branch = match[1];
            }
        } catch (error) {
            log.error("github", `Failed to get repository details: ${error}`);
        }
        
        return details;
    }
    
    /**
     * Extract owner and repository name from GitHub URL
     * @param url GitHub repository URL
     * @returns Object with owner and repository name
     */
    private extractRepoInfo(url: string): { owner?: string; repoName?: string } {
        try {
            // Handle different URL formats
            let match;
            
            // Format: https://github.com/owner/repo.git
            match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
            if (match) {
                return {
                    owner: match[1],
                    repoName: match[2]
                };
            }
            
            // Format: git@github.com:owner/repo.git
            match = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
            if (match) {
                return {
                    owner: match[1],
                    repoName: match[2]
                };
            }
        } catch (error) {
            log.error("github", `Failed to extract repo info: ${error}`);
        }
        
        return {};
    }
}

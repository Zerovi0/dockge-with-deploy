import { log } from "../../log";
import { GitRepository } from "../../models/git-repository";
import { GitProviderHandler, WebhookPayloadMetadata } from "./git-provider-handler";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

/**
 * Generic Git provider implementation that works with any standard Git repository
 */
export class GenericProvider implements GitProviderHandler {
    /**
     * Generate webhook URL for a generic Git repository
     * @param repo Git repository
     * @returns Full webhook URL
     */
    generateWebhookUrl(repo: GitRepository): string {
        // Construct the base URL from environment or use a default
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        return `${baseUrl}/api/webhooks/generic/${repo.id}`;
    }
    
    /**
     * Parse generic webhook payload
     * @param payload Request body payload
     * @param headers HTTP headers
     * @param secret Webhook secret for verification
     * @returns Webhook payload metadata
     */
    parseWebhookPayload(payload: any, headers: any, secret?: string): WebhookPayloadMetadata {
        const result: WebhookPayloadMetadata = {
            eventType: "push", // Default to push event for generic webhooks
            verified: false
        };
        
        // Verify token if a secret is provided
        if (secret) {
            const token = headers["x-webhook-token"] || headers["x-webhook-secret"] || "";
            result.verified = (token === secret);
        }
        
        // Try to extract information from common webhook payload formats
        try {
            // Extract branch information
            if (payload.ref && typeof payload.ref === "string") {
                if (payload.ref.startsWith("refs/heads/")) {
                    result.branch = payload.ref.replace("refs/heads/", "");
                } else if (payload.ref.startsWith("refs/tags/")) {
                    result.tag = payload.ref.replace("refs/tags/", "");
                } else {
                    result.branch = payload.ref;
                }
            } else if (payload.branch && typeof payload.branch === "string") {
                result.branch = payload.branch;
            }
            
            // Extract commit information
            if (payload.after && typeof payload.after === "string") {
                result.commit = payload.after;
            } else if (payload.commit && typeof payload.commit === "string") {
                result.commit = payload.commit;
            } else if (payload.sha && typeof payload.sha === "string") {
                result.commit = payload.sha;
            }
            
            // Extract commit message
            if (payload.message && typeof payload.message === "string") {
                result.commitMessage = payload.message;
            } else if (payload.commits && Array.isArray(payload.commits) && payload.commits.length > 0) {
                const lastCommit = payload.commits[payload.commits.length - 1];
                if (lastCommit.message) {
                    result.commitMessage = lastCommit.message;
                }
            } else if (payload.head_commit && payload.head_commit.message) {
                result.commitMessage = payload.head_commit.message;
            }
            
            // Extract author information
            if (payload.author && typeof payload.author === "string") {
                result.author = payload.author;
            } else if (payload.commits && Array.isArray(payload.commits) && payload.commits.length > 0) {
                const lastCommit = payload.commits[payload.commits.length - 1];
                if (lastCommit.author && lastCommit.author.name) {
                    result.author = lastCommit.author.name;
                }
            } else if (payload.head_commit && payload.head_commit.author && payload.head_commit.author.name) {
                result.author = payload.head_commit.author.name;
            }
        } catch (error) {
            log.error("generic", `Error parsing webhook payload: ${error}`);
        }
        
        return result;
    }
    
    /**
     * Get default branch for a generic Git repository
     * @param repo Git repository
     * @returns Promise resolving to default branch name
     */
    async getDefaultBranch(repo: GitRepository): Promise<string> {
        try {
            // Use git command to determine default branch
            const { stdout } = await execPromise(`git ls-remote --symref ${repo.url} HEAD`);
            const match = stdout.match(/ref: refs\/heads\/([^\s]+)/);
            return match ? match[1] : "main";
        } catch (error) {
            log.error("generic", `Failed to get default branch: ${error}`);
            return "main"; // Default fallback
        }
    }
    
    /**
     * Get repository details from a generic Git URL
     * @param url Repository URL
     * @returns Promise resolving to partial repository info
     */
    async getRepositoryDetails(url: string): Promise<Partial<GitRepository>> {
        const details: Partial<GitRepository> = {};
        
        try {
            // Use git command to get default branch
            const { stdout } = await execPromise(`git ls-remote --symref ${url} HEAD`);
            const match = stdout.match(/ref: refs\/heads\/([^\s]+)/);
            if (match) {
                details.branch = match[1];
            }
        } catch (error) {
            log.error("generic", `Failed to get repository details: ${error}`);
        }
        
        return details;
    }
}

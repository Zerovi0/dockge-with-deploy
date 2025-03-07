import { log } from "../../log";
import { GitRepository } from "../../models/git-repository";
import { GitProviderHandler, WebhookPayloadMetadata } from "./git-provider-handler";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

/**
 * GitLab-specific provider implementation
 */
export class GitLabProvider implements GitProviderHandler {
    /**
     * Generate webhook URL for a GitLab repository
     * @param repo Git repository
     * @returns Full webhook URL
     */
    generateWebhookUrl(repo: GitRepository): string {
        // Construct the base URL from environment or use a default
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        return `${baseUrl}/api/webhooks/gitlab/${repo.id}`;
    }
    
    /**
     * Parse GitLab webhook payload
     * @param payload Request body payload
     * @param headers HTTP headers
     * @param secret Webhook secret for verification
     * @returns Webhook payload metadata
     */
    parseWebhookPayload(payload: any, headers: any, secret?: string): WebhookPayloadMetadata {
        const result: WebhookPayloadMetadata = {
            eventType: headers["x-gitlab-event"] || "unknown",
            verified: false
        };
        
        // Verify token if a secret is provided
        if (secret) {
            const token = headers["x-gitlab-token"] || "";
            result.verified = (token === secret);
        }
        
        // Extract information based on event type
        if (result.eventType === "Push Hook") {
            // Handle push event
            if (payload.ref && payload.ref.startsWith("refs/heads/")) {
                result.branch = payload.ref.replace("refs/heads/", "");
            }
            
            if (payload.after && payload.after !== "0000000000000000000000000000000000000000") {
                result.commit = payload.after;
                
                // Get commit info if available
                if (payload.commits && payload.commits.length > 0) {
                    const lastCommit = payload.commits[payload.commits.length - 1];
                    result.commitMessage = lastCommit.message;
                    result.author = lastCommit.author?.name;
                }
            }
        } else if (result.eventType === "Tag Push Hook") {
            // Handle tag push event
            if (payload.ref && payload.ref.startsWith("refs/tags/")) {
                result.tag = payload.ref.replace("refs/tags/", "");
            }
        } else if (result.eventType === "System Hook") {
            // System hooks are for instance-level events
            log.info("gitlab", "Received system hook from GitLab");
        } else {
            log.warn("gitlab", `Unhandled GitLab event type: ${result.eventType}`);
        }
        
        return result;
    }
    
    /**
     * Get default branch for a GitLab repository
     * @param repo Git repository
     * @returns Promise resolving to default branch name
     */
    async getDefaultBranch(repo: GitRepository): Promise<string> {
        try {
            // Extract project info from URL
            const projectInfo = this.extractProjectInfo(repo.url);
            if (!projectInfo.id) {
                return "main"; // Fallback to main if extraction fails
            }
            
            // Use API if credentials are provided
            if (repo.credentials?.token) {
                const host = projectInfo.host || "gitlab.com";
                const apiUrl = `https://${host}/api/v4/projects/${encodeURIComponent(projectInfo.id)}`;
                const curlCommand = `curl -s -H "PRIVATE-TOKEN: ${repo.credentials.token}" ${apiUrl}`;
                
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
            log.error("gitlab", `Failed to get default branch: ${error}`);
            return "main"; // Default fallback
        }
    }
    
    /**
     * Get repository details from GitLab URL
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
            log.error("gitlab", `Failed to get repository details: ${error}`);
        }
        
        return details;
    }
    
    /**
     * Extract project information from GitLab URL
     * @param url GitLab repository URL
     * @returns Object with host and project ID
     */
    private extractProjectInfo(url: string): { host?: string; id?: string } {
        try {
            let host = "gitlab.com";
            let id;
            
            // Handle different URL formats
            if (url.includes("@")) {
                // Format: git@gitlab.com:namespace/project.git
                const match = url.match(/@([^:]+):(.+)(?:\.git)?$/);
                if (match) {
                    host = match[1];
                    id = match[2];
                }
            } else if (url.includes("://")) {
                // Format: https://gitlab.com/namespace/project.git
                const urlObj = new URL(url);
                host = urlObj.hostname;
                id = urlObj.pathname.replace(/^\/|\.git$|\/$/g, "");
            }
            
            return { host, id };
        } catch (error) {
            log.error("gitlab", `Failed to extract project info: ${error}`);
            return {};
        }
    }
}

import { log } from "../../log";
import { GitRepository } from "../../models/git-repository";
import { GitProviderHandler, WebhookPayloadMetadata } from "./git-provider-handler";
import crypto from "crypto";
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);

/**
 * Bitbucket-specific provider implementation
 */
export class BitbucketProvider implements GitProviderHandler {
    /**
     * Generate webhook URL for a Bitbucket repository
     * @param repo Git repository
     * @returns Full webhook URL
     */
    generateWebhookUrl(repo: GitRepository): string {
        // Construct the base URL from environment or use a default
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        return `${baseUrl}/api/webhooks/bitbucket/${repo.id}`;
    }
    
    /**
     * Parse Bitbucket webhook payload
     * @param payload Request body payload
     * @param headers HTTP headers
     * @param secret Webhook secret for verification
     * @returns Webhook payload metadata
     */
    parseWebhookPayload(payload: any, headers: any, secret?: string): WebhookPayloadMetadata {
        const result: WebhookPayloadMetadata = {
            eventType: headers["x-event-key"] || "unknown",
            verified: false
        };
        
        // Bitbucket doesn't have built-in webhook secret verification
        // but we can check the IP ranges or implement a custom header check
        // For now, we'll assume verification based on specific headers
        if (headers["x-request-uuid"] && headers["x-hook-uuid"]) {
            result.verified = true;
        }
        
        // Extract information based on event type
        if (result.eventType === "repo:push") {
            // Handle push event
            if (payload.push && payload.push.changes && payload.push.changes.length > 0) {
                const change = payload.push.changes[0];
                
                // Check if it's a branch update
                if (change.new && change.new.type === "branch") {
                    result.branch = change.new.name;
                    
                    // Get commit info if available
                    if (change.new.target) {
                        result.commit = change.new.target.hash;
                        result.commitMessage = change.new.target.message;
                        result.author = change.new.target.author?.user?.display_name;
                    }
                }
                
                // Check if it's a tag update
                if (change.new && change.new.type === "tag") {
                    result.tag = change.new.name;
                }
            }
        } else if (result.eventType === "repo:commit_comment_created") {
            // Comment on commit, not typically used for CI/CD
            log.info("bitbucket", "Received commit comment webhook");
        } else {
            log.warn("bitbucket", `Unhandled Bitbucket event type: ${result.eventType}`);
        }
        
        return result;
    }
    
    /**
     * Get default branch for a Bitbucket repository
     * @param repo Git repository
     * @returns Promise resolving to default branch name
     */
    async getDefaultBranch(repo: GitRepository): Promise<string> {
        try {
            // Extract workspace and repo slug from URL
            const { workspace, repoSlug } = this.extractRepoInfo(repo.url);
            if (!workspace || !repoSlug) {
                return "main"; // Fallback to main if extraction fails
            }
            
            // Use API if credentials are provided
            if (repo.credentials?.username && repo.credentials?.token) {
                const apiUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}`;
                const auth = Buffer.from(`${repo.credentials.username}:${repo.credentials.token}`).toString("base64");
                const curlCommand = `curl -s -H "Authorization: Basic ${auth}" ${apiUrl}`;
                
                const { stdout } = await execPromise(curlCommand);
                const response = JSON.parse(stdout);
                
                if (response.mainbranch && response.mainbranch.name) {
                    return response.mainbranch.name;
                }
            }
            
            // Fallback to git command
            const { stdout } = await execPromise(`git ls-remote --symref ${repo.url} HEAD`);
            const match = stdout.match(/ref: refs\/heads\/([^\s]+)/);
            return match ? match[1] : "main";
        } catch (error) {
            log.error("bitbucket", `Failed to get default branch: ${error}`);
            return "main"; // Default fallback
        }
    }
    
    /**
     * Get repository details from Bitbucket URL
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
            log.error("bitbucket", `Failed to get repository details: ${error}`);
        }
        
        return details;
    }
    
    /**
     * Extract workspace and repository slug from Bitbucket URL
     * @param url Bitbucket repository URL
     * @returns Object with workspace and repository slug
     */
    private extractRepoInfo(url: string): { workspace?: string; repoSlug?: string } {
        try {
            // Handle different URL formats
            let match;
            
            // Format: https://bitbucket.org/workspace/repo.git
            match = url.match(/bitbucket\.org\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
            if (match) {
                return {
                    workspace: match[1],
                    repoSlug: match[2]
                };
            }
            
            // Format: git@bitbucket.org:workspace/repo.git
            match = url.match(/git@bitbucket\.org:([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
            if (match) {
                return {
                    workspace: match[1],
                    repoSlug: match[2]
                };
            }
        } catch (error) {
            log.error("bitbucket", `Failed to extract repo info: ${error}`);
        }
        
        return {};
    }
}

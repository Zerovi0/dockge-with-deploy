import { GitRepository, GitProvider } from "../../models/git-repository";

/**
 * Interface for webhook payload metadata
 */
export interface WebhookPayloadMetadata {
    eventType: string;
    branch?: string;
    commit?: string;
    commitMessage?: string;
    author?: string;
    tag?: string;
    verified: boolean;
}

/**
 * Interface for Git provider handlers
 */
export interface GitProviderHandler {
    /**
     * Generate webhook URL for a repository
     * @param repo Git repository
     * @returns Full webhook URL
     */
    generateWebhookUrl(repo: GitRepository): string;
    
    /**
     * Parse webhook payload from HTTP request
     * @param payload Request body payload
     * @param headers HTTP headers
     * @param secret Webhook secret for verification
     * @returns Webhook payload metadata
     */
    parseWebhookPayload(payload: any, headers: any, secret?: string): WebhookPayloadMetadata;
    
    /**
     * Get default branch for a repository
     * @param repo Git repository
     * @returns Promise resolving to default branch name
     */
    getDefaultBranch(repo: GitRepository): Promise<string>;
    
    /**
     * Get repository details from URL
     * @param url Repository URL
     * @returns Promise resolving to partial repository info
     */
    getRepositoryDetails(url: string): Promise<Partial<GitRepository>>;
}

/**
 * Factory function to get the appropriate provider handler
 * @param provider Git provider type
 * @returns GitProviderHandler implementation
 */
export function getProviderHandler(provider: GitProvider): GitProviderHandler {
    switch (provider) {
        case GitProvider.GITHUB:
            // Lazy load to avoid circular dependencies
            const { GitHubProvider } = require("./github");
            return new GitHubProvider();
            
        case GitProvider.GITLAB:
            const { GitLabProvider } = require("./gitlab");
            return new GitLabProvider();
            
        case GitProvider.BITBUCKET:
            const { BitbucketProvider } = require("./bitbucket");
            return new BitbucketProvider();
            
        case GitProvider.GENERIC:
        default:
            const { GenericProvider } = require("./generic");
            return new GenericProvider();
    }
}

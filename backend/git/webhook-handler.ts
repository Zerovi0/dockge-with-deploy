import express from "express";
import { DockgeServer } from "../dockge-server";
import { GitHandler } from "./git-handler";
import { GitRepository, GitProvider } from "../models/git-repository";
import { WebhookEvent } from "../models/webhook-event";
import { log } from "../log";
import { getProviderHandler } from "./git-providers/git-provider-handler";
import R from "redbean-node";
import { BUILD_REQUESTED, generateRandomCharacters } from "../../common/util-common";

/**
 * WebhookHandler processes incoming webhook events from Git providers
 */
export class WebhookHandler {
    private server: DockgeServer;
    private gitHandler: GitHandler;
    
    /**
     * Create a new WebhookHandler instance
     * @param server Dockge server instance
     * @param gitHandler Git handler instance
     */
    constructor(server: DockgeServer, gitHandler: GitHandler) {
        this.server = server;
        this.gitHandler = gitHandler;
        
        log.info("webhook-handler", "WebhookHandler initialized");
    }
    
    /**
     * Register webhook routes with the Express app
     * @param app Express application
     */
    registerRoutes(app: express.Application): void {
        // GitHub webhook endpoint
        app.post("/api/webhooks/github/:repoId", this.processGitHubWebhook.bind(this));
        
        // GitLab webhook endpoint
        app.post("/api/webhooks/gitlab/:repoId", this.processGitLabWebhook.bind(this));
        
        // Bitbucket webhook endpoint
        app.post("/api/webhooks/bitbucket/:repoId", this.processBitbucketWebhook.bind(this));
        
        // Generic webhook endpoint
        app.post("/api/webhooks/generic/:repoId", this.processGenericWebhook.bind(this));
        
        log.info("webhook-handler", "Webhook routes registered");
    }
    
    /**
     * Process GitHub webhook
     * @param req Express request
     * @param res Express response
     */
    async processGitHubWebhook(req: express.Request, res: express.Response): Promise<void> {
        try {
            await this.processWebhook(req, res, GitProvider.GITHUB);
        } catch (error) {
            log.error("webhook-handler", `Error processing GitHub webhook: ${error}`);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    
    /**
     * Process GitLab webhook
     * @param req Express request
     * @param res Express response
     */
    async processGitLabWebhook(req: express.Request, res: express.Response): Promise<void> {
        try {
            await this.processWebhook(req, res, GitProvider.GITLAB);
        } catch (error) {
            log.error("webhook-handler", `Error processing GitLab webhook: ${error}`);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    
    /**
     * Process Bitbucket webhook
     * @param req Express request
     * @param res Express response
     */
    async processBitbucketWebhook(req: express.Request, res: express.Response): Promise<void> {
        try {
            await this.processWebhook(req, res, GitProvider.BITBUCKET);
        } catch (error) {
            log.error("webhook-handler", `Error processing Bitbucket webhook: ${error}`);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    
    /**
     * Process generic webhook
     * @param req Express request
     * @param res Express response
     */
    async processGenericWebhook(req: express.Request, res: express.Response): Promise<void> {
        try {
            await this.processWebhook(req, res, GitProvider.GENERIC);
        } catch (error) {
            log.error("webhook-handler", `Error processing generic webhook: ${error}`);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    
    /**
     * Common webhook processing logic
     * @param req Express request
     * @param res Express response
     * @param provider Git provider type
     */
    private async processWebhook(req: express.Request, res: express.Response, provider: GitProvider): Promise<void> {
        const repoId = parseInt(req.params.repoId, 10);
        
        // Check if repository exists
        const repoBean = await R.findOne("git_repositories", " id = ? ", [repoId]);
        if (!repoBean) {
            log.warn("webhook-handler", `Repository with ID ${repoId} not found`);
            res.status(404).json({ error: "Repository not found" });
            return;
        }
        
        const repo = await GitRepository.fromBean(repoBean);
        
        // Check if provider matches
        if (repo.provider !== provider) {
            log.warn("webhook-handler", `Provider mismatch for repository ${repoId}: expected ${provider}, actual ${repo.provider}`);
            res.status(400).json({ error: "Provider mismatch" });
            return;
        }
        
        // Parse the webhook payload
        const providerHandler = getProviderHandler(provider);
        const payload = req.body;
        const headers = req.headers;
        
        const metadata = providerHandler.parseWebhookPayload(payload, headers, repo.webhookSecret);
        
        // Verify the webhook signature if verification is enabled
        if (repo.webhookSecret && !metadata.verified) {
            log.warn("webhook-handler", `Webhook verification failed for repository ${repoId}`);
            res.status(401).json({ error: "Webhook verification failed" });
            return;
        }
        
        // Check if the branch matches
        if (metadata.branch && metadata.branch !== repo.branch) {
            log.info("webhook-handler", `Branch ${metadata.branch} does not match ${repo.branch}, ignoring webhook`);
            res.status(200).json({ message: "Branch not matched, ignoring webhook" });
            return;
        }
        
        // Save webhook event
        const event = new WebhookEvent();
        event.id = await R.count("webhook_events") + 1; // Simple auto-increment
        event.repositoryId = repoId;
        event.eventType = metadata.eventType;
        event.branch = metadata.branch || "";
        event.commit = metadata.commit || "";
        event.commitMessage = metadata.commitMessage || "";
        event.author = metadata.author || "";
        event.tag = metadata.tag || "";
        event.payload = JSON.stringify(payload);
        event.headers = JSON.stringify(headers);
        event.receivedAt = new Date();
        event.status = BUILD_REQUESTED;
        event.buildId = generateRandomCharacters(8).toUpperCase();
        
        // Save event to database
        await event.save();
        
        // Trigger build process
        this.triggerBuild(repo, event);
        
        // Return success response
        res.status(200).json({
            message: "Webhook received successfully",
            eventId: event.id,
            buildId: event.buildId
        });
    }
    
    /**
     * Trigger build process for repository
     * @param repo Git repository
     * @param event Webhook event
     */
    private async triggerBuild(repo: GitRepository, event: WebhookEvent): Promise<void> {
        try {
            // Emit socket event for UI updates
            this.server.io.to(`repo:${repo.id}`).emit("gitWebhookReceived", {
                repositoryId: repo.id,
                eventId: event.id,
                buildId: event.buildId,
                eventType: event.eventType,
                branch: event.branch,
                commit: event.commit,
                commitMessage: event.commitMessage,
                author: event.author,
                receivedAt: event.receivedAt
            });
            
            // This will be handled by the build engine
            this.server.io.emit("buildRequested", {
                repositoryId: repo.id,
                eventId: event.id,
                buildId: event.buildId
            });
            
            log.info("webhook-handler", `Build triggered for repository ${repo.id}, event ${event.id}, build ${event.buildId}`);
        } catch (error) {
            log.error("webhook-handler", `Error triggering build: ${error}`);
        }
    }
}

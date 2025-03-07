import { log } from "../log";
import R from "redbean-node";

/**
 * WebhookEvent model class
 */
export class WebhookEvent {
    id: number = 0;
    repositoryId: number = 0;
    provider: string = "generic";  // 'github', 'gitlab', 'bitbucket', 'generic'
    eventType: string = "";       // e.g., 'push', 'tag', 'pull_request'
    payload: string = "";         // JSON webhook payload
    headers: string = "";         // JSON HTTP headers
    signature: string | null = null;
    verified: boolean = false;
    processed: boolean = false;
    deploymentId: number | null = null;
    receivedAt: Date = new Date();
    processedAt: Date | null = null;
    error: string | null = null;

    /**
     * Save the webhook event to database
     */
    async save(): Promise<void> {
        try {
            const bean = this.id ? await R.load("webhook_events", this.id) : R.dispense("webhook_events");
            
            bean.repository_id = this.repositoryId;
            bean.provider = this.provider;
            bean.event_type = this.eventType;
            bean.payload = this.payload;
            bean.headers = this.headers;
            bean.signature = this.signature;
            bean.verified = this.verified;
            bean.processed = this.processed;
            bean.deployment_id = this.deploymentId;
            bean.received_at = this.receivedAt;
            bean.processed_at = this.processedAt;
            bean.error = this.error;
            
            const id = await R.store(bean);
            this.id = id;
            
            log.debug("webhook-event", `Saved webhook event ${id} for repository ${this.repositoryId}`);
        } catch (error) {
            log.error("webhook-event", `Error saving webhook event: ${error}`);
            throw error;
        }
    }
    
    /**
     * Find a webhook event by ID
     * @param id Webhook event ID
     * @returns WebhookEvent or null if not found
     */
    static async findById(id: number): Promise<WebhookEvent | null> {
        try {
            const bean = await R.load("webhook_events", id);
            
            if (!bean) {
                return null;
            }
            
            return WebhookEvent.fromBean(bean);
        } catch (error) {
            log.error("webhook-event", `Error finding webhook event: ${error}`);
            return null;
        }
    }

    /**
     * Find webhook events by repository ID
     * @param repositoryId Repository ID
     * @param limit Maximum number of events to return
     * @returns Array of WebhookEvent instances
     */
    static async findByRepositoryId(repositoryId: number, limit: number = 10): Promise<WebhookEvent[]> {
        try {
            const beans = await R.findAll("webhook_events", " repository_id = ? ORDER BY id DESC LIMIT ? ", [
                repositoryId,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => WebhookEvent.fromBean(bean));
        } catch (error) {
            log.error("webhook-event", `Error finding webhook events: ${error}`);
            return [];
        }
    }
    
    /**
     * Find webhook events that have not been processed yet
     * @param limit Maximum number of events to return
     * @returns Array of WebhookEvent instances
     */
    static async findUnprocessed(limit: number = 10): Promise<WebhookEvent[]> {
        try {
            const beans = await R.findAll("webhook_events", " processed = ? ORDER BY id ASC LIMIT ? ", [
                false,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => WebhookEvent.fromBean(bean));
        } catch (error) {
            log.error("webhook-event", `Error finding unprocessed webhook events: ${error}`);
            return [];
        }
    }
    
    /**
     * Mark webhook event as processed
     * @param deploymentId ID of the deployment created from this webhook event (optional)
     * @param error Error message if processing failed (optional)
     */
    async markProcessed(deploymentId: number | null = null, error: string | null = null): Promise<void> {
        this.processed = true;
        this.processedAt = new Date();
        
        if (deploymentId) {
            this.deploymentId = deploymentId;
        }
        
        if (error) {
            this.error = error;
        }
        
        await this.save();
    }
    
    /**
     * Create a WebhookEvent instance from database bean
     * @param bean Database bean
     * @returns WebhookEvent instance
     */
    static fromBean(bean: any): WebhookEvent {
        const event = new WebhookEvent();
        
        event.id = bean.id;
        event.repositoryId = bean.repository_id;
        event.provider = bean.provider;
        event.eventType = bean.event_type;
        event.payload = bean.payload;
        event.headers = bean.headers;
        event.signature = bean.signature;
        event.verified = bean.verified ? true : false;
        event.processed = bean.processed ? true : false;
        event.deploymentId = bean.deployment_id;
        event.receivedAt = bean.received_at;
        event.processedAt = bean.processed_at;
        event.error = bean.error;
        
        return event;
    }

    /**
     * Find webhook events by repository ID
     * @param repositoryId Repository ID
     * @param limit Maximum number of events to return
     * @returns Array of WebhookEvent instances
     */
    static async findByRepositoryId(repositoryId: number, limit: number = 10): Promise<WebhookEvent[]> {
        try {
            const beans = await R.findAll("webhook_events", " repository_id = ? ORDER BY id DESC LIMIT ? ", [
                repositoryId,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => WebhookEvent.fromBean(bean));
        } catch (error) {
            log.error("webhook-event", `Error finding webhook events: ${error}`);
            return [];
        }
    }

    /**
     * Find webhook events with specific status
     * @param status Status to filter by
     * @param limit Maximum number of events to return
     * @returns Array of WebhookEvent instances
     */
    static async findByStatus(status: string, limit: number = 10): Promise<WebhookEvent[]> {
        try {
            const beans = await R.findAll("webhook_events", " status = ? ORDER BY id DESC LIMIT ? ", [
                status,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => WebhookEvent.fromBean(bean));
        } catch (error) {
            log.error("webhook-event", `Error finding webhook events: ${error}`);
            return [];
        }
    }

    /**
     * Create a WebhookEvent instance from database bean
     * @param bean Database bean
     * @returns WebhookEvent instance
     */
    static fromBean(bean: any): WebhookEvent {
        const event = new WebhookEvent();
        
        event.id = bean.id;
        event.repositoryId = bean.repository_id;
        event.provider = bean.provider;
        event.eventType = bean.event_type;
        event.buildId = bean.build_id;
        event.commitSha = bean.commit_sha;
        event.commitMessage = bean.commit_message;
        event.author = bean.author;
        event.branch = bean.branch;
        event.tag = bean.tag;
        event.status = bean.status;
        event.payload = bean.payload;
        event.createdAt = bean.created_at;
        event.updatedAt = bean.updated_at;
        
        return event;
    }
}

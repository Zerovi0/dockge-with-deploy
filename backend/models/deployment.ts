import { log } from "../log";
import R from "redbean-node";

/**
 * Deployment model class
 */
export class Deployment {
    id: number = 0;
    stackId: string = "";
    buildConfigId: number = 0; 
    repositoryId: number = 0;
    commitSha: string = "";
    commitMessage: string | null = null;
    commitAuthor: string | null = null;
    branch: string = "";
    tag: string | null = null;
    status: string = "pending"; // 'pending', 'building', 'deploying', 'successful', 'failed', 'rolled_back', 'cancelled'
    startedAt: Date = new Date();
    completedAt: Date | null = null;
    duration: number | null = null; // In seconds
    buildLogs: string | null = null;
    deploymentLogs: string | null = null;
    error: string | null = null;
    triggeredBy: string = "manual"; // 'webhook', 'manual', 'scheduled', 'api'
    triggeredByUser: string | null = null;
    previousDeploymentId: number | null = null;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    /**
     * Save the deployment to database
     */
    async save(): Promise<void> {
        try {
            const bean = this.id ? await R.load("deployments", this.id) : R.dispense("deployments");
            
            bean.stack_id = this.stackId;
            bean.build_config_id = this.buildConfigId;
            bean.repository_id = this.repositoryId;
            bean.commit_sha = this.commitSha;
            bean.commit_message = this.commitMessage;
            bean.commit_author = this.commitAuthor;
            bean.branch = this.branch;
            bean.tag = this.tag;
            bean.status = this.status;
            bean.started_at = this.startedAt;
            bean.completed_at = this.completedAt;
            bean.duration = this.duration;
            bean.build_logs = this.buildLogs;
            bean.deployment_logs = this.deploymentLogs;
            bean.error = this.error;
            bean.triggered_by = this.triggeredBy;
            bean.triggered_by_user = this.triggeredByUser;
            bean.previous_deployment_id = this.previousDeploymentId;
            bean.updated_at = new Date();
            
            if (!this.id) {
                bean.created_at = new Date();
            }
            
            const id = await R.store(bean);
            this.id = id;
            
            log.debug("deployment", `Saved deployment ${id} for stack ${this.stackId}`);
        } catch (error) {
            log.error("deployment", `Error saving deployment: ${error}`);
            throw error;
        }
    }

    /**
     * Find a deployment by ID
     * @param id Deployment ID
     * @returns Deployment or null if not found
     */
    static async findById(id: number): Promise<Deployment | null> {
        try {
            const bean = await R.load("deployments", id);
            
            if (!bean) {
                return null;
            }
            
            return Deployment.fromBean(bean);
        } catch (error) {
            log.error("deployment", `Error finding deployment: ${error}`);
            return null;
        }
    }
    
    /**
     * Find deployments by stack ID
     * @param stackId Stack ID
     * @param limit Maximum number of deployments to return
     * @returns Array of Deployment instances
     */
    static async findByStackId(stackId: string, limit: number = 10): Promise<Deployment[]> {
        try {
            const beans = await R.findAll("deployments", " stack_id = ? ORDER BY id DESC LIMIT ? ", [
                stackId,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => Deployment.fromBean(bean));
        } catch (error) {
            log.error("deployment", `Error finding deployments: ${error}`);
            return [];
        }
    }

    /**
     * Find deployments by repository ID
     * @param repositoryId Repository ID
     * @param limit Maximum number of deployments to return
     * @returns Array of Deployment instances
     */
    static async findByRepositoryId(repositoryId: number, limit: number = 10): Promise<Deployment[]> {
        try {
            const beans = await R.findAll("deployments", " repository_id = ? ORDER BY id DESC LIMIT ? ", [
                repositoryId,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => Deployment.fromBean(bean));
        } catch (error) {
            log.error("deployment", `Error finding deployments: ${error}`);
            return [];
        }
    }
    
    /**
     * Find deployments by status
     * @param status Status to filter by
     * @param limit Maximum number of deployments to return
     * @returns Array of Deployment instances
     */
    static async findByStatus(status: string, limit: number = 10): Promise<Deployment[]> {
        try {
            const beans = await R.findAll("deployments", " status = ? ORDER BY id DESC LIMIT ? ", [
                status,
                limit
            ]);
            
            if (!beans || beans.length === 0) {
                return [];
            }
            
            return beans.map(bean => Deployment.fromBean(bean));
        } catch (error) {
            log.error("deployment", `Error finding deployments: ${error}`);
            return [];
        }
    }

    /**
     * Create a Deployment instance from database bean
     * @param bean Database bean
     * @returns Deployment instance
     */
    static fromBean(bean: any): Deployment {
        const deployment = new Deployment();
        
        deployment.id = bean.id;
        deployment.stackId = bean.stack_id;
        deployment.buildConfigId = bean.build_config_id;
        deployment.repositoryId = bean.repository_id;
        deployment.commitSha = bean.commit_sha;
        deployment.commitMessage = bean.commit_message;
        deployment.commitAuthor = bean.commit_author;
        deployment.branch = bean.branch;
        deployment.tag = bean.tag;
        deployment.status = bean.status;
        deployment.startedAt = bean.started_at;
        deployment.completedAt = bean.completed_at;
        deployment.duration = bean.duration;
        deployment.buildLogs = bean.build_logs;
        deployment.deploymentLogs = bean.deployment_logs;
        deployment.error = bean.error;
        deployment.triggeredBy = bean.triggered_by;
        deployment.triggeredByUser = bean.triggered_by_user;
        deployment.previousDeploymentId = bean.previous_deployment_id;
        deployment.createdAt = bean.created_at;
        deployment.updatedAt = bean.updated_at;
        
        return deployment;
    }
}

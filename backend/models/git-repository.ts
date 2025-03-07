import { log } from "../log";
import { R } from "redbean-node";
import { encryptText, decryptText } from "../utils/crypto";
import { generateRandomString } from "../utils/common";

export enum GitAuthType {
    NONE = 'none',
    SSH_KEY = 'ssh_key',
    HTTP_TOKEN = 'http_token'
}

export enum GitProvider {
    GITHUB = 'github',
    GITLAB = 'gitlab',
    BITBUCKET = 'bitbucket',
    GENERIC = 'generic'
}

export interface GitCredentials {
    username?: string;              // Username for HTTP authentication
    token?: string;                 // Token for HTTP authentication
    privateKey?: string;            // Private key for SSH authentication
    passphrase?: string;            // Passphrase for SSH private key
}

export interface GitCommit {
    sha: string;                    // Commit hash
    message: string;                // Commit message
    author: string;                 // Author name
    date: Date;                     // Date of commit
    branch?: string;                // Branch name
    tag?: string;                   // Tag name (if applicable)
}

/**
 * GitRepository model class
 */
export class GitRepository {
    id: number = 0;
    stackId: string = "";
    url: string = "";
    branch: string = "main";
    authType: GitAuthType = GitAuthType.NONE;
    // Credentials are encrypted and stored as JSON
    credentials?: GitCredentials;
    webhookSecret?: string;
    webhookUrl?: string;
    provider: GitProvider = GitProvider.GENERIC;
    autoSync: boolean = false;
    lastSyncedAt?: Date;
    lastSyncedCommit?: string;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    /**
     * Convert from RedBean bean to GitRepository
     * @param bean RedBean bean object
     * @returns GitRepository instance
     */
    static fromBean(bean: any): GitRepository {
        const repo = new GitRepository();
        
        repo.id = bean.id;
        repo.stackId = bean.stack_id;
        repo.url = bean.url;
        repo.branch = bean.branch;
        repo.authType = bean.auth_type as GitAuthType;
        repo.provider = bean.provider as GitProvider;
        repo.autoSync = !!bean.auto_sync;
        repo.webhookSecret = bean.webhook_secret || undefined;
        repo.webhookUrl = bean.webhook_url || undefined;
        repo.lastSyncedAt = bean.last_synced_at ? new Date(bean.last_synced_at) : undefined;
        repo.lastSyncedCommit = bean.last_synced_commit || undefined;
        repo.createdAt = new Date(bean.created_at);
        repo.updatedAt = new Date(bean.updated_at);
        
        // Decrypt credentials if they exist
        if (bean.credentials_json) {
            try {
                const decrypted = decryptText(bean.credentials_json);
                repo.credentials = JSON.parse(decrypted);
            } catch (error) {
                log.error("git-repository", "Failed to decrypt repository credentials: " + error);
            }
        }
        
        return repo;
    }

    /**
     * Save the repository to the database
     * @returns Promise resolving to the saved GitRepository
     */
    async save(): Promise<GitRepository> {
        const bean = this.id ? await R.load("git_repositories", this.id) : R.dispense("git_repositories");
        
        bean.stack_id = this.stackId;
        bean.url = this.url;
        bean.branch = this.branch;
        bean.auth_type = this.authType;
        bean.provider = this.provider;
        bean.auto_sync = this.autoSync ? 1 : 0;
        bean.webhook_secret = this.webhookSecret;
        bean.webhook_url = this.webhookUrl;
        bean.last_synced_at = this.lastSyncedAt ? this.lastSyncedAt.toISOString() : null;
        bean.last_synced_commit = this.lastSyncedCommit;
        bean.updated_at = new Date().toISOString();
        
        // If this is a new record, set created_at
        if (!this.id) {
            bean.created_at = new Date().toISOString();
        }
        
        // Encrypt credentials if they exist
        if (this.credentials) {
            try {
                const credentialsString = JSON.stringify(this.credentials);
                bean.credentials_json = encryptText(credentialsString);
            } catch (error) {
                log.error("git-repository", "Failed to encrypt repository credentials: " + error);
                throw error;
            }
        } else {
            bean.credentials_json = null;
        }
        
        const id = await R.store(bean);
        this.id = id;
        
        return this;
    }

    /**
     * Generate a new webhook secret
     */
    generateWebhookSecret(): void {
        this.webhookSecret = generateRandomString(32);
    }

    /**
     * Find a repository by stack ID
     * @param stackId Stack ID to search for
     * @returns Promise resolving to the found GitRepository or null
     */
    static async findByStackId(stackId: string): Promise<GitRepository | null> {
        const bean = await R.findOne("git_repositories", " stack_id = ? ", [stackId]);
        return bean ? GitRepository.fromBean(bean) : null;
    }

    /**
     * Find a repository by ID
     * @param id Repository ID to search for
     * @returns Promise resolving to the found GitRepository or null
     */
    static async findById(id: number): Promise<GitRepository | null> {
        const bean = await R.load("git_repositories", id);
        return bean.id ? GitRepository.fromBean(bean) : null;
    }

    /**
     * Delete the repository
     * @returns Promise resolving when the repository is deleted
     */
    async delete(): Promise<void> {
        if (this.id) {
            await R.exec("DELETE FROM git_repositories WHERE id = ?", [this.id]);
        }
    }
}

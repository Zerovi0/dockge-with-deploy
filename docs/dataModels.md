# Data Models for CI/CD Integration

This document outlines the data models required for implementing CI/CD functionality in Dockge. These models will be used to store configuration, state, and history for the CI/CD pipeline.

## 1. Git Repository Configuration

The `GitRepository` model stores information about a Git repository associated with a stack.

```typescript
interface GitRepository {
  id: string;                     // Unique identifier for the repository
  stackId: string;                // ID of the associated stack
  url: string;                    // Git repository URL
  branch: string;                 // Default branch to use
  authType: GitAuthType;          // Authentication type (NONE, SSH_KEY, HTTP_TOKEN)
  credentials?: GitCredentials;   // Authentication credentials (encrypted)
  webhookSecret?: string;         // Secret for validating webhook payloads
  webhookUrl?: string;            // Generated webhook URL for this repository
  provider: GitProvider;          // Git provider (GITHUB, GITLAB, BITBUCKET, GENERIC)
  autoSync: boolean;              // Whether to automatically sync with the repository
  lastSyncedAt?: Date;            // Last time the repository was synced
  lastSyncedCommit?: string;      // Last commit that was synced
  createdAt: Date;                // When the repository was added
  updatedAt: Date;                // When the repository was last updated
}

enum GitAuthType {
  NONE = 'none',
  SSH_KEY = 'ssh_key',
  HTTP_TOKEN = 'http_token'
}

interface GitCredentials {
  username?: string;              // Username for HTTP authentication
  token?: string;                 // Token for HTTP authentication
  privateKey?: string;            // Private key for SSH authentication
  passphrase?: string;            // Passphrase for SSH private key
}

enum GitProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
  GENERIC = 'generic'
}
```

## 2. Build Configuration

The `BuildConfig` model defines how to build a stack from a Git repository.

```typescript
interface BuildConfig {
  id: string;                     // Unique identifier for the build configuration
  stackId: string;                // ID of the associated stack
  repositoryId: string;           // ID of the associated Git repository
  buildType: BuildType;           // Type of build process
  dockerfilePath?: string;        // Path to Dockerfile (relative to repository root)
  composePath?: string;           // Path to docker-compose.yml (relative to repository root)
  buildArgs?: BuildArg[];         // Build arguments for Docker builds
  preBuildCommands?: string[];    // Commands to run before the build
  postBuildCommands?: string[];   // Commands to run after the build
  environmentVariables?: EnvVar[]; // Environment variables for the build
  timeout: number;                // Build timeout in seconds
  autoDeployOnPush: boolean;      // Whether to automatically deploy on push
  autoDeployBranches?: string[];  // Branches to automatically deploy (regex patterns)
  healthCheckPath?: string;       // Path to health check endpoint
  healthCheckTimeout?: number;    // Timeout for health check in seconds
  rollbackOnFailure: boolean;     // Whether to rollback on deployment failure
  createdAt: Date;                // When the configuration was created
  updatedAt: Date;                // When the configuration was last updated
}

enum BuildType {
  DOCKER_BUILD = 'docker_build',  // Build a Docker image from a Dockerfile
  COMPOSE_ONLY = 'compose_only',  // Use existing images in docker-compose.yml
  SCRIPT = 'script'               // Run a custom build script
}

interface BuildArg {
  name: string;                   // Name of the build argument
  value: string;                  // Value of the build argument
}

interface EnvVar {
  name: string;                   // Name of the environment variable
  value: string;                  // Value of the environment variable
  secret: boolean;                // Whether this is a secret variable
}
```

## 3. Deployment

The `Deployment` model represents a single deployment of a stack.

```typescript
interface Deployment {
  id: string;                     // Unique identifier for the deployment
  stackId: string;                // ID of the associated stack
  buildConfigId: string;          // ID of the build configuration used
  repositoryId: string;           // ID of the Git repository
  commitSha: string;              // Git commit SHA that was deployed
  commitMessage?: string;         // Git commit message
  commitAuthor?: string;          // Git commit author
  branch: string;                 // Git branch that was deployed
  tag?: string;                   // Git tag that was deployed (if any)
  status: DeploymentStatus;       // Current status of the deployment
  startedAt: Date;                // When the deployment started
  completedAt?: Date;             // When the deployment completed
  duration?: number;              // Duration of the deployment in seconds
  buildLogs?: string;             // Logs from the build process
  deploymentLogs?: string;        // Logs from the deployment process
  error?: string;                 // Error message if deployment failed
  triggeredBy: TriggerType;       // What triggered the deployment
  triggeredByUser?: string;       // User who triggered the deployment (if manual)
  previousDeploymentId?: string;  // ID of the previous deployment (for rollbacks)
}

enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled'
}

enum TriggerType {
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  API = 'api'
}
```

## 4. Webhook Event

The `WebhookEvent` model stores information about received webhook events.

```typescript
interface WebhookEvent {
  id: string;                     // Unique identifier for the webhook event
  repositoryId: string;           // ID of the associated Git repository
  provider: GitProvider;          // Git provider that sent the webhook
  eventType: string;              // Type of event (push, pull_request, etc.)
  payload: object;                // Raw webhook payload
  headers: object;                // HTTP headers of the webhook request
  signature?: string;             // Signature from the webhook provider
  verified: boolean;              // Whether the webhook was verified
  processed: boolean;             // Whether the webhook was processed
  deploymentId?: string;          // ID of the deployment triggered by this webhook
  receivedAt: Date;               // When the webhook was received
  processedAt?: Date;             // When the webhook was processed
  error?: string;                 // Error message if processing failed
}
```

## 5. Stack Extensions

The existing `Stack` class will need to be extended with the following properties to support CI/CD:

```typescript
interface StackCICDExtension {
  gitRepository?: GitRepository;  // Associated Git repository
  buildConfig?: BuildConfig;      // Build configuration
  latestDeployment?: Deployment;  // Latest deployment
  deploymentHistory?: Deployment[]; // Deployment history
}
```

## Database Schema

These models will be stored in the SQLite database used by Dockge. The following tables will be created:

1. `git_repositories` - Stores Git repository configurations
2. `build_configs` - Stores build configurations
3. `deployments` - Stores deployment history
4. `webhook_events` - Stores webhook events
5. `build_args` - Stores build arguments (related to build_configs)
6. `env_vars` - Stores environment variables (related to build_configs)

## File Storage

In addition to the database, the following files will be stored on disk:

1. **SSH Keys**: Private SSH keys will be stored in a secure directory with appropriate permissions
2. **Build Artifacts**: Temporary build artifacts will be stored in a dedicated directory
3. **Deployment Logs**: Detailed logs for each deployment will be stored in log files

## Relationships

- A Stack can have zero or one GitRepository
- A Stack can have zero or one BuildConfig
- A GitRepository can have many WebhookEvents
- A Stack can have many Deployments
- A Deployment is associated with one BuildConfig and one GitRepository

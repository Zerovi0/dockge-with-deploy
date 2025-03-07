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
class BuildConfig {
  id: number = 0;                          // Unique identifier for the build configuration
  stackId: string = "";                    // ID of the associated stack
  repositoryId: number = 0;                // ID of the associated Git repository
  buildType: string = "compose_only";      // Type of build process ('docker_build', 'compose_only', 'script')
  dockerfilePath: string = "Dockerfile";   // Path to Dockerfile (relative to repository root)
  composePath: string = "docker-compose.yml"; // Path to docker-compose.yml (relative to repository root)
  timeout: number = 3600;                  // Build timeout in seconds
  autoDeployOnPush: boolean = false;       // Whether to automatically deploy on push
  autoDeployBranches: string = "[]";       // JSON array of branch patterns to automatically deploy
  healthCheckPath: string | null = null;   // Path to health check endpoint
  healthCheckTimeout: number | null = null; // Timeout for health check in seconds
  rollbackOnFailure: boolean = true;       // Whether to rollback on deployment failure
  preBuildCommands: string | null = null;  // JSON array of commands to run before the build
  postBuildCommands: string | null = null; // JSON array of commands to run after the build
  createdAt: Date = new Date();            // When the configuration was created
  updatedAt: Date = new Date();            // When the configuration was last updated
}

// Note: BuildArgs and EnvVars are stored in separate tables with relations to BuildConfig
interface BuildArg {
  id: number;                     // Unique identifier
  buildConfigId: number;          // ID of the associated build configuration
  name: string;                   // Name of the build argument
  value: string;                  // Value of the build argument
  createdAt: Date;                // When created
  updatedAt: Date;                // When updated
}

interface EnvVar {
  id: number;                     // Unique identifier
  buildConfigId: number;          // ID of the associated build configuration
  name: string;                   // Name of the environment variable
  value: string;                  // Value of the environment variable
  secret: boolean;                // Whether this is a secret variable
  createdAt: Date;                // When created
  updatedAt: Date;                // When updated
}
```

## 3. Deployment

The `Deployment` model represents a single deployment of a stack.

```typescript
class Deployment {
  id: number = 0;                          // Unique identifier for the deployment
  stackId: string = "";                    // ID of the associated stack
  buildConfigId: number = 0;               // ID of the build configuration used
  repositoryId: number = 0;                // ID of the Git repository
  commitSha: string = "";                  // Git commit SHA that was deployed
  commitMessage: string | null = null;     // Git commit message
  commitAuthor: string | null = null;      // Git commit author
  branch: string = "";                     // Git branch that was deployed
  tag: string | null = null;               // Git tag that was deployed (if any)
  status: string = "pending";              // Current status of the deployment
                                           // ('pending', 'building', 'deploying', 'successful', 'failed', 'rolled_back', 'cancelled')
  startedAt: Date = new Date();            // When the deployment started
  completedAt: Date | null = null;         // When the deployment completed
  duration: number | null = null;          // Duration of the deployment in seconds
  buildLogs: string | null = null;         // Logs from the build process
  deploymentLogs: string | null = null;    // Logs from the deployment process
  error: string | null = null;             // Error message if deployment failed
  triggeredBy: string = "manual";          // What triggered the deployment ('webhook', 'manual', 'scheduled', 'api')
  triggeredByUser: string | null = null;   // User who triggered the deployment (if manual)
  previousDeploymentId: number | null = null; // ID of the previous deployment (for rollbacks)
  createdAt: Date = new Date();            // When the deployment record was created
  updatedAt: Date = new Date();            // When the deployment record was last updated
}
```

## 4. Webhook Event

The `WebhookEvent` model stores information about received webhook events.

```typescript
class WebhookEvent {
  id: number = 0;                          // Unique identifier for the webhook event
  repositoryId: number = 0;                // ID of the associated Git repository
  provider: string = "generic";            // Git provider that sent the webhook ('github', 'gitlab', 'bitbucket', 'generic')
  eventType: string = "";                  // Type of event (push, pull_request, etc.)
  payload: string = "";                    // JSON webhook payload
  headers: string = "";                    // JSON HTTP headers
  signature: string | null = null;         // Signature from the webhook provider
  verified: boolean = false;               // Whether the webhook was verified
  processed: boolean = false;              // Whether the webhook was processed
  deploymentId: number | null = null;      // ID of the deployment triggered by this webhook
  receivedAt: Date = new Date();           // When the webhook was received
  processedAt: Date | null = null;         // When the webhook was processed
  error: string | null = null;             // Error message if processing failed
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

These models will be stored in the SQLite database used by Dockge. The following tables have been created via migrations:

1. `git_repositories` - Stores Git repository configurations
2. `build_configs` - Stores build configurations
3. `deployments` - Stores deployment history
4. `webhook_events` - Stores webhook events
5. `build_args` - Stores build arguments (related to build_configs)
6. `env_vars` - Stores environment variables (related to build_configs)

All migration files are located in `/backend/migrations/` with timestamps and descriptive names.

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

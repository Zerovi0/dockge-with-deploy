# Backend Technical Specification for CI/CD Integration

This document outlines the technical specifications for the backend components required to implement CI/CD functionality in Dockge.

## 1. Architecture Overview

The CI/CD backend will consist of four primary modules:

1. **Git Handler**: Manages Git operations such as cloning, pulling, and checking out repositories
2. **Webhook Receiver**: Processes incoming webhook events from Git providers
3. **Build Engine**: Executes build workflows based on configuration
4. **Deployment Manager**: Handles deployment strategies and rollbacks

These modules will integrate with the existing Dockge architecture while maintaining separation of concerns.

## 2. Git Handler Module

### Purpose
The Git Handler module is responsible for all Git operations, including repository management, authentication, and file operations.

### File Structure
```
backend/
  git/
    git-handler.ts       # Main Git handler class
    git-providers/       # Provider-specific implementations
      github.ts          # GitHub specific operations
      gitlab.ts          # GitLab specific operations
      bitbucket.ts       # Bitbucket specific operations
      generic.ts         # Generic Git operations
    git-auth.ts          # Authentication utilities
    git-operations.ts    # Common Git operations
```

### Core Components

#### GitHandler Class
```typescript
class GitHandler {
  constructor(private server: DockgeServer) {}
  
  // Repository operations
  async cloneRepository(repo: GitRepository): Promise<boolean>;
  async pullRepository(repo: GitRepository): Promise<boolean>;
  async checkoutBranch(repo: GitRepository, branch: string): Promise<boolean>;
  async getCommitHistory(repo: GitRepository, limit: number): Promise<GitCommit[]>;
  async getCurrentCommit(repo: GitRepository): Promise<GitCommit>;
  
  // Authentication
  async setupAuthentication(repo: GitRepository): Promise<void>;
  async testConnection(repo: GitRepository): Promise<boolean>;
  
  // File operations
  async getFileContent(repo: GitRepository, filePath: string): Promise<string>;
  async listFiles(repo: GitRepository, directory: string): Promise<string[]>;
  
  // Provider-specific operations
  getProviderHandler(provider: GitProvider): GitProviderHandler;
}
```

#### GitProviderHandler Interface
```typescript
interface GitProviderHandler {
  generateWebhookUrl(repo: GitRepository): string;
  parseWebhookPayload(payload: any, headers: any): WebhookEvent;
  getDefaultBranch(repo: GitRepository): Promise<string>;
  getRepositoryDetails(url: string): Promise<Partial<GitRepository>>;
}
```

### Integration Points
- Extends the `Stack` class with Git repository information
- Adds new socket events for Git operations
- Creates a secure storage mechanism for credentials

## 3. Webhook Receiver Module

### Purpose
The Webhook Receiver module handles incoming webhook events from Git providers, validates them, and triggers appropriate actions.

### File Structure
```
backend/
  webhooks/
    webhook-handler.ts   # Main webhook handler
    webhook-router.ts    # Express router for webhook endpoints
    webhook-validator.ts # Validates webhook payloads
    webhook-processor.ts # Processes webhook events
```

### Core Components

#### WebhookRouter
```typescript
class WebhookRouter implements Router {
  constructor(private server: DockgeServer) {}
  
  create(app: Express, server: DockgeServer): Router {
    const router = express.Router();
    
    // Generic webhook endpoint
    router.post('/api/webhooks/:id', this.handleWebhook.bind(this));
    
    // Provider-specific endpoints
    router.post('/api/webhooks/github/:id', this.handleGitHubWebhook.bind(this));
    router.post('/api/webhooks/gitlab/:id', this.handleGitLabWebhook.bind(this));
    
    return router;
  }
  
  private async handleWebhook(req: Request, res: Response): Promise<void>;
  private async handleGitHubWebhook(req: Request, res: Response): Promise<void>;
  private async handleGitLabWebhook(req: Request, res: Response): Promise<void>;
}
```

#### WebhookHandler Class
```typescript
class WebhookHandler {
  constructor(private server: DockgeServer, private gitHandler: GitHandler) {}
  
  async processWebhook(event: WebhookEvent): Promise<void>;
  async validateWebhook(event: WebhookEvent): Promise<boolean>;
  async saveWebhookEvent(event: WebhookEvent): Promise<string>;
  async triggerBuild(event: WebhookEvent): Promise<string>;
}
```

### Integration Points
- Adds new Express routes for webhook endpoints
- Creates database tables for storing webhook events
- Integrates with the Build Engine to trigger builds

## 4. Build Engine Module

### Purpose
The Build Engine module executes build workflows based on configuration, including Docker builds, compose operations, and custom scripts.

### File Structure
```
backend/
  build/
    build-engine.ts      # Main build engine class
    build-executor.ts    # Executes build commands
    build-strategies/    # Build strategy implementations
      docker-build.ts    # Docker build strategy
      compose-only.ts    # Compose-only strategy
      script.ts          # Custom script strategy
    build-context.ts     # Build context and environment
```

### Core Components

#### BuildEngine Class
```typescript
class BuildEngine {
  constructor(private server: DockgeServer, private gitHandler: GitHandler) {}
  
  async startBuild(stack: Stack, config: BuildConfig, trigger: TriggerType, user?: string): Promise<Deployment>;
  async cancelBuild(deploymentId: string): Promise<boolean>;
  async getBuildStatus(deploymentId: string): Promise<DeploymentStatus>;
  async getBuildLogs(deploymentId: string): Promise<string>;
  
  private getStrategy(buildType: BuildType): BuildStrategy;
  private createDeployment(stack: Stack, config: BuildConfig, trigger: TriggerType, user?: string): Promise<Deployment>;
  private updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<void>;
}
```

#### BuildStrategy Interface
```typescript
interface BuildStrategy {
  execute(context: BuildContext): Promise<BuildResult>;
  validate(config: BuildConfig): Promise<boolean>;
  cleanup(context: BuildContext): Promise<void>;
}
```

#### BuildContext Interface
```typescript
interface BuildContext {
  deployment: Deployment;
  stack: Stack;
  config: BuildConfig;
  repository: GitRepository;
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  logger: (message: string) => void;
}
```

### Integration Points
- Creates a new Terminal type for build processes
- Adds socket events for build status updates
- Integrates with the Deployment Manager for deployment

## 5. Deployment Manager Module

### Purpose
The Deployment Manager module handles deployment strategies, health checks, and rollbacks.

### File Structure
```
backend/
  deployment/
    deployment-manager.ts        # Main deployment manager class
    deployment-strategies/       # Deployment strategy implementations
      standard-deploy.ts         # Standard deployment strategy
      blue-green-deploy.ts       # Blue-green deployment strategy
      canary-deploy.ts           # Canary deployment strategy
    health-checker.ts            # Health check implementation
    rollback-handler.ts          # Handles rollback operations
```

### Core Components

#### DeploymentManager Class
```typescript
class DeploymentManager {
  constructor(private server: DockgeServer) {}
  
  async deploy(deployment: Deployment): Promise<boolean>;
  async rollback(deploymentId: string): Promise<boolean>;
  async getDeploymentHistory(stackId: string, limit: number): Promise<Deployment[]>;
  async checkHealth(deployment: Deployment): Promise<boolean>;
  
  private getStrategy(deployment: Deployment): DeploymentStrategy;
  private updateDeploymentStatus(deploymentId: string, status: DeploymentStatus): Promise<void>;
}
```

#### DeploymentStrategy Interface
```typescript
interface DeploymentStrategy {
  deploy(deployment: Deployment, stack: Stack): Promise<boolean>;
  rollback(deployment: Deployment, stack: Stack): Promise<boolean>;
  validate(deployment: Deployment): Promise<boolean>;
}
```

### Integration Points
- Extends the Stack class with deployment methods
- Adds socket events for deployment status updates
- Integrates with the existing Docker Compose functionality

## 6. Database Extensions

### New Tables
- `git_repositories`: Stores Git repository configurations
- `build_configs`: Stores build configurations
- `deployments`: Stores deployment history
- `webhook_events`: Stores webhook events
- `build_args`: Stores build arguments
- `env_vars`: Stores environment variables

### Migrations
Database migrations will be implemented using the existing migration system in Dockge.

## 7. Socket Handler Extensions

### MainSocketHandler Extensions
The existing `MainSocketHandler` class will be extended with new socket events:

```typescript
// Git repository management
socket.on("getGitRepository", async (stackName, callback) => {
  // Get Git repository for stack
});

socket.on("saveGitRepository", async (stackName, repository, callback) => {
  // Save Git repository configuration
});

socket.on("testGitConnection", async (repository, callback) => {
  // Test Git connection
});

// Build configuration
socket.on("getBuildConfig", async (stackName, callback) => {
  // Get build configuration for stack
});

socket.on("saveBuildConfig", async (stackName, config, callback) => {
  // Save build configuration
});

// Deployments
socket.on("getDeploymentHistory", async (stackName, limit, callback) => {
  // Get deployment history for stack
});

socket.on("triggerBuild", async (stackName, callback) => {
  // Trigger a manual build
});

socket.on("cancelBuild", async (deploymentId, callback) => {
  // Cancel a running build
});

socket.on("rollbackDeployment", async (deploymentId, callback) => {
  // Rollback to a previous deployment
});
```

## 8. Security Considerations

### Authentication
- Git credentials will be encrypted in the database
- SSH keys will be stored with appropriate file permissions
- Webhook secrets will be used to validate webhook payloads

### Authorization
- Only authenticated users can manage Git repositories and trigger builds
- Role-based access control will be implemented for CI/CD operations

### Secrets Management
- Environment variables marked as secrets will be encrypted
- Credentials will not be exposed in logs or terminal output

## 9. Implementation Phases

### Phase 1: Core Git Integration
- Implement Git Handler module
- Extend Stack class with Git repository information
- Add basic socket events for Git operations

### Phase 2: Build Configuration
- Implement Build Engine module
- Add build configuration UI
- Implement Docker build strategy

### Phase 3: Webhook Integration
- Implement Webhook Receiver module
- Add webhook endpoints
- Implement automatic builds on push

### Phase 4: Deployment Management
- Implement Deployment Manager module
- Add deployment history UI
- Implement rollback functionality

## 10. Testing Strategy

### Unit Tests
- Test each module in isolation with mocked dependencies
- Test Git operations with a local Git repository
- Test webhook processing with sample payloads

### Integration Tests
- Test the complete build and deployment workflow
- Test webhook endpoints with simulated Git provider requests
- Test rollback functionality with multiple deployments

### End-to-End Tests
- Test the complete CI/CD pipeline from Git push to deployment
- Test the UI for managing Git repositories and build configurations
- Test error handling and recovery

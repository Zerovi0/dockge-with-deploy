# Dockge with CI/CD Integration - Codebase Summary

## Current Architecture Overview

Dockge is built as a full-stack application with a clear separation between frontend and backend components, using Socket.io for real-time communication. The application follows a modular design pattern with well-defined responsibilities for each component.

## Key Components and Their Interactions

### Frontend Components
- **App.vue** - The main application component that handles routing and global state
- **Compose.vue** - Core stack management interface for Docker Compose files with features for:
  - Editing compose files through Monaco Editor
  - Starting/stopping/restarting stacks
  - Viewing container logs
  - Managing container configurations
- **Components/** - Reusable UI components including:
  - Container.vue - For individual container management
  - Terminal.vue - For displaying terminal output
  - StackList.vue - For listing available stacks

### Backend Components
- **dockge-server.ts** - Main server entry point that initializes:
  - Express server
  - Socket.io server
  - Routers and socket handlers
  - Database connections
- **stack.ts** - Core class for stack management with methods for:
  - Creating/reading/updating/deleting stacks
  - Deploying stacks with Docker Compose
  - Managing stack state and configuration
  - Executing Docker commands
- **socket-handlers/** - Socket.io event handlers:
  - main-socket-handler.ts - Handles authentication and general operations
  - agent-proxy-socket-handler.ts - Proxies requests to agents
  - manage-agent-socket-handler.ts - Manages agent connections
- **routers/** - Express routes for HTTP endpoints
- **models/** - Data models for the application
- **terminal.ts** - Manages terminal sessions and command execution

## Current Data Flow
1. User interacts with the frontend to manage Docker Compose stacks
2. Commands and configurations are sent to the backend via Socket.io events
3. Backend processes these events through socket handlers
4. The Stack class executes Docker commands to manage containers
5. Terminal output and container status are streamed back to the frontend in real-time
6. Frontend updates its UI based on the received data

## Integration Points for CI/CD Functionality

### Frontend Integration Points
1. **Compose.vue** - Primary integration point for CI/CD UI:
   - Add new tabs or sections for Git repository configuration
   - Integrate build configuration options
   - Display deployment history and logs
   - Add CI/CD-specific action buttons (trigger build, rollback, etc.)

2. **New Components Needed**:
   - GitRepository.vue - For managing Git repository configurations
   - BuildConfig.vue - For configuring build settings
   - DeploymentHistory.vue - For displaying deployment history

### Backend Integration Points
1. **stack.ts** - Extend the Stack class to include:
   - Git repository information
   - Build configuration
   - Deployment history
   - Methods for Git operations and build processes

2. **New Modules Needed**:
   - git-handler.ts - For Git operations (clone, pull, checkout)
   - webhook-handler.ts - For receiving and processing Git webhooks
   - build-engine.ts - For executing build workflows
   - deployment-manager.ts - For managing deployment strategies

3. **socket-handlers/main-socket-handler.ts** - Add new socket events for:
   - Git repository management
   - Build configuration
   - Deployment history retrieval
   - Manual build/deployment triggers

4. **New Routes Needed**:
   - webhook.ts - Express routes for Git webhook endpoints

5. **Database Extensions**:
   - New models for storing Git configurations, build settings, and deployment history

## Data Storage Requirements
1. **Git Configuration**:
   - Repository URL
   - Branch/tag information
   - Authentication credentials
   - Provider-specific settings

2. **Build Configuration**:
   - Build type (Docker, script, etc.)
   - Pre/post build commands
   - Environment variables
   - Build arguments

3. **Deployment History**:
   - Commit information
   - Build logs
   - Deployment status
   - Rollback information

## Planned Data Flow Extensions
1. Git webhook events will be received by a new webhook endpoint
2. The webhook handler will validate the event and trigger the appropriate build process
3. The build engine will execute the build workflow based on configuration
4. The deployment manager will handle the deployment with the specified strategy
5. Build and deployment status will be sent to the frontend in real-time via Socket.io
6. Deployment history will be stored in the database and displayed to the user

## Recent Changes
- Set up project documentation structure
- Analyzed client requirements for CI/CD integration
- Identified integration points in the existing codebase
- Created initial project roadmap and technical stack documentation

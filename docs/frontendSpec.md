# Frontend Technical Specification for CI/CD Integration

This document outlines the technical specifications for the frontend components required to implement CI/CD functionality in Dockge.

## 1. UI Components Overview

The CI/CD frontend will consist of several new UI components that integrate with the existing Dockge interface:

1. **Git Repository Configuration**: Interface for configuring Git repositories
2. **Build Configuration**: Interface for configuring build settings
3. **Deployment History**: Interface for viewing deployment history and logs
4. **Deployment Controls**: Interface for triggering builds and deployments

These components will be integrated into the existing Stack management interface while maintaining Dockge's clean and intuitive design.

## 2. Component Integration Strategy

### Integration with Compose.vue

The primary integration point will be the `Compose.vue` component, which is the main interface for managing Docker Compose stacks. We will:

1. Add a new tab for CI/CD configuration
2. Extend the existing action buttons with CI/CD-specific actions
3. Add deployment status indicators to the stack information section

### Component Wireframes

#### Stack Page with CI/CD Tab
```
+--------------------------------------------------------------+
| Stack: my-app                                                |
+--------------------------------------------------------------+
| [ Compose ] [ Containers ] [ Logs ] [ CI/CD ] [ Settings ]   |
+--------------------------------------------------------------+
|                                                              |
|  Git Repository Configuration                                |
|  +--------------------------------------------------------+  |
|  | Repository URL: https://github.com/user/repo           |  |
|  | Branch: main                                           |  |
|  | Authentication: SSH Key ▼                              |  |
|  | [ Test Connection ] [ Generate Webhook URL ]           |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  Build Configuration                                         |
|  +--------------------------------------------------------+  |
|  | Build Type: Docker Build ▼                             |  |
|  | Dockerfile Path: ./Dockerfile                          |  |
|  | Auto Deploy: ✓                                         |  |
|  | Build Arguments:                                       |  |
|  | +--------------------+ +--------------------+          |  |
|  | | Name: NODE_ENV     | | Value: production  | [ + ]    |  |
|  | +--------------------+ +--------------------+          |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  [ Save Configuration ] [ Trigger Build ]                    |
|                                                              |
+--------------------------------------------------------------+
```

#### Deployment History Section
```
+--------------------------------------------------------------+
| Recent Deployments                                           |
+--------------------------------------------------------------+
| Status  | Commit      | Author        | Timestamp    | Actions|
|---------|-------------|---------------|--------------|--------|
| ✅      | 3a7c89b     | John Doe      | 10 min ago   | 🔄 📋  |
| ❌      | f8e92d1     | Jane Smith    | 2 hours ago  | 🔄 📋  |
| ✅      | 5b2e7d9     | John Doe      | 1 day ago    | 🔄 📋  |
+--------------------------------------------------------------+
|                      [ View All Deployments ]                |
+--------------------------------------------------------------+
```

## 3. Component Specifications

### GitRepository.vue
```typescript
/**
 * Component for managing Git repository configuration
 */
@Component({
  components: {
    AuthenticationForm,
    WebhookConfig,
  }
})
export default class GitRepository extends Vue {
  @Prop() stackName: string;
  
  repository: GitRepository = { /* default values */ };
  testingConnection: boolean = false;
  testConnectionResult: { success: boolean; message: string } | null = null;
  
  async mounted() {
    await this.loadRepository();
  }
  
  async loadRepository() {
    // Load repository configuration from the backend
  }
  
  async saveRepository() {
    // Save repository configuration to the backend
  }
  
  async testConnection() {
    // Test connection to the Git repository
  }
  
  async generateWebhookUrl() {
    // Generate webhook URL for the repository
  }
}
```

### BuildConfig.vue
```typescript
/**
 * Component for managing build configuration
 */
@Component({
  components: {
    BuildTypeSelector,
    EnvironmentVariables,
    BuildArguments,
  }
})
export default class BuildConfig extends Vue {
  @Prop() stackName: string;
  
  buildConfig: BuildConfig = { /* default values */ };
  
  async mounted() {
    await this.loadBuildConfig();
  }
  
  async loadBuildConfig() {
    // Load build configuration from the backend
  }
  
  async saveBuildConfig() {
    // Save build configuration to the backend
  }
  
  async triggerBuild() {
    // Trigger a manual build
  }
  
  onBuildTypeChange(type: BuildType) {
    // Update form based on selected build type
  }
}
```

### DeploymentHistory.vue
```typescript
/**
 * Component for viewing deployment history
 */
@Component({
  components: {
    DeploymentStatusBadge,
    TimeAgo,
  }
})
export default class DeploymentHistory extends Vue {
  @Prop() stackName: string;
  @Prop() limit: number = 5;
  
  deployments: Deployment[] = [];
  
  async mounted() {
    await this.loadDeployments();
  }
  
  async loadDeployments() {
    // Load deployment history from the backend
  }
  
  async viewDeploymentLogs(deploymentId: string) {
    // View logs for a specific deployment
  }
  
  async rollbackToDeployment(deploymentId: string) {
    // Rollback to a specific deployment
  }
}
```

### DeploymentDetails.vue
```typescript
/**
 * Component for viewing detailed deployment information
 */
@Component({
  components: {
    BuildLogs,
    CommitInfo,
    DeploymentStatusTimeline,
  }
})
export default class DeploymentDetails extends Vue {
  @Prop() deploymentId: string;
  
  deployment: Deployment | null = null;
  logs: string = '';
  
  async mounted() {
    await this.loadDeployment();
    await this.loadLogs();
  }
  
  async loadDeployment() {
    // Load deployment details from the backend
  }
  
  async loadLogs() {
    // Load deployment logs from the backend
  }
  
  async cancelDeployment() {
    // Cancel a running deployment
  }
  
  async rollbackDeployment() {
    // Rollback this deployment
  }
}
```

## 4. CICD.vue Tab Component

The main tab component for CI/CD functionality will integrate all the above components:

```typescript
/**
 * Main tab component for CI/CD functionality
 */
@Component({
  components: {
    GitRepository,
    BuildConfig,
    DeploymentHistory,
  }
})
export default class CICD extends Vue {
  @Prop() stackName: string;
  
  selectedSection: 'repository' | 'build' | 'deployments' = 'repository';
  
  async mounted() {
    // Initialize components
  }
  
  selectSection(section: 'repository' | 'build' | 'deployments') {
    this.selectedSection = section;
  }
}
```

## 5. Modifications to Existing Components

### Compose.vue Modifications

```typescript
// Add to components list
components: {
  // ... existing components
  CICD,
}

// Add to data properties
data() {
  return {
    // ... existing data
    tabs: [
      { id: 'compose', name: this.$t('compose') },
      { id: 'containers', name: this.$t('containers') },
      { id: 'logs', name: this.$t('logs') },
      { id: 'cicd', name: 'CI/CD' },  // New tab
      { id: 'settings', name: this.$t('settings') },
    ],
  };
}

// Add to template
<div v-if="currentTab === 'cicd'">
  <CICD :stackName="stack.name" />
</div>
```

### StackList.vue Modifications

Add deployment status indicators to the stack list:

```typescript
// Add to template
<div class="stack-item">
  <!-- Existing stack information -->
  <div class="deployment-status" v-if="stack.latestDeployment">
    <DeploymentStatusBadge :status="stack.latestDeployment.status" />
    <span class="deployment-time">
      <TimeAgo :datetime="stack.latestDeployment.completedAt" />
    </span>
  </div>
</div>
```

## 6. New Shared Components

### DeploymentStatusBadge.vue
```typescript
/**
 * Component for displaying deployment status badges
 */
@Component
export default class DeploymentStatusBadge extends Vue {
  @Prop() status: DeploymentStatus;
  
  get statusClass() {
    switch (this.status) {
      case 'successful': return 'badge-success';
      case 'failed': return 'badge-danger';
      case 'building': return 'badge-info';
      case 'deploying': return 'badge-warning';
      case 'rolled_back': return 'badge-secondary';
      default: return 'badge-light';
    }
  }
  
  get statusText() {
    switch (this.status) {
      case 'successful': return 'Success';
      case 'failed': return 'Failed';
      case 'building': return 'Building';
      case 'deploying': return 'Deploying';
      case 'rolled_back': return 'Rolled Back';
      default: return 'Unknown';
    }
  }
}
```

### BuildLogs.vue
```typescript
/**
 * Component for displaying build logs with syntax highlighting
 */
@Component
export default class BuildLogs extends Vue {
  @Prop() logs: string;
  @Prop() autoScroll: boolean = true;
  
  mounted() {
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }
  
  updated() {
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }
  
  scrollToBottom() {
    // Scroll to bottom of logs
  }
}
```

## 7. Socket Event Handling

### Socket Event Listeners

The frontend will listen for the following socket events:

```typescript
// In main.js or a dedicated socket handler
socket.on('deploymentStatusUpdate', (deployment) => {
  // Update deployment status in UI
});

socket.on('buildLogUpdate', (deploymentId, logLine) => {
  // Append log line to build logs
});

socket.on('gitRepositoryUpdate', (stackName, repository) => {
  // Update Git repository information in UI
});
```

### Socket Event Emitters

The frontend will emit the following socket events:

```typescript
// Get Git repository configuration
socket.emit('getGitRepository', stackName, (repository) => {
  // Handle repository data
});

// Save Git repository configuration
socket.emit('saveGitRepository', stackName, repository, (result) => {
  // Handle save result
});

// Test Git connection
socket.emit('testGitConnection', repository, (result) => {
  // Handle test result
});

// Get build configuration
socket.emit('getBuildConfig', stackName, (config) => {
  // Handle config data
});

// Save build configuration
socket.emit('saveBuildConfig', stackName, config, (result) => {
  // Handle save result
});

// Trigger build
socket.emit('triggerBuild', stackName, (result) => {
  // Handle trigger result
});

// Get deployment history
socket.emit('getDeploymentHistory', stackName, limit, (deployments) => {
  // Handle deployments data
});

// Get deployment details
socket.emit('getDeploymentDetails', deploymentId, (deployment) => {
  // Handle deployment data
});

// Rollback deployment
socket.emit('rollbackDeployment', deploymentId, (result) => {
  // Handle rollback result
});
```

## 8. Styling and Theme Integration

### Style Guidelines

The new components will follow Dockge's existing styling conventions:

- Use Tailwind CSS classes for layout and styling
- Maintain consistent spacing and sizing
- Use the existing color palette for consistency
- Follow existing button and form styles

### Example Styling (Tailwind CSS)

```html
<div class="cicd-container">
  <div class="bg-white shadow-md rounded-lg p-4 mb-4">
    <h2 class="text-lg font-semibold mb-3">Git Repository</h2>
    <!-- Repository form -->
  </div>
  
  <div class="bg-white shadow-md rounded-lg p-4 mb-4">
    <h2 class="text-lg font-semibold mb-3">Build Configuration</h2>
    <!-- Build configuration form -->
  </div>
  
  <div class="bg-white shadow-md rounded-lg p-4">
    <h2 class="text-lg font-semibold mb-3">Recent Deployments</h2>
    <!-- Deployment list -->
  </div>
</div>
```

## 9. Responsive Design

The CI/CD components will be designed to work well on various screen sizes:

### Mobile Layout Considerations

- Stack forms vertically on small screens
- Use collapsible sections for long forms
- Simplify tables for deployment history
- Ensure touch targets are appropriately sized

### Responsive Breakpoints

Follow Tailwind CSS's responsive breakpoints:

- `sm`: 640px and above
- `md`: 768px and above
- `lg`: 1024px and above
- `xl`: 1280px and above

## 10. Internationalization

All new UI text will be added to the existing translation system:

```typescript
// Example i18n keys
const translations = {
  en: {
    cicd: 'CI/CD',
    gitRepository: 'Git Repository',
    buildConfiguration: 'Build Configuration',
    deployments: 'Deployments',
    triggerBuild: 'Trigger Build',
    rollback: 'Rollback',
    buildLogs: 'Build Logs',
    // ... other keys
  },
  // ... other languages
};
```

## 11. Accessibility Considerations

The new components will follow accessibility best practices:

- Use semantic HTML elements
- Ensure proper contrast for text
- Provide ARIA attributes where necessary
- Support keyboard navigation
- Include alt text for icons and images

## 12. Implementation Phases

### Phase 1: Basic Git Integration UI
- Implement GitRepository.vue component
- Add CI/CD tab to Compose.vue
- Implement basic repository configuration form

### Phase 2: Build Configuration UI
- Implement BuildConfig.vue component
- Add build configuration form
- Implement build triggering UI

### Phase 3: Deployment History UI
- Implement DeploymentHistory.vue component
- Add deployment list and details views
- Implement deployment status indicators

### Phase 4: Advanced Features
- Implement rollback functionality
- Add detailed build and deployment logs
- Implement real-time status updates via sockets

## 13. Testing Strategy

### Unit Tests
- Test each component in isolation
- Test form validation
- Test socket event handling

### Integration Tests
- Test component interactions
- Test data flow between components
- Test integration with backend APIs

### End-to-End Tests
- Test complete user flows
- Test responsive design
- Test accessibility compliance

## 14. Performance Considerations

- Lazy load components when not immediately needed
- Paginate deployment history for large lists
- Stream build logs rather than loading all at once
- Optimize socket event handling for real-time updates

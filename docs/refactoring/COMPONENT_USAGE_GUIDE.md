# Component Usage Guide

**Date:** November 9, 2025  
**Status:** Active Reference

This guide provides examples and best practices for using the newly extracted components in CompareIntel.

---

## 📦 Importing Components

All components can be imported from the main components index:

```typescript
import {
  // Shared
  Button,
  Input,
  Textarea,
  LoadingSpinner,
  FullPageLoadingSpinner,
  
  // Layout
  Header,
  MainLayout,
  
  // Comparison
  StreamingIndicator,
  ResultCard,
  ResultsDisplay,
  TierSelector,
  
  // Conversation
  MessageBubble,
  ConversationItem,
  ConversationList,
} from './components';
```

Or import from specific modules:

```typescript
import { Button } from './components/shared';
import { Header } from './components/layout';
import { ResultCard } from './components/comparison';
import { MessageBubble } from './components/conversation';
```

---

## 🎨 Shared Components

### Button

```typescript
import { Button } from './components';

// Primary button
<Button variant="primary" onClick={handleSubmit}>
  Submit
</Button>

// Loading state
<Button variant="primary" isLoading disabled>
  Processing...
</Button>

// With icons
<Button 
  variant="secondary" 
  icon={<SearchIcon />}
  onClick={handleSearch}
>
  Search
</Button>

// Danger button
<Button variant="danger" onClick={handleDelete}>
  Delete
</Button>
```

### Input

```typescript
import { Input, Textarea } from './components';

// Basic input
<Input
  label="Email"
  type="email"
  placeholder="Enter your email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// With error
<Input
  label="Password"
  type="password"
  error={errors.password}
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

// With helper text
<Input
  label="Username"
  helperText="Choose a unique username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
/>

// Textarea
<Textarea
  label="Description"
  rows={4}
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>
```

### LoadingSpinner

```typescript
import { LoadingSpinner, FullPageLoadingSpinner } from './components';

// Basic spinner
<LoadingSpinner size="medium" />

// With message
<LoadingSpinner 
  size="large" 
  message="Loading data..." 
/>

// Full page loading
<FullPageLoadingSpinner message="Initializing..." />
```

---

## 🏗️ Layout Components

### Header

```typescript
import { Header } from './components';

<Header
  isAuthenticated={isAuthenticated}
  user={user}
  currentView={currentView}
  onAdminToggle={() => setCurrentView('admin')}
  onSignInClick={() => setAuthModalOpen(true)}
  onSignUpClick={() => setAuthModalOpen(true)}
/>
```

### MainLayout

```typescript
import { MainLayout } from './components';

<MainLayout>
  <HeroSection />
  <ResultsSection />
</MainLayout>
```

---

## 🔄 Comparison Components

### StreamingIndicator

```typescript
import { StreamingIndicator } from './components';

<StreamingIndicator
  modelCount={selectedModels.length}
  isLoading={isLoading}
  onCancel={handleCancel}
/>
```

### TierSelector

```typescript
import { TierSelector } from './components';

<TierSelector
  isExtendedMode={isExtendedMode}
  onToggle={setIsExtendedMode}
  recommended={inputLength > 3000}
  title="Switch to Extended mode for longer prompts"
/>
```

### ResultCard

```typescript
import { ResultCard } from './components';

<ResultCard
  modelId="gpt-4"
  model={{ id: 'gpt-4', name: 'GPT-4', description: 'OpenAI GPT-4' }}
  messages={conversation.messages}
  activeTab={activeResultTabs['gpt-4'] || RESULT_TAB.FORMATTED}
  isError={false}
  onScreenshot={handleScreenshot}
  onCopyResponse={handleCopyResponse}
  onClose={handleCloseCard}
  onSwitchTab={handleSwitchTab}
/>
```

### ResultsDisplay

```typescript
import { ResultsDisplay } from './components';

<ResultsDisplay
  conversations={conversations}
  selectedModels={selectedModels}
  closedCards={closedCards}
  allModels={allModels}
  activeResultTabs={activeResultTabs}
  processingTime={processingTime}
  metadata={response?.metadata}
  onScreenshot={handleScreenshot}
  onCopyResponse={handleCopyResponse}
  onCloseCard={handleCloseCard}
  onSwitchTab={handleSwitchTab}
/>
```

---

## 💬 Conversation Components

### MessageBubble

```typescript
import { MessageBubble } from './components';
import { RESULT_TAB } from './types';

<MessageBubble
  id={message.id}
  type={message.type}
  content={message.content}
  timestamp={message.timestamp}
  activeTab={RESULT_TAB.FORMATTED}
/>
```

### ConversationItem

```typescript
import { ConversationItem } from './components';

<ConversationItem
  conversation={conversationSummary}
  isActive={currentConversationId === conversationSummary.id}
  onClick={handleLoadConversation}
/>
```

### ConversationList

```typescript
import { ConversationList } from './components';

<ConversationList
  conversations={conversationHistory}
  activeConversationId={currentConversationId}
  onConversationClick={handleLoadConversation}
  maxHeight="400px"
  hideScrollbar={false}
/>
```

---

## 🎯 Best Practices

### 1. Component Composition

Prefer composition over large components:

```typescript
// ✅ Good - Composable
<ResultsDisplay
  conversations={conversations}
  selectedModels={selectedModels}
  // ... other props
/>

// ❌ Avoid - Monolithic JSX in App.tsx
<div className="results-section">
  {/* 100+ lines of inline JSX */}
</div>
```

### 2. Props Destructuring

Keep component interfaces clean:

```typescript
// ✅ Good - Clear prop interface
interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

// ❌ Avoid - Any types
interface MyComponentProps {
  data: any;
}
```

### 3. Callback Props

Use optional callbacks with proper types:

```typescript
interface ComponentProps {
  onAction?: (id: string) => void;
}

// Usage
<Component onAction={handleAction} />
```

### 4. Conditional Rendering

Components should handle their own visibility:

```typescript
// ✅ Good - Component handles its visibility
<StreamingIndicator 
  isLoading={isLoading} 
  // Component returns null if !isLoading
/>

// Also acceptable - Explicit conditional
{isLoading && (
  <StreamingIndicator 
    isLoading={true} 
  />
)}
```

### 5. TypeScript Types

Import and use provided types:

```typescript
import type { 
  ButtonProps, 
  ResultCardProps,
  MessageBubbleProps 
} from './components';

// Use for extending or composition
interface CustomButtonProps extends ButtonProps {
  customProp: string;
}
```

---

## 🔧 Migration Strategy

### Phase 1: Replace Simple Components

Start with components that have minimal state dependencies:

```typescript
// Before
<div className="loading-section">
  <div className="modern-spinner"></div>
  <p>Processing...</p>
</div>

// After
<StreamingIndicator
  modelCount={selectedModels.length}
  isLoading={isLoading}
  onCancel={handleCancel}
/>
```

### Phase 2: Extract Complex Sections

Break down larger sections incrementally:

```typescript
// Before - All in App.tsx
<section className="results-section">
  {/* 200+ lines */}
</section>

// After - Using ResultsDisplay
<ResultsDisplay
  conversations={conversations}
  // ... props
/>
```

### Phase 3: Refine and Optimize

Add React.memo, useMemo, useCallback as needed:

```typescript
export const ResultCard = React.memo<ResultCardProps>(({ ... }) => {
  // Component implementation
});
```

---

## 📝 Notes

- All components are fully typed with TypeScript
- Components include JSDoc documentation
- All components follow accessibility best practices
- Components are tested with production build
- No breaking changes to existing functionality

---

## 🆘 Troubleshooting

### TypeScript Errors

**Issue:** Type mismatch errors

**Solution:** Check imported types from `./types`:

```typescript
import type { ConversationMessage, ModelId } from './types';
```

### Import Errors

**Issue:** Cannot find module

**Solution:** Import from correct path:

```typescript
// ✅ Correct
import { Button } from './components';

// ❌ Incorrect
import { Button } from '../components';
```

### Styling Issues

**Issue:** Component not styled correctly

**Solution:** Ensure CSS classes match existing styles in:
- `styles/components.css`
- `styles/results.css`
- `styles/layout.css`

---

**Last Updated:** November 9, 2025  
**Maintainer:** Development Team


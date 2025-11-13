# Phase 4 Quick Start Guide

This guide provides step-by-step instructions for implementing Phase 4: Renderer Implementation.

## Overview

Phase 4 focuses on updating the LatexRenderer component to use model-specific configurations. Based on previous phases:
- **Phase 1:** Analyzed 52 models and identified formatting patterns
- **Phase 2:** Designed architecture with registry system and code block preservation
- **Phase 3:** Generated configurations for all 52 models
- **Phase 4:** Integrate configurations into the rendering pipeline

**Goal:** Update LatexRenderer to use model-specific configurations from the registry, ensuring code blocks are preserved and each model's formatting quirks are handled correctly.

## Prerequisites

1. **Phase 1 Complete**
   - Analysis data available: `backend/data/analysis/analysis_20251112_183053.json`

2. **Phase 2 Complete**
   - Configuration schema defined: `frontend/src/types/rendererConfig.ts`
   - Registry system created: `frontend/src/config/modelRendererRegistry.ts`
   - Code block preservation utilities: `frontend/src/utils/codeBlockPreservation.ts`

3. **Phase 3 Complete**
   - Configurations generated: `frontend/src/config/model_renderer_configs.json`
   - Configuration loader ready: `frontend/src/config/loadModelConfigs.ts`
   - Registry initialization working

4. **Frontend Environment**
   - Current `LatexRenderer` component at `frontend/src/components/LatexRenderer.tsx`
   - Understanding of existing rendering pipeline
   - Model IDs available in component tree (from `conversation.modelId`)

## Step 4.1: Update LatexRenderer Component

The AI assistant will modify the LatexRenderer component to use model-specific configurations.

### What Will Be Updated

1. **Component Props** (`frontend/src/components/LatexRenderer.tsx`)
   - Add `modelId?: string` prop to accept model identifier
   - Keep existing `children` and `className` props for backward compatibility
   - Make `modelId` optional to support fallback to default config

2. **Configuration Lookup**
   - Import `getModelConfig` from registry
   - Look up model-specific configuration using `modelId`
   - Fall back to default configuration if `modelId` is not provided or not found
   - Cache configuration lookup for performance

3. **Preprocessing Pipeline**
   - Replace hardcoded preprocessing with model-specific preprocessing options
   - Apply preprocessing functions based on configuration:
     - `fixEscapedDollars`: Fix escaped dollar signs (e.g., `\$` → `$`)
     - `removeHtmlFromMath`: Remove HTML tags from math expressions
     - `removeMathML`: Remove MathML artifacts
     - `removeSVG`: Remove SVG artifacts
   - Apply custom preprocessing functions if provided

4. **Math Delimiter Processing**
   - Replace hardcoded delimiter patterns with model-specific patterns
   - Use `displayMathDelimiters` from configuration
   - Use `inlineMathDelimiters` from configuration
   - Process delimiters in priority order (lower numbers first)
   - Maintain existing math rendering logic but use configured patterns

5. **Markdown Processing**
   - Replace hardcoded markdown rules with model-specific rules
   - Apply markdown processing based on configuration:
     - `processLinks`: Process markdown links
     - `fixBrokenLinks`: Fix broken markdown links
     - `processTables`: Process markdown tables
     - `processBlockquotes`: Process blockquotes
     - `processHorizontalRules`: Process horizontal rules
     - `processHeaders`: Process headers
     - `processBoldItalic`: Process bold/italic
     - `processLists`: Process lists
     - `processInlineCode`: Process inline code

6. **KaTeX Options**
   - Replace hardcoded KaTeX options with model-specific options
   - Use `katexOptions` from configuration:
     - `throwOnError`: Error handling mode
     - `strict`: Strict mode setting
     - `trust`: Trust function for certain commands
     - `macros`: Custom macros
     - `maxSize`, `maxExpand`: Size limits

7. **Post-Processing Pipeline**
   - Apply model-specific post-processing functions if provided
   - Maintain existing cleanup logic as fallback

8. **Code Block Preservation**
   - Integrate code block preservation utilities from Phase 2
   - Extract code blocks before any processing
   - Apply model-specific rendering to non-code content
   - Restore code blocks after all processing
   - Verify code blocks are preserved correctly

## Step 4.2: Update Component Integration Points

The AI assistant will update all places where LatexRenderer is used to pass the `modelId` prop.

### What Will Be Updated

1. **App.tsx** (`frontend/src/App.tsx`)
   - Locate LatexRenderer usage in conversation message rendering
   - Extract `modelId` from `conversation.modelId`
   - Pass `modelId` prop to LatexRenderer component
   - Ensure modelId is available in the rendering context

2. **MessageBubble Component** (if exists)
   - Update to accept and pass `modelId` prop
   - Ensure modelId flows through component hierarchy

3. **Other Components** (if any)
   - Search codebase for other LatexRenderer usages
   - Update to pass `modelId` prop where available
   - Handle cases where modelId might not be available (fallback to default)

4. **Registry Initialization**
   - Ensure registry is initialized before rendering
   - Call `initializeRegistry()` in `main.tsx` or `App.tsx` at app startup
   - Handle initialization errors gracefully

## Step 4.3: Integrate Code Block Preservation

The AI assistant will integrate the code block preservation system into the rendering pipeline.

### What Will Be Integrated

1. **Code Block Extraction**
   - Use `extractCodeBlocks()` from `codeBlockPreservation.ts`
   - Extract code blocks before preprocessing
   - Store code blocks with placeholders
   - Handle fenced code blocks (```language\ncontent\n```)
   - Handle indented code blocks (4+ spaces)

2. **Code Block Restoration**
   - Use `restoreCodeBlocks()` from `codeBlockPreservation.ts`
   - Restore code blocks after all processing
   - Verify code blocks match original content
   - Handle edge cases (nested blocks, blocks with math-like content)

3. **Preservation Verification**
   - Add verification step to ensure code blocks are preserved
   - Log warnings if code blocks are altered
   - Test extensively with various code block types

## Testing Strategy

The AI assistant will create tests to verify the implementation works correctly.

### What Will Be Created

1. **Renderer Component Tests** (`frontend/src/__tests__/components/LatexRenderer.test.ts`)
   - Test rendering with model-specific configurations
   - Test fallback to default configuration
   - Test code block preservation
   - Test preprocessing options
   - Test markdown processing rules
   - Test KaTeX options

2. **Integration Tests**
   - Test rendering with real model responses
   - Test configuration lookup and application
   - Test code block preservation across all models
   - Test edge cases and error handling

3. **Visual Regression Tests**
   - Compare rendered output before and after changes
   - Verify code blocks remain unchanged
   - Verify math rendering works correctly
   - Verify markdown rendering works correctly

## Implementation Checklist

The AI assistant will complete the following:

- [ ] Update `LatexRenderer` component to accept `modelId` prop
- [ ] Integrate configuration lookup from registry
- [ ] Replace hardcoded preprocessing with model-specific preprocessing
- [ ] Replace hardcoded math delimiters with model-specific delimiters
- [ ] Replace hardcoded markdown rules with model-specific rules
- [ ] Replace hardcoded KaTeX options with model-specific options
- [ ] Integrate code block preservation utilities
- [ ] Update `App.tsx` to pass `modelId` to LatexRenderer
- [ ] Update other components that use LatexRenderer
- [ ] Initialize registry at app startup
- [ ] Create renderer component tests
- [ ] Test with real model responses
- [ ] Verify code block preservation works correctly
- [ ] Verify backward compatibility (works without modelId)

## Configuration Usage Examples

### Example 1: Model with Escaped Dollar Signs

```typescript
// Configuration for model with escaped dollar signs
{
  modelId: "anthropic/claude-sonnet-4.5",
  preprocessing: {
    fixEscapedDollars: true,  // Fix \$ → $
    removeMathML: true,
    removeSVG: true
  },
  displayMathDelimiters: [
    { pattern: /\$\$([^\$]+?)\$\$/gs, name: 'double-dollar', priority: 1 }
  ],
  inlineMathDelimiters: [
    { pattern: /(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, name: 'single-dollar', priority: 1 }
  ]
}
```

### Example 2: Model with HTML in Math

```typescript
// Configuration for model with HTML in math
{
  modelId: "google/gemini-2.5-pro",
  preprocessing: {
    removeHtmlFromMath: true,  // Remove HTML tags from math
    removeMathML: true,
    removeSVG: true
  },
  displayMathDelimiters: [
    { pattern: /\$\$([^\$]+?)\$\$/gs, name: 'double-dollar', priority: 1 }
  ]
}
```

### Example 3: Model with Broken Links

```typescript
// Configuration for model with broken markdown links
{
  modelId: "some-model",
  markdownProcessing: {
    processLinks: true,
    fixBrokenLinks: true,  // Fix broken markdown links
    processBoldItalic: true
  }
}
```

## Code Block Preservation Flow

```
1. Input text with code blocks
   ↓
2. Extract code blocks → Store with placeholders
   ↓
3. Apply model-specific preprocessing
   ↓
4. Apply model-specific math rendering
   ↓
5. Apply model-specific markdown processing
   ↓
6. Apply model-specific post-processing
   ↓
7. Restore code blocks from placeholders
   ↓
8. Output: Rendered text with preserved code blocks
```

## Next Steps

After completing Phase 4:

1. **Review the Implementation:**
   - Verify LatexRenderer uses model-specific configurations
   - Verify code blocks are preserved correctly
   - Test with various model responses
   - Check that fallback to default works

2. **Prepare for Phase 5:**
   - Testing framework will verify rendering quality
   - Visual comparison tool will help identify issues
   - Regression tests will ensure no breaking changes

3. **Documentation:**
   - Document any changes to LatexRenderer API
   - Document code block preservation behavior
   - Create examples of model-specific rendering

## Reference Files

- **Configuration Schema:** `frontend/src/types/rendererConfig.ts`
- **Registry System:** `frontend/src/config/modelRendererRegistry.ts`
- **Configuration Loader:** `frontend/src/config/loadModelConfigs.ts`
- **Generated Configurations:** `frontend/src/config/model_renderer_configs.json`
- **Code Block Utilities:** `frontend/src/utils/codeBlockPreservation.ts`
- **Current Renderer:** `frontend/src/components/LatexRenderer.tsx`
- **App Integration:** `frontend/src/App.tsx`
- **Full Implementation Plan:** `docs/features/MODEL_SPECIFIC_RENDERING.md`

## Common Issues

### ModelId Not Available

**Problem:** `modelId` prop is not passed to LatexRenderer.

**Solution:**
- Ensure `conversation.modelId` is available in rendering context
- Pass `modelId` prop explicitly: `<LatexRenderer modelId={conversation.modelId}>`
- Component should fall back to default config if `modelId` is missing

### Configuration Not Found

**Problem:** Registry doesn't have configuration for a model.

**Solution:**
- Registry automatically falls back to default configuration
- Verify registry is initialized before rendering
- Check that configurations were loaded successfully

### Code Blocks Being Altered

**Problem:** Code blocks are being modified during rendering.

**Solution:**
- Verify code blocks are extracted before preprocessing
- Verify code blocks are restored after all processing
- Check that preprocessing doesn't affect code block placeholders
- Test with various code block types and languages

### Math Not Rendering

**Problem:** Math expressions are not rendering correctly.

**Solution:**
- Verify delimiter patterns match model's output format
- Check preprocessing isn't removing math delimiters
- Verify KaTeX options are correct
- Test with model-specific test cases

### Markdown Not Processing

**Problem:** Markdown elements are not being processed.

**Solution:**
- Verify markdown processing rules are enabled in configuration
- Check that markdown processing runs after code block extraction
- Verify markdown processing runs before code block restoration

### Performance Issues

**Problem:** Rendering is slow with model-specific configurations.

**Solution:**
- Cache configuration lookups (registry already uses Map)
- Optimize preprocessing pipeline
- Consider lazy loading configurations if needed
- Profile rendering performance

## Notes

- **Critical:** Code block preservation must never fail. Test extensively.
- **Backward Compatibility:** Component should work without `modelId` prop (uses default config)
- **Performance:** Configuration lookup is O(1) using Map, so performance should be good
- **Extensibility:** Easy to add new preprocessing/post-processing functions
- **Testing:** Test with real model responses from Phase 1 collection

## Migration Path

The implementation will maintain backward compatibility:

1. **Without modelId:** Uses default configuration (current behavior)
2. **With modelId:** Uses model-specific configuration
3. **Unknown modelId:** Falls back to default configuration

This ensures no breaking changes while enabling model-specific rendering.


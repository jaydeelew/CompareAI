# Phase 2 Quick Start Guide

This guide provides step-by-step instructions for implementing Phase 2: Renderer Architecture Design.

## Overview

Phase 2 focuses on designing the architecture for model-specific rendering. Based on Phase 1 analysis, we know:
- **52 models** were analyzed
- **49 models** have identified issues or complex patterns that require attention
- Common issues: escaped dollar signs (47 models), HTML in math (9 models), broken markdown links (7 models)
- Math delimiter patterns vary significantly between models
- Code blocks must be preserved exactly as received

**Note:** The "needs manual review" flag in Phase 1 analysis identifies models with issues, but the actual manual review happens **after implementation** when you examine the rendered results on the website. During implementation, the AI assistant will use best practices to create configurations for all models based on the analysis data.

## Prerequisites

1. **Phase 1 Complete**
   - Analysis data available: `backend/data/analysis/analysis_20251112_183053.json`
   - Analysis report reviewed: `backend/data/analysis/analysis_20251112_183053.md`

2. **Frontend Environment**
   - Current `LatexRenderer` component at `frontend/src/components/LatexRenderer.tsx`
   - Understanding of existing rendering pipeline

## Step 2.1: Define Renderer Configuration Schema

The AI assistant will create the configuration schema that defines how model-specific renderers are configured.

### What Will Be Created

1. **Type Definitions** (`frontend/src/types/rendererConfig.ts`)
   - Math delimiter pattern types (double-dollar, single-dollar, bracket, paren, align-env, equation-env)
   - Preprocessing and post-processing function types
   - ModelRendererConfig interface with:
     - Model identifier and version
     - Math delimiter patterns (display and inline)
     - Preprocessing pipeline options (HTML cleanup, escaped dollar fixes, MathML removal)
     - Markdown processing rules (links, tables, blockquotes, broken link fixes)
     - KaTeX rendering options (error handling, strict mode, size limits, custom macros)
     - Post-processing pipeline
     - Code block preservation settings (must always preserve exactly)

2. **Type Exports**
   - Export types from the types index file (if it exists)

## Step 2.2: Create Renderer Registry Structure

The AI assistant will create the registry system that maps model IDs to their specific renderer configurations.

### What Will Be Created

1. **Registry Module** (`frontend/src/config/modelRendererRegistry.ts`)
   - Default/fallback configuration matching current unified renderer behavior
   - Registry Map storing model configurations
   - Functions to:
     - Register model-specific renderer configurations
     - Get configuration for a model (with fallback to default)
     - Check if a model has a specific configuration
     - Get all registered model IDs
     - Validate configurations (check required fields, ensure code block preservation)

2. **Configuration Loader** (`frontend/src/config/loadModelConfigs.ts`)
   - Function to load model configurations from analysis data or static configs
   - Function to initialize the registry at app startup
   - Placeholder structure that will be populated in Phase 3 with generated configs

3. **Registry Initialization**
   - Integration point in main.tsx or App.tsx to initialize the registry before rendering

## Step 2.3: Design Code Block Preservation System

The AI assistant will create a robust system to extract, preserve, and restore code blocks during rendering.

### What Will Be Created

1. **Code Block Utilities** (`frontend/src/utils/codeBlockPreservation.ts`)
   - CodeBlock interface (id, language, content, position indices)
   - CodeBlockExtraction interface (text without blocks, blocks array, placeholders map)
   - Functions to:
     - Extract code blocks from text and replace with placeholders
       - Handle fenced code blocks (```language\ncontent\n```)
       - Handle indented code blocks (4+ spaces)
       - Handle nested code blocks
       - Handle code blocks containing math-like content
       - Handle code blocks containing dollar signs
     - Restore code blocks from placeholders after processing
     - Verify code blocks were preserved correctly (compare original vs restored)

2. **Unit Tests** (`frontend/src/__tests__/codeBlockPreservation.test.ts`)
   - Tests for extraction and restoration
   - Tests for edge cases (dollar signs in code, nested blocks, etc.)
   - Verification tests

## Testing the Architecture

The AI assistant will create comprehensive tests to verify the architecture works correctly.

### What Will Be Created

1. **Architecture Test Suite** (`frontend/src/__tests__/rendererArchitecture.test.ts`)
   - Configuration schema validation tests
     - Valid configurations pass validation
     - Invalid configurations are rejected with appropriate errors
   - Registry functionality tests
     - Register and retrieve configurations
     - Fallback to default for unknown models
   - Code block preservation tests
     - Extract and restore fenced code blocks
     - Preserve code blocks with dollar signs
     - Handle edge cases

## Implementation Checklist

The AI assistant will complete the following:

- [ ] Create `frontend/src/types/rendererConfig.ts` with configuration schema
- [ ] Create `frontend/src/config/modelRendererRegistry.ts` with registry system
- [ ] Create `frontend/src/config/loadModelConfigs.ts` for loading configs
- [ ] Create `frontend/src/utils/codeBlockPreservation.ts` with extraction/restoration logic
- [ ] Write unit tests for each module
- [ ] Initialize registry in app startup
- [ ] Verify code block preservation works correctly
- [ ] Document any design decisions or edge cases

## Next Steps

After completing Phase 2:

1. **Review the architecture:**
   - Ensure schema covers all use cases from Phase 1 analysis
   - Verify code block preservation is robust
   - Check that registry system is extensible

2. **Prepare for Phase 3:**
   - The configuration generator will use this architecture
   - Ensure schema matches analysis data structure
   - Plan for loading configurations from JSON files

3. **Documentation:**
   - Update architecture diagrams if needed
   - Document any design decisions
   - Create examples of how to add new configurations

## Reference Files

- **Phase 1 Analysis:** `backend/data/analysis/analysis_20251112_183053.json`
- **Current Renderer:** `frontend/src/components/LatexRenderer.tsx`
- **Full Implementation Plan:** `docs/features/MODEL_SPECIFIC_RENDERING.md`

## Common Issues

### TypeScript Errors
- Ensure all types are properly exported
- Check that imports match file structure
- Verify TypeScript configuration allows the new files

### Code Block Extraction Edge Cases
- Nested code blocks (code blocks containing markdown with code blocks)
- Code blocks with math-like content (e.g., LaTeX code blocks)
- Indented code blocks vs. fenced code blocks
- Code blocks at start/end of text

### Registry Initialization
- Ensure registry is initialized before any rendering occurs
- Handle cases where modelId might not be available
- Consider lazy loading configurations if there are many models

## Notes

- **Critical:** Code block preservation must never fail. Test extensively.
- **Extensibility:** Design the schema to handle future formatting types
- **Performance:** Registry lookups should be fast (Map is O(1))
- **Backward Compatibility:** Default config should match current renderer behavior


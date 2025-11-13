# Phase 3 Quick Start Guide

This guide provides step-by-step instructions for implementing Phase 3: Configuration Generation.

## Overview

Phase 3 focuses on generating model-specific renderer configurations from Phase 1 analysis data. Based on Phase 1 analysis, we know:
- **52 models** were analyzed
- **49 models** have identified issues or complex patterns that require attention
- Common issues: escaped dollar signs (47 models), HTML in math (9 models), broken markdown links (7 models)
- Math delimiter patterns vary significantly between models
- Code blocks must be preserved exactly as received

**Goal:** Generate initial renderer configurations for all 52 models using best practices, based on the analysis data. Manual refinement will happen post-deployment (Phase 7) when you review actual rendered results.

## Prerequisites

1. **Phase 1 Complete**
   - Analysis data available: `backend/data/analysis/analysis_20251112_183053.json`
   - Analysis report reviewed: `backend/data/analysis/analysis_20251112_183053.md`

2. **Phase 2 Complete**
   - Configuration schema defined: `frontend/src/types/rendererConfig.ts`
   - Registry system created: `frontend/src/config/modelRendererRegistry.ts`
   - Configuration loader ready: `frontend/src/config/loadModelConfigs.ts`
   - Code block preservation utilities: `frontend/src/utils/codeBlockPreservation.ts`

3. **Backend Environment**
   - Python 3.8+ with access to analysis data
   - Understanding of analysis data structure

## Step 3.1: Build Configuration Generator Script

The AI assistant will create a Python script that generates renderer configurations from analysis data.

### What Will Be Created

1. **Configuration Generator Script** (`backend/scripts/generate_renderer_configs.py`)
   - Reads analysis data from JSON file
   - Generates configurations for each model based on analysis
   - Applies best practices for:
     - Math delimiter patterns (from analysis data)
     - Preprocessing options (based on identified issues)
     - Markdown processing rules (from markdown_elements)
     - KaTeX options (standardized best practices)
     - Code block preservation (always enabled)
   - Outputs configurations in registry format (JSON)
   - Includes metadata (createdAt, needsManualReview flag)
   - Validates generated configurations

2. **Configuration Output Format**
   - JSON file: `backend/data/renderer_configs/model_renderer_configs.json`
   - Array of `ModelRendererConfig` objects
   - Ready to be loaded by frontend registry

## Step 3.2: Configuration Generation and Initial Testing

The AI assistant will generate configurations using best practices and test them.

### What Will Be Created

1. **Generated Configuration File** (`backend/data/renderer_configs/model_renderer_configs.json`)
   - Configurations for all 52 models
   - Based on Phase 1 analysis data
   - Follows registry schema from Phase 2
   - Includes all required fields
   - Validated against schema

2. **Configuration Generation Logic**
   - **Math Delimiters:** Use delimiter types from analysis data
     - Map delimiter type names to regex patterns
     - Set appropriate priorities
   - **Preprocessing:** Enable based on identified issues
     - `fixEscapedDollars`: true if "escaped_dollar_signs" in issues
     - `removeHtmlFromMath`: true if "html_in_math" in issues
     - `removeMathML`: always true (common artifact)
     - `removeSVG`: always true (common artifact)
   - **Markdown Processing:** Enable based on markdown_elements
     - Enable features that are present in analysis
     - `fixBrokenLinks`: true if "broken_markdown_links" in issues
   - **KaTeX Options:** Use standardized best practices
     - `throwOnError`: false (graceful degradation)
     - `strict`: false (permissive mode)
     - Standard macros and trust settings
   - **Code Block Preservation:** Always enabled (critical requirement)

3. **Configuration Metadata**
   - `createdAt`: Timestamp of generation
   - `needsManualReview`: Copy from analysis data
   - `version`: "1.0.0" (initial version)

## Step 3.3: Update Configuration Loader

The AI assistant will update the loader to load configurations from the generated JSON file.

### What Will Be Updated

1. **Configuration Loader** (`frontend/src/config/loadModelConfigs.ts`)
   - Update `initializeRegistry()` to load from static JSON file
   - Import generated configurations
   - Load configurations at app startup
   - Handle loading errors gracefully
   - Fall back to default config if loading fails

2. **Static Configuration Import**
   - Import JSON file: `frontend/src/config/model_renderer_configs.json`
   - Or load dynamically from backend/public directory
   - Validate configurations during load
   - Register all valid configurations

## Step 3.4: Configuration Validation and Testing

The AI assistant will create tests to validate generated configurations.

### What Will Be Created

1. **Configuration Generator Tests** (`backend/scripts/__tests__/test_generate_renderer_configs.py`)
   - Test configuration generation from analysis data
   - Test all models are processed
   - Test required fields are present
   - Test delimiter patterns are valid regex
   - Test code block preservation is always enabled

2. **Configuration Validation Tests** (`frontend/src/__tests__/rendererConfigs.test.ts`)
   - Test all configurations load successfully
   - Test configurations pass schema validation
   - Test registry can retrieve all configurations
   - Test fallback to default for unknown models

## Step 3.5: Documentation

The AI assistant will document the configuration generation process.

### What Will Be Created

1. **Configuration Generation Documentation**
   - Document how configurations are generated
   - Explain mapping from analysis data to config
   - Document best practices applied
   - Explain manual review flags

2. **Configuration Examples**
   - Example configurations for different model types
   - Show how issues map to preprocessing options
   - Show how delimiters map to patterns

## Implementation Checklist

The AI assistant will complete the following:

- [ ] Create `backend/scripts/generate_renderer_configs.py` script
- [ ] Generate configurations for all 52 models
- [ ] Create `backend/data/renderer_configs/model_renderer_configs.json`
- [ ] Update `frontend/src/config/loadModelConfigs.ts` to load static configs
- [ ] Create configuration generator tests
- [ ] Create configuration validation tests
- [ ] Test configurations load successfully in frontend
- [ ] Document configuration generation process
- [ ] Verify all configurations pass schema validation

## Configuration Generation Rules

### Math Delimiters

Map delimiter type names to patterns:
- `double-dollar` → `/\$\$([^\$]+?)\$\$/gs`
- `single-dollar` → `/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g`
- `bracket` → `/\\\[\s*([\s\S]*?)\s*\\\]/g`
- `paren` → `/\\\(\s*([^\\]*?)\s*\\\)/g`
- `align-env` → `/\\begin\{align\}([\s\S]*?)\\end\{align\}/g`
- `equation-env` → `/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g`

Priority: Lower numbers processed first (1, 2, 3...)

### Preprocessing Options

Based on `issues` array:
- `escaped_dollar_signs` → `fixEscapedDollars: true`
- `html_in_math` → `removeHtmlFromMath: true`
- Always enable: `removeMathML: true`, `removeSVG: true`

### Markdown Processing

Based on `markdown_elements` object:
- Enable features that are `true` in analysis
- `broken_markdown_links` in issues → `fixBrokenLinks: true`
- Always enable: `processBoldItalic: true`

### KaTeX Options

Standardized best practices:
- `throwOnError: false` (graceful degradation)
- `strict: false` (permissive mode)
- `trust`: Function allowing `\url`, `\href`, `\includegraphics`
- `macros`: Standard `\eqref` macro
- `maxSize: 500`, `maxExpand: 1000`

### Code Block Preservation

**Always enabled:**
- `enabled: true`
- `extractBeforeProcessing: true`
- `restoreAfterProcessing: true`

## Testing Strategy

1. **Generator Tests**
   - Generate configs for all models
   - Verify all required fields present
   - Verify regex patterns are valid
   - Verify code block preservation enabled

2. **Loader Tests**
   - Load all configurations
   - Verify registry can retrieve configs
   - Test fallback to default
   - Test error handling

3. **Integration Tests**
   - Load configs in frontend
   - Verify registry initialized
   - Test config retrieval for known models
   - Test default config for unknown models

## Next Steps

After completing Phase 3:

1. **Review Generated Configurations:**
   - Check configurations look reasonable
   - Verify all models have configs
   - Check metadata is correct

2. **Prepare for Phase 4:**
   - Configurations are ready for use
   - Registry can load configurations
   - Ready to integrate with LatexRenderer

3. **Documentation:**
   - Document configuration format
   - Document how to regenerate configs
   - Document how to add new models

## Reference Files

- **Phase 1 Analysis:** `backend/data/analysis/analysis_20251112_183053.json`
- **Configuration Schema:** `frontend/src/types/rendererConfig.ts`
- **Registry System:** `frontend/src/config/modelRendererRegistry.ts`
- **Configuration Loader:** `frontend/src/config/loadModelConfigs.ts`
- **Full Implementation Plan:** `docs/features/MODEL_SPECIFIC_RENDERING.md`

## Common Issues

### Invalid Regex Patterns
- Ensure delimiter patterns are valid JavaScript regex
- Escape special characters properly
- Test patterns match expected content

### Missing Required Fields
- Ensure all ModelRendererConfig fields are present
- Check codeBlockPreservation is always enabled
- Verify modelId matches analysis data

### Configuration Loading Errors
- Check JSON file is valid
- Verify file path is correct
- Check import/require statements
- Handle errors gracefully with fallback

### Schema Validation Failures
- Run validation tests
- Check all required fields present
- Verify types match schema
- Check code block preservation settings

## Notes

- **Best Practices:** Configurations use industry best practices for math rendering, markdown processing, and preprocessing
- **Extensibility:** Easy to add new models or update existing configurations
- **Validation:** All configurations validated against schema before loading
- **Fallback:** Default configuration ensures backward compatibility
- **Manual Review:** Configurations flagged for manual review will be refined in Phase 7

## Output Structure

Generated configuration file structure:
```json
[
  {
    "modelId": "anthropic/claude-sonnet-4.5",
    "version": "1.0.0",
    "displayMathDelimiters": [...],
    "inlineMathDelimiters": [...],
    "preprocessing": {...},
    "markdownProcessing": {...},
    "katexOptions": {...},
    "codeBlockPreservation": {
      "enabled": true,
      "extractBeforeProcessing": true,
      "restoreAfterProcessing": true
    },
    "metadata": {
      "createdAt": "2025-01-XX...",
      "needsManualReview": true
    }
  },
  ...
]
```


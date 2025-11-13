/**
 * Model Configuration Loader
 * 
 * Loads model-specific renderer configurations from analysis data or static configs.
 * This module will be populated in Phase 3 with generated configurations.
 */

import {
  registerModelConfig,
  markRegistryInitialized,
  isRegistryInitialized,
} from './modelRendererRegistry';
import type { ModelRendererConfig, MathDelimiterPattern } from '../types/rendererConfig';

/**
 * Analysis data structure (from Phase 1)
 */
interface AnalysisData {
  analyses: Record<string, {
    model_id: string;
    delimiters?: {
      display?: string[];
      inline?: string[];
    };
    issues?: string[];
    markdown_elements?: Record<string, boolean>;
    code_block_analysis?: {
      total_blocks?: number;
      languages_found?: string[];
      contains_math_like_content?: boolean;
      contains_dollar_signs?: boolean;
      contains_latex_commands?: boolean;
    };
    needs_manual_review?: boolean;
  }>;
}

/**
 * Create math delimiter patterns from delimiter type names
 * 
 * @param delimiterTypes - Array of delimiter type names
 * @param isDisplay - Whether these are display math delimiters
 * @returns Array of delimiter patterns
 */
function createDelimiterPatterns(
  delimiterTypes: string[],
  isDisplay: boolean
): MathDelimiterPattern[] {
  const patterns: MathDelimiterPattern[] = [];
  let priority = 1;
  
  for (const type of delimiterTypes) {
    let pattern: RegExp;
    let name: MathDelimiterPattern['name'];
    
    switch (type) {
      case 'double-dollar':
        pattern = /\$\$([^\$]+?)\$\$/gs;
        name = 'double-dollar';
        break;
      case 'single-dollar':
        pattern = /(?<!\$)\$([^\$\n]+?)\$(?!\$)/g;
        name = 'single-dollar';
        break;
      case 'bracket':
        pattern = /\\\[\s*([\s\S]*?)\s*\\\]/g;
        name = 'bracket';
        break;
      case 'paren':
        pattern = /\\\(\s*([^\\]*?)\s*\\\)/g;
        name = 'paren';
        break;
      case 'align-env':
        pattern = /\\begin\{align\}([\s\S]*?)\\end\{align\}/g;
        name = 'align-env';
        break;
      case 'equation-env':
        pattern = /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g;
        name = 'equation-env';
        break;
      default:
        console.warn(`Unknown delimiter type: ${type}`);
        continue;
    }
    
    patterns.push({ pattern, name, priority });
    priority++;
  }
  
  return patterns;
}

/**
 * Generate a model configuration from analysis data
 * 
 * @param modelId - Model identifier
 * @param analysis - Analysis data for the model
 * @returns Generated configuration
 */
function generateConfigFromAnalysis(
  modelId: string,
  analysis: AnalysisData['analyses'][string]
): ModelRendererConfig {
  const displayDelimiters = analysis.delimiters?.display || ['double-dollar'];
  const inlineDelimiters = analysis.delimiters?.inline || ['single-dollar'];
  
  const hasEscapedDollars = analysis.issues?.includes('escaped_dollar_signs') || false;
  const hasHtmlInMath = analysis.issues?.includes('html_in_math') || false;
  const hasBrokenLinks = analysis.issues?.includes('broken_markdown_links') || false;
  
  const config: ModelRendererConfig = {
    modelId,
    version: '1.0.0',
    
    displayMathDelimiters: createDelimiterPatterns(displayDelimiters, true),
    inlineMathDelimiters: createDelimiterPatterns(inlineDelimiters, false),
    
    preprocessing: {
      removeHtmlFromMath: hasHtmlInMath,
      fixEscapedDollars: hasEscapedDollars,
      removeMathML: true, // Always remove MathML artifacts
      removeSVG: true, // Always remove SVG artifacts
    },
    
    markdownProcessing: {
      processLinks: analysis.markdown_elements?.links !== false,
      fixBrokenLinks: hasBrokenLinks,
      processTables: analysis.markdown_elements?.tables !== false,
      processBlockquotes: analysis.markdown_elements?.blockquotes !== false,
      processHorizontalRules: analysis.markdown_elements?.horizontal_rules !== false,
      processHeaders: analysis.markdown_elements?.headers !== false,
      processBoldItalic: true, // Always process
      processLists: analysis.markdown_elements?.lists !== false,
      processInlineCode: analysis.markdown_elements?.inline_code !== false,
    },
    
    katexOptions: {
      throwOnError: false,
      strict: false,
      trust: (context: { command?: string }) =>
        ['\\url', '\\href', '\\includegraphics'].includes(context.command || ''),
      macros: {
        '\\eqref': '\\href{###1}{(\\text{#1})}',
      },
      maxSize: 500,
      maxExpand: 1000,
    },
    
    codeBlockPreservation: {
      enabled: true,
      extractBeforeProcessing: true,
      restoreAfterProcessing: true,
    },
    
    metadata: {
      createdAt: new Date().toISOString(),
      needsManualReview: analysis.needs_manual_review || false,
    },
  };
  
  return config;
}

/**
 * Load configurations from analysis data
 * 
 * @param analysisData - Analysis data from Phase 1
 */
export function loadConfigsFromAnalysis(analysisData: AnalysisData): void {
  if (isRegistryInitialized()) {
    console.warn('Registry already initialized, skipping load');
    return;
  }
  
  const analyses = analysisData.analyses || {};
  let loadedCount = 0;
  
  for (const [modelId, analysis] of Object.entries(analyses)) {
    try {
      const config = generateConfigFromAnalysis(modelId, analysis);
      registerModelConfig(config);
      loadedCount++;
    } catch (error) {
      console.error(`Failed to load config for ${modelId}:`, error);
    }
  }
  
  console.log(`Loaded ${loadedCount} model configurations from analysis data`);
  markRegistryInitialized();
}

/**
 * Load configurations from static JSON file
 * This will be used in Phase 3 when configurations are generated
 * 
 * @param configs - Array of configurations to load
 */
export function loadConfigsFromStatic(configs: ModelRendererConfig[]): void {
  if (isRegistryInitialized()) {
    console.warn('Registry already initialized, skipping load');
    return;
  }
  
  let loadedCount = 0;
  
  for (const config of configs) {
    try {
      registerModelConfig(config);
      loadedCount++;
    } catch (error) {
      console.error(`Failed to load config for ${config.modelId}:`, error);
    }
  }
  
  console.log(`Loaded ${loadedCount} model configurations from static configs`);
  markRegistryInitialized();
}

/**
 * Initialize the registry
 * This function will be called at app startup
 * 
 * For now, it's a placeholder that will be populated in Phase 3
 */
export async function initializeRegistry(): Promise<void> {
  if (isRegistryInitialized()) {
    return;
  }
  
  // Phase 3: Load configurations from generated config files
  // For now, registry starts empty and will use default config for all models
  // In Phase 3, we'll load configurations here
  
  console.log('Model renderer registry initialized (using default config for all models)');
  markRegistryInitialized();
}


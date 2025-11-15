/**
 * LatexRenderer - Comprehensive LaTeX/Markdown Renderer
 * 
 * A unified parser that handles AI model responses from multiple providers.
 * 
 * Key Features:
 * - Unified delimiter detection ($$, $, \[\], \(\))
 * - Automatic normalization to KaTeX format
 * - Permissive KaTeX configuration with trust mode
 * - Graceful error handling with visual fallbacks
 * - Multi-stage preprocessing pipeline
 * - Handles malformed content (MathML, SVG, KaTeX artifacts)
 * - Implicit math detection (parentheses/brackets with math content)
 * - Full markdown support (lists, code blocks, formatting)
 * 
 * Processing Pipeline:
 * 1. Clean malformed content (MathML, SVG, HTML artifacts)
 * 2. Fix common LaTeX issues (missing backslashes, malformed commands)
 * 3. Convert implicit math notation to explicit delimiters
 * 4. Preserve code blocks (bypass LaTeX processing)
 * 5. Process markdown lists with math content
 * 6. Normalize and render all math delimiters
 * 6.5. Preserve line breaks between consecutive INLINE math expressions (skip display math)
 * 7. Process markdown formatting (bold, italic, links, etc.)
 * 8. Convert list placeholders to HTML
 * 9. Apply paragraph breaks
 * 10. Restore code blocks and final cleanup
 */

import React, { useEffect, useRef, useMemo } from 'react';
import katex from 'katex';
import { getModelConfig } from '../config/modelRendererRegistry';
import { extractCodeBlocks, restoreCodeBlocks } from '../utils/codeBlockPreservation';
import type { ModelRendererConfig } from '../types/rendererConfig';

// Prism is loaded globally via CDN in index.html
declare const Prism: any;

interface LatexRendererProps {
    children: string;
    className?: string;
    modelId?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Default KaTeX options (fallback if model config doesn't specify)
const DEFAULT_KATEX_OPTIONS = {
    throwOnError: false,
    strict: false,
    trust: (context: { command?: string }) => ['\\url', '\\href', '\\includegraphics'].includes(context.command || ''),
    macros: {
        '\\eqref': '\\href{###1}{(\\text{#1})}',
    },
    maxSize: 500,
    maxExpand: 1000,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely render LaTeX with KaTeX with error handling
 */
const safeRenderKatex = (latex: string, displayMode: boolean, katexOptions?: ModelRendererConfig['katexOptions']): string => {
    try {
        const cleanLatex = latex.trim()
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/style="[^"]*"/g, ''); // Remove style attributes

        if (!cleanLatex) return '';

        // Merge model-specific options with defaults
        // Normalize trust property: convert string[] to function if needed
        const trustValue = katexOptions?.trust ?? DEFAULT_KATEX_OPTIONS.trust;
        const normalizedTrust = Array.isArray(trustValue)
            ? (context: { command?: string }) => trustValue.includes(context.command || '')
            : trustValue;

        const options = {
            ...DEFAULT_KATEX_OPTIONS,
            ...katexOptions,
            trust: normalizedTrust,
            displayMode,
        };

        return katex.renderToString(cleanLatex, options);
    } catch (error) {
        console.warn('KaTeX rendering error:', error, 'Input:', latex.substring(0, 100));
        // Return formatted fallback
        const style = displayMode
            ? 'display: block; border: 1px solid #ccc; padding: 8px; margin: 8px 0; background: #f9f9f9;'
            : 'border: 1px solid #ccc; padding: 2px 4px; background: #f9f9f9;';
        return `<span style="${style} font-family: monospace; font-size: 0.9em;">${latex.trim()}</span>`;
    }
};

/**
 * Check if content looks like mathematical notation
 */
const looksMathematical = (content: string): boolean => {
    // LaTeX commands
    if (/\\(frac|int|sum|sqrt|cdot|times|neq|leq|geq|alpha|beta|gamma|pi|theta|infty|partial)\b/.test(content)) {
        return true;
    }

    // Mathematical operators and symbols
    if (/[=+\-×·÷±≠≤≥≈∞∑∏∫√²³⁴⁵⁶⁷⁸⁹⁰¹]/.test(content)) {
        return true;
    }

    // Variables with exponents
    if (/[a-z]\^[0-9{]/.test(content) || /[a-z][²³⁴⁵⁶⁷⁸⁹⁰¹]/.test(content)) {
        return true;
    }

    // Derivatives
    if (/[a-z]'/.test(content) || /d[a-z]/.test(content)) {
        return true;
    }

    return false;
};

/**
 * Check if content looks like prose (not math)
 */
const looksProse = (content: string): boolean => {
    // URLs
    if (/https?:\/\//.test(content)) return true;

    // Long words without math
    if (content.match(/[a-zA-Z]{15,}/) && !looksMathematical(content)) return true;

    // Common prose patterns
    if (/^(where|note|for example|i\.e\.|e\.g\.|etc\.|see|vs\.|antiderivative|a constant|to |for |in |on |at |of |with |from |by )/i.test(content)) {
        return true;
    }

    // Check for prose connectors like "or" and "and" that indicate multiple solutions
    // These are natural language connectors, not mathematical operators
    if (/\s+(or|and)\s+/i.test(content)) {
        return true;
    }

    // Check for common mathematical description phrases (even if they contain some math notation)
    // These are prose descriptions, not pure math expressions
    const prosePhrases = [
        /coefficient\s+of/i,
        /constant\s+term/i,
        /leading\s+coefficient/i,
        /degree\s+of/i,
        /solution\s+to/i,
        /roots?\s+of/i,
        /value\s+of/i,
        /equation\s+of/i,
        /graph\s+of/i,
        /derivative\s+of/i,
        /integral\s+of/i,
    ];
    if (prosePhrases.some(pattern => pattern.test(content))) {
        return true;
    }

    // Multiple words (even short phrases are likely prose, not math)
    // Check word count even if content has some math notation (like "coefficient of x^2")
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 2) {
        // If it has multiple words AND contains prose indicators, it's prose
        // This handles cases like "coefficient of x^2" which has math but is still prose
        if (wordCount > 3 || /^(the|a|an)\s+/i.test(content) || /\s+(of|to|for|in|on|at|with|from|by)\s+/i.test(content)) {
            return true;
        }
    }
    if (wordCount > 2 && !looksMathematical(content)) return true;

    // Many words without math
    if (wordCount > 15 && !looksMathematical(content)) return true;

    return false;
};

const LatexRenderer: React.FC<LatexRendererProps> = ({ children, className = '', modelId }) => {
    // Safety check
    if (typeof children !== 'string') {
        console.error('LatexRenderer: children must be a string, got:', typeof children);
        return <div>Invalid content</div>;
    }

    // Get model-specific configuration (falls back to default if modelId not provided or not found)
    const config = useMemo(() => {
        // getModelConfig returns default config if modelId is not found
        // If modelId is not provided, we'll use a placeholder that will return default config
        return getModelConfig(modelId || '__default__');
    }, [modelId]);

    // ============================================================================
    // PREPROCESSING PIPELINE
    // ============================================================================

    /**
     * Stage 1: Clean malformed content (MathML, SVG, KaTeX artifacts)
     * Uses model-specific preprocessing options
     */
    const cleanMalformedContent = (text: string): string => {
        const preprocessOpts = config.preprocessing || {};
        let cleaned = text;

        // Remove malformed KaTeX/MathML markup
        cleaned = cleaned.replace(/<\s*spanclass\s*=\s*["']katex[^"']*["'][^>]*>/gi, '');
        cleaned = cleaned.replace(/spanclass/gi, '');
        cleaned = cleaned.replace(/mathxmlns/gi, '');
        cleaned = cleaned.replace(/annotationencoding/gi, '');

        // Remove MathML blocks (if enabled in config)
        if (preprocessOpts.removeMathML !== false) {
            cleaned = cleaned.replace(/<math[^>]*xmlns[^>]*>[\s\S]*?<\/math>/gi, '');
            cleaned = cleaned.replace(/xmlns:?[^=]*="[^"]*w3\.org\/1998\/Math\/MathML[^"]*"/gi, '');
            cleaned = cleaned.replace(/https?:\/\/www\.w3\.org\/1998\/Math\/MathML[^\s<>]*/gi, '');
            cleaned = cleaned.replace(/www\.w3\.org\/1998\/Math\/MathML[^\s<>]*/gi, '');

            // Remove MathML tags while preserving content
            const mathmlTags = ['math', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac', 'mtext', 'mspace'];
            mathmlTags.forEach(tag => {
                // eslint-disable-next-line no-useless-escape
                cleaned = cleaned.replace(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'gi'), '$1');
                // eslint-disable-next-line no-useless-escape
                cleaned = cleaned.replace(new RegExp(`<\/?${tag}[^>]*>`, 'gi'), '');
            });
        }

        // Remove SVG content (if enabled in config)
        if (preprocessOpts.removeSVG !== false) {
            cleaned = cleaned.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
            cleaned = cleaned.replace(/<path[^>]*\/>/gi, '');

            // Remove long sequences that look like SVG path data
            cleaned = cleaned.replace(/[a-zA-Z0-9\s,.-]{50,}/g, (match) => {
                const hasMany = (pattern: RegExp, threshold: number) => (match.match(pattern) || []).length > threshold;
                if (hasMany(/\d/g, 10) && hasMany(/,/g, 5) && hasMany(/[a-zA-Z]/g, 5)) {
                    return ''; // Remove SVG path data
                }
                return match;
            });
        }

        // Remove HTML from math expressions (if enabled in config)
        if (preprocessOpts.removeHtmlFromMath) {
            // This will be applied during math rendering, but we can also do basic cleanup here
            cleaned = cleaned.replace(/(\$\$?[^$]*?)<[^>]+>([^$]*?\$\$?)/g, '$1$2');
        }

        // Fix escaped dollar signs (if enabled in config)
        if (preprocessOpts.fixEscapedDollars) {
            cleaned = cleaned.replace(/\\\$/g, '$');
        }

        // Remove model-generated placeholders early to prevent interference with list processing
        // Be very aggressive - catch all variations and concatenated placeholders
        // Handle double parentheses format: ((MDPH3)) - remove all occurrences, even concatenated
        while (cleaned.includes('((MDPH')) {
            cleaned = cleaned.replace(/\(\(MDPH\d+\)\)/g, '');
        }
        // Handle curly braces format: {{MDPH3}} - remove all occurrences, even concatenated
        while (cleaned.includes('{{MDPH')) {
            cleaned = cleaned.replace(/\{\{MDPH\d+\}\}/g, '');
        }
        // Handle single parentheses/braces as fallback
        cleaned = cleaned.replace(/\(MDPH\d+\)/g, '');
        cleaned = cleaned.replace(/\{MDPH\d+\}/g, '');
        // Remove any trailing --- that might follow placeholders
        cleaned = cleaned.replace(/\s*---+\s*/g, ' ');

        // Apply custom preprocessing functions if provided
        if (preprocessOpts.customPreprocessors) {
            for (const preprocessor of preprocessOpts.customPreprocessors) {
                cleaned = preprocessor(cleaned);
            }
        }

        return cleaned;
    };

    /**
     * Stage 2: Fix common LaTeX issues
     */
    const fixLatexIssues = (text: string): string => {
        let fixed = text;

        // Remove standalone delimiter lines (common in AI outputs)
        fixed = fixed.replace(/^\\\[\s*$/gm, '');
        fixed = fixed.replace(/^\\\]\s*$/gm, '');
        fixed = fixed.replace(/^\$\$\s*$/gm, '');

        // Fix missing backslashes in common LaTeX commands
        const commands = ['frac', 'boxed', 'sqrt', 'sum', 'prod', 'int', 'lim', 'sin', 'cos', 'tan', 'log', 'ln', 'exp'];
        commands.forEach(cmd => {
            fixed = fixed.replace(new RegExp(`\\b${cmd}\\{`, 'g'), `\\${cmd}{`);
            fixed = fixed.replace(new RegExp(`\\b${cmd}([_^])`, 'g'), `\\${cmd}$1`);
        });

        // Fix missing backslashes in operators
        const operators = ['neq', 'leq', 'geq', 'cdot', 'times', 'div', 'pm', 'mp', 'approx', 'equiv', 'sim', 'infty'];
        operators.forEach(op => {
            fixed = fixed.replace(new RegExp(`\\b${op}\\b`, 'g'), `\\${op}`);
        });

        // Fix \left and \right (KaTeX handles these automatically in most cases)
        fixed = fixed.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')');
        fixed = fixed.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']');
        fixed = fixed.replace(/\\left\\\{/g, '\\{').replace(/\\right\\\}/g, '\\}');

        // Clean up boxed commands (remove redundant wrappers)
        fixed = fixed.replace(/\(\s*\\boxed\{([^}]+)\}\s*\)\.?/g, '\\boxed{$1}');
        fixed = fixed.replace(/\[\s*\\boxed\{([^}]+)\}\s*\]\.?/g, '\\boxed{$1}');
        fixed = fixed.replace(/\\boxed\{\s*\(\s*([^)]+)\s*\)\s*\}/g, '\\boxed{$1}');
        fixed = fixed.replace(/\\boxed\{\s*\[\s*([^\]]+)\s*\]\s*\}/g, '\\boxed{$1}');

        // Fix double parentheses (( ... )) - often used for emphasis
        fixed = fixed.replace(/\(\(\s*([^()]+)\s*\)\)/g, '( $1 )');

        // Fix specific mathematical patterns that cause rendering issues
        // Fix double negative signs in parentheses: (-(-7)) -> (-(-7))
        // This handles the case where we have -(-7) which should stay as -(-7)
        fixed = fixed.replace(/\(-\s*\(-\s*(\d+)\s*\)\s*\)/g, '(-(-$1))');

        // Fix the specific case where --7 appears (should be -(-7))
        fixed = fixed.replace(/--(\d+)/g, '-(-$1)');

        // Fix multiplication in parentheses: (2(2)) -> (2 \cdot 2) or (2 \times 2)
        fixed = fixed.replace(/\((\d+)\s*\((\d+)\s*\)\s*\)/g, '($1 \\cdot $2)');

        // Fix the specific case where (22) appears (should be (2 \cdot 2))
        fixed = fixed.replace(/\((\d)(\d)\)/g, '($1 \\cdot $2)');

        // Additional fix for the specific pattern: (--7) -> (-(-7))
        fixed = fixed.replace(/\(--(\d+)\)/g, '(-(-$1))');

        // Fix square root symbol: √ -> \sqrt
        fixed = fixed.replace(/√(\d+)/g, '\\sqrt{$1}');

        // Fix plus-minus symbol: ± -> \pm
        fixed = fixed.replace(/±/g, '\\pm');

        // Fix multiplication symbol: × -> \times
        fixed = fixed.replace(/×/g, '\\times');

        // Fix spacing around \times in parentheses: (2\times2) -> (2 \times 2)
        fixed = fixed.replace(/\((\d+)\\times(\d+)\)/g, '($1 \\times $2)');

        // Fix various Unicode minus signs to regular ASCII minus
        fixed = fixed.replace(/−/g, '-'); // Unicode minus sign (U+2212) to ASCII hyphen-minus
        fixed = fixed.replace(/‒/g, '-'); // Figure dash (U+2012) to ASCII hyphen-minus
        fixed = fixed.replace(/–/g, '-'); // En dash (U+2013) to ASCII hyphen-minus
        fixed = fixed.replace(/—/g, '-'); // Em dash (U+2014) to ASCII hyphen-minus

        // Fix derivative notation
        fixed = fixed.replace(/fracdx\[([^\]]+)\]/g, '\\frac{d}{dx}[$1]');
        fixed = fixed.replace(/fracd([a-z])\[([^\]]+)\]/g, '\\frac{d}{d$1}[$2]');

        // Fix common malformed LaTeX mixed with HTML
        fixed = fixed.replace(/\\boxed\{[^}]*style="[^"]*"[^}]*\}/g, (match) => {
            const content = match
                .replace(/\\boxed\{/, '')
                .replace(/\}$/, '')
                .replace(/<[^>]*>/g, '')
                .replace(/style="[^"]*"/g, '')
                .trim();
            return `\\boxed{${content}}`;
        });

        return fixed;
    };

    /**
     * Stage 3: Detect and convert implicit math notation
     */
    const convertImplicitMath = (text: string): string => {
        let converted = text;

        // FIRST: Handle d/dx(...) and d/dx[...] patterns before general conversion
        // Replace d/dx with the fraction, keep the argument as-is (will be processed later)
        converted = converted.replace(/\bd\/d([a-zA-Z])\(([^)]+)\)/g, (_match, variable, expression) => {
            // Don't wrap in \(...\), just replace d/dx with the placeholder
            return `__DERIVATIVE_${variable}__(${expression})`;
        });

        converted = converted.replace(/\bd\/d([a-zA-Z])\[([^\]]+)\]/g, (_match, variable, expression) => {
            return `__DERIVATIVE_${variable}__[${expression}]`;
        });

        // Handle content in parentheses with spaces: ( math content )
        converted = converted.replace(/\(\s+((?:[^()]|\([^()]*\))+?)\s+\)/g, (_match, content) => {
            // Don't convert if content has markdown formatting
            if (content.includes('*') || content.includes('_') || content.includes('`')) return _match;
            if (looksMathematical(content) && !looksProse(content)) {
                return `\\(${content.trim()}\\)`;
            }
            return _match;
        });

        // Handle content in square brackets with spaces: [ math content ]
        // Note: Only convert if it looks like math notation WITH spaces, to avoid
        // interfering with d/dx[expr] notation which should keep its brackets
        converted = converted.replace(/\[\s+((?:[^[\]]|\[[^\]]*\])+?)\s+\]/g, (_match, content) => {
            if (content.includes('\\boxed')) return _match; // Already handled
            // Don't convert if preceded by d/dx pattern
            if (looksMathematical(content) && !looksProse(content)) {
                return `\\(${content.trim()}\\)`;
            }
            return _match;
        });

        // Handle simple parentheses (not function calls) - BUT be more careful about mathematical expressions
        converted = converted.replace(/(?<![a-zA-Z])\(([^()]+)\)/g, (_match, content) => {
            if (_match.includes('\\(') || content.includes('\\boxed')) return _match;
            if (content.match(/^(a|an)\s+/i)) return _match; // Prose
            // Don't convert if content has markdown formatting (asterisks, underscores, backticks)
            if (content.includes('*') || content.includes('_') || content.includes('`')) return _match;

            const trimmed = content.trim();

            // Don't convert if this contains LaTeX commands that were already processed
            if (content.includes('\\cdot') || content.includes('\\pm') || content.includes('\\sqrt')) {
                return _match;
            }

            // Don't convert if this is part of a larger mathematical expression
            // Check if this parentheses is part of a mathematical statement (contains =, ±, /, etc.)
            const beforeMatch = text.substring(0, text.indexOf(_match));
            const afterMatch = text.substring(text.indexOf(_match) + _match.length);

            // If there's an equals sign, plus/minus, division, or other math operators nearby, 
            // this is likely part of a larger math expression and shouldn't be converted
            const mathContextPattern = /[=+\-×·÷±≠≤≥≈∞∑∏∫√²³⁴⁵⁶⁷⁸⁹⁰¹]/;
            if (mathContextPattern.test(beforeMatch.slice(-20)) || mathContextPattern.test(afterMatch.slice(0, 20))) {
                return _match;
            }

            // Don't convert phrases with multiple words (prose, not math)
            if (trimmed.includes(' ')) return _match;

            // Single letter/number or simple math expressions
            if (/^[a-zA-Z0-9]$/.test(trimmed) ||
                /^[+-]?\s*[A-Z]$/.test(trimmed) ||
                (looksMathematical(content) && !looksProse(content) && content.length < 100)) {
                return `\\(${trimmed}\\)`;
            }

            return _match;
        });

        return converted;
    };

    /**
     * Render a code block to HTML
     * This is called after code blocks are restored from placeholders
     */
    const renderCodeBlock = (language: string, code: string): string => {
        const lang = language || 'plaintext';
        const cleanCode = code.replace(/^\n+|\n+$/g, '');

        // Map common aliases to Prism language names
        const languageMap: { [key: string]: string } = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'rb': 'ruby',
            'sh': 'bash',
            'yml': 'yaml',
            'html': 'markup',
            'xml': 'markup',
            'c++': 'clike',
            'cpp': 'clike',
            'c#': 'csharp',
            'cs': 'csharp',
        };

        const prismLang = languageMap[lang.toLowerCase()] || lang.toLowerCase();

        // Escape the code for safe HTML insertion
        const escapedCode = cleanCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Base64 encode the original code for reliable storage in data attribute
        const base64Code = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(cleanCode))) : '';

        return `
            <div class="code-block-direct" data-language="${lang}" data-code-base64="${base64Code}" style="
                background: #0d1117;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                overflow-x: auto;
                font-size: 14px;
                line-height: 1.5;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                position: relative;
            ">
                <div class="code-block-header" style="
                    position: absolute;
                    top: 8px;
                    left: 12px;
                    right: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    pointer-events: none;
                    z-index: 1;
                ">
                    <span class="code-language-label" style="
                        font-size: 11px;
                        color: #7d8590;
                        text-transform: uppercase;
                        font-weight: 600;
                        background: rgba(125, 133, 144, 0.15);
                        padding: 0.25rem 0.5rem;
                        border-radius: 3px;
                        letter-spacing: 0.5px;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    ">${lang}</span>
                    <button class="code-copy-btn" onclick="(function(btn){try{const base64=btn.parentElement.parentElement.getAttribute('data-code-base64');const code=decodeURIComponent(escape(atob(base64)));navigator.clipboard.writeText(code).then(()=>{const origHTML=btn.innerHTML;btn.innerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg>';btn.style.color='#3fb950';setTimeout(()=>{btn.innerHTML=origHTML;btn.style.color='#7d8590';},2000);}).catch(e=>console.error(e));}catch(e){console.error('Copy error:',e);}})(this)" style="
                        pointer-events: auto;
                        background: none;
                        border: none;
                        color: #7d8590;
                        cursor: pointer;
                        padding: 0.25rem;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 24px;
                        height: 24px;
                    " onmouseover="this.style.background='rgba(125, 133, 144, 0.15)'; this.style.color='#e6edf3';" onmouseout="if(!this.style.color.includes('3fb950')){this.style.background='none';this.style.color='#7d8590';}" title="Copy code">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                    </button>
                </div>
                <pre class="language-${prismLang}" style="margin: 0; margin-top: 28px; white-space: pre; word-wrap: normal; overflow-wrap: normal;"><code class="language-${prismLang}">${escapedCode}</code></pre>
            </div>
        `;
    };

    /**
     * Stage 5: Process markdown lists
     */
    const processMarkdownLists = (text: string): string => {
        // First, remove any model-generated placeholders that might interfere with list detection
        // Be very aggressive - catch all variations and concatenated placeholders
        let processed = text;
        // Handle double parentheses format: ((MDPH3)) - remove all occurrences, even concatenated
        while (processed.includes('((MDPH')) {
            processed = processed.replace(/\(\(MDPH\d+\)\)/g, '');
        }
        // Handle curly braces format: {{MDPH3}} - remove all occurrences, even concatenated
        while (processed.includes('{{MDPH')) {
            processed = processed.replace(/\{\{MDPH\d+\}\}/g, '');
        }
        // Handle single parentheses/braces as fallback
        processed = processed.replace(/\(MDPH\d+\)/g, '');
        processed = processed.replace(/\{MDPH\d+\}/g, '');
        // NOTE: Horizontal rules (---) are intentionally NOT removed here
        // They will be processed in Stage 7 (processMarkdown) and converted to <hr> tags
        // The previous code removed all --- which caused headers after --- to be concatenated
        // onto the same line, breaking header detection

        // Debug: Check for ordered list patterns in input
        const olPattern = /^\d+\.\s+/gm;
        const olMatches = processed.match(olPattern);
        console.log(`[processMarkdownLists] Input has ${olMatches ? olMatches.length : 0} potential OL items`);
        if (olMatches && olMatches.length > 0) {
            console.log('[processMarkdownLists] Sample matches:', olMatches.slice(0, 5));
            // Show context around first match
            const firstMatchIndex = processed.search(olPattern);
            if (firstMatchIndex >= 0) {
                console.log('[processMarkdownLists] Context around first match:', processed.substring(Math.max(0, firstMatchIndex - 50), firstMatchIndex + 150));
            }
        }

        // Helper function to process list content (math and markdown formatting)
        const processListContent = (content: string): string => {
            let processedContent = convertImplicitMath(content);

            // CRITICAL: Do NOT restore inline math placeholders here
            // Keep them as __INLINE_MATH_X__ to preserve the list placeholder structure
            // They will be restored and rendered later in the pipeline (Stage 8.5)

            // Process bold/italic inside list items, BUT protect inline math placeholders
            // IMPORTANT: First, temporarily protect inline math placeholders from markdown processing
            const mathPlaceholders = new Map<string, string>();
            let placeholderCounter = 0;
            processedContent = processedContent.replace(/__INLINE_MATH_\d+__/g, (match) => {
                const tempPlaceholder = `%%MATHPH${placeholderCounter}%%`;
                mathPlaceholders.set(tempPlaceholder, match);
                placeholderCounter++;
                return tempPlaceholder;
            });

            // Bold: match ** but allow single * inside
            processedContent = processedContent.replace(/\*\*((?:(?!\*\*)[\s\S])+?)\*\*/g, '<strong>$1</strong>');
            // Bold: match __ but allow single _ inside
            processedContent = processedContent.replace(/__((?:(?!__)[\s\S])+?)__/g, (match, content) => {
                // Skip if this looks like it might be part of math
                if (content.includes('$') || content.includes('\\(') || content.includes('\\[')) {
                    return match; // Don't process as bold
                }
                return `<strong>${content}</strong>`;
            });
            // Italic: match single * but not when part of **
            processedContent = processedContent.replace(/(?<!\*)\*((?:(?!\*)[^\n])+?)\*(?!\*)/g, '<em>$1</em>');
            // Italic: match single _ but not when part of __
            processedContent = processedContent.replace(/(?<!_)_((?:(?!_)[^\n])+?)_(?!_)/g, '<em>$1</em>');

            // Restore inline math placeholders (use replaceAll to handle multiple occurrences)
            mathPlaceholders.forEach((original, placeholder) => {
                processedContent = processedContent.replaceAll(placeholder, original);
            });
            // Inline code
            processedContent = processedContent.replace(/`([^`\n]+?)`/g, '<code class="inline-code">$1</code>');

            return processedContent;
        };

        // Task lists
        processed = processed.replace(/^- \[([ x])\] (.+)$/gm, (_, checked, text) => {
            const isChecked = checked === 'x';
            const processedText = processListContent(text);
            return `__TASK_${isChecked ? 'checked' : 'unchecked'}__${processedText}__/TASK__`;
        });

        // Unordered lists - support both '-' and '*' bullets
        // Match '-' bullets (but not task lists)
        processed = processed.replace(/^(\s*)- (?!\[[ x]\])(.+)$/gm, (_, indent, content) => {
            const level = indent.length;
            const processedContent = processListContent(content);
            return `__UL_${level}__${processedContent}__/UL__`;
        });
        // Match '*' bullets (common in Gemini and other models)
        processed = processed.replace(/^(\s*)\* (?!\[[ x]\])(.+)$/gm, (_, indent, content) => {
            const level = indent.length;
            const processedContent = processListContent(content);
            return `__UL_${level}__${processedContent}__/UL__`;
        });

        // Ordered lists - simpler approach
        // First, match just the list item line with its content
        // Allow one or more spaces after the period, match any non-empty content
        let matchCount = 0;
        processed = processed.replace(/^(\s*)(\d+)\.\s+(.+?)$/gm, (_match, indent, num, content) => {
            matchCount++;
            const level = indent.length;
            console.log(`[OL Match] Found item ${num}: "${content}"`);
            const processedContent = processListContent(content);
            return `__OL_${level}_${num}__${processedContent}__/OL__`;
        });
        console.log(`[processMarkdownLists] Total OL items found: ${matchCount}`);

        // Then, find indented lines that follow list items and incorporate them
        // Match pattern: list placeholder followed by blank lines and truly indented content (3+ spaces)
        // This ensures we only capture continuation lines, not the next paragraph or list
        processed = processed.replace(
            /__OL_(\d+)_(\d+)__([\s\S]*?)__\/OL__(?:\n((?:[ \t]{3,}[^\n]+(?:\n|$)|[ \t]*\n)*))?/g,
            (_fullMatch, level, num, content, continuationBlock) => {
                let result = `__OL_${level}_${num}__${content}`;

                if (continuationBlock && continuationBlock.trim()) {
                    // Process the continuation lines
                    const lines = continuationBlock.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed) {
                            result += `<div style="margin-left: 2em; margin-top: 0.5em;">${trimmed}</div>`;
                        }
                    }
                }

                return result + '__/OL__';
            }
        );

        return processed;
    };

    /**
     * Extract display math blocks to protect them from preprocessing
     * Similar to code block extraction, but for math delimiters
     */
    const extractDisplayMath = (text: string): { text: string; mathBlocks: string[] } => {
        const mathBlocks: string[] = [];
        const placeholderPrefix = '__DISPLAY_MATH_';
        const placeholderSuffix = '__';

        let processed = text;
        const displayDelimiters = [...config.displayMathDelimiters].sort((a, b) => {
            const priorityA = a.priority ?? 999;
            const priorityB = b.priority ?? 999;
            return priorityA - priorityB;
        });

        // Extract all display math blocks using model-specific delimiters
        displayDelimiters.forEach(({ pattern }) => {
            processed = processed.replace(pattern, (fullMatch) => {
                const index = mathBlocks.length;
                mathBlocks.push(fullMatch); // Store the full match including delimiters
                return `${placeholderPrefix}${index}${placeholderSuffix}`;
            });
        });

        return { text: processed, mathBlocks };
    };

    /**
     * Restore display math blocks after preprocessing
     */
    const restoreDisplayMath = (text: string, mathBlocks: string[]): string => {
        const placeholderPrefix = '__DISPLAY_MATH_';
        const placeholderSuffix = '__';
        const placeholderRegex = new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, 'g');

        return text.replace(placeholderRegex, (_match, index) => {
            const blockIndex = parseInt(index, 10);
            if (blockIndex >= 0 && blockIndex < mathBlocks.length) {
                return mathBlocks[blockIndex];
            }
            return _match; // Return original if index is invalid
        });
    };

    /**
     * Extract inline math blocks to protect them from preprocessing
     * Similar to display math extraction, but for inline math delimiters
     */
    const extractInlineMath = (text: string): { text: string; mathBlocks: string[] } => {
        const mathBlocks: string[] = [];
        const placeholderPrefix = '__INLINE_MATH_';
        const placeholderSuffix = '__';

        let processed = text;
        const inlineDelimiters = [...config.inlineMathDelimiters].sort((a, b) => {
            const priorityA = a.priority ?? 999;
            const priorityB = b.priority ?? 999;
            return priorityA - priorityB;
        });

        // Extract all inline math blocks using model-specific delimiters
        inlineDelimiters.forEach(({ pattern }) => {
            processed = processed.replace(pattern, (fullMatch) => {
                const index = mathBlocks.length;
                mathBlocks.push(fullMatch); // Store the full match including delimiters
                return `${placeholderPrefix}${index}${placeholderSuffix}`;
            });
        });

        return { text: processed, mathBlocks };
    };

    /**
     * Restore inline math blocks after preprocessing
     */
    const restoreInlineMath = (text: string, mathBlocks: string[], skipInsideListPlaceholders: boolean = false): string => {
        const placeholderPrefix = '__INLINE_MATH_';
        const placeholderSuffix = '__';
        const placeholderRegex = new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, 'g');

        // If we should skip inline math inside list placeholders, process the text in chunks
        if (skipInsideListPlaceholders) {
            // Split text by list placeholder boundaries
            const listPlaceholderRegex = /(__(?:OL|UL)_[\d_]+__[\s\S]*?__\/(?:OL|UL)__|__TASK_(?:checked|unchecked)__[\s\S]*?__\/TASK__)/g;
            let result = '';
            let lastIndex = 0;
            let match;

            while ((match = listPlaceholderRegex.exec(text)) !== null) {
                // Process text before this list placeholder
                const beforeList = text.substring(lastIndex, match.index);
                result += beforeList.replace(placeholderRegex, (_match, index) => {
                    const blockIndex = parseInt(index, 10);
                    if (blockIndex >= 0 && blockIndex < mathBlocks.length) {
                        return mathBlocks[blockIndex];
                    }
                    return _match;
                });

                // Add the list placeholder unchanged (don't restore inline math inside it)
                result += match[0];
                lastIndex = match.index + match[0].length;
            }

            // Process remaining text after last list placeholder
            const afterLists = text.substring(lastIndex);
            result += afterLists.replace(placeholderRegex, (_match, index) => {
                const blockIndex = parseInt(index, 10);
                if (blockIndex >= 0 && blockIndex < mathBlocks.length) {
                    return mathBlocks[blockIndex];
                }
                return _match;
            });

            return result;
        }

        // Default behavior: restore all inline math placeholders
        return text.replace(placeholderRegex, (_match, index) => {
            const blockIndex = parseInt(index, 10);
            if (blockIndex >= 0 && blockIndex < mathBlocks.length) {
                return mathBlocks[blockIndex];
            }
            return _match; // Return original if index is invalid
        });
    };

    /**
     * Stage 6: Normalize and render math delimiters
     */
    const renderMathContent = (text: string): string => {
        let rendered = text;

        // FIRST: Handle explicit display math using model-specific delimiters
        // This must come BEFORE implicit math detection to avoid interference
        // Sort by priority (lower numbers first) if priority is specified
        const displayDelimiters = [...config.displayMathDelimiters].sort((a, b) => {
            const priorityA = a.priority ?? 999;
            const priorityB = b.priority ?? 999;
            return priorityA - priorityB;
        });

        displayDelimiters.forEach(({ pattern }) => {
            rendered = rendered.replace(pattern, (_match, math) => {
                return safeRenderKatex(math, true, config.katexOptions);
            });
        });

        // THEN: Handle mathematical expressions BEFORE individual symbols get processed
        // This catches expressions like "x = ..." that contain LaTeX commands
        // But skip if already rendered (inside display math delimiters)
        // Match the line including the newline to preserve line breaks
        rendered = rendered.replace(/^x\s*=\s*(.+?)(\n+|$)/gm, (_match, rightSide, newlines) => {
            const fullExpression = `x = ${rightSide}`;

            // Process if it looks mathematical OR contains LaTeX commands, but doesn't already have KaTeX HTML
            const hasLatexCommands = /\\(sqrt|frac|cdot|times|pm|neq|leq|geq|alpha|beta|gamma|pi|theta|infty|partial)/.test(fullExpression);
            const alreadyRendered = fullExpression.includes('<span class="katex">') || fullExpression.includes('katex');

            // Check if the expression contains "or" or "and" connectors (multiple solutions)
            const hasConnectors = /\s+(or|and)\s+/i.test(fullExpression);

            // If it contains connectors, handle separately (bypass looksProse check for connectors)
            if (!alreadyRendered && hasConnectors) {
                const parts = fullExpression.split(/\s+(or|and)\s+/i);
                const result: string[] = [];

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i].trim();
                    // Check if this part is a connector word
                    if (/^(or|and)$/i.test(part)) {
                        result.push(` ${part} `);
                    } else if (part && (looksMathematical(part) || hasLatexCommands)) {
                        // Render this part as math
                        result.push(safeRenderKatex(part, false, config.katexOptions));
                    } else {
                        // Keep as plain text
                        result.push(part);
                    }
                }

                // Convert newlines to <br> tags for consistency
                const newlineHtml = newlines ? '<br>'.repeat(newlines.length) : '';
                return result.join('') + newlineHtml;
            }

            // Normal rendering for expressions without connectors
            if (!alreadyRendered && (looksMathematical(fullExpression) || hasLatexCommands) && !looksProse(fullExpression)) {
                // Preserve the newlines after the line
                const newlineHtml = newlines ? '<br>'.repeat(newlines.length) : '';
                return safeRenderKatex(fullExpression, false, config.katexOptions) + newlineHtml;
            }
            return _match;
        });

        // Handle other mathematical expressions that don't have explicit delimiters
        // Match entire lines that look like equations, preserving newlines
        rendered = rendered.replace(/^([a-zA-Z]+[₀-₉₁-₉]*\s*=\s*[^=\n<]+?)(\n+|$)/gm, (_match, expression, newlines) => {
            // Process if it looks mathematical OR contains LaTeX commands, but doesn't already have KaTeX HTML
            const hasLatexCommands = /\\(sqrt|frac|cdot|times|pm|neq|leq|geq|alpha|beta|gamma|pi|theta|infty|partial)/.test(expression);
            const alreadyRendered = expression.includes('<span class="katex">') || expression.includes('katex');

            // Check if the expression contains "or" or "and" connectors (multiple solutions)
            const hasConnectors = /\s+(or|and)\s+/i.test(expression);

            // If it contains connectors, handle separately (bypass looksProse check for connectors)
            if (!alreadyRendered && hasConnectors) {
                const parts = expression.split(/\s+(or|and)\s+/i);
                const result: string[] = [];

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i].trim();
                    // Check if this part is a connector word
                    if (/^(or|and)$/i.test(part)) {
                        result.push(` ${part} `);
                    } else if (part && (looksMathematical(part) || hasLatexCommands)) {
                        // Render this part as math
                        result.push(safeRenderKatex(part, false, config.katexOptions));
                    } else {
                        // Keep as plain text
                        result.push(part);
                    }
                }

                // Convert newlines to <br> tags for consistency
                const newlineHtml = newlines ? '<br>'.repeat(newlines.length) : '';
                return result.join('') + newlineHtml;
            }

            // Check if expression contains prose in parentheses (e.g., "a = 1 (coefficient of x^2)")
            // If so, split and only render the mathematical parts as math
            const proseInParensMatch = expression.match(/\(([^)]+)\)/);
            if (!alreadyRendered && proseInParensMatch) {
                const parenContent = proseInParensMatch[1];
                // If the parentheses content is prose, split the expression
                if (looksProse(parenContent)) {
                    // Split into parts: the math part before parentheses and the prose in parentheses
                    // Preserve original spacing by reconstructing the string carefully
                    const parts: string[] = [];
                    let lastIndex = 0;
                    let match;
                    const parenRegex = /\(([^)]+)\)/g;

                    while ((match = parenRegex.exec(expression)) !== null) {
                        // Add the part before this parentheses (preserve spacing)
                        const beforeParen = expression.substring(lastIndex, match.index);
                        if (beforeParen.trim()) {
                            // Check if this part is mathematical
                            const trimmedBefore = beforeParen.trim();
                            if (looksMathematical(trimmedBefore) || hasLatexCommands) {
                                // Preserve leading/trailing whitespace
                                const leadingSpace = beforeParen.match(/^(\s*)/)?.[1] || '';
                                const trailingSpace = beforeParen.match(/(\s*)$/)?.[1] || '';
                                parts.push(leadingSpace + safeRenderKatex(trimmedBefore, false, config.katexOptions) + trailingSpace);
                            } else {
                                parts.push(beforeParen);
                            }
                        } else if (beforeParen) {
                            // Just whitespace, preserve it
                            parts.push(beforeParen);
                        }

                        // Add the parentheses content as plain text (it's prose)
                        parts.push(`(${match[1]})`);
                        lastIndex = match.index + match[0].length;
                    }

                    // Add any remaining part after the last parentheses
                    const afterLastParen = expression.substring(lastIndex);
                    if (afterLastParen.trim()) {
                        const trimmedAfter = afterLastParen.trim();
                        if (looksMathematical(trimmedAfter) || hasLatexCommands) {
                            const leadingSpace = afterLastParen.match(/^(\s*)/)?.[1] || '';
                            const trailingSpace = afterLastParen.match(/(\s*)$/)?.[1] || '';
                            parts.push(leadingSpace + safeRenderKatex(trimmedAfter, false, config.katexOptions) + trailingSpace);
                        } else {
                            parts.push(afterLastParen);
                        }
                    } else if (afterLastParen) {
                        parts.push(afterLastParen);
                    }

                    // Convert newlines to <br> tags to ensure line breaks are preserved
                    // when mixing math HTML with plain text prose
                    // Multiple newlines (blank lines) should become multiple <br> tags
                    const newlineHtml = newlines ? '<br>'.repeat(newlines.length) : '';
                    return parts.join('') + newlineHtml;
                }
            }

            // Normal rendering for expressions without connectors
            if (!alreadyRendered && (looksMathematical(expression) || hasLatexCommands) && !looksProse(expression)) {
                // Preserve the newlines after the line
                const newlineHtml = newlines ? '<br>'.repeat(newlines.length) : '';
                return safeRenderKatex(expression, false, config.katexOptions) + newlineHtml;
            }
            return _match;
        });

        // Handle mathematical expressions within text (like verification steps)
        // Look for patterns like "2(3)² - 7(3) + 3 = 18 - 21 + 3 = 0"
        rendered = rendered.replace(/(\d+\([^)]+\)[²³⁴⁵⁶⁷⁸⁹⁰¹]?\s*[-+]\s*\d+\([^)]+\)\s*[-+]\s*\d+\s*=\s*[^=\n<]+)/g, (_match, mathExpression) => {
            const alreadyRendered = mathExpression.includes('<span class="katex">') || mathExpression.includes('katex');

            if (!alreadyRendered && looksMathematical(mathExpression)) {
                return safeRenderKatex(mathExpression, false, config.katexOptions);
            }
            return _match;
        });

        // Then, handle explicit inline math using model-specific delimiters
        // Sort by priority (lower numbers first) if priority is specified
        const inlineDelimiters = [...config.inlineMathDelimiters].sort((a, b) => {
            const priorityA = a.priority ?? 999;
            const priorityB = b.priority ?? 999;
            return priorityA - priorityB;
        });

        inlineDelimiters.forEach(({ pattern }) => {
            rendered = rendered.replace(pattern, (_match, math) => {
                return safeRenderKatex(math, false, config.katexOptions);
            });
        });

        // Handle standalone LaTeX commands
        // Handle \sqrt{...} commands
        let sqrtRegex = /\\sqrt\{([^}]+)\}/g;
        let sqrtMatch;
        const sqrtReplacements: Array<{ start: number, end: number, replacement: string }> = [];

        while ((sqrtMatch = sqrtRegex.exec(rendered)) !== null) {
            const start = sqrtMatch.index;
            const end = start + sqrtMatch[0].length;
            const content = sqrtMatch[1];

            // Check if already inside KaTeX HTML
            const beforeMatch = rendered.substring(0, start);
            const lastKatexStart = beforeMatch.lastIndexOf('<span class="katex">');
            const lastKatexEnd = beforeMatch.lastIndexOf('</span>');

            // Only process if not already inside KaTeX HTML
            if (lastKatexStart <= lastKatexEnd) {
                sqrtReplacements.push({
                    start,
                    end,
                    replacement: safeRenderKatex(`\\sqrt{${content}}`, false, config.katexOptions)
                });
            }
        }

        // Apply replacements from right to left to maintain positions
        sqrtReplacements.reverse().forEach(({ start, end, replacement }) => {
            rendered = rendered.substring(0, start) + replacement + rendered.substring(end);
        });

        // Handle \frac{...}{...} commands
        rendered = rendered.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_match, num, den) => {
            // Simple check: if match contains HTML tags, it's already rendered
            if (_match.includes('<span') || _match.includes('katex')) {
                return _match;
            }
            return safeRenderKatex(`\\frac{${num}}{${den}}`, false, config.katexOptions);
        });

        // Handle \boxed with proper nested brace matching
        // This function finds the matching closing brace for \boxed{...}
        const processBoxed = (text: string): string => {
            let result = '';
            let i = 0;

            while (i < text.length) {
                // Check if we're at the start of \boxed{
                if (text.substring(i).startsWith('\\boxed{')) {
                    // Check if this is already inside rendered KaTeX HTML
                    const beforeMatch = text.substring(0, i);
                    const lastKatexStart = beforeMatch.lastIndexOf('<span class="katex">');
                    const lastKatexEnd = beforeMatch.lastIndexOf('</span>');

                    // If we're inside KaTeX HTML (opened but not closed), skip
                    if (lastKatexStart > lastKatexEnd) {
                        result += text[i];
                        i++;
                        continue;
                    }

                    // Find the matching closing brace
                    let braceCount = 1;
                    let contentStart = i + 7; // Length of '\boxed{'
                    let contentEnd = contentStart;

                    while (braceCount > 0 && contentEnd < text.length) {
                        if (text[contentEnd] === '{') {
                            braceCount++;
                        } else if (text[contentEnd] === '}') {
                            braceCount--;
                        }
                        contentEnd++;
                    }

                    if (braceCount === 0) {
                        // Found matching brace
                        const content = text.substring(contentStart, contentEnd - 1);
                        const cleanContent = content
                            .replace(/<[^>]*>/g, '')
                            .replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1')
                            .trim();
                        result += safeRenderKatex(`\\boxed{${cleanContent}}`, false, config.katexOptions);
                        i = contentEnd; // Move past the closing brace
                    } else {
                        // No matching brace found, just add the character
                        result += text[i];
                        i++;
                    }
                } else {
                    result += text[i];
                    i++;
                }
            }

            return result;
        };

        rendered = processBoxed(rendered);

        // Math symbols and Greek letters
        const symbols = [
            // Operators
            { pattern: /\\cdot/g, latex: '\\cdot' },
            { pattern: /\\times/g, latex: '\\times' },
            { pattern: /\\div/g, latex: '\\div' },
            { pattern: /\\pm/g, latex: '\\pm' },
            { pattern: /\\mp/g, latex: '\\mp' },

            // Relations
            { pattern: /\\leq/g, latex: '\\leq' },
            { pattern: /\\geq/g, latex: '\\geq' },
            { pattern: /\\neq/g, latex: '\\neq' },
            { pattern: /\\approx/g, latex: '\\approx' },
            { pattern: /\\equiv/g, latex: '\\equiv' },
            { pattern: /\\sim/g, latex: '\\sim' },

            // Special symbols
            { pattern: /\\infty/g, latex: '\\infty' },
            { pattern: /\\partial/g, latex: '\\partial' },
            { pattern: /\\nabla/g, latex: '\\nabla' },
            { pattern: /\\emptyset/g, latex: '\\emptyset' },
            { pattern: /\\in/g, latex: '\\in' },
            { pattern: /\\notin/g, latex: '\\notin' },
            { pattern: /\\subset/g, latex: '\\subset' },
            { pattern: /\\supset/g, latex: '\\supset' },
            { pattern: /\\cup/g, latex: '\\cup' },
            { pattern: /\\cap/g, latex: '\\cap' },
            { pattern: /\\rightarrow/g, latex: '\\rightarrow' },
            { pattern: /\\leftarrow/g, latex: '\\leftarrow' },
            { pattern: /\\Rightarrow/g, latex: '\\Rightarrow' },
            { pattern: /\\Leftarrow/g, latex: '\\Leftarrow' },

            // Greek letters (lowercase)
            { pattern: /\\alpha/g, latex: '\\alpha' },
            { pattern: /\\beta/g, latex: '\\beta' },
            { pattern: /\\gamma/g, latex: '\\gamma' },
            { pattern: /\\delta/g, latex: '\\delta' },
            { pattern: /\\epsilon/g, latex: '\\epsilon' },
            { pattern: /\\zeta/g, latex: '\\zeta' },
            { pattern: /\\eta/g, latex: '\\eta' },
            { pattern: /\\theta/g, latex: '\\theta' },
            { pattern: /\\iota/g, latex: '\\iota' },
            { pattern: /\\kappa/g, latex: '\\kappa' },
            { pattern: /\\lambda/g, latex: '\\lambda' },
            { pattern: /\\mu/g, latex: '\\mu' },
            { pattern: /\\nu/g, latex: '\\nu' },
            { pattern: /\\xi/g, latex: '\\xi' },
            { pattern: /\\pi/g, latex: '\\pi' },
            { pattern: /\\rho/g, latex: '\\rho' },
            { pattern: /\\sigma/g, latex: '\\sigma' },
            { pattern: /\\tau/g, latex: '\\tau' },
            { pattern: /\\upsilon/g, latex: '\\upsilon' },
            { pattern: /\\phi/g, latex: '\\phi' },
            { pattern: /\\chi/g, latex: '\\chi' },
            { pattern: /\\psi/g, latex: '\\psi' },
            { pattern: /\\omega/g, latex: '\\omega' },

            // Greek letters (uppercase)
            { pattern: /\\Gamma/g, latex: '\\Gamma' },
            { pattern: /\\Delta/g, latex: '\\Delta' },
            { pattern: /\\Theta/g, latex: '\\Theta' },
            { pattern: /\\Lambda/g, latex: '\\Lambda' },
            { pattern: /\\Xi/g, latex: '\\Xi' },
            { pattern: /\\Pi/g, latex: '\\Pi' },
            { pattern: /\\Sigma/g, latex: '\\Sigma' },
            { pattern: /\\Upsilon/g, latex: '\\Upsilon' },
            { pattern: /\\Phi/g, latex: '\\Phi' },
            { pattern: /\\Psi/g, latex: '\\Psi' },
            { pattern: /\\Omega/g, latex: '\\Omega' },
        ];

        // Process symbols with protection against double-rendering
        symbols.forEach(({ pattern, latex }) => {
            // Use a more careful approach to avoid replacing symbols already inside rendered KaTeX HTML
            let symbolRegex = new RegExp(pattern.source, pattern.flags);
            let symbolMatch;
            const symbolReplacements: Array<{ start: number, end: number, replacement: string }> = [];

            while ((symbolMatch = symbolRegex.exec(rendered)) !== null) {
                const start = symbolMatch.index;
                const end = start + symbolMatch[0].length;

                // Check if already inside KaTeX HTML
                const beforeMatch = rendered.substring(0, start);
                const lastKatexStart = beforeMatch.lastIndexOf('<span class="katex">');
                const lastKatexEnd = beforeMatch.lastIndexOf('</span>');

                // Only process if not already inside KaTeX HTML
                if (lastKatexStart <= lastKatexEnd) {
                    symbolReplacements.push({
                        start,
                        end,
                        replacement: safeRenderKatex(latex, false, config.katexOptions)
                    });
                }
            }

            // Apply replacements from right to left to maintain positions
            symbolReplacements.reverse().forEach(({ start, end, replacement }) => {
                rendered = rendered.substring(0, start) + replacement + rendered.substring(end);
            });
        });

        // Convert derivative placeholders from Stage 3 to actual fractions
        rendered = rendered.replace(/__DERIVATIVE_([a-zA-Z])__/g, (_match, variable) => {
            return safeRenderKatex(`\\frac{d}{d${variable}}`, false, config.katexOptions);
        });

        // Handle standalone d/dx (for any remaining cases not caught by Stage 3)
        rendered = rendered.replace(/\bd\/d([a-zA-Z])\b/g, (_match, variable) => {
            return safeRenderKatex(`\\frac{d}{d${variable}}`, false, config.katexOptions);
        });

        // Handle Unicode superscripts
        rendered = rendered.replace(/([a-zA-Z])([²³⁴⁵⁶⁷⁸⁹⁰¹])/g, (_match, base, sup) => {
            const supMap: { [key: string]: string } = {
                '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6',
                '⁷': '7', '⁸': '8', '⁹': '9', '⁰': '0', '¹': '1'
            };
            return safeRenderKatex(`${base}^{${supMap[sup]}}`, false, config.katexOptions);
        });

        // Handle caret notation
        rendered = rendered.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, (_match, base, exp) => {
            return safeRenderKatex(`${base}^{${exp}}`, false, config.katexOptions);
        });

        rendered = rendered.replace(/([a-zA-Z])\^(\d+|[a-zA-Z])/g, (_match, base, exp) => {
            return safeRenderKatex(`${base}^{${exp}}`, false, config.katexOptions);
        });


        return rendered;
    };

    /**
     * Stage 6.5: Preserve line breaks between consecutive math expressions
     * Converts single newlines between rendered INLINE math expressions to <br> tags
     * Display math blocks (katex-display) already have block-level spacing, so we skip those
     */
    const preserveMathLineBreaks = (text: string): string => {
        let processed = text;

        // We need to avoid adding <br> tags involving display math blocks
        // Display blocks have structure: <span class="katex-display"><span class="katex">...</span></span>
        // Inline blocks have structure: <span class="katex">...</span>

        // Simple approach: Match transitions between math blocks, but skip if either side is display math
        // We match: (end of math) + newlines + (start of math)
        // Then check the surrounding context to determine if it's display or inline

        // Pattern matches: closing </span> tag(s), newlines, and opening <span class="katex...
        // The pattern captures enough to distinguish between inline and display blocks
        processed = processed.replace(
            /(<\/span>(?:<\/span>)?)\s*(\n+)\s*(<span class="katex(?:-display)?\")/g,
            (fullMatch, closing, newlines, opening) => {
                // Determine if we're dealing with display blocks
                // Display block closing: </span></span> (has two closing spans)
                // Display block opening: <span class="katex-display" (contains -display)
                const closingIsDisplay = closing === '</span></span>';
                const openingIsDisplay = opening.includes('katex-display');

                // Only add <br> if BOTH are inline (neither is display)
                if (closingIsDisplay || openingIsDisplay) {
                    return fullMatch; // Keep original - involves display math
                }

                // Both are inline math, add line break
                const newlineCount = newlines.length;

                // If there's exactly one newline, convert it to <br>
                if (newlineCount === 1) {
                    return `${closing}<br>${opening}`;
                }

                // If there are multiple newlines, convert the first to <br> and keep one newline
                return `${closing}<br>\n${opening}`;
            }
        );

        return processed;
    };

    /**
     * Stage 7: Process markdown formatting
     * Uses model-specific markdown processing rules
     */
    const processMarkdown = (text: string): string => {
        const markdownRules = config.markdownProcessing || {};
        let processed = text;

        // CRITICAL FIX: Some models generate headers without proper line breaks
        // Fix headers that appear mid-line by adding line breaks before them
        // Match: (non-whitespace) followed by (space) followed by (### or #### etc.)
        // Replace with: (text) + (newline) + (newline) + (header)
        processed = processed.replace(/(\S)\s+(#{1,6}\s+)/g, '$1\n\n$2');
        
        // Additional fix: Ensure headers start at the beginning of a line
        // This handles cases where headers might have leading whitespace or other issues
        processed = processed.replace(/^(\s*)(#{1,6}\s+)/gm, '$2');

        // CRITICAL: Protect placeholders from markdown processing by temporarily replacing them
        // This prevents bold/italic regex from matching placeholder patterns
        // Use a unique string format that won't be interpreted as HTML or markdown
        // Format: ⟨⟨MDPH_N⟩⟩ using Unicode angle brackets to avoid conflicts
        const placeholderMap = new Map<string, string>();
        let placeholderCounter = 0;

        // IMPORTANT: Protect full list placeholder patterns FIRST (before inline math)
        // This ensures that inline math placeholders INSIDE lists are preserved as part of the list block
        // Pattern: __UL_X__content__/UL__ or __OL_X_Y__content__/OL__ or __TASK_X__content__/TASK__
        let listPlaceholderCount = 0;
        processed = processed.replace(/(__UL_\d+__[\s\S]*?__\/UL__|__OL_\d+_\d+__[\s\S]*?__\/OL__|__TASK_(checked|unchecked)__[\s\S]*?__\/TASK__)/g, (match) => {
            const placeholder = `⟨⟨MDPH_${placeholderCounter}⟩⟩`;
            placeholderMap.set(placeholder, match);
            if (match.startsWith('__OL_')) {
                listPlaceholderCount++;
                console.log(`[processMarkdown] Protecting OL placeholder: ${match.substring(0, 80)}...`);
            }
            placeholderCounter++;
            return placeholder;
        });
        console.log(`[processMarkdown] Protected ${listPlaceholderCount} OL placeholders`);

        // Protect inline math placeholders (outside of lists)
        // These use __INLINE_MATH_X__ format which would be matched by bold regex
        processed = processed.replace(/(__INLINE_MATH_\d+__)/g, (match) => {
            const placeholder = `⟨⟨MDPH_${placeholderCounter}⟩⟩`;
            placeholderMap.set(placeholder, match);
            placeholderCounter++;
            return placeholder;
        });

        // Protect display math placeholders
        processed = processed.replace(/(__DISPLAY_MATH_\d+__)/g, (match) => {
            const placeholder = `⟨⟨MDPH_${placeholderCounter}⟩⟩`;
            placeholderMap.set(placeholder, match);
            placeholderCounter++;
            return placeholder;
        });

        // Protect code block placeholders (__CODE_BLOCK_X__)
        processed = processed.replace(/(__CODE_BLOCK_\d+__)/g, (match) => {
            const placeholder = `⟨⟨MDPH_${placeholderCounter}⟩⟩`;
            placeholderMap.set(placeholder, match);
            placeholderCounter++;
            return placeholder;
        });

        // CRITICAL: Remove model-generated MDPH placeholders BEFORE markdown formatting
        // This prevents them from being wrapped in HTML tags like <strong>((MDPH3))</strong>
        while (processed.includes('((MDPH')) {
            processed = processed.replace(/\(\(MDPH\d+\)\)/g, '');
        }
        while (processed.includes('{{MDPH')) {
            processed = processed.replace(/\{\{MDPH\d+\}\}/g, '');
        }
        processed = processed.replace(/\(MDPH\d+\)/g, '');
        processed = processed.replace(/\{MDPH\d+\}/g, '');
        processed = processed.replace(/\bMDPH\d+\b/g, '');

        // Tables - must come first (if enabled)
        if (markdownRules.processTables !== false) {
            processed = processed.replace(/^\|(.+)\|$/gm, (_match, content) => {
                return '__TABLE_ROW__' + content + '__/TABLE_ROW__';
            });

            // Process table rows and convert to HTML
            processed = processed.replace(/(__TABLE_ROW__[\s\S]*__\/TABLE_ROW__)+/g, (match) => {
                const rows = match.split('__/TABLE_ROW__').filter(row => row.trim());
                let tableHTML = '<table class="markdown-table">';
                let isHeader = true;

                rows.forEach((row, index) => {
                    const cleanRow = row.replace('__TABLE_ROW__', '').trim();
                    // Skip separator rows (like |----|----|)
                    if (cleanRow.match(/^[-|\s:]+$/)) {
                        isHeader = false;
                        return;
                    }

                    const cells = cleanRow.split('|').map(cell => cell.trim()).filter(cell => cell);
                    if (cells.length > 0) {
                        const tag = isHeader ? 'th' : 'td';
                        // Process markdown formatting in each cell before creating HTML
                        const processedCells = cells.map(cell => {
                            let processed = cell;
                            // Process bold and italic (bold first, then italic)
                            processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                            processed = processed.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
                            // Process inline code
                            processed = processed.replace(/`([^`\n]+?)`/g, '<code class="inline-code">$1</code>');
                            return processed;
                        });
                        const rowHTML = '<tr>' + processedCells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
                        tableHTML += rowHTML;
                        if (index === 0) isHeader = false;
                    }
                });

                tableHTML += '</table>';
                return tableHTML;
            });
        }

        // Bold and italic (if enabled, preserve all spaces)
        // Process BEFORE headings and inline code so formatting works correctly
        // IMPORTANT: Process bold/italic BEFORE inline code to handle cases like **bold `code` text**
        if (markdownRules.processBoldItalic !== false) {
            // Bold: match ** but allow single * inside
            // Use a more robust pattern that handles content with HTML tags or other markdown
            processed = processed.replace(/\*\*((?:(?!\*\*)[\s\S])+?)\*\*/g, '<strong>$1</strong>');
            // Bold: match __ but allow single _ inside (underscore-based bold)
            // Note: Placeholders are already protected above, so we can safely process bold here
            processed = processed.replace(/__((?:(?!__)[\s\S])+?)__/g, '<strong>$1</strong>');
            // Italic: match single * but not when part of **
            // Improved regex to handle LaTeX content inside italic (e.g., *text with $math$*)
            // Use a more robust pattern that doesn't break on newlines or special characters
            processed = processed.replace(/(?<!\*)\*((?:(?!\*)[^\n])+?)\*(?!\*)/g, '<em>$1</em>');
            // Italic: match single _ but not when part of __ (underscore-based italic)
            // Use negative lookbehind/lookahead to avoid matching __text__ as _text_
            processed = processed.replace(/(?<!_)_((?:(?!_)[^\n])+?)_(?!_)/g, '<em>$1</em>');
        }

        // Inline code (if enabled)
        // Process AFTER bold/italic so inline code inside bold works correctly
        if (markdownRules.processInlineCode !== false) {
            processed = processed.replace(/`([^`\n]+?)`/g, (_match, content) => {
                // Check if the content is actually LaTeX/math that should be rendered as math, not code
                // Look for LaTeX commands (like \sqrt, \frac, etc.) - this is the primary indicator
                const hasLatexCommands = /\\[a-zA-Z]+\{/.test(content) || /\\(sqrt|frac|cdot|times|pm|neq|leq|geq|alpha|beta|gamma|pi|theta|infty|partial|boxed)/.test(content);

                // Check for math symbols that indicate this is math, not code
                const hasMathSymbols = /[√±×÷≤≥≈∞∑∏∫²³⁴⁵⁶⁷⁸⁹⁰¹]/.test(content);

                // Check if it looks like a mathematical expression (has operators, parentheses, etc.)
                const hasMathOperators = /[=+\-*/()\[\]]/.test(content);
                const hasArithmetic = /\d+\s*[+\-*/]\s*\d+/.test(content);

                // Simple single letters/numbers without math symbols should stay as code
                const isSimpleVariable = /^[a-zA-Z0-9\s,]+$/.test(content.trim()) && !hasMathSymbols && !hasLatexCommands;

                // Only render as math if:
                // 1. It has LaTeX commands (definitely math), OR
                // 2. It has math symbols AND looks like a math expression (has operators or arithmetic)
                const shouldRenderAsMath = hasLatexCommands || (hasMathSymbols && (hasMathOperators || hasArithmetic) && !isSimpleVariable);

                if (shouldRenderAsMath) {
                    // Content inside backticks may not have been processed by fixLatexIssues
                    // So we need to convert Unicode to LaTeX, but be careful to avoid double conversion
                    let mathContent = content.replace(/\$/g, '').trim();

                    // Only convert Unicode if content doesn't already have LaTeX commands
                    // This prevents double conversion if fixLatexIssues already processed it
                    if (!/\\[a-zA-Z]+/.test(mathContent)) {
                        // Convert Unicode square root: √(expr) -> \sqrt{expr} or √123 -> \sqrt{123}
                        mathContent = mathContent.replace(/√\(([^)]+)\)/g, '\\sqrt{$1}');
                        mathContent = mathContent.replace(/√(\d+)/g, '\\sqrt{$1}');
                        mathContent = mathContent.replace(/√([a-zA-Z]+)/g, '\\sqrt{$1}');

                        // Convert Unicode symbols - use single replace to avoid duplication
                        mathContent = mathContent.replace(/±+/g, '\\pm'); // Handle multiple ± as single \pm
                        mathContent = mathContent.replace(/×/g, '\\times');
                        mathContent = mathContent.replace(/÷/g, '\\div');
                        mathContent = mathContent.replace(/≤/g, '\\leq');
                        mathContent = mathContent.replace(/≥/g, '\\geq');
                        mathContent = mathContent.replace(/≈/g, '\\approx');
                        mathContent = mathContent.replace(/∞/g, '\\infty');
                        mathContent = mathContent.replace(/∑/g, '\\sum');
                        mathContent = mathContent.replace(/∏/g, '\\prod');
                        mathContent = mathContent.replace(/∫/g, '\\int');

                        // Convert superscripts - handle potential duplicates
                        mathContent = mathContent.replace(/²+/g, '^2');
                        mathContent = mathContent.replace(/³+/g, '^3');
                        mathContent = mathContent.replace(/⁴+/g, '^4');
                        mathContent = mathContent.replace(/⁵+/g, '^5');
                        mathContent = mathContent.replace(/⁶+/g, '^6');
                        mathContent = mathContent.replace(/⁷+/g, '^7');
                        mathContent = mathContent.replace(/⁸+/g, '^8');
                        mathContent = mathContent.replace(/⁹+/g, '^9');
                        mathContent = mathContent.replace(/⁰+/g, '^0');
                        mathContent = mathContent.replace(/¹+/g, '^1');
                    }

                    if (mathContent) {
                        try {
                            return safeRenderKatex(mathContent, false, config.katexOptions);
                        } catch (e) {
                            // If math rendering fails, fall back to code
                            return `<code class="inline-code">${content}</code>`;
                        }
                    }
                }

                // Otherwise, render as regular inline code
                return `<code class="inline-code">${content}</code>`;
            });
        }

        // Horizontal rules (if enabled)
        if (markdownRules.processHorizontalRules !== false) {
            processed = processed.replace(/^---+\s*$/gm, '<hr class="markdown-hr">\n');
            processed = processed.replace(/^\*\*\*+\s*$/gm, '<hr class="markdown-hr">\n');
            processed = processed.replace(/^___+\s*$/gm, '<hr class="markdown-hr">\n');
        }

        // Headings (if enabled, longest first to avoid partial matches)
        // Process AFTER bold/italic so formatting inside headings is preserved
        if (markdownRules.processHeaders !== false) {
            // More robust header matching: allow trailing whitespace and handle HTML content inside headers
            // Match headers even if they contain HTML tags from previous processing (e.g., <strong> tags)
            // Use . with /s flag equivalent ([^] or [\s\S]) but ensure single-line matching with $
            // The $ anchor ensures we only match headers that end at the line boundary
            // Process from longest to shortest to avoid partial matches (e.g., ### matching before ##)
            // Use a more permissive pattern that handles various edge cases
            processed = processed.replace(/^######\s+([^\n]+?)\s*$/gm, '<h6>$1</h6>');
            processed = processed.replace(/^#####\s+([^\n]+?)\s*$/gm, '<h5>$1</h5>');
            processed = processed.replace(/^####\s+([^\n]+?)\s*$/gm, '<h4>$1</h4>');
            processed = processed.replace(/^###\s+([^\n]+?)\s*$/gm, '<h3>$1</h3>');
            processed = processed.replace(/^##\s+([^\n]+?)\s*$/gm, '<h2>$1</h2>');
            processed = processed.replace(/^#\s+([^\n]+?)\s*$/gm, '<h1>$1</h1>');
            
            // Fallback: Remove any remaining header markers that weren't matched by the above patterns
            // This catches edge cases where headers might not have matched due to formatting issues
            // Only remove if they're at the start of a line and followed by a space (to avoid false positives)
            // This ensures that even if header conversion failed, at least the raw markdown won't show
            processed = processed.replace(/^######\s+/gm, '');
            processed = processed.replace(/^#####\s+/gm, '');
            processed = processed.replace(/^####\s+/gm, '');
            processed = processed.replace(/^###\s+/gm, '');
            processed = processed.replace(/^##\s+/gm, '');
            processed = processed.replace(/^#\s+/gm, '');
        }

        // Strikethrough
        processed = processed.replace(/~~([^~]+?)~~/g, '<del class="markdown-strikethrough">$1</del>');

        // Reference-style links
        const referenceMap: { [key: string]: string } = {};
        processed = processed.replace(/^\[([^\]]+)\]:\s*(.+)$/gm, (_, ref, url) => {
            referenceMap[ref.toLowerCase()] = url.trim();
            return '';
        });

        // Links (both inline and reference-style, if enabled)
        if (markdownRules.processLinks !== false) {
            processed = processed.replace(/\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (_, text, url, title) => {
                const titleAttr = title ? ` title="${title}"` : '';
                return `<a href="${url}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
            });

            // Reference-style links
            processed = processed.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (match, text, ref) => {
                const reference = ref || text.toLowerCase();
                const url = referenceMap[reference];
                if (url) {
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                }
                return match;
            });

            // Fix broken links (if enabled)
            if (markdownRules.fixBrokenLinks) {
                // Try to fix common broken link patterns
                processed = processed.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (match, text, url) => {
                    if (!url || url.trim() === '') {
                        // If URL is empty, try to create a link from the text
                        if (text.match(/^https?:\/\//)) {
                            return `<a href="${text}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                        }
                    }
                    return match;
                });
            }
        }

        // Images - with lazy loading and optimization
        processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
            const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
            // Add lazy loading and optimization attributes
            // For external images, use basic lazy loading
            // For internal images, vite-imagetools will handle optimization
            const isExternal = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
            const loadingAttr = isExternal ? 'loading="lazy"' : 'loading="lazy"';
            const decodingAttr = 'decoding="async"';
            const styleAttr = 'style="max-width: 100%; height: auto; transition: opacity 0.3s ease-in-out;"';

            // For internal images, add optimization query params if not already present
            let optimizedUrl = url;
            if (!isExternal && !url.includes('?')) {
                // Add width hint for optimization (vite-imagetools will process this)
                optimizedUrl = `${url}?w=1024&q=80`;
            }

            return `<img src="${optimizedUrl}" alt="${alt.replace(/"/g, '&quot;')}"${titleAttr} ${loadingAttr} ${decodingAttr} ${styleAttr} />`;
        });

        // Restore protected placeholders after all markdown processing
        // Use simple string replacement for reliability (placeholders are unique)
        let restoredOLCount = 0;
        // Sort placeholders by index (descending) to avoid conflicts when restoring
        const sortedPlaceholders = Array.from(placeholderMap.entries()).sort((a, b) => {
            // Extract numeric index from placeholder (e.g., "⟨⟨MDPH_5⟩⟩" -> 5)
            const getIndex = (ph: string) => {
                const match = ph.match(/MDPH_(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            };
            return getIndex(b[0]) - getIndex(a[0]); // Descending order
        });

        sortedPlaceholders.forEach(([placeholder, original]) => {
            // Use split/join for reliable replacement that handles all special characters
            const beforeLength = processed.length;
            const countBefore = (processed.match(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

            if (original.startsWith('__OL_')) {
                restoredOLCount++;
                console.log(`[processMarkdown] Restoring OL - Placeholder: "${placeholder}" found ${countBefore} times`);
                if (countBefore === 0) {
                    console.log(`[processMarkdown] ERROR: Placeholder not found in processed text!`);
                    console.log(`[processMarkdown] Sample of processed text:`, processed.substring(0, 200));
                }
            }

            // Escape the placeholder for regex replacement
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            processed = processed.replace(new RegExp(escapedPlaceholder, 'g'), original);

            const afterLength = processed.length;
            if (original.startsWith('__OL_') && afterLength === beforeLength && countBefore > 0) {
                console.log(`[processMarkdown] WARNING: No change in length after restoration - placeholder not replaced!`);
            }
        });
        console.log(`[processMarkdown] Restored ${restoredOLCount} OL placeholders`);
        console.log(`[processMarkdown] Output contains __OL_: ${processed.includes('__OL_')}`);

        // Final safety check: remove any remaining placeholders that weren't restored
        // This handles edge cases where placeholders might have been missed
        const remainingPlaceholders = processed.match(/⟨⟨MDPH_\d+⟩⟩/g);
        if (remainingPlaceholders && remainingPlaceholders.length > 0) {
            console.warn(`[processMarkdown] WARNING: Found ${remainingPlaceholders.length} unrecovered placeholders:`, remainingPlaceholders);
            // Log the context around each placeholder for debugging
            remainingPlaceholders.forEach(ph => {
                const index = processed.indexOf(ph);
                if (index !== -1) {
                    const context = processed.substring(Math.max(0, index - 50), Math.min(processed.length, index + ph.length + 50));
                    console.warn(`[processMarkdown] Context: ...${context}...`);
                }
            });
            // Remove unrecovered placeholders to prevent them from appearing in output
            processed = processed.replace(/⟨⟨MDPH_\d+⟩⟩/g, '');
        }

        // CRITICAL: Remove model-generated MDPH placeholders even if they're inside HTML tags
        // This catches placeholders that got wrapped in markdown formatting like **((MDPH3))**
        // Remove all variations aggressively, even inside HTML tags
        // Also handle corrupted formats like <<MDPH (from Unicode angle brackets ⟨⟨)
        while (processed.includes('((MDPH')) {
            processed = processed.replace(/\(\(MDPH\d+\)\)/g, '');
        }
        while (processed.includes('{{MDPH')) {
            processed = processed.replace(/\{\{MDPH\d+\}\}/g, '');
        }
        // Handle corrupted Unicode angle bracket format: <<MDPH (should be ⟨⟨MDPH)
        while (processed.includes('<<MDPH')) {
            processed = processed.replace(/<<MDPH\d+[^>]*>>?/g, '');
            processed = processed.replace(/<<MDPH\d+\)\)/g, '');
        }
        processed = processed.replace(/\(MDPH\d+\)/g, '');
        processed = processed.replace(/\{MDPH\d+\}/g, '');
        processed = processed.replace(/\bMDPH\d+\b/g, '');

        return processed;
    };

    /**
     * Stage 8: Convert markdown list placeholders to HTML
     */
    const convertListsToHTML = (text: string): string => {
        console.log('[convertListsToHTML] Input has __OL_:', text.includes('__OL_'));
        console.log('[convertListsToHTML] Input has ⟨⟨MDPH:', text.includes('⟨⟨MDPH'));
        if (text.includes('⟨⟨MDPH')) {
            const mdphIndex = text.indexOf('⟨⟨MDPH');
            console.log('[convertListsToHTML] Sample with MDPH:', text.substring(mdphIndex - 50, mdphIndex + 100));
            console.warn('[convertListsToHTML] ERROR: Found unrecovered placeholders! These should have been restored in processMarkdown.');
            // Remove any remaining placeholders to prevent them from appearing in output
            // This is a safety fallback - ideally these should never reach this stage
            text = text.replace(/⟨⟨MDPH_\d+⟩⟩/g, '');
        }
        let converted = text;

        // Task lists
        converted = converted.replace(/(__TASK_(checked|unchecked)__[\s\S]*?__\/TASK__)+/g, (match) => {
            const items = match.replace(/__TASK_(checked|unchecked)__([\s\S]*?)__\/TASK__/g, (_, checked, text) => {
                const checkedAttr = checked === 'checked' ? 'checked' : '';
                return `<li class="task-list-item"><input type="checkbox" ${checkedAttr} disabled> ${text}</li>`;
            });
            return `<ul class="task-list">${items}</ul>`;
        });

        // Unordered lists
        converted = converted.replace(/(__UL_[\s\S]*?__\/UL__\s*)+/g, (match) => {
            const items: { level: number; content: string }[] = [];
            const regex = /__UL_(\d+)__([\s\S]*?)__\/UL__/g;
            let m;

            while ((m = regex.exec(match)) !== null) {
                items.push({ level: parseInt(m[1]), content: m[2].trim() });
            }

            if (items.length === 0) return match;

            // Normalize levels
            const minLevel = Math.min(...items.map(i => i.level));
            items.forEach(i => i.level -= minLevel);

            let html = '<ul>';
            let currentLevel = 0;
            const openListItems: boolean[] = []; // Track open <li> tags

            items.forEach((item, index) => {
                const nextLevel = index < items.length - 1 ? items[index + 1].level : 0;

                // Close deeper levels
                while (currentLevel > item.level) {
                    html += '</ul>';
                    if (openListItems.length > 0) {
                        html += '</li>';  // Close the parent <li> that contained the nested <ul>
                        openListItems.pop();
                    }
                    currentLevel--;
                }

                // Open new item at current level
                html += `<li>${item.content}`;

                // If next item is nested deeper, start a nested list
                if (nextLevel > item.level) {
                    html += '<ul>';
                    currentLevel++;
                    openListItems.push(true);
                } else {
                    // Close the current list item
                    html += '</li>';
                }
            });

            // Close any remaining open tags
            while (currentLevel > 0) {
                html += '</ul>';
                if (openListItems.length > 0) {
                    html += '</li>';
                    openListItems.pop();
                }
                currentLevel--;
            }
            html += '</ul>';

            return html;
        });

        // Ordered lists - match and convert each placeholder individually first
        // Then group consecutive ones if needed
        converted = converted.replace(/__OL_(\d+)_(\d+)__([\s\S]*?)__\/OL__/g, (_fullMatch, _level, num, content) => {
            // Convert each item individually with its number
            return `<ol><li value="${num}">${content.trim()}</li></ol>`;
        });

        // Merge consecutive <ol> tags (cleanup pass)
        converted = converted.replace(/<\/ol>\s*<ol>/g, '');

        // Handle model-generated placeholders in format ((MDPH...)) or {{MDPH...}}
        // These placeholders appear when models output placeholders for list items
        // Be very aggressive - catch all variations and concatenated placeholders
        // Handle double parentheses format: ((MDPH3)) - remove all occurrences, even concatenated
        while (converted.includes('((MDPH')) {
            converted = converted.replace(/\(\(MDPH\d+\)\)/g, '');
        }
        // Handle curly braces format: {{MDPH3}} - remove all occurrences, even concatenated
        while (converted.includes('{{MDPH')) {
            converted = converted.replace(/\{\{MDPH\d+\}\}/g, '');
        }
        // Handle single parentheses/braces as fallback
        converted = converted.replace(/\(MDPH\d+\)/g, '');
        converted = converted.replace(/\{MDPH\d+\}/g, '');
        // Remove any trailing --- that might follow placeholders
        converted = converted.replace(/\s*---+\s*/g, ' ');

        return converted;
    };

    /**
     * Stage 9: Apply paragraph breaks
     */
    const applyParagraphBreaks = (text: string): string => {
        let processed = text;

        // Line breaks
        processed = processed.replace(/ {2}\n/g, '<br>');

        // Paragraph breaks
        processed = processed.replace(/\n\n/g, '</p><p>');

        // CRITICAL: Remove paragraph tags that wrap block-level elements
        // Block-level elements (hr, headings, lists, etc.) should never be inside <p> tags
        // Apply patterns multiple times to catch nested cases and ensure all block-level elements are free
        
        // Repeat the cleanup until no more changes occur (handles nested/overlapping cases)
        let previousLength = 0;
        while (previousLength !== processed.length) {
            previousLength = processed.length;
            
            // Pattern 1: Remove <p> that opens before a block-level element
            // Matches: <p>...<hr> or <p>...<h3> etc. (with optional whitespace)
            processed = processed.replace(/<p>(\s*<(hr|h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*(\/)?>)/gi, '$1');
            
            // Pattern 2: Remove </p><p> that wraps block-level elements
            // Matches: </p><p><h3> or </p><p><hr> etc. (with optional whitespace)
            processed = processed.replace(/(<\/p><p>)(\s*<(hr|h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*(\/)?>)/gi, '</p>$2');
            
            // Pattern 3: Remove </p> that closes after a block-level element
            // Matches: <hr></p> or <h3>...</h3></p> etc. (with optional whitespace)
            processed = processed.replace(/(<(hr|h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*(\/)?>|<\/(h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*>)\s*<\/p>/gi, '$1');
            
            // Pattern 4: Remove paragraph tags between block-level elements
            // Matches: <hr></p><p><h3> or <h3>...</h3></p><p><h4> etc.
            processed = processed.replace(/(<(hr|h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*(\/)?>|<\/(h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*>)\s*<\/p><p>\s*(<(h[1-6]|ul|ol|blockquote|pre|table|div|hr)[^>]*(\/)?>)/gi, '$1$4');
            
            // Pattern 5: Remove orphaned </p> or <p> tags that are adjacent to block-level elements
            // Matches: </p><hr> or <hr><p> etc.
            processed = processed.replace(/<\/p>\s*(<(hr|h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*(\/)?>)/gi, '$1');
            processed = processed.replace(/(<(hr|h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*(\/)?>|<\/(h[1-6]|ul|ol|blockquote|pre|table|div)[^>]*>)\s*<p>/gi, '$1');
        }

        // Wrap in paragraphs if needed (only if content doesn't start with a block-level element)
        if (processed.includes('</p><p>') && !processed.match(/^<(h[1-6]|ul|ol|blockquote|pre|table|div|hr)/)) {
            processed = `<p>${processed}</p>`;
        }

        return processed;
    };

    /**
     * Main rendering pipeline
     * Uses model-specific configurations and code block preservation utilities
     */
    const renderLatex = (text: string): string => {
        try {
            let processed = text;

            // Stage 0: Extract code blocks FIRST (before math extraction)
            // This ensures code blocks are preserved and prevents math extraction from matching $$ inside code
            const codeBlockExtraction = extractCodeBlocks(processed);
            processed = codeBlockExtraction.text;

            // Stage 0.5: Extract display math blocks BEFORE any processing
            // This protects math content from being modified by preprocessing stages
            const displayMathExtraction = extractDisplayMath(processed);
            processed = displayMathExtraction.text;

            // Stage 0.6: Extract inline math blocks BEFORE any processing
            // This protects inline math content from being modified by preprocessing stages
            const inlineMathExtraction = extractInlineMath(processed);
            processed = inlineMathExtraction.text;

            // Stage 2: Clean malformed content (using model-specific preprocessing)
            processed = cleanMalformedContent(processed);

            // Stage 3: Fix LaTeX issues
            processed = fixLatexIssues(processed);

            // Stage 4: Convert implicit math notation
            processed = convertImplicitMath(processed);

            // Stage 5: Process markdown lists
            // Note: Inline math placeholders are kept intact inside list placeholders
            processed = processMarkdownLists(processed);

            // Stage 5.5: Restore display math blocks before rendering
            // This ensures the original math content is available for rendering
            processed = restoreDisplayMath(processed, displayMathExtraction.mathBlocks);

            // Stage 5.6: Restore inline math blocks before rendering
            // This ensures the original inline math content is available for rendering
            // IMPORTANT: Skip restoring inline math inside list placeholders to preserve placeholder structure
            processed = restoreInlineMath(processed, inlineMathExtraction.mathBlocks, true);

            // Stage 6: Render math content (using model-specific delimiters and KaTeX options)
            processed = renderMathContent(processed);

            // Stage 6.5: Preserve line breaks between consecutive math expressions
            processed = preserveMathLineBreaks(processed);

            // Stage 7: Process markdown formatting (using model-specific rules)
            processed = processMarkdown(processed);

            // Stage 7.5: Remove any MDPH placeholders that survived markdown processing
            // This is critical because placeholders might be inside HTML tags from markdown formatting
            while (processed.includes('((MDPH')) {
                processed = processed.replace(/\(\(MDPH\d+\)\)/g, '');
            }
            while (processed.includes('{{MDPH')) {
                processed = processed.replace(/\{\{MDPH\d+\}\}/g, '');
            }
            processed = processed.replace(/\(MDPH\d+\)/g, '');
            processed = processed.replace(/\{MDPH\d+\}/g, '');
            processed = processed.replace(/\bMDPH\d+\b/g, '');

            // Stage 8: Convert lists to HTML
            processed = convertListsToHTML(processed);

            // Stage 8.3: Restore display math placeholders that might be inside converted list HTML
            // This handles cases where display math placeholders were inside list items
            // and weren't restored in Stage 5.5 because they were hidden inside list placeholders
            processed = restoreDisplayMath(processed, displayMathExtraction.mathBlocks);

            // Stage 8.4: Render display math that was restored in Stage 8.3
            // Display math blocks restored here need to be rendered since they weren't rendered in Stage 6
            const displayDelimiters = [...config.displayMathDelimiters].sort((a, b) => {
                const priorityA = a.priority ?? 999;
                const priorityB = b.priority ?? 999;
                return priorityA - priorityB;
            });
            displayDelimiters.forEach(({ pattern }) => {
                processed = processed.replace(pattern, (_match, math) => {
                    // Check if already rendered
                    if (_match.includes('<span class="katex">')) {
                        return _match;
                    }
                    return safeRenderKatex(math, true, config.katexOptions);
                });
            });

            // Stage 8.5: Restore and render any inline math placeholders that were nested inside list placeholders
            // This handles cases where inline math placeholders were inside list items
            // and weren't restored in Stage 5.6 because they were hidden inside list placeholders
            processed = restoreInlineMath(processed, inlineMathExtraction.mathBlocks);

            // Render the restored inline math (using model-specific delimiters)
            const inlineDelimiters = [...config.inlineMathDelimiters].sort((a, b) => {
                const priorityA = a.priority ?? 999;
                const priorityB = b.priority ?? 999;
                return priorityA - priorityB;
            });
            inlineDelimiters.forEach(({ pattern }) => {
                processed = processed.replace(pattern, (_match, math) => {
                    // Check if already rendered
                    if (_match.includes('<span class="katex">')) {
                        return _match;
                    }
                    return safeRenderKatex(math, false, config.katexOptions);
                });
            });

            // Stage 9: Apply paragraph breaks
            processed = applyParagraphBreaks(processed);

            // Stage 10: Restore code blocks from placeholders
            // restoreCodeBlocks returns markdown format, so we need to render them
            processed = restoreCodeBlocks(processed, codeBlockExtraction);

            // Render restored code blocks to HTML
            // Match code blocks in markdown format: ```language\ncontent\n```
            processed = processed.replace(/```([a-zA-Z0-9+#-]*)\n?([\s\S]*?)```/g, (_match, language, code) => {
                return renderCodeBlock(language || 'plaintext', code);
            });

            // Apply post-processing if configured
            if (config.postProcessing) {
                for (const postProcessor of config.postProcessing) {
                    processed = postProcessor(processed);
                }
            }

            // Final cleanup - handle any remaining inline math placeholders
            // This catches placeholders that might have been missed or had underscores removed by markdown processing
            // First, try to restore standard format placeholders: __INLINE_MATH_X__
            processed = restoreInlineMath(processed, inlineMathExtraction.mathBlocks);

            // Render any restored inline math that might have been restored above
            // Reuse inlineDelimiters from Stage 8.5
            inlineDelimiters.forEach(({ pattern }) => {
                processed = processed.replace(pattern, (_match, math) => {
                    // Check if already rendered
                    if (_match.includes('<span class="katex">')) {
                        return _match;
                    }
                    return safeRenderKatex(math, false, config.katexOptions);
                });
            });

            // Then check for any remaining placeholders in various formats
            // Check for both formats: __INLINE_MATH_X__ and INLINEMATHX (without underscores, possibly from bold processing)
            const remainingInlineMathRegex = /(?:__)?INLINE[_\s]*MATH[_\s]*(\d+)(?:__)?/gi;
            processed = processed.replace(remainingInlineMathRegex, (_match, index) => {
                const blockIndex = parseInt(index, 10);
                if (blockIndex >= 0 && blockIndex < inlineMathExtraction.mathBlocks.length) {
                    // Restore the original math block and render it
                    const mathBlock = inlineMathExtraction.mathBlocks[blockIndex];
                    // The mathBlock contains the full match with delimiters (e.g., "$x^2$" or "\\(x^2\\)")
                    // Try to extract math content by matching against known delimiter patterns
                    for (const { pattern } of inlineDelimiters) {
                        const match = mathBlock.match(pattern);
                        if (match && match[1]) {
                            // Extract the math content (group 1 contains the math without delimiters)
                            return safeRenderKatex(match[1], false, config.katexOptions);
                        }
                    }

                    // Fallback: try to extract math content by removing common delimiters
                    // Remove dollar signs, backslashes with parens/brackets
                    let cleaned = mathBlock.trim();
                    // Remove dollar sign delimiters
                    cleaned = cleaned.replace(/^\$\$?|\$\$?$/g, '');
                    // Remove \( and \) delimiters
                    cleaned = cleaned.replace(/^\\\(|\\\)$/g, '');
                    // Remove \[ and \] delimiters  
                    cleaned = cleaned.replace(/^\\\[|\\\]$/g, '');
                    cleaned = cleaned.trim();

                    if (cleaned) {
                        return safeRenderKatex(cleaned, false, config.katexOptions);
                    }
                }
                // If index is invalid, remove the placeholder
                return '';
            });

            // Final cleanup - only unescape markdown characters, not LaTeX commands
            // Don't remove backslashes that are part of LaTeX commands
            processed = processed.replace(/\\([`*_#+\-.!|])/g, '$1');
            // Note: DO NOT remove \( and \) here as they should have been processed as math delimiters
            // If they're still present, it means they weren't recognized as math and should remain as-is
            // or be handled by the implicit math detection in earlier stages

            // Final aggressive cleanup: Remove ANY remaining MDPH or internal placeholders
            // This catches placeholders that might have escaped earlier stages

            // Remove model-generated MDPH placeholders in various formats
            // Handle all variations: ((MDPHx)), {{MDPHx}}, (MDPHx), {MDPHx}, MDPHx
            // Also handle corrupted formats like <<MDPH (from Unicode angle brackets ⟨⟨)
            processed = processed.replace(/\(\(MDPH\d+\)\)/g, '');
            processed = processed.replace(/\{\{MDPH\d+\}\}/g, '');
            // Handle corrupted Unicode angle bracket format: <<MDPH (should be ⟨⟨MDPH)
            while (processed.includes('<<MDPH')) {
                processed = processed.replace(/<<MDPH\d+[^>]*>>?/g, '');
                processed = processed.replace(/<<MDPH\d+\)\)/g, '');
                processed = processed.replace(/<<MDPH\d+\(\(/g, '');
            }
            processed = processed.replace(/\(MDPH\d+\)/g, '');
            processed = processed.replace(/\{MDPH\d+\}/g, '');
            processed = processed.replace(/\bMDPH\d+\b/g, '');

            // Remove internal Unicode placeholder format (⟨⟨MDPH_X⟩⟩) if any leaked
            processed = processed.replace(/⟨⟨MDPH_\d+⟩⟩/g, '');

            // Final attempt to restore any remaining placeholders before removing them
            // This handles cases where placeholders might have been missed in earlier stages
            processed = restoreDisplayMath(processed, displayMathExtraction.mathBlocks);
            processed = restoreInlineMath(processed, inlineMathExtraction.mathBlocks);
            
            // Render any restored math placeholders
            displayDelimiters.forEach(({ pattern }) => {
                processed = processed.replace(pattern, (_match, math) => {
                    if (_match.includes('<span class="katex">')) {
                        return _match;
                    }
                    return safeRenderKatex(math, true, config.katexOptions);
                });
            });
            inlineDelimiters.forEach(({ pattern }) => {
                processed = processed.replace(pattern, (_match, math) => {
                    if (_match.includes('<span class="katex">')) {
                        return _match;
                    }
                    return safeRenderKatex(math, false, config.katexOptions);
                });
            });
            
            // Only remove placeholders that couldn't be restored (orphaned placeholders)
            // Check if placeholder indices are valid before removing
            processed = processed.replace(/__INLINE_MATH_(\d+)__/g, (_match, index) => {
                const blockIndex = parseInt(index, 10);
                if (blockIndex >= 0 && blockIndex < inlineMathExtraction.mathBlocks.length) {
                    // This placeholder should have been restored - try one more time
                    const mathBlock = inlineMathExtraction.mathBlocks[blockIndex];
                    for (const { pattern } of inlineDelimiters) {
                        const match = mathBlock.match(pattern);
                        if (match && match[1]) {
                            return safeRenderKatex(match[1], false, config.katexOptions);
                        }
                    }
                    // Fallback: extract math content manually
                    let cleaned = mathBlock.trim();
                    cleaned = cleaned.replace(/^\$\$?|\$\$?$/g, '');
                    cleaned = cleaned.replace(/^\\\(|\\\)$/g, '');
                    cleaned = cleaned.replace(/^\\\[|\\\]$/g, '');
                    if (cleaned) {
                        return safeRenderKatex(cleaned.trim(), false, config.katexOptions);
                    }
                }
                // Invalid index - remove the placeholder
                return '';
            });
            
            processed = processed.replace(/__DISPLAY_MATH_(\d+)__/g, (_match, index) => {
                const blockIndex = parseInt(index, 10);
                if (blockIndex >= 0 && blockIndex < displayMathExtraction.mathBlocks.length) {
                    // This placeholder should have been restored - try one more time
                    const mathBlock = displayMathExtraction.mathBlocks[blockIndex];
                    for (const { pattern } of displayDelimiters) {
                        const match = mathBlock.match(pattern);
                        if (match && match[1]) {
                            return safeRenderKatex(match[1], true, config.katexOptions);
                        }
                    }
                    // Fallback: extract math content manually
                    let cleaned = mathBlock.trim();
                    cleaned = cleaned.replace(/^\$\$|\$\$$/g, '');
                    cleaned = cleaned.replace(/^\\\[|\\\]$/g, '');
                    if (cleaned) {
                        return safeRenderKatex(cleaned.trim(), true, config.katexOptions);
                    }
                }
                // Invalid index - remove the placeholder
                return '';
            });
            
            processed = processed.replace(/__CODE_BLOCK_\d+__/g, '');

            // Remove any malformed placeholder variations (case insensitive)
            processed = processed.replace(/\b(?:INLINE|DISPLAY)[_\s]*MATH[_\s]*\d+\b/gi, '');

            // Final cleanup: Remove any remaining markdown header markers that weren't converted
            // This is a safety net to ensure headers don't show up as raw markdown in the output
            // Only match at the start of a line to avoid false positives
            processed = processed.replace(/^######\s+/gm, '');
            processed = processed.replace(/^#####\s+/gm, '');
            processed = processed.replace(/^####\s+/gm, '');
            processed = processed.replace(/^###\s+/gm, '');
            processed = processed.replace(/^##\s+/gm, '');
            processed = processed.replace(/^#\s+/gm, '');

            return processed;

        } catch (error) {
            console.error('❌ Critical error in renderLatex:', error);
            return `<div style="color: red; padding: 10px; border: 1px solid red;">
                <strong>Rendering Error:</strong> ${error instanceof Error ? error.message : String(error)}
                <pre style="margin-top: 10px; padding: 10px; background: #f5f5f5;">${text.substring(0, 500)}</pre>
            </div>`;
        }
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    const contentRef = useRef<HTMLDivElement>(null);
    const processedContent = useMemo(() => renderLatex(children), [children, modelId]);

    // Apply Prism highlighting after content is rendered
    useEffect(() => {
        // Wait for Prism to be fully loaded and DOM to be ready
        const highlightCode = () => {
            if (!contentRef.current) return;

            // Check if Prism is available and properly initialized
            if (typeof Prism === 'undefined' || !Prism.highlightAllUnder || !Prism.languages) {
                console.warn('Prism.js not ready, skipping syntax highlighting');
                return;
            }

            try {
                // Only highlight if we have code elements
                const codeElements = contentRef.current.querySelectorAll('code[class*="language-"]');
                if (codeElements.length > 0) {
                    Prism.highlightAllUnder(contentRef.current);
                }
            } catch (error) {
                console.warn('Prism.js highlighting failed:', error);
            }
        };

        // Try immediately, then retry if needed
        highlightCode();

        // Retry after a delay if Prism might still be loading
        const timer = setTimeout(highlightCode, 200);

        return () => clearTimeout(timer);
    }, [children]);

    return (
        <div
            ref={contentRef}
            className={`latex-content ${className}`}
            dangerouslySetInnerHTML={{ __html: processedContent }}
            style={{
                whiteSpace: 'normal',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
                overflow: 'hidden'
            }}
        />
    );
};

export default LatexRenderer;
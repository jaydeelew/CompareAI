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
 * 7. Process markdown formatting (bold, italic, links, etc.)
 * 8. Convert list placeholders to HTML
 * 9. Apply paragraph breaks
 * 10. Restore code blocks and final cleanup
 */

import React from 'react';
import katex from 'katex';

interface LatexRendererProps {
    children: string;
    className?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// KaTeX configuration with permissive options for handling various AI model outputs
const KATEX_OPTIONS = {
    throwOnError: false,
    strict: false,
    trust: (context: { command?: string }) => ['\\url', '\\href', '\\includegraphics'].includes(context.command || ''),
    macros: {
        '\\eqref': '\\href{###1}{(\\text{#1})}',
    },
    maxSize: 500,
    maxExpand: 1000,
};

// Unified delimiter patterns for math expressions
const MATH_DELIMITERS = {
    display: [
        // eslint-disable-next-line no-useless-escape
        { pattern: /\$\$([^\$]+?)\$\$/gs, name: 'double-dollar' },
        { pattern: /\\\[\s*([\s\S]*?)\s*\\\]/g, name: 'bracket' },
    ],
    inline: [
        // eslint-disable-next-line no-useless-escape
        { pattern: /(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, name: 'single-dollar' },
        { pattern: /\\\(\s*([^\\]*?)\s*\\\)/g, name: 'paren' },
    ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Safely render LaTeX with KaTeX with error handling
 */
const safeRenderKatex = (latex: string, displayMode: boolean): string => {
    try {
        const cleanLatex = latex.trim()
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/style="[^"]*"/g, ''); // Remove style attributes
        
        if (!cleanLatex) return '';
        
        return katex.renderToString(cleanLatex, {
            ...KATEX_OPTIONS,
            displayMode,
        });
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
    if (/^(where|note|for example|i\.e\.|e\.g\.|etc\.|see|vs\.|antiderivative|a constant)/i.test(content)) {
        return true;
    }
    
    // Many words without math
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 15 && !looksMathematical(content)) return true;
    
    return false;
};

const LatexRenderer: React.FC<LatexRendererProps> = ({ children, className = '' }) => {
    
    // ============================================================================
    // PREPROCESSING PIPELINE
    // ============================================================================
    
    /**
     * Stage 1: Clean malformed content (MathML, SVG, KaTeX artifacts)
     */
    const cleanMalformedContent = (text: string): string => {
        let cleaned = text;

        // Remove malformed KaTeX/MathML markup
        cleaned = cleaned.replace(/<\s*spanclass\s*=\s*["']katex[^"']*["'][^>]*>/gi, '');
        cleaned = cleaned.replace(/spanclass/gi, '');
        cleaned = cleaned.replace(/mathxmlns/gi, '');
        cleaned = cleaned.replace(/annotationencoding/gi, '');

        // Remove MathML blocks
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

        // Remove SVG content
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

        // Handle content in parentheses with spaces: ( math content )
        converted = converted.replace(/\(\s+((?:[^()]|\([^()]*\))+?)\s+\)/g, (_match, content) => {
            if (looksMathematical(content) && !looksProse(content)) {
                return `\\(${content.trim()}\\)`;
            }
            return _match;
        });

        // Handle content in square brackets with spaces: [ math content ]
        converted = converted.replace(/\[\s+((?:[^[\]]|\[[^\]]*\])+?)\s+\]/g, (_match, content) => {
            if (content.includes('\\boxed')) return _match; // Already handled
            if (looksMathematical(content) && !looksProse(content)) {
                return `\\(${content.trim()}\\)`;
            }
            return _match;
        });

        // Handle simple parentheses (not function calls)
        converted = converted.replace(/(?<![a-zA-Z])\(([^()]+)\)/g, (_match, content) => {
            if (_match.includes('\\(') || content.includes('\\boxed')) return _match;
            if (content.match(/^(a|an)\s+/i)) return _match; // Prose
            
            const trimmed = content.trim();
            
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
     * Stage 4: Preserve code blocks
     */
    const preserveCodeBlocks = (text: string): { text: string; blocks: string[] } => {
        const blocks: string[] = [];
        
        const processed = text.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (_, language, code) => {
            const lang = language || 'text';
            const highlightedCode = code.replace(/\n$/, '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/^( +)/gm, (_match: string) => '&nbsp;'.repeat(_match.length));

            const codeBlockHTML = `
                <div class="code-block-direct" data-language="${lang}" style="
                    background: #0d1117;
                    border: 1px solid #30363d;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    overflow-x: auto;
                    font-size: 14px;
                    line-height: 1.5;
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                ">
                    <pre style="margin: 0; white-space: pre; word-wrap: normal; overflow-wrap: normal;">
                        <code style="
                            background: transparent;
                            padding: 0;
                            font-family: inherit;
                            font-size: inherit;
                            line-height: inherit;
                            color: #e6edf3;
                            white-space: pre;
                            word-wrap: normal;
                            overflow-wrap: normal;
                            display: block;
                        ">${highlightedCode}</code>
                    </pre>
                </div>
            `;

            blocks.push(codeBlockHTML);
            return `__CODE_BLOCK_${blocks.length - 1}__`;
        });

        return { text: processed, blocks };
    };

    /**
     * Stage 5: Process markdown lists
     */
    const processMarkdownLists = (text: string): string => {
        console.log('🔍 Raw text before list processing (first 1000 chars):', text.substring(0, 1000));
        let processed = text;

        // Helper function to process parentheses in list content
        const processListContent = (content: string): string => {
            return convertImplicitMath(content);
        };

        // Task lists
        processed = processed.replace(/^- \[([ x])\] (.+)$/gm, (_, checked, text) => {
            const isChecked = checked === 'x';
            const processedText = processListContent(text);
            return `__TASK_${isChecked ? 'checked' : 'unchecked'}__${processedText}__/TASK__`;
        });

        // Unordered lists
        processed = processed.replace(/^(\s*)- (?!\[[ x]\])(.+)$/gm, (_, indent, content) => {
            const level = indent.length;
            console.log(`📌 List item: level=${level}, indent="${indent}", content="${content.substring(0, 50)}..."`);
            const processedContent = processListContent(content);
            return `__UL_${level}__${processedContent}__/UL__`;
        });

        // Ordered lists - capture indent level for nesting
        processed = processed.replace(/^(\s*)(\d+)\. (.+)$/gm, (_, indent, num, content) => {
            const level = indent.length;
            console.log(`🔢 OL match: indent="${indent}", level=${level}, num=${num}, content="${content.substring(0, 50)}"`);
            const processedContent = processListContent(content);
            return `__OL_${level}__${processedContent}__/OL__`;
        });

        return processed;
    };

    /**
     * Stage 6: Normalize and render math delimiters
     */
    const renderMathContent = (text: string): string => {
        let rendered = text;

        // First, handle explicit display math ($$...$$)
        MATH_DELIMITERS.display.forEach(({ pattern }) => {
            rendered = rendered.replace(pattern, (_match, math) => {
                return safeRenderKatex(math, true);
            });
        });

        // Then, handle explicit inline math ($...$)
        MATH_DELIMITERS.inline.forEach(({ pattern }) => {
            rendered = rendered.replace(pattern, (_match, math) => {
                return safeRenderKatex(math, false);
            });
        });

        // Handle standalone LaTeX commands
        rendered = rendered.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_match, num, den) => {
            return safeRenderKatex(`\\frac{${num}}{${den}}`, false);
        });

        rendered = rendered.replace(/\\boxed\{([^}]+)\}/g, (_match, content) => {
            const cleanContent = content
                .replace(/<[^>]*>/g, '')
                .replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1')
                .trim();
            return safeRenderKatex(`\\boxed{${cleanContent}}`, false);
        });

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

        symbols.forEach(({ pattern, latex }) => {
            rendered = rendered.replace(pattern, () => safeRenderKatex(latex, false));
        });

        // Handle derivative notation d/dx
        rendered = rendered.replace(/\bd\/d([a-zA-Z])/g, (_match, variable) => {
            return safeRenderKatex(`\\frac{d}{d${variable}}`, false);
        });

        // Handle Unicode superscripts
        rendered = rendered.replace(/([a-zA-Z])([²³⁴⁵⁶⁷⁸⁹⁰¹])/g, (_match, base, sup) => {
            const supMap: { [key: string]: string } = {
                '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6',
                '⁷': '7', '⁸': '8', '⁹': '9', '⁰': '0', '¹': '1'
            };
            return safeRenderKatex(`${base}^{${supMap[sup]}}`, false);
        });

        // Handle caret notation
        rendered = rendered.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, (_match, base, exp) => {
            return safeRenderKatex(`${base}^{${exp}}`, false);
        });

        rendered = rendered.replace(/([a-zA-Z])\^(\d+|[a-zA-Z])/g, (_match, base, exp) => {
            return safeRenderKatex(`${base}^{${exp}}`, false);
        });

        return rendered;
    };

    /**
     * Stage 7: Process markdown formatting
     */
    const processMarkdown = (text: string): string => {
        let processed = text;

        // Tables - must come first
        processed = processed.replace(/^\|(.+)\|$/gm, (_match, content) => {
            return '__TABLE_ROW__' + content + '__/TABLE_ROW__';
        });

        // Process table rows and convert to HTML
        processed = processed.replace(/(__TABLE_ROW__[\s\S]*?__\/TABLE_ROW__)+/g, (match) => {
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
                    const rowHTML = '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
                    tableHTML += rowHTML;
                    if (index === 0) isHeader = false;
                }
            });

            tableHTML += '</table>';
            return tableHTML;
        });

        // Inline code
        processed = processed.replace(/`([^`\n]+?)`/g, '<code class="inline-code">$1</code>');

        // Horizontal rules
        processed = processed.replace(/^---+\s*$/gm, '<hr class="markdown-hr">');
        processed = processed.replace(/^\*\*\*+\s*$/gm, '<hr class="markdown-hr">');
        processed = processed.replace(/^___+\s*$/gm, '<hr class="markdown-hr">');

        // Headings (longest first to avoid partial matches)
        processed = processed.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
        processed = processed.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
        processed = processed.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        processed = processed.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        processed = processed.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        processed = processed.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Bold and italic
        processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');

        // Strikethrough
        processed = processed.replace(/~~([^~]+?)~~/g, '<del class="markdown-strikethrough">$1</del>');

        // Reference-style links
        const referenceMap: { [key: string]: string } = {};
        processed = processed.replace(/^\[([^\]]+)\]:\s*(.+)$/gm, (_, ref, url) => {
            referenceMap[ref.toLowerCase()] = url.trim();
            return '';
        });

        // Links (both inline and reference-style)
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

        // Images
        processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
            const titleAttr = title ? ` title="${title}"` : '';
            return `<img src="${url}" alt="${alt}"${titleAttr} style="max-width: 100%; height: auto;" />`;
        });

        return processed;
    };

    /**
     * Stage 8: Convert markdown list placeholders to HTML
     */
    const convertListsToHTML = (text: string): string => {
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

            console.log('📋 List items detected:', items);

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

            console.log('📋 Generated HTML:', html);

            return html;
        });

        // Ordered lists - handle nesting like unordered lists
        // Match consecutive OL items including whitespace between them
        converted = converted.replace(/(?:__OL_\d+__[\s\S]*?__\/OL__\s*)+/g, (match) => {
            console.log('📋 Full OL match (first 500 chars):', match.substring(0, 500));
            const items: { level: number; content: string }[] = [];
            const regex = /__OL_(\d+)__([\s\S]*?)__\/OL__/g;
            let m;
            
            while ((m = regex.exec(match)) !== null) {
                items.push({ level: parseInt(m[1]), content: m[2].trim() });
            }

            if (items.length === 0) return match;

            console.log('📋 Ordered list items detected (BEFORE normalization):', items);

            // Normalize levels
            const minLevel = Math.min(...items.map(i => i.level));
            items.forEach(i => i.level -= minLevel);
            
            console.log('📋 Ordered list items (AFTER normalization, minLevel was', minLevel + '):', items);
            
            // Fallback: If all items are at the same level, try to infer nesting from bold markers
            const allSameLevel = items.every(i => i.level === 0);
            if (allSameLevel && items.length > 4) {
                console.log('⚠️ All items at same level - attempting to infer nesting from bold text');
                items.forEach(item => {
                    // Items with bold text (**text** or <strong>) are main items (level 0)
                    // Items without bold are sub-items (level 1)
                    const hasBold = /\*\*|\<strong\>/.test(item.content);
                    if (!hasBold) {
                        item.level = 1;
                    }
                });
                console.log('📋 After bold-based inference:', items);
            }

            let html = '<ol>';
            let currentLevel = 0;
            const openListItems: boolean[] = []; // Track open <li> tags

            items.forEach((item, index) => {
                const nextLevel = index < items.length - 1 ? items[index + 1].level : 0;
                
                // Close deeper levels
                while (currentLevel > item.level) {
                    html += '</ol>';
                    if (openListItems.length > 0) {
                        html += '</li>';  // Close the parent <li> that contained the nested <ol>
                        openListItems.pop();
                    }
                    currentLevel--;
                }
                
                // Open new item at current level
                html += `<li>${item.content}`;
                
                // If next item is nested deeper, start a nested list
                if (nextLevel > item.level) {
                    html += '<ol>';
                    currentLevel++;
                    openListItems.push(true);
                } else {
                    // Close the current list item
                    html += '</li>';
                }
            });

            // Close any remaining open tags
            while (currentLevel > 0) {
                html += '</ol>';
                if (openListItems.length > 0) {
                    html += '</li>';
                    openListItems.pop();
                }
                currentLevel--;
            }
            html += '</ol>';

            console.log('📋 Generated ordered list HTML:', html);

            return html;
        });

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

        // Wrap in paragraphs if needed
        if (processed.includes('</p><p>') && !processed.match(/^<(h[1-6]|ul|ol|blockquote|pre|table|div)/)) {
            processed = `<p>${processed}</p>`;
        }

        return processed;
    };

    /**
     * Main rendering pipeline
     */
    const renderLatex = (text: string): string => {
        try {
            let processed = text;

            // Stage 1: Clean malformed content
            processed = cleanMalformedContent(processed);

            // Stage 2: Fix LaTeX issues
            processed = fixLatexIssues(processed);

            // Stage 3: Convert implicit math notation
            processed = convertImplicitMath(processed);

            // Stage 4: Preserve code blocks
            const { text: withoutCode, blocks: codeBlocks } = preserveCodeBlocks(processed);
            processed = withoutCode;

            // Stage 5: Process markdown lists
            processed = processMarkdownLists(processed);

            // Stage 6: Render math content
            processed = renderMathContent(processed);

            // Stage 7: Process markdown formatting
            processed = processMarkdown(processed);

            // Stage 8: Convert lists to HTML
            processed = convertListsToHTML(processed);

            // Stage 9: Apply paragraph breaks
            processed = applyParagraphBreaks(processed);

            // Stage 10: Restore code blocks
            codeBlocks.forEach((block, i) => {
                processed = processed.replace(`__CODE_BLOCK_${i}__`, block);
            });

            // Final cleanup
            processed = processed.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1');
            processed = processed.replace(/\\\(/g, '');
            processed = processed.replace(/\\\)/g, '');

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

    const processedContent = renderLatex(children);

    return (
        <div
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
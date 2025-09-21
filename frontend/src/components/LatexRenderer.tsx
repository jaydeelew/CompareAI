import React from 'react';
import katex from 'katex';

interface LatexRendererProps {
    children: string;
    className?: string;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ children, className = '' }) => {
    const renderLatex = (text: string): string => {
        try {
            let processedText = text;

            // First handle explicit display math ($$...$$)
            processedText = processedText.replace(/\$\$([^$]+?)\$\$/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: true,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering display math:', error);
                    return match;
                }
            });

            // Then handle explicit inline math ($...$)
            processedText = processedText.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering inline math:', error);
                    return match;
                }
            });

            // Handle LaTeX inline math delimiters \(...\)
            processedText = processedText.replace(/\\\(\s*([^\\]+?)\s*\\\)/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering LaTeX inline math:', error);
                    return match;
                }
            });

            // Handle LaTeX display math delimiters \[...\] 
            processedText = processedText.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, math) => {
                try {
                    const rendered = katex.renderToString(math.trim(), {
                        displayMode: true,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering LaTeX display math:', error);
                    return match;
                }
            });

            // Handle single \[ and \] on separate lines (common in AI responses)
            processedText = processedText.replace(/^\\\[\s*$/gm, '');
            processedText = processedText.replace(/^\\\]\s*$/gm, '');

            // Handle LaTeX commands that appear as plain text
            processedText = processedText.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (match, num, den) => {
                try {
                    const rendered = katex.renderToString(`\\frac{${num}}{${den}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle \left( and \right) parentheses
            processedText = processedText.replace(/\\left\(/g, '(');
            processedText = processedText.replace(/\\right\)/g, ')');

            // Handle \cdot multiplication
            processedText = processedText.replace(/\\cdot/g, () => {
                try {
                    const rendered = katex.renderToString('\\cdot', {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return '·';
                }
            });

            // Handle \times multiplication
            processedText = processedText.replace(/\\times/g, () => {
                try {
                    const rendered = katex.renderToString('\\times', {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return '×';
                }
            });

            // Handle other common LaTeX math symbols
            const mathSymbols = [
                { pattern: /\\div/g, fallback: '÷' },
                { pattern: /\\pm/g, fallback: '±' },
                { pattern: /\\mp/g, fallback: '∓' },
                { pattern: /\\leq/g, fallback: '≤' },
                { pattern: /\\geq/g, fallback: '≥' },
                { pattern: /\\neq/g, fallback: '≠' },
                { pattern: /\\approx/g, fallback: '≈' },
                { pattern: /\\infty/g, fallback: '∞' },
                { pattern: /\\sum/g, fallback: '∑' },
                { pattern: /\\prod/g, fallback: '∏' },
                { pattern: /\\int/g, fallback: '∫' },
                { pattern: /\\sqrt/g, fallback: '√' },
                { pattern: /\\alpha/g, fallback: 'α' },
                { pattern: /\\beta/g, fallback: 'β' },
                { pattern: /\\gamma/g, fallback: 'γ' },
                { pattern: /\\delta/g, fallback: 'δ' },
                { pattern: /\\epsilon/g, fallback: 'ε' },
                { pattern: /\\theta/g, fallback: 'θ' },
                { pattern: /\\lambda/g, fallback: 'λ' },
                { pattern: /\\mu/g, fallback: 'μ' },
                { pattern: /\\pi/g, fallback: 'π' },
                { pattern: /\\sigma/g, fallback: 'σ' },
                { pattern: /\\tau/g, fallback: 'τ' },
                { pattern: /\\phi/g, fallback: 'φ' },
                { pattern: /\\omega/g, fallback: 'ω' }
            ];

            mathSymbols.forEach(({ pattern, fallback }) => {
                processedText = processedText.replace(pattern, () => {
                    try {
                        const symbol = pattern.source.replace(/\\/g, '\\').replace(/g$/, '');
                        const rendered = katex.renderToString(symbol, {
                            displayMode: false,
                            throwOnError: false
                        });
                        return rendered;
                    } catch {
                        return fallback;
                    }
                });
            });

            // Handle \boxed{} for boxed equations
            processedText = processedText.replace(/\\boxed\{([^}]+)\}/g, (_, content) => {
                try {
                    // Process any LaTeX delimiters within the boxed content first
                    const cleanContent = content.replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1');
                    const rendered = katex.renderToString(`\\boxed{${cleanContent}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    // Process LaTeX delimiters in fallback content too
                    const cleanContent = content.replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1');
                    return `<span style="border: 1px solid currentColor; padding: 2px 6px; border-radius: 3px; display: inline-block;">${cleanContent}</span>`;
                }
            });

            // Handle markdown tables (must come before other markdown processing)
            processedText = processedText.replace(/^\|(.+)\|$/gm, (_, content) => {
                return '___TABLE_ROW___' + content + '___/TABLE_ROW___';
            });
            
            // Process table rows and convert to HTML table
            processedText = processedText.replace(/(___TABLE_ROW___[\s\S]*?___\/TABLE_ROW___)+/g, (match) => {
                const rows = match.split('___/TABLE_ROW___').filter(row => row.trim());
                let tableHTML = '<table class="markdown-table">';
                let isHeader = true;
                
                rows.forEach((row, index) => {
                    const cleanRow = row.replace('___TABLE_ROW___', '').trim();
                    if (cleanRow.match(/^[-|\s:]+$/)) {
                        // Skip separator rows (like |----|----|)
                        isHeader = false;
                        return;
                    }
                    
                    const cells = cleanRow.split('|').map(cell => cell.trim()).filter(cell => cell);
                    if (cells.length > 0) {
                        const tag = isHeader ? 'th' : 'td';
                        const rowHTML = '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
                        tableHTML += rowHTML;
                        if (index === 0) isHeader = false; // Only first row is header
                    }
                });
                
                tableHTML += '</table>';
                return tableHTML;
            });

            // Handle markdown horizontal rules (must come before other processing)
            processedText = processedText.replace(/^---+\s*$/gm, '<hr class="markdown-hr">');
            processedText = processedText.replace(/^\*\*\*+\s*$/gm, '<hr class="markdown-hr">');
            processedText = processedText.replace(/^___+\s*$/gm, '<hr class="markdown-hr">');

            // Handle markdown headings (must come before other markdown processing)
            processedText = processedText.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
            processedText = processedText.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
            processedText = processedText.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
            processedText = processedText.replace(/^### (.+)$/gm, '<h3>$1</h3>');
            processedText = processedText.replace(/^## (.+)$/gm, '<h2>$1</h2>');
            processedText = processedText.replace(/^# (.+)$/gm, '<h1>$1</h1>');

            // Handle markdown blockquotes
            processedText = processedText.replace(/^> (.+)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>');
            
            // Merge consecutive blockquotes
            processedText = processedText.replace(/(<\/blockquote>\s*<blockquote class="markdown-blockquote">)/g, '<br>');

            // Handle markdown strikethrough ~~text~~
            processedText = processedText.replace(/~~([^~]+?)~~/g, '<del class="markdown-strikethrough">$1</del>');

            // Handle markdown bold syntax **text**
            processedText = processedText.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

            // Handle markdown italic syntax *text*
            processedText = processedText.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');

            // Handle markdown links [text](url) and [text](url "title")
            processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (match, text, url, title) => {
                const titleAttr = title ? ` title="${title}"` : '';
                return `<a href="${url}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
            });

            // Handle reference-style links [text][ref] and [ref]: url
            // First, collect all reference definitions
            const referenceMap: { [key: string]: string } = {};
            processedText = processedText.replace(/^\[([^\]]+)\]:\s*(.+)$/gm, (match, ref, url) => {
                referenceMap[ref.toLowerCase()] = url.trim();
                return ''; // Remove the definition line
            });

            // Then replace reference-style links
            processedText = processedText.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (match, text, ref) => {
                const reference = ref || text.toLowerCase();
                const url = referenceMap[reference];
                if (url) {
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                }
                return match; // Return original if reference not found
            });

            // Handle markdown images ![alt](url) and ![alt](url "title")
            processedText = processedText.replace(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (match, alt, url, title) => {
                const titleAttr = title ? ` title="${title}"` : '';
                return `<img src="${url}" alt="${alt}"${titleAttr} style="max-width: 100%; height: auto;" />`;
            });

            // Handle markdown line breaks (double spaces or double newlines)
            processedText = processedText.replace(/ {2}\n/g, '<br>');
            processedText = processedText.replace(/\n\n/g, '</p><p>');

            // Handle markdown code blocks ```
            processedText = processedText.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

            // Handle inline code `text`
            processedText = processedText.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

            // Handle markdown task lists - [x] and [ ]
            processedText = processedText.replace(/^- \[([ x])\] (.+)$/gm, (match, checked, text) => {
                const isChecked = checked === 'x';
                return `___TASK_ITEM___${isChecked ? 'checked' : 'unchecked'}___${text}___/TASK_ITEM___`;
            });

            // Handle markdown lists more carefully
            // First, handle unordered lists (but not task lists)
            processedText = processedText.replace(/^- (?!\[[ x]\])(.+)$/gm, '___UL_ITEM___$1___/UL_ITEM___');
            
            // Then handle ordered lists  
            processedText = processedText.replace(/^\d+\. (.+)$/gm, '___OL_ITEM___$1___/OL_ITEM___');
            
            // Convert task list items to proper HTML
            processedText = processedText.replace(/(___TASK_ITEM___[\s\S]*?___\/TASK_ITEM___)+/g, (match) => {
                const items = match.replace(/___TASK_ITEM___(checked|unchecked)___(.*?)___\/TASK_ITEM___/g, (_, checked, text) => {
                    const checkedAttr = checked === 'checked' ? 'checked' : '';
                    return `<li class="task-list-item"><input type="checkbox" ${checkedAttr} disabled> ${text}</li>`;
                });
                return '<ul class="task-list">' + items + '</ul>';
            });
            
            // Convert consecutive unordered list items to proper HTML
            processedText = processedText.replace(/(___UL_ITEM___[\s\S]*?___\/UL_ITEM___)+/g, (match) => {
                const items = match.replace(/___UL_ITEM___(.*?)___\/UL_ITEM___/g, '<li>$1</li>');
                return '<ul>' + items + '</ul>';
            });
            
            // Convert consecutive ordered list items to proper HTML
            processedText = processedText.replace(/(___OL_ITEM___[\s\S]*?___\/OL_ITEM___)+/g, (match) => {
                const items = match.replace(/___OL_ITEM___(.*?)___\/OL_ITEM___/g, '<li>$1</li>');
                return '<ol>' + items + '</ol>';
            });

            // Handle definition lists
            // First, collect definition list items
            // Only match lines that look like definitions (not Bible references or other colon usage)
            const definitionMap: { [key: string]: string[] } = {};
            processedText = processedText.replace(/^([^:\n\d]+)\s*:\s*(.+)$/gm, (match, term, definition) => {
                // Skip if it looks like a Bible reference (contains numbers and colon)
                if (/\d+:\d+/.test(match)) {
                    return match;
                }
                // Skip if it looks like a time reference (HH:MM format)
                if (/^\d{1,2}:\d{2}/.test(match)) {
                    return match;
                }
                // Skip if it's very short (likely not a definition)
                if (term.trim().length < 3) {
                    return match;
                }
                
                const cleanTerm = term.trim();
                if (!definitionMap[cleanTerm]) {
                    definitionMap[cleanTerm] = [];
                }
                definitionMap[cleanTerm].push(definition.trim());
                return ''; // Remove the definition line
            });

            // Convert definition lists to HTML
            Object.keys(definitionMap).forEach(term => {
                const definitions = definitionMap[term];
                const definitionHTML = definitions.map(def => `<dd>${def}</dd>`).join('');
                processedText += `<dl><dt>${term}</dt>${definitionHTML}</dl>`;
            });

            // Handle footnotes [^1] and [^1]: content
            const footnoteMap: { [key: string]: string } = {};
            processedText = processedText.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (match, ref, content) => {
                footnoteMap[ref] = content.trim();
                return ''; // Remove the footnote definition line
            });

            // Replace footnote references with links
            processedText = processedText.replace(/\[\^([^\]]+)\]/g, (match, ref) => {
                if (footnoteMap[ref]) {
                    return `<sup><a href="#footnote-${ref}" id="footnote-ref-${ref}" class="footnote-ref">${ref}</a></sup>`;
                }
                return match;
            });

            // Add footnote definitions at the end
            const footnotes = Object.keys(footnoteMap).map(ref => 
                `<div id="footnote-${ref}" class="footnote-def"><sup>${ref}</sup> ${footnoteMap[ref]} <a href="#footnote-ref-${ref}" class="footnote-backref">↩</a></div>`
            ).join('');
            if (footnotes) {
                processedText += `<div class="footnotes">${footnotes}</div>`;
            }

            // Handle derivative notation d/dx
            processedText = processedText.replace(/\bd\/d([a-zA-Z])/g, (match, variable) => {
                try {
                    const rendered = katex.renderToString(`\\frac{d}{d${variable}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle Unicode superscripts (x², x³, etc.)
            processedText = processedText.replace(/([a-zA-Z])([²³⁴⁵⁶⁷⁸⁹⁰¹])/g, (match, base, superscript) => {
                const superscriptMap: { [key: string]: string } = {
                    '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6',
                    '⁷': '7', '⁸': '8', '⁹': '9', '⁰': '0', '¹': '1'
                };
                try {
                    const exp = superscriptMap[superscript] || superscript;
                    const rendered = katex.renderToString(`${base}^{${exp}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle curly brace exponents x^{3-1}, x^{n-1}
            processedText = processedText.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, (match, base, exp) => {
                try {
                    const rendered = katex.renderToString(`${base}^{${exp}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle caret notation (x^2, x^n, etc.) - removed word boundary for better matching
            processedText = processedText.replace(/([a-zA-Z])\^(\d+|[a-zA-Z]|\([^)]+\))/g, (match, base, exp) => {
                try {
                    // Clean up parentheses in exponent
                    const cleanExp = exp.replace(/^\(|\)$/g, '');
                    const rendered = katex.renderToString(`${base}^{${cleanExp}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle expressions with coefficients like 5x^1, 3x^2, etc.
            processedText = processedText.replace(/(\d+)([a-zA-Z])\^(\d+|[a-zA-Z]|\([^)]+\))/g, (match, coeff, base, exp) => {
                try {
                    const cleanExp = exp.replace(/^\(|\)$/g, '');
                    const rendered = katex.renderToString(`${coeff}${base}^{${cleanExp}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle more complex expressions like nx^(n-1), 2x^(2-1)
            processedText = processedText.replace(/(\d*[a-zA-Z]*)\^(\([^)]+\))/g, (match, base, exp) => {
                try {
                    // Remove outer parentheses from exponent
                    const cleanExp = exp.replace(/^\(|\)$/g, '');
                    const rendered = katex.renderToString(`${base}^{${cleanExp}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle expressions with coefficients like nx^(n-1), 2x^(2-1) with coefficient
            processedText = processedText.replace(/(\d*)([a-zA-Z])\^(\([^)]+\))/g, (match, coeff, base, exp) => {
                try {
                    const cleanExp = exp.replace(/^\(|\)$/g, '');
                    const fullBase = coeff ? `${coeff}${base}` : base;
                    const rendered = katex.renderToString(`${fullBase}^{${cleanExp}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle function notation with primes f'(x), f''(x)
            processedText = processedText.replace(/\b([a-zA-Z])('+)(\([^)]*\))/g, (match, func, primes, args) => {
                try {
                    const rendered = katex.renderToString(`${func}${primes}${args}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle multiplication symbols (* to \cdot)
            processedText = processedText.replace(/(\d+|\w+)\s*\*\s*(\w+|\d+)/g, (match, left, right) => {
                try {
                    const rendered = katex.renderToString(`${left} \\cdot ${right}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle simple fractions in parentheses like (n-1)
            processedText = processedText.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, (match, num, den) => {
                try {
                    const rendered = katex.renderToString(`\\frac{${num}}{${den}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch {
                    return match;
                }
            });

            // Handle escaped characters (must be last before final cleanup)
            processedText = processedText.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1');

            // Final cleanup: remove any remaining \( and \) delimiters
            processedText = processedText.replace(/\\\(/g, '');
            processedText = processedText.replace(/\\\)/g, '');

            // Wrap content in paragraphs if we added paragraph breaks
            // Only wrap if the content doesn't already start with a block element
            if (processedText.includes('</p><p>') && !processedText.match(/^<(h[1-6]|ul|ol|blockquote|pre|table|dl|div)/)) {
                processedText = '<p>' + processedText + '</p>';
            }

            return processedText;
        } catch (error) {
            console.warn('Error processing LaTeX:', error);
            return text;
        }
    };

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

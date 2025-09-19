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
                } catch (error) {
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
                } catch (error) {
                    return '·';
                }
            });

            // Handle \boxed{} for boxed equations
            processedText = processedText.replace(/\\boxed\{([^}]+)\}/g, (_, content) => {
                try {
                    // Process any LaTeX delimiters within the boxed content first
                    let cleanContent = content.replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1');
                    const rendered = katex.renderToString(`\\boxed{${cleanContent}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    // Process LaTeX delimiters in fallback content too
                    let cleanContent = content.replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1');
                    return `<span style="border: 1px solid currentColor; padding: 2px 6px; border-radius: 3px; display: inline-block;">${cleanContent}</span>`;
                }
            });

            // Handle markdown bold syntax **text**
            processedText = processedText.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');

            // Handle derivative notation d/dx
            processedText = processedText.replace(/\bd\/d([a-zA-Z])/g, (match, variable) => {
                try {
                    const rendered = katex.renderToString(`\\frac{d}{d${variable}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
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
                } catch (error) {
                    return match;
                }
            });

            // Final cleanup: remove any remaining \( and \) delimiters
            processedText = processedText.replace(/\\\(/g, '');
            processedText = processedText.replace(/\\\)/g, '');

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
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: 'inherit'
            }}
        />
    );
};

export default LatexRenderer;

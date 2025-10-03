import React from 'react';
import katex from 'katex';

interface LatexRendererProps {
    children: string;
    className?: string;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ children, className = '' }) => {
    const preprocessEscapeSequences = (text: string): string => {
        // PREPROCESSING LAYER: Aggressive cleanup of escape sequences
        // This runs before any other processing to catch the specific patterns from the image

        let processed = text;

        // Target the exact patterns seen in the user's example
        const escapePatterns = [
            // Function calls
            { pattern: /\\\s*f\(/g, replacement: 'f(' },
            { pattern: /\\\s*f'\(/g, replacement: "f'(" },
            { pattern: /\\\s*([a-zA-Z]+)\(/g, replacement: '$1(' },

            // Variables and terms
            { pattern: /\\\s*([a-zA-Z]+)/g, replacement: '$1' },
            { pattern: /\\\s*([0-9]+)/g, replacement: '$1' },
            { pattern: /\\\s*([+-]?[0-9]+)/g, replacement: '$1' },

            // Mathematical expressions with superscripts
            { pattern: /\\\s*([0-9]+[²³⁴⁵⁶⁷⁸⁹⁰¹])/g, replacement: '$1' },
            { pattern: /\\\s*([a-zA-Z]+[²³⁴⁵⁶⁷⁸⁹⁰¹])/g, replacement: '$1' },

            // Complex expressions
            { pattern: /\\\s*([0-9]+\s*cdot)/g, replacement: '$1' },
            { pattern: /\\\s*([a-zA-Z]+\s*cdot)/g, replacement: '$1' },
            { pattern: /\\\s*(cdot)/g, replacement: '$1' },

            // Mathematical symbols
            { pattern: /\\\s*([ⁿ⁻¹²³⁴⁵⁶⁷⁸⁹⁰¹])/g, replacement: '$1' },
            { pattern: /\\\s*([=+\-*/])/g, replacement: '$1' },
            { pattern: /\\\s*([+-])/g, replacement: '$1' },

            // Parentheses and brackets
            { pattern: /\\\s*([\(\)\[\]])/g, replacement: '$1' },

            // Any remaining backslash-space patterns
            { pattern: /\\\s+/g, replacement: ' ' },
        ];

        // Apply all patterns
        escapePatterns.forEach(({ pattern, replacement }) => {
            processed = processed.replace(pattern, replacement);
        });

        return processed;
    };

    const renderLatex = (text: string): string => {
        try {
            // Debug logging - TEMPORARY for debugging backslash issue
            console.log('[LatexRenderer] Input length:', text?.length || 0);
            console.log('[LatexRenderer] First 300 chars:', text?.substring(0, 300) || 'empty');
            console.log('[LatexRenderer] Has backslash-space patterns:', /\\\s/.test(text || ''));

            // PREPROCESSING: Apply aggressive escape sequence cleanup first
            let processedText = preprocessEscapeSequences(text);

            // CRITICAL FIX: Unescape backslashes that may have been double-escaped
            // This handles cases where \( becomes \\( in the JSON response
            // We need to be careful to only unescape LaTeX-related backslashes

            // First, handle LaTeX delimiters and brackets
            processedText = processedText.replace(/\\\\([()[\]{}])/g, '\\$1'); // \\( -> \(, \\) -> \), etc.

            // Handle common LaTeX commands (comprehensive list)
            const latexCommands = [
                'frac', 'boxed', 'left', 'right', 'cdot', 'times', 'div', 'pm', 'mp',
                'leq', 'geq', 'neq', 'approx', 'infty', 'sum', 'prod', 'int', 'sqrt',
                'lim', 'max', 'min', 'sup', 'inf', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
                'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'arcsin', 'arccos', 'arctan',
                'partial', 'nabla', 'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow',
                'Leftarrow', 'Leftrightarrow', 'mapsto', 'to', 'in', 'notin', 'subset',
                'supset', 'subseteq', 'supseteq', 'cap', 'cup', 'emptyset', 'varnothing',
                'forall', 'exists', 'land', 'lor', 'neg', 'equiv', 'implies', 'iff',
                'mathbb', 'mathcal', 'mathfrak', 'mathrm', 'mathbf', 'mathit', 'text',
                'begin', 'end', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'cases',
                'align', 'aligned', 'split', 'gather', 'gathered', 'multline', 'eqnarray',
                'label', 'ref', 'tag', 'nonumber', 'notag', 'intertext', 'shortintertext'
            ];

            // Handle Greek letters
            const greekLetters = [
                'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
                'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
                'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi',
                'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda',
                'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'
            ];

            // Apply double-escape fixes for all LaTeX commands
            [...latexCommands, ...greekLetters].forEach(cmd => {
                processedText = processedText.replace(new RegExp(`\\\\\\\\(${cmd})`, 'g'), `\\\\$1`);
            });

            // Handle any remaining generic LaTeX command pattern that might be double-escaped
            // This catches patterns like \\commandname{ that we might have missed
            processedText = processedText.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

            // NUCLEAR OPTION: Complete elimination of unwanted escape sequences
            // This is a comprehensive overhaul to fix the persistent escape sequence problem

            // Step 1: Remove ALL backslash-space patterns first
            processedText = processedText.replace(/\\\s+/g, ' ');

            // Step 2: Remove backslashes before ANY mathematical content
            // This catches patterns like \ f(x), \ x³, \ n, \ -x², \ 1, \ f'(x), etc.

            // Remove backslashes before function calls (with or without spaces)
            processedText = processedText.replace(/\\\s*f\(/g, 'f(');  // \ f( -> f(
            processedText = processedText.replace(/\\\s*f'\(/g, "f'(");  // \ f'( -> f'(
            processedText = processedText.replace(/\\\s*([a-zA-Z]+)\(/g, '$1(');  // \ func( -> func(

            // Remove backslashes before variables and mathematical terms
            processedText = processedText.replace(/\\\s*([a-zA-Z]+)/g, '$1');  // \ x -> x, \ n -> n, \ a -> a

            // Remove backslashes before numbers and coefficients
            processedText = processedText.replace(/\\\s*([+-]?[0-9]+)/g, '$1');  // \ 1 -> 1, \ -2 -> -2, \ 3 -> 3

            // Remove backslashes before mathematical expressions with superscripts
            processedText = processedText.replace(/\\\s*([0-9]+[²³⁴⁵⁶⁷⁸⁹⁰¹])/g, '$1');  // \ 2³ -> 2³
            processedText = processedText.replace(/\\\s*([a-zA-Z]+[²³⁴⁵⁶⁷⁸⁹⁰¹])/g, '$1');  // \ x² -> x²

            // Remove backslashes before coefficients and variables
            processedText = processedText.replace(/\\\s*([0-9]+[a-zA-Z])/g, '$1');  // \ 3x -> 3x
            processedText = processedText.replace(/\\\s*([a-zA-Z]+[0-9])/g, '$1');  // \ ax -> ax

            // Remove backslashes before mathematical operations
            processedText = processedText.replace(/\\\s*([+-])/g, '$1');  // \ + -> +, \ - -> -
            processedText = processedText.replace(/\\\s*([=+\-*/])/g, '$1');  // \ = -> =, \ * -> *

            // Step 3: Remove backslashes before complex mathematical expressions
            // Handle patterns like \ a cdot n cdot xⁿ⁻¹, \ 1 cdot x³, etc.
            processedText = processedText.replace(/\\\s*([0-9]+\s*cdot)/g, '$1');  // \ 1 cdot -> 1 cdot
            processedText = processedText.replace(/\\\s*([a-zA-Z]+\s*cdot)/g, '$1');  // \ a cdot -> a cdot
            processedText = processedText.replace(/\\\s*(cdot)/g, '$1');  // \ cdot -> cdot

            // Handle patterns like \ n cdot xⁿ⁻¹
            processedText = processedText.replace(/\\\s*([a-zA-Z]+\s*[a-zA-Z]+\s*[a-zA-Z]+)/g, '$1');  // \ n cdot x -> n cdot x

            // Step 4: Remove backslashes before parentheses and brackets
            processedText = processedText.replace(/\\\s*([\(\)\[\]])/g, '$1');  // \ ( -> (, \ ) -> )

            // Step 5: Remove backslashes before any remaining mathematical symbols
            processedText = processedText.replace(/\\\s*([ⁿ⁻¹²³⁴⁵⁶⁷⁸⁹⁰¹])/g, '$1');  // \ ⁿ -> ⁿ, \ ⁻¹ -> ⁻¹

            // Step 6: Final comprehensive cleanup - remove ANY backslash followed by space or common characters
            processedText = processedText.replace(/\\\s*([a-zA-Z0-9])/g, '$1');  // \ char -> char
            processedText = processedText.replace(/\\\s*([+-])/g, '$1');  // \ +/- -> +/-

            // Step 7: Remove any remaining standalone backslashes that aren't part of LaTeX commands
            // Only preserve backslashes that are part of legitimate LaTeX commands
            processedText = processedText.replace(/\\(?=\s|$|[^a-zA-Z()[\]{}])/g, '');

            // Step 8: Final cleanup for any remaining backslash-space patterns
            processedText = processedText.replace(/\\\s+/g, ' ');

            // Clean up malformed LaTeX patterns that might have extra backslashes
            // Handle patterns like "\\\(" or "\\\)" that should be "\(" or "\)"
            processedText = processedText.replace(/\\\\\\\(/g, '\\(');
            processedText = processedText.replace(/\\\\\\\)/g, '\\)');
            processedText = processedText.replace(/\\\\\\\[/g, '\\[');
            processedText = processedText.replace(/\\\\\\\]/g, '\\]');

            // Clean up triple-escaped commands (should be rare but can happen)
            processedText = processedText.replace(/\\\\\\\\([a-zA-Z]+)/g, '\\$1');

            // EARLY MARKDOWN PROCESSING - Do this FIRST before any HTML cleanup that might interfere
            // Handle markdown headings before other processing
            processedText = processedText.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
            processedText = processedText.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
            processedText = processedText.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
            processedText = processedText.replace(/^### (.+)$/gm, '<h3>$1</h3>');
            processedText = processedText.replace(/^## (.+)$/gm, '<h2>$1</h2>');
            processedText = processedText.replace(/^# (.+)$/gm, '<h1>$1</h1>');

            // Handle markdown bold and italic early too
            processedText = processedText.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
            processedText = processedText.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');

            // Preprocess: Clean up SVG path data and other unwanted content
            // Remove specific SVG path data patterns that appear in AI responses
            processedText = processedText.replace(/c-2\.7,0,-7\.17,-2\.7,-13\.5,-8c-5\.8,-5\.3,-9\.5,-10,-9\.5,-14[^"]*H400000v40H845\.2724[^"]*M834 80h400000v40h-400000z/g, '');

            // Remove other common SVG path patterns
            processedText = processedText.replace(/[a-zA-Z]\s*[0-9.-]+(?:[,\s][0-9.-]+){20,}/g, '');

            // Remove SVG path data patterns (long sequences of numbers, letters, and special chars)
            processedText = processedText.replace(/[a-zA-Z0-9\s,.-]{50,}/g, (match) => {
                // Check if this looks like SVG path data (contains many numbers, letters, commas, periods)
                const hasManyNumbers = (match.match(/\d/g) || []).length > 10;
                const hasManyCommas = (match.match(/,/g) || []).length > 5;
                const hasManyLetters = (match.match(/[a-zA-Z]/g) || []).length > 5;

                if (hasManyNumbers && hasManyCommas && hasManyLetters) {
                    return ''; // Remove SVG path data
                }
                return match; // Keep other long sequences
            });

            // Remove standalone SVG path elements that might be mixed in
            processedText = processedText.replace(/<path[^>]*d="[^"]*"[^>]*\/>/g, '');
            processedText = processedText.replace(/<svg[^>]*>.*?<\/svg>/gs, '');

            // Remove any remaining SVG-related attributes or elements
            processedText = processedText.replace(/<[^>]*(?:viewBox|xmlns|stroke|fill)[^>]*>/g, '');

            // Clean up MathML content that models sometimes output
            // ULTRA-AGGRESSIVE removal of MathML namespace URLs in ALL possible formats

            // First, remove complete MathML elements before we process tags
            processedText = processedText.replace(/<math[^>]*>[\s\S]*?<\/math>/gi, '');

            // Remove inline style attributes that models sometimes add
            // This catches patterns like: style="color:#cc0000">box
            processedText = processedText.replace(/style\s*=\s*["'][^"']*["']>\s*/gi, '');
            processedText = processedText.replace(/style\s*=\s*["'][^"']*["']/gi, '');

            // More aggressive style attribute removal for malformed content
            // Handle patterns like: " style="color:#cc0000">\boxed{
            processedText = processedText.replace(/["']\s*style\s*=\s*["'][^"']*["']>\s*/gi, '');
            processedText = processedText.replace(/style\s*=\s*["'][^"']*["']>\s*/gi, '');

            // Remove any remaining HTML-style attributes with closing brackets
            processedText = processedText.replace(/\s*class\s*=\s*["'][^"']*["']>\s*/gi, '');
            processedText = processedText.replace(/\s*id\s*=\s*["'][^"']*["']>\s*/gi, '');
            processedText = processedText.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');
            processedText = processedText.replace(/\s*id\s*=\s*["'][^"']*["']/gi, '');

            // NUCLEAR OPTION: Remove the URL and everything that looks like markup/attributes around it
            // Matches patterns like:
            // - //www.w3.org/1998/Math/MathML">+1 +1+1
            // - //www.w3.org/1998/Math/MathML" display="block">000
            // - //www.w3.org/1998/Math/MathML">x=0x = 0x

            // Remove the URL with any attributes and the closing >
            processedText = processedText.replace(/\/\/www\.w3\.org\/1998\/Math\/MathML[^>]*>/gi, '');
            processedText = processedText.replace(/https?:\/\/www\.w3\.org\/1998\/Math\/MathML[^>]*>/gi, '');

            // Remove any remaining URL fragments with quotes and attributes
            processedText = processedText.replace(/\/\/www\.w3\.org\/1998\/Math\/MathML["'][^>]*>/gi, '');
            processedText = processedText.replace(/https?:\/\/www\.w3\.org\/1998\/Math\/MathML["'][^>]*>/gi, '');

            // Remove just the URL itself if it appears standalone
            processedText = processedText.replace(/\/\/www\.w3\.org\/1998\/Math\/MathML/gi, '');
            processedText = processedText.replace(/https?:\/\/www\.w3\.org\/1998\/Math\/MathML/gi, '');

            // Remove www.w3.org references without protocol
            processedText = processedText.replace(/www\.w3\.org\/1998\/Math\/MathML[^>]*>/gi, '');
            processedText = processedText.replace(/www\.w3\.org\/1998\/Math\/MathML/gi, '');

            // Remove any xmlns attributes
            processedText = processedText.replace(/xmlns\s*=\s*["']https?:\/\/www\.w3\.org\/1998\/Math\/MathML["']/gi, '');

            // Remove any display attributes that are left over
            processedText = processedText.replace(/display\s*=\s*["']block["']\s*>/gi, '');
            processedText = processedText.replace(/display\s*=\s*["']inline["']\s*>/gi, '');

            // FINAL PASS: Catch any remaining w3.org references as a failsafe
            // This will remove any text that matches the pattern from the start up to the first closing angle bracket
            processedText = processedText.replace(/[^a-zA-Z]*\/\/www\.w3\.org\/1998\/Math\/MathML[^>]*>/gi, '');
            processedText = processedText.replace(/[^a-zA-Z]*https?:\/\/www\.w3\.org\/1998\/Math\/MathML[^>]*>/gi, '');

            // Remove any standalone www.w3.org fragments that might remain
            processedText = processedText.replace(/\/\/www\.w3\.org\/[^\s]*/gi, '');
            processedText = processedText.replace(/https?:\/\/www\.w3\.org\/[^\s]*/gi, '');
            processedText = processedText.replace(/www\.w3\.org\/[^\s]*/gi, '');

            // More aggressive cleanup for any remaining w3.org references
            // This catches patterns that might have been missed by previous patterns
            processedText = processedText.replace(/[^\s]*w3\.org[^\s]*/gi, '');
            processedText = processedText.replace(/[^\s]*\/\/www\.w3\.org[^\s]*/gi, '');
            processedText = processedText.replace(/[^\s]*https?:\/\/www\.w3\.org[^\s]*/gi, '');

            // Additional cleanup for malformed patterns
            processedText = processedText.replace(/[^\s]*https:[^\s]*/gi, '');
            processedText = processedText.replace(/[^\s]*xmlns[^\s]*/gi, '');
            processedText = processedText.replace(/[^\s]*display[^\s]*/gi, '');

            // Remove any lines that contain only w3.org references
            processedText = processedText.replace(/^[^\w]*w3\.org[^\w]*$/gm, '');

            // Remove any remaining MathML namespace references
            processedText = processedText.replace(/xmlns[^>]*w3\.org[^>]*>/gi, '');
            processedText = processedText.replace(/xmlns[^>]*MathML[^>]*>/gi, '');

            // Remove any remaining MathML comments or references
            processedText = processedText.replace(/<!--[^>]*w3\.org[^>]*-->/gi, '');
            processedText = processedText.replace(/<!--[^>]*MathML[^>]*-->/gi, '');

            // Remove any standalone MathML references that might appear as text
            processedText = processedText.replace(/MathML/gi, '');
            processedText = processedText.replace(/mathml/gi, '');

            // Clean up any remaining whitespace that might be left after removing references
            processedText = processedText.replace(/\s+/g, ' ').trim();

            // Final cleanup for any remaining malformed content
            // Remove any remaining fragments that look like broken URLs or attributes
            processedText = processedText.replace(/\s+[a-zA-Z]*="[^"]*[^a-zA-Z0-9\s][^"]*"/g, '');
            processedText = processedText.replace(/\s+[a-zA-Z]*=[^>\s]*[^a-zA-Z0-9\s][^>\s]*/g, '');

            // Remove any remaining broken HTML-like fragments
            processedText = processedText.replace(/\s*[a-zA-Z]*="[^"]*">/g, '');
            processedText = processedText.replace(/\s*[a-zA-Z]*=[^>\s]*>/g, '');

            // Remove any remaining w3.org references that might have been missed
            processedText = processedText.replace(/[^\s]*w3\.org[^\s]*/gi, '');

            // Clean up any remaining artifacts from malformed MathML
            // Only remove patterns that are clearly artifacts at the end of text
            processedText = processedText.replace(/\s*[+\-]?\d+\s*[+\-]?\d+[+\-]?\d*\s*$/g, '');
            processedText = processedText.replace(/\s*\d{3,}\s*$/g, '');

            // Clean up malformed LaTeX expressions with incorrect bracket syntax
            // Handle patterns like \frac{2}{3+1)=+). or (\frac{x³}{2+1)=).
            processedText = processedText.replace(/\\frac\{[^}]*\}[^}]*\)=.*?\)\./g, '');
            processedText = processedText.replace(/\\frac\{[^}]*\}[^}]*\)=.*?\)/g, '');

            // Clean up other malformed LaTeX patterns
            processedText = processedText.replace(/\\frac\{[^}]*\}[^}]*\)=.*?\./g, '');
            processedText = processedText.replace(/\\frac\{[^}]*\}[^}]*\)=.*?/g, '');

            // Remove any remaining malformed LaTeX that starts with \frac but has syntax errors
            processedText = processedText.replace(/\\frac\{[^}]*\}[^}]*\)=.*?/g, '');

            // Clean up any remaining stray parentheses or brackets from malformed LaTeX
            processedText = processedText.replace(/\s*\(\s*\)/g, '');
            processedText = processedText.replace(/\s*\(\s*$/g, '');
            processedText = processedText.replace(/\s*\)\s*$/g, '');

            // Clean up stray opening parentheses that are followed by a space
            processedText = processedText.replace(/\s*\(\s+/g, ' ');
            processedText = processedText.replace(/\s+\(\s+/g, ' ');

            // Additional cleanup for unrendered mathematical expressions
            // Remove patterns like unrendered fractions or expressions that start with backslash but aren't properly formatted
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?/g, '');
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?\./g, '');

            // Clean up malformed mathematical expressions that might appear as raw text
            processedText = processedText.replace(/\s*[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?/g, '');
            processedText = processedText.replace(/\s*[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?\./g, '');

            // Remove any remaining malformed LaTeX commands that aren't being rendered
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?/g, '');
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?\./g, '');

            // More specific cleanup for patterns like \int{x²}=) or \sum{x}=)
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}=\)/g, '');
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}=\)\./g, '');

            // Clean up any remaining malformed LaTeX with incorrect closing syntax
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?/g, '');
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*\}[^}]*\)=.*?\./g, '');

            // Clean up stray periods that might be left behind from malformed expressions
            // Only remove periods that are clearly artifacts (standalone periods with spaces)
            processedText = processedText.replace(/\s+\.\s+/g, ' ');
            processedText = processedText.replace(/^\s*\.\s+/g, '');
            processedText = processedText.replace(/\s+\.\s*$/g, '');

            // Remove MathML tags while preserving content
            processedText = processedText.replace(/<\/?math[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mrow[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mi[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mn[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mo[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?msup[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?msub[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mfrac[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mfenced[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mtext[^>]*>/gi, '');
            processedText = processedText.replace(/<mspace[^>]*\/?>/gi, '');
            processedText = processedText.replace(/<\/?msubsup[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?msqrt[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mroot[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mstyle[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mtable[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mtr[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mtd[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?mover[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?munder[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?munderover[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?semantics[^>]*>/gi, '');
            processedText = processedText.replace(/<\/?annotation[^>]*>/gi, '');

            // Remove any remaining namespace or MathML references
            processedText = processedText.replace(/\[Namespace:\s*https?:\/\/www\.w3\.org\/1998\/Math\/MathML\]/gi, '');
            processedText = processedText.replace(/xmlns:m\s*=\s*["']https?:\/\/www\.w3\.org\/1998\/Math\/MathML["']/gi, '');

            // Don't filter out entire lines - that removes valid content
            // Instead, rely on the regex replacements above to remove just the MathML URLs

            // Clean up any remaining malformed HTML that might contain SVG data
            processedText = processedText.replace(/<[^>]*style="[^"]*"[^>]*>/g, (match) => {
                // If it contains SVG-related styles, remove the whole element
                if (match.includes('svg') || match.includes('path') || match.includes('viewBox')) {
                    return '';
                }
                return match;
            });

            // Clean up any remaining mixed content that has SVG path data mixed with text
            processedText = processedText.replace(/([^>])\s*[a-zA-Z0-9\s,.-]{30,}\s*([^<])/g, (match, before, after) => {
                // Check if the middle part looks like SVG path data
                const middle = match.slice(before.length, match.length - after.length);
                const hasManyNumbers = (middle.match(/\d/g) || []).length > 5;
                const hasManyCommas = (middle.match(/,/g) || []).length > 3;

                if (hasManyNumbers && hasManyCommas) {
                    return before + ' ' + after; // Remove the SVG data, keep the surrounding text
                }
                return match;
            });

            // Additional cleanup for common AI response patterns that contain SVG data
            // Remove any lines that are mostly SVG path data
            processedText = processedText.replace(/^[a-zA-Z0-9\s,.-]{40,}$/gm, (match) => {
                const hasManyNumbers = (match.match(/\d/g) || []).length > 8;
                const hasManyCommas = (match.match(/,/g) || []).length > 4;
                const hasManyLetters = (match.match(/[a-zA-Z]/g) || []).length > 4;

                if (hasManyNumbers && hasManyCommas && hasManyLetters) {
                    return ''; // Remove the line
                }
                return match;
            });

            // Clean up any remaining malformed content that might have SVG data embedded
            processedText = processedText.replace(/\s+[a-zA-Z0-9\s,.-]{20,}\s+/g, (match) => {
                const trimmed = match.trim();
                const hasManyNumbers = (trimmed.match(/\d/g) || []).length > 6;
                const hasManyCommas = (trimmed.match(/,/g) || []).length > 3;

                if (hasManyNumbers && hasManyCommas) {
                    return ' '; // Replace with single space
                }
                return match;
            });

            // Preprocess: Clean up common malformed LaTeX patterns
            // Fix broken \boxed commands with HTML mixed in
            processedText = processedText.replace(/\\boxed\{[^}]*style="[^"]*"[^}]*\}/g, (match) => {
                // Extract just the mathematical content, removing HTML styling
                const mathContent = match
                    .replace(/\\boxed\{/, '')
                    .replace(/\}$/, '')
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/style="[^"]*"/g, '') // Remove style attributes
                    .replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1') // Remove LaTeX delimiters
                    .trim();
                return `\\boxed{${mathContent}}`;
            });

            // Fix malformed LaTeX commands that have HTML mixed in
            processedText = processedText.replace(/\\[a-zA-Z]+\{[^}]*<[^>]*>[^}]*\}/g, (match) => {
                // Extract the command and clean content
                const commandMatch = match.match(/\\([a-zA-Z]+)\{/);
                if (commandMatch) {
                    const command = commandMatch[1];
                    const content = match
                        .replace(new RegExp(`\\\\${command}\\{`), '')
                        .replace(/\}$/, '')
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/style="[^"]*"/g, '') // Remove style attributes
                        .trim();
                    return `\\${command}{${content}}`;
                }
                return match;
            });

            // First handle explicit display math ($$...$$)
            processedText = processedText.replace(/\$\$([^$]+?)\$\$/g, (_, math) => {
                try {
                    // Clean up the math content
                    const cleanMath = math.trim()
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/style="[^"]*"/g, '') // Remove style attributes
                        .trim();

                    const rendered = katex.renderToString(cleanMath, {
                        displayMode: true,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering display math:', error, 'Math:', math);
                    // Return a fallback that shows the math content
                    return `<div style="border: 1px solid #ccc; padding: 8px; margin: 4px 0; background: #f9f9f9; font-family: monospace;">${math.trim()}</div>`;
                }
            });

            // Then handle explicit inline math ($...$)
            processedText = processedText.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, math) => {
                try {
                    // Clean up the math content
                    const cleanMath = math.trim()
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/style="[^"]*"/g, '') // Remove style attributes
                        .trim();

                    const rendered = katex.renderToString(cleanMath, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering inline math:', error, 'Math:', math);
                    // Return a fallback that shows the math content
                    return `<span style="border: 1px solid #ccc; padding: 2px 4px; background: #f9f9f9; font-family: monospace; font-size: 0.9em;">${math.trim()}</span>`;
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

            // Clean up malformed \boxed commands with style attributes mixed in
            // Handle patterns like: " style="color:#cc0000">\boxed{content}
            processedText = processedText.replace(/["']\s*style\s*=\s*["'][^"']*["']>\s*\\boxed\{/gi, '\\boxed{');
            processedText = processedText.replace(/style\s*=\s*["'][^"']*["']>\s*\\boxed\{/gi, '\\boxed{');

            // Clean up malformed content inside \boxed that has extra characters
            // Handle patterns like: \boxed{x44\frac{x⁴}{4}4×4 - \frac{x³}{3} + x + C })
            processedText = processedText.replace(/\\boxed\{([^}]*?)(\d+)\s*\\frac\{([^}]+)\}\{([^}]+)\}(\d+)\s*([^}]*?)\}/g, (_, before, extra1, num, den, extra2, after) => {
                // Clean up the content by removing extra numbers and fixing the fraction
                const cleanContent = before + `\\frac{${num}}{${den}}` + after;
                return `\\boxed{${cleanContent}}`;
            });

            // More aggressive cleanup for malformed mathematical expressions
            // Remove extra numbers and characters that appear before fractions
            processedText = processedText.replace(/([a-zA-Z])(\d+)\s*\\frac/g, '$1\\frac');
            processedText = processedText.replace(/\\frac\{([^}]+)\}\{([^}]+)\}(\d+)/g, '\\frac{$1}{$2}');

            // Clean up patterns like "x44" or "4×4" that appear in malformed content
            processedText = processedText.replace(/([a-zA-Z])(\d+)([a-zA-Z])/g, '$1$3');
            processedText = processedText.replace(/(\d+)\s*×\s*(\d+)/g, '');

            // Remove extra characters before fractions in \boxed expressions
            processedText = processedText.replace(/\\boxed\{([a-zA-Z])\s*\\frac/g, '\\boxed{\\frac');

            // Remove malformed parentheses and extra characters at the beginning
            processedText = processedText.replace(/^\([^)]*\)\s*/, '');

            // Remove extra characters and malformed content at the end
            processedText = processedText.replace(/\s*[×\*]\s*\d+\s*\)\s*$/, '');
            processedText = processedText.replace(/\s*\)\s*$/, '');

            // More specific cleanup for patterns like "×4" anywhere in the expression
            processedText = processedText.replace(/[×\*]\d+/g, '');

            // Clean up any remaining malformed patterns
            processedText = processedText.replace(/([a-zA-Z])(\d+)([a-zA-Z])/g, '$1$3');
            processedText = processedText.replace(/(\d+)\s*×\s*(\d+)/g, '');

            // Final cleanup: remove trailing spaces
            processedText = processedText.replace(/\s+$/, '');

            // Clean up spaces inside \boxed expressions
            processedText = processedText.replace(/\\boxed\{([^}]*?)\s+\}/g, (_, content) => {
                const cleanedContent = content.replace(/\s+$/, '').replace(/^\s+/, '');
                return `\\boxed{${cleanedContent}}`;
            });

            // More aggressive cleanup for trailing spaces in \boxed
            processedText = processedText.replace(/\\boxed\{([^}]+)\s+\}/g, '\\boxed{$1}');

            // Very specific cleanup for the exact pattern we're seeing
            processedText = processedText.replace(/\\boxed\{([^}]+)\s+\}/g, (_, content) => {
                const trimmed = content.trim();
                return `\\boxed{${trimmed}}`;
            });

            // Direct cleanup for the specific pattern: C } -> C}
            processedText = processedText.replace(/C\s+\}/g, 'C}');

            // Handle \boxed{} for boxed equations
            processedText = processedText.replace(/\\boxed\{([^}]+)\}/g, (_, content) => {
                try {
                    // Clean up the content by removing HTML tags and LaTeX delimiters
                    let cleanContent = content
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1') // Remove LaTeX delimiters
                        .replace(/\\left\(/g, '(') // Convert \left( to (
                        .replace(/\\right\)/g, ')') // Convert \right) to )
                        .trim();

                    // If content is empty after cleaning, use original
                    if (!cleanContent) {
                        cleanContent = content.replace(/<[^>]*>/g, '').trim();
                    }

                    const rendered = katex.renderToString(`\\boxed{${cleanContent}}`, {
                        displayMode: false,
                        throwOnError: false
                    });
                    return rendered;
                } catch (error) {
                    console.warn('Error rendering boxed content:', error, 'Content:', content);
                    // Process LaTeX delimiters in fallback content too
                    const cleanContent = content
                        .replace(/<[^>]*>/g, '') // Remove HTML tags
                        .replace(/\\\(\s*([^\\]+?)\s*\\\)/g, '$1') // Remove LaTeX delimiters
                        .replace(/\\left\(/g, '(') // Convert \left( to (
                        .replace(/\\right\)/g, ')') // Convert \right) to )
                        .trim();

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

            // NOTE: Markdown headings are now processed early (line 35-40) to avoid interference from HTML cleanup

            // Handle markdown blockquotes
            processedText = processedText.replace(/^> (.+)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>');

            // Merge consecutive blockquotes
            processedText = processedText.replace(/(<\/blockquote>\s*<blockquote class="markdown-blockquote">)/g, '<br>');

            // Handle markdown strikethrough ~~text~~
            processedText = processedText.replace(/~~([^~]+?)~~/g, '<del class="markdown-strikethrough">$1</del>');

            // NOTE: Bold and italic are now processed early (line 43-44) to avoid interference

            // Handle markdown links [text](url) and [text](url "title")
            processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (_, text, url, title) => {
                const titleAttr = title ? ` title="${title}"` : '';
                return `<a href="${url}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
            });

            // Handle reference-style links [text][ref] and [ref]: url
            // First, collect all reference definitions
            const referenceMap: { [key: string]: string } = {};
            processedText = processedText.replace(/^\[([^\]]+)\]:\s*(.+)$/gm, (_, ref, url) => {
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
            processedText = processedText.replace(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
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
            processedText = processedText.replace(/^- \[([ x])\] (.+)$/gm, (_, checked, text) => {
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
            processedText = processedText.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_, ref, content) => {
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

            // Debug logging for output - TEMPORARY for debugging
            console.log('[LatexRenderer] Output length:', processedText?.length || 0);
            console.log('[LatexRenderer] First 300 chars of output:', processedText?.substring(0, 300) || 'empty');
            console.log('[LatexRenderer] Still has backslash-space patterns:', /\\\s/.test(processedText || ''));
            console.log('[LatexRenderer] Has KaTeX spans:', processedText?.includes('katex') || false);

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
        />
    );
};

export default LatexRenderer;

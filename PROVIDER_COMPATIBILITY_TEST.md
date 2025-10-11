# Provider Compatibility Testing Guide

Quick reference for testing LatexRenderer with all 10 providers in your system.

## Test Prompt

Use this mathematical prompt to test all providers simultaneously:

```
Solve the quadratic equation x² - 5x + 6 = 0 using the quadratic formula.
Show your work step by step and box the final answer.
```

## Expected Behaviors by Provider

### 🟢 High Quality LaTeX (Minimal Processing Needed)

- **OpenAI** (GPT-5, GPT-4o): Clean `$$` and `$` delimiters
- **Anthropic** (Claude): May use `[ answer ]` wrapping
- **Mistral** (Large, Devstral): Excellent LaTeX formatting
- **xAI** (Grok 4): Good delimiter usage

### 🟡 Moderate Processing (Common Issues)

- **DeepSeek** (V3.2, R1): Missing backslashes, mixed notation
- **Microsoft** (Phi, WizardLM): Implicit math, simplified notation
- **Qwen** (Qwen3): Variable quality, thinking chains with informal math
- **Cohere** (Command R+): Unicode symbols, occasional formatting quirks

### 🔴 Heavy Processing (Known Issues)

- **Google** (Gemini): **Frequent MathML output** - most aggressive cleanup needed
- **Meta** (LLaMA): Missing backslashes very common, variable quality

## What the LatexRenderer Handles

### For ALL Providers:

✅ Multiple delimiter types ($$, $, \[\], \(\))
✅ Missing backslashes (`frac` → `\frac`)
✅ Implicit math in parentheses `( x^2 )`
✅ Unicode symbols (x², ≠, ≤, α, β)
✅ Boxed answers with various wrapping styles
✅ Mixed notation within same response
✅ Code blocks (preserved, not rendered as math)

### Provider-Specific Handling:

**Gemini (Google)**

- Removes `<math xmlns="http://www.w3.org/1998/Math/MathML">` tags
- Strips `<mi>`, `<mn>`, `<mo>` elements
- Cleans up W3C URLs

**LLaMA (Meta)**

- Adds missing `\` to LaTeX commands
- Fixes malformed `\boxed{}` wrappers
- Handles severely broken LaTeX

**Claude (Anthropic)**

- Converts `[ answer ]` to inline math `\( answer \)`
- Handles `( x^2 )` emphasis notation

**All Others**

- Standard cleanup and normalization
- Unicode to LaTeX conversion
- Delimiter normalization

## Testing Each Provider

### Quick Test (Single Provider)

```typescript
// Test with one model from each provider
const testModels = [
  "anthropic/claude-sonnet-4.5",
  "cohere/command-r-plus-08-2024",
  "deepseek/deepseek-chat-v3.1",
  "google/gemini-2.5-pro",
  "meta-llama/llama-3.3-70b-instruct",
  "microsoft/phi-4",
  "mistralai/mistral-large",
  "openai/gpt-4o",
  "qwen/qwen3-max",
  "x-ai/grok-4",
];
```

### Comprehensive Test (All Models)

Use your existing 12-model limit to test batches:

- Batch 1: 12 models from different providers
- Check for rendering errors in browser console
- Verify no MathML/SVG artifacts visible
- Confirm math renders correctly

## Visual Inspection Checklist

For each provider's response, check:

- [ ] No visible MathML (`<math>`, `xmlns`, `www.w3.org`)
- [ ] No visible HTML artifacts (`<span>`, `class=`, `style=`)
- [ ] Math expressions render (not plain text)
- [ ] Fractions display properly (not `frac{a}{b}`)
- [ ] Greek letters render (not `\alpha` as text)
- [ ] Boxed answers have borders (not plain text)
- [ ] Code blocks preserved (if any)
- [ ] Lists and formatting intact

## Common Issues and Solutions

### Issue: Math shows as plain LaTeX

**Symptom**: See `$x^2$` or `\frac{1}{2}` as text
**Cause**: Missing KaTeX CSS or JavaScript
**Solution**: Verify KaTeX is loaded in your HTML

### Issue: MathML visible in output

**Symptom**: See `<math>`, `xmlns`, or W3C URLs
**Cause**: Both backend and frontend cleanup failed
**Solution**: Check browser console for errors in LatexRenderer

### Issue: Code blocks render as math

**Symptom**: Python/code formatted as equations
**Cause**: Code block regex not matching
**Solution**: Verify triple backticks are on their own lines

### Issue: Performance slow with certain providers

**Symptom**: Long render time for responses
**Cause**: Complex nested math or very long responses
**Solution**: Normal - first render is slower, subsequent renders cached

## Provider-Specific Quirks

### Gemini (Most Problematic)

- Outputs MathML frequently
- Mixed delimiters in same response
- Solution: Both backend and frontend cleanup layers active

### LLaMA (Variable Quality)

- Quality varies by model version (3.3 vs 4 Scout)
- Missing backslashes very common
- Solution: Automatic backslash insertion

### Qwen (Multilingual)

- May mix mathematical notation styles
- Thinking models show informal reasoning
- Solution: Flexible heuristic parsing

### Cohere (Unicode Heavy)

- Prefers Unicode symbols over LaTeX
- Example: × instead of \times
- Solution: Unicode to LaTeX mapping

## Success Criteria

✅ **100% Compatibility**: All 10 providers render without errors
✅ **No Artifacts**: No visible HTML/MathML/SVG in output
✅ **Correct Rendering**: Math displays as formatted equations
✅ **Graceful Failures**: Malformed LaTeX shows in fallback style (not crash)
✅ **Fast Performance**: < 100ms render time for typical responses

## Monitoring in Production

Track these metrics per provider:

1. **Rendering errors** (from console.warn)
2. **Fallback usage** (when KaTeX fails)
3. **Cleanup triggers** (MathML/SVG detected)
4. **Performance** (render time)

Add this to your frontend logging:

```typescript
// In LatexRenderer
if (processedText.includes("MathML") || processedText.includes("katex")) {
  analytics.track("latex_cleanup_needed", { provider });
}
```

## Continuous Testing

As you add new models or providers:

1. **Run test prompt** on new model
2. **Check visual output** for artifacts
3. **Review browser console** for errors
4. **Update documentation** if new patterns found

The LatexRenderer should handle new providers automatically without code changes!

## Support

If a provider produces output that breaks rendering:

1. Save the raw response (check Network tab)
2. Copy the problematic LaTeX
3. Add as test case to `latex-renderer-test-cases.md`
4. Open issue with provider name and sample

The architecture is designed to be extended - new patterns can be added to the cleanup stages without breaking existing functionality.

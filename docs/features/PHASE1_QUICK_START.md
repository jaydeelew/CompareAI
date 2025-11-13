# Phase 1 Quick Start Guide

This guide provides quick instructions for running Phase 1: Response Collection and Analysis.

## Prerequisites

1. **Backend Environment Setup**
   ```bash
   cd backend
   # Ensure virtual environment is activated
   # Ensure all dependencies are installed
   ```

2. **OpenRouter API Key**
   - Must be set in environment variables or `.env` file
   - Verify it's working: `python -c "from app.model_runner import OPENROUTER_API_KEY; print('API key loaded')"`

## Quick Test Run

Before collecting from all models, test with a small subset:

```bash
cd backend

# Test with one model and one prompt
python scripts/collect_model_responses.py \
  --models anthropic/claude-sonnet-4.5 \
  --prompts complex_math_display \
  --delay 2.0
```

This will:
- Test one model with one prompt
- Save results to `data/model_responses/model_responses_TIMESTAMP.json`
- Take about 30 seconds

## Full Collection

Once testing works, run full collection:

```bash
cd backend

# Collect from all models (takes 1-3 hours)
python scripts/collect_model_responses.py --delay 1.5

# Or collect in batches by provider
python scripts/collect_model_responses.py \
  --models anthropic/claude-sonnet-4.5 anthropic/claude-haiku-4.5 \
  --delay 1.0
```

**Tips:**
- Use `--delay 1.5` or higher to avoid rate limits
- Run during off-peak hours for better API performance
- The script saves progress incrementally, so you can stop and resume
- Use `--quiet` to reduce output if running in background

## Analyze Results

After collection completes:

```bash
cd backend

# Analyze the collected responses
python scripts/analyze_responses.py \
  data/model_responses/model_responses_YYYYMMDD_HHMMSS.json
```

This creates:
- `data/analysis/analysis_TIMESTAMP.json` - Detailed analysis data
- `data/analysis/analysis_TIMESTAMP.md` - Human-readable report

## Review Analysis Report

Open the markdown report to see:
- Summary statistics
- Common issues across models
- Per-model analysis:
  - Math delimiter patterns found
  - Markdown elements used
  - Rendering issues identified
  - Code block preservation status
  - Models needing manual review

## Available Test Prompts

The test suite includes 12 prompts:

1. `complex_math_display` - Complex display math with multiple equations
2. `inline_math_mixed` - Inline math expressions mixed with text
3. `markdown_lists` - Markdown lists with various formatting
4. `markdown_headers` - Markdown headers and structured content
5. `markdown_tables` - Markdown tables with math content
6. `edge_cases_dollar_signs` - Edge cases with dollar signs
7. `code_blocks_preservation` - Code blocks with various languages
8. `mixed_content_complex` - Complex mixed content with all types
9. `blockquotes_and_special` - Blockquotes and special markdown
10. `unicode_and_special_chars` - Unicode and special symbols
11. `fractions_and_complex_expressions` - Complex fractions and nested expressions
12. `links_and_references` - Links and references with math

## Troubleshooting

### Import Errors
```bash
# Ensure you're in the backend directory
cd backend

# Verify Python path
python -c "import sys; print(sys.path)"
```

### Rate Limiting
- Increase `--delay` value (try 2.0 or 3.0)
- Check OpenRouter dashboard for rate limit status
- Run collection in smaller batches

### Timeouts
- Some models are slower - script retries automatically
- Check network connectivity
- Verify API key permissions

### Partial Results
- Script saves incrementally, so partial results are preserved
- You can analyze partial results if needed
- Re-run collection to fill in missing data

## Understanding the Analysis Report

The analysis report identifies models that have formatting issues or complex patterns. The "needs manual review" flag indicates that:

- **During Implementation:** The AI assistant will use best practices and the analysis data to create appropriate renderer configurations for all models, including those flagged for review
- **After Implementation:** Once the model-specific rendering is deployed and running, you will manually examine the rendered results on the website to verify quality and identify any adjustments needed

The analysis data provides the foundation for automated configuration generation - it identifies patterns, but the actual review and refinement happens post-deployment when you can see the actual rendered output.

## Next Steps

After completing Phase 1:
1. Review the analysis report to understand the scope of work
2. Note common patterns and issues (these will inform the implementation)
3. Proceed to Phase 2: Renderer Architecture Design

**Implementation Workflow:**
- The AI assistant will implement the model-specific rendering features using best practices
- Configurations will be generated based on the analysis data
- After deployment, you will manually review the rendered results on the website
- Any necessary adjustments will be made based on your review

For detailed documentation, see:
- `/docs/features/MODEL_SPECIFIC_RENDERING.md` - Full implementation guide
- `/backend/scripts/README.md` - Script documentation


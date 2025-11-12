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
- The script saves progress incrementally after each model completes, so you can stop and resume
- If interrupted, simply run the script again with the same arguments - it will automatically resume from the most recent file
- Use `--output-file FILENAME` to specify a specific file to resume from
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

### Partial Results and Resuming
- **Incremental Saving**: The script automatically saves results after each model completes, so partial results are preserved even if interrupted
- **Automatic Resume**: If you run the script again, it will automatically detect the most recent results file and resume collection, skipping already-collected model/prompt combinations
- **Manual Resume**: Use `--output-file FILENAME` to specify a specific file to resume from
- **Analyze Partial Results**: You can analyze partial results at any time - the analysis script works with incomplete data
- When resuming, the script will show how many combinations are already collected and how many remain

## Next Steps

After completing Phase 1:
1. Review the analysis report
2. Identify models needing manual review
3. Note common patterns and issues
4. Proceed to Phase 2: Renderer Architecture Design

For detailed documentation, see:
- `/docs/features/MODEL_SPECIFIC_RENDERING.md` - Full implementation guide
- `/backend/scripts/README.md` - Script documentation


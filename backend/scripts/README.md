# Model-Specific Rendering Scripts

This directory contains scripts for Phase 1 of the model-specific rendering implementation: Response Collection and Analysis.

## Overview

These scripts are used to:
1. Collect raw responses from all AI models using comprehensive test prompts
2. Analyze the responses to identify formatting patterns, delimiters, and issues
3. Generate data needed for creating model-specific renderer configurations

## Scripts

### `test_prompts.py`

Defines comprehensive test prompts designed to elicit various formatting patterns from AI models.

**Features:**
- 12 different test prompts covering:
  - Complex mathematical expressions (display and inline)
  - Markdown elements (bold, italic, lists, links, headers, tables)
  - Edge cases (dollar signs in text, code blocks with math)
  - Special formatting (blockquotes, horizontal rules)
  - Code block preservation tests

**Usage:**
```python
from scripts.test_prompts import TEST_PROMPTS, get_prompt_by_name

# Get all prompts
all_prompts = TEST_PROMPTS

# Get specific prompt
prompt = get_prompt_by_name("complex_math_display")
```

### `collect_model_responses.py`

Collects raw responses from all available models for each test prompt.

**Usage:**
```bash
# Collect from all models with all prompts
python scripts/collect_model_responses.py

# Collect from specific models
python scripts/collect_model_responses.py --models anthropic/claude-sonnet-4.5 openai/gpt-4o

# Collect with specific prompts only
python scripts/collect_model_responses.py --prompts complex_math_display markdown_lists

# Custom output directory
python scripts/collect_model_responses.py --output-dir custom/path

# Adjust rate limiting
python scripts/collect_model_responses.py --delay 2.0 --max-retries 5

# Quiet mode
python scripts/collect_model_responses.py --quiet
```

**Options:**
- `--models`: Specific model IDs to test (default: all available models)
- `--prompts`: Specific prompt names to use (default: all prompts)
- `--output-dir`: Directory to save responses (default: `backend/data/model_responses`)
- `--delay`: Delay between requests in seconds (default: 1.0)
- `--max-retries`: Maximum retries for failed requests (default: 3)
- `--quiet`: Suppress verbose output

**Output:**
- Saves JSON file with all collected responses
- Includes metadata: timestamps, success/failure status, errors
- File naming: `model_responses_YYYYMMDD_HHMMSS.json`

### `analyze_responses.py`

Analyzes collected responses to identify rendering patterns and issues.

**Usage:**
```bash
# Analyze responses file
python scripts/analyze_responses.py backend/data/model_responses/model_responses_20250101_120000.json

# Custom output directory
python scripts/analyze_responses.py responses.json --output-dir custom/analysis

# Output format options
python scripts/analyze_responses.py responses.json --format json
python scripts/analyze_responses.py responses.json --format markdown
python scripts/analyze_responses.py responses.json --format both  # default

# Quiet mode
python scripts/analyze_responses.py responses.json --quiet
```

**Options:**
- `responses_file`: Path to collected responses JSON file (required)
- `--output-dir`: Directory to save analysis results (default: `backend/data/analysis`)
- `--format`: Output format - `json`, `markdown`, or `both` (default: `both`)
- `--quiet`: Suppress verbose output

**Output:**
- JSON file with detailed analysis data
- Markdown report with human-readable summary
- Identifies:
  - Math delimiter patterns (display and inline)
  - Markdown elements used
  - Rendering issues found
  - Code block preservation status
  - Models needing manual review

## Workflow

### Step 1: Collect Responses

```bash
# Collect responses from all models (this may take a while)
cd backend
python scripts/collect_model_responses.py

# This will create: data/model_responses/model_responses_TIMESTAMP.json
```

**Note:** Collection may take significant time depending on:
- Number of models (50+)
- Number of prompts (12)
- API rate limits
- Network speed

Estimated time: 1-3 hours for all models and prompts.

### Step 2: Analyze Responses

```bash
# Analyze the collected responses
python scripts/analyze_responses.py data/model_responses/model_responses_TIMESTAMP.json

# This will create:
# - data/analysis/analysis_TIMESTAMP.json (detailed data)
# - data/analysis/analysis_TIMESTAMP.md (human-readable report)
```

### Step 3: Review Analysis

1. Open the markdown report to see summary
2. Review models that need manual review
3. Check for common issues across models
4. Identify patterns for renderer configuration

## Directory Structure

```
backend/
├── scripts/
│   ├── __init__.py
│   ├── test_prompts.py
│   ├── collect_model_responses.py
│   ├── analyze_responses.py
│   └── README.md
└── data/
    ├── model_responses/      # Collected responses (created by collection script)
    │   └── model_responses_*.json
    └── analysis/             # Analysis results (created by analysis script)
        ├── analysis_*.json
        └── analysis_*.md
```

## Requirements

- Python 3.8+
- Access to OpenRouter API (via environment variables)
- All dependencies from `backend/requirements.txt`

## Error Handling

The collection script includes:
- Automatic retry with exponential backoff for rate limits
- Timeout handling
- Error logging and reporting
- Graceful handling of unavailable models
- Partial results saving (if interrupted)

## Best Practices

1. **Start Small**: Test with a few models first before running full collection
   ```bash
   python scripts/collect_model_responses.py --models anthropic/claude-sonnet-4.5 --prompts complex_math_display
   ```

2. **Monitor Rate Limits**: Adjust `--delay` if you hit rate limits frequently

3. **Save Progress**: The script saves results incrementally, so partial results are preserved

4. **Review Analysis**: Always review the markdown report before proceeding to configuration generation

5. **Version Control**: Don't commit collected response files (they're large and change frequently)

## Troubleshooting

### Rate Limiting
- Increase `--delay` value
- Run collection in smaller batches (use `--models` to select subset)
- Check OpenRouter API status

### Timeouts
- Some models may be slower - the script retries automatically
- Check network connectivity
- Verify API key is valid

### Import Errors
- Ensure you're running from the backend directory
- Check that all dependencies are installed
- Verify Python path includes backend directory

## Next Steps

After completing Phase 1 (collection and analysis), proceed to:
- **Phase 2**: Renderer Architecture Design
- **Phase 3**: Configuration Generation
- **Phase 4**: Renderer Implementation

See `/docs/features/MODEL_SPECIFIC_RENDERING.md` for the complete implementation guide.


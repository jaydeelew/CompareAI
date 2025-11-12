# Comments Extractor

This folder contains a script that extracts all comments from the entire project and generates a markdown file with clickable links to each comment.

## Files

- `extract_comments.py` - The Python script that scans the project and extracts comments
- `project_comments.md` - The generated markdown file containing all extracted comments

## Requirements

- Python 3.6 or higher
- No additional dependencies required (uses only Python standard library)

## How to Run

From the project root directory, run:

```bash
python3 comments/extract_comments.py
```

Or if you're already in the `comments` folder:

```bash
python3 extract_comments.py
```

The script will:
1. Scan all files in the project (excluding `node_modules`, `venv`, `.git`, and other common directories)
2. Extract comments from supported file types:
   - Python (`.py`) - `#` comments
   - TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`) - `//` and `/* */` comments
   - Shell scripts (`.sh`, `.bash`) - `#` comments
   - And many other file types
3. Generate `project_comments.md` with all comments, file names, line numbers, and clickable links

## Output

The script generates `project_comments.md` which contains:
- Total number of comments found
- Number of files with comments
- A list of all comments organized by file
- Each comment includes:
  - File name (relative path)
  - Line number
  - Clickable link that opens the file in VS Code/Cursor at the specific line
  - The comment text and full line content

## Clickable Links

The generated markdown file uses relative path links with line numbers (e.g., `./README.md:41:1`) that should work with:
- VS Code markdown preview
- Cursor markdown preview
- Other editors that support file links with line numbers

**Note for WSL/Windows users:** If clicking links doesn't work in Cursor's markdown preview, you can:
1. Use Ctrl+Click (or Cmd+Click on Mac) to open the file
2. Use the file explorer to navigate to the file manually
3. Use Cursor's search (Ctrl+P) to quickly find and open files by name

The links are formatted as relative paths from the workspace root, which should resolve correctly when the markdown file is opened from within the workspace.

## Regenerating the Comments File

Simply run the script again to regenerate `project_comments.md` with the latest comments from your project. The previous file will be overwritten.

## Notes

- The script automatically skips common directories like `node_modules`, `venv`, `.git`, `__pycache__`, etc.
- Comments inside strings are filtered out (e.g., `print("# This is not a comment")`)
- The script handles multi-line comments for JavaScript/TypeScript files
- Markdown files are also scanned, so markdown headers (which use `#`) will appear in the output


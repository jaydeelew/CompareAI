#!/usr/bin/env python3
"""
Script to extract all comments from the project and generate a markdown file
with file names, line numbers, and clickable links.
"""

import os
import re
from pathlib import Path
from typing import List, Tuple, Dict
from urllib.parse import quote

# Directories to skip
SKIP_DIRS = {
    'node_modules', 'venv', '.git', '__pycache__', '.pytest_cache',
    'dist', 'build', '.next', '.vscode', '.idea', 'coverage',
    'comments'  # Skip the comments folder itself
}

# File extensions to process
SUPPORTED_EXTENSIONS = {
    '.py', '.ts', '.tsx', '.js', '.jsx', '.sh', '.bash',
    '.yaml', '.yml', '.json', '.md', '.html', '.css', '.scss',
    '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.go', '.rs',
    '.rb', '.php', '.sql', '.vue', '.svelte'
}

class CommentExtractor:
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir).resolve()
        self.comments: List[Dict] = []
        
    def should_skip(self, file_path: Path) -> bool:
        """Check if file or directory should be skipped."""
        # Check if any parent directory is in skip list
        parts = file_path.parts
        for part in parts:
            if part in SKIP_DIRS:
                return True
        return False
    
    def extract_python_comments(self, content: str, file_path: Path) -> List[Dict]:
        """Extract comments from Python files."""
        comments = []
        lines = content.split('\n')
        in_multiline_string = False
        string_char = None
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            # Skip empty lines
            if not stripped:
                continue
            
            # Track multiline strings (docstrings)
            # Simple heuristic: check for triple quotes
            if '"""' in line or "'''" in line:
                # Toggle multiline string state
                quote_count_3 = line.count('"""') + line.count("'''")
                if quote_count_3 % 2 == 1:
                    in_multiline_string = not in_multiline_string
                    if in_multiline_string:
                        string_char = '"""' if '"""' in line else "'''"
                    else:
                        string_char = None
            
            # Skip if we're inside a multiline string (docstring)
            if in_multiline_string:
                continue
            
            # Find # comments (not inside strings)
            comment_match = re.search(r'#', line)
            if comment_match:
                # Check if # is inside a string
                before_comment = line[:comment_match.start()]
                # Simple check: if there's an odd number of quotes before #, it's in a string
                single_quotes = before_comment.count("'") - before_comment.count("\\'")
                double_quotes = before_comment.count('"') - before_comment.count('\\"')
                
                if single_quotes % 2 == 0 and double_quotes % 2 == 0:
                    comment_text = line[comment_match.start():].strip()
                    if comment_text.startswith('#'):
                        comments.append({
                            'file': str(file_path),
                            'line': line_num,
                            'comment': comment_text,
                            'full_line': line.rstrip()
                        })
        
        return comments
    
    def extract_js_ts_comments(self, content: str, file_path: Path) -> List[Dict]:
        """Extract comments from JavaScript/TypeScript files."""
        comments = []
        lines = content.split('\n')
        in_multiline_comment = False
        multiline_start_line = 0
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            # Skip empty lines
            if not stripped:
                continue
            
            # Handle multiline comments /* ... */
            if '/*' in line:
                if '*/' in line:
                    # Single line multiline comment
                    comment_match = re.search(r'/\*.*?\*/', line)
                    if comment_match:
                        comment_text = comment_match.group(0)
                        comments.append({
                            'file': str(file_path),
                            'line': line_num,
                            'comment': comment_text.strip(),
                            'full_line': line.rstrip()
                        })
                else:
                    # Start of multiline comment
                    in_multiline_comment = True
                    multiline_start_line = line_num
                    comment_start = line.find('/*')
                    comment_text = line[comment_start:].strip()
                    comments.append({
                        'file': str(file_path),
                        'line': line_num,
                        'comment': comment_text,
                        'full_line': line.rstrip()
                    })
            
            elif '*/' in line and in_multiline_comment:
                # End of multiline comment
                comment_end = line.find('*/') + 2
                comment_text = line[:comment_end].strip()
                # Update the last comment if it's a continuation
                if comments and comments[-1]['line'] == multiline_start_line:
                    comments[-1]['comment'] += ' ' + comment_text
                in_multiline_comment = False
            
            elif in_multiline_comment:
                # Continuation of multiline comment
                if comments and comments[-1]['line'] == multiline_start_line:
                    comments[-1]['comment'] += ' ' + line.strip()
                    comments[-1]['full_line'] += '\n' + line.rstrip()
            
            else:
                # Single line comments //
                comment_match = re.search(r'//', line)
                if comment_match:
                    # Check if // is inside a string
                    before_comment = line[:comment_match.start()]
                    # Simple check: if there's an odd number of quotes before //, it's in a string
                    single_quotes = before_comment.count("'") - before_comment.count("\\'")
                    double_quotes = before_comment.count('"') - before_comment.count('\\"')
                    backticks = before_comment.count('`') - before_comment.count('\\`')
                    
                    if (single_quotes % 2 == 0 and double_quotes % 2 == 0 and 
                        backticks % 2 == 0):
                        comment_text = line[comment_match.start():].strip()
                        if comment_text.startswith('//'):
                            comments.append({
                                'file': str(file_path),
                                'line': line_num,
                                'comment': comment_text,
                                'full_line': line.rstrip()
                            })
        
        return comments
    
    def extract_shell_comments(self, content: str, file_path: Path) -> List[Dict]:
        """Extract comments from shell scripts."""
        comments = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            # Skip empty lines
            if not stripped:
                continue
            
            # Find # comments (not inside strings)
            comment_match = re.search(r'#', line)
            if comment_match:
                # Check if # is inside a string
                before_comment = line[:comment_match.start()]
                # Simple check: if there's an odd number of quotes before #, it's in a string
                single_quotes = before_comment.count("'") - before_comment.count("\\'")
                double_quotes = before_comment.count('"') - before_comment.count('\\"')
                
                if single_quotes % 2 == 0 and double_quotes % 2 == 0:
                    comment_text = line[comment_match.start():].strip()
                    if comment_text.startswith('#'):
                        comments.append({
                            'file': str(file_path),
                            'line': line_num,
                            'comment': comment_text,
                            'full_line': line.rstrip()
                        })
        
        return comments
    
    def extract_comments_from_file(self, file_path: Path) -> List[Dict]:
        """Extract comments from a file based on its extension."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return []
        
        ext = file_path.suffix.lower()
        
        if ext == '.py':
            return self.extract_python_comments(content, file_path)
        elif ext in ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte']:
            return self.extract_js_ts_comments(content, file_path)
        elif ext in ['.sh', '.bash']:
            return self.extract_shell_comments(content, file_path)
        elif ext in ['.yaml', '.yml', '.json', '.md', '.html', '.css', '.scss',
                     '.java', '.cpp', '.c', '.h', '.hpp', '.cs', '.go', '.rs',
                     '.rb', '.php', '.sql']:
            # For other file types, try to extract # comments (common in many languages)
            return self.extract_shell_comments(content, file_path)
        else:
            return []
    
    def scan_project(self):
        """Scan the entire project for comments."""
        print(f"Scanning project: {self.root_dir}")
        
        for root, dirs, files in os.walk(self.root_dir):
            # Remove directories we want to skip
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            
            for file in files:
                file_path = Path(root) / file
                
                # Skip if in a directory we should skip
                if self.should_skip(file_path):
                    continue
                
                # Check if file extension is supported
                if file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                    comments = self.extract_comments_from_file(file_path)
                    self.comments.extend(comments)
                    if comments:
                        print(f"Found {len(comments)} comment(s) in {file_path.relative_to(self.root_dir)}")
    
    def generate_markdown(self, output_path: Path):
        """Generate markdown file with all comments."""
        # Group comments by file
        comments_by_file: Dict[str, List[Dict]] = {}
        for comment in self.comments:
            rel_path = str(Path(comment['file']).relative_to(self.root_dir))
            if rel_path not in comments_by_file:
                comments_by_file[rel_path] = []
            comments_by_file[rel_path].append(comment)
        
        # Sort files alphabetically
        sorted_files = sorted(comments_by_file.keys())
        
        # Generate markdown content
        md_content = ["# Project Comments\n"]
        md_content.append(f"Total comments found: {len(self.comments)}\n")
        md_content.append(f"Files with comments: {len(sorted_files)}\n\n")
        md_content.append("---\n\n")
        
        for file_path in sorted_files:
            comments = sorted(comments_by_file[file_path], key=lambda x: x['line'])
            
            md_content.append(f"## {file_path}\n\n")
            
            for comment in comments:
                # Create link that opens file at the specific line
                # Use file:/// protocol with absolute path (same format as UI_ELEMENTS_DOCUMENTATION.md)
                abs_path = Path(comment['file']).resolve()
                # Convert to forward slashes
                path_str = str(abs_path).replace('\\', '/')
                # Remove leading slash to avoid double slash after file:///
                if path_str.startswith('/'):
                    path_str = path_str[1:]
                # Format: file:///absolute/path/to/file#Lline_number
                link = f"file:///{path_str}#L{comment['line']}"
                
                # Escape markdown special characters in comment text
                comment_text = comment['comment'].replace('|', '\\|')
                full_line = comment['full_line'].replace('|', '\\|')
                
                md_content.append(f"- **Line {comment['line']}**: [{comment_text[:100]}{'...' if len(comment_text) > 100 else ''}]({link})\n")
                md_content.append(f"  ```\n  {full_line}\n  ```\n\n")
            
            md_content.append("---\n\n")
        
        # Write to file
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(''.join(md_content))
        
        print(f"\nGenerated markdown file: {output_path}")
        print(f"Total comments: {len(self.comments)}")
        print(f"Files processed: {len(sorted_files)}")


def main():
    # Get the root directory (parent of comments folder)
    script_dir = Path(__file__).parent
    root_dir = script_dir.parent
    
    extractor = CommentExtractor(str(root_dir))
    extractor.scan_project()
    
    output_path = script_dir / "project_comments.md"
    extractor.generate_markdown(output_path)


if __name__ == '__main__':
    main()


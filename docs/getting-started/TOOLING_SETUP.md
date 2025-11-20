# Modern Tooling Setup Guide

This document describes the modern development tooling configured for CompareIntel as part of Phase 1, Week 1, Task 3.

## Overview

Both frontend and backend have been configured with modern linting, formatting, and pre-commit hooks to ensure code quality and consistency.

## Frontend Tooling

### ESLint 9+ (Flat Config)

- **Configuration:** `frontend/eslint.config.js`
- **Features:**
  - TypeScript support via `typescript-eslint`
  - React hooks linting
  - Import ordering and duplicate detection
  - Prettier integration (conflicts disabled)
- **Usage:**
  ```bash
  cd frontend
  npm run lint          # Check for linting errors
  npm run lint:fix      # Auto-fix linting errors
  ```

### Prettier

- **Configuration:** `frontend/.prettierrc.json`
- **Features:**
  - Format-on-save in VS Code (configured in `.vscode/settings.json`)
  - Consistent code formatting
- **Usage:**
  ```bash
  cd frontend
  npm run format        # Format all files
  npm run format:check  # Check formatting without fixing
  ```

### TypeScript Strict Mode

- **Configuration:** `frontend/tsconfig.app.json`
- **Status:** ✅ Already enabled
- **Features:**
  - Strict type checking
  - No unused locals/parameters
  - No fallthrough cases in switch
- **Usage:**
  ```bash
  cd frontend
  npm run type-check    # Type check without building
  ```

### Husky & lint-staged

- **Configuration:**
  - `.husky/pre-commit` - Pre-commit hook
  - `frontend/.lintstagedrc.json` - Lint-staged configuration
- **Features:**
  - Automatically runs linting and formatting on staged files before commit
  - Prevents committing code with linting errors
- **Setup:**
  ```bash
  cd frontend
  npm install          # Installs dependencies and runs 'prepare' script
  ```

## Backend Tooling

### Ruff (Fast Python Linter)

- **Configuration:** `backend/pyproject.toml` (under `[tool.ruff]`)
- **Features:**
  - Replaces flake8, isort, and other linting tools
  - Extremely fast (written in Rust)
  - Import sorting
  - Code quality checks
- **Usage:**
  ```bash
  cd backend
  ruff check .          # Check for linting errors
  ruff check --fix .    # Auto-fix linting errors
  ruff format .         # Format code (black-compatible)
  ```

### Black (Code Formatter)

- **Configuration:** `backend/pyproject.toml` (under `[tool.black]`)
- **Features:**
  - Consistent Python code formatting
  - 100 character line length
- **Usage:**
  ```bash
  cd backend
  black .               # Format all Python files
  black --check .       # Check formatting without fixing
  ```

### mypy (Type Checker)

- **Configuration:** `backend/pyproject.toml` (under `[tool.mypy]`)
- **Features:**
  - Static type checking
  - Strict mode enabled
  - Type stub support for third-party libraries
- **Usage:**
  ```bash
  cd backend
  mypy app/            # Type check the application code
  ```

### pre-commit

- **Configuration:** `.pre-commit-config.yaml`
- **Features:**
  - Runs ruff, black, and mypy on commit
  - Checks for common issues (trailing whitespace, large files, etc.)
- **Setup:**
  ```bash
  # Install pre-commit hooks
  pre-commit install
  
  # Run manually on all files
  pre-commit run --all-files
  ```

## VS Code Integration

Format-on-save is configured in `frontend/.vscode/settings.json`:
- Prettier formats TypeScript, JSON, and other files on save
- ESLint auto-fixes issues on save
- TypeScript uses workspace version

## Initial Setup

### Frontend

```bash
cd frontend
npm install              # Install dependencies (including Husky)
```

### Backend

```bash
cd backend
pip install -r requirements.txt  # Install dependencies (including ruff, mypy, black, pre-commit)
pre-commit install      # Install pre-commit hooks
```

## Daily Workflow

### Before Committing

1. **Frontend:**
   - Files are automatically linted and formatted on save (if using VS Code)
   - Pre-commit hook runs `lint-staged` automatically
   - Or manually: `npm run lint:fix && npm run format`

2. **Backend:**
   - Pre-commit hook runs ruff, black, and mypy automatically
   - Or manually: `ruff check --fix . && black . && mypy app/`

### IDE Integration

- **VS Code:** Format-on-save is enabled for frontend files
- **PyCharm:** Can configure to run black and ruff on save
- **Other IDEs:** Use the command-line tools or configure manually

## Troubleshooting

### Frontend

**ESLint errors in config:**
- Make sure all dependencies are installed: `npm install`
- Check that `eslint-plugin-import` resolver is configured correctly

**Husky not running:**
- Run `npm install` again to trigger the `prepare` script
- Check that `.husky/pre-commit` is executable: `chmod +x .husky/pre-commit`

### Backend

**Ruff/Black not found:**
- Install dependencies: `pip install -r requirements.txt`
- Make sure you're in a virtual environment

**mypy errors:**
- Install type stubs: They're included in `requirements.txt`
- Some third-party libraries may need `--ignore-missing-imports` flag

**pre-commit not running:**
- Install hooks: `pre-commit install`
- Check `.git/hooks/pre-commit` exists

## Configuration Files

- `frontend/eslint.config.js` - ESLint configuration
- `frontend/.prettierrc.json` - Prettier configuration
- `frontend/.lintstagedrc.json` - lint-staged configuration
- `frontend/.vscode/settings.json` - VS Code settings
- `.husky/pre-commit` - Git pre-commit hook
- `backend/pyproject.toml` - Ruff, Black, and mypy configuration
- `.pre-commit-config.yaml` - Pre-commit hooks configuration

## Next Steps

After completing this setup:

1. Run all tools to check current codebase:
   ```bash
   # Frontend
   cd frontend && npm run lint && npm run format:check && npm run type-check
   
   # Backend
   cd backend && ruff check . && black --check . && mypy app/
   ```

2. Fix any issues found (start with auto-fixable ones)

3. Commit the tooling configuration:
   ```bash
   git add .
   git commit -m "chore: setup modern tooling (ESLint, Prettier, Ruff, mypy, pre-commit)"
   ```

4. Continue with Phase 1, Week 1, Task 4: Clean Project Structure


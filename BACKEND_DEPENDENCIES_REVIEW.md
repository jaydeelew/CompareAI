# Backend Dependencies Review

**Date:** October 18, 2025  
**Purpose:** Audit `requirements.txt` to identify necessary vs unnecessary packages

---

## Current Dependencies Analysis

### ✅ **REQUIRED** - Core Functionality

| Package                       | Version   | Used In                                                     | Purpose                    |
| ----------------------------- | --------- | ----------------------------------------------------------- | -------------------------- |
| **fastapi**                   | >=0.100.0 | `app/main.py`, `app/routers/auth.py`, `app/dependencies.py` | Main web framework         |
| **uvicorn**                   | >=0.20.0  | `entrypoint.sh`                                             | ASGI server (production)   |
| **gunicorn**                  | (latest)  | `entrypoint.sh`                                             | Production process manager |
| **pydantic**                  | >=2.0.0   | `app/schemas.py`, `app/main.py`                             | Data validation            |
| **pydantic[email]**           | >=2.0.0   | `app/schemas.py`                                            | Email validation           |
| **sqlalchemy**                | >=2.0.0   | `app/database.py`, `app/models.py`, all routes              | ORM for database           |
| **alembic**                   | >=1.12.0  | (migrations)                                                | Database migrations        |
| **psycopg2-binary**           | >=2.9.9   | `app/database.py`                                           | PostgreSQL driver          |
| **python-jose[cryptography]** | >=3.3.0   | `app/auth.py`                                               | JWT token handling         |
| **passlib[bcrypt]**           | >=1.7.4   | `app/auth.py`                                               | Password hashing (legacy)  |
| **bcrypt**                    | ==4.0.1   | `app/auth.py`                                               | Password hashing (primary) |
| **fastapi-mail**              | >=1.4.0   | `app/email_service.py`                                      | Email sending              |
| **python-dotenv**             | >=1.0.0   | `app/model_runner.py`, `get_openrouter_models.py`           | Environment variables      |
| **openai**                    | >=1.0.0   | `app/model_runner.py`                                       | OpenRouter API client      |

### ✅ **REQUIRED** - FastAPI/Uvicorn Dependencies

These are automatically used by FastAPI/Uvicorn internally:

| Package               | Version        | Used By          | Purpose                        |
| --------------------- | -------------- | ---------------- | ------------------------------ |
| **starlette**         | >=0.27.0       | FastAPI          | Web framework core             |
| **pydantic_core**     | >=2.0.0        | Pydantic         | Pydantic validation engine     |
| **anyio**             | >=3.6.0,<4.0.0 | Starlette        | Async compatibility            |
| **click**             | >=8.0.0        | Uvicorn          | CLI interface                  |
| **typing_extensions** | >=4.0.0        | Pydantic         | Type hints backport            |
| **python-multipart**  | >=0.0.5        | FastAPI          | Form data parsing              |
| **annotated-types**   | >=0.5.0        | Pydantic v2      | Type annotations               |
| **idna**              | >=3.0.0        | Email validation | Internationalized domain names |
| **sniffio**           | >=1.3.0        | AnyIO            | Async library detection        |

### ⚠️ **OPTIONAL** - Performance Enhancements

These improve performance but are not strictly required:

| Package        | Version  | Purpose                       | Recommendation                           |
| -------------- | -------- | ----------------------------- | ---------------------------------------- |
| **uvloop**     | >=0.17.0 | Faster event loop (Unix only) | **KEEP** - Significant performance boost |
| **httptools**  | >=0.5.0  | Faster HTTP parsing           | **KEEP** - Performance boost             |
| **h11**        | >=0.14.0 | HTTP/1.1 protocol             | **KEEP** - Used by httptools             |
| **watchfiles** | >=0.18.0 | Auto-reload in dev            | **KEEP** - Development productivity      |
| **websockets** | >=10.0   | WebSocket support             | **KEEP** - May add WebSocket features    |
| **PyYAML**     | >=6.0    | YAML config support           | **KEEP** - Useful for configs            |

### ❌ **UNUSED** - Can Be Removed

| Package      | Version  | Original Purpose      | Why Unused                                             |
| ------------ | -------- | --------------------- | ------------------------------------------------------ |
| **slowapi**  | >=0.1.9  | Rate limiting library | Custom rate limiting implemented instead               |
| **aiohttp**  | >=3.8.0  | Async HTTP client     | Not used; `openai` SDK handles HTTP                    |
| **requests** | >=2.25.0 | HTTP client           | Only used in utility script `get_openrouter_models.py` |

---

## Detailed Analysis

### 1. slowapi ❌ **REMOVE**

**Status:** Installed but never imported

**Evidence:**

```bash
$ grep -r "slowapi" backend/app/
# No results
```

**Reason for removal:**

- Custom rate limiting implemented in `app/rate_limiting.py` using in-memory storage
- No imports or usage found in any Python file
- Added as dependency but never actually utilized

**Impact:** None - safe to remove

---

### 2. aiohttp ❌ **REMOVE**

**Status:** Installed but never imported

**Evidence:**

```bash
$ grep -r "aiohttp" backend/app/
# No results
```

**Reason for removal:**

- OpenAI SDK (`openai>=1.0.0`) handles all HTTP requests to OpenRouter
- No async HTTP client functionality needed
- Dead dependency

**Impact:** None - safe to remove

---

### 3. requests ⚠️ **OPTIONAL**

**Status:** Only used in utility script

**Evidence:**

```python
# backend/get_openrouter_models.py (line 6)
import requests
```

**Used in:** `get_openrouter_models.py` - utility script to fetch model list from OpenRouter API

**Reason to consider removal:**

- Only used in a utility script, not in main application
- Script is for development/maintenance only
- Could be rewritten to use `openai` SDK instead

**Options:**

1. **Keep it** - Minimal overhead, useful for ad-hoc API testing
2. **Remove it** - Rewrite `get_openrouter_models.py` to use `openai` SDK
3. **Move to dev-requirements.txt** - Separate development dependencies

**Recommendation:** **KEEP** - Very small package, useful for utility scripts and debugging

---

## Recommended actions

### Action 1: Remove Unused Packages ✅

Remove these packages from `requirements.txt`:

```diff
- slowapi>=0.1.9
- aiohttp>=3.8.0
```

**Reasoning:**

- `slowapi`: Never imported, custom rate limiting implemented
- `aiohttp`: Dead dependency, OpenAI SDK handles HTTP

### Action 2: Keep requests (Optional) ⚠️

**Keep `requests>=2.25.0`** for utility scripts, OR remove and rewrite scripts.

**If removing:**

- Rewrite `get_openrouter_models.py` to use `openai` SDK
- Update any other utility scripts

### Action 3: Document Optional Dependencies

Add comments in `requirements.txt` to clarify optional vs required:

```python
# Core FastAPI framework
fastapi>=0.100.0
starlette>=0.27.0

# Performance enhancements (optional but recommended)
uvloop>=0.17.0  # Unix only - faster event loop
httptools>=0.5.0  # Faster HTTP parsing
watchfiles>=0.18.0  # Dev mode auto-reload

# Utility scripts (optional)
requests>=2.25.0  # For get_openrouter_models.py and debugging
```

---

## Updated requirements.txt

Here's the cleaned version with unused packages removed:

```python
# Core Dependencies
annotated-types>=0.5.0
anyio>=3.6.0,<4.0.0
click>=8.0.0
fastapi>=0.100.0
h11>=0.14.0
httptools>=0.5.0
idna>=3.0.0
pydantic>=2.0.0
pydantic_core>=2.0.0
python-dotenv>=1.0.0
python-multipart>=0.0.5
PyYAML>=6.0
sniffio>=1.3.0
starlette>=0.27.0
typing_extensions>=4.0.0
uvicorn>=0.20.0
uvloop>=0.17.0
watchfiles>=0.18.0
websockets>=10.0
openai>=1.0.0
gunicorn

# Authentication & Database
sqlalchemy>=2.0.0
alembic>=1.12.0
psycopg2-binary>=2.9.9
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
bcrypt==4.0.1
fastapi-mail>=1.4.0
pydantic[email]>=2.0.0

# Optional utilities (can be removed if not needed)
requests>=2.25.0  # Only for get_openrouter_models.py utility script
```

---

## Size Comparison

**Before cleanup:**

```
slowapi: ~100KB (+ dependencies: limits, deprecated, wrapt)
aiohttp: ~1.2MB (+ dependencies: multidict, yarl, aiosignal, frozenlist)
Total saved: ~1.3MB + faster install time
```

**Impact:**

- Smaller Docker images
- Faster pip install
- Fewer security vulnerabilities to track
- Cleaner dependency tree

---

## Migration Steps

### Step 1: Test Current Setup

```bash
cd backend
pip list | grep -E "slowapi|aiohttp"
```

### Step 2: Remove Unused Packages

```bash
pip uninstall slowapi aiohttp -y
```

### Step 3: Update requirements.txt

Remove these lines:

```
slowapi>=0.1.9
aiohttp>=3.8.0
```

### Step 4: Test Application

```bash
# Start backend
python -m uvicorn app.main:app --reload

# Run tests (if you have them)
pytest

# Test key endpoints
curl http://localhost:8000/health
curl http://localhost:8000/models
```

### Step 5: Update Docker

If using Docker, rebuild:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

---

## Summary

### Packages to Remove: 2

- ❌ `slowapi>=0.1.9` - Never used, custom rate limiting implemented
- ❌ `aiohttp>=3.8.0` - Dead dependency, not needed

### Packages to Keep: 24

- All other packages are either directly used or required by FastAPI/Uvicorn

### Optional to Remove: 1

- ⚠️ `requests>=2.25.0` - Only used in utility scripts

### Benefits

- 🚀 ~1.3MB smaller installation
- ⚡ Faster Docker builds
- 🔒 Fewer security dependencies to monitor
- 📦 Cleaner dependency tree

---

**Recommendation:** Remove `slowapi` and `aiohttp` immediately. Keep `requests` for utility scripts.

**Document Version:** 1.0  
**Last Updated:** October 18, 2025

# Backend Tests

This directory contains the test suite for the CompareAI backend.

## Structure

```
tests/
├── __init__.py
├── conftest.py              # Shared fixtures and test configuration
├── unit/                   # Unit tests for individual functions/modules
│   ├── test_auth.py        # Authentication tests
│   ├── test_rate_limiting.py  # Rate limiting tests
│   └── test_utils.py       # Utility function tests
├── integration/            # Integration tests for API endpoints
│   ├── test_api.py         # General API tests
│   ├── test_comparison.py  # Comparison endpoint tests
│   └── test_admin.py       # Admin endpoint tests
└── e2e/                   # End-to-end workflow tests
    └── test_workflows.py   # Complete user workflow tests
```

## Running Tests

### Run all tests
```bash
pytest
```

### Run with coverage
```bash
pytest --cov=app --cov-report=html
```

### Run specific test categories
```bash
# Unit tests only
pytest tests/unit/

# Integration tests only
pytest tests/integration/

# E2E tests only
pytest tests/e2e/
```

### Run specific test file
```bash
pytest tests/unit/test_auth.py
```

### Run specific test
```bash
pytest tests/unit/test_auth.py::TestUserRegistration::test_register_new_user
```

### Run with markers
```bash
# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run only e2e tests
pytest -m e2e

# Skip slow tests
pytest -m "not slow"
```

### Stop on first failure
```bash
# Stop immediately when the first test fails
pytest -x

# Stop after N failures
pytest --maxfail=3
```

### Controlling Output Verbosity

The default test output can be verbose. Here are options to reduce output:

#### Quiet Modes
```bash
# Minimal output (only dots for passed, F for failed)
pytest -q

# Even quieter (no progress dots)
pytest -qq

# Quiet with short summary
pytest -q --tb=short
```

#### Traceback Control
```bash
# No traceback at all (just test names)
pytest --tb=no

# One line per failure
pytest --tb=line

# Minimal traceback (shorter than short)
pytest --tb=line -q
```

#### Disable Coverage Output
```bash
# Run without coverage (faster, less output)
pytest --no-cov

# Or disable just the terminal coverage report
pytest --cov=app --cov-report=html --cov-report=xml
```

#### Suppress Warnings
```bash
# Disable all warnings
pytest --disable-warnings

# Combine with quiet mode
pytest -q --disable-warnings
```

#### Early Exit Options
```bash
# Stop on first failure (less output if tests fail early)
pytest -x

# Stop after N failures
pytest --maxfail=3
```

#### Recommended Quiet Commands
```bash
# Minimal output: quiet, no traceback, no warnings, no coverage
pytest -q --tb=no --disable-warnings --no-cov

# Quiet with minimal traceback (good middle ground)
pytest -q --tb=line --disable-warnings

# Quiet with short traceback (default but quieter)
pytest -q --tb=short
```

**Note:** The default configuration includes `-v` (verbose) in `pyproject.toml`. You can override it by passing `-q` on the command line.

## Test Configuration

Test configuration is in `pyproject.toml` under `[tool.pytest.ini_options]`.

Key settings:
- Test paths: `tests/`
- Coverage: Enabled by default
- Async mode: Auto (handles async tests automatically)
- Timeout: 300 seconds per test

## Fixtures

Common fixtures are defined in `conftest.py` and `factories.py`:

### Database Fixtures

- `db_session`: Fresh database session for each test (in-memory SQLite)
  - Creates all tables before test
  - Drops all tables after test
  - Provides complete isolation between tests

### API Client Fixtures

- `client`: Test client with database dependency override
- `authenticated_client`: Test client with authenticated free tier user
  - Returns: `(client, user, access_token, refresh_token)`
- `authenticated_client_starter`: Test client with authenticated starter tier user
- `authenticated_client_pro`: Test client with authenticated pro tier user
- `authenticated_client_admin`: Test client with authenticated admin user
- `authenticated_client_super_admin`: Test client with authenticated super_admin user

### User Fixtures (All Subscription Tiers)

- `test_user`: Free tier user (backward compatible, password: "secret")
- `test_user_free`: Free tier user (uses factories)
- `test_user_starter`: Starter tier user
- `test_user_starter_plus`: Starter Plus tier user
- `test_user_pro`: Pro tier user
- `test_user_pro_plus`: Pro Plus tier user
- `test_user_premium`: Premium tier user (backward compatible, alias for pro)
- `test_user_admin`: Admin user (role: "admin")
- `test_user_super_admin`: Super admin user (role: "super_admin")
- `test_user_moderator`: Moderator user (role: "moderator")
- `test_user_unverified`: Unverified user (is_verified=False)
- `test_user_inactive`: Inactive user (is_active=False)

### Factory Functions (from `factories.py`)

The `factories.py` module provides factory functions for creating test data:

**User Factories:**
- `create_user()`: Create a user with custom attributes
- `create_free_user()`, `create_starter_user()`, `create_starter_plus_user()`, `create_pro_user()`, `create_pro_plus_user()`: Create users for each tier
- `create_admin_user()`, `create_super_admin_user()`, `create_moderator_user()`: Create users with different roles
- `create_unverified_user()`, `create_inactive_user()`: Create users with specific states

**Other Factories:**
- `create_user_preference()`: Create user preferences
- `create_conversation()`: Create a conversation
- `create_conversation_message()`: Create conversation messages
- `create_usage_log()`: Create usage log entries
- `create_subscription_history()`: Create subscription history entries
- `create_payment_transaction()`: Create payment transactions
- `create_admin_action_log()`: Create admin action logs
- `create_app_settings()`: Create/update app settings

**Mock Data Generators:**
- `generate_compare_request()`: Generate mock compare request payloads
- `generate_model_response()`: Generate mock model responses
- `generate_compare_response()`: Generate mock compare responses
- `generate_auth_tokens()`: Generate mock auth tokens
- `generate_user_response()`: Generate mock user response payloads

**Example:**
```python
from tests.factories import create_pro_user, create_conversation, generate_compare_request

def test_example(db_session):
    # Create a pro user
    user = create_pro_user(db_session)
    
    # Create a conversation
    conversation = create_conversation(db_session, user)
    
    # Generate mock request data
    request_data = generate_compare_request(models=["openai/gpt-4"])
```

## Writing Tests

### Example Unit Test
```python
def test_example_function(client, db_session):
    """Test description."""
    # Arrange
    # Act
    # Assert
    assert result == expected
```

### Example Integration Test
```python
def test_api_endpoint(authenticated_client):
    """Test API endpoint."""
    client, user, token = authenticated_client
    response = client.get("/api/endpoint")
    assert response.status_code == 200
```

## Notes

- Tests use an in-memory SQLite database (no external database required)
- Each test gets a fresh database session
- Authentication tokens are automatically handled by fixtures
- Tests are isolated - each test runs independently
- **Environment Compatibility**: Tests work in both development and production environments
  - Tests use in-memory SQLite (no external database needed)
  - Email service is mocked (no email configuration needed)
  - Required environment variables (`SECRET_KEY`, `OPENROUTER_API_KEY`) are automatically set in `conftest.py` with test values
  - Tests run in development mode by default (config validation warnings instead of errors)


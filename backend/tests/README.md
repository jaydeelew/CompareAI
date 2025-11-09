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

## Test Configuration

Test configuration is in `pyproject.toml` under `[tool.pytest.ini_options]`.

Key settings:
- Test paths: `tests/`
- Coverage: Enabled by default
- Async mode: Auto (handles async tests automatically)
- Timeout: 300 seconds per test

## Fixtures

Common fixtures are defined in `conftest.py`:

- `db_session`: Fresh database session for each test (in-memory SQLite)
- `client`: Test client with database dependency override
- `test_user`: Standard test user (free tier, verified)
- `test_user_premium`: Premium tier test user
- `test_user_admin`: Admin test user
- `authenticated_client`: Test client with authenticated user (returns client, user, token)

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


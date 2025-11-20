# Backend Tests

This directory contains the test suite for the CompareIntel backend.

**📚 For comprehensive testing documentation, see: [Backend Testing Guide](../../docs/testing/BACKEND_TESTING.md)**

## Quick Start

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test category
pytest tests/unit/          # Unit tests
pytest tests/integration/   # Integration tests
pytest tests/e2e/           # E2E tests
```

For detailed information on running tests, writing new tests, fixtures, and best practices, see the [Backend Testing Guide](../../docs/testing/BACKEND_TESTING.md).


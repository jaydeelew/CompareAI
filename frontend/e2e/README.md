# E2E Tests with Playwright

This directory contains end-to-end tests for CompareAI using Playwright.

## Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npx playwright install
   ```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run specific test file
```bash
npx playwright test e2e/auth.spec.ts
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Files

- **`auth.spec.ts`** - User registration → verification → comparison flow
- **`comparison.spec.ts`** - Anonymous user flow and rate limit handling
- **`conversation.spec.ts`** - Conversation management (create, view, delete)
- **`admin.spec.ts`** - Admin user management functionality

## Configuration

Tests are configured in `playwright.config.ts`. Key settings:

- **Base URL:** `http://localhost:5173` (default) or set via `PLAYWRIGHT_BASE_URL` env var
- **Web Server:** Automatically starts dev server before tests
- **Browsers:** Chromium, Firefox, WebKit
- **Retries:** 2 retries on CI, 0 locally
- **Screenshots/Videos:** Captured on failure

## Environment Variables

- `PLAYWRIGHT_BASE_URL` - Override base URL for tests (default: `http://localhost:5173`)
- `ADMIN_EMAIL` - Admin email for admin tests (default: `admin@example.com`)
- `ADMIN_PASSWORD` - Admin password for admin tests (default: `AdminPassword123!`)

## Test Data

Tests use dynamic test data (timestamps) to avoid conflicts. For admin tests, ensure you have:

1. An admin user in your test database
2. Proper admin credentials set via environment variables

## CI/CD Integration

Tests are configured to:
- Run in parallel on CI
- Retry failed tests twice
- Generate HTML reports
- Capture traces, screenshots, and videos on failure

## Debugging

### View test report
```bash
npx playwright show-report
```

### Debug a specific test
```bash
npx playwright test auth.spec.ts --debug
```

### Use Playwright Inspector
```bash
PWDEBUG=1 npx playwright test
```

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Use Playwright's test API:
   ```typescript
   import { test, expect } from '@playwright/test';
   
   test('my test', async ({ page }) => {
     await page.goto('/');
     await expect(page.getByText('Hello')).toBeVisible();
   });
   ```

3. Use `test.step()` to organize complex tests
4. Use `test.beforeEach()` for setup
5. Use `test.describe()` to group related tests

## Best Practices

1. **Use data-testid attributes** - Add `data-testid` to key UI elements for reliable selectors
2. **Wait for network idle** - Use `await page.waitForLoadState('networkidle')` after navigation
3. **Use meaningful test names** - Describe what the test verifies
4. **Keep tests independent** - Each test should be able to run in isolation
5. **Use test fixtures** - For authenticated state, use Playwright fixtures

## Troubleshooting

### Tests fail with "Target closed"
- Ensure dev server is running or webServer config is correct
- Check that base URL is accessible

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check network conditions
- Verify backend is running

### Selectors not found
- Use Playwright's codegen to generate selectors: `npx playwright codegen`
- Check that UI elements have stable selectors
- Consider adding `data-testid` attributes to key elements


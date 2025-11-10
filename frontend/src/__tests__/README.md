# Frontend Testing Infrastructure

This directory contains the testing infrastructure and test files for the CompareAI frontend.

## Structure

```
__tests__/
├── setup.ts                    # Vitest setup and global test configuration
├── vitest.d.ts                 # TypeScript type definitions for Vitest
├── components/                 # Component tests
│   ├── comparison/            # Comparison component tests
│   ├── conversation/          # Conversation component tests
│   └── layout/                # Layout component tests
├── hooks/                      # Custom hook tests
├── services/                   # Service layer tests
└── utils/                      # Utility function tests
```

## Running Tests

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Writing Tests

### Component Tests

Use React Testing Library for component tests:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from '../components/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Hook Tests

Test custom hooks using `@testing-library/react`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useMyHook } from '../hooks/useMyHook'

describe('useMyHook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.value).toBe(0)
  })
})
```

### Service Tests

Mock API calls and test service functions:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { myService } from '../services/myService'

describe('myService', () => {
  it('should fetch data', async () => {
    const mockData = { id: 1, name: 'Test' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    const result = await myService.fetchData()
    expect(result).toEqual(mockData)
  })
})
```

## Test Utilities

### Setup

The `setup.ts` file configures:
- `@testing-library/jest-dom` matchers (toBeInTheDocument, etc.)
- Global mocks (matchMedia, IntersectionObserver, ResizeObserver)
- Test cleanup after each test

### Test Utilities (`utils/`)

The `utils/` directory provides comprehensive testing utilities:

#### Test Render Helpers (`test-utils.tsx`)

Custom render function with providers:

```typescript
import { renderWithProviders, createMockUser } from '@/__tests__/utils';

const mockUser = createMockUser({ email: 'test@example.com' });

const { getByText } = renderWithProviders(<MyComponent />, {
  authState: { user: mockUser, isAuthenticated: true },
  route: '/dashboard',
});
```

#### Test Data Factories (`test-factories.ts`)

Create mock data with sensible defaults:

```typescript
import { createMockUser, createMockCompareResponse } from '@/__tests__/utils';

const user = createMockUser({ subscription_tier: 'premium' });
const response = createMockCompareResponse(['gpt-4', 'claude-3']);
```

Available factories:
- `createMockUser`, `createMockAdminUser`, `createMockPremiumUser`
- `createMockModel`, `createMockModelsByProvider`
- `createMockConversationMessage`, `createMockStoredMessage`
- `createMockCompareResponse`, `createMockRateLimitStatus`
- `createMockStreamEvent`, `createMockStreamEvents`
- And more...

#### Mock API Responses (`mock-api-responses.ts`)

Mock response data for all endpoints:

```typescript
import { mockCompareResponse, mockLoginResponse } from '@/__tests__/utils';

const compareResponse = mockCompareResponse(payload, { metadata: customMetadata });
const loginResponse = mockLoginResponse({ email: 'user@example.com' });
```

#### Mock Services (`mock-services.ts`)

Mock service implementations for testing:

```typescript
import { vi } from 'vitest';
import { mockCompare, mockGetRateLimitStatus } from '@/__tests__/utils';

vi.mock('../../services/compareService', () => ({
  compare: mockCompare,
  getRateLimitStatus: mockGetRateLimitStatus,
}));
```

Or use `setupMockServices()` in `beforeEach`:

```typescript
import { setupMockServices } from '@/__tests__/utils';

beforeEach(() => {
  setupMockServices();
});
```

### Importing Utilities

Import all utilities from the index:

```typescript
import {
  renderWithProviders,
  createMockUser,
  mockCompare,
  mockCompareResponse,
} from '@/__tests__/utils';
```

## Coverage

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`.

Coverage excludes:
- Test files themselves
- Type definition files
- Configuration files
- Mock data files

## Best Practices

1. **Test behavior, not implementation**: Focus on what the component/hook does, not how it does it
2. **Use user-centric queries**: Prefer `getByRole`, `getByLabelText`, etc. over `getByTestId`
3. **Keep tests simple**: One assertion per test when possible
4. **Mock external dependencies**: Mock API calls, browser APIs, etc.
5. **Test edge cases**: Include error states, loading states, empty states
6. **Use descriptive test names**: Test names should clearly describe what is being tested

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [React Testing Library](https://testing-library.com/react)


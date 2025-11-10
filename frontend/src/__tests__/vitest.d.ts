/**
 * Vitest type definitions for TypeScript.
 * This file ensures TypeScript recognizes Vitest globals and types.
 */

import '@testing-library/jest-dom'
import { expect, test, describe, it, beforeEach, afterEach, vi } from 'vitest'

declare global {
  // Vitest globals are available via the test config
  // This file ensures TypeScript recognizes them
}

export {}


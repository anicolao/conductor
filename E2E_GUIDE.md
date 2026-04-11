# E2E Testing Guide

This document defines the mandatory standards for End-to-End (E2E) testing in this repository. These practices ensure tests are robust, deterministic, and self-documenting.

## 1. Philosophy: "Zero-Pixel Tolerance" (ABSOLUTE REQUIREMENT)

Visual state is the primary feedback mechanism for users. Any deviation in layout or rendering is considered a bug. This policy is an ABSOLUTE REQUIREMENT with no exceptions.

- **Visual Snapshots**: Every atomic test step MUST capture a visual snapshot (screenshot) to verify UI state.
- **Determinism**: Tests must be 100% deterministic. Random seeds must be fixed, and non-deterministic data (e.g., timestamps) must be mocked or stabilized.
- **Software Rendering**: Use consistent browser flags (e.g., `--disable-gpu`, `--font-render-hinting=none`) to ensure screenshots match across local and CI environments.

## 2. The Unified Step Pattern (ABSOLUTE REQUIREMENT)

To prevent synchronization errors between documentation, verification, and screenshots, all test actions MUST follow the **Unified Step Pattern**. This is an ABSOLUTE REQUIREMENT with no exceptions.

- **Atomic Steps**: Use the mandatory `TestStepHelper` to wrap actions, verifications, and screenshot capturing into a single `step()` call.
- **Auto-Naming**: Screenshot filenames and step counters must be managed automatically by the helper, never manually.
- **Self-Documentation**: Tests must automatically generate a `README.md` in the scenario directory that reflects the steps taken and the results.

### TestStepHelper Usage Sample

```typescript
import { test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('login flow', async ({ page }, testInfo) => {
  const helper = new TestStepHelper(page, testInfo);
  helper.setMetadata('Login Flow', 'Verify user can login successfully.');

  await page.goto('/login');
  
  await helper.step('login_page_loaded', {
    description: 'User navigates to login page',
    verifications: [
      { spec: 'Email field is visible', check: async () => expect(page.locator('#email')).toBeVisible() },
      { spec: 'Password field is visible', check: async () => expect(page.locator('#password')).toBeVisible() }
    ]
  });

  // ... more steps ...

  helper.generateDocs();
});
```

## 3. Directory Convention

Tests are organized by scenario in numbered directories within `tests/e2e/`.

```
tests/e2e/
├── helpers/                   # Shared utilities (TestStepHelper)
├── 001-scenario-name/         # Scenario Directory
│   ├── 001-scenario.spec.ts   # Main test file
│   ├── README.md              # Auto-generated verification doc (committed)
│   └── screenshots/           # Committed baseline images
```

**Mandatory**: Baseline screenshots and the generated `README.md` are part of the test artifacts and MUST be committed to the repository.

## 4. Prohibitions & Hard Requirements

1. **No Timeouts > 2000ms**: The maximum acceptable timeout for any condition is **2000ms**.
2. **No `waitForTimeout`**: Arbitrary waits (e.g., `page.waitForTimeout()`) are strictly prohibited. Always wait for specific UI conditions or locators.
3. **No Animations**: Ensure all CSS animations and transitions have finished (using a `waitForAnimations` utility) before capturing any snapshot.
4. **Resilient Locators**: Use user-facing attributes (labels, roles, text) instead of fragile CSS classes or implementation details.

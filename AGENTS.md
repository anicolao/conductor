# AGENTS

- All reusable scripts and automation in this repository must be accessible through `npm run ...` entry points.
- **ABSOLUTE REQUIREMENT**: All End-to-End (E2E) testing MUST strictly adhere to the standards defined in [E2E_GUIDE.md](./E2E_GUIDE.md). No exceptions.
- **Mandatory Helper**: Every E2E test MUST use the `TestStepHelper` for all test steps.
- **Visual Verification**: Every test step MUST include a visual verification via `toHaveScreenshot()`. This is an ABSOLUTE REQUIREMENT to ensure "Zero-Pixel Tolerance".

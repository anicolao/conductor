# TypeScript in Firebase Functions

Currently, the code in the `functions/` directory is written in JavaScript with JSDoc for type checking (`// @ts-check`). This document explains the rationale behind this choice and how we can migrate to a full TypeScript setup.

## Why JavaScript with JSDoc?

The current setup uses JavaScript for several reasons:

1.  **Zero Build Step**: JavaScript files are deployed directly to Firebase Functions. There is no need for a compilation step (`tsc`) before deployment or during local development.
2.  **Deployment Simplicity**: The `main` entry point in `package.json` points directly to the source code (`index.js`).
3.  **Low Friction**: For small to medium-sized cloud functions, JSDoc provides many of the benefits of TypeScript (autocomplete, type checking in editors) without the overhead of a build pipeline.
4.  **Runtime Parity**: The code that runs in production is identical to the code written in the editor, making debugging straightforward.

## Can we convert to TypeScript?

Yes, we can and probably should as the complexity of the functions grows. Firebase Functions has first-class support for TypeScript.

### Benefits of Migration

*   **Better Type Safety**: Real TypeScript is more robust than JSDoc, especially for complex generics and union types.
*   **Consistency**: Most of the root project (`src/`) and the UI (`observability-ui/`) are already in TypeScript.
*   **Access to Modern Features**: Easier use of decorators, private class members, etc.

### Migration Plan

To convert the `functions/` directory to TypeScript, we would need to:

1.  **Install Dependencies**:
    Add `typescript` and relevant types to `functions/package.json`:
    ```bash
    npm install --save-dev typescript @types/node
    ```

2.  **Rename Files**:
    Rename `index.js` to `index.ts` and `project-dispatch.js` to `project-dispatch.ts`.

3.  **Update `tsconfig.json`**:
    Modify the configuration to emit compiled files:
    ```json
    {
      "compilerOptions": {
        "module": "commonjs",
        "noImplicitAny": true,
        "outDir": "lib",
        "sourceMap": true,
        "strict": true,
        "target": "es2022"
      },
      "compileOnSave": true,
      "include": ["src"]
    }
    ```

4.  **Restructure (Optional but Recommended)**:
    Move source files to a `functions/src` directory to separate source from compiled output.

5.  **Update `package.json`**:
    *   Set `"main": "lib/index.js"`.
    *   Add scripts: `"build": "tsc"`, `"build:watch": "tsc --watch"`, `"predeploy": "npm run build"`.

6.  **Refactor Code**:
    Convert JSDoc `@typedef` to TypeScript `interface` or `type` declarations and use standard TypeScript syntax for imports and exports.

## Conclusion

The current JavaScript + JSDoc approach was chosen for simplicity and to avoid a build step. However, converting to TypeScript is a viable and beneficial path for future development.

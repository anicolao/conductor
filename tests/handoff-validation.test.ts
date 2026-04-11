import { describe, it, expect } from 'vitest';
import { runStreamingCommand } from '../src/utils/exec';
import path from 'path';

describe('handoff script validation', () => {
  it('should pass all handoff validation tests', async () => {
    const scriptPath = path.resolve(__dirname, './handoff.test.sh');
    const result = await runStreamingCommand('bash', [scriptPath], process.env);
    
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    
    expect(result.status).toBe(0);
  }, 30000); // Higher timeout for the verification loops
});

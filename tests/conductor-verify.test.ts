import { describe, it, expect } from 'vitest';
import { runStreamingCommand } from '../src/utils/exec';
import path from 'path';

describe('conductor verification script', () => {
  it('should pass all conductor-verify tests', async () => {
    const scriptPath = path.resolve(__dirname, './conductor-verify_test.sh');
    const result = await runStreamingCommand('bash', [scriptPath], process.env);
    
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    
    expect(result.status).toBe(0);
  });
});

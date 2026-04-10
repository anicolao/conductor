import { spawn } from 'child_process';

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function formatStreamChunk(chunk: string, source: 'stdout' | 'stderr'): string {
  return source === 'stderr' ? `[stderr] ${chunk}` : chunk;
}

export function createLineForwarder(source: 'stdout' | 'stderr', onChunk: (formatted: string, raw: string, source: 'stdout' | 'stderr') => void) {
  let buffer = '';

  return {
    push(chunk: string) {
      buffer += chunk;

      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) break;

        const line = buffer.slice(0, newlineIndex + 1);
        buffer = buffer.slice(newlineIndex + 1);
        onChunk(formatStreamChunk(line, source), line, source);
      }
    },
    flush() {
      if (!buffer) return;
      onChunk(formatStreamChunk(buffer, source), buffer, source);
      buffer = '';
    }
  };
}

export async function runStreamingCommand(command: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const stdoutForwarder = createLineForwarder('stdout', (formatted, raw) => {
      stdout += raw;
      process.stdout.write(formatted);
    });
    const stderrForwarder = createLineForwarder('stderr', (formatted, raw) => {
      stderr += raw;
      process.stdout.write(formatted);
    });

    if (child.stdout) {
      child.stdout.on('data', chunk => {
        stdoutForwarder.push(String(chunk));
      });
    }

    if (child.stderr) {
      child.stderr.on('data', chunk => {
        stderrForwarder.push(String(chunk));
      });
    }

    child.on('error', reject);

    child.on('close', code => {
      stdoutForwarder.flush();
      stderrForwarder.flush();
      resolve({
        status: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

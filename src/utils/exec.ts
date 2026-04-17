import { spawn } from 'child_process';
import { logger, logEvent } from './logger';

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

      const trimmed = raw.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object' && 'type' in parsed) {
            logEvent('GEMINI_EVENT', parsed);
            return;
          }
        } catch (e) {
          // Not JSON or missing type, fallback to default logging
        }
      }

      logger.stdout(formatted);
    });
    const stderrForwarder = createLineForwarder('stderr', (formatted, raw) => {
      stderr += raw;

      const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const cleanRaw = raw.replace(ANSI_REGEX, '');
      const trimmed = cleanRaw.trim();

      // Intercept MESSAGE_BUS debug messages
      const messageBusMatch = trimmed.match(/\[MESSAGE_BUS\] publish:\s*(\{.*\})/);
      if (messageBusMatch) {
        try {
          const parsed = JSON.parse(messageBusMatch[1]);
          parsed._isMessageBus = true;
          logEvent('GEMINI_EVENT', parsed);
          return;
        } catch (e) {
          // Not valid JSON, fallback
        }
      }

      // Intercept debug logs from Gemini CLI
      if (trimmed.includes('[Routing]') || trimmed.includes('[Memory]') || trimmed.includes('[Status]')) {
        logEvent('LOG_DEBUG', { message: trimmed });
        return;
      }

      logger.stderr(formatted);
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

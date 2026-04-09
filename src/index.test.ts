import { formatStreamChunk, createLineForwarder } from './index';

describe('formatStreamChunk', () => {
  it('should format stderr with prefix', () => {
    expect(formatStreamChunk('hello\n', 'stderr')).toBe('[stderr] hello\n');
  });

  it('should not prefix stdout', () => {
    expect(formatStreamChunk('hello\n', 'stdout')).toBe('hello\n');
  });
});

describe('createLineForwarder', () => {
  it('should forward complete lines', () => {
    const callback = jest.fn();
    const forwarder = createLineForwarder('stdout', callback);

    forwarder.push('hello');
    expect(callback).not.toHaveBeenCalled();

    forwarder.push('\nworld\n');
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'hello\n', 'hello\n', 'stdout');
    expect(callback).toHaveBeenNthCalledWith(2, 'world\n', 'world\n', 'stdout');
  });

  it('should flush remaining buffer', () => {
    const callback = jest.fn();
    const forwarder = createLineForwarder('stderr', callback);

    forwarder.push('error');
    forwarder.flush();

    expect(callback).toHaveBeenCalledWith('[stderr] error', 'error', 'stderr');
  });
});

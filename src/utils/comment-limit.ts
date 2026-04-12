export const DEFAULT_COMMENT_LIMIT = 100;

const COMMENT_LIMIT_PATTERN = /SET COMMENT LIMIT:\s*(\d+)/gi;

export function resolveCommentLimit(commentBodies: string[], defaultLimit = DEFAULT_COMMENT_LIMIT): number {
  let limit = defaultLimit;

  for (const body of commentBodies) {
    let match: RegExpExecArray | null;
    COMMENT_LIMIT_PATTERN.lastIndex = 0;

    while ((match = COMMENT_LIMIT_PATTERN.exec(body)) !== null) {
      const parsed = Number(match[1]);
      if (Number.isInteger(parsed) && parsed > 0) {
        limit = parsed;
      }
    }
  }

  return limit;
}

export class UniVerseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "UniVerseError";
  }
}

export const universeError = (error: unknown): UniVerseError =>
  error instanceof UniVerseError
    ? error
    : new UniVerseError(String((error as { code?: unknown } | null)?.code ?? "ERR_UNKNOWN"), String((error as { message?: unknown } | null)?.message ?? error));

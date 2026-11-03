// PrismaClientKnownRequestError code (e.g. P2002 unique, P2003 FK, P2025 not found), if any.
export function prismaErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

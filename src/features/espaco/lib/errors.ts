/**
 * Extracts a human-readable message from any thrown value.
 * Use in `catch (e: unknown)` blocks instead of `e.message`.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  try {
    return String(e)
  } catch {
    return 'Erro desconhecido'
  }
}

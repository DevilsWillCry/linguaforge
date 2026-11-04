/** Everything a single local user stores on this server is filed under this id. */
export const LOCAL_USER_ID = 'local'

/**
 * Who is making this request, or null if nobody can be identified.
 *
 * This is the one place Phase 6 changes: verify the session there and return the user's id.
 * Until then a hosted server identifies nobody, so it can't expose one user's keys to another.
 */
export function resolveUserId(_request: Request, env: NodeJS.ProcessEnv): string | null {
  return env.LF_HOSTED ? null : LOCAL_USER_ID
}

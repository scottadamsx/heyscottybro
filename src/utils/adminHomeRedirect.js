/** The public root redirects only when an already-established admin session exists. */
export function adminHomeDestination(session) {
  return session?.user?.id ? "/admin/today" : null;
}

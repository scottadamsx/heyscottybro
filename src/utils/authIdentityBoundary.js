export function ownerIdFromSession(session) {
  const ownerId = session?.user?.id;
  return typeof ownerId === "string" && ownerId ? ownerId : null;
}

let establishedOwnerId = null;

export function bindEstablishedOwnerId(ownerId) {
  establishedOwnerId = typeof ownerId === "string" && ownerId ? ownerId : null;
  return establishedOwnerId;
}

export function captureEstablishedOwnerId() {
  if (!establishedOwnerId) {
    throw new Error("The authenticated owner is not established; reload before changing private chat data.");
  }
  return establishedOwnerId;
}

export function verifyEstablishedOwnerId(expectedOwnerId, resolvedOwnerId) {
  if (!expectedOwnerId || establishedOwnerId !== expectedOwnerId || resolvedOwnerId !== expectedOwnerId) {
    throw new Error("The authenticated owner changed while private chat data was being accessed; the operation was cancelled.");
  }
  return expectedOwnerId;
}

export async function runOwnerBoundOperation(ownerId, verifyOwner, operation) {
  const verifiedOwnerId = await verifyOwner(ownerId);
  if (verifiedOwnerId !== ownerId) {
    throw new Error("The authenticated owner changed before the private operation executed; the operation was cancelled.");
  }
  return operation(ownerId);
}

export async function resolveOwnerBoundAuthHeaders(expectedOwnerId, getSession) {
  const { data, error } = await getSession();
  if (error) throw error;
  const session = data?.session;
  verifyEstablishedOwnerId(expectedOwnerId, ownerIdFromSession(session));
  if (!session?.access_token) {
    throw new Error("The authenticated session has no access token; the private request was cancelled.");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

/**
 * Once an authenticated owner has mounted private state, losing or replacing
 * that identity must terminate the whole JavaScript runtime. A keyed React
 * remount clears visible state, but it cannot cancel old async turns; a hard
 * reload does, so no resumed owner-A turn can become owner B's first save.
 */
export function protectedAuthTransition(previousOwner, session) {
  const nextOwner = ownerIdFromSession(session);
  if (previousOwner && previousOwner !== nextOwner) {
    return {
      action: "reload",
      ownerId: null,
      status: "loading",
    };
  }
  return {
    action: "render",
    ownerId: nextOwner,
    status: nextOwner ? "authed" : "unauthed",
  };
}

/**
 * Masks a phone number for PUBLIC API responses: '0521234567' -> '052***4567'.
 * The registration form promises registrants their details are used for dispatch
 * only, so unauthenticated endpoints must never return a full personal number —
 * the complete value stays available behind requireAdmin (volunteers, analytics).
 */
export function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 7) return phone ?? null;
  return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}

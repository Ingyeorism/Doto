export const USAGE_TERMS_VERSION = "2026-09-09";

// A local acknowledgement of the button action, not verified guardian consent.
// Keep only the latest acknowledgement; never include names or room codes.
export function recordUsageConsent(action: "create" | "join") {
  try {
    localStorage.setItem(
      "doto.usage-consent",
      JSON.stringify({
        version: USAGE_TERMS_VERSION,
        acceptedAt: new Date().toISOString(),
        action,
      }),
    );
  } catch {
    // Unavailable browser storage must not add a step to entering the room.
  }
}

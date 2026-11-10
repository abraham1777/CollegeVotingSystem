/**
 * Format an ISO date-time string consistently for the Asia/Kolkata timezone.
 *
 * Example:
 *   "2026-10-22T19:40:00+05:30" => "22 Oct 2026, 7:40 PM"
 */
export function formatKolkataDateTime(
  value: string | null | undefined,
  includeTimezone = false
): string {
  if (!value) return "Not specified";

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    const formatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);

    return includeTimezone ? `${formatted} (IST)` : formatted;
  } catch {
    return String(value);
  }
}

/**
 * Normalizes status strings and provides UI presentation metadata.
 */
export function getStatusMetadata(status: string) {
  const normalized = (status || "").toLowerCase().trim();

  switch (normalized) {
    case "open":
      return {
        label: "Voting Open",
        pillClass: "status-voting-open",
        bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500 animate-pulse",
        icon: "◉",
        description: "Active election. Eligible voters can cast ballots now.",
      };
    case "closed":
      return {
        label: "Closed",
        pillClass: "status-completed",
        bgClass: "bg-slate-100 text-slate-700 border-slate-200",
        dotClass: "bg-slate-400",
        icon: "✓",
        description: "Election concluded. Voting is sealed and awaiting final audit.",
      };
    case "draft":
    default:
      return {
        label: "Draft",
        pillClass: "status-upcoming",
        bgClass: "bg-amber-50 text-amber-700 border-amber-200",
        dotClass: "bg-amber-500",
        icon: "♙",
        description: "Pending activation. Ballot setup and candidate registration in progress.",
      };
  }
}

/**
 * Extracts human-readable error messages from standard FastAPI / SmartVote error payloads.
 */
export function extractErrorMessage(errorData: unknown, fallbackMessage: string): string {
  if (!errorData) return fallbackMessage;

  if (typeof errorData === "string") return errorData;

  const data = errorData as Record<string, unknown>;

  // SmartVote standard exception handler response: { error: { status_code, message, details? } }
  if (data.error && typeof data.error === "object") {
    const errorObj = data.error as Record<string, unknown>;
    if (typeof errorObj.message === "string") {
      if (Array.isArray(errorObj.details) && errorObj.details.length > 0) {
        const details = errorObj.details
          .map((d: Record<string, unknown>) => `${d.field || "field"}: ${d.message || "invalid"}`)
          .join(", ");
        return `${errorObj.message} (${details})`;
      }
      return errorObj.message;
    }
  }

  // Standard FastAPI HTTPException format: { detail: "..." }
  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d: Record<string, unknown>) => String(d.msg || JSON.stringify(d)))
      .join(", ");
  }

  return fallbackMessage;
}


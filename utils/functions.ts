export function formatDate(input: string | undefined | null): string {
  if (!input) {
    return '----';
  }

  let normalizedString = input.trim();

  // Handle various timestamp formats:
  // 1. "2025-12-26T14:00:32.192914" (no timezone - treat as UTC)
  // 2. "2024-03-31+05:30" (date with timezone offset)
  // 3. "2024-03-31T00:00:00+05:30" (full ISO with timezone)
  // 4. "2024-03-31T00:00:00Z" (UTC)
  // 5. "2024-03-31T00:00:00" (no timezone)

  // Handle date-only format with timezone offset: "2024-03-31+05:30"
  if (/^\d{4}-\d{2}-\d{2}[+-]\d{2}:\d{2}$/.test(normalizedString)) {
    normalizedString = normalizedString.replace(
      /^(\d{4}-\d{2}-\d{2})([+-]\d{2}:\d{2})$/,
      '$1T00:00:00$2',
    );
  }

  // Handle timestamp without timezone (treat as UTC): "2025-12-26T14:00:32.192914"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalizedString)) {
    normalizedString = normalizedString + 'Z';
  }

  const date = new Date(normalizedString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return input;
  }

  // Always format in Indian Standard Time (IST)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  };

  return date.toLocaleString('en-IN', options);
}


export const formatINR = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function formatTimeAgo(input: string | undefined | null): string {
  if (!input) return "—";
  const date = new Date(input);
  if (isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${Math.max(sec, 1)}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function formatCompactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-IN");
}

/** GST withheld on manual wallet top-ups — must match the backend GST_RATE. */
export const GST_RATE = 0.18;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split a gross top-up into the GST withheld and the net that reaches the
 * wallet (₹100 requested → ₹18 GST → ₹82 credited). Mirrors the backend's
 * APPROVE math so the admin sees the same numbers before confirming.
 */
export function splitGst(gross: number | null | undefined): {
  gross: number;
  gst: number;
  net: number;
} {
  const amount = Number(gross ?? 0);
  const gst = round2(amount * GST_RATE);
  return { gross: amount, gst, net: round2(amount - gst) };
}

/** Sidebar count badge — caps at "99+". */
export function formatBadgeCount(n: number | null | undefined): string {
  if (!n || n <= 0) return "";
  return n > 99 ? "99+" : String(n);
}

/**
 * Broadcast that the pending manual top-up count changed, so the sidebar badge
 * updates immediately instead of waiting for its next poll.
 */
export const PENDING_TOPUP_EVENT = "pending-topup-changed";

export function emitPendingTopupChanged(total?: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<number | undefined>(PENDING_TOPUP_EVENT, { detail: total }),
  );
}
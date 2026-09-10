"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Activity,
  Eye,
  Zap,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  Filter,
  Search,
  X,
  Loader2,
  ArrowDown,
  ArrowUp,
  Inbox,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { get } from "@/lib/api";
import type {
  Transaction,
  TransactionsResponseData,
  TransactionFilters,
  TransactionOverviewStats,
  MonthlyTransactionStat,
  TransactionType,
  TransactionStatus,
  TransactionKeyType,
} from "@/types/transactions";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const REFRESH_INTERVAL_MS = 5000;
const FILTER_DEBOUNCE_MS = 400;
const SEARCH_DEBOUNCE_MS = 150;
const TABLE_SKELETON_ROWS = 8;

// "ALL" is used as the Select sentinel value — Radix Select does not allow
// an empty string as an item value, so filters are keyed off this instead.
const ALL = "ALL";

// ─── Fetch + response normalization ────────────────────────────────────────
// Kept local to this page since it's the only place that needs it. The
// backend contract can drift (a field missing, a number sent as a string,
// etc), so these helpers keep the dashboard from crashing on a bad payload
// instead of trusting the response blindly.

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseOverviewSection(data: unknown): TransactionOverviewStats {
  const source = (data ?? {}) as Record<string, unknown>;
  const breakdown = (source.status_breakdown ?? {}) as Record<string, unknown>;
  return {
    total_transactions: toNumber(source.total_transactions),
    total_credit: toNumber(source.total_credit),
    total_debit: toNumber(source.total_debit),
    total_success: toNumber(source.total_success),
    status_breakdown: {
      total_completed: toNumber(breakdown.total_completed),
      total_pending: toNumber(breakdown.total_pending),
      total_failed: toNumber(breakdown.total_failed),
      total_reversed: toNumber(breakdown.total_reversed),
    },
  };
}

function parseMonthlyStats(data: unknown): MonthlyTransactionStat[] {
  if (!Array.isArray(data)) return [];
  return data.map((entry) => {
    const source = (entry ?? {}) as Record<string, unknown>;
    return {
      month: String(source.month ?? ""),
      label: String(source.label ?? ""),
      ...parseOverviewSection(source),
    };
  });
}

function normalizeResponse(raw: unknown): TransactionsResponseData {
  const source = (raw ?? {}) as Record<string, unknown>;
  const overview = (source.overview_stats ?? {}) as Record<string, unknown>;

  return {
    overview_stats: {
      today: parseOverviewSection(overview.today),
      lifetime: parseOverviewSection(overview.lifetime),
      monthly: parseMonthlyStats(overview.monthly),
    },
    transactions: Array.isArray(source.transactions)
      ? (source.transactions as TransactionsResponseData["transactions"])
      : [],
    limit: toNumber(source.limit, 50),
    has_more: Boolean(source.has_more),
    next_cursor:
      typeof source.next_cursor === "string" ? source.next_cursor : null,
  };
}

async function fetchTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionsResponseData> {
  // `get()` only takes a URL, so the query string is built here rather
  // than passed as a separate params object.
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.key_type) params.set("key_type", filters.key_type);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.endpoint) params.set("endpoint", filters.endpoint);
  if (filters.txn_id) params.set("txn_id", filters.txn_id);

  const query = params.toString();
  const response = await get(
    `/api/v1/user/get-transaction${query ? `?${query}` : ""}`,
  );

  // Supports both a `{ responseData }` wrapper (the convention used by
  // /admin/users/all elsewhere in the app) and a bare payload, in case
  // `get()` already unwraps it for you.
  const payload =
    (response as { responseData?: unknown } | null)?.responseData ?? response;

  return normalizeResponse(payload);
}

function useDebouncedValue<T>(value: T, delay = FILTER_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const message = (
    err as { response?: { data?: { responseStatus?: { message?: string } } } }
  )?.response?.data?.responseStatus?.message;
  return typeof message === "string" ? message : fallback;
}

/** Copies text to the clipboard, falling back to `execCommand` for
 * non-secure contexts (e.g. plain-HTTP staging/LAN previews) where
 * `navigator.clipboard` is unavailable. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const statusBadgeClass = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (normalized === "PENDING")
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (normalized === "FAILED")
    return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-slate-500/30 bg-slate-500/10 text-slate-400";
};

const statusDotClass = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") return "bg-emerald-400";
  if (normalized === "PENDING") return "bg-amber-400";
  if (normalized === "FAILED") return "bg-red-400";
  return "bg-slate-400";
};

const typeBadgeClass = (type: string) =>
  type === "DEBIT"
    ? "border-red-500/30 bg-red-500/10 text-red-400"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

// ─── Small presentational components ───────────────────────────────────────
// Pulled out of the page body so the render tree stays readable and each
// piece can be memoized independently.

function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <Badge className={cn("gap-1 px-2 py-0.5", statusBadgeClass(status))}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(status))}
      />
      {status}
    </Badge>
  );
}

function TypeBadge({ type }: { type: TransactionType }) {
  return (
    <Badge className={cn("gap-1 px-2 py-0.5", typeBadgeClass(type))}>
      {type === "DEBIT" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUp className="h-3 w-3" />
      )}
      {type}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "emerald" | "red";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/20 bg-red-500/10 text-red-400"
      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  return (
    <Card className="h-full rounded-2xl border border-slate-800 bg-slate-900/60 transition-colors hover:border-slate-700">
      <CardContent className="flex items-start justify-between p-6">
        <div>
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={cn("rounded-lg border p-3", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="h-full rounded-2xl border border-slate-800 bg-slate-900/60">
      <CardContent className="flex items-start justify-between p-6">
        <div className="space-y-3">
          <div className="h-3.5 w-28 animate-pulse rounded bg-slate-800" />
          <div className="h-7 w-20 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-slate-800" />
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-16 text-center">
      <Icon className="mx-auto h-12 w-12 text-zinc-600" />
      <p className="mt-4 text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <p className="max-w-sm text-sm font-medium text-zinc-300">{message}</p>
      <Button
        className="w-fit bg-red-600 px-4 text-white shadow-lg shadow-red-900/30 transition-none hover:bg-red-600 hover:text-white"
        onClick={onRetry}
      >
        Try Again
      </Button>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <TableRow className="border-slate-800 hover:bg-transparent">
      {Array.from({ length: 8 }).map((_, i) => (
        <TableCell
          key={i}
          className={i === 0 ? "pl-6" : i === 7 ? "pr-6" : undefined}
        >
          <div
            className="h-4 animate-pulse rounded bg-slate-800"
            style={{ width: i === 0 ? "70%" : i === 6 ? "90%" : "50%" }}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

/** Animated, keyboard- and touch-accessible bar chart for monthly volume.
 * Tooltips open on hover (desktop), tap (mobile), and keyboard focus, so
 * insight isn't gated behind a mouse. */
function MonthlyActivityChart({ data }: { data: MonthlyTransactionStat[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const maxValue = Math.max(1, ...data.map((m) => m.total_transactions));
  const gridLines = [1, 0.75, 0.5, 0.25, 0].map((fraction) =>
    Math.round(maxValue * fraction),
  );

  if (data.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No monthly data yet"
        description="Activity will appear here once transactions start coming in."
      />
    );
  }

  return (
    <div
      className="relative h-56 sm:h-64"
      role="img"
      aria-label={`Monthly transaction volume, ${data.length} months, peaking at ${maxValue.toLocaleString()} transactions`}
    >
      {/* Gridlines + y-axis labels */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {gridLines.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-zinc-600">
              {formatCompactNumber(val)}
            </span>
            <div className="h-px flex-1 bg-slate-800/70" />
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="relative ml-11 flex h-full items-end justify-between gap-2 sm:gap-3">
        {data.map((month, i) => {
          const heightPct =
            month.total_transactions > 0
              ? Math.max((month.total_transactions / maxValue) * 100, 2)
              : 0;
          const isActive = activeIndex === i;
          return (
            <div
              key={month.month || i}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
            >
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() =>
                  setActiveIndex((cur) => (cur === i ? null : cur))
                }
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex((cur) => (cur === i ? null : cur))}
                onClick={() => setActiveIndex((cur) => (cur === i ? null : i))}
                className="flex w-full flex-1 items-end justify-center rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                aria-label={`${month.label}: ${month.total_transactions.toLocaleString()} transactions, ${formatCurrency(month.total_debit)} debit, ${formatCurrency(month.total_credit)} credit`}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.6, delay: i * 0.04, ease: "easeOut" }
                  }
                  className={cn(
                    "w-full min-h-[2px] rounded-t-md bg-gradient-to-t from-emerald-500/30 to-emerald-500 transition-colors duration-200",
                    isActive && "from-emerald-500/60 to-emerald-400",
                  )}
                />
              </button>

              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[11rem] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] leading-4 text-zinc-300 shadow-xl"
                  >
                    <div className="font-medium text-white">{month.label}</div>
                    <div>{month.total_transactions.toLocaleString()} txns</div>
                    <div className="text-red-300">
                      Debit {formatCurrency(month.total_debit)}
                    </div>
                    <div className="text-emerald-300">
                      Credit {formatCurrency(month.total_credit)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <span className="mt-2 text-xs font-medium text-zinc-500">
                {month.label.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.user.user);
  const [isMounted, setIsMounted] = useState(false);
  const [overviewStats, setOverviewStats] = useState<
    TransactionsResponseData["overview_stats"] | null
  >(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copiedTxnId, setCopiedTxnId] = useState<string | null>(null);

  const [limit, setLimit] = useState(50);
  const [keyType, setKeyType] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [endpointInput, setEndpointInput] = useState("");
  const [txnIdInput, setTxnIdInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const endpoint = useDebouncedValue(endpointInput);
  const txnId = useDebouncedValue(txnIdInput);
  const debouncedSearchQuery = useDebouncedValue(
    searchQuery,
    SEARCH_DEBOUNCE_MS,
  );

  const [hasLoadedMore, setHasLoadedMore] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const activeFilters = useMemo<TransactionFilters>(() => {
    const filters: TransactionFilters = { limit };
    if (keyType !== ALL) filters.key_type = keyType as TransactionKeyType;
    if (type !== ALL) filters.type = type as TransactionType;
    if (status !== ALL) filters.status = status as TransactionStatus;
    if (endpoint) filters.endpoint = endpoint;
    if (txnId) filters.txn_id = txnId;
    return filters;
  }, [limit, keyType, type, status, endpoint, txnId]);

  // Every fetch (initial or paginated) is tagged with a generation id. If
  // filters change while a request is in flight, the id is bumped and the
  // stale response is dropped when it resolves — this avoids a slower,
  // superseded request overwriting the table with the wrong data.
  const loadInitial = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (hasLoadedOnceRef.current) setIsRefreshing(true);
    else setIsLoadingInitial(true);
    setError(null);

    try {
      const response = await fetchTransactions(activeFilters);
      if (requestId !== requestIdRef.current) return;
      setTransactions(response.transactions);
      setOverviewStats(response.overview_stats);
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
      setHasLoadedMore(false);
      setLastUpdated(new Date());
      hasLoadedOnceRef.current = true;
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = getErrorMessage(err, "Failed to load transactions");
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoadingInitial(false);
        setIsRefreshing(false);
      }
    }
  }, [activeFilters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    const requestId = requestIdRef.current;
    setIsLoadingMore(true);
    try {
      const response = await fetchTransactions({
        ...activeFilters,
        cursor: nextCursor,
      });
      if (requestId !== requestIdRef.current) return;
      setTransactions((prev) => [...prev, ...response.transactions]);
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
      setHasLoadedMore(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      toast.error(getErrorMessage(err, "Failed to load more"));
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingMore(false);
    }
  }, [activeFilters, nextCursor, hasMore, isLoadingMore]);

  useEffect(() => {
    void loadInitial();
    // Refetch whenever a filter changes; `loadInitial` itself is derived
    // from these same values so it's intentionally left out of the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, keyType, type, status, endpoint, txnId]);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  // Invalidate any in-flight request on unmount so a late response can't
  // trigger a state update on an unmounted component.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () =>
      setIsTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!isTabVisible || hasLoadedMore) return;
    const interval = setInterval(() => void loadInitial(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isTabVisible, hasLoadedMore, loadInitial]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoadingInitial
        ) {
          loadMore();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingInitial, loadMore]);

  const handleResetFilters = () => {
    setLimit(50);
    setKeyType(ALL);
    setType(ALL);
    setStatus(ALL);
    setEndpointInput("");
    setTxnIdInput("");
    setSearchQuery("");
  };

  const filteredTransactions = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (!query) return transactions;
    return transactions.filter(
      (t) =>
        (t.txn_id ?? "").toLowerCase().includes(query) ||
        (t.endpoint ?? "").toLowerCase().includes(query) ||
        (t.description ?? "").toLowerCase().includes(query) ||
        (t.key_type ?? "").toLowerCase().includes(query),
    );
  }, [transactions, debouncedSearchQuery]);

  const handleCopyTxnId = useCallback(async (id: string) => {
    if (!id) return;
    const ok = await copyToClipboard(id);
    if (!ok) {
      toast.error("Failed to copy transaction ID");
      return;
    }
    setCopiedTxnId(id);
    toast.success("Transaction ID copied");
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedTxnId(null), 2000);
  }, []);

  const monthlyData = overviewStats?.monthly ?? [];

  const todaySuccessRate = overviewStats
    ? overviewStats.today.total_transactions > 0
      ? Math.round(
          (overviewStats.today.total_success /
            overviewStats.today.total_transactions) *
            100,
        )
      : 100
    : 0;

  const showOverviewSkeleton = !overviewStats && isLoadingInitial;
  const showTableSkeleton =
    isLoadingInitial && transactions.length === 0 && !error;

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <Activity className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
   <span className="text-emerald-400">Welcome,</span>{" "}
   <span className="text-amber-400">
      {isMounted ? user?.name?.split(" ")[0] || "User" : "Guest"}
   </span>
   <span className="mx-2 text-zinc-600">|</span>
   <span className="text-zinc-200">Commercial Dashboard</span>
</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Wallet &amp; transaction analytics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void loadInitial()}
            disabled={isRefreshing}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 text-zinc-400 transition hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Refresh now"
            aria-label="Refresh now"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </button>
          <span
            className="text-xs text-zinc-500"
            role="status"
            aria-live="polite"
          >
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Not updated yet"}
          </span>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {showOverviewSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : overviewStats ? (
          <>
            <StatCard
              label="Today Transactions"
              value={overviewStats.today.total_transactions.toLocaleString()}
              icon={Zap}
            />
            <StatCard
              label="Today Debit"
              value={formatCurrency(overviewStats.today.total_debit)}
              icon={ArrowDown}
              tone="red"
            />
            <StatCard
              label="Lifetime Transactions"
              value={overviewStats.lifetime.total_transactions.toLocaleString()}
              icon={Activity}
            />
            <StatCard
              label="Lifetime Credit"
              value={formatCurrency(overviewStats.lifetime.total_credit)}
              icon={ArrowUp}
            />
          </>
        ) : null}
      </div>

      {/* Chart + Status Breakdown */}
      {(overviewStats || showOverviewSkeleton) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium text-white">
                Monthly Activity
              </CardTitle>
              <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                Transactions
              </Badge>
            </CardHeader>
            <CardContent>
              {showOverviewSkeleton ? (
                <div className="flex h-56 items-end justify-between gap-2 sm:h-64 sm:gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-full animate-pulse rounded-t-md bg-slate-800"
                      style={{ height: `${30 + ((i * 13) % 55)}%` }}
                    />
                  ))}
                </div>
              ) : (
                <MonthlyActivityChart data={monthlyData} />
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
            <CardContent className="space-y-5 p-6">
              {showOverviewSkeleton || !overviewStats ? (
                <div className="space-y-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-slate-800" />
                      <div className="h-5 w-20 animate-pulse rounded bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <p className="mb-2 text-sm text-zinc-400">
                      Today Success Rate
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-lg font-semibold text-white">
                        {todaySuccessRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-px w-full bg-slate-800" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-zinc-400">Today Credit</p>
                      <p className="mt-1 text-xl font-bold text-emerald-400">
                        {formatCurrency(overviewStats.today.total_credit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Lifetime Debit</p>
                      <p className="mt-1 text-xl font-bold text-white">
                        {formatCurrency(overviewStats.lifetime.total_debit)}
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-800" />

                  <div>
                    <p className="mb-2 text-sm text-zinc-400">
                      Today Status Breakdown
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />{" "}
                        {overviewStats.today.status_breakdown.total_completed}{" "}
                        completed
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                        <Clock className="h-3 w-3" />{" "}
                        {overviewStats.today.status_breakdown.total_pending}{" "}
                        pending
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                        <XCircle className="h-3 w-3" />{" "}
                        {overviewStats.today.status_breakdown.total_failed}{" "}
                        failed
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs text-slate-400">
                        <RotateCcw className="h-3 w-3" />{" "}
                        {overviewStats.today.status_breakdown.total_reversed}{" "}
                        reversed
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-medium text-white">
            <Filter className="h-4 w-4 text-emerald-400" /> Transaction Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <Label className="text-zinc-300">Limit</Label>
              <Select
                value={String(limit)}
                onValueChange={(val) => setLimit(Number(val))}
              >
                <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-800/50 text-white">
                  <SelectValue placeholder="Select limit" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-zinc-300">Key Type</Label>
              <Select value={keyType} onValueChange={setKeyType}>
                <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-800/50 text-white">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="DEVELOPMENT">Development</SelectItem>
                  <SelectItem value="PRODUCTION">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-zinc-300">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-800/50 text-white">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-zinc-300">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-800/50 text-white">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="REVERSED">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-zinc-300">Endpoint</Label>
              <Input
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                placeholder="e.g. /api/v1/..."
                className="mt-2 rounded-xl border-slate-700 bg-slate-800/50 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-zinc-300">Transaction ID</Label>
              <Input
                value={txnIdInput}
                onChange={(e) => setTxnIdInput(e.target.value)}
                placeholder="TXN-..."
                className="mt-2 rounded-xl border-slate-700 bg-slate-800/50 text-white placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button className="rounded-xl" size="sm" onClick={handleResetFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-medium text-white">
              Recent Transactions
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-400">
              Scroll inside the table to load more.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search loaded rows..."
                aria-label="Search loaded transactions"
                className="w-48 rounded-xl border-slate-700 bg-slate-800/50 pl-8 pr-8 text-sm text-white placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Badge className="border border-slate-700 bg-slate-800/70 text-zinc-300">
              {filteredTransactions.length} loaded
            </Badge>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-hidden p-4">
          {error && transactions.length === 0 ? (
            <ErrorState message={error} onRetry={() => void loadInitial()} />
          ) : !showTableSkeleton && filteredTransactions.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No transactions found"
              description="Try adjusting your filters or search."
            />
          ) : (
            <div className="flex flex-col rounded-2xl border border-slate-800">
              <div className="max-h-[65vh] overflow-y-auto rounded-2xl bg-slate-950/40 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                    <TableRow className="border-slate-800 hover:bg-transparent [&>th]:border-b-slate-800 [&>th]:bg-slate-900">
                      <TableHead className="pl-6 text-zinc-400">
                        Transaction ID
                      </TableHead>
                      <TableHead className="text-zinc-400">
                        Date &amp; Time
                      </TableHead>
                      <TableHead className="text-zinc-400">Type</TableHead>
                      <TableHead className="text-zinc-400">Key Type</TableHead>
                      <TableHead className="text-zinc-400">Status</TableHead>
                      <TableHead className="text-zinc-400">Amount</TableHead>
                      <TableHead className="text-zinc-400">Endpoint</TableHead>
                      <TableHead className="pr-6 text-right text-zinc-400">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {showTableSkeleton
                      ? Array.from({ length: TABLE_SKELETON_ROWS }).map(
                          (_, i) => <TableRowSkeleton key={i} />,
                        )
                      : filteredTransactions.map((txn) => (
                          <TableRow
                            key={txn.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for transaction ${txn.txn_id || txn.id}`}
                            className="cursor-pointer border-slate-800 bg-slate-900/30 transition-colors hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
                            onClick={() => setSelectedTransaction(txn)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedTransaction(txn);
                              }
                            }}
                          >
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-1.5">
                                {txn.txn_id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyTxnId(txn.txn_id);
                                    }}
                                    className="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                    title="Copy transaction ID"
                                    aria-label="Copy transaction ID"
                                  >
                                    {copiedTxnId === txn.txn_id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )}
                                <span className="max-w-[100px] truncate font-mono text-[11px] text-emerald-400">
                                  {txn.txn_id || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-zinc-400">
                              {formatDate(txn.created_at)}
                            </TableCell>
                            <TableCell>
                              <TypeBadge type={txn.type} />
                            </TableCell>
                            <TableCell className="text-sm text-zinc-300">
                              {txn.key_type || "—"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={txn.status} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm font-medium text-white">
                              {formatCurrency(txn.amount)}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate font-mono text-xs text-zinc-400">
                              {txn.endpoint}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-slate-700 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTransaction(txn);
                                }}
                                aria-label="View transaction details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>

                <div ref={sentinelRef} className="h-1" />
                {isLoadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  </div>
                )}
                {!showTableSkeleton &&
                  !hasMore &&
                  filteredTransactions.length > 0 && (
                    <div className="py-6 text-center text-sm text-zinc-500">
                      — End of transactions —
                    </div>
                  )}
                {hasLoadedMore && (
                  <div className="pb-4 text-center text-xs text-zinc-600">
                    Auto-refresh paused while browsing older transactions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent className="max-h-[86vh] overflow-hidden rounded-2xl border-slate-800 bg-slate-900 p-0 sm:max-w-3xl">
          <div className="border-b border-slate-800 px-5 pb-4 pt-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-white">
                Transaction Details
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 pt-1 text-zinc-400">
                Transaction ID:{" "}
                <span className="font-mono text-zinc-300">
                  {selectedTransaction?.txn_id}
                </span>
                {selectedTransaction?.txn_id && (
                  <button
                    onClick={() => handleCopyTxnId(selectedTransaction.txn_id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    title="Copy Transaction ID"
                    aria-label="Copy Transaction ID"
                  >
                    {copiedTxnId === selectedTransaction.txn_id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[calc(86vh-120px)] overflow-y-auto px-5 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {selectedTransaction && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Amount
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-400">
                      {formatCurrency(selectedTransaction.amount)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Key Type
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {selectedTransaction.key_type || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Status
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={selectedTransaction.status} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Type
                    </p>
                    <div className="mt-2">
                      <TypeBadge type={selectedTransaction.type} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Created At
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {formatDate(selectedTransaction.created_at)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-400">
                    Endpoint
                  </p>
                  <pre className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-sm text-white break-all [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {selectedTransaction.endpoint}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  X,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Copy,
  Check,
  BarChart3,
  SearchCheck,
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
import { DataTable, type DataTableColumn } from "@/components/custom/DataTable";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const REFRESH_INTERVAL_MS = 120000; // 2 minutes
const FILTER_DEBOUNCE_MS = 400;
const SEARCH_DEBOUNCE_MS = 150;

// "ALL" is used as the Select sentinel value — Radix Select does not allow
// an empty string as an item value, so filters are keyed off this instead.
const ALL = "ALL";

// ─── Fetch + response normalization ────────────────────────────────────────
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

type StatCardTone = "emerald" | "cyan" | "violet" | "zinc" | "red" | "blue";

const toneStyles: Record<StatCardTone, string> = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  zinc: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  red: "border-red-500/20 bg-red-500/10 text-red-400",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatCardTone;
}

function StatCard({ label, value, icon: Icon, tone = "zinc" }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-3",
        "shadow-inner shadow-slate-950/30 transition-transform duration-200",
        "active:scale-[0.97]",
        "sm:rounded-2xl sm:p-4",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-zinc-400 sm:text-sm">{label}</p>
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border sm:h-8 sm:w-8",
            toneStyles[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
      </div>
      <p className="mt-2.5 truncate text-xl font-semibold text-white sm:mt-4 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:rounded-2xl sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-800 sm:w-24" />
        <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-slate-800 sm:h-8 sm:w-8" />
      </div>
      <div className="mt-2.5 h-6 w-16 animate-pulse rounded bg-slate-800 sm:mt-4 sm:h-8 sm:w-20" />
    </div>
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

// ─── Monthly Activity Chart ────────────────────────────────────────────────
// NOTE: no horizontal-scroll wrapper around this component. Bars are
// `flex-1` and shrink to fit the container width on their own, so a scroll
// wrapper isn't needed — and it was actively breaking the hover/tap
// tooltip, because `overflow-x-auto` forces the browser to also clip on
// the y-axis, cutting off the tooltip that pops up above each bar.
function MonthlyActivityChart({ data }: { data: MonthlyTransactionStat[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const maxValue = Math.max(1, ...data.map((m) => m.total_transactions));
  const gridLines = [1, 0.75, 0.5, 0.25, 0].map((fraction) =>
    Math.round(maxValue * fraction),
  );
  const barCount = data.length;

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
      // Extra top padding reserves room for the tooltip so it never gets
      // clipped by the card's edge, whatever the tallest bar's height is.
      className="relative h-52 pt-10 sm:h-64 sm:pt-12"
      role="img"
      aria-label={`Monthly transaction volume, ${data.length} months, peaking at ${maxValue.toLocaleString()} transactions`}
    >
      {/* Gridlines + y-axis labels */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-10 flex flex-col justify-between sm:top-12">
        {gridLines.map((val, i) => (
          <div key={i} className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-7 shrink-0 text-right text-[9px] tabular-nums text-zinc-600 sm:w-9 sm:text-[10px]">
              {formatCompactNumber(val)}
            </span>
            <div className="h-px flex-1 bg-slate-800/70" />
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="absolute inset-x-0 bottom-0 top-10 ml-9 flex items-end justify-between gap-1 sm:top-12 sm:ml-11 sm:gap-3">
        {data.map((month, i) => {
          const heightPct =
            month.total_transactions > 0
              ? Math.max((month.total_transactions / maxValue) * 100, 2)
              : 0;
          const isActive = activeIndex === i;

          // Keep the tooltip from clipping at the left/right edges of the
          // chart on narrow screens by nudging its anchor for the first
          // and last couple of bars instead of always centering it.
          const isNearStart = i < 1;
          const isNearEnd = i > barCount - 2;

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
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[9.5rem] rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[10px] leading-4 text-zinc-300 shadow-xl sm:max-w-[11rem] sm:text-[11px]",
                      isNearStart
                        ? "left-0"
                        : isNearEnd
                          ? "right-0"
                          : "left-1/2 -translate-x-1/2",
                    )}
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

              <span className="mt-2 truncate text-[10px] font-medium text-zinc-500 sm:text-xs">
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, keyType, type, status, endpoint, txnId]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  const columns = useMemo<DataTableColumn<Transaction>[]>(
    () => [
      {
        key: "txn_id",
        header: "Transaction ID",
        cell: (txn) => (
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
        ),
      },
      {
        key: "created_at",
        header: "Date & Time",
        cellClassName: "whitespace-nowrap text-sm text-zinc-400",
        cell: (txn) => formatDate(txn.created_at),
      },
      {
        key: "type",
        header: "Type",
        cell: (txn) => <TypeBadge type={txn.type} />,
      },
      {
        key: "key_type",
        header: "Key Type",
        cellClassName: "text-sm text-zinc-300",
        cell: (txn) => txn.key_type || "—",
      },
      {
        key: "status",
        header: "Status",
        cell: (txn) => <StatusBadge status={txn.status} />,
      },
      {
        key: "amount",
        header: "Amount",
        cellClassName: "whitespace-nowrap text-sm font-medium text-white",
        cell: (txn) => formatCurrency(txn.amount),
      },
      {
        key: "endpoint",
        header: "Endpoint",
        cellClassName: "max-w-[160px] truncate font-mono text-xs text-zinc-400",
        skeletonWidth: "90%",
        cell: (txn) => txn.endpoint,
      },
      {
        key: "action",
        header: "Action",
        align: "right",
        cell: (txn) => (
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
        ),
      },
    ],
    [copiedTxnId, handleCopyTxnId],
  );

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
        className="flex flex-row items-center justify-between gap-2 sm:gap-4"
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <div className="relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 shadow-[0_8px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm sm:flex sm:h-12 sm:w-12">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-md" />
            <Activity className="relative h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] sm:h-6 sm:w-6" />
          </div>

          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold tracking-tight text-white xs:text-base sm:text-2xl">
              <span className="text-emerald-400">Welcome,</span>
              <span className="max-w-[90px] truncate text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)] xs:max-w-[120px] sm:max-w-none">
                {isMounted ? user?.name?.split(" ")[0] || "User" : "Guest"}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-600 sm:inline-block" />
              <span className="hidden text-zinc-100 sm:inline">
                Commercial Dashboard
              </span>
            </h1>
            <p className="truncate text-[10px] font-medium text-zinc-400 xs:text-[11px] sm:text-sm">
              <span className="sm:hidden">Commercial Dashboard</span>
              <span className="hidden sm:inline">
                Wallet &amp; transaction analytics.
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1.5 pr-2 shadow-sm backdrop-blur-sm sm:gap-2 sm:pr-3">
          <button
            onClick={() => void loadInitial()}
            disabled={isRefreshing}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-8 sm:w-8"
            title="Auto Refresh (Every 2 minutes)"
            aria-label="Refresh now"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 sm:h-4 sm:w-4",
                isRefreshing && "animate-spin",
              )}
            />
          </button>
          <span
            className="hidden truncate text-[11px] font-medium text-zinc-400 xs:inline-block sm:text-xs"
            role="status"
            aria-live="polite"
          >
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
        </div>
      </motion.div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-2.5 xs:gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        {showOverviewSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : overviewStats ? (
          <>
            <StatCard
              label="Today Transactions"
              value={overviewStats.today.total_transactions.toLocaleString()}
              icon={Zap}
              tone="blue"
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
              tone="zinc"
            />
            <StatCard
              label="Lifetime Credit"
              value={formatCurrency(overviewStats.lifetime.total_credit)}
              icon={ArrowUp}
              tone="emerald"
            />
          </>
        ) : (
          <div className="col-span-2 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 py-8 text-center text-sm text-zinc-500 sm:rounded-2xl lg:col-span-4">
            No stats available
          </div>
        )}
      </div>

      {/* Chart + Status Breakdown */}
      {(overviewStats || showOverviewSkeleton) && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <Card className="rounded-xl border border-slate-800 bg-slate-900/60 sm:rounded-2xl lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-base font-medium text-white sm:text-lg">
                Monthly Activity
              </CardTitle>
              <Badge className="shrink-0 border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-400 sm:text-xs">
                Transactions
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-2 sm:p-6 sm:pt-2">
              {showOverviewSkeleton ? (
                <div className="flex h-44 items-end justify-between gap-1.5 xs:h-48 sm:h-64 sm:gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-full animate-pulse rounded-t-md bg-slate-800"
                      style={{ height: `${30 + ((i * 13) % 55)}%` }}
                    />
                  ))}
                </div>
              ) : (
                // No overflow/scroll wrapper here anymore — bars shrink to
                // fit on their own, and this keeps the hover/tap tooltip
                // from getting clipped.
                <MonthlyActivityChart data={monthlyData} />
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-center rounded-xl border border-slate-800 bg-slate-900/60 sm:rounded-2xl">
            <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              {showOverviewSkeleton || !overviewStats ? (
                <div className="space-y-4 sm:space-y-5">
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
                    <p className="mb-2 text-xs text-zinc-400 sm:text-sm">
                      Today Success Rate
                    </p>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 sm:h-5 sm:w-5" />
                      <span className="text-base font-semibold text-white sm:text-lg">
                        {todaySuccessRate}%
                      </span>
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-800" />

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zinc-400 sm:text-sm">
                        Today Credit
                      </p>
                      <p className="mt-1 truncate text-base font-bold text-emerald-400 sm:text-xl">
                        {formatCurrency(overviewStats.today.total_credit)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-zinc-400 sm:text-sm">
                        Lifetime Debit
                      </p>
                      <p className="mt-1 truncate text-base font-bold text-white sm:text-xl">
                        {formatCurrency(overviewStats.lifetime.total_debit)}
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-800" />

                  <div>
                    <p className="mb-2 text-xs text-zinc-400 sm:text-sm">
                      Today Status Breakdown
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 sm:text-xs">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        {
                          overviewStats.today.status_breakdown.total_completed
                        }{" "}
                        completed
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400 sm:text-xs">
                        <Clock className="h-3 w-3 shrink-0" />
                        {
                          overviewStats.today.status_breakdown.total_pending
                        }{" "}
                        pending
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400 sm:text-xs">
                        <XCircle className="h-3 w-3 shrink-0" />
                        {overviewStats.today.status_breakdown.total_failed}{" "}
                        failed
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[11px] text-slate-400 sm:text-xs">
                        <RotateCcw className="h-3 w-3 shrink-0" />
                        {
                          overviewStats.today.status_breakdown.total_reversed
                        }{" "}
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
      <Card className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)] sm:rounded-2xl">
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-white sm:text-lg">
            <Filter className="h-4 w-4 shrink-0 text-emerald-400" /> Transaction
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <Label className="text-xs text-zinc-300 sm:text-sm">Limit</Label>
              <Select
                value={String(limit)}
                onValueChange={(val) => setLimit(Number(val))}
              >
                <SelectTrigger className="mt-1.5 rounded-xl border-slate-700 bg-slate-800/50 text-sm text-white sm:mt-2">
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
              <Label className="text-xs text-zinc-300 sm:text-sm">
                Key Type
              </Label>
              <Select value={keyType} onValueChange={setKeyType}>
                <SelectTrigger className="mt-1.5 rounded-xl border-slate-700 bg-slate-800/50 text-sm text-white sm:mt-2">
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
              <Label className="text-xs text-zinc-300 sm:text-sm">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1.5 rounded-xl border-slate-700 bg-slate-800/50 text-sm text-white sm:mt-2">
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
              <Label className="text-xs text-zinc-300 sm:text-sm">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5 rounded-xl border-slate-700 bg-slate-800/50 text-sm text-white sm:mt-2">
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
              <Label className="text-xs text-zinc-300 sm:text-sm">
                Endpoint
              </Label>
              <Input
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                placeholder="e.g. /api/v1/..."
                className="mt-1.5 rounded-xl border-slate-700 bg-slate-800/50 text-sm text-white placeholder:text-zinc-500 sm:mt-2"
              />
            </div>

            <div className="xs:col-span-2 lg:col-span-1">
              <Label className="text-xs text-zinc-300 sm:text-sm">
                Transaction ID
              </Label>
              <Input
                value={txnIdInput}
                onChange={(e) => setTxnIdInput(e.target.value)}
                placeholder="TXN-..."
                className="mt-1.5 rounded-xl border-slate-700 bg-slate-800/50 text-sm text-white placeholder:text-zinc-500 sm:mt-2"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-stretch sm:justify-end">
            <Button
              className="w-full rounded-xl sm:w-auto"
              size="sm"
              onClick={handleResetFilters}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        title="Recent Transactions"
        description="Scroll inside the table to load more."
        headerActions={showTableSkeleton ? null : <SearchCheck />}
        columns={columns}
        rows={filteredTransactions}
        getRowKey={(txn) => txn.id}
        getRowAriaLabel={(txn) =>
          `View details for transaction ${txn.txn_id || txn.id}`
        }
        onRowClick={setSelectedTransaction}
        isLoading={showTableSkeleton}
        error={transactions.length === 0 ? error : null}
        onRetry={() => void loadInitial()}
        emptyTitle="No transactions found"
        emptyDescription="Try adjusting your filters or search."
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        endMessage="— End of transactions —"
        footerNote={
          hasLoadedMore
            ? "Auto-refresh paused while browsing older transactions"
            : null
        }
      />

      {/* Transaction Details Dialog */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent
          className={cn(
            // Base
            "flex flex-col gap-0 overflow-hidden border-slate-800 bg-slate-900 p-0 shadow-2xl shadow-black/50",
            // Mobile: near full-screen sheet
            "h-[95dvh] w-[95vw] max-w-[95vw] rounded-2xl",
            // Tablet & up: centered modal
            "sm:h-auto sm:max-h-[86vh] sm:w-full sm:max-w-2xl sm:rounded-2xl",
            // Desktop: slightly wider
            "md:max-w-3xl",
          )}
        >
          {/* ── Header ─────────────────────────────────────── */}
          <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 px-4 pb-3.5 pt-4 backdrop-blur sm:px-5 sm:pb-4 sm:pt-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-semibold text-white sm:text-lg">
                Transaction Details
              </DialogTitle>

              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 sm:gap-2 sm:text-sm">
                  <span className="shrink-0">Transaction ID:</span>
                  <span className="truncate font-mono text-[11px] text-zinc-300 sm:text-xs">
                    {selectedTransaction?.txn_id}
                  </span>
                  {selectedTransaction?.txn_id && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyTxnId(selectedTransaction.txn_id)
                      }
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                </div>
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* ── Scrollable Body ────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
            {selectedTransaction && (
              <div className="space-y-4 sm:space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Amount */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 backdrop-blur-sm sm:p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
                      Amount
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-emerald-400 sm:mt-2">
                      {formatCurrency(selectedTransaction.amount)}
                    </p>
                  </div>

                  {/* Key Type */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 backdrop-blur-sm sm:p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
                      Key Type
                    </p>
                    <p className="mt-1.5 truncate text-sm text-white sm:mt-2">
                      {selectedTransaction.key_type || "—"}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 backdrop-blur-sm sm:p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
                      Status
                    </p>
                    <div className="mt-1.5 sm:mt-2">
                      <StatusBadge status={selectedTransaction.status} />
                    </div>
                  </div>

                  {/* Type */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 backdrop-blur-sm sm:p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
                      Type
                    </p>
                    <div className="mt-1.5 sm:mt-2">
                      <TypeBadge type={selectedTransaction.type} />
                    </div>
                  </div>

                  {/* Created At — full width on mobile, spans 2 on sm */}
                  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 backdrop-blur-sm sm:col-span-2 sm:p-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px] sm:tracking-[0.18em]">
                      Created At
                    </p>
                    <p className="mt-1.5 text-sm text-white sm:mt-2">
                      {formatDate(selectedTransaction.created_at)}
                    </p>
                  </div>
                </div>

                {/* Endpoint */}
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-400 sm:text-sm">
                    Endpoint
                  </p>
                  <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-white break-all whitespace-pre-wrap sm:rounded-2xl sm:p-4 sm:text-sm">
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

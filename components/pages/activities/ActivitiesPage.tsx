"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Activity as ActivityIcon, Copy, Eye, Filter, X } from "lucide-react";
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
import { DataTable, type DataTableColumn } from "@/components/custom/DataTable";
import { get } from "@/lib/api";
import type {
  Activity as ActivityItem,
  ActivityFilters,
  ActivitiesResponseData,
} from "@/lib/types";
import { cn, formatDate, formatCurrency } from "@/lib/utils";

// ─── API ─────────────────────────────────────────────────────────────────────

const parseOverviewSection = (section: unknown) => {
  const obj = (section as Record<string, unknown>) ?? {};
  return {
    total_activities: Number(obj.total_activities ?? 0),
    total_spent: Number(obj.total_spent ?? 0),
    total_success: Number(obj.total_success ?? 0),
  };
};

const normalizeActivitiesResponse = (
  payload: unknown,
): ActivitiesResponseData => {
  const source = (payload as Record<string, unknown>) ?? {};
  const raw = (source.responseData ??
    source.data ??
    source.result ??
    source) as Record<string, unknown>;

  const overviewSource =
    (raw.overview as Record<string, unknown> | undefined) ??
    (source.overview as Record<string, unknown> | undefined) ??
    ({
      today: raw.today ?? source.today,
      lifetime: raw.lifetime ?? source.lifetime,
    } as Record<string, unknown>);

  return {
    overview: {
      today: parseOverviewSection(overviewSource.today),
      lifetime: parseOverviewSection(overviewSource.lifetime),
    },
    activities: Array.isArray(raw.activities)
      ? (raw.activities as ActivitiesResponseData["activities"])
      : [],
    limit: Number(raw.limit ?? 50),
    has_more: Boolean(raw.has_more),
    next_cursor: typeof raw.next_cursor === "string" ? raw.next_cursor : null,
  };
};

const fetchActivities = async (
  filters: ActivityFilters,
): Promise<ActivitiesResponseData> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });

  const query = params.toString();
  const response = await get(
    `/api/v1/user/get-activities${query ? `?${query}` : ""}`,
  );
  return normalizeActivitiesResponse(response);
};

const getActivityErrorMessage = (err: unknown, fallback: string): string => {
  const message = (
    err as { response?: { data?: { responseStatus?: { message?: string } } } }
  )?.response?.data?.responseStatus?.message;
  return message || fallback;
};

// ─── Constants and helpers ───────────────────────────────────────────────────

interface Option {
  value: string;
  label: string;
}

const FILTER_DEBOUNCE_MS = 400;

// Radix Select does not allow an empty-string item value.
const ALL = "ALL";
const ALL_OPTION: Option = { value: ALL, label: "All" };

const LIMIT_OPTIONS: Option[] = [10, 25, 50, 100].map((n) => ({
  value: String(n),
  label: String(n),
}));

const PAGE_OPTIONS: Option[] = [
  ALL_OPTION,
  { value: "digitalIntelligence", label: "digitalIntelligence" },
  { value: "365Intelligence", label: "365Intelligence" },
  // { value: "Auth", label: "Auth" }, currently not used
];

const METHOD_OPTIONS: Option[] = [
  ALL_OPTION,
  ...["GET", "POST", "PUT", "DELETE"].map((m) => ({ value: m, label: m })),
];

const METHOD_STYLES: Record<string, string> = {
  GET: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  POST: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  PUT: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  PATCH: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  DELETE: "border-red-500/20 bg-red-500/10 text-red-400",
};
const DEFAULT_METHOD_STYLE =
  "border-slate-500/20 bg-slate-500/10 text-slate-400";

const HIDE_SCROLLBAR =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const containerMotion = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

const getActivityAmount = (a: ActivityItem) =>
  Math.abs((a.before_balance ?? 0) - (a.after_balance ?? 0));

const getActivityKey = (a: ActivityItem) =>
  a.txn_id || `${a.endpoint}-${a.timestamp}`;

const copyTxnId = async (id: string) => {
  try {
    await navigator.clipboard.writeText(id);
    toast.success("Transaction ID copied!");
  } catch {
    toast.error("Failed to copy");
  }
};

function useDebouncedValue<T>(value: T, delay = FILTER_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Small components ────────────────────────────────────────────────────────

function MethodBadge({ method }: { method?: string }) {
  const style =
    METHOD_STYLES[(method || "GET").toUpperCase()] ?? DEFAULT_METHOD_STYLE;
  return <Badge className={cn("border font-mono", style)}>{method}</Badge>;
}

function StatusBadge({ code }: { code?: number | null }) {
  const safeCode = code ?? 0;
  const isSuccess = safeCode >= 200 && safeCode < 300;
  return (
    <Badge
      className={cn(
        "gap-1 border px-2 py-0.5",
        isSuccess
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-400",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isSuccess ? "bg-emerald-400" : "bg-red-400",
        )}
      />
      {isSuccess ? "OK" : safeCode || "Error"}
    </Badge>
  );
}

function CopyIdButton({ id, className }: { id: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copyTxnId(id);
      }}
      className={className}
      title="Copy Transaction ID"
      aria-label="Copy Transaction ID"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-zinc-300">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-zinc-300">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white placeholder:text-zinc-500"
      />
    </div>
  );
}

function DetailCard({
  label,
  valueClassName,
  children,
}: {
  label: string;
  valueClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <div className={cn("mt-2 text-sm text-white", valueClassName)}>
        {children}
      </div>
    </div>
  );
}

function PayloadBlock({
  title,
  data,
  className,
}: {
  title: string;
  data: unknown;
  className?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <ActivityIcon className="h-4 w-4 text-emerald-400" />
          {title}
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          JSON
        </span>
      </div>
      <pre
        className={cn(
          "max-h-[260px] overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-sm leading-6",
          HIDE_SCROLLBAR,
          className,
        )}
      >
        {JSON.stringify(data ?? {}, null, 2)}
      </pre>
    </div>
  );
}

function ActivityDetailsDialog({
  activity,
  onClose,
}: {
  activity: ActivityItem | null;
  onClose: () => void;
}) {
  return (
   <Dialog open={!!activity} onOpenChange={(open) => !open && onClose()}>
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
    {/* ── Header (sticky) ────────────────────────────── */}
    <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 px-4 pb-3.5 pt-4 backdrop-blur sm:px-5 sm:pb-4 sm:pt-5">
      <DialogHeader className="space-y-2 text-left">
        <DialogTitle className="text-base font-semibold text-white sm:text-lg">
          Activity Details
        </DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 sm:gap-2 sm:text-sm">
            <span className="shrink-0">Transaction ID:</span>
            <span className="min-w-0 truncate font-mono text-[11px] text-emerald-400 sm:text-xs">
              {activity?.txn_id}
            </span>
            {activity?.txn_id && (
              <CopyIdButton
                id={activity.txn_id}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            )}
          </div>
        </DialogDescription>
      </DialogHeader>
    </div>

    {/* ── Scrollable Body ────────────────────────────── */}
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5",
        HIDE_SCROLLBAR,
      )}
    >
      {activity && (
        <div className="space-y-4 sm:space-y-5">
          {/* Detail grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Endpoint — full width on mobile, normal on sm+ */}
            <DetailCard
              label="Endpoint"
              valueClassName="break-all font-mono text-xs sm:text-sm"
            >
              {activity.endpoint}
            </DetailCard>

            {/* Amount */}
            <DetailCard
              label="Amount"
              valueClassName="font-semibold text-emerald-400"
            >
              {formatCurrency(getActivityAmount(activity))}
            </DetailCard>

            {/* Page */}
            <DetailCard label="Page">
              <span className="truncate">{activity.page || "—"}</span>
            </DetailCard>

            {/* Method & Status */}
            <DetailCard label="Method & Status">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method={activity.method} />
                <StatusBadge code={activity.status_code} />
              </div>
            </DetailCard>

            {/* Duration */}
            <DetailCard label="Duration">
              {activity.duration} ms
            </DetailCard>

            {/* Timestamp */}
            <DetailCard label="Timestamp">
              {formatDate(activity.timestamp)}
            </DetailCard>
          </div>

          {/* Payload blocks — stack on mobile, full width always */}
          <div className="space-y-4 sm:space-y-5">
            <PayloadBlock
              title="Request Payload"
              data={activity.request_payload}
            />
            <PayloadBlock
              title="Response Payload"
              data={activity.response_payload}
              className="text-zinc-200"
            />
          </div>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null,
  );

  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(ALL);
  const [method, setMethod] = useState(ALL);
  const [statusCode, setStatusCode] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [txnId, setTxnId] = useState("");

  const debouncedStatusCode = useDebouncedValue(statusCode);
  const debouncedEndpoint = useDebouncedValue(endpoint);
  const debouncedTxnId = useDebouncedValue(txnId);

  // Tags every fetch so a slower, superseded response can be dropped.
  const requestIdRef = useRef(0);

  const activeFilters = useMemo<ActivityFilters>(() => {
    const filters: ActivityFilters = { limit };
    const code = Number(debouncedStatusCode);
    if (Number.isInteger(code) && code > 0) filters.status_code = code;
    if (method !== ALL) filters.method = method;
    if (page !== ALL) filters.page = page;
    if (debouncedEndpoint.trim()) filters.endpoint = debouncedEndpoint.trim();
    if (debouncedTxnId.trim()) filters.txn_id = debouncedTxnId.trim();
    return filters;
  }, [
    limit,
    method,
    page,
    debouncedStatusCode,
    debouncedEndpoint,
    debouncedTxnId,
  ]);

  const loadInitial = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoadingInitial(true);
    setIsLoadingMore(false);
    setError(null);
    try {
      const response = await fetchActivities(activeFilters);
      if (requestId !== requestIdRef.current) return;
      setActivities(response.activities);
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      const message = getActivityErrorMessage(err, "Failed to load activities");
      setError(message);
      toast.error(message);
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingInitial(false);
    }
  }, [activeFilters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    const requestId = requestIdRef.current;
    setIsLoadingMore(true);
    try {
      const response = await fetchActivities({
        ...activeFilters,
        cursor: nextCursor,
      });
      if (requestId !== requestIdRef.current) return;
      setActivities((prev) => [...prev, ...response.activities]);
      setNextCursor(response.next_cursor);
      setHasMore(response.has_more);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      toast.error(getActivityErrorMessage(err, "Failed to load more"));
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingMore(false);
    }
  }, [activeFilters, nextCursor, hasMore, isLoadingMore]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleResetFilters = () => {
    setLimit(50);
    setPage(ALL);
    setMethod(ALL);
    setStatusCode("");
    setEndpoint("");
    setTxnId("");
  };

  const columns = useMemo<DataTableColumn<ActivityItem>[]>(
    () => [
      {
        key: "txn_id",
        header: "Transaction ID",
        cellClassName: "max-w-[150px]",
        cell: (a) => (
          <div className="flex items-center justify-start gap-2">
            {a.txn_id && (
              <CopyIdButton
                id={a.txn_id}
                className="text-zinc-500 transition-colors hover:text-emerald-400"
              />
            )}
            <span className="truncate font-mono text-xs text-emerald-400">
              {a.txn_id || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "timestamp",
        header: "Date & Time",
        cellClassName: "whitespace-nowrap text-sm text-zinc-400",
        cell: (a) => (a.timestamp ? formatDate(a.timestamp) : "—"),
      },
      {
        key: "page",
        header: "Page",
        cellClassName: "text-sm font-medium text-zinc-300",
        cell: (a) => a.page || "General",
      },
      {
        key: "endpoint",
        header: "Endpoint",
        cellClassName: "max-w-[200px] truncate font-mono text-sm text-zinc-400",
        cell: (a) => a.endpoint,
      },
      {
        key: "method",
        header: "Method",
        cell: (a) => <MethodBadge method={a.method} />,
      },
      {
        key: "status",
        header: "Status",
        cell: (a) => <StatusBadge code={a.status_code} />,
      },
      {
        key: "duration",
        header: "Duration",
        cellClassName: "text-sm text-zinc-400",
        cell: (a) => `${a.duration} ms`,
      },
      {
        key: "amount",
        header: "Amount",
        cellClassName: "text-sm font-medium text-emerald-400",
        cell: (a) => formatCurrency(getActivityAmount(a)),
      },
      {
        key: "action",
        header: "Action",
        align: "right",
        cell: (a) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-slate-700 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedActivity(a);
            }}
            aria-label="View activity details"
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerMotion}
      className="space-y-5 sm:space-y-6"
    >
      <motion.div variants={itemMotion}>
        <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-medium text-white">
              <Filter className="h-4 w-4 text-emerald-400" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SelectField
                label="Limit"
                value={String(limit)}
                onChange={(v) => setLimit(Number(v))}
                options={LIMIT_OPTIONS}
                placeholder="Select limit"
              />
              <SelectField
                label="Page"
                value={page}
                onChange={setPage}
                options={PAGE_OPTIONS}
                placeholder="All pages"
              />
              <SelectField
                label="Method"
                value={method}
                onChange={setMethod}
                options={METHOD_OPTIONS}
                placeholder="All methods"
              />
              <InputField
                label="Status Code"
                value={statusCode}
                onChange={setStatusCode}
                placeholder="e.g. 200"
                inputMode="numeric"
              />
              <InputField
                label="Endpoint"
                value={endpoint}
                onChange={setEndpoint}
                placeholder="e.g. mobile"
              />
              <InputField
                label="Transaction ID"
                value={txnId}
                onChange={setTxnId}
                placeholder="TXN-..."
                className="sm:col-span-2 lg:col-span-1"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleResetFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemMotion}>
        <DataTable
          title="Activity Logs"
          description="Scroll within the table to load more activities automatically."
          columns={columns}
          rows={activities}
          getRowKey={getActivityKey}
          onRowClick={setSelectedActivity}
          isLoading={isLoadingInitial}
          loadingVariant="spinner"
          error={error}
          onRetry={loadInitial}
          emptyTitle="No activities found"
          emptyDescription="Adjust your filters."
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
          endMessage="— End of activities —"
        />
      </motion.div>

      <ActivityDetailsDialog
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </motion.div>
  );
}

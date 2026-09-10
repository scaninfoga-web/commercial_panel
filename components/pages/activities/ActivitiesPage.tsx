"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Activity as ActivityIcon, // Renamed to avoid conflict with type
  Loader2,
  Eye,
  Filter,
  X,
  Inbox,
  Copy,
  AlertTriangle,
} from "lucide-react";
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
import { get } from "@/lib/api"; // Direct import from lib/api
import type {
  Activity as ActivityItem,
  ActivityFilters,
  ActivitiesResponseData,
} from "@/lib/types"; // Import types from global type file
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { PageShell } from "@/components/custom/page-shell";

// ─── Local API Helpers (Merged from lib/activities.ts) ───────────────────────
const normalizeActivitiesResponse = (payload: unknown): ActivitiesResponseData => {
  const source = (payload as Record<string, unknown>) ?? {};
  const raw = (source.responseData ?? source.data ?? source.result ?? source) as Record<string, unknown>;

  const activities = Array.isArray(raw.activities)
    ? (raw.activities as ActivitiesResponseData["activities"])
    : [];

  const overviewSource =
    (raw.overview as Record<string, unknown> | undefined) ??
    (source.overview as Record<string, unknown> | undefined) ??
    ({
      today: raw.today ?? source.today,
      lifetime: raw.lifetime ?? source.lifetime,
    } as Record<string, unknown>);

  const parseOverviewSection = (section: unknown) => {
    const obj = (section as Record<string, unknown>) ?? {};
    return {
      total_activities: Number(obj.total_activities ?? 0),
      total_spent: Number(obj.total_spent ?? 0),
      total_success: Number(obj.total_success ?? 0),
    };
  };

  return {
    overview: {
      today: parseOverviewSection(overviewSource.today),
      lifetime: parseOverviewSection(overviewSource.lifetime),
    },
    activities,
    limit: Number(raw.limit ?? 50),
    has_more: Boolean(raw.has_more ?? false),
    next_cursor: typeof raw.next_cursor === "string" ? raw.next_cursor : null,
  };
};

const fetchActivities = async (filters: ActivityFilters = {}): Promise<ActivitiesResponseData> => {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.status_code) params.set("status_code", String(filters.status_code));
  if (filters.method) params.set("method", filters.method);
  if (filters.endpoint) params.set("endpoint", filters.endpoint);
  if (filters.page) params.set("page", filters.page);
  if (filters.txn_id) params.set("txn_id", filters.txn_id);

  const query = params.toString();
  const endpoint = `/api/v1/user/get-activities${query ? `?${query}` : ""}`;
  const response = await get(endpoint);
  return normalizeActivitiesResponse(response);
};

const getActivityErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { responseStatus?: { message?: string } } } }).response;
    const message = response?.data?.responseStatus?.message;
    if (message) return message;
  }
  return fallback;
};

// ─── UI Constants & Helpers ───────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const containerMotion = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const methodBadgeClass = (method?: string) => {
  const normalized = (method || "GET").toUpperCase();
  if (normalized === "GET") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  if (normalized === "POST") return "border-sky-500/20 bg-sky-500/10 text-sky-400";
  if (normalized === "PUT" || normalized === "PATCH")
    return "border-amber-500/20 bg-amber-500/10 text-amber-400";
  if (normalized === "DELETE") return "border-red-500/20 bg-red-500/10 text-red-400";
  return "border-slate-500/20 bg-slate-500/10 text-slate-400";
};

const StatusBadge = ({ code }: { code?: number | null }) => {
  const safeCode = code ?? 0;
  const isSuccess = safeCode >= 200 && safeCode < 300;
  return (
    <Badge
      className={cn(
        "gap-1 px-2 py-0.5 border",
        isSuccess
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", isSuccess ? "bg-emerald-400" : "bg-red-400")} />
      {isSuccess ? "OK" : safeCode || "Error"}
    </Badge>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  // Filters
  const [limit, setLimit] = useState<number>(50);
  const [statusCode, setStatusCode] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("");
  const [page, setPage] = useState<string>("");
  const [txnId, setTxnId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const activeFilters = useMemo<ActivityFilters>(() => {
    const filters: ActivityFilters = { limit };
    if (statusCode) filters.status_code = Number(statusCode);
    if (method) filters.method = method;
    if (endpoint) filters.endpoint = endpoint;
    if (page) filters.page = page;
    if (txnId) filters.txn_id = txnId;
    return filters;
  }, [limit, statusCode, method, endpoint, page, txnId]);

  const loadInitial = useCallback(async () => {
    setIsLoadingInitial(true);
    setError(null);
    try {
      const response: ActivitiesResponseData = await fetchActivities(activeFilters);
      setActivities(response.activities || []);
      setNextCursor(response.next_cursor || null);
      setHasMore(response.has_more || false);
    } catch (err: unknown) {
      const message = getActivityErrorMessage(err, "Failed to load activities");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [activeFilters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response: ActivitiesResponseData = await fetchActivities({
        ...activeFilters,
        cursor: nextCursor,
      });
      setActivities((prev) => [...prev, ...(response.activities || [])]);
      setNextCursor(response.next_cursor || null);
      setHasMore(response.has_more || false);
    } catch (err: unknown) {
      const message = getActivityErrorMessage(err, "Failed to load more");
      toast.error(message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeFilters, nextCursor, hasMore, isLoadingMore]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Attach observer to the table's scroll container
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = tableScrollRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingInitial) {
          loadMore();
        }
      },
      { root: root, rootMargin: "100px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingInitial, loadMore]);

  const handleResetFilters = () => {
    setLimit(50);
    setStatusCode("");
    setMethod("");
    setEndpoint("");
    setPage("");
    setTxnId("");
    setSearchQuery("");
  };

  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activities;
    return activities.filter(
      (a) =>
        (a.txn_id ?? "").toLowerCase().includes(query) ||
        (a.endpoint ?? "").toLowerCase().includes(query) ||
        (a.page ?? "").toLowerCase().includes(query) ||
        (a.method ?? "").toLowerCase().includes(query)
    );
  }, [activities, searchQuery]);

  return (
      <motion.div
        initial="hidden"
        animate="show"
        variants={containerMotion}
        className="space-y-5 sm:space-y-6"
      >
        {/* Filters Card */}
        <motion.div variants={itemMotion}>
          <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-medium text-white">
                <Filter className="h-4 w-4 text-emerald-400" /> Filters
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
                    <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white">
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
                  <Label className="text-zinc-300">Page</Label>
                  <Select value={page} onValueChange={(val) => setPage(val)}>
                    <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue placeholder="All pages" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="DigitalIntelligence">Digital Intelligence</SelectItem>
                      <SelectItem value="365Intelligence">365 Intelligence</SelectItem>
                      <SelectItem value="Auth">Auth</SelectItem>
                      <SelectItem value="Bulk Verifications">Bulk Verifications</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-zinc-300">Method</Label>
                  <Select value={method} onValueChange={(val) => setMethod(val)}>
                    <SelectTrigger className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white">
                      <SelectValue placeholder="All methods" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                      <SelectItem value="">All</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-zinc-300">Status Code</Label>
                  <Input
                    value={statusCode}
                    onChange={(e) => setStatusCode(e.target.value)}
                    placeholder="200, 404"
                    className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white placeholder:text-zinc-500"
                  />
                </div>

                <div>
                  <Label className="text-zinc-300">Endpoint</Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="e.g. mobile"
                    className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white placeholder:text-zinc-500"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <Label className="text-zinc-300">Transaction ID</Label>
                  <Input
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    placeholder="TXN-..."
                    className="mt-2 rounded-xl border-slate-700 bg-slate-950/60 text-white placeholder:text-zinc-500"
                  />
                </div>
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

        {/* Activities Table */}
        <motion.div variants={itemMotion}>
          <Card className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <CardTitle className="text-lg font-medium text-white">Activity Logs</CardTitle>
                <p className="mt-1 text-sm text-zinc-400">
                  Scroll within the table to load more activities automatically.
                </p>
              </div>
              <Badge className="border border-slate-700 bg-slate-800/70 text-zinc-300">
                {filteredActivities.length} loaded
              </Badge>
            </CardHeader>
            
            {/* Custom Scroll Container for Table */}
            <div className="flex-1 overflow-hidden p-4">
              {isLoadingInitial ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-300 max-w-sm">{error}</p>
                  <div className="w-fit">
                    <Button 
                      className="w-fit bg-red-600 px-4 text-white shadow-lg shadow-red-900/30 transition-none hover:bg-red-600 hover:text-white" 
                      onClick={loadInitial}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-16 text-center">
                  <Inbox className="mx-auto h-12 w-12 text-zinc-600" />
                  <p className="mt-4 text-sm text-zinc-400">
                    No activities found. Adjust your filters.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col rounded-2xl border border-slate-800">
                  {/* THIS is the scrollable area preventing page scroll */}
                  <div 
                    ref={tableScrollRef} 
                    className="max-h-[65vh] overflow-y-auto rounded-2xl bg-slate-950/40 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600"
                  >
                    <Table>
                      {/* Sticky Header ensures column names stay fixed at top while scrolling */}
                      <TableHeader className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                        <TableRow className="border-slate-800 hover:bg-transparent [&>th]:bg-slate-900 [&>th]:border-b-slate-800">
                          <TableHead className="pl-6 text-zinc-400">Transaction ID</TableHead>
                          <TableHead className="text-zinc-400">Date & Time</TableHead>
                          <TableHead className="text-zinc-400">Page</TableHead>
                          <TableHead className="text-zinc-400">Endpoint</TableHead>
                          <TableHead className="text-zinc-400">Method</TableHead>
                          <TableHead className="text-zinc-400">Status</TableHead>
                          <TableHead className="text-zinc-400">Duration</TableHead>
                          <TableHead className="text-zinc-400">Amount</TableHead>
                          <TableHead className="pr-6 text-right text-zinc-400">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActivities.map((activity) => {
                          const amount = Math.abs(
                            (activity.before_balance ?? 0) - (activity.after_balance ?? 0)
                          );
                          return (
                            <TableRow
                              key={activity.txn_id ?? `${activity.endpoint}-${activity.timestamp}`}
                              className="cursor-pointer border-slate-800 bg-slate-900/30 transition-colors hover:bg-slate-800/40"
                              onClick={() => setSelectedActivity(activity)}
                            >
                              <TableCell className="max-w-[150px] pl-6">
                                <div className="flex items-center justify-start gap-2">
                                  {activity.txn_id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(activity.txn_id);
                                        toast.success("Transaction ID copied!");
                                      }}
                                      className="text-zinc-500 transition-colors hover:text-emerald-400"
                                      title="Copy Transaction ID"
                                      aria-label="Copy Transaction ID"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <span className="truncate font-mono text-xs text-emerald-400">
                                    {activity.txn_id || "—"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-zinc-400">
                                {activity.timestamp ? formatDate(activity.timestamp) : "—"}
                              </TableCell>
                              <TableCell className="text-sm font-medium text-zinc-300">
                                {activity.page || "General"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate font-mono text-sm text-zinc-400">
                                {activity.endpoint}
                              </TableCell>
                              <TableCell>
                                <Badge className={cn("border font-mono", methodBadgeClass(activity.method))}>
                                  {activity.method}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <StatusBadge code={activity.status_code} />
                              </TableCell>
                              <TableCell className="text-sm text-zinc-400">
                                {activity.duration} ms
                              </TableCell>
                              <TableCell className="text-sm text-emerald-400 font-medium">
                                {formatCurrency(amount)}
                              </TableCell>
                              <TableCell className="pr-6 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-slate-700 hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedActivity(activity);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Sentinel placed INSIDE the scrollable container */}
                    <div ref={sentinelRef} className="h-1" />
                    {isLoadingMore && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                      </div>
                    )}
                    {!hasMore && filteredActivities.length > 0 && (
                      <div className="py-6 text-center text-sm text-zinc-500">
                        — End of activities —
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Activity Details Dialog */}
        <Dialog
          open={!!selectedActivity}
          onOpenChange={(open) => !open && setSelectedActivity(null)}
        >
          <DialogContent className="max-h-[86vh] overflow-hidden rounded-2xl border-slate-800 bg-slate-900 p-0 sm:max-w-3xl">
            <div className="border-b border-slate-800 px-5 pb-4 pt-5">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-white">
                  Activity Details
                </DialogTitle>
                <DialogDescription className="flex items-center flex-wrap gap-2 pt-1 text-zinc-400">
                  <span>Transaction ID:</span>
                  <span className="font-mono text-sm text-emerald-400">
                    {selectedActivity?.txn_id}
                  </span>
                  {selectedActivity?.txn_id && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedActivity.txn_id);
                        toast.success("Transaction ID copied!");
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      title="Copy Transaction ID"
                      aria-label="Copy Transaction ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Hidden Scrollbar Container - Scrolls perfectly but no visible UI scrollbar */}
            <div className="max-h-[calc(86vh-120px)] overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {selectedActivity && (
                <div className="space-y-5">
                  {/* Metadata Grid - Updated Theme Colors */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Endpoint
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-white">
                        {selectedActivity.endpoint}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Amount
                      </p>
                      <p className="mt-2 text-sm font-semibold text-emerald-400">
                        {formatCurrency(Math.abs(selectedActivity.before_balance - selectedActivity.after_balance))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Page
                      </p>
                      <p className="mt-2 text-sm text-white">{selectedActivity.page || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Method & Status
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className={cn("border font-mono", methodBadgeClass(selectedActivity.method))}>
                          {selectedActivity.method}
                        </Badge>
                        <StatusBadge code={selectedActivity.status_code} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Duration
                      </p>
                      <p className="mt-2 text-sm text-white">{selectedActivity.duration} ms</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 backdrop-blur-sm">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Timestamp
                      </p>
                      <p className="mt-2 text-sm text-white">
                        {formatDate(selectedActivity.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Request Payload */}
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
                    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                        <ActivityIcon className="h-4 w-4 text-emerald-400" />
                        Request Payload
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        JSON
                      </span>
                    </div>
                    <pre className="max-h-[260px] overflow-y-auto p-4 text-sm leading-6 whitespace-pre-wrap break-all font-mono [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {JSON.stringify(selectedActivity.request_payload ?? {}, null, 2)}
                    </pre>
                  </div>

                  {/* Response Payload */}
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
                    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                        <ActivityIcon className="h-4 w-4 text-emerald-400" />
                        Response Payload
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        JSON
                      </span>
                    </div>
                    <pre className="max-h-[260px] overflow-y-auto p-4 text-sm leading-6 text-zinc-200 whitespace-pre-wrap break-all font-mono [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {JSON.stringify(selectedActivity.response_payload ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-800 px-5 py-4">
              <Button 
                className="rounded-xl border-emerald-500/80 bg-emerald-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.18)] transition-colors hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
                onClick={() => setSelectedActivity(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
  );
}
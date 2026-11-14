"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCookie } from "cookies-next";
import {
  ArrowUpRight,
  AlertTriangle,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  Ticket,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { get } from "@/lib/api";
import type { ReportIssue } from "@/types/get_support";
import { TICKET_CATALOG } from "@/constants/Ticket_catalog";
import { cn } from "@/lib/utils";
import { parseSubject } from "./get_support_utils";
import { useSupportNotifications } from "@/hooks/useSupportNotifications";

type IssueResponse = ReportIssue["response"];
const GET_ISSUES_ENDPOINT = "/api/v1/report/get-report-issues";

function getErrorMessage(err: unknown): string {
  const error = err as {
    response?: {
      data?: { responseStatus?: { message?: string }; message?: string };
    };
    message?: string;
  } | null;
  return (
    error?.response?.data?.responseStatus?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Failed to load your support tickets."
  );
}

function isEmptyReportsMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("no report") ||
    normalized.includes("report issue") && normalized.includes("empty")
  );
}

function normalizeStatus(status: string) {
  return status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function statusLabel(status: string) {
  const key = normalizeStatus(status);
  return (
    TICKET_CATALOG.ticket_statuses.find(
      (item) => normalizeStatus(item) === key,
    ) ?? status.replace(/_/g, " ")
  );
}

function statusClass(status: string) {
  switch (normalizeStatus(status)) {
    case "OPEN":
    case "ASSIGNED":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400";
    case "IN_PROGRESS":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "WAITING_FOR_CUSTOMER":
    case "WAITING_FOR_TECHNICAL_TEAM":
    case "WAITING_FOR_THIRD_PARTY":
      return "border-violet-500/30 bg-violet-500/10 text-violet-400";
    case "RESOLVED":
    case "CLOSED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "REOPENED":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    default:
      return "border-slate-700 bg-slate-800 text-zinc-300";
  }
}

const STATUS_STEPS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const STATUS_ORDER: Record<string, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  RESOLVED: 2,
  CLOSED: 3,
};
const STATUS_FILTERS = [
  { key: "ALL", label: "All tickets" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "CLOSED", label: "Closed" },
] as const;

const STATUS_STYLES: Record<
  (typeof STATUS_STEPS)[number],
  { text: string; bar: string; dot: string }
> = {
  OPEN: {
    text: "text-sky-400",
    bar: "bg-sky-500",
    dot: "border-sky-400 bg-sky-500",
  },
  IN_PROGRESS: {
    text: "text-amber-400",
    bar: "bg-amber-500",
    dot: "border-amber-400 bg-amber-500",
  },
  RESOLVED: {
    text: "text-emerald-400",
    bar: "bg-emerald-500",
    dot: "border-emerald-400 bg-emerald-500",
  },
  CLOSED: {
    text: "text-red-400",
    bar: "bg-red-500",
    dot: "border-red-400 bg-red-500",
  },
};

function normalizedTicketStatus(status: string): (typeof STATUS_STEPS)[number] {
  const normalized = normalizeStatus(status);
  return STATUS_STEPS.includes(normalized as (typeof STATUS_STEPS)[number])
    ? (normalized as (typeof STATUS_STEPS)[number])
    : "OPEN";
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function extractIssues(res: unknown): IssueResponse[] {
  const root = res as Record<string, unknown> | null;
  const responseData = root?.responseData ?? res;
  const data = responseData as Record<string, unknown> | null;
  const list = Array.isArray(responseData)
    ? responseData
    : (data?.issues ?? data?.reports ?? data?.reportIssues ?? []);
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      const issue = item as Record<string, unknown>;
      const mediaUrls = issue.mediaUrls;
      const assignments = Array.isArray(issue.reportIssueAssignments)
        ? issue.reportIssueAssignments
            .map((assignment) => {
              const user = (assignment as Record<string, unknown>).user;
              if (!user || typeof user !== "object") return null;
              const details = user as Record<string, unknown>;
              return {
                user: {
                  id: String(details.id ?? ""),
                  name: String(details.name ?? "Assigned administrator"),
                  email: String(details.email ?? ""),
                  mobile_number: String(details.mobile_number ?? ""),
                },
              };
            })
            .filter(
              (assignment): assignment is NonNullable<typeof assignment> =>
                assignment !== null,
            )
        : [];
      return {
        id: String(issue.id ?? ""),
        reportId: String(issue.reportId ?? issue.id ?? ""),
        ticketId: String(issue.ticketId ?? issue.ticket_id ?? ""),
        userId: String(issue.userId ?? ""),
        subject: String(issue.subject ?? ""),
        description: String(issue.description ?? ""),
        mediaUrls: Array.isArray(mediaUrls)
          ? mediaUrls.filter(
              (url): url is string =>
                typeof url === "string" && Boolean(url.trim()),
            )
          : [],
        status: String(issue.status ?? "OPEN"),
        createdAt: String(issue.createdAt ?? ""),
        updatedAt: String(issue.updatedAt ?? ""),
        reportIssueAssignments: assignments,
      };
    })
    .filter((issue) => issue.ticketId || issue.reportId);
}

export interface SupportListState {
  hasReports: boolean;
  isLoading: boolean;
  error: string | null;
}

export default function GetAllSupport({
  refreshKey = 0,
  onStateChange,
  onRaiseTicket,
}: {
  refreshKey?: number;
  onStateChange?: (state: SupportListState) => void;
  onRaiseTicket?: () => void;
}) {
  const [reports, setReports] = useState<IssueResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] =
    useState<(typeof STATUS_FILTERS)[number]["key"]>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const { notifications, markAsRead } = useSupportNotifications(token, {
    playSound: false,
  });
  useEffect(() => {
    const raw = getCookie("accessToken");
    if (!raw) {
      setToken(null);
      return;
    }
    try {
      setToken(typeof raw === "string" ? JSON.parse(raw) : null);
    } catch {
      setToken(typeof raw === "string" ? raw : null);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setReports(extractIssues(await get(GET_ISSUES_ENDPOINT)));
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      if (isEmptyReportsMessage(message)) {
        setReports([]);
        setError(null);
      } else {
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports, refreshKey]);

  useEffect(() => {
    onStateChange?.({ hasReports: reports.length > 0, isLoading, error });
  }, [error, isLoading, onStateChange, reports.length]);

  const orderedReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reports
      .filter((report) => {
        const status = normalizedTicketStatus(report.status);
        const matchesFilter =
          activeFilter === "ALL" || status === activeFilter;
        if (!matchesFilter) return false;
        if (!query) return true;
        return [
          report.ticketId,
          report.reportId,
          report.subject,
          report.description,
          statusLabel(report.status),
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const statusDifference =
          (STATUS_ORDER[normalizedTicketStatus(a.status)] ??
            STATUS_STEPS.length) -
          (STATUS_ORDER[normalizedTicketStatus(b.status)] ??
            STATUS_STEPS.length);
        if (statusDifference !== 0) return statusDifference;

        return (
          new Date(b.createdAt ?? "").getTime() -
          new Date(a.createdAt ?? "").getTime()
        );
      });
  }, [activeFilter, reports, searchQuery]);

  if (isLoading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading support tickets"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/10" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-white">
              Loading your support tickets
            </p>
            <p className="text-xs text-zinc-500">
              Preparing your support workspace...
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Card
              key={index}
              className="overflow-hidden rounded-xl border-slate-800 bg-slate-900/50 sm:rounded-2xl"
            >
              <div className="h-1 animate-pulse bg-slate-800" />
              <CardContent className="space-y-4 p-3 sm:p-4">
                <div className="flex justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-800/80" />
                    <div className="h-2 w-2/3 animate-pulse rounded bg-slate-800/60" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-slate-800" />
                </div>
                <div className="space-y-2 pt-3">
                  <div className="h-2 w-full animate-pulse rounded bg-slate-800" />
                  <div className="flex justify-between">
                    {Array.from({ length: 4 }, (_, dot) => (
                      <span
                        key={dot}
                        className="h-3 w-3 animate-pulse rounded-full bg-slate-800"
                      />
                    ))}
                  </div>
                </div>
                <div className="h-8 animate-pulse rounded border-t border-slate-800 bg-slate-800/30 pt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <Card className="rounded-2xl border border-red-500/20 bg-slate-900/50">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <p className="text-sm text-zinc-300">{error}</p>
          <Button
            variant="outline"
            onClick={() => void loadReports()}
            className="border-slate-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="rounded-2xl border border-slate-800 bg-slate-900/50">
        <CardContent className="flex min-h-[275px] flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Ticket className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">
            How can we help?
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
            You do not have any support tickets yet. If you are facing an
            issue, contact our support team by raising a ticket.
          </p>
          <Button
            type="button"
            onClick={onRaiseTicket}
            className="mt-5 rounded-xl bg-emerald-500 px-5 text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="mr-2 h-4 w-4" />
            Raise a ticket
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter support tickets"
        >
          {STATUS_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  "rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
                  isActive
                    ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-400"
                    : "border-slate-700 bg-slate-900/50 text-zinc-400 hover:border-slate-600 hover:text-zinc-200",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <label className="relative block w-full lg:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search ticket, subject or status"
            aria-label="Search tickets"
            className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/70 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
          />
        </label>
      </div>

      {orderedReports.length === 0 && (
        <Card className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <CardContent className="p-8 text-center text-sm text-zinc-500">
            No tickets match your search or selected status.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
        {orderedReports.map((report) => {
          const { title } = parseSubject(report.subject);
          const status = normalizedTicketStatus(report.status);
          const statusStyle = STATUS_STYLES[status];
          const statusIndex = STATUS_STEPS.indexOf(status);
          const messageCount = notifications.find(
            (notification) => notification.id === report.id,
          )?.totalMessages;
          const reportId = report.id || report.reportId;
          return (
            <button
              key={report.ticketId || report.reportId}
              type="button"
              onClick={() => {
                markAsRead(reportId);
                router.push(`/get_support/${encodeURIComponent(reportId)}`);
              }}
              aria-label={`View details for ${title}`}
              className="group flex h-full cursor-pointer text-left transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <Card className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-lg shadow-slate-950/20 backdrop-blur-xl transition-all duration-300 group-hover:border-emerald-500/40 group-hover:bg-slate-900/75 group-hover:shadow-[0_18px_45px_rgba(16,185,129,0.12)] sm:rounded-2xl">
                <div className={cn("h-1 w-full", statusStyle.bar)} />
                {messageCount && messageCount > 0 ? (
                  <span className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-br from-red-400 to-rose-600 text-[10px] font-bold leading-none text-white shadow-lg shadow-red-950/50">
                    {messageCount > 99 ? "99+" : messageCount}
                  </span>
                ) : null}
                <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-white sm:text-base">
                        {title}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">
                        {report.ticketId || report.reportId}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        {formatDate(report.createdAt)}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0 border px-2 py-0.5 text-[11px]",
                        statusClass(status),
                      )}
                    >
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  <div className="mt-auto pt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
                      <span className={statusStyle.text}>
                        {statusLabel(status)}
                      </span>
                      <span className="text-zinc-600">Ticket progress</span>
                    </div>
                    <div className="relative flex items-center justify-between">
                      <div className="absolute left-1 right-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-800" />
                      <div
                        className={cn(
                          "absolute left-1 top-1/2 h-1 -translate-y-1/2 rounded-full transition-all",
                          statusStyle.bar,
                        )}
                        style={{
                          width: `${(statusIndex / (STATUS_STEPS.length - 1)) * 100}%`,
                        }}
                      />
                      {STATUS_STEPS.map((step, index) => (
                        <span
                          key={step}
                          className={cn(
                            "relative z-10 h-3 w-3 rounded-full border-2 border-slate-700 bg-slate-950",
                            index <= statusIndex && statusStyle.dot,
                          )}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[9px] text-zinc-600">
                      {STATUS_STEPS.map((step) => (
                        <span key={step}>{step.replace("_", " ")}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] font-medium text-zinc-500 transition-colors group-hover:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      Click to view full ticket
                    </span>
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </>
  );
}

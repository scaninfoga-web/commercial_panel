"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  /** Unique key for the column. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** The first and last columns get edge padding automatically. */
  align?: "left" | "right";
  headClassName?: string;
  cellClassName?: string;
  /** Width of the loading placeholder bar, e.g. "70%". */
  skeletonWidth?: string;
}

export interface DataTableProps<T> {
  title: string;
  description?: string;
  /** Extra controls rendered in the header, before the "loaded" count. */
  headerActions?: ReactNode;

  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Makes rows clickable and keyboard accessible. */
  onRowClick?: (row: T) => void;
  getRowAriaLabel?: (row: T) => string;

  /** Initial load. Pass false while refreshing to keep existing rows visible. */
  isLoading?: boolean;
  loadingVariant?: "skeleton" | "spinner";
  skeletonRows?: number;

  /** Pass only when the error should replace the table. */
  error?: string | null;
  onRetry?: () => void;

  emptyTitle?: string;
  emptyDescription?: string;

  /** Cursor pagination: loads the next page when the end is scrolled into view. */
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  endMessage?: string;
  footerNote?: string | null;
}

type View = "spinner" | "skeleton" | "error" | "empty" | "table";

// ─── Shared states ───────────────────────────────────────────────────────────

export function EmptyState({
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

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/50 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
      <p className="max-w-sm text-sm font-medium text-zinc-300">{message}</p>
      {onRetry && (
        <Button
          className="w-fit bg-red-600 px-4 text-white shadow-lg shadow-red-900/30 transition-none hover:bg-red-600 hover:text-white"
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCROLL_CONTAINER_CLASS =
  "max-h-[65vh] overflow-y-auto rounded-2xl bg-slate-950/40 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600";

const edgePadding = (index: number, total: number) =>
  cn(index === 0 && "pl-6", index === total - 1 && "pr-6");

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  title,
  description,
  headerActions,
  columns,
  rows,
  getRowKey,
  onRowClick,
  getRowAriaLabel,
  isLoading = false,
  loadingVariant = "skeleton",
  skeletonRows = 8,
  error,
  onRetry,
  emptyTitle = "No results found",
  emptyDescription = "Try adjusting your filters or search.",
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  endMessage = "— End of list —",
  footerNote,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const view: View = isLoading
    ? loadingVariant === "spinner"
      ? "spinner"
      : "skeleton"
    : error
      ? "error"
      : rows.length === 0
        ? "empty"
        : "table";

  const hasTable = view === "table" || view === "skeleton";
  const canLoadMore = view === "table" && hasMore && !isLoadingMore;

  // The observer is recreated whenever its inputs change, so a sentinel that
  // is still visible after a page loads immediately triggers the next page.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!canLoadMore || !onLoadMore || !sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { root, rootMargin: "100px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, onLoadMore]);

  const getRowProps = (row: T) => {
    if (!onRowClick) return {};
    return {
      role: "button" as const,
      tabIndex: 0,
      "aria-label": getRowAriaLabel?.(row),
      onClick: () => onRowClick(row),
      onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
        // Ignore keys pressed on controls inside the row (e.g. a copy button).
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(row);
        }
      },
    };
  };

  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.45)]">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-medium text-white">
            {title}
          </CardTitle>
          {description && (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerActions}
          <Badge className="border border-slate-700 bg-slate-800/70 text-zinc-300">
            {rows.length} loaded
          </Badge>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-hidden p-4">
        {view === "spinner" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        )}

        {view === "error" && (
          <ErrorState
            message={error ?? "Something went wrong"}
            onRetry={onRetry}
          />
        )}

        {view === "empty" && (
          <EmptyState
            icon={Inbox}
            title={emptyTitle}
            description={emptyDescription}
          />
        )}

        {hasTable && (
          <div className="flex flex-col rounded-2xl border border-slate-800">
            <div ref={scrollRef} className={SCROLL_CONTAINER_CLASS}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-900 shadow-[0_1px_0_0_rgba(30,41,59,1)]">
                  <TableRow className="border-slate-800 hover:bg-transparent [&>th]:border-b-slate-800 [&>th]:bg-slate-900">
                    {columns.map((col, i) => (
                      <TableHead
                        key={col.key}
                        className={cn(
                          "text-zinc-400",
                          edgePadding(i, columns.length),
                          col.align === "right" && "text-right",
                          col.headClassName,
                        )}
                      >
                        {col.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {view === "skeleton"
                    ? Array.from({ length: skeletonRows }).map((_, rowIdx) => (
                        <TableRow
                          key={rowIdx}
                          className="border-slate-800 hover:bg-transparent"
                        >
                          {columns.map((col, i) => (
                            <TableCell
                              key={col.key}
                              className={edgePadding(i, columns.length)}
                            >
                              <div
                                className="h-4 animate-pulse rounded bg-slate-800"
                                style={{
                                  width:
                                    col.skeletonWidth ??
                                    (i === 0 ? "70%" : "50%"),
                                }}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : rows.map((row) => (
                        <TableRow
                          key={getRowKey(row)}
                          className={cn(
                            "border-slate-800 bg-slate-900/30 transition-colors hover:bg-slate-800/40",
                            onRowClick &&
                              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500",
                          )}
                          {...getRowProps(row)}
                        >
                          {columns.map((col, i) => (
                            <TableCell
                              key={col.key}
                              className={cn(
                                edgePadding(i, columns.length),
                                col.align === "right" && "text-right",
                                col.cellClassName,
                              )}
                            >
                              {col.cell(row)}
                            </TableCell>
                          ))}
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
              {view === "table" && !hasMore && (
                <div className="py-6 text-center text-sm text-zinc-500">
                  {endMessage}
                </div>
              )}
              {footerNote && (
                <div className="pb-4 text-center text-xs text-zinc-600">
                  {footerNote}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

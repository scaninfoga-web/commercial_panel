"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader } from "./custom-loader";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  /** Unique column id — also used as sort_by key when sortable */
  id: string;
  header: string;
  /** Key on the row object to read raw value from */
  accessorKey?: keyof T;
  /** Default width in px (default 150) */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  /** Set false to disable resize handle for this column */
  resizable?: boolean;
  sticky?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
  /** Custom cell renderer. Receives raw value, full row, and row index */
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export type SortOrder = "asc" | "desc" | null;

export interface SortState {
  column: string | null;
  order: SortOrder;
}

interface CustomTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Shows centered spinner over full table body */
  loading?: boolean;
  /** Shows small bottom spinner for infinite scroll "load more" */
  loadingMore?: boolean;
  keyExtractor?: (row: T, index: number) => string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  onRowClick?: (row: T, index: number) => void;
  emptyMessage?: string;
  /** Constrain table scroll area height */
  maxHeight?: number | string;
  rowClassName?: (row: T, index: number) => string;
  /** Infinite scroll — called when user scrolls near bottom */
  onLoadMore?: () => void;
  /** Whether more data is available to load */
  hasMore?: boolean;
}

// ─── Resize Handle ────────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResize: (delta: number) => void;
}

function ResizeHandle({ onResize }: ResizeHandleProps) {
  const startX = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      isDragging.current = true;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = moveEvent.clientX - startX.current;
        startX.current = moveEvent.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 z-10 flex h-full w-[5px] cursor-col-resize items-center justify-center opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
    >
      <div className="h-4 w-[2px] rounded-full bg-emerald-400/60" />
    </div>
  );
}

// ─── Table Component ─────────────────────────────────────────────���────────────

export function CustomTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  loadingMore = false,
  keyExtractor,
  sort,
  onSortChange,
  onRowClick,
  emptyMessage = "No data found",
  maxHeight = "calc(100vh - 280px)",
  rowClassName,
  onLoadMore,
  hasMore = false,
}: CustomTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    columns.forEach((col) => {
      widths[col.id] = col.width ?? 150;
    });
    return widths;
  });

  // ── Infinite scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore) return;

    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        onLoadMore();
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [onLoadMore, loadingMore, hasMore]);

  const handleResize = useCallback(
    (colId: string, delta: number) => {
      setColWidths((prev) => {
        const col = columns.find((c) => c.id === colId);
        const min = col?.minWidth ?? 60;
        const max = col?.maxWidth ?? 600;
        const next = Math.min(max, Math.max(min, (prev[colId] ?? 150) + delta));
        return { ...prev, [colId]: next };
      });
    },
    [columns],
  );

  const handleSort = (colId: string) => {
    if (!onSortChange) return;
    const col = columns.find((c) => c.id === colId);
    if (!col?.sortable) return;

    if (sort?.column === colId) {
      if (sort.order === "asc") {
        onSortChange({ column: colId, order: "desc" });
      } else if (sort.order === "desc") {
        onSortChange({ column: null, order: null });
      } else {
        onSortChange({ column: colId, order: "asc" });
      }
    } else {
      onSortChange({ column: colId, order: "asc" });
    }
  };

  const renderSortIcon = (colId: string) => {
    if (sort?.column !== colId) {
      return <ChevronsUpDown className="h-3 w-3 text-slate-500" />;
    }
    if (sort.order === "asc") {
      return <ArrowUp className="h-3 w-3 text-emerald-400" />;
    }
    return <ArrowDown className="h-3 w-3 text-emerald-400" />;
  };

  const totalWidth = columns.reduce(
    (sum, col) => sum + (colWidths[col.id] ?? 150),
    0,
  );

  return (
    <div
      ref={scrollRef}
      className="scrollbar-custom overflow-auto rounded-xl border border-slate-800"
      style={{ maxHeight }}
    >
      <table
        className="w-full border-collapse"
        style={{ minWidth: totalWidth }}
      >
        {/* Header */}
        <thead className="sticky top-0 z-20">
          <tr className="bg-slate-900/90 backdrop-blur-sm">
            {columns.map((col) => {
              const width = colWidths[col.id] ?? 150;
              const resizable = col.resizable !== false;

              return (
                <th
                  key={col.id}
                  className={cn(
                    "group relative select-none whitespace-nowrap border-b border-slate-800 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400",
                    col.sortable && "cursor-pointer hover:text-slate-200",
                    col.sticky === "left" && "sticky left-0 z-30 bg-slate-900",
                    col.sticky === "right" &&
                      "sticky right-0 z-30 bg-slate-900",
                    col.headerClassName,
                  )}
                  style={{ width, minWidth: col.minWidth ?? 60 }}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && renderSortIcon(col.id)}
                  </div>
                  {resizable && (
                    <ResizeHandle
                      onResize={(delta) => handleResize(col.id, delta)}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <Loader className="py-20" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-20 text-center text-sm text-slate-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            <>
              {data.map((row, rowIdx) => {
                const key = keyExtractor
                  ? keyExtractor(row, rowIdx)
                  : String(rowIdx);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row, rowIdx)}
                    className={cn(
                      "border-b border-slate-800/50 transition-colors last:border-0",
                      onRowClick && "cursor-pointer",
                      "hover:bg-white/[0.02]",
                      rowClassName?.(row, rowIdx),
                    )}
                  >
                    {columns.map((col) => {
                      const width = colWidths[col.id] ?? 150;
                      const rawValue = col.accessorKey
                        ? row[col.accessorKey]
                        : undefined;
                      const content = col.render
                        ? col.render(rawValue, row, rowIdx)
                        : rawValue !== undefined && rawValue !== null
                          ? String(rawValue)
                          : "—";

                      return (
                        <td
                          key={col.id}
                          className={cn(
                            "whitespace-nowrap px-4 py-3 text-[13px] text-slate-300",
                            col.sticky === "left" &&
                              "sticky left-0 bg-[#060b17]",
                            col.sticky === "right" &&
                              "sticky right-0 bg-[#060b17]",
                            col.cellClassName,
                          )}
                          style={{ width, minWidth: col.minWidth ?? 60 }}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Infinite scroll loader */}
              {loadingMore && (
                <tr>
                  <td colSpan={columns.length}>
                    <Loader className="py-4" loaderStyle="h-5 w-5" />
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

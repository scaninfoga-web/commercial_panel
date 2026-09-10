"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Mail,
  Loader2,
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  File as FileIcon,
  RotateCcw,
  Copy,
  Info,
  ChevronDown,
  Activity,
  IndianRupee,
  ArrowLeftRight,
  TrendingUp,
  Inbox,
  BadgeCheck,
  Hash,
  CalendarRange,
  Check,
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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { post } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────
type ReportFormat = "BOTH" | "PDF" | "XLSX";

interface EndpointUsage {
  endpoint: string;
  hits: number;
  success: number;
  spent: number;
  share: number;
}

interface ApiUsage {
  api_name: string;
  endpoint: string;
  transactions: number;
  completed: number;
  debit: number;
  credit: number;
  share: number;
  debit_share: number;
}

interface ActivityOverview {
  total: number;
  success: number;
  failed: number;
  success_rate: number;
  total_spent: number;
  avg_duration: number;
  unique_endpoints: number;
  endpoint_usage: EndpointUsage[];
}

interface TransactionOverview {
  total: number;
  credit: number;
  debit: number;
  net: number;
  completed: number;
  pending: number;
  failed: number;
  reversed: number;
  unique_apis: number;
  api_usage: ApiUsage[];
}

interface ReportFile {
  kind: "ACTIVITY" | "TRANSACTION";
  file_type: "XLSX" | "PDF";
  label: string;
  file_name: string;
  size_bytes: number;
  url: string;
}

interface IASReportResponseData {
  report_id: string;
  format: ReportFormat;
  generated_at: string;
  generated_at_label: string;
  period: {
    from: string;
    to: string;
    from_label: string;
    to_label: string;
    label: string;
    days: number;
  };
  overview_stats: {
    activity: ActivityOverview;
    transaction: TransactionOverview;
  };
  records: {
    activities_total: number;
    activities_in_report: number;
    activities_truncated: boolean;
    transactions_total: number;
    transactions_in_report: number;
    transactions_truncated: boolean;
  };
  files: {
    activity: {
      xlsx_url: string;
      pdf_url: string;
    };
    transaction: {
      xlsx_url: string;
      pdf_url: string;
    };
  };
  file_details: ReportFile[];
  link_expires_in_hours: number;
  link_expires_at: string;
  email_queued: boolean;
  failed_files: string[];
}

// ─── Date helpers ───────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDDMMYYYY(date: Date | undefined): string {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameCalendarDay(a?: Date, b?: Date): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── DatePicker Component ──────────────────────────────────────────────
// Styled to match the app's console chrome: slate-950 surface, slate-800
// borders, a single emerald accent reserved for the selected/today state
// rather than tinting the whole panel. Popover width is clamped so it
// never overflows very narrow (≤360px) phone viewports.
function DatePicker({
  value,
  onChange,
  placeholder = "DD-MM-YYYY",
  disabled,
  minDate,
  maxDate,
  yearsBack = 15,
  className,
}: {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  yearsBack?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(value ?? maxDate ?? new Date());
  const [inputValue, setInputValue] = useState(value ? formatDDMMYYYY(value) : "");

  useEffect(() => {
    setInputValue(value ? formatDDMMYYYY(value) : "");
    if (value) setViewMonth(value);
  }, [value]);

  const referenceMax = maxDate ?? new Date();
  const latestYear = referenceMax.getFullYear();
  const earliestYear = minDate ? minDate.getFullYear() : latestYear - yearsBack;

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = latestYear; y >= earliestYear; y--) list.push(y);
    return list;
  }, [latestYear, earliestYear]);

  const isMonthDisabled = (monthIndex: number, year: number) => {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);
    if (maxDate && firstOfMonth > maxDate) return true;
    if (minDate && lastOfMonth < minDate) return true;
    return false;
  };

  const isDateDisabled = (date: Date) => {
    if (maxDate && date > maxDate) return true;
    if (minDate && date < minDate) return true;
    return false;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const match = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const date = new Date(year, month, day);

      if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) {
        if (!isDateDisabled(date)) {
          onChange(date);
          setViewMonth(date);
        }
      }
    } else if (val === "") {
      onChange(undefined);
    }
  };

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setInputValue(date ? formatDDMMYYYY(date) : "");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <Input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={placeholder === "DD-MM-YYYY" ? "Date" : placeholder}
          className="h-10 w-full rounded-xl border-slate-700 bg-slate-900 pr-10 font-mono text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/60 focus-visible:ring-1 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Open calendar"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg text-zinc-500 hover:bg-slate-800 hover:text-emerald-400 active:scale-90"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          }
        />
      </div>

      <PopoverContent
        className="z-50 w-auto max-w-[92vw] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-0 shadow-2xl shadow-black/50 backdrop-blur-xl"
        align="start"
        sideOffset={8}
      >
        <div className="w-[min(280px,88vw)] space-y-3 p-3">
          {/* Month / Year dropdowns */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <select
                aria-label="Select month"
                value={viewMonth.getMonth()}
                onChange={(e) => {
                  const next = new Date(viewMonth);
                  next.setDate(1);
                  next.setMonth(Number(e.target.value));
                  setViewMonth(next);
                }}
                className="h-8 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 pl-2.5 pr-7 text-xs font-medium text-white outline-none transition-colors hover:border-emerald-500/60 focus-visible:ring-1 focus-visible:ring-emerald-500/50"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option
                    key={m}
                    value={idx}
                    disabled={isMonthDisabled(idx, viewMonth.getFullYear())}
                    className="bg-slate-900 text-white"
                  >
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            </div>

            <div className="relative">
              <select
                aria-label="Select year"
                value={viewMonth.getFullYear()}
                onChange={(e) => {
                  const next = new Date(viewMonth);
                  next.setDate(1);
                  next.setFullYear(Number(e.target.value));
                  setViewMonth(next);
                }}
                className="h-8 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 pl-2.5 pr-7 text-xs font-medium text-white outline-none transition-colors hover:border-emerald-500/60 focus-visible:ring-1 focus-visible:ring-emerald-500/50"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>

          <Calendar
            mode="single"
            month={viewMonth}
            onMonthChange={setViewMonth}
            selected={value}
            onSelect={handleSelect}
            disabled={isDateDisabled}
            hideNavigation
            className="p-0"
            classNames={{
              months: "flex flex-col",
              month: "w-full space-y-2",
              month_grid: "w-full border-collapse space-y-1",
              weekdays: "flex w-full justify-between",
              weekday: "text-zinc-500 rounded-lg w-8 font-medium text-[0.7rem] text-center",
              week: "flex w-full mt-1.5 justify-between",
              day: cn(
                "h-8 w-8 p-0 font-normal text-zinc-300",
                "hover:bg-slate-800 hover:text-white active:scale-90 rounded-lg transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 cursor-pointer",
              ),
              selected:
                "bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white focus:bg-emerald-600 focus:text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)] rounded-lg",
              today: "ring-1 ring-inset ring-emerald-500/60 text-emerald-300 font-semibold rounded-lg",
              outside: "text-zinc-700 opacity-60 pointer-events-none",
              disabled: "text-zinc-700 opacity-40 cursor-not-allowed hover:bg-transparent hover:text-zinc-700",
              range_middle: "aria-selected:bg-emerald-500/20 aria-selected:text-emerald-200",
              hidden: "invisible",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Small shared building blocks ───────────────────────────────────────

function IconBadge({
  icon: Icon,
  tone = "emerald",
  size = "md",
}: {
  icon: typeof FileText;
  tone?: "emerald" | "red" | "sky" | "amber";
  size?: "sm" | "md" | "lg";
}) {
  const toneClass: Record<string, string> = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    red: "border-red-500/20 bg-red-500/10 text-red-400",
    sky: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };
  const sizeClass: Record<string, string> = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-xl",
    lg: "h-11 w-11 rounded-xl sm:h-12 sm:w-12",
  };
  const iconSize: Record<string, string> = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-5 w-5 sm:h-6 sm:w-6",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border",
        toneClass[tone],
        sizeClass[size],
      )}
    >
      <Icon className={iconSize[size]} />
    </div>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  tone: "emerald" | "red" | "sky" | "amber";
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl transition-colors hover:border-slate-700">
      <CardContent className="flex items-start gap-3 p-4 sm:p-5">
        <IconBadge icon={icon} tone={tone} size="sm" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">{value}</p>
          {hint && <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function FileRow({
  file,
  onCopy,
}: {
  file: ReportFile;
  onCopy: (url: string, label: string) => void;
}) {
  const isPdf = file.file_type === "PDF";
  return (
    <div className="group flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition-all hover:border-emerald-500/40 hover:bg-slate-900/60 hover:shadow-[0_0_20px_-8px_rgba(16,185,129,0.35)] sm:gap-3 sm:p-4">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3"
      >
        <IconBadge icon={isPdf ? FileIcon : FileSpreadsheet} tone={isPdf ? "sky" : "emerald"} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{file.label}</p>
          <p className="truncate font-mono text-[11px] text-zinc-500">
            {file.file_name} · {formatFileSize(file.size_bytes)}
          </p>
        </div>
      </a>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => onCopy(file.url, file.label)}
          aria-label={`Copy link for ${file.label}`}
          className="touch-manipulation rounded-lg p-2.5 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50"
        >
          <Copy className="h-4 w-4" />
        </button>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Download ${file.label}`}
          className="touch-manipulation rounded-lg p-2.5 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Main Page Component ───────────────────────────────────────────────
export default function IASReportPage() {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [format, setFormat] = useState<ReportFormat>("BOTH");
  const [sendEmail, setSendEmail] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<IASReportResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayEnd = useMemo(() => endOfDay(new Date()), []);

  const fromDateMax = useMemo(() => {
    if (!toDate) return todayEnd;
    const toEnd = endOfDay(toDate);
    return toEnd < todayEnd ? toEnd : todayEnd;
  }, [toDate, todayEnd]);

  const toDateMin = useMemo(() => (fromDate ? startOfDay(fromDate) : undefined), [fromDate]);

  const dateRangeError = useMemo(() => {
    if (!fromDate || !toDate) return null;
    if (fromDate.getTime() > toDate.getTime()) {
      return "From date must be on or before the To date.";
    }
    return null;
  }, [fromDate, toDate]);

  const canGenerate = Boolean(fromDate && toDate && !dateRangeError && !isGenerating);

  const presetRanges = useMemo(() => {
    const ref = todayEnd;

    const monthsBack = (n: number) => {
      const d = new Date(ref);
      d.setMonth(d.getMonth() - n);
      return startOfDay(d);
    };
    const yearsBack = (n: number) => {
      const d = new Date(ref);
      d.setFullYear(d.getFullYear() - n);
      return startOfDay(d);
    };

    const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const yearStart = new Date(ref.getFullYear(), 0, 1);

    const last7Start = new Date(ref);
    last7Start.setDate(ref.getDate() - 6);

    return {
      last7Days: { from: last7Start, to: new Date(ref) },
      thisMonth: { from: monthStart, to: new Date(ref) },
      last3Months: { from: monthsBack(3), to: new Date(ref) },
      last6Months: { from: monthsBack(6), to: new Date(ref) },
      thisYear: { from: yearStart, to: new Date(ref) },
      lastYear: { from: yearsBack(1), to: new Date(ref) },
    };
  }, [todayEnd]);

  const presetLabels: Record<keyof typeof presetRanges, string> = {
    last7Days: "Last 7 Days",
    thisMonth: "This Month",
    last3Months: "Last 3 Months",
    last6Months: "Last 6 Months",
    thisYear: "This Year",
    lastYear: "Last 1 Year",
  };

  const applyPreset = (key: keyof typeof presetRanges) => {
    setFromDate(presetRanges[key].from);
    setToDate(presetRanges[key].to);
  };

  const isActivePreset = (key: keyof typeof presetRanges) =>
    isSameCalendarDay(fromDate, presetRanges[key].from) &&
    isSameCalendarDay(toDate, presetRanges[key].to);

  const handleReset = () => {
    setFromDate(undefined);
    setToDate(undefined);
    setFormat("BOTH");
    setSendEmail(true);
    setReport(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      toast.error("Please select both From and To dates");
      return;
    }
    if (dateRangeError) {
      toast.error(dateRangeError);
      return;
    }

    const dateRange = `${formatDDMMYYYY(fromDate)} to ${formatDDMMYYYY(toDate)}`;
    setIsGenerating(true);
    setError(null);
    setReport(null);

    try {
      const response = await post("/api/v1/user/get-ias-report", {
        date_range: dateRange,
        format,
        send_email: sendEmail,
      });

      const payload =
        (response as { responseData?: unknown } | null)?.responseData ?? response;

      if (!payload) {
        throw new Error("Empty response received from the server");
      }

      const reportData = payload as IASReportResponseData;
      setReport(reportData);
      toast.success("IAS report generated successfully");

      if (reportData.email_queued) {
        toast.info("Report has been emailed to your registered email");
      }
      if (reportData.failed_files?.length) {
        toast.warning(
          `${reportData.failed_files.length} file${
            reportData.failed_files.length > 1 ? "s" : ""
          } could not be generated`,
        );
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.responseStatus?.message ||
        err?.message ||
        "Failed to generate IAS report. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} link copied`);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const activityFiles = useMemo(
    () =>
      report?.file_details?.filter(
        (f: ReportFile) =>
          f.kind === "ACTIVITY" &&
          (report.format === "BOTH" || f.file_type === report.format),
      ) ?? [],
    [report],
  );
  const transactionFiles = useMemo(
    () =>
      report?.file_details?.filter(
        (f: ReportFile) =>
          f.kind === "TRANSACTION" &&
          (report.format === "BOTH" || f.file_type === report.format),
      ) ?? [],
    [report],
  );
  const failedFiles = report?.failed_files ?? [];
  const hasTruncatedData =
    !!report?.records?.activities_truncated || !!report?.records?.transactions_truncated;

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 sm:gap-4"
      >
        <IconBadge icon={FileText} tone="emerald" size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-2xl">
            IAS Report Generator
          </h1>
          <p className="mt-0.5 truncate text-xs text-zinc-400 sm:text-sm">
            Generate Integrated Activity Statement reports for custom date ranges.
          </p>
        </div>
      </motion.div>

      {/* Report Parameters */}
      <Card className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <FileText className="h-4 w-4 text-emerald-400" />
            Report Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  From Date
                </Label>
                <DatePicker
                  value={fromDate}
                  onChange={setFromDate}
                  placeholder="DD-MM-YYYY"
                  disabled={isGenerating}
                  maxDate={fromDateMax}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  To Date
                </Label>
                <DatePicker
                  value={toDate}
                  onChange={setToDate}
                  placeholder="DD-MM-YYYY"
                  disabled={isGenerating}
                  minDate={toDateMin}
                  maxDate={todayEnd}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Format
                </Label>
                <Select
                  value={format}
                  onValueChange={(val) => setFormat(val as ReportFormat)}
                  disabled={isGenerating}
                >
                  <SelectTrigger
                    disabled={isGenerating}
                    className="h-10 rounded-xl border-slate-700 bg-slate-900 text-white focus:ring-1 focus:ring-emerald-500/50 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-700 bg-slate-900">
                    <SelectItem
                      value="BOTH"
                      className="text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-zinc-500" />
                        Both (PDF + XLSX)
                      </span>
                    </SelectItem>
                    <SelectItem
                      value="PDF"
                      className="text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400"
                    >
                      <span className="flex items-center gap-2">
                        <FileIcon className="h-4 w-4 text-sky-400" />
                        PDF Only
                      </span>
                    </SelectItem>
                    <SelectItem
                      value="XLSX"
                      className="text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400"
                    >
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                        XLSX Only
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dateRangeError && (
              <p role="alert" className="-mt-2 flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {dateRangeError}
              </p>
            )}

            <div className="flex flex-col gap-4 border-t border-slate-800 pt-5">
              <div className="flex items-center gap-2">
                <input
                  id="ias-send-email"
                  type="checkbox"
                  checked={sendEmail}
                  disabled={isGenerating}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-1 focus:ring-emerald-500/50 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <label
                  htmlFor="ias-send-email"
                  className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-zinc-400"
                >
                  Send a copy of the report to my email
                </label>
              </div>

              {/* Preset ranges — a single scrollable pill row on mobile so all six
                  options stay reachable by a swipe, wrapping naturally on larger screens. */}
              <div
                className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Quick date range presets"
              >
                {(Object.keys(presetLabels) as (keyof typeof presetRanges)[]).map((key) => {
                  const active = isActivePreset(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={isGenerating}
                      onClick={() => applyPreset(key)}
                      className={cn(
                        "flex shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 sm:shrink",
                        active
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                          : "border-slate-700 bg-slate-900 text-zinc-400 hover:border-emerald-500/40 hover:bg-slate-800/80 hover:text-emerald-400",
                      )}
                    >
                      {active && <Check className="h-3 w-3 shrink-0" />}
                      {presetLabels[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={isGenerating}
                onClick={handleReset}
                className="w-full touch-manipulation rounded-xl border-slate-700 bg-slate-900 text-zinc-300 transition-transform hover:border-slate-600 hover:bg-slate-800 hover:text-white active:scale-[0.98] sm:w-auto"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full touch-manipulation rounded-xl border-emerald-500/80 bg-emerald-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.18)] transition-transform hover:border-emerald-500 hover:bg-emerald-500 hover:text-white active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-red-400 backdrop-blur-xl"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}

      {/* Report Result */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          {/* Report Header */}
          <Card className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <span className="absolute inset-0 rounded-xl bg-emerald-500/20 animate-ping" />
                    <BadgeCheck className="relative h-6 w-6 text-emerald-400" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white sm:text-base">
                      Report generated successfully
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Your Integrated Activity Statement is ready to download.
                    </p>
                  </div>
                </div>
                {report.email_queued && (
                  <Badge className="w-fit shrink-0 gap-1.5 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 shadow-sm transition-all hover:bg-emerald-500/10 dark:text-emerald-400">
                    <Mail className="h-3 w-3 stroke-[2.5]" />
                    Report Sent via Email
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-emerald-500/15 pt-4 sm:grid-cols-3">
                <div className="flex items-start gap-2">
                  <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Report ID
                    </p>
                    <p className="truncate font-mono text-xs text-emerald-400">
                      {report.report_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Period
                    </p>
                    <p className="truncate text-xs text-zinc-300">
                      {report.period.label}{" "}
                      <span className="text-zinc-500">· {report.period.days} days</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Generated
                    </p>
                    <p className="truncate text-xs text-zinc-300">{report.generated_at_label}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {hasTruncatedData && (
            <div className="flex items-start gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-sky-300 backdrop-blur-xl">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This preview shows {report.records.activities_in_report.toLocaleString()} of{" "}
                {report.records.activities_total.toLocaleString()} activities and{" "}
                {report.records.transactions_in_report.toLocaleString()} of{" "}
                {report.records.transactions_total.toLocaleString()} transactions for this
                period — the full data set is included in the downloaded files.
              </span>
            </div>
          )}

          {/* Overview Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Activity}
              tone="emerald"
              label="Total Activities"
              value={report.overview_stats.activity.total.toLocaleString()}
              hint={`${report.overview_stats.activity.success_rate}% success rate`}
            />
            <StatCard
              icon={IndianRupee}
              tone="emerald"
              label="Total Spent"
              value={formatCurrency(report.overview_stats.activity.total_spent)}
              hint={`${report.overview_stats.activity.unique_endpoints} unique endpoints`}
            />
            <StatCard
              icon={ArrowLeftRight}
              tone="sky"
              label="Total Transactions"
              value={report.overview_stats.transaction.total.toLocaleString()}
              hint={`${report.overview_stats.transaction.unique_apis} unique APIs`}
            />
            <StatCard
              icon={TrendingUp}
              tone="emerald"
              label="Net Balance Change"
              value={formatCurrency(report.overview_stats.transaction.net)}
              hint={`Credit: ${formatCurrency(report.overview_stats.transaction.credit)}`}
            />
          </div>

          {/* File Downloads */}
          <Card className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Download className="h-4 w-4 text-emerald-400" />
                Download Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {failedFiles.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {failedFiles.length} file{failedFiles.length > 1 ? "s" : ""} could not be
                    generated ({failedFiles.join(", ")}). The rest of your report is available
                    below.
                  </span>
                </div>
              )}

              {activityFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Activity Statement
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {activityFiles.map((file) => (
                      <FileRow
                        key={`${file.kind}-${file.file_type}-${file.file_name}`}
                        file={file}
                        onCopy={handleCopyLink}
                      />
                    ))}
                  </div>
                </div>
              )}

              {transactionFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Transaction Statement
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {transactionFiles.map((file) => (
                      <FileRow
                        key={`${file.kind}-${file.file_type}-${file.file_name}`}
                        file={file}
                        onCopy={handleCopyLink}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activityFiles.length === 0 && transactionFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 py-10 text-center">
                  <Inbox className="h-8 w-8 text-zinc-600" />
                  <p className="text-sm text-zinc-500">No files are available for this report.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 pt-4 text-xs text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                Links expire in {report.link_expires_in_hours} hours
                <span className="text-zinc-700">·</span>
                {new Date(report.link_expires_at).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
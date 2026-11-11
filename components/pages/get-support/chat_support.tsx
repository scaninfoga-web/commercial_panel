"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Info,
  LockKeyhole,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { get, post } from "@/lib/api";
import type { ReportIssue } from "@/types/get_support";
import { cn } from "@/lib/utils";
import { parseSubject, statusLabel } from "./get_support_utils";

type Issue = ReportIssue["response"];
type Activity = NonNullable<Issue["reportIssueActivities"]>[number];

const LIST_ENDPOINT = "/api/v1/report/get-report-issues";
const ACTIVITY_ENDPOINT = "/api/v1/report/get-report-issue";
const REPLY_ENDPOINT = "/api/v1/report/report-issue-reply";
const MEDIA_UPLOAD_ENDPOINT = "/api/v1/report/report_issue_media_upload";
const MAX_REPLY_ATTACHMENTS = 50;
const MAX_VISIBLE_ATTACHMENTS = 3; // attachments shown inside a chat bubble before "+N more"
const REPLY_ACCEPT =
  ".pdf,.xls,.xlsx,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.mkv,.mov,.mp4,.webm";

// Live chat refresh
const POLL_INTERVAL_MS = 3000; // messages are re-fetched every 3 s while the chat page is open
const ISSUE_REFRESH_EVERY = 5; // every 5th poll (~15 s) also refreshes ticket status / assigned admin
const MAX_POLL_BACKOFF_MS = 30000; // slow down while the network / API is failing

// ─── Helpers ────────────────────────────────────────────────────────────
function statusClass(status?: string) {
  switch (status?.toUpperCase()) {
    case "RESOLVED":
    case "CLOSED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "IN_PROGRESS":
    case "IN PROGRESS":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
}

function errorMessage(error: unknown) {
  const value = error as {
    response?: {
      data?: { responseStatus?: { message?: string }; message?: string };
    };
    message?: string;
  } | null;
  return (
    value?.response?.data?.responseStatus?.message ||
    value?.response?.data?.message ||
    value?.message ||
    "Unable to load this conversation."
  );
}

function extractUploadedUrls(response: unknown): string[] {
  const root = response as Record<string, unknown> | null;
  const data = (root?.responseData ?? root) as Record<string, unknown> | null;
  const list = data?.urls ?? data?.mediaUrls ?? data?.files;
  if (!Array.isArray(list)) return [];

  return list
    .map((value) => {
      if (typeof value === "string") return value.trim();
      if (!value || typeof value !== "object") return "";
      const item = value as Record<string, unknown>;
      const url = item.url ?? item.fileUrl ?? item.location;
      return typeof url === "string" ? url.trim() : "";
    })
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(date);
}

function dayKey(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown date";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(value) === dayKey(today.toISOString())) return "Today";
  if (dayKey(value) === dayKey(yesterday.toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(date);
}

function formatSize(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

function fileNameFromUrl(url: string) {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last) || "Attachment";
  } catch {
    return "Attachment";
  }
}

function openDocument(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// ── File kinds (used to pick the icon / how a file is shown) ──
type FileKind = "image" | "video" | "pdf" | "excel" | "word" | "text" | "other";

const KIND_BY_EXT: Record<string, FileKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  mp4: "video",
  mov: "video",
  mkv: "video",
  webm: "video",
  avi: "video",
  m4v: "video",
  pdf: "pdf",
  xls: "excel",
  xlsx: "excel",
  xlsm: "excel",
  csv: "excel",
  doc: "word",
  docx: "word",
  rtf: "word",
  odt: "word",
  txt: "text",
  log: "text",
  md: "text",
};

const KIND_TONE: Record<FileKind, string> = {
  image: "text-sky-400",
  video: "text-violet-400",
  pdf: "text-red-400",
  excel: "text-emerald-400",
  word: "text-blue-400",
  text: "text-zinc-300",
  other: "text-zinc-300",
};

function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

const kindOfName = (name: string): FileKind =>
  KIND_BY_EXT[extOf(name)] ?? "other";

const kindOfUrl = (url: string): FileKind => kindOfName(fileNameFromUrl(url));

/** Images and videos are shown as thumbnails; everything else as a document card. */
const isMediaUrl = (url: string) => {
  const kind = kindOfUrl(url);
  return kind === "image" || kind === "video";
};

function KindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  switch (kind) {
    case "image":
      return <ImageIcon className={className} />;
    case "video":
      return <Film className={className} />;
    case "excel":
      return <FileSpreadsheet className={className} />;
    case "pdf":
    case "word":
    case "text":
      return <FileText className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}

function extractActivities(response: unknown): Activity[] {
  const root = response as Record<string, unknown> | null;
  const data = (root?.responseData ?? response) as Record<
    string,
    unknown
  > | null;
  return Array.isArray(data?.reportIssueActivities)
    ? (data.reportIssueActivities as Activity[])
    : [];
}

function extractIssue(response: unknown, issueId: string): Issue | null {
  const root = response as Record<string, unknown> | null;
  const data = root?.responseData ?? response;
  const record = data as Record<string, unknown> | null;
  const list = Array.isArray(data)
    ? data
    : (record?.issues ?? record?.reports ?? record?.reportIssues ?? []);
  if (!Array.isArray(list)) return null;
  const item = list.find((value) => {
    const issue = value as Record<string, unknown>;
    return String(issue.id ?? issue.reportId ?? "") === issueId;
  });
  return (item as Issue | undefined) ?? null;
}

// ─── Small UI pieces ────────────────────────────────────────────────────
function Avatar({ name, className }: { name?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-emerald-600 font-semibold text-white shadow-lg shadow-emerald-950/30",
        className,
      )}
    >
      {name ? (
        name.charAt(0).toUpperCase()
      ) : (
        <ShieldCheck className="h-1/2 w-1/2" />
      )}
    </div>
  );
}

/** Small square tile for an image (thumbnail) or a video (icon). */
function MediaTile({
  url,
  onClick,
  className,
}: {
  url: string;
  onClick: () => void;
  className?: string;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const name = fileNameFromUrl(url);
  const kind = kindOfUrl(url);
  const ext = extOf(name).toUpperCase().slice(0, 4);
  const showThumb = kind === "image" && !thumbFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      aria-label={`Preview ${name}`}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/80 transition hover:border-emerald-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
        className ?? "h-14 w-14 sm:h-16 sm:w-16",
      )}
    >
      {showThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setThumbFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5">
          <KindIcon
            kind={kind}
            className={cn("h-5 w-5 sm:h-6 sm:w-6", KIND_TONE[kind])}
          />
          <span className="text-[9px] font-semibold tracking-wide text-zinc-300">
            {ext || "FILE"}
          </span>
        </span>
      )}
    </button>
  );
}

/** WhatsApp-style document card: icon + file name + type. Opens the file in a new tab. */
function DocCard({
  url,
  own,
  className,
}: {
  url: string;
  own: boolean;
  className?: string;
}) {
  const name = fileNameFromUrl(url);
  const kind = kindOfUrl(url);
  const ext = extOf(name).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => openDocument(url)}
      title={name}
      aria-label={`Open ${name}`}
      className={cn(
        "flex w-full min-w-[12rem] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:min-w-[15rem]",
        own
          ? "bg-emerald-800/60 hover:bg-emerald-800"
          : "bg-slate-900/70 hover:bg-slate-900",
        className,
      )}
    >
      <span className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950/60">
        <KindIcon kind={kind} className={cn("h-5 w-5", KIND_TONE[kind])} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs font-medium",
            own ? "text-white" : "text-zinc-100",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "block text-[10px] uppercase tracking-wide",
            own ? "text-emerald-100/70" : "text-zinc-400",
          )}
        >
          {ext || "File"} · Open
        </span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
    </button>
  );
}

/**
 * Attachments of one chat message (shown INSIDE the message bubble, above the text).
 * - Photos / videos -> small thumbnail tiles (click = preview with next / previous).
 * - PDF / Excel / Word / other files -> WhatsApp-style document cards (click = open file).
 * - At most 3 attachments are shown; anything more is behind a "+N more" button
 *   that opens the full list.
 */
function Attachments({ urls, own }: { urls: string[]; own: boolean }) {
  const [viewer, setViewer] = useState<{ open: boolean; active: string | null }>(
    { open: false, active: null },
  );
  if (urls.length === 0) return null;

  const visible = urls.slice(0, MAX_VISIBLE_ATTACHMENTS);
  const hiddenCount = urls.length - visible.length;
  const visibleMedia = visible.filter(isMediaUrl);
  const visibleDocs = visible.filter((u) => !isMediaUrl(u));

  const allMedia = urls.filter(isMediaUrl);
  const allDocs = urls.filter((u) => !isMediaUrl(u));
  const active = viewer.active;
  const activeKind = active ? kindOfUrl(active) : null;
  const activeIndex = active ? allMedia.indexOf(active) : -1;

  const goTo = (offset: number) => {
    if (allMedia.length < 2 || activeIndex < 0) return;
    const next =
      allMedia[(activeIndex + offset + allMedia.length) % allMedia.length];
    setViewer({ open: true, active: next });
  };

  return (
    <>
      <div className="space-y-1">
        {visibleMedia.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleMedia.map((url) => (
              <MediaTile
                key={url}
                url={url}
                onClick={() => setViewer({ open: true, active: url })}
              />
            ))}
          </div>
        )}

        {visibleDocs.map((url) => (
          <DocCard key={url} url={url} own={own} />
        ))}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setViewer({ open: true, active: null })}
            aria-label={`Show ${hiddenCount} more attachments`}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              own
                ? "border-emerald-500/40 bg-emerald-800/70 text-white hover:bg-emerald-800"
                : "border-slate-700/70 bg-slate-900/90 text-emerald-400 hover:border-emerald-400/80 hover:bg-slate-900",
            )}
          >
            +{hiddenCount} more
          </button>
        )}
      </div>

      <Dialog
        open={viewer.open}
        onOpenChange={(open) => {
          if (!open) setViewer({ open: false, active: null });
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-4xl gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-white shadow-2xl shadow-black/50 sm:w-[calc(100%-2rem)] sm:p-4">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="truncate text-sm font-semibold text-white sm:text-base">
              {active ? fileNameFromUrl(active) : `Attachments (${urls.length})`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview of the files shared in this support conversation
            </DialogDescription>
          </DialogHeader>

          {active ? (
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between gap-2">
                {urls.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewer({ open: true, active: null })}
                    className="h-8 rounded-lg px-2 text-xs text-zinc-300 hover:bg-slate-800 hover:text-white"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    All attachments
                  </Button>
                ) : (
                  <span />
                )}
                <a
                  href={active}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-emerald-400 hover:bg-emerald-500/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open original
                </a>
              </div>

              <div className="relative flex h-[min(62dvh,40rem)] items-center justify-center overflow-hidden rounded-xl bg-black/90">
                {activeKind === "video" ? (
                  <video
                    key={active}
                    src={active}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                  >
                    This video format can&apos;t be played in your browser. Use
                    &quot;Open original&quot; to download it.
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={active}
                    src={active}
                    alt={fileNameFromUrl(active)}
                    className="h-full w-full object-contain"
                  />
                )}

                {allMedia.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => goTo(-1)}
                      aria-label="Previous"
                      className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-emerald-600"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => goTo(1)}
                      aria-label="Next"
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-emerald-600"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {allMedia.length > 1 && (
                <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl bg-slate-900/80 p-1.5 pb-2">
                  {allMedia.map((url) => (
                    <MediaTile
                      key={url}
                      url={url}
                      onClick={() => setViewer({ open: true, active: url })}
                      className={cn(
                        "h-12 w-12 border-2 sm:h-14 sm:w-14",
                        url === active
                          ? "border-emerald-400"
                          : "border-slate-700",
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-[65dvh] space-y-4 overflow-y-auto">
              {allMedia.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Photos &amp; videos ({allMedia.length})
                  </p>
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {allMedia.map((url) => (
                      <li key={url} className="min-w-0">
                        <MediaTile
                          url={url}
                          onClick={() => setViewer({ open: true, active: url })}
                          className="aspect-square h-auto w-full"
                        />
                        <p
                          className="mt-1 truncate text-[10px] text-zinc-400"
                          title={fileNameFromUrl(url)}
                        >
                          {fileNameFromUrl(url)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {allDocs.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Documents ({allDocs.length})
                  </p>
                  <ul className="space-y-2">
                    {allDocs.map((url) => (
                      <li key={url}>
                        <DocCard url={url} own={false} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TicketDetails({
  issue,
  onCopy,
}: {
  issue: Issue;
  onCopy: (v: string, l: string) => void;
}) {
  const subject = parseSubject(issue.subject ?? "Support ticket");
  const admins = (issue.reportIssueAssignments ?? []).map((a) => a.user);

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Report subject
        </p>
        <h2 className="mt-2 break-words text-base font-semibold leading-6 text-white sm:text-lg">
          {subject.title}
        </h2>
        {subject.subTitle && (
          <p className="mt-1.5 break-words text-sm text-zinc-400">
            {subject.subTitle}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Status
          </span>
          <Badge
            className={cn(
              "border px-2 py-0.5 text-[11px] font-medium hover:bg-transparent",
              statusClass(issue.status),
            )}
          >
            {statusLabel(issue.status)}
          </Badge>
        </div>
        {issue.ticketId && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Ticket ID
            </span>
            <span className="flex min-w-0 max-w-[65%] items-center gap-1">
              <span className="truncate font-mono text-[11px] text-zinc-300">
                {issue.ticketId}
              </span>
              <button
                type="button"
                onClick={() => onCopy(issue.ticketId, "Ticket ID")}
                aria-label="Copy ticket ID"
                className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
              >
                <Copy className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Created
          </span>
          <span className="max-w-[65%] text-right text-[11px] text-zinc-300">
            {formatDate(issue.createdAt)}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Description
        </p>
        <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-zinc-300">
          {issue.description}
        </p>
      </div>

      {(issue.mediaUrls ?? []).length > 0 && (
        <div className="border-t border-slate-800 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Attachments ({(issue.mediaUrls ?? []).length})
          </p>
          <div className="mt-2">
            <Attachments urls={issue.mediaUrls ?? []} own={false} />
          </div>
        </div>
      )}

      <div className="border-t border-slate-800 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Assigned support
        </p>
        {admins.length === 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <Avatar className="h-11 w-11 text-lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Support team</p>
              <p className="text-xs text-zinc-400">
                Administrator details unavailable
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {admins.map((admin) => (
              <li
                key={admin.id || admin.email}
                className="flex items-start gap-3"
              >
                <Avatar
                  name={admin.name ?? "S"}
                  className="h-11 w-11 text-lg"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {admin.name ?? "Support team"}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {admin.email}
                  </p>
                  {admin.mobile_number && (
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">
                      {admin.mobile_number}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────
export default function ChatSupport({
  issueId,
  onClose,
}: {
  issueId: string;
  onClose: () => void;
}) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showAssignmentNotice, setShowAssignmentNotice] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [unread, setUnread] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // live-refresh bookkeeping
  const aliveRef = useRef(true);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const hasIssueRef = useRef(false);
  const ticketClosedRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const activitiesLoadedRef = useRef(false);
  const pollCountRef = useRef(0);
  const pollFailuresRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /** Applies a fresh message list. Only re-renders when something actually changed. */
  const applyActivities = useCallback((next: Activity[]) => {
    const known = knownIdsRef.current;
    const added = next.filter((a) => !known.has(a.id));

    // New admin messages that arrive while the user has scrolled up -> unread badge.
    if (activitiesLoadedRef.current && added.length > 0 && !stickToBottomRef.current) {
      const incoming = added.filter(
        (a) => String(a.sender?.tier ?? "").toUpperCase() === "ADMIN",
      ).length;
      if (incoming > 0) setUnread((count) => count + incoming);
    }

    added.forEach((a) => known.add(a.id));
    activitiesLoadedRef.current = true;

    setActivities((prev) =>
      prev.length === next.length && prev.every((a, i) => a.id === next[i]?.id)
        ? prev
        : next,
    );
  }, []);

  /**
   * Loads the chat.
   * - `silent`: background refresh. No spinner, no error toast, keeps the current chat on failure.
   * - `messagesOnly`: only the messages API (cheap, used by the 3 s poll).
   * Resolves to false when the request failed.
   */
  const loadConversation = useCallback(
    async (silent = false, messagesOnly = false): Promise<boolean> => {
      if (silent && inFlightRef.current) return true; // never overlap requests

      const requestId = ++requestIdRef.current;
      inFlightRef.current = true;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        if (messagesOnly && hasIssueRef.current) {
          const activityResponse = await get(`${ACTIVITY_ENDPOINT}/${issueId}`);
          if (!aliveRef.current || requestId !== requestIdRef.current) return true;
          applyActivities(extractActivities(activityResponse));
        } else {
          const [issueResponse, activityResponse] = await Promise.all([
            get(LIST_ENDPOINT),
            get(`${ACTIVITY_ENDPOINT}/${issueId}`),
          ]);
          if (!aliveRef.current || requestId !== requestIdRef.current) return true;
          const foundIssue = extractIssue(issueResponse, issueId);
          if (!foundIssue) throw new Error("Ticket details could not be found.");
          hasIssueRef.current = true;
          ticketClosedRef.current =
            foundIssue.status.trim().toUpperCase() === "CLOSED";
          setIssue((prev) =>
            JSON.stringify(prev) === JSON.stringify(foundIssue) ? prev : foundIssue,
          );
          applyActivities(extractActivities(activityResponse));
        }
        return true;
      } catch (requestError: unknown) {
        if (!silent && aliveRef.current) {
          const message = errorMessage(requestError);
          setError(message);
          toast.error(message);
        }
        return false;
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          if (!silent && aliveRef.current) setIsLoading(false);
        }
      }
    },
    [issueId, applyActivities],
  );

  // First load (and reset when another ticket is opened).
  useEffect(() => {
    hasIssueRef.current = false;
    ticketClosedRef.current = false;
    activitiesLoadedRef.current = false;
    knownIdsRef.current = new Set();
    pollCountRef.current = 0;
    pollFailuresRef.current = 0;
    void loadConversation();
  }, [loadConversation]);

  /**
   * Live updates: while this chat page is mounted the messages are re-fetched every 3 s.
   * - one request at a time (next poll is scheduled 3 s AFTER the previous one finishes)
   * - paused while the browser tab is hidden, refreshed immediately when it becomes visible / back online
   * - slows down (3 s -> 6 s -> 12 s ... max 30 s) while requests are failing, then recovers
   * - every 5th poll also refreshes the ticket (status, assigned admin)
   * - completely stopped when the user leaves the chat page
   */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delay: number) => {
      if (cancelled || ticketClosedRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      if (ticketClosedRef.current) return;
      if (document.hidden) {
        schedule(POLL_INTERVAL_MS);
        return;
      }

      pollCountRef.current += 1;
      const refreshIssue =
        !hasIssueRef.current || pollCountRef.current % ISSUE_REFRESH_EVERY === 0;
      const ok = await loadConversation(true, !refreshIssue);

      if (ticketClosedRef.current) return;
      pollFailuresRef.current = ok ? 0 : pollFailuresRef.current + 1;
      const delay = ok
        ? POLL_INTERVAL_MS
        : Math.min(POLL_INTERVAL_MS * 2 ** pollFailuresRef.current, MAX_POLL_BACKOFF_MS);
      schedule(delay);
    };

    const refreshNow = () => {
      if (!document.hidden && !ticketClosedRef.current) {
        pollFailuresRef.current = 0;
        void tick();
      }
    };

    document.addEventListener("visibilitychange", refreshNow);
    window.addEventListener("online", refreshNow);
    schedule(POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshNow);
      window.removeEventListener("online", refreshNow);
    };
  }, [loadConversation]);

  const subject = useMemo(
    () => parseSubject(issue?.subject ?? "Support ticket"),
    [issue?.subject],
  );

  const initialMessage: Activity | null = issue
    ? {
        id: `${issueId}-initial`,
        issueId,
        senderId: issue.userId ?? "customer",
        message: issue.description,
        mediaUrls: issue.mediaUrls,
        createdAt: issue.createdAt ?? "",
        sender: {
          id: issue.userId ?? "customer",
          name: "You",
          email: "",
          tier: "USER",
        },
      }
    : null;

  const messages = useMemo(() => {
    const sorted = [...activities].sort(
      (a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0),
    );
    return initialMessage ? [initialMessage, ...sorted] : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, issue]);

  const assignedAdmin = issue?.reportIssueAssignments?.[0]?.user;
  const adminName = assignedAdmin?.name ?? "Support team";
  const isTicketClosed = issue?.status?.trim().toUpperCase() === "CLOSED";

  useEffect(() => {
    if (issue && !assignedAdmin) {
      setShowAssignmentNotice(true);
    }
  }, [assignedAdmin, issue]);

  // Keep the view pinned to the newest message unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, issue?.id]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickToBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
    if (nearBottom) setUnread(0);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setUnread(0);
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (
      (!message && attachments.length === 0) ||
      !issue ||
      isSending ||
      isTicketClosed
    )
      return;
    if (!issue.userId) {
      toast.error(
        "Unable to identify the ticket owner. Please refresh and try again.",
      );
      return;
    }

    setIsSending(true);
    try {
      let mediaUrls: string[] = [];
      if (attachments.length > 0) {
        const form = new FormData();
        attachments.forEach((file) => form.append("files", file));
        mediaUrls = extractUploadedUrls(
          await post(MEDIA_UPLOAD_ENDPOINT, form),
        );
        if (mediaUrls.length === 0) {
          throw new Error("The attachment upload did not return a media URL.");
        }
      }

      await post(REPLY_ENDPOINT, {
        issue_id: issue.id ?? issueId,
        sender_id: issue.userId,
        message,
        media_urls: mediaUrls,
      });

      setDraft("");
      setAttachments([]);
      toast.success("Message sent");
      stickToBottomRef.current = true; // show the message the user just sent
      setUnread(0);
      await loadConversation();
    } catch (sendError: unknown) {
      toast.error(errorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full">
      {isLoading && !issue && (
        <div
          className="grid h-[calc(100dvh-7rem)] min-h-[32rem] grid-cols-1 gap-4"
          aria-busy="true"
          aria-label="Loading support conversation"
        >
          <Card className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-slate-800 bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/10" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-slate-800" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-slate-800" />
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-4 bg-slate-950 p-5 sm:p-8">
              <div className="h-16 w-2/3 animate-pulse rounded-2xl rounded-tl-sm bg-slate-800/80" />
              <div className="ml-auto h-20 w-3/4 animate-pulse rounded-2xl rounded-tr-sm bg-emerald-950/60" />
              <div className="h-12 w-1/2 animate-pulse rounded-2xl rounded-tl-sm bg-slate-800/80" />
              <p className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                Loading conversation...
              </p>
            </div>
          </Card>
        </div>
      )}

      {error && !issue && (
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            aria-label="Back to support tickets"
            className="mb-4 rounded-xl border-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Card className="border-red-500/20 bg-slate-900/50">
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
              <p role="alert" className="text-sm text-zinc-300">
                {error}
              </p>
              <Button
                variant="outline"
                onClick={() => void loadConversation()}
                className="border-slate-700"
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {issue && (
        <div className="grid h-[calc(100dvh-7rem)] min-h-[32rem] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,30%)]">
          {/* ── Chat ─────────────────────────────────────────────── */}
          <Card className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-slate-800 bg-slate-950 shadow-2xl shadow-black/20">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-2 py-2.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Back to support tickets"
                  className="h-9 w-9 shrink-0 rounded-full text-zinc-300 hover:bg-slate-800 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <div className="group relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-black shadow-lg shadow-black/20 sm:h-11 sm:w-11">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://d29bvka1s4r8lj.cloudfront.net/scaninfoga_stuff/upper_logo.png"
                      alt="ScanInfoga"
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                  <div className="pointer-events-none absolute left-0 top-14 z-20 hidden w-64 rounded-xl border border-slate-700 bg-slate-900 p-3 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 lg:block">
                    <p className="text-xs font-semibold text-white">
                      {adminName}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-400">
                      {assignedAdmin?.email ??
                        "Administrator details unavailable"}
                    </p>
                    {assignedAdmin?.mobile_number && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {assignedAdmin.mobile_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {subject.title}
                  </p>

                  {issue.ticketId && (
                    <p className="truncate font-mono text-[10px] text-zinc-500">
                      {issue.ticketId}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  className={cn(
                    "hidden border px-2 py-0.5 text-[11px] font-medium hover:bg-transparent sm:inline-flex",
                    statusClass(issue.status),
                  )}
                >
                  {statusLabel(issue.status)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void loadConversation()}
                  disabled={isLoading}
                  className="h-9 w-9 rounded-full text-zinc-400 hover:bg-slate-800 hover:text-emerald-400"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isLoading && "animate-spin")}
                  />
                  <span className="sr-only">Refresh conversation</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInfo(true)}
                  className="h-9 w-9 rounded-full text-zinc-400 hover:bg-slate-800 hover:text-emerald-400 lg:hidden"
                >
                  <Info className="h-4 w-4" />
                  <span className="sr-only">Ticket details</span>
                </Button>
              </div>
            </div>

            {assignedAdmin ? (
              <>
                {/* Messages */}
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="min-h-0 flex-1 overflow-y-auto bg-slate-950 px-3 py-4 [background-image:radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.08)_1px,transparent_0)] [background-size:22px_22px] sm:px-6 sm:py-6"
                >
                  <div className="mx-auto flex max-w-3xl flex-col">
                    {messages.map((message, index) => {
                      const prev = messages[index - 1];
                      const isAdminMessage = (item: Activity | undefined) => {
                        if (!item) return false;
                        const tier = String(
                          item.sender?.tier ?? "",
                        ).toUpperCase();
                        if (tier === "ADMIN") return true;
                        if (tier === "COMMERCIAL") return false;
                        return (
                          item.senderId === assignedAdmin?.id ||
                          item.sender?.id === assignedAdmin?.id
                        );
                      };
                      const isAdmin = isAdminMessage(message);
                      const newDay =
                        !prev ||
                        dayKey(prev.createdAt) !== dayKey(message.createdAt);
                      const prevIsAdmin = isAdminMessage(prev);
                      const firstInGroup =
                        newDay || !prev || prevIsAdmin !== isAdmin;
                      const hasAttachments =
                        (message.mediaUrls ?? []).length > 0;
                      const hasMessage = Boolean(message.message);

                      // ONE bubble per message (like WhatsApp):
                      // attachments on top, the text (caption) under them, time at the bottom-right.
                      const bubbleClass = cn(
                        "relative rounded-2xl text-sm leading-6 shadow-sm",
                        hasAttachments
                          ? cn("p-1.5", !hasMessage && "pb-5")
                          : "px-3 pb-5 pt-2",
                        isAdmin
                          ? "rounded-bl-md border border-slate-700/60 bg-slate-800 text-zinc-100"
                          : "rounded-br-md bg-emerald-700 text-white",
                        firstInGroup &&
                          (isAdmin ? "rounded-tl-2xl" : "rounded-tr-2xl"),
                      );

                      return (
                        <div key={message.id}>
                          {newDay && (
                            <div className="my-4 flex justify-center">
                              <span className="rounded-lg bg-slate-800/90 px-3 py-1 text-[11px] font-medium text-zinc-400 shadow">
                                {dayLabel(message.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={cn(
                              "flex items-end gap-2",
                              isAdmin ? "justify-start" : "justify-end",
                              firstInGroup ? "mt-3" : "mt-0.5",
                            )}
                          >
                            <div
                              className={cn(
                                "w-fit max-w-[92%] sm:max-w-[82%]",
                                isAdmin ? "items-start" : "items-end",
                              )}
                            >
                              <div className={bubbleClass}>
                                {index === 0 && (
                                  <p
                                    className={cn(
                                      "mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70",
                                      hasAttachments ? "px-1.5 pt-0.5" : "pr-10",
                                    )}
                                  >
                                    Original request
                                  </p>
                                )}

                                {hasAttachments && (
                                  <Attachments
                                    urls={message.mediaUrls ?? []}
                                    own={!isAdmin}
                                  />
                                )}

                                {hasMessage && (
                                  <p
                                    className={cn(
                                      "whitespace-pre-wrap break-words",
                                      hasAttachments
                                        ? "px-1.5 pb-4 pr-12 pt-1.5"
                                        : "pr-8",
                                    )}
                                  >
                                    {message.message}
                                  </p>
                                )}

                                <p
                                  className={cn(
                                    "absolute bottom-1.5 right-2.5 text-[10px] leading-none",
                                    isAdmin
                                      ? "text-zinc-400"
                                      : "text-emerald-100/80",
                                  )}
                                  title={formatDate(message.createdAt)}
                                >
                                  {formatTime(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {activities.length === 0 && (
                      <p className="mt-6 text-center text-xs text-zinc-500">
                        No replies yet. Our support team will respond here.
                      </p>
                    )}
                  </div>
                </div>

                {showJump && (
                  <button
                    type="button"
                    onClick={jumpToBottom}
                    aria-label={
                      unread > 0
                        ? `${unread} new messages. Scroll to latest message`
                        : "Scroll to latest message"
                    }
                    className="absolute bottom-24 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-zinc-300 shadow-lg transition-colors hover:bg-slate-800 hover:text-emerald-400 sm:right-6"
                  >
                    <ChevronDown className="h-5 w-5" />
                    {unread > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-slate-950">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </button>
                )}

                {isTicketClosed ? (
                  <div
                    role="status"
                    className="flex items-center gap-3 border-t border-amber-500/20 bg-amber-500/5 px-4 py-3 text-left"
                  >
                    <LockKeyhole className="h-4 w-4 shrink-0 text-amber-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-amber-200">
                        This ticket is closed
                      </p>
                      <p className="text-xs leading-5 text-amber-100/60">
                        Chat is locked because this support request has been
                        closed. Thank you for contacting our support team.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Composer */
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSend();
                    }}
                    className="border-t border-slate-800 bg-slate-900 p-2.5 sm:p-3"
                  >
                  {attachments.length > 0 && (
                    <div className="mx-1 mb-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/70 p-2">
                      {attachments.map((file, index) => {
                        const kind = kindOfName(file.name);
                        return (
                          <button
                            key={`${file.name}-${file.size}-${index}`}
                            type="button"
                            onClick={() =>
                              setAttachments((current) =>
                                current.filter(
                                  (_, fileIndex) => fileIndex !== index,
                                ),
                              )
                            }
                            className="flex max-w-full items-center gap-1.5 rounded-lg bg-slate-700/80 px-2 py-1 text-left text-[11px] text-zinc-200 hover:bg-red-900/60"
                            title={`${file.name} - ${formatSize(file.size)}`}
                          >
                            <KindIcon
                              kind={kind}
                              className={cn("h-3.5 w-3.5 shrink-0", KIND_TONE[kind])}
                            />
                            <span className="max-w-40 truncate">{file.name}</span>
                            <X className="h-3 w-3 shrink-0 text-zinc-400" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <label
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                      aria-label="Upload document"
                    >
                      <Paperclip className="h-5 w-5" />
                      <input
                        type="file"
                        multiple
                        className="sr-only"
                        accept={REPLY_ACCEPT}
                        onChange={(event) => {
                          const selected = Array.from(event.target.files ?? []);
                          setAttachments((current) =>
                            [...current, ...selected].slice(
                              0,
                              MAX_REPLY_ATTACHMENTS,
                            ),
                          );
                          event.target.value = "";
                        }}
                      />
                    </label>

                    <textarea
                      rows={1}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onPaste={(event) => {
                        const pastedImages = Array.from(
                          event.clipboardData.files,
                        ).filter((file) => file.type.startsWith("image/"));
                        if (pastedImages.length > 0) {
                          event.preventDefault();
                          setAttachments((current) =>
                            [...current, ...pastedImages].slice(
                              0,
                              MAX_REPLY_ATTACHMENTS,
                            ),
                          );
                        }
                      }}
                      onInput={(event) => {
                        const el = event.currentTarget;
                        el.style.height = "auto";
                        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Write a message..."
                      aria-label="Write a message"
                      className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-3xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40"
                    />

                    <Button
                      type="submit"
                      disabled={
                        (!draft.trim() && attachments.length === 0) || isSending
                      }
                      className="h-11 w-11 shrink-0 rounded-full bg-emerald-600 p-0 text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                  </form>
                )}
              </>
            ) : (
              <div className="flex-1 bg-slate-950 [background-image:radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.08)_1px,transparent_0)] [background-size:22px_22px]" />
            )}
          </Card>

          <Dialog
            open={showAssignmentNotice && !assignedAdmin}
            onOpenChange={(open) => {
              setShowAssignmentNotice(open);
              if (!open) onClose();
            }}
          >
            <DialogContent
              onPointerDownOutside={(event) => event.preventDefault()}
              onEscapeKeyDown={(event) => event.preventDefault()}
              className="w-[calc(100%-2rem)] rounded-2xl border border-amber-500/20 bg-slate-950 p-6 text-white shadow-2xl shadow-black/40 sm:max-w-md sm:p-8"
            >
              <DialogHeader className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                  <Info className="h-7 w-7" />
                </div>
                <DialogTitle className="mt-4 text-lg font-semibold text-white">
                  Support assignment pending
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-6 text-zinc-400">
                  Our support team is reviewing your request. You will be able
                  to chat with us as soon as an administrator is assigned to
                  your ticket.
                </DialogDescription>
                <p className="pt-1 text-sm leading-6 text-zinc-500">
                  We will contact you within the next few working days. Thank
                  you for your patience.
                </p>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          {/* ── Ticket details (desktop side panel) ───────────────── */}
          <Card className="hidden min-h-0 overflow-y-auto rounded-2xl border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20 lg:block">
            <CardContent className="p-5 sm:p-6">
              <TicketDetails issue={issue} onCopy={handleCopy} />
            </CardContent>
          </Card>

          {/* ── Ticket details (mobile / tablet popup) ────────────── */}
          <Dialog open={showInfo} onOpenChange={setShowInfo}>
            <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-3 text-white sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:p-6 lg:hidden">
              <DialogHeader className="pr-8 text-left">
                <DialogTitle className="text-base font-semibold text-white sm:text-lg">
                  Ticket details
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  Everything about this support request.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 min-w-0 sm:mt-4">
                <TicketDetails issue={issue} onCopy={handleCopy} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
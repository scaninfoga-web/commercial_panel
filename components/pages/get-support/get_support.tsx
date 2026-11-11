"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Hash,
  ImageIcon,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ReportIssue } from "@/types/get_support";
import { TICKET_CATALOG } from "@/constants/Ticket_catalog";
import { parseSubject } from "./get_support_utils";

type IssueRequest = ReportIssue["request"];
type IssueResponse = ReportIssue["response"];
type Category = ReportIssue["catalog"]["subjects"][number];

// ─── Config ─────────────────────────────────────────────────────────────
const CREATE_ISSUE_ENDPOINT = "/api/v1/report/create-report-issue";

// Multiple attachments are uploaded in ONE multipart request under the "files" field.
// Response: { urls: string[] } (same order as the files sent).
const UPLOAD_ENDPOINT = "/api/v1/report/report_issue_media_upload";
const UPLOAD_FIELD = "files";

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;
const MAX_ATTACHMENTS = 50;
const MAX_ATTACHMENT_MB = 5;
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];
const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".xls",
  ".xlsx",
  ".csv",
].join(",");
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|gif|pdf|xls|xlsx|csv)$/i;

// ─── Types ──────────────────────────────────────────────────────────────
interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  url?: string;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function getErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      data?: { responseStatus?: { message?: string }; message?: string };
    };
    message?: string;
  } | null;
  return (
    e?.response?.data?.responseStatus?.message ||
    e?.response?.data?.message ||
    e?.message ||
    fallback
  );
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const isImageFile = (file: File) => file.type.startsWith("image/");
const isAcceptedFile = (file: File) =>
  ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);

const normalizeStatus = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

function statusLabel(status: string): string {
  const key = normalizeStatus(status);
  return (
    TICKET_CATALOG.ticket_statuses.find((s) => normalizeStatus(s) === key) ??
    status.replace(/_/g, " ")
  );
}

function statusClass(status: string): string {
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

/** Reads the uploaded URLs from the upload response: { urls: string[] } (optionally wrapped in responseData). */
function extractUploadedUrls(res: unknown): string[] {
  const root = res as Record<string, unknown> | null;
  const data = (root?.responseData ?? root) as Record<string, unknown> | null;

  const asUrl = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return asUrl(o.url) ?? asUrl(o.fileUrl) ?? asUrl(o.location);
    }

    return null;
  };
  const list = data?.urls ?? data?.mediaUrls ?? data?.files;
  if (!Array.isArray(list)) return [];
  return list.map((v) => asUrl(v) ?? "");
}

/**
 * Maps the form to the API body.
 */
function buildRequestBody(
  category: Category,
  subSubject: string,
  description: string,
  mediaUrls: string[],
): IssueRequest {
  return {
    subject: `${category.name.replace(/\s*&\s*/g, " ").trim()} - ${subSubject.trim()}`,
    specific_issue: subSubject.trim(),
    description: description.trim(),
    media_urls: mediaUrls,
  };
}

// ─── Page ───────────────────────────────────────────────────────────────
export default function RaiseTicketPage({
  onCreated,
  onClose,
}: {
  onCreated?: () => void;
  onClose?: () => void;
}) {
  const [categoryKey, setCategoryKey] = useState("");
  const [subSubject, setSubSubject] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticket, setTicket] = useState<IssueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<ImageItem[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Free object URLs on unmount.
  useEffect(
    () => () => {
      imagesRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    },
    [],
  );

  const category = useMemo(
    () => TICKET_CATALOG.subjects.find((c) => c.key === categoryKey),
    [categoryKey],
  );

  const trimmedLength = description.trim().length;
  const descriptionTooShort =
    description.length > 0 && trimmedLength < MIN_DESCRIPTION;
  const uploadingCount = images.filter((i) => i.status === "uploading").length;
  const failedCount = images.filter((i) => i.status === "error").length;

  const canSubmit =
    Boolean(category && subSubject) &&
    trimmedLength >= MIN_DESCRIPTION &&
    uploadingCount === 0 &&
    failedCount === 0 &&
    !isSubmitting;

  // ── Attachments ──────────────────────────────────────────────────────
  /** Uploads one or more attachments in a single multipart request. */
  const uploadBatch = useCallback(async (items: ImageItem[]) => {
    const ids = items.map((i) => i.id);
    try {
      const form = new FormData();
      items.forEach((i) => form.append(UPLOAD_FIELD, i.file));

      const res = await post(UPLOAD_ENDPOINT, form);
      const urls = extractUploadedUrls(res);
      if (urls.length === 0)
        throw new Error("Upload finished but no attachment URLs were returned");

      setImages((prev) =>
        prev.map((img) => {
          const idx = ids.indexOf(img.id);
          if (idx === -1) return img;
          const url = urls[idx];
          return url
            ? { ...img, status: "done", url, error: undefined }
            : {
                ...img,
                status: "error",
                error: "No URL returned for this image",
              };
        }),
      );
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Upload failed");
      setImages((prev) =>
        prev.map((img) =>
          ids.includes(img.id)
            ? { ...img, status: "error", error: message }
            : img,
        ),
      );
    }
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;

      const problems: string[] = [];
      const valid: File[] = [];

      for (const file of incoming) {
        if (!isAcceptedFile(file)) {
          problems.push(
            `${file.name}: only images, PDF, XLS, XLSX or CSV files are allowed`,
          );
        } else if (file.size > MAX_ATTACHMENT_BYTES) {
          problems.push(`${file.name}: larger than ${MAX_ATTACHMENT_MB} MB`);
        } else {
          valid.push(file);
        }
      }

      const slots = Math.max(
        MAX_ATTACHMENTS - imagesRef.current.length,
        0,
      );
      if (valid.length > slots) {
        problems.push(`You can attach up to ${MAX_ATTACHMENTS} attachments`);
      }
      const accepted = valid.slice(0, slots);

      if (problems.length > 0) toast.error(problems[0]);
      if (accepted.length === 0) return;

      const items: ImageItem[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }));

      setImages((prev) => [...prev, ...items]);
      void uploadBatch(items);
    },
    [uploadBatch],
  );

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const retryImage = (item: ImageItem) => {
    setImages((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: "uploading", error: undefined } : i,
      ),
    );
    void uploadBatch([item]);
  };

  const clearImages = () => {
    imagesRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
  };

  const openPicker = () => fileInputRef.current?.click();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isSubmitting) return;
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null))
      setIsDragging(false);
  };

  // ── Form ──────────────────────────────────────────────────────────────
  const handleCategoryChange = (key: string) => {
    setCategoryKey(key);
    setSubSubject("");
  };

  const resetForm = () => {
    setCategoryKey("");
    setSubSubject("");
    setDescription("");
    clearImages();
    setError(null);
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!category || !subSubject) {
      toast.error("Please select a subject and the specific issue");
      return;
    }
    if (trimmedLength < MIN_DESCRIPTION) {
      toast.error(
        `Please describe the issue (at least ${MIN_DESCRIPTION} characters)`,
      );
      return;
    }
    if (uploadingCount > 0) {
      toast.info("Please wait for the attachments to finish uploading");
      return;
    }
    if (failedCount > 0) {
      toast.error("Retry or remove the attachments that failed to upload");
      return;
    }

    const mediaUrls = images.flatMap((i) => (i.url ? [i.url] : []));
    const body = buildRequestBody(category, subSubject, description, mediaUrls);

    setIsSubmitting(true);
    setError(null);
    setTicket(null);

    try {
      const response = await post(CREATE_ISSUE_ENDPOINT, body);

      const envelope = response as {
        responseData?: Partial<IssueResponse>;
      } | null;
      const data = (envelope?.responseData ??
        response) as Partial<IssueResponse> | null;

      if (!data?.ticketId) {
        throw new Error("Invalid response received from the server");
      }

      setTicket({
        reportId: data.reportId ?? "",
        ticketId: data.ticketId ?? "",
        subject: data.subject ?? body.subject,
        description: data.description ?? body.description,
        mediaUrls: data.mediaUrls ?? mediaUrls,
        status: data.status ?? "OPEN",
      });
      resetForm();
      toast.success("Ticket raised successfully");
      onCreated?.();
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "Failed to raise ticket. Please try again.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectTriggerClass =
    "h-10 w-full rounded-xl border-slate-700 bg-slate-900 text-left text-white focus:ring-1 focus:ring-emerald-500/50 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50";
  const selectContentClass =
    "max-h-72 rounded-xl border-slate-700 bg-slate-900";
  const selectItemClass =
    "text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400";
  const labelClass =
    "text-xs font-medium uppercase tracking-wider text-zinc-500";

  return (
    <>
      <Card className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <FileText className="h-4 w-4 text-emerald-400" />
              Ticket Details
            </CardTitle>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5">
            {/* Subject + sub-subject */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className={labelClass}>Subject</Label>
                <Select
                  value={categoryKey}
                  onValueChange={handleCategoryChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    disabled={isSubmitting}
                    className={selectTriggerClass}
                  >
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {TICKET_CATALOG.subjects.map((c) => (
                      <SelectItem
                        key={c.key}
                        value={c.key}
                        className={selectItemClass}
                      >
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {category && (
                  <p className="text-[11px] leading-snug text-zinc-500">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label className={labelClass}>Specific Issue</Label>
                <Select
                  key={categoryKey || "none"}
                  value={subSubject}
                  onValueChange={setSubSubject}
                  disabled={isSubmitting || !category}
                >
                  <SelectTrigger
                    disabled={isSubmitting || !category}
                    className={selectTriggerClass}
                  >
                    <SelectValue
                      placeholder={
                        category ? "Select the issue" : "Select a subject first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {(category?.subsubjects ?? []).map((s) => (
                      <SelectItem key={s} value={s} className={selectItemClass}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ticket-description" className={labelClass}>
                  Description
                </Label>
                <span className="font-mono text-[11px] text-zinc-600">
                  {description.length}/{MAX_DESCRIPTION}
                </span>
              </div>
              <textarea
                id="ticket-description"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, MAX_DESCRIPTION))
                }
                disabled={isSubmitting}
                rows={6}
                placeholder="Describe the issue in detail: what you did, what you expected and what happened."
                className="min-h-[140px] w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus-visible:border-emerald-500/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {descriptionTooShort && (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-amber-400"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Please add at least {MIN_DESCRIPTION} characters.
                </p>
              )}
            </div>

            {/* Images */}
            <div className="flex flex-col gap-2">
              <Label className={cn("flex items-center gap-1.5", labelClass)}>
                <ImageIcon className="h-3.5 w-3.5" />
                Attachments
                <span className="normal-case tracking-normal text-zinc-600">
                  (optional)
                </span>
              </Label>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = ""; // allow re-selecting the same file
                }}
              />

              <div
                role="button"
                tabIndex={0}
                aria-label="Upload attachments. Drag and drop or press Enter to browse."
                aria-disabled={
                  isSubmitting || images.length >= MAX_ATTACHMENTS
                }
                onClick={() =>
                  !isSubmitting &&
                  images.length < MAX_ATTACHMENTS &&
                  openPicker()
                }
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isSubmitting) {
                    e.preventDefault();
                    if (images.length < MAX_ATTACHMENTS) openPicker();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (!isSubmitting) setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50",
                  isDragging
                    ? "border-emerald-500/70 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-950/40 hover:border-emerald-500/40 hover:bg-slate-900/60",
                  (isSubmitting || images.length >= MAX_ATTACHMENTS) &&
                    "cursor-not-allowed opacity-60",
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full border transition-colors",
                    isDragging
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                      : "border-slate-700 bg-slate-900 text-zinc-400",
                  )}
                >
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-white">
                  {isDragging
                    ? "Drop attachments to upload"
                    : "Drag & drop attachments here"}
                </p>
                <p className="text-xs text-zinc-500">
                  JPG, PNG, WEBP, GIF, PDF, XLS or XLSX · up to{" "}
                  {MAX_ATTACHMENT_MB} MB each · max {MAX_ATTACHMENTS}{" "}
                  attachments
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting || images.length >= MAX_ATTACHMENTS}
                  onClick={(e) => {
                    e.stopPropagation();
                    openPicker();
                  }}
                  className="mt-1 touch-manipulation rounded-xl border-slate-700 bg-slate-900 text-zinc-300 hover:border-emerald-500/40 hover:bg-slate-800 hover:text-emerald-400"
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Upload attachment
                </Button>
              </div>

              {images.length > 0 && (
                <ul className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {images.map((img) => (
                    <li
                      key={img.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60"
                    >
                      {isImageFile(img.file) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.previewUrl}
                          alt={img.file.name}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-sky-500/10 px-2 text-center">
                          <FileText className="h-8 w-8 text-sky-400" />
                          <span className="line-clamp-3 break-all text-[11px] font-medium text-sky-300">
                            {img.file.name}
                          </span>
                        </div>
                      )}

                      {img.status === "uploading" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                        </div>
                      )}
                      {img.status === "error" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-red-950/80 p-2 text-center">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <p
                            className="line-clamp-2 text-[10px] text-red-200"
                            title={img.error}
                          >
                            {img.error}
                          </p>
                          <button
                            type="button"
                            onClick={() => retryImage(img)}
                            className="flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-800"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Retry
                          </button>
                        </div>
                      )}
                      {img.status === "done" && (
                        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        disabled={isSubmitting}
                        aria-label={`Remove ${img.file.name}`}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 touch-manipulation items-center justify-center rounded-full bg-slate-950/80 text-zinc-300 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <div className="border-t border-slate-800 px-2 py-1.5">
                        <p
                          className="truncate text-[11px] text-zinc-300"
                          title={img.file.name}
                        >
                          {img.file.name}
                        </p>
                        <p className="font-mono text-[10px] text-zinc-600">
                          {formatFileSize(img.file.size)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Actions: Raise Ticket on the right */}
            <div className="flex flex-col gap-3 border-t border-slate-800 pt-5">
              {(uploadingCount > 0 || failedCount > 0) && (
                <p className="text-xs text-amber-400 sm:text-right">
                  {uploadingCount > 0
                    ? "Uploading attachments, please wait…"
                    : "Retry or remove the attachments that failed to upload."}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={resetForm}
                  className="w-full touch-manipulation rounded-xl border-slate-700 bg-slate-900 text-zinc-300 transition-transform hover:border-slate-600 hover:bg-slate-800 hover:text-white active:scale-[0.98] sm:w-auto"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full touch-manipulation rounded-xl border-emerald-500/80 bg-emerald-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.18)] transition-transform hover:border-emerald-500 hover:bg-emerald-500 hover:text-white active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Raising…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Raise Ticket
                    </>
                  )}
                </Button>
              </div>
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

      {/* Created ticket */}
      {ticket && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <BadgeCheck
                      className="h-6 w-6 text-emerald-400"
                      strokeWidth={2.25}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white sm:text-base">
                      Ticket raised successfully
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Keep your ticket ID handy for follow-ups.
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    "w-fit shrink-0 border px-2 py-0.5 text-[11px] font-medium hover:bg-transparent",
                    statusClass(ticket.status),
                  )}
                >
                  {statusLabel(ticket.status)}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-emerald-500/15 pt-4 sm:grid-cols-3">
                <div className="flex items-start gap-2">
                  <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Ticket ID
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="truncate font-mono text-xs text-emerald-400">
                        {ticket.ticketId}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(ticket.ticketId, "Ticket ID")}
                        aria-label="Copy ticket ID"
                        className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {ticket.reportId && (
                  <div className="flex items-start gap-2">
                    <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                        Report ID
                      </p>
                      <div className="flex items-center gap-1">
                        <p className="truncate font-mono text-xs text-zinc-300">
                          {ticket.reportId}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(ticket.reportId, "Report ID")
                          }
                          aria-label="Copy report ID"
                          className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Subject
                    </p>
                    {(() => {
                      const { title, subTitle } = parseSubject(ticket.subject);
                      return (
                        <>
                          <p className="text-xs text-zinc-300">{title}</p>
                          {subTitle && (
                            <p className="mt-0.5 text-xs text-zinc-400">
                              {subTitle}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3 border-t border-emerald-500/15 pt-4">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-300">
                    {ticket.description}
                  </p>
                </div>

                {ticket.mediaUrls.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Attachments
                    </p>
                    <ul className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {ticket.mediaUrls.map((u) => (
                        <li key={u}>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u}
                              alt="Attachment"
                              className="aspect-square w-full object-cover"
                              loading="lazy"
                            />
                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}

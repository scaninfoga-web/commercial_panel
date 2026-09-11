"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Loader2,
  Send,
  Copy,
  Check,
  FlaskConical,
  Rocket,
  Terminal,
  FileJson,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Maximize2,
  Info,
  CheckCircle2,
 IndianRupee,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getApiDocumentation } from "@/lib/api-docs";
import { get } from "@/lib/api"; // Added generic get import
import type { ApiDocumentation } from "@/types/api-documentation";
import { cn } from "@/lib/utils";

// ─── Local Types & API Helpers (Replaced lib/manage_apis) ────────────────────
type ApiKeyEnvironment = "DEVELOPMENT" | "PRODUCTION";
type ApiKeyStatus = "ACTIVE" | "INACTIVE" | "REVOKED";

interface ApiKey {
  id: string;
  type: ApiKeyEnvironment;
  key?: string;
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

interface ApiResponseEnvelope<T> {
  responseStatus: { status: boolean; statusCode: number; message: string };
  responseData: T;
}

const normalizeStatus = (value: unknown): ApiKeyStatus => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "REVOKED") return normalized as ApiKeyStatus;
  return "INACTIVE";
};

const normalizeEnvironment = (value: unknown): ApiKeyEnvironment =>
  String(value ?? "").trim().toUpperCase() === "PRODUCTION" ? "PRODUCTION" : "DEVELOPMENT";

const normalizeKeyItem = (item: any): ApiKey | null => {
  if (!item || typeof item !== "object") return null;
  const id = item.id ?? item.api_key_id;
  if (!id) {
    console.warn("[ViewDocumentation] Skipping API key with no id in response:", item);
    return null;
  }
  return {
    id: String(id),
    type: normalizeEnvironment(item.type ?? item.environment),
    key: item.key ?? item.api_key ?? undefined,
    status: normalizeStatus(item.status ?? item.state),
    createdAt: String(item.createdAt ?? item.created_at ?? new Date().toISOString()),
    lastUsedAt: item.lastUsedAt ?? item.last_used_at ?? undefined,
    expiresAt: item.expiresAt ?? item.expires_at ?? undefined,
  };
};

const extractApiKeyList = (payload: unknown): ApiKey[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.keys)
      ? (payload as any).keys
      : Array.isArray((payload as any)?.data)
        ? (payload as any).data
        : [];
  return list
    .map(normalizeKeyItem)
    .filter((k: ApiKey | null): k is ApiKey => k !== null);
};

async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await get<ApiResponseEnvelope<any>>("/api/v1/user/commercial/api-keys");
  return extractApiKeyList(response.responseData);
}

// ─── Component Definition ────────────────────────────────────────────────────
interface ViewDocumentationProps {
  endpoint: string;
  apiName?: string;
}

type KeyType = "DEVELOPMENT" | "PRODUCTION";
type ResponseStatus = "success" | "error" | null;

// Every request in this product is served from a single host, so the
// left-hand docs pane and the generated cURL always show the full,
// copy-pasteable URL rather than a bare path.
const BASE_DOMAIN = "https://api.scaninfoga.com";

// These fields are attached to every request for compliance and consent
// reasons. They're pulled out of the editable JSON body so a user can
// never accidentally edit or delete them, shown separately in a dimmed,
// read-only block, and merged back in right before a request is sent or
// a cURL example is generated.
const FIXED_FIELD_KEYS = new Set(["purpose", "consent"]);

// Fields we render with dedicated UI. Anything else your JSON adds still
// shows up automatically in "Additional Details" below — nothing gets
// silently dropped as your docs grow.
const KNOWN_DOC_FIELDS = new Set([
  "title",
  "description",
  "request",
  "request_curl",
  "endpoint",
  "response",
  "errors",
  "notes",
]);

// Consistent, typed error-message extraction — replaces scattered `err: any`
// catches so failures always surface a real, readable message.
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    return (
      err.response?.data?.responseStatus?.message ||
      err.response?.data?.message ||
      err.message ||
      fallback
    );
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

// Case/whitespace-safe match, and picks the most recently created key
// when more than one active key of the same type exists.
const findActiveKey = (keys: ApiKey[], keyType: KeyType): ApiKey | null => {
  const matches = keys.filter(
    (k) =>
      (k.type ?? "").toString().trim().toUpperCase() === keyType &&
      (k.status ?? "").toString().trim().toUpperCase() === "ACTIVE",
  );
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
};

// Accepts headers as either { KEY: "value" } or [{ key, value }] — your
// JSON schema can use either shape and this still renders it.
const normalizeKeyValueList = (input: unknown): Array<[string, string]> => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(
        (entry: any) =>
          [
            String(entry?.key ?? entry?.name ?? ""),
            String(entry?.value ?? entry?.description ?? ""),
          ] as [string, string],
      )
      .filter(([key]) => key.length > 0);
  }
  if (typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]);
  }
  return [];
};

// Splits a request body into the fields a user can edit and the fixed
// compliance fields that ride along with every request.
const splitFixedFields = (
  body: Record<string, unknown> | null,
): { editable: Record<string, unknown>; fixed: Record<string, unknown> } => {
  const editable: Record<string, unknown> = {};
  const fixed: Record<string, unknown> = {};
  if (body) {
    Object.entries(body).forEach(([key, value]) => {
      if (FIXED_FIELD_KEYS.has(key.toLowerCase())) fixed[key] = value;
      else editable[key] = value;
    });
  }
  return { editable, fixed };
};

interface ParsedCurl {
  method: string;
  headers: Array<[string, string]>;
  bodyText: string | null;
}

// Reads a docs-team-authored cURL example (the `request_curl` field our
// JSON now ships) apart into its pieces, so it can be re-rendered
// consistently and its body reused to seed the interactive console.
const parseCurl = (curl?: string | null): ParsedCurl => {
  if (!curl) return { method: "POST", headers: [], bodyText: null };

  const headers: Array<[string, string]> = [];
  const headerRe = /--header\s+'([^:']+):\s*([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(curl)) !== null) {
    headers.push([match[1].trim(), match[2].trim()]);
  }

  const dataMatch = curl.match(/--data(?:-raw)?\s+'([\s\S]*)'\s*$/);
  const bodyText = dataMatch ? dataMatch[1].trim() : null;

  const methodMatch = curl.match(/(?:-X|--request)\s+(\w+)/i);
  const method = methodMatch
    ? methodMatch[1].toUpperCase()
    : bodyText
      ? "POST"
      : "GET";

  return { method, headers, bodyText };
};

// Colors a JSON string token-by-token the way Postman's console does —
// keys, strings, numbers, booleans, and null each get their own color —
// so a response is easy to scan instead of one flat block of text.
// Escapes <, >, & first so nothing in the payload can break out of the
// generated markup; safe to feed into dangerouslySetInnerHTML.
const highlightJson = (value: string): string => {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let color = "#fcd34d"; // number — amber-300
      if (/^"/.test(match)) {
        color = /:\s*$/.test(match)
          ? "#34d399" /* key — emerald-400 */
          : "#7dd3fc"; /* string — sky-300 */
      } else if (/^(true|false)$/.test(match)) {
        color = "#c4b5fd"; // boolean — violet-300
      } else if (/^null$/.test(match)) {
        color = "#fda4af"; // null — rose-300
      }
      return `<span style="color:${color}">${match}</span>`;
    },
  );
};

interface CurlLine {
  text: string;
  // "flag": curl syntax (--location, --header) — plain accent color.
  // "json": part of the request body — gets full token-level coloring.
  // "fixed": a compliance field (purpose, consent) — always dimmed flat,
  //          deliberately not colorized so it reads as "don't edit me".
  variant: "flag" | "json" | "fixed";
}

// Builds a readable, multi-line cURL command from a URL, headers, and a
// body object — pretty-printing the body and flagging any line that
// belongs to a fixed compliance field so it can be rendered dimmed.
const buildCurlDisplay = (
  url: string,
  headers: Array<[string, string]>,
  bodyObj: Record<string, unknown> | null,
): { lines: CurlLine[]; plainText: string } => {
  const lines: CurlLine[] = [];
  const bodyJson =
    bodyObj && Object.keys(bodyObj).length > 0
      ? JSON.stringify(bodyObj, null, 2)
      : null;

  lines.push({ text: `curl --location '${url}' \\`, variant: "flag" });

  headers.forEach(([key, value]) => {
    lines.push({ text: `  --header '${key}: ${value}' \\`, variant: "flag" });
  });

  if (bodyJson) {
    const bodyLines = bodyJson.split("\n");
    bodyLines.forEach((line, idx) => {
      const isFixed = /^\s*"(purpose|consent)"\s*:/i.test(line);
      const isFirst = idx === 0;
      const isLast = idx === bodyLines.length - 1;
      const rendered = `${isFirst ? "  --data '" : "  "}${line}${isLast ? "'" : ""}`;
      lines.push({ text: rendered, variant: isFixed ? "fixed" : "json" });
    });
  } else {
    const last = lines[lines.length - 1];
    if (last && last.text.endsWith(" \\")) {
      last.text = last.text.slice(0, -2);
    }
  }

  return { lines, plainText: lines.map((l) => l.text).join("\n") };
};

// Renders any JSON value: syntax-plain but line-wrapped so huge single
// strings don't force endless horizontal scroll, a copy button, a line
// count, a themed + always-visible scrollbar (works on touch, not just
// hover), and — for large payloads — an expand-to-fullscreen view so
// nothing is ever cut off by a fixed small box.
function JsonViewer({
  data,
  label,
  maxHeight = "18rem",
  tone = "text-zinc-300",
  alwaysShowExpand = false,
  noHeightCap = false,
}: {
  data: unknown;
  label?: string;
  maxHeight?: string;
  tone?: string;
  alwaysShowExpand?: boolean;
  // When true, the block grows to fit its content instead of scrolling
  // inside a fixed-height box. Use this for the one JSON block per view
  // that matters most (e.g. the live API response) so every line —
  // including the last one — is reachable by scrolling the page itself,
  // instead of getting trapped behind a second, nested scrollbar.
  noHeightCap?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    try {
      return typeof data === "string" ? data : JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const lineCount = json.split("\n").length;
  const showExpandButton = alwaysShowExpand || lineCount > 14;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-1.5">
          <span className="text-[11px] text-zinc-500">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          <div className="flex items-center gap-1">
            {showExpandButton && (
              <button
                onClick={() => setIsExpanded(true)}
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                title="Expand — view full content"
                aria-label="Expand JSON"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
              title="Copy"
              aria-label="Copy JSON"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <pre
          className={cn(
            "scrollbar-custom overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-5",
            tone,
          )}
          style={noHeightCap ? undefined : { maxHeight }}
          dangerouslySetInnerHTML={{ __html: highlightJson(json) }}
        />
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-2xl border-slate-800 bg-slate-900 p-0 sm:max-w-4xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">
                {label ?? "JSON"}
              </p>
              <p className="text-xs text-zinc-500">{lineCount} lines</p>
            </div>
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-slate-800 hover:text-emerald-400"
              title="Copy"
              aria-label="Copy JSON"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <pre
            className="scrollbar-custom max-h-[calc(88vh-68px)] overflow-auto whitespace-pre-wrap break-all p-5 font-mono text-sm leading-6 text-zinc-200"
            dangerouslySetInnerHTML={{ __html: highlightJson(json) }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// A themed terminal block for a cURL command — mirrors JsonViewer's
// chrome (line-style header, copy button) but line-by-line, so fixed
// compliance fields (purpose, consent) can be rendered dimmed while
// everything else stays legible and copy-pastable as-is.
function CurlConsole({
  lines,
  plainText,
  label = "cURL",
  footnote,
}: {
  lines: CurlLine[];
  plainText: string;
  label?: string;
  footnote?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast.success("cURL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Terminal className="h-3 w-3" />
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
          title="Copy cURL"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div
        className="scrollbar-custom overflow-auto p-3 font-mono text-[12.5px] leading-5"
        style={{ maxHeight: "22rem" }}
      >
        {lines.length === 0 ? (
          <p className="text-zinc-600">Nothing to preview yet.</p>
        ) : (
          lines.map((line, idx) =>
            line.variant === "json" ? (
              <div
                key={idx}
                className="whitespace-pre text-zinc-300"
                dangerouslySetInnerHTML={{ __html: highlightJson(line.text) }}
              />
            ) : (
              <div
                key={idx}
                className={cn(
                  "whitespace-pre",
                  line.variant === "fixed"
                    ? "text-zinc-600"
                    : "text-emerald-300/90",
                )}
              >
                {line.text}
              </div>
            ),
          )
        )}
      </div>
      {footnote && (
        <div className="flex items-start gap-1.5 border-t border-slate-800/80 px-3 py-2 text-[11px] text-zinc-500">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{footnote}</span>
        </div>
      )}
    </div>
  );
}

// A small key/value table for headers, query params, or path params —
// whichever shape your JSON uses.
function KeyValueTable({ rows }: { rows: Array<[string, string]> }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      {rows.map(([key, value]) => (
        <div
          key={key}
          className="flex items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-950/40 px-3 py-1.5 text-xs last:border-b-0"
        >
          <span className="shrink-0 font-mono text-emerald-400">{key}</span>
          <span className="truncate text-right text-zinc-400">{value}</span>
        </div>
      ))}
    </div>
  );
}

// Read-only, deliberately dimmed display of the fields that ride along
// with every request (purpose, consent, ...). Kept out of the editable
// textarea so they can never be edited or stripped by mistake.

export default function ViewDocumentation({
  endpoint,
  apiName,
}: ViewDocumentationProps) {
  const [doc, setDoc] = useState<ApiDocumentation | null>(null);
  const [isDocLoading, setIsDocLoading] = useState(true);
  const [docMethod, setDocMethod] = useState("POST");

  // The editable part of the request body. Fixed compliance fields
  // (purpose, consent) live in `fixedFields` instead and are merged back
  // in right before sending or building a cURL command.
  const [editableBody, setEditableBody] = useState("{}");
  const [fixedFields, setFixedFields] = useState<Record<string, unknown>>({});
  const [legacyRequestMeta, setLegacyRequestMeta] = useState<{
    headers: Array<[string, string]>;
    queryParams: Array<[string, string]>;
    pathParams: Array<[string, string]>;
  }>({ headers: [], queryParams: [], pathParams: [] });

  const [isSending, setIsSending] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<ResponseStatus>(null);
  const [responseStatusCode, setResponseStatusCode] = useState<number | null>(
    null,
  );
  const responseRef = useRef<HTMLDivElement | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isKeysLoading, setIsKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);

  // The environment must be chosen from this dropdown before Send is
  // enabled — no request goes out without an explicit key selection.
  const [selectedKeyType, setSelectedKeyType] = useState<KeyType | "">("");
  const [resolvedKeyValue, setResolvedKeyValue] = useState<string | null>(null);

  // Shown when a matched key's value wasn't returned by the list
  // endpoint (common — the full secret is often only ever shown once,
  // at creation time), so the user can paste it in instead of failing.
  const [showManualKeyDialog, setShowManualKeyDialog] = useState(false);
  const [manualKeyValue, setManualKeyValue] = useState("");

  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  useEffect(() => {
    setIsDocLoading(true);
    const data = getApiDocumentation(endpoint);
    setDoc(data ?? null);

    const legacyBody =
      ((data?.request as any)?.body as Record<string, unknown> | undefined) ??
      null;
    const legacyMethod = (data?.request as any)?.method as string | undefined;
    const curlInfo = parseCurl((data as any)?.request_curl);

    let bodyObj: Record<string, unknown> | null = legacyBody ?? null;
    if (!bodyObj && curlInfo.bodyText) {
      try {
        bodyObj = JSON.parse(curlInfo.bodyText);
      } catch {
        bodyObj = null;
      }
    }

    const { editable, fixed } = splitFixedFields(bodyObj);
    setEditableBody(
      Object.keys(editable).length > 0
        ? JSON.stringify(editable, null, 2)
        : "{}",
    );
    setFixedFields(fixed);
    setDocMethod(legacyMethod || curlInfo.method || "POST");

    setLegacyRequestMeta({
      headers: normalizeKeyValueList((data?.request as any)?.headers),
      queryParams: normalizeKeyValueList(
        (data?.request as any)?.query_params ??
          (data?.request as any)?.queryParams,
      ),
      pathParams: normalizeKeyValueList(
        (data?.request as any)?.path_params ??
          (data?.request as any)?.pathParams,
      ),
    });

    setResponseText(null);
    setResponseStatus(null);
    setResponseStatusCode(null);
    setSelectedKeyType("");
    setResolvedKeyValue(null);
    setIsDocLoading(false);
  }, [endpoint]);

  // As soon as a response lands, bring it into view — the user shouldn't
  // have to go hunting for it below the Send button.
  useEffect(() => {
    if (responseText && responseRef.current) {
      responseRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [responseText]);

  // Live validity feedback on the request body editor — you see
  // immediately whether what you typed will actually parse, instead of
  // finding out after hitting Send.
  const bodyValidity = useMemo(() => {
    if (!editableBody.trim()) return { valid: true, message: "Empty body" };
    try {
      JSON.parse(editableBody);
      return { valid: true, message: "Valid JSON" };
    } catch (err: unknown) {
      return { valid: false, message: getErrorMessage(err, "Invalid JSON") };
    }
  }, [editableBody]);

  const handleFormatBody = () => {
    try {
      const parsed = JSON.parse(editableBody);
      setEditableBody(JSON.stringify(parsed, null, 2));
    } catch {
      toast.error("Can't format — fix the JSON syntax first");
    }
  };

  const loadApiKeys = async () => {
    setIsKeysLoading(true);
    setKeysError(null);
    try {
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load API keys");
      setKeysError(message);
      toast.error(message);
    } finally {
      setIsKeysLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMatchedKey = useMemo(
    () => (selectedKeyType ? findActiveKey(apiKeys, selectedKeyType) : null),
    [apiKeys, selectedKeyType],
  );

  // Choosing an environment resolves a usable key immediately when one
  // is cached, or opens the manual-paste dialog when it isn't — either
  // way, Send stays disabled until a real key value is in hand.
  const handleSelectKeyType = (value: string) => {
    const keyType = value as KeyType;
    setSelectedKeyType(keyType);
    setResolvedKeyValue(null);
    setManualKeyValue("");

    const matched = findActiveKey(apiKeys, keyType);
    if (matched?.key) {
      setResolvedKeyValue(matched.key);
    } else if (matched && !matched.key) {
      setShowManualKeyDialog(true);
    }
  };

  const exampleCurl = useMemo(() => {
    const url = `${BASE_DOMAIN}${(doc as any)?.endpoint || endpoint}`;
    const curlInfo = parseCurl((doc as any)?.request_curl);

    let headers = curlInfo.headers;
    if (headers.length === 0) {
      headers = [
        ["Content-Type", "application/json"],
        ["api-key", "YOUR_API_KEY"],
      ];
    }

    let bodyObj: Record<string, unknown> | null = null;
    if (curlInfo.bodyText) {
      try {
        bodyObj = JSON.parse(curlInfo.bodyText);
      } catch {
        bodyObj = null;
      }
    } else {
      bodyObj =
        ((doc?.request as any)?.body as Record<string, unknown>) ?? null;
    }

    return buildCurlDisplay(url, headers, bodyObj);
  }, [doc, endpoint]);

  const handleSend = async () => {
    if (!selectedKeyType) {
      toast.error("Choose an environment before sending a request");
      return;
    }
    if (!resolvedKeyValue) {
      toast.error("Add your API key to continue");
      return;
    }

    let editableParsed: Record<string, unknown>;
    try {
      editableParsed = editableBody.trim() ? JSON.parse(editableBody) : {};
    } catch {
      toast.error("Invalid JSON body.");
      return;
    }

    const payload = { ...editableParsed, ...fixedFields };

    setIsSending(true);
    setResponseText(null);
    setResponseStatus(null);
    setResponseStatusCode(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || BASE_DOMAIN}${endpoint}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": resolvedKeyValue,
          },
        },
      );

      setResponseText(JSON.stringify(response.data, null, 2));
      setResponseStatus("success");
      setResponseStatusCode(response.status);
      toast.success("API call successful");
    } catch (error: unknown) {
      const message = getErrorMessage(error, "API call failed");
      const errorPayload = axios.isAxiosError(error)
        ? error.response?.data
        : undefined;
      const statusCode = axios.isAxiosError(error)
        ? (error.response?.status ?? null)
        : null;

      setResponseText(
        JSON.stringify(errorPayload ?? { error: message }, null, 2),
      );
      setResponseStatus("error");
      setResponseStatusCode(statusCode);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(
        `${BASE_DOMAIN}${(doc as any)?.endpoint || endpoint}`,
      );
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (isDocLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 py-24 text-center">
        <FileJson className="h-10 w-10 text-zinc-600" />
        <p className="text-sm text-zinc-400">
          No detailed documentation found for this API.
        </p>
      </div>
    );
  }

  // Anything at the top level of doc.json that isn't one of the fields
  // this component already knows how to render.
  const extraFields = Object.entries(
    doc as unknown as Record<string, unknown>,
  ).filter(
    ([key, value]) =>
      !KNOWN_DOC_FIELDS.has(key) && value !== undefined && value !== null,
  );

  // Response can be a single { success, error, ... } object with any
  // number of named examples — render every one of them, not just
  // "success".
  const responseEntries =
    doc.response && typeof doc.response === "object"
      ? Object.entries(doc.response as Record<string, any>).filter(
          ([, v]) => v != null,
        )
      : [];

  const keyStatusLabel = (key: ApiKey | null) => {
    if (!key) return { text: "No active key found", tone: "text-red-400" };
    if (!key.key)
      return { text: "Value not cached — paste it in", tone: "text-amber-400" };
    return { text: "Ready to use", tone: "text-emerald-400" };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8"
    >
      {/* LEFT PANE — Documentation */}
      <div className="scrollbar-custom max-h-[75vh] space-y-4 overflow-y-auto pr-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-white">
              {doc.title || apiName || endpoint}
            </h2>
            <span className="rounded-xl bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-400">
              {docMethod}
            </span>
          </div>
          {doc.description && (
            <p className="mt-1.5 text-sm text-zinc-400">{doc.description}</p>
          )}
        </div>

        <Card className="border-slate-800 bg-slate-900/50 shadow-none backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Terminal className="h-4 w-4 text-emerald-400" />
              Example Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {legacyRequestMeta.pathParams.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Path Params
                </p>
                <KeyValueTable rows={legacyRequestMeta.pathParams} />
              </div>
            )}

            {legacyRequestMeta.queryParams.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Query Params
                </p>
                <KeyValueTable rows={legacyRequestMeta.queryParams} />
              </div>
            )}

            {legacyRequestMeta.headers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Headers
                </p>
                <KeyValueTable rows={legacyRequestMeta.headers} />
              </div>
            )}

            <CurlConsole
              lines={exampleCurl.lines}
              plainText={exampleCurl.plainText}
              footnote="purpose and consent are included automatically with every request."
            />
          </CardContent>
        </Card>

        {responseEntries.map(([key, value]) => {
          const isSuccessLike =
            key.toLowerCase().includes("success") ||
            key.toLowerCase().includes("2");
          return (
            <Card
              key={key}
              className="border-slate-800 bg-slate-900/50 shadow-none backdrop-blur-xl"
            >
              <CardHeader className="pb-2">
                <CardTitle
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium capitalize",
                    isSuccessLike ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {isSuccessLike ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {key.replace(/_/g, " ")} Response
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {value?.status_code && (
                  <span
                    className={cn(
                      "inline-block rounded-xl px-2.5 py-1 font-mono text-[11px] font-semibold",
                      isSuccessLike
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400",
                    )}
                  >
                    {value.status_code}
                  </span>
                )}
                {value?.description && (
                  <p className="text-sm text-zinc-400">{value.description}</p>
                )}
                {value?.example && (
                  <JsonViewer
                    data={value.example}
                    label={`${key} response`}
                    tone={isSuccessLike ? "text-zinc-300" : "text-red-200"}
                  />
                )}
                {/* If this response entry isn't the {status_code, example} shape
                    we expect, show it raw so nothing is ever hidden. */}
                {value?.example === undefined &&
                  value?.status_code === undefined &&
                  value?.description === undefined && (
                    <JsonViewer data={value} label={key} />
                  )}
              </CardContent>
            </Card>
          );
        })}
        {/* Response Status Codes Legend */}
        <Card className="border-slate-800 bg-slate-900/50 shadow-none backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Info className="h-4 w-4 text-emerald-400" />
              Response Status Codes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {/* 200 - Success */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                  200
                </span>
                <span className="text-sm font-semibold text-white">
                  Success
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                  <IndianRupee className="h-3 w-3" />
                  Charged
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                The request was processed successfully, and the applicable fee
                was deducted from your wallet balance.
              </p>
            </div>

            {/* 400 - Bad Request */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-mono text-xs font-bold text-amber-400">
                  400
                </span>
                <span className="text-sm font-semibold text-white">
                  Bad Request
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  No Charge
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                The server could not process the request due to malformed syntax
                or missing required parameters.
              </p>
            </div>

            {/* 401 - Unauthorized */}
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-orange-500/20 px-2.5 py-1 font-mono text-xs font-bold text-orange-400">
                  401
                </span>
                <span className="text-sm font-semibold text-white">
                  Unauthorized
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  No Charge
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                Authentication failed. The request is missing a valid API key or
                the provided key is invalid.
              </p>
            </div>

            {/* 402 - Payment Required */}
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-yellow-500/20 px-2.5 py-1 font-mono text-xs font-bold text-yellow-400">
                  402
                </span>
                <span className="text-sm font-semibold text-white">
                  Payment Required
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  No Charge
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                Insufficient wallet balance. Please recharge your account to
                access this endpoint.
              </p>
            </div>

            {/* 500 - Server Error */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-red-500/20 px-2.5 py-1 font-mono text-xs font-bold text-red-400">
                  500
                </span>
                <span className="text-sm font-semibold text-white">
                  Server Error
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  No Charge
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                An internal server error occurred. It is safe to retry the
                request after a short delay.
              </p>
            </div>
          </CardContent>
        </Card>
        {doc.errors && doc.errors.length > 0 && (
          <Card className="border-slate-800 bg-slate-900/50 shadow-none backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-300">
                <AlertTriangle className="h-4 w-4" />
                Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {doc.errors.map(
                (err: { code: number; message: string }, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className="rounded-xl bg-red-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-red-400">
                      {err.code}
                    </span>
                    <span className="text-zinc-400">{err.message}</span>
                  </div>
                ),
              )}
            </CardContent>
          </Card>
        )}

        {/* Catch-all: any field your JSON adds later that this component
            doesn't have dedicated UI for yet still shows up here instead
            of silently disappearing. */}
        {extraFields.length > 0 && (
          <Card className="border-slate-800 bg-slate-900/50 shadow-none backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Info className="h-4 w-4 text-emerald-400" />
                Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {extraFields.map(([key, value]) => (
                <div key={key}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {key.replace(/_/g, " ")}
                  </p>
                  {typeof value === "string" ||
                  typeof value === "number" ||
                  typeof value === "boolean" ? (
                    <p className="text-sm text-zinc-300">{String(value)}</p>
                  ) : (
                    <JsonViewer data={value} label={key} maxHeight="12rem" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {doc.notes && (
          <p className="border-t border-slate-800 pt-3 text-xs text-zinc-500">
            {doc.notes}
          </p>
        )}
      </div>

      {/* RIGHT PANE — API Console */}
      <div className="scrollbar-custom max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Test Console</h3>
          <span className="rounded-xl bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-400">
            {docMethod}
          </span>
        </div>

        {/* Environment / key selection — must be chosen before Send unlocks */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Environment
            </label>
            <button
              onClick={loadApiKeys}
              disabled={isKeysLoading}
              className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-slate-800 hover:text-emerald-400 disabled:opacity-50"
              title="Refresh keys"
              aria-label="Refresh keys"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isKeysLoading && "animate-spin")}
              />
            </button>
          </div>

          <Select value={selectedKeyType} onValueChange={handleSelectKeyType}>
            <SelectTrigger className="w-full border-slate-700 bg-slate-900 text-slate-300">
              <SelectValue placeholder="Select an API key" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900">
              <SelectItem
                value="DEVELOPMENT"
                className="text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400"
              >
                <span className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-cyan-400" />
                  Development key
                </span>
              </SelectItem>
              <SelectItem
                value="PRODUCTION"
                className="text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400"
              >
                <span className="flex items-center gap-2">
                  <Rocket className="h-3.5 w-3.5 text-violet-400" />
                  Production key
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {isKeysLoading && (
            <p className="text-[11px] text-zinc-500">Loading your keys…</p>
          )}
          {!isKeysLoading && keysError && (
            <p className="text-[11px] text-red-400">{keysError}</p>
          )}
          {!isKeysLoading && !keysError && selectedKeyType && (
            <p
              className={cn(
                "flex items-center gap-1 text-[11px]",
                keyStatusLabel(selectedMatchedKey).tone,
              )}
            >
              {selectedMatchedKey?.key ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {keyStatusLabel(selectedMatchedKey).text}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Request Body (JSON)
            </label>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-[11px]",
                  bodyValidity.valid ? "text-emerald-400" : "text-red-400",
                )}
              >
                {bodyValidity.message}
              </span>
              <button
                onClick={handleFormatBody}
                disabled={!bodyValidity.valid}
                className="text-[11px] text-zinc-500 underline decoration-dotted transition-colors hover:text-emerald-400 disabled:pointer-events-none disabled:opacity-40"
              >
                Format
              </button>
            </div>
          </div>
          <textarea
            value={editableBody}
            onChange={(e) => setEditableBody(e.target.value)}
            rows={10}
            className={cn(
              "scrollbar-custom w-full resize-y rounded-xl border bg-slate-950 p-3 font-mono text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors",
              bodyValidity.valid
                ? "border-slate-700 focus:border-emerald-500/60"
                : "border-red-500/50 focus:border-red-500/70",
            )}
            placeholder='{"key": "value"}'
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={
            isSending ||
            !selectedKeyType ||
            !resolvedKeyValue ||
            !bodyValidity.valid
          }
          className="w-full rounded-xl border-emerald-500/80 bg-emerald-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.18)] transition-colors hover:border-emerald-500 hover:bg-emerald-500 hover:text-white disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send Request
        </Button>
        {(!selectedKeyType || !resolvedKeyValue) && (
          <p className="-mt-2 text-center text-[11px] text-zinc-500">
            Select an environment with a valid key to enable sending.
          </p>
        )}

        {responseText && (
          <div ref={responseRef}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Response
              </p>
              {responseStatus && (
                <span
                  className={cn(
                    "rounded-xl px-2.5 py-1 font-mono text-[10px] font-semibold",
                    responseStatus === "success"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400",
                  )}
                >
                  {responseStatus === "success" ? "SUCCESS" : "ERROR"}
                  {responseStatusCode ? ` · ${responseStatusCode}` : ""}
                </span>
              )}
            </div>
            <JsonViewer
              data={responseText}
              label="Live Response"
              maxHeight="min(28rem, 55vh)"
              tone={
                responseStatus === "error" ? "text-red-200" : "text-zinc-300"
              }
              alwaysShowExpand
            />
          </div>
        )}
      </div>

      {/* Manual key entry — shown when a matched key's value wasn't
          returned by the list endpoint. */}
      <Dialog
        open={showManualKeyDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowManualKeyDialog(false);
          }
        }}
      >
        <DialogContent className="rounded-xl border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              Enter{" "}
              {selectedKeyType === "DEVELOPMENT"
                ? "Development"
                : "Production"}{" "}
              Key
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              This key is active but its value isn&apos;t cached here. Paste it
              below — you can copy it from the Manage API Keys page.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={manualKeyValue}
              onChange={(e) => setManualKeyValue(e.target.value)}
              placeholder="Paste your API key"
              className="rounded-xl border-slate-700 bg-slate-950/60 font-mono text-sm text-white placeholder:text-zinc-600"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="w-auto rounded-xl border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white"
              onClick={() => {
                setShowManualKeyDialog(false);
                setManualKeyValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="w-auto rounded-xl"
              disabled={!manualKeyValue.trim()}
              onClick={() => {
                setResolvedKeyValue(manualKeyValue.trim());
                setShowManualKeyDialog(false);
              }}
            >
              Save &amp; Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
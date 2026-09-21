"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileJson,
  FlaskConical,
  IndianRupee,
  Info,
  KeyRound,
  Loader2,
  Maximize2,
  RefreshCw,
  Rocket,
  Send,
  Terminal,
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
import { get } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type KeyType = "DEVELOPMENT" | "PRODUCTION";
type ApiKeyStatus = "ACTIVE" | "INACTIVE" | "REVOKED";
type KeyValueRow = [string, string];

interface ApiKey {
  id: string;
  type: KeyType;
  key?: string;
  status: ApiKeyStatus;
  createdAt: string;
}

interface ApiResponseEnvelope<T> {
  responseStatus: { status: boolean; statusCode: number; message: string };
  responseData: T;
}

interface ConsoleResponse {
  text: string;
  status: "success" | "error";
  code: number | null;
}

interface ParsedCurl {
  method: string;
  headers: KeyValueRow[];
  bodyText: string | null;
}

interface CurlLine {
  text: string;
  // flag: curl syntax, json: request body, fixed: dimmed compliance field.
  variant: "flag" | "json" | "fixed";
}

interface DocRequest {
  method?: string;
  body?: Record<string, unknown>;
  headers?: unknown;
  query_params?: unknown;
  queryParams?: unknown;
  path_params?: unknown;
  pathParams?: unknown;
}

interface ResponseExample {
  status_code?: number | string;
  description?: string;
  example?: unknown;
}

// Local view of the documentation JSON. Unknown top-level fields are kept
// (index signature) so they can be rendered under "Additional Details".
interface ApiDoc {
  title?: string;
  description?: string;
  notes?: string;
  endpoint?: string;
  request_curl?: string;
  request?: DocRequest;
  response?: Record<string, ResponseExample | null>;
  errors?: Array<{ code: number; message: string }>;
  [key: string]: unknown;
}

interface ViewDocumentationProps {
  endpoint: string;
  apiName?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_DOMAIN = "https://api.scaninfoga.com";
const API_KEYS_ENDPOINT = "/api/v1/user/commercial/api-keys";
const REQUEST_TIMEOUT_MS = 30_000;

// Shared with the navbar, which writes the choice and dispatches the event.
const ENV_STORAGE_KEY = "environment";
const ENV_CHANGE_EVENT = "environment-changed";

// Attached to every request for compliance; never editable by the user.
const FIXED_FIELD_KEYS = new Set(["purpose", "consent"]);

// Top-level doc fields with dedicated UI. Everything else is listed under
// "Additional Details" so nothing is silently dropped.
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

const DEFAULT_CURL_HEADERS: KeyValueRow[] = [
  ["Content-Type", "application/json"],
  ["api-key", "YOUR_API_KEY"],
];

const CARD_CLASS =
  "border-slate-800 bg-slate-900/50 shadow-none backdrop-blur-xl";

const STATUS_CODES = [
  {
    code: 200,
    title: "Success",
    charged: true,
    card: "border-emerald-500/30 bg-emerald-500/5",
    badge: "bg-emerald-500/20 text-emerald-400",
    desc: "The request was processed successfully, and the applicable fee was deducted from your wallet balance.",
  },
  {
    code: 400,
    title: "Bad Request",
    charged: false,
    card: "border-amber-500/30 bg-amber-500/5",
    badge: "bg-amber-500/20 text-amber-400",
    desc: "The server could not process the request due to malformed syntax or missing required parameters.",
  },
  {
    code: 401,
    title: "Unauthorized",
    charged: false,
    card: "border-orange-500/30 bg-orange-500/5",
    badge: "bg-orange-500/20 text-orange-400",
    desc: "Authentication failed. The request is missing a valid API key or the provided key is invalid.",
  },
  {
    code: 404,
    title: "Not Found",
    charged: true,
    card: "border-rose-500/30 bg-rose-500/5",
    badge: "bg-rose-500/20 text-rose-400",
    desc: "The requested resource could not be found. Please verify the endpoint, identifier, or reference number and try again.",
  },
  {
    code: 500,
    title: "Server Error",
    charged: false,
    card: "border-red-500/30 bg-red-500/5",
    badge: "bg-red-500/20 text-red-400",
    desc: "An internal server error occurred. It is safe to retry the request after a short delay.",
  },
] as const;

const ENV_OPTIONS = [
  {
    value: "DEVELOPMENT",
    label: "Development key",
    Icon: FlaskConical,
    iconClass: "text-cyan-400",
  },
  {
    value: "PRODUCTION",
    label: "Production key",
    Icon: Rocket,
    iconClass: "text-violet-400",
  },
] as const;

// ─── Generic helpers ─────────────────────────────────────────────────────────

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonObject = (
  text?: string | null,
): Record<string, unknown> | null => {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const formatBody = (body: Record<string, unknown>): string =>
  Object.keys(body).length > 0 ? JSON.stringify(body, null, 2) : "{}";

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

const isSuccessKey = (key: string): boolean =>
  /success|(^|\D)2(\d\d|xx)(\D|$)/i.test(key);

const normalizeKeyValueList = (input: unknown): KeyValueRow[] => {
  if (Array.isArray(input)) {
    return input
      .map((entry): KeyValueRow => {
        const item = isPlainObject(entry) ? entry : {};
        return [
          String(item.key ?? item.name ?? ""),
          String(item.value ?? item.description ?? ""),
        ];
      })
      .filter(([key]) => key.length > 0);
  }
  if (isPlainObject(input)) {
    return Object.entries(input).map(([k, v]): KeyValueRow => [k, String(v)]);
  }
  return [];
};

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

const readSavedEnvironment = (): string | null => {
  try {
    return localStorage.getItem(ENV_STORAGE_KEY);
  } catch {
    return null;
  }
};

// ─── API key helpers ─────────────────────────────────────────────────────────

const isKeyType = (value: unknown): value is KeyType =>
  value === "DEVELOPMENT" || value === "PRODUCTION";

const isMaskedKey = (key?: string | null): boolean =>
  !!key && key.includes("*");

const maskKey = (key?: string | null): string => {
  const trimmed = key?.trim();
  if (!trimmed) return "";
  // Keep keys the backend already masked to avoid double-masking.
  if (trimmed.includes("*")) return trimmed;
  return `****${trimmed.slice(-4)}`;
};

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

const normalizeStatus = (value: unknown): ApiKeyStatus => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return normalized === "ACTIVE" || normalized === "REVOKED"
    ? normalized
    : "INACTIVE";
};

const normalizeEnvironment = (value: unknown): KeyType =>
  String(value ?? "")
    .trim()
    .toUpperCase() === "PRODUCTION"
    ? "PRODUCTION"
    : "DEVELOPMENT";

const normalizeKeyItem = (item: unknown): ApiKey | null => {
  if (!isPlainObject(item)) return null;
  const id = item.id ?? item.api_key_id;
  if (!id) return null;
  return {
    id: String(id),
    type: normalizeEnvironment(item.type ?? item.environment),
    key: asOptionalString(item.key) ?? asOptionalString(item.api_key),
    status: normalizeStatus(item.status ?? item.state),
    createdAt: String(
      item.createdAt ?? item.created_at ?? new Date().toISOString(),
    ),
  };
};

const extractApiKeyList = (payload: unknown): ApiKey[] => {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (isPlainObject(payload)) {
    if (Array.isArray(payload.keys)) list = payload.keys;
    else if (Array.isArray(payload.data)) list = payload.data;
  }
  return list.map(normalizeKeyItem).filter((k): k is ApiKey => k !== null);
};

async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await get<ApiResponseEnvelope<unknown>>(API_KEYS_ENDPOINT);
  return extractApiKeyList(response.responseData);
}

// Newest active key of the given type, if any.
const findActiveKey = (keys: ApiKey[], keyType: KeyType): ApiKey | null => {
  const matches = keys.filter(
    (k) => k.type === keyType && k.status === "ACTIVE",
  );
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
};

const getKeyStatus = (key: ApiKey | null, isReady: boolean) => {
  if (!key) return { text: "No active key found", tone: "text-red-400" };
  if (!isReady) {
    return { text: "Value not cached — paste it in", tone: "text-amber-400" };
  }
  return { text: "Ready to use", tone: "text-emerald-400" };
};

// ─── cURL and JSON rendering helpers ─────────────────────────────────────────

const parseCurl = (curl?: string | null): ParsedCurl => {
  if (!curl) return { method: "POST", headers: [], bodyText: null };

  const headers: KeyValueRow[] = [];
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

// Escapes single quotes so the copied command works in a POSIX shell.
const shellEscape = (value: string): string => value.replace(/'/g, "'\\''");

// Escapes HTML first, so the result is safe for dangerouslySetInnerHTML.
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

const buildCurlDisplay = (
  url: string,
  headers: KeyValueRow[],
  bodyObj: Record<string, unknown> | null,
): { lines: CurlLine[]; plainText: string } => {
  const lines: CurlLine[] = [];
  const bodyJson =
    bodyObj && Object.keys(bodyObj).length > 0
      ? JSON.stringify(bodyObj, null, 2)
      : null;

  lines.push({
    text: `curl --location '${shellEscape(url)}' \\`,
    variant: "flag",
  });

  headers.forEach(([key, value]) => {
    lines.push({
      text: `  --header '${shellEscape(`${key}: ${value}`)}' \\`,
      variant: "flag",
    });
  });

  if (bodyJson) {
    const bodyLines = bodyJson.split("\n");
    bodyLines.forEach((line, idx) => {
      const isFixed = /^\s*"(purpose|consent)"\s*:/i.test(line);
      const prefix = idx === 0 ? "  --data '" : "  ";
      const suffix = idx === bodyLines.length - 1 ? "'" : "";
      lines.push({
        text: `${prefix}${shellEscape(line)}${suffix}`,
        variant: isFixed ? "fixed" : "json",
      });
    });
  } else {
    // No body: drop the trailing line continuation.
    const last = lines[lines.length - 1];
    if (last.text.endsWith(" \\")) last.text = last.text.slice(0, -2);
  }

  return { lines, plainText: lines.map((l) => l.text).join("\n") };
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCopy(successMessage = "Copied to clipboard") {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(successMessage);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Failed to copy");
      }
    },
    [successMessage],
  );

  return { copied, copy };
}

// ─── Presentational components ───────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="rounded-xl bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-400">
      {method}
    </span>
  );
}

function JsonViewer({
  data,
  label = "JSON",
  maxHeight = "18rem",
  tone = "text-zinc-300",
  alwaysShowExpand = false,
}: {
  data: unknown;
  label?: string;
  maxHeight?: string;
  tone?: string;
  alwaysShowExpand?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { copied, copy } = useCopy();

  const json = useMemo(() => {
    try {
      return typeof data === "string" ? data : JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const html = useMemo(() => highlightJson(json), [json]);

  const lineCount = json.split("\n").length;
  const showExpandButton = alwaysShowExpand || lineCount > 14;

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
              onClick={() => copy(json)}
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
          style={{ maxHeight }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-h-[88vh] overflow-hidden rounded-2xl border-slate-800 bg-slate-900 p-0 sm:max-w-4xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-zinc-500">{lineCount} lines</p>
            </div>
            <button
              onClick={() => copy(json)}
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
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

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
  const { copied, copy } = useCopy("cURL copied to clipboard");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Terminal className="h-3 w-3" />
          {label}
        </span>
        <button
          onClick={() => copy(plainText)}
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

function KeyValueTable({ rows }: { rows: KeyValueRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      {rows.map(([key, value], idx) => (
        <div
          key={`${key}-${idx}`}
          className="flex items-center justify-between gap-3 border-b border-slate-800/60 bg-slate-950/40 px-3 py-1.5 text-xs last:border-b-0"
        >
          <span className="shrink-0 font-mono text-emerald-400">{key}</span>
          <span className="truncate text-right text-zinc-400">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ViewDocumentation({
  endpoint,
  apiName,
}: ViewDocumentationProps) {
  const doc = useMemo(
    () => (getApiDocumentation(endpoint) ?? null) as unknown as ApiDoc | null,
    [endpoint],
  );

  const requestInfo = useMemo(() => {
    const request = doc?.request;
    const curl = parseCurl(doc?.request_curl);
    const legacyBody = request?.body;
    const body =
      parseJsonObject(curl.bodyText) ??
      (isPlainObject(legacyBody) ? legacyBody : null);
    const { editable, fixed } = splitFixedFields(body);

    return {
      curl,
      body,
      editable,
      fixed,
      method: (request?.method || curl.method || "POST").toUpperCase(),
      meta: {
        headers: normalizeKeyValueList(request?.headers),
        queryParams: normalizeKeyValueList(
          request?.query_params ?? request?.queryParams,
        ),
        pathParams: normalizeKeyValueList(
          request?.path_params ?? request?.pathParams,
        ),
      },
    };
  }, [doc]);

  const endpointPath = doc?.endpoint || endpoint;
  const docsUrl = `${BASE_DOMAIN}${endpointPath}`;
  const sendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || BASE_DOMAIN}${endpointPath}`;

  const [editableBody, setEditableBody] = useState(() =>
    formatBody(requestInfo.editable),
  );
  const [response, setResponse] = useState<ConsoleResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const responseRef = useRef<HTMLDivElement | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isKeysLoading, setIsKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);

  const [selectedKeyType, setSelectedKeyType] = useState<KeyType | "">("");
  const [resolvedKeyValue, setResolvedKeyValue] = useState<string | null>(null);

  // Opens when the selected key's value isn't available from the list API.
  const [showManualKeyDialog, setShowManualKeyDialog] = useState(false);
  const [manualKeyValue, setManualKeyValue] = useState("");

  // Reset the editor and last response when the documented endpoint changes.
  useEffect(() => {
    setEditableBody(formatBody(requestInfo.editable));
    setResponse(null);
  }, [requestInfo]);

  useEffect(() => {
    if (response) {
      responseRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [response]);

  const bodyValidity = useMemo(() => {
    if (!editableBody.trim()) return { valid: true, message: "Empty body" };
    try {
      const parsed: unknown = JSON.parse(editableBody);
      return isPlainObject(parsed)
        ? { valid: true, message: "Valid JSON" }
        : { valid: false, message: "Body must be a JSON object" };
    } catch (err: unknown) {
      return { valid: false, message: getErrorMessage(err, "Invalid JSON") };
    }
  }, [editableBody]);

  const handleFormatBody = () => {
    const parsed = parseJsonObject(editableBody);
    if (!parsed) {
      toast.error("Can't format — fix the JSON syntax first");
      return;
    }
    setEditableBody(formatBody(parsed));
  };

  const loadApiKeys = useCallback(async () => {
    setIsKeysLoading(true);
    setKeysError(null);
    try {
      setApiKeys(await fetchApiKeys());
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load API keys");
      setKeysError(message);
      toast.error(message);
    } finally {
      setIsKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  const selectedMatchedKey = useMemo(
    () => (selectedKeyType ? findActiveKey(apiKeys, selectedKeyType) : null),
    [apiKeys, selectedKeyType],
  );

  // Uses the cached key when it is a real value; otherwise asks the user to
  // paste it. Send stays disabled until a usable key value is resolved.
  const handleSelectKeyType = useCallback(
    (value: string) => {
      if (!isKeyType(value)) return;

      setSelectedKeyType(value);
      setResolvedKeyValue(null);
      setManualKeyValue("");

      const matched = findActiveKey(apiKeys, value);
      if (!matched) return;

      if (matched.key && !isMaskedKey(matched.key)) {
        setResolvedKeyValue(matched.key);
      } else {
        setShowManualKeyDialog(true);
      }
    },
    [apiKeys],
  );

  // Pick up the environment stored by the navbar once keys have loaded.
  useEffect(() => {
    if (isKeysLoading || apiKeys.length === 0 || selectedKeyType) return;
    const savedEnv = readSavedEnvironment();
    if (savedEnv) handleSelectKeyType(savedEnv);
  }, [isKeysLoading, apiKeys, selectedKeyType, handleSelectKeyType]);

  // Follow live environment changes made in the navbar.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isKeyType(detail) && apiKeys.length > 0) handleSelectKeyType(detail);
    };
    window.addEventListener(ENV_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ENV_CHANGE_EVENT, handler);
  }, [apiKeys, handleSelectKeyType]);

  const exampleCurl = useMemo(
    () =>
      buildCurlDisplay(
        docsUrl,
        requestInfo.curl.headers.length > 0
          ? requestInfo.curl.headers
          : DEFAULT_CURL_HEADERS,
        requestInfo.body,
      ),
    [docsUrl, requestInfo],
  );

  const handleSend = async () => {
    if (!selectedKeyType) {
      toast.error("Choose an environment before sending a request");
      return;
    }
    if (!resolvedKeyValue) {
      toast.error("Add your API key to continue");
      return;
    }

    const editable = editableBody.trim() ? parseJsonObject(editableBody) : {};
    if (!editable) {
      toast.error("Request body must be a valid JSON object");
      return;
    }

    const payload = { ...editable, ...requestInfo.fixed };
    const sendsBody =
      requestInfo.method !== "GET" && requestInfo.method !== "HEAD";

    setIsSending(true);
    setResponse(null);

    try {
      const result = await axios.request({
        url: sendUrl,
        method: requestInfo.method,
        headers: {
          "Content-Type": "application/json",
          "api-key": resolvedKeyValue,
        },
        timeout: REQUEST_TIMEOUT_MS,
        ...(sendsBody ? { data: payload } : { params: payload }),
      });

      setResponse({
        text: JSON.stringify(result.data, null, 2),
        status: "success",
        code: result.status,
      });
      toast.success("API call successful");
    } catch (error: unknown) {
      const message = getErrorMessage(error, "API call failed");
      const isAxiosErr = axios.isAxiosError(error);

      setResponse({
        text: JSON.stringify(
          (isAxiosErr ? error.response?.data : undefined) ?? { error: message },
          null,
          2,
        ),
        status: "error",
        code: isAxiosErr ? (error.response?.status ?? null) : null,
      });
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

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

  const requestMetaSections = [
    { title: "Path Params", rows: requestInfo.meta.pathParams },
    { title: "Query Params", rows: requestInfo.meta.queryParams },
    { title: "Headers", rows: requestInfo.meta.headers },
  ].filter(({ rows }) => rows.length > 0);

  const responseEntries = (
    doc.response && typeof doc.response === "object"
      ? Object.entries(doc.response)
      : []
  ).filter((entry): entry is [string, ResponseExample] => entry[1] != null);

  const extraFields = Object.entries(doc).filter(
    ([key, value]) =>
      !KNOWN_DOC_FIELDS.has(key) && value !== undefined && value !== null,
  );

  const keyStatus = getKeyStatus(selectedMatchedKey, !!resolvedKeyValue);
  const isSendReady = !!selectedKeyType && !!resolvedKeyValue;
  const canSend = isSendReady && !isSending && bodyValidity.valid;

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
            <MethodBadge method={requestInfo.method} />
          </div>
          {doc.description && (
            <p className="mt-1.5 text-sm text-zinc-400">{doc.description}</p>
          )}
        </div>

        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Terminal className="h-4 w-4 text-emerald-400" />
              Example Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requestMetaSections.map(({ title, rows }) => (
              <div key={title} className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {title}
                </p>
                <KeyValueTable rows={rows} />
              </div>
            ))}

            <CurlConsole
              lines={exampleCurl.lines}
              plainText={exampleCurl.plainText}
              footnote="purpose and consent are included automatically with every request."
            />
          </CardContent>
        </Card>

        {responseEntries.map(([key, value]) => {
          const isSuccessLike = isSuccessKey(key);
          return (
            <Card key={key} className={CARD_CLASS}>
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
                {!!value.status_code && (
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
                {value.description && (
                  <p className="text-sm text-zinc-400">{value.description}</p>
                )}
                {value.example != null && (
                  <JsonViewer
                    data={value.example}
                    label={`${key} response`}
                    tone={isSuccessLike ? "text-zinc-300" : "text-red-200"}
                  />
                )}
                {/* Unexpected shape: show it raw so nothing is hidden. */}
                {value.example === undefined &&
                  value.status_code === undefined &&
                  value.description === undefined && (
                    <JsonViewer data={value} label={key} />
                  )}
              </CardContent>
            </Card>
          );
        })}

        <Card className={CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Info className="h-4 w-4 text-emerald-400" />
              Response Status Codes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {STATUS_CODES.map(({ code, title, charged, card, badge, desc }) => (
              <div key={code} className={cn("rounded-xl border p-3", card)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-mono text-xs font-bold",
                      badge,
                    )}
                  >
                    {code}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {title}
                  </span>
                  {charged ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                      <IndianRupee className="h-3 w-3" /> Charged
                    </span>
                  ) : (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> No Charge
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">{desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {doc.errors && doc.errors.length > 0 && (
          <Card className={CARD_CLASS}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-300">
                <AlertTriangle className="h-4 w-4" />
                Errors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {doc.errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="rounded-xl bg-red-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-red-400">
                    {err.code}
                  </span>
                  <span className="text-zinc-400">{err.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {extraFields.length > 0 && (
          <Card className={CARD_CLASS}>
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

      {/* RIGHT PANE — Test Console */}
      <div className="scrollbar-custom max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Test Console</h3>
          <MethodBadge method={requestInfo.method} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="environment-select"
              className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
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
            <SelectTrigger
              id="environment-select"
              className="w-full border-slate-700 bg-slate-900 text-slate-300"
            >
              <SelectValue placeholder="Select an API key" />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900">
              {ENV_OPTIONS.map(({ value, label, Icon, iconClass }) => {
                const masked = maskKey(findActiveKey(apiKeys, value)?.key);
                return (
                  <SelectItem
                    key={value}
                    value={value}
                    className="text-slate-300 focus:bg-emerald-500/10 focus:text-emerald-400"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-3.5 w-3.5", iconClass)} />
                      {label}
                      {masked && (
                        <span className="ml-1 font-mono text-[11px] text-zinc-500">
                          {masked}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
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
                keyStatus.tone,
              )}
            >
              {resolvedKeyValue ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {keyStatus.text}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              htmlFor="request-body"
              className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
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
            id="request-body"
            value={editableBody}
            onChange={(e) => setEditableBody(e.target.value)}
            rows={10}
            spellCheck={false}
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
          disabled={!canSend}
          className="w-full rounded-xl border-emerald-500/80 bg-emerald-600 text-white shadow-[0_10px_25px_rgba(16,185,129,0.18)] transition-colors hover:border-emerald-500 hover:bg-emerald-500 hover:text-white disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send Request
        </Button>
        {!isSendReady && (
          <p className="-mt-2 text-center text-[11px] text-zinc-500">
            Select an environment with a valid key to enable sending.
          </p>
        )}

        {response && (
          <div ref={responseRef}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Response
              </p>
              <span
                className={cn(
                  "rounded-xl px-2.5 py-1 font-mono text-[10px] font-semibold",
                  response.status === "success"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400",
                )}
              >
                {response.status === "success" ? "SUCCESS" : "ERROR"}
                {response.code ? ` · ${response.code}` : ""}
              </span>
            </div>
            <JsonViewer
              data={response.text}
              label="Live Response"
              maxHeight="min(28rem, 55vh)"
              tone={
                response.status === "error" ? "text-red-200" : "text-zinc-300"
              }
              alwaysShowExpand
            />
          </div>
        )}
      </div>

      {/* Manual key entry */}
      <Dialog open={showManualKeyDialog} onOpenChange={setShowManualKeyDialog}>
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
              type="password"
              autoComplete="off"
              spellCheck={false}
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

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Check,
  KeyRound,
  Plus,
  Trash2,
  Power,
  Eye,
  EyeOff,
  Copy,
  Loader2,
  Zap,
  FlaskConical,
  Rocket,
  Layers,
  Search,
  SearchX,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { get, post } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { PageShell } from "@/components/custom/page-shell";

// ─── Local Types ──────────────────────────────────────────────────────────────
type ApiKeyEnvironment = "DEVELOPMENT" | "PRODUCTION";
type ApiKeyStatus = "ACTIVE" | "INACTIVE" | "REVOKED";
type ApiKeyAction = "activate" | "deactivate";

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

// ─── Local API Helpers ────────────────────────────────────────────────────────
const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const message = (err as any)?.response?.data?.responseStatus?.message;
  return typeof message === "string" && message.trim().length > 0
    ? message
    : fallback;
};

const normalizeStatus = (value: unknown): ApiKeyStatus => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "ACTIVE" || normalized === "REVOKED")
    return normalized as ApiKeyStatus;
  return "INACTIVE";
};

const normalizeEnvironment = (value: unknown): ApiKeyEnvironment =>
  String(value ?? "")
    .trim()
    .toUpperCase() === "PRODUCTION"
    ? "PRODUCTION"
    : "DEVELOPMENT";

const normalizeKeyItem = (item: any): ApiKey | null => {
  if (!item || typeof item !== "object") return null;

  const id = item.id ?? item.api_key_id;
  if (!id) {
    console.warn(
      "[manage_api_keys] Skipping API key with no id in response:",
      item,
    );
    return null; // Safe drop instead of fake crypto.randomUUID()
  }

  return {
    id: String(id),
    type: normalizeEnvironment(item.type ?? item.environment),
    key: item.key ?? item.api_key ?? undefined,
    status: normalizeStatus(item.status ?? item.state),
    createdAt: String(
      item.createdAt ?? item.created_at ?? new Date().toISOString(),
    ),
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

// API Call Functions
async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await get<ApiResponseEnvelope<any>>(
    "/api/v1/user/commercial/api-keys",
  );
  return extractApiKeyList(response.responseData);
}

async function createApiKeyApi(
  type: ApiKeyEnvironment,
): Promise<ApiKey | null> {
  const response = await post<ApiResponseEnvelope<any>>(
    "/api/v1/user/commercial/create-api-key",
    { type },
  );
  return normalizeKeyItem(response.responseData);
}

async function deleteApiKeyApi(id: string): Promise<void> {
  await post("/api/v1/user/commercial/delete-api-key", { id });
}

async function updateApiKeyStatusApi(
  id: string,
  action: ApiKeyAction,
): Promise<void> {
  await post("/api/v1/user/commercial/update-api-key-status", { id, action });
}

// ─── UI Constants & Helpers ───────────────────────────────────────────────────
type CreateKeyType = "DEVELOPMENT" | "PRODUCTION";
type TypeFilter = "ALL" | CreateKeyType;
type SortOrder = "newest" | "oldest";

const DELETE_CONFIRM_WORD = "DELETE";

const maskKey = (key: string) => {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 8)} ${"•".repeat(6)} ${key.slice(-4)}`;
};

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

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageApisPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<CreateKeyType>("DEVELOPMENT");
  const [isCreating, setIsCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [statusActionTarget, setStatusActionTarget] = useState<{
    key: ApiKey;
    action: "activate" | "deactivate";
  } | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revealedKeyIds, setRevealedKeyIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const loadApiKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (err: any) {
      const message = getApiErrorMessage(err, "Failed to load API keys");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    setDeleteConfirmText("");
  }, [deleteTarget]);

  const activeKeys = apiKeys.filter((key) => key.status === "ACTIVE").length;
  const devKeys = apiKeys.filter((key) => key.type === "DEVELOPMENT").length;
  const prodKeys = apiKeys.filter((key) => key.type === "PRODUCTION").length;

  const filteredKeys = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = apiKeys.filter((key) => {
      const matchesType = typeFilter === "ALL" || key.type === typeFilter;
      const matchesQuery =
        query.length === 0 ||
        key.id.toLowerCase().includes(query) ||
        key.type.toLowerCase().includes(query) ||
        key.status.toLowerCase().includes(query);
      return matchesType && matchesQuery;
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      const safeA = Number.isNaN(timeA) ? 0 : timeA;
      const safeB = Number.isNaN(timeB) ? 0 : timeB;
      return sortOrder === "newest" ? safeB - safeA : safeA - safeB;
    });
  }, [apiKeys, searchQuery, typeFilter, sortOrder]);

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
  };

  const handleCreateKey = async () => {
    setIsCreating(true);
    try {
      await createApiKeyApi(createType);
      toast.success("API key created successfully");
      setIsCreateOpen(false);
      loadApiKeys();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to create API key"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteApiKeyApi(deleteTarget.id);
      toast.success("API key deleted");
      setDeleteTarget(null);
      loadApiKeys();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to delete API key"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (key: ApiKey) => {
    const action = key.status === "ACTIVE" ? "deactivate" : "activate";
    setStatusActionTarget({ key, action });
  };

  const confirmStatusChange = async () => {
    if (!statusActionTarget) return;

    const { key, action } = statusActionTarget;
    setStatusUpdatingId(key.id);

    try {
      await updateApiKeyStatusApi(key.id, action);
      toast.success(
        `API key ${action === "activate" ? "enabled" : "disabled"}`,
      );
      setStatusActionTarget(null);
      loadApiKeys();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleCopyKey = async (key: ApiKey) => {
    if (!key.key) return;
    try {
      await navigator.clipboard.writeText(key.key);
      setCopiedKeyId(key.id);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast.error("Failed to copy key");
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedKeyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const requiresTypedConfirm = deleteTarget?.type === "PRODUCTION";
  const canConfirmDelete =
    !requiresTypedConfirm ||
    deleteConfirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerMotion}
      className="space-y-5"
    >
      {/* Page header */}
      <motion.div
        variants={itemMotion}
        className="rounded-2xl border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.88))] p-5 shadow-[0_20px_60px_rgba(16,185,129,0.08)] sm:p-6"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <KeyRound className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/80">
                Commercial Portal
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Manage API Keys
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Create, monitor, and control access keys for your APIs.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="w-full rounded-xl sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create API Key
          </Button>
        </div>
      </motion.div>

      {/* Summary stats */}
      <motion.div
        variants={itemMotion}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {[
          { label: "Active", value: activeKeys, tone: "emerald", icon: Zap },
          {
            label: "Development",
            value: devKeys,
            tone: "cyan",
            icon: FlaskConical,
          },
          {
            label: "Production",
            value: prodKeys,
            tone: "violet",
            icon: Rocket,
          },
          {
            label: "Total Keys",
            value: apiKeys.length,
            tone: "zinc",
            icon: Layers,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/30"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{stat.label}</p>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  stat.tone === "emerald" &&
                    "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
                  stat.tone === "cyan" &&
                    "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
                  stat.tone === "violet" &&
                    "border-violet-500/20 bg-violet-500/10 text-violet-400",
                  stat.tone === "zinc" &&
                    "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
                )}
              >
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Keys table */}
      <motion.div variants={itemMotion}>
        <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-[0_20px_60px_rgba(15,23,42,0.5)]">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-medium text-white">
                  Your API Keys
                </CardTitle>
                <Badge className="border border-slate-700 bg-slate-800/70 text-zinc-300">
                  {filteredKeys.length} of {apiKeys.length}
                </Badge>
              </div>

              {apiKeys.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by key ID, type, or status"
                      aria-label="Search API keys"
                      className="rounded-xl border-slate-700 bg-slate-950/60 pl-9 text-white placeholder:text-zinc-500"
                    />
                  </div>

                  <Tabs
                    value={typeFilter}
                    onValueChange={(val) => setTypeFilter(val as TypeFilter)}
                  >
                    <TabsList className="grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-700 bg-slate-950/60 p-1 sm:w-auto">
                      <TabsTrigger
                        value="ALL"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        All
                      </TabsTrigger>
                      <TabsTrigger
                        value="DEVELOPMENT"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        Dev
                      </TabsTrigger>
                      <TabsTrigger
                        value="PRODUCTION"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        Prod
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 py-12 text-center text-red-300">
                <p>{error}</p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl border-red-500/30 text-red-300 hover:bg-red-500/10"
                  onClick={loadApiKeys}
                >
                  Try again
                </Button>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-14 text-center">
                <KeyRound className="mx-auto h-12 w-12 text-zinc-600" />
                <p className="mt-4 text-sm text-zinc-400">
                  No API keys found. Create your first key to get started.
                </p>
                <Button
                  variant="outline"
                  className="mt-5 rounded-xl"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" /> Create Key
                </Button>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-14 text-center">
                <SearchX className="mx-auto h-12 w-12 text-zinc-600" />
                <p className="mt-4 text-sm text-zinc-400">
                  No keys match your search or filter.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-slate-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-800">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-950/60">
                      <TableRow className="border-slate-800 hover:bg-slate-950/80">
                        <TableHead className="text-zinc-400">Type</TableHead>
                        <TableHead className="text-zinc-400">Key</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400">
                          <button
                            type="button"
                            onClick={() =>
                              setSortOrder((prev) =>
                                prev === "newest" ? "oldest" : "newest",
                              )
                            }
                            className="flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            aria-label="Toggle sort by created date"
                          >
                            Created
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                        <TableHead className="text-right text-zinc-400">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredKeys.map((key) => {
                        const isRevealed = revealedKeyIds.has(key.id);
                        return (
                          <TableRow
                            key={key.id}
                            className="border-slate-800 bg-slate-900/30 transition-colors hover:bg-slate-800/40"
                          >
                            <TableCell>
                              <div className="flex items-center gap-2 font-medium text-white">
                                {key.type === "PRODUCTION" ? (
                                  <Rocket className="h-3.5 w-3.5 text-violet-400" />
                                ) : (
                                  <FlaskConical className="h-3.5 w-3.5 text-cyan-400" />
                                )}
                                {key.type}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "max-w-[180px] truncate font-mono text-sm text-zinc-300 sm:max-w-none",
                                    isRevealed && "break-all whitespace-normal",
                                  )}
                                >
                                  {key.key
                                    ? isRevealed
                                      ? key.key
                                      : maskKey(key.key)
                                    : "••••••••"}
                                </span>
                                {key.key && (
                                  <>
                                    <button
                                      onClick={() => toggleReveal(key.id)}
                                      className="rounded-lg border border-slate-700 bg-slate-800/80 p-1 text-zinc-400 transition hover:border-emerald-500/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                      title={
                                        isRevealed ? "Hide key" : "Reveal key"
                                      }
                                      aria-label={
                                        isRevealed ? "Hide key" : "Reveal key"
                                      }
                                    >
                                      {isRevealed ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleCopyKey(key)}
                                      className="rounded-lg border border-slate-700 bg-slate-800/80 p-1 text-zinc-400 transition hover:border-emerald-500/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                      title="Copy key"
                                      aria-label="Copy key"
                                    >
                                      {copiedKeyId === key.id ? (
                                        <Check className="h-4 w-4 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  "border",
                                  key.status === "ACTIVE"
                                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                    : "border-red-500/20 bg-red-500/10 text-red-400",
                                )}
                              >
                                {key.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-zinc-400">
                              {formatDate(key.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-slate-800 hover:text-white"
                                  onClick={() => handleToggleStatus(key)}
                                  disabled={statusUpdatingId === key.id}
                                  title={
                                    key.status === "ACTIVE"
                                      ? "Disable"
                                      : "Enable"
                                  }
                                  aria-label={
                                    key.status === "ACTIVE"
                                      ? "Disable key"
                                      : "Enable key"
                                  }
                                >
                                  {statusUpdatingId === key.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Power className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                                  onClick={() => setDeleteTarget(key)}
                                  title="Delete"
                                  aria-label="Delete key"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create key dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-2xl border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Create New API Key</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Choose the environment for your new API key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Tabs
              value={createType}
              onValueChange={(val) => setCreateType(val as CreateKeyType)}
            >
              <TabsList className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-700 bg-slate-900 p-1">
                <TabsTrigger
                  value="DEVELOPMENT"
                  className="rounded-xl border border-transparent px-4 py-3 text-sm font-medium"
                >
                  Development
                </TabsTrigger>
                <TabsTrigger
                  value="PRODUCTION"
                  className="rounded-xl border border-transparent px-4 py-3 text-sm font-medium"
                >
                  Production
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3 text-sm text-zinc-400">
              {createType === "DEVELOPMENT"
                ? "For testing and development. Lower rate limits."
                : "For production use. Higher rate limits and monitoring."}
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={handleCreateKey}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete key dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-2xl border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete API Key</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this{" "}
              <span className="font-medium text-white">
                {deleteTarget?.type}
              </span>{" "}
              key? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {requiresTypedConfirm && (
            <div className="space-y-2 pb-2">
              <label
                htmlFor="delete-confirm"
                className="text-zinc-300 text-xs font-medium uppercase tracking-wider"
              >
                Type <span className="font-mono text-red-300">DELETE</span> to
                confirm
              </label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="rounded-xl border-slate-700 bg-slate-950/60 text-white placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-500">
                This is a production key. We ask for extra confirmation to avoid
                accidental deletion.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 py-4">
            <Button
              variant="outline"
              className="w-auto rounded-xl border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-auto rounded-xl border-red-500/80 bg-red-600 text-white shadow-[0_10px_25px_rgba(239,68,68,0.22)] hover:border-red-500 hover:bg-red-500 hover:text-white"
              onClick={handleDeleteKey}
              disabled={isDeleting || !canConfirmDelete}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4 text-white" />
              )}
              <span className="text-white">Delete</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enable/disable confirmation dialog */}
      <Dialog
        open={!!statusActionTarget}
        onOpenChange={(open) => !open && setStatusActionTarget(null)}
      >
        <DialogContent className="rounded-2xl border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {statusActionTarget?.action === "activate"
                ? "Enable API Key"
                : "Disable API Key"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to{" "}
              {statusActionTarget?.action === "activate" ? "enable" : "disable"}{" "}
              this{" "}
              <span className="font-medium text-white">
                {statusActionTarget?.key.type}
              </span>{" "}
              key? This action will change access immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 py-4">
            <Button
              variant="outline"
              className="w-auto rounded-xl border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white"
              onClick={() => setStatusActionTarget(null)}
            >
              No
            </Button>
            <Button
              className={cn(
                "w-auto rounded-xl text-white shadow-[0_10px_25px_rgba(16,185,129,0.18)]",
                statusActionTarget?.action === "activate"
                  ? "border-emerald-500/80 bg-emerald-600 hover:border-emerald-500 hover:bg-emerald-500"
                  : "border-red-500/80 bg-red-600 shadow-[0_10px_25px_rgba(239,68,68,0.22)] hover:border-red-500 hover:bg-red-500",
              )}
              onClick={confirmStatusChange}
              disabled={statusUpdatingId === statusActionTarget?.key.id}
            >
              {statusUpdatingId === statusActionTarget?.key.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
              ) : statusActionTarget?.action === "activate" ? (
                <Power className="mr-2 h-4 w-4 text-white" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4 text-white" />
              )}
              <span className="text-white">
                {statusActionTarget?.action === "activate"
                  ? "Yes, Enable"
                  : "Yes, Disable"}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

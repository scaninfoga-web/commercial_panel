"use client";

import { useEffect, useMemo, useState, MouseEvent, ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Code2,
  Inbox,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  Lock,
  Check,
  X,
} from "lucide-react";
import { get } from "@/lib/api";
import { getApiDocumentation } from "@/lib/api-docs";
import ViewDocumentation from "./ViewDocumentation";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiDetail {
  id: string;
  api_name: string;
  endpoint: string;
  method: string;
  price: number;
  status: boolean;
  /** Whether *this* user has access — drives the locked/disabled UI. */
  status_for_user: boolean;
}

interface ApiResponseEnvelope<T> {
  responseStatus: { status: boolean; statusCode: number; message: string };
  responseData: T;
}

// ─── Blocklist ──────────────────────────────────────────────────────────────
// Endpoints listed here are hidden from the UI entirely (not just disabled).
const BLOCKED_ENDPOINTS: string[] = [
  "/api/v1/map/route-data",
  "/api/v1/map/location-data",
  "/api/v1/uan/get-uan-no", // UAN API is temporarily disabled for all users

  // Add more endpoints here that you want to HIDE
];

// ─── Category quick filters ──────────────────────────────────────────────
// Each category is matched against an API's name/endpoint by substring —
// clicking a chip narrows the grid instantly, no typing required. Add a
// new product line here and it shows up in the row automatically.
interface ApiCategory {
  label: string;
  keywords: string[];
}

const API_CATEGORIES: ApiCategory[] = [
  { label: "Aadhaar", keywords: ["aadhaar"] },
  { label: "PAN", keywords: ["pan"] },
  { label: "Vehicle RC", keywords: ["vehicle", " rc", "rc advance", "rc verify"] },
  { label: "PUCC", keywords: ["pucc"] },
  { label: "UAN", keywords: ["uan", "employment history"] },
  { label: "GST", keywords: ["gst"] },
  { label: "MCA", keywords: ["mca", "cin", "din"] },
  { label: "UPI", keywords: ["upi", "digital payment"] },
  { label: "Mobile 360", keywords: ["mobile360", "mobile 360", "mobile to pan", "mobile to dl", "nbfc profile", "profile advance"] },
  { label: "Email OSINT", keywords: ["hunter", "holehe", "linkedin", "github", "ghunt", "email"] },
  { label: "Dark Web", keywords: ["stealer", "breach", "dark web", "domain search"] },
  { label: "IndiaMART", keywords: ["indiamart"] },
];

const matchesCategory = (api: ApiDetail, category: ApiCategory) => {
  const haystack = `${api.api_name ?? ""} ${api.endpoint ?? ""}`.toLowerCase();
  return category.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
};

// ─── Description lookup (JSON → fallback) ────────────────────────────────────
// Reads the per-endpoint documentation JSON and returns its description.
// Falls back to a generic sentence so a card never shows an empty line.
// Wrapped in try/catch so a malformed or missing docs entry for one
// endpoint can never take down the whole grid.
const FALLBACK_DESCRIPTION = (api: ApiDetail) =>
  `Securely execute ${api.api_name} and retrieve data instantly via our commercial portal.`;

const getApiDescription = (api: ApiDetail): string => {
  try {
    const doc = getApiDocumentation(api.endpoint);
    const description = doc?.description?.trim();
    return description && description.length > 0 ? description : FALLBACK_DESCRIPTION(api);
  } catch {
    return FALLBACK_DESCRIPTION(api);
  }
};

// ─── API call ───────────────────────────────────────────────────────────────

async function fetchAllApisDetails(): Promise<{ total: number; apis: ApiDetail[] }> {
  const endpoint = "/api/v1/user/commercial/get-all-apis-details";
  try {
    const response = await get<ApiResponseEnvelope<{ total?: number; apis?: ApiDetail[] }>>(endpoint);
    const raw = response?.responseData ?? {};
    const apis = Array.isArray(raw.apis) ? raw.apis : [];
    return {
      total: Number(raw.total ?? apis.length ?? 0),
      apis,
    };
  } catch (err: any) {
    const message = err?.response?.data?.responseStatus?.message || "Failed to load APIs. Please try again.";
    toast.error(message);
    throw new Error(message);
  }
}

// ─── UI constants & helpers ─────────────────────────────────────────────────

const METHOD_STYLES: Record<string, string> = {
  GET: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  POST: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  PUT: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  PATCH: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  DELETE: "border-red-500/20 bg-red-500/10 text-red-400",
};

const methodBadgeClass = (method?: string) =>
  METHOD_STYLES[(method || "POST").toUpperCase()] ?? "border-slate-500/20 bg-slate-500/10 text-slate-400";

const formatPrice = (price?: number) =>
  price === 0 || price === undefined ? "FREE" : `₹${price.toLocaleString("en-IN")}`;

function ApiCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="h-4 w-2/3 animate-pulse rounded-xl bg-slate-800/60" />
        <div className="h-4 w-12 animate-pulse rounded-full bg-slate-800/60" />
      </div>
      <div className="mt-3 h-8 w-full animate-pulse rounded-xl bg-slate-800/40" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-800/40" />
      <div className="mt-auto flex items-center justify-between pt-4">
        <div className="h-5 w-12 animate-pulse rounded bg-slate-800/60" />
        <div className="h-5 w-10 animate-pulse rounded bg-slate-800/60" />
      </div>
    </div>
  );
}

// ─── API card ───────────────────────────────────────────────────────────────
// Behaviour branches once, up front, on `isActive` (= api.status_for_user).
// Everything else in the card just reads that one flag.
//
// `description` is passed in as a prop (resolved once by the parent via a
// memoized lookup map) rather than computed here on every render — keeps
// the card a pure, predictable function of its props.
//
// Note: the action button is always rendered (not a hover-only reveal) so it
// works identically with mouse, touch and keyboard — hover is reserved for
// the card's ambient glow/spotlight, which is purely decorative.

function ApiCard({
  api,
  description,
  onClick,
}: {
  api: ApiDetail;
  description: string;
  onClick: () => void;
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const isActive = api.status_for_user;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-xl transition-all duration-300 active:scale-[0.98] hover:-translate-y-1.5 hover:scale-[1.02] hover:bg-slate-900/70",
        isActive
          ? "hover:border-emerald-500/40 hover:shadow-[0_15px_40px_-12px_rgba(16,185,129,0.35)]"
          : "hover:border-red-500/40 hover:shadow-[0_15px_40px_-12px_rgba(239,68,68,0.35)]",
      )}
    >
      {/* Mouse-Follow Spotlight Effect */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: isHovering
            ? `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, ${
                isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"
              }, transparent 40%)`
            : "none",
        }}
      />

      {/* Top-right ambient glow on hover */}
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-2xl transition-all duration-500",
          isActive ? "bg-emerald-500/0 group-hover:bg-emerald-500/20" : "bg-red-500/0 group-hover:bg-red-500/20",
        )}
      />

      {/* Content Wrapper */}
      <div className="relative flex h-full flex-col">
        {/* Header: Name & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "truncate text-sm font-semibold text-white transition-colors",
              isActive ? "group-hover:text-emerald-300" : "group-hover:text-red-300",
            )}
            title={api.api_name}
          >
            {api.api_name || "Unnamed API"}
          </h3>
          {isActive ? (
            <Badge className="shrink-0 gap-1 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
            </Badge>
          ) : (
            <Badge className="shrink-0 gap-1 border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-medium text-red-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> DISABLE
            </Badge>
          )}
        </div>

        {/* Description — pulled from docs JSON, falls back to a generic line */}
        <p className="mt-3 line-clamp-2 min-h-[32px] text-xs leading-5 text-slate-400" title={description}>
          {description}
        </p>

        {/* Footer: method + price on the left, action pill on the right — always visible */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <Badge
              className={cn(
                "shrink-0 border px-2 py-0.5 text-[10px] font-semibold font-mono",
                methodBadgeClass(api.method),
              )}
            >
              {api.method || "POST"}
            </Badge>
            <p className={cn("truncate text-sm font-bold", isActive ? "text-emerald-400" : "text-red-400")}>
              {formatPrice(api.price)}
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200",
              isActive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-[0_4px_14px_-4px_rgba(16,185,129,0.6)]"
                : "border-red-500/40 bg-red-500/10 text-red-400 group-hover:bg-red-500 group-hover:text-white group-hover:shadow-[0_4px_14px_-4px_rgba(239,68,68,0.6)]",
            )}
          >
            {isActive ? (
              <>
                View <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </>
            ) : (
              <>
                Locked <Lock className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animated Bottom Border on Hover */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100",
          isActive ? "via-emerald-500" : "via-red-500",
        )}
      />
    </div>
  );
}

// Shared shell used by every non-grid state (error / empty) so the block
// never looks or sizes differently depending on which state is active.
function ResultsPlaceholder({
  icon: Icon,
  iconClassName,
  title,
  description,
  action,
}: {
  icon: typeof Inbox;
  iconClassName: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-1 rounded-2xl border border-slate-800 bg-slate-900/50 px-6 py-14 text-center backdrop-blur-xl">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border", iconClassName)}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 max-w-sm text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Category chip row ───────────────────────────────────────────────────
// A single horizontally-scrollable row on mobile (swipe, no layout jump)
// that opens up into a natural wrapping cloud from `sm:` up. Same visual
// language as the date-range presets elsewhere in the app — quiet pill by
// default, emerald outline + tint when active — with a small check dot for
// extra affordance and a red "Clear" pill at the end when filtering.

function CategoryChips({
  active,
  onSelect,
  onClear,
}: {
  active: string | null;
  onSelect: (label: string) => void;
  onClear: () => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Filter APIs by category"
    >
      {API_CATEGORIES.map((category) => {
        const isActive = active === category.label;
        return (
          <button
            key={category.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(category.label)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 sm:shrink",
              isActive
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                : "border-slate-700 bg-slate-900 text-zinc-400 hover:border-emerald-500/40 hover:bg-slate-800/80 hover:text-emerald-400",
            )}
          >
            {isActive && <Check className="h-3 w-3 shrink-0" />}
            {category.label}
          </button>
        );
      })}

      {/* Clear pill only when a category is active */}
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-all duration-200 active:scale-95 hover:border-red-500/50 hover:bg-red-500/20"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ApiListSection() {
  const [apis, setApis] = useState<ApiDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedApi, setSelectedApi] = useState<ApiDetail | null>(null);
  const [restrictedApi, setRestrictedApi] = useState<ApiDetail | null>(null);

  useEffect(() => {
    loadApis();
  }, []);

  const loadApis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllApisDetails();
      setApis(data.apis || []);
    } catch (err: any) {
      setError(err.message || "Failed to load APIs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Only enabled (non-disabled) APIs open the docs viewer; disabled ones
  // show the "contact support" popup instead.
  const handleApiClick = (api: ApiDetail) => {
    if (api.status_for_user) setSelectedApi(api);
    else setRestrictedApi(api);
  };

  const handleSelectCategory = (label: string) => {
    setActiveCategory((prev) => (prev === label ? null : label));
  };

  const clearFilters = () => {
    setActiveCategory(null);
    setSearchQuery("");
  };

  // Resolved once per `apis` change (not on every render/keystroke) so the
  // docs-JSON lookup never repeats for the same endpoint unnecessarily.
  // Cards and the search filter both read from this single map.
  const descriptionsByEndpoint = useMemo(() => {
    const map = new Map<string, string>();
    apis.forEach((api) => {
      map.set(api.endpoint, getApiDescription(api));
    });
    return map;
  }, [apis]);

  const resolveDescription = (api: ApiDetail) =>
    descriptionsByEndpoint.get(api.endpoint) ?? FALLBACK_DESCRIPTION(api);

  const filteredApis = useMemo(() => {
    let visibleApis = apis.filter((api) => !BLOCKED_ENDPOINTS.includes(api.endpoint));

    if (activeCategory) {
      const category = API_CATEGORIES.find((c) => c.label === activeCategory);
      if (category) visibleApis = visibleApis.filter((api) => matchesCategory(api, category));
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleApis;

    // Search across name, endpoint, method, and the resolved JSON description.
    return visibleApis.filter((api) => {
      const description = (descriptionsByEndpoint.get(api.endpoint) ?? FALLBACK_DESCRIPTION(api)).toLowerCase();
      return (
        api.api_name?.toLowerCase().includes(q) ||
        api.endpoint?.toLowerCase().includes(q) ||
        api.method?.toLowerCase().includes(q) ||
        description.includes(q)
      );
    });
  }, [apis, searchQuery, activeCategory, descriptionsByEndpoint]);

  const visibleTotal = useMemo(
    () => apis.filter((api) => !BLOCKED_ENDPOINTS.includes(api.endpoint)).length,
    [apis],
  );

  const isSearchFiltered = searchQuery.trim().length > 0;
  const hasActiveFilters = isSearchFiltered || !!activeCategory;

  const emptyStateTitle = isSearchFiltered
    ? `No APIs match "${searchQuery.trim()}"`
    : activeCategory
      ? `No APIs found in "${activeCategory}"`
      : "No APIs available yet";

  const emptyStateDescription = hasActiveFilters
    ? "Try a different name, endpoint, method, or category."
    : "Check back once APIs are published here.";

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Header & Search */}
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <Code2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">API Documentation</h2>
            <p className="mt-0.5 truncate text-xs text-slate-400 sm:text-sm">Explore and integrate available APIs.</p>
          </div>
        </div>

        <div className="relative w-full shrink-0 sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            type="search"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, endpoint, description..."
            aria-label="Search APIs"
            className="h-9 w-full rounded-xl border-slate-700 bg-slate-900 pl-9 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* Category quick filters */}
      <CategoryChips active={activeCategory} onSelect={handleSelectCategory} onClear={clearFilters} />

      {/* API Count */}
      {!isLoading && !error && (
        <p className="shrink-0 text-xs text-slate-500" aria-live="polite">
          Showing <span className="font-medium text-slate-300">{filteredApis.length}</span> of{" "}
          <span className="font-medium text-slate-300">{visibleTotal}</span> APIs
          {activeCategory && (
            <>
              {" "}
              in <span className="font-medium text-emerald-400">{activeCategory}</span>
            </>
          )}
        </p>
      )}

      {/* Results Area with stable min-height */}
      <div className="min-h-[280px]">
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ApiCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <ResultsPlaceholder
            icon={AlertTriangle}
            iconClassName="border-red-500/30 bg-red-500/10 text-red-400"
            title={error}
            description="Check your connection and try again."
            action={
              <button
                onClick={loadApis}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition-colors hover:bg-red-600 active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </button>
            }
          />
        )}

        {!isLoading && !error && filteredApis.length === 0 && (
          <ResultsPlaceholder
            icon={Inbox}
            iconClassName="border-slate-700 bg-slate-800/60 text-slate-500"
            title={emptyStateTitle}
            description={emptyStateDescription}
            action={
              hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-400 active:scale-95"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        )}

        {!isLoading && !error && filteredApis.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredApis.map((api, index) => (
              <ApiCard
                key={api.id ?? `${api.endpoint}-${index}`}
                api={api}
                description={resolveDescription(api)}
                onClick={() => handleApiClick(api)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Documentation Dialog — enabled APIs only */}
      <Dialog open={!!selectedApi} onOpenChange={(open) => !open && setSelectedApi(null)}>
        <DialogContent className="flex max-h-[86vh] w-[94vw] flex-col overflow-hidden rounded-2xl border-slate-800 bg-slate-900/95 p-0 shadow-2xl shadow-black/50 backdrop-blur-xl sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-slate-800 px-4 pb-4 pt-5 sm:px-5">
            <DialogTitle className="truncate text-base font-semibold text-white sm:text-lg">{selectedApi?.api_name}</DialogTitle>
          </DialogHeader>
          <div className="scrollbar-custom flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {selectedApi && <ViewDocumentation endpoint={selectedApi.endpoint} apiName={selectedApi.api_name} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Access Restricted Dialog — disabled APIs */}
      <Dialog open={!!restrictedApi} onOpenChange={(open) => !open && setRestrictedApi(null)}>
        <DialogContent className="w-[92vw] rounded-2xl border-slate-800 bg-slate-900/95 p-6 text-center backdrop-blur-xl sm:max-w-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <Lock className="h-6 w-6 text-red-400" />
          </div>
          <DialogHeader className="mt-4 items-center text-center">
            <DialogTitle className="text-lg font-semibold text-white">API Not Enabled</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            <span className="font-medium text-slate-200">{restrictedApi?.api_name}</span> is currently not enabled for
            your account. Please contact our support team to get it enabled.
          </p>
          <button
            onClick={() => setRestrictedApi(null)}
            className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 active:scale-95"
          >
            Got it
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
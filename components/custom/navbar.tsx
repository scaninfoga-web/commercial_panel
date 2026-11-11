"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/functions";
import { useEffect, useRef, useState } from "react";
import { getCookie } from "cookies-next";
import {
  LogOut,
  ChevronDown,
  Wallet,
  Plus,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clearSession } from "@/lib/auth";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchWalletBalance } from "@/redux/walletSlice";
import { getClientInfo } from "@/lib/header";
import { setInfo } from "@/redux/infoSlice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useSupportNotifications,
} from "@/hooks/useSupportNotifications";

const VALID_ENVS = ["DEVELOPMENT", "PRODUCTION"] as const;

const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();

  const [token, setToken] = useState<string | null>(null);
  const [env, setEnv] = useState<string>("DEVELOPMENT");
  const [envOpen, setEnvOpen] = useState(false);
  const [envChangeTarget, setEnvChangeTarget] = useState<string | null>(null);

  const [walletOpen, setWalletOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const {
    notifications,
    total: notificationTotal,
    markAsRead,
  } = useSupportNotifications(token);

  const wallet = useSelector((state: RootState) => state.wallet);

  const envRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
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
  }, [pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("environment");
    const envValue =
      typeof saved === "string" &&
      VALID_ENVS.includes(saved as (typeof VALID_ENVS)[number])
        ? saved
        : "DEVELOPMENT";
    setEnv(envValue);
    if (saved !== envValue) localStorage.setItem("environment", envValue);
  }, []);

  useEffect(() => {
    if (token) {
      dispatch(fetchWalletBalance());
    }
  }, [token, dispatch]);

  useEffect(() => {
    let cancelled = false;

    const syncClientInfo = async () => {
      try {
        const clientInfo = await getClientInfo();
        if (cancelled || !clientInfo) return;
        dispatch(setInfo({ ...(clientInfo as any), fetched: true }));
      } catch (err) {
        console.error("Navbar: failed to sync client info", err);
      }
    };

    syncClientInfo();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (envRef.current && !envRef.current.contains(event.target as Node)) {
        setEnvOpen(false);
      }
      if (
        walletRef.current &&
        !walletRef.current.contains(event.target as Node)
      ) {
        setWalletOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setEnvOpen(false);
    setWalletOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  const handleEnvChange = (value: string) => {
    setEnv(value);
    localStorage.setItem("environment", value);
    setEnvChangeTarget(null);
    setEnvOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("environment-changed", { detail: value }),
      );
    }
  };

  const handleLogout = () => {
    clearSession();
    setToken(null);
    router.replace("/");
  };

  if (pathname === "/") return null;

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-[#05070B]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-3 sm:h-16 sm:px-6">
        {/* Mobile sidebar toggle */}

        {/* Logo */}
        <div className="flex min-w-0 shrink-0 items-center">
          <Image
            src="https://d29bvka1s4r8lj.cloudfront.net/scaninfoga_stuff/upper_logo.png"
            alt="Scaninfoga Commercial Portal"
            width={130}
            height={0}
            className="h-auto w-[96px] sm:w-[130px]"
            style={{ objectFit: "contain" }}
            unoptimized
            priority
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right Section */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          {/* Environment Switcher */}
          {token && (
            <div className="relative order-2" ref={envRef}>
              <button
                onClick={() => setEnvOpen(!envOpen)}
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors sm:gap-1.5 sm:px-2.5 sm:text-[11px]",
                  env === "PRODUCTION"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    env === "PRODUCTION" ? "bg-amber-400" : "bg-emerald-400",
                  )}
                />
                <span className="hidden sm:inline">
                  {env === "PRODUCTION" ? "Production" : "Development"}
                </span>
                <span className="sm:hidden">
                  {env === "PRODUCTION" ? "Prod" : "Dev"}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 opacity-60 transition-transform",
                    envOpen && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence>
                {envOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-white/10 bg-[#0C0F16] shadow-2xl shadow-black/50 sm:w-44"
                  >
                    {VALID_ENVS.map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setEnvChangeTarget(v);
                          setEnvOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium transition-colors",
                          env === v
                            ? "bg-white/[0.06] text-white"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            v === "PRODUCTION"
                              ? "bg-amber-400"
                              : "bg-emerald-400",
                          )}
                        />
                        {v === "PRODUCTION" ? "Production" : "Development"}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {token && (
            <div className="relative order-1" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label={
                  notificationTotal > 0
                    ? `${notificationTotal} unread support notifications`
                    : "Notifications"
                }
                aria-expanded={notificationsOpen}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-xl border text-zinc-300 shadow-lg transition-all duration-200 hover:text-white",
                  notificationTotal > 0
                    ? "border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 text-emerald-300 shadow-emerald-950/30 hover:border-emerald-300/70 hover:shadow-emerald-900/40"
                    : "border-white/10 bg-white/[0.03] hover:border-emerald-500/40 hover:bg-emerald-500/10",
                )}
              >
                <Bell
                  className={cn(
                    "h-4 w-4",
                    notificationTotal > 0 && "animate-[wiggle_1.8s_ease-in-out_infinite]",
                  )}
                />
                {notificationTotal > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full border-2 border-[#05070B] bg-gradient-to-br from-red-400 to-rose-600 px-1 text-[9px] font-bold leading-4 text-white shadow-lg shadow-red-950/50">
                    +{notificationTotal > 99 ? "99+" : notificationTotal}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="fixed left-2 right-2 top-16 z-50 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0C0F16]/95 shadow-2xl shadow-black/60 backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/5 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Notifications
                        </p>
                        <p className="text-xs text-zinc-500">
                          Unread support messages
                        </p>
                      </div>
                      {notificationTotal > 0 && (
                        <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-300">
                          {notificationTotal} unread
                        </span>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto p-2">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                          <Bell className="h-5 w-5 text-zinc-600" />
                          <p className="text-sm text-zinc-400">
                            No unread notifications
                          </p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false);
                              markAsRead(notification.id);
                              router.push(`/get_support/${notification.id}`);
                            }}
                            className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
                          >
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                              <MessageCircle className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-xs font-semibold text-white">
                                  {notification.subject}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {notification.ticketId && (
                                    <span className="rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                                      {notification.ticketId}
                                    </span>
                                  )}
                                  {notification.totalMessages > 0 && (
                                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-inset ring-red-400/20">
                                      {notification.totalMessages}
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-400">
                                {notification.displayMessage}
                              </span>
                              <span className="mt-1 block text-[10px] font-medium text-emerald-400/80">
                                Open conversation
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Advanced Wallet Widget with Dropdown */}
          {token && (
            <div className="relative order-3" ref={walletRef}>
              <motion.button
                onClick={() => setWalletOpen(!walletOpen)}
                className="group flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 py-1 pl-2 pr-1 transition-all hover:border-emerald-500/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] sm:gap-2 sm:pl-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 sm:gap-2 sm:text-sm">
                  {wallet.loading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-400 sm:h-4 sm:w-4" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-400 sm:h-4 sm:w-4" />
                  )}
                  <span className="tabular-nums font-semibold">
                    {wallet.loading
                      ? "..."
                      : `₹${wallet.balance?.toFixed(2) || "0.00"}`}
                  </span>
                </div>

                <div className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 transition-colors group-hover:bg-emerald-500 group-hover:text-white sm:ml-1 sm:h-6 sm:w-6">
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </motion.button>

              <AnimatePresence>
                {walletOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed left-2 right-2 top-16 z-50 w-auto overflow-hidden rounded-2xl border border-slate-800 bg-[#0C0F16] shadow-2xl shadow-black/50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
                  >
                    {/* Balance Header */}
                    <div className="border-b border-slate-800 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
                      <p className="text-xs uppercase tracking-wider text-zinc-400">
                        Available Balance
                      </p>
                      <h3 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                        {wallet.loading
                          ? "..."
                          : `₹${wallet.balance?.toFixed(2) || "0.00"}`}
                      </h3>
                      <button
                        onClick={() => {
                          setWalletOpen(false);
                          router.push("/add-funds");
                        }}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                      >
                        <Plus className="h-4 w-4" /> Add Funds
                      </button>
                    </div>

                    {/* Transaction List */}
                    <div className="max-h-60 overflow-y-auto p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Recent Transactions
                      </p>

                      {wallet.transactions?.length > 0 ? (
                        wallet.transactions.slice(0, 5).map((txn) => {
                          const isCredit = txn.type === "CREDIT";
                          return (
                            <div
                              key={txn.id}
                              className="mb-1 flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                    isCredit
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-red-500/10 text-red-400",
                                  )}
                                >
                                  {isCredit ? (
                                    <ArrowDownLeft className="h-4 w-4" />
                                  ) : (
                                    <ArrowUpRight className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="line-clamp-1 text-sm font-medium text-white">
                                    {txn.description}
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    {formatDate(txn.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 text-sm font-semibold",
                                  isCredit
                                    ? "text-emerald-400"
                                    : "text-red-400",
                                )}
                              >
                                {isCredit ? "+" : "-"}₹{txn.amount?.toFixed(2)}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-xs text-zinc-500">
                          No transactions yet.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Logout */}
          {token && (
            <button
              onClick={handleLogout}
              className="order-4 flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/10 sm:px-3 sm:text-[13px]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Environment Switch Confirmation Dialog */}
      <Dialog
        open={!!envChangeTarget}
        onOpenChange={(open) => !open && setEnvChangeTarget(null)}
      >
        <DialogContent className="w-[92vw] rounded-2xl border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Switch Environment</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to switch to the{" "}
              <span className="font-medium text-white">
                {envChangeTarget === "PRODUCTION"
                  ? "Production"
                  : "Development"}
              </span>{" "}
              environment? This will affect which API keys are used for your
              requests.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse justify-end gap-2 py-4 sm:flex-row">
            <Button
              variant="outline"
              className="w-full rounded-xl border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white sm:w-auto"
              onClick={() => setEnvChangeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className={cn(
                "w-full rounded-xl text-white shadow-lg transition-none sm:w-auto",
                envChangeTarget === "PRODUCTION"
                  ? "border border-amber-500/80 bg-amber-600 shadow-amber-900/30 hover:bg-amber-600 hover:text-white"
                  : "border border-emerald-500/80 bg-emerald-600 shadow-emerald-900/30 hover:bg-emerald-600 hover:text-white",
              )}
              onClick={() =>
                envChangeTarget && handleEnvChange(envChangeTarget)
              }
            >
              Yes, Switch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Navbar;

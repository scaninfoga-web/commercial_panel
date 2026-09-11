"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  LayoutDashboard,
  ChevronLeft,
  Menu,
  KeyRound,
  ActivityIcon,
  BookTextIcon,
  FileChartColumnIcon,
  X,
  Settings,
  User,
  Crown,
} from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { useSidebar } from "@/context/SidebarContext"; // Context import kiya

interface SidebarLink {
  title: string;
  icon: React.ElementType;
  href: string;
}

interface SidebarGroup {
  label: string;
  links: SidebarLink[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    label: "Overview",
    links: [{ title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    label: "Management",
    links: [
      { title: "Manage API Keys", icon: KeyRound, href: "/manage_api_keys" },
    ],
  },
  {
    label: "Activities",
    links: [
      { title: "User Activities", icon: ActivityIcon, href: "/activities" },
      { title: "Documentation", icon: BookTextIcon, href: "/documentation" },
      {
        title: "IAS Report",
        icon: FileChartColumnIcon,
        href: "/ias-report",
      },
    ],
  },
];

interface SidebarAvatarProps {
  src: string | null;
  initials: string;
  name: string;
  className: string;
  sizes: string;
}

function SidebarAvatar({
  src,
  initials,
  name,
  className,
  sizes,
}: SidebarAvatarProps): JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg",
          className,
        )}
      >
        <span className="text-xs font-bold">{initials || "U"}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border border-emerald-500/40 bg-slate-950 shadow-lg ring-1 ring-emerald-400/20",
        className,
      )}
    >
      <Image
        src={src}
        alt={name}
        fill
        unoptimized
        sizes={sizes}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

const getTierColor = (tier?: string) => {
  switch (tier?.toUpperCase()) {
    case "ADMIN":
      return "bg-gradient-to-r from-emerald-400 to-emerald-600 text-white border-emerald-300";
    case "COMMERCIAL":
      return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white border-yellow-300";
    case "COOPERATIVE":
      return "bg-gradient-to-r from-blue-400 to-blue-600 text-white border-blue-300";
    case "COOPERATIVE_MEMBER":
      return "bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400";
    case "NORMAL":
    default:
      return "bg-gradient-to-r from-gray-400 to-gray-600 text-white border-gray-300";
  }
};

const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md`

const getIsMobile = () =>
  typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

const contentSpring = {
  type: "spring" as const,
  stiffness: 280,
  damping: 26,
};

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const userData = useSelector((state: RootState) => state.user.user);
  
  // Context se state le rahe hain
  const { isCollapsed, isMobileOpen, toggleSidebar, setIsMobileOpen } = useSidebar();

  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const isDrawerOpen = isMobile && isMobileOpen;

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      setIsMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (isDrawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isDrawerOpen]);

  // Close on Escape while the mobile drawer is open.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDrawerOpen]);

  const showLabels = isMobile ? true : !isCollapsed;
  const isRail = !isMobile && isCollapsed;

  const rawInitials = userData?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const fullName = mounted ? userData?.name || "User" : "User";
  const initials = mounted ? rawInitials || "U" : "U";
  const avatarSrc = mounted
    ? userData?.profile_image || userData?.aadhaar_image || null
    : null;
  const tier = mounted ? userData?.tier : undefined;
  const email = mounted ? userData?.email || "No email" : "No email";

  return (
    <>
      {/* Backdrop — mobile only, shown while the drawer is open */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={
          isMobile
            ? { x: isMobileOpen ? 0 : "-100%" } // Mobile par drawer slide hoga
            : { width: isCollapsed ? 72 : 260, x: 0 } // Desktop par width shrink hogi
        }
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed left-0 top-14 z-40 flex h-[calc(100vh-56px)] w-[260px] flex-col overflow-hidden border-r border-white/[0.06] bg-[#05070B]/95 backdrop-blur-xl md:top-16 md:h-[calc(100vh-64px)] md:w-auto"
      >
        {/* Header row inside the drawer/rail — close (mobile) or collapse (desktop) */}
        <div
          className={cn(
            "flex items-center px-3 py-4",
            isRail ? "justify-center" : "justify-end",
          )}
        >
          <button
            onClick={() => {
              if (isMobile) {
                setIsMobileOpen(false); // Mobile par close karo
              } else {
                toggleSidebar(); // Desktop par collapse/expand karo
              }
            }}
            aria-label={
              isMobile ? "Close menu" : isCollapsed ? "Expand menu" : "Collapse menu"
            }
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            {isMobile ? (
              <X className="h-4 w-4" />
            ) : isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="scrollbar-custom flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-3 pb-6">
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <AnimatePresence>
                {showLabels && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500"
                  >
                    {group.label}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                {group.links.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "group relative flex items-center overflow-hidden rounded-xl text-[13px] font-medium transition-all duration-200",
                        isRail
                          ? "mx-auto h-11 w-11 justify-center"
                          : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
                      )}
                    >
                      {isActive && !isRail && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-400"
                          transition={{
                            duration: 0.3,
                            ease: [0.25, 0.46, 0.45, 0.94],
                          }}
                        />
                      )}

                      <span className="relative flex shrink-0 items-center justify-center">
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition",
                            isActive
                              ? "text-emerald-400"
                              : "text-slate-500 group-hover:text-slate-300",
                          )}
                        />
                      </span>

                      <AnimatePresence>
                        {showLabels && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="truncate whitespace-nowrap"
                          >
                            {link.title}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {isRail && (
                        <div className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-xl border border-white/10 bg-[#0C0F16] px-3 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block">
                          {link.title}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="shrink-0 border-t border-slate-800/30 px-3 pt-4">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-xl p-2 transition-colors duration-200 hover:bg-white/5",
              !showLabels && "justify-center",
            )}
          >
            <div className="relative shrink-0">
              <SidebarAvatar
                src={avatarSrc}
                initials={initials}
                name={fullName}
                className="h-10 w-10"
                sizes="40px"
              />
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#05070B] bg-green-500" />
            </div>

            <motion.div
              animate={{
                opacity: showLabels ? 1 : 0,
                x: showLabels ? 0 : -16,
                filter: showLabels ? "blur(0px)" : "blur(6px)",
              }}
              transition={{
                ...contentSpring,
                opacity: {
                  duration: 0.28,
                  ease: [0.4, 0, 0.2, 1],
                  delay: showLabels ? 0.08 : 0,
                },
                filter: {
                  duration: 0.22,
                  delay: showLabels ? 0.06 : 0,
                },
              }}
              className={cn(
                "min-w-0 flex-1",
                !showLabels && "pointer-events-none absolute",
              )}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className="truncate text-sm font-medium text-white">
                  {fullName}
                </span>
                <Badge
                  className={cn(
                    getTierColor(tier),
                    "shrink-0 px-1.5 py-0 text-[9px] shadow-sm",
                  )}
                >
                  <Crown className="mr-0.5 h-2.5 w-2.5" />
                  <span className="uppercase tracking-wide">
                    {tier || "Free"}
                  </span>
                </Badge>
              </div>
              <div className="truncate text-xs text-slate-400">{email}</div>
            </motion.div>
          </Link>

          <motion.div
            animate={{
              opacity: showLabels ? 1 : 0,
              y: showLabels ? 0 : 10,
              filter: showLabels ? "blur(0px)" : "blur(6px)",
            }}
            transition={{
              ...contentSpring,
              opacity: {
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
                delay: showLabels ? 0.12 : 0,
              },
              y: {
                ...contentSpring,
                delay: showLabels ? 0.1 : 0,
              },
              filter: {
                duration: 0.25,
                delay: showLabels ? 0.1 : 0,
              },
            }}
            className={cn(
              "mt-2 gap-2 pb-4",
              showLabels ? "flex" : "pointer-events-none absolute opacity-0",
            )}
          >
            <Link href="/profile" className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full rounded-xl border-slate-700/50 text-xs font-medium text-slate-300 transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
              >
                <User className="mr-1.5 h-3.5 w-3.5" />
                Profile
              </Button>
            </Link>
            <Link href="#" className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full rounded-xl border-slate-700/50 text-xs font-medium text-slate-300 transition-all duration-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400"
              >
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Plans
              </Button>
            </Link>
          </motion.div>

          <motion.div
            animate={{
              opacity: showLabels ? 0 : 1,
              scale: showLabels ? 0.85 : 1,
              filter: showLabels ? "blur(4px)" : "blur(0px)",
            }}
            transition={{
              ...contentSpring,
              opacity: {
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1],
                delay: showLabels ? 0 : 0.15,
              },
              scale: {
                ...contentSpring,
                delay: showLabels ? 0 : 0.12,
              },
              filter: {
                duration: 0.2,
                delay: showLabels ? 0 : 0.1,
              },
            }}
            className={cn(
              "mt-2 justify-center pb-4",
              showLabels ? "pointer-events-none absolute" : "flex",
            )}
          >
            <Link href="#">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-slate-400 hover:bg-white/5 hover:text-cyan-400"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Bottom brand */}
        <AnimatePresence>
          {showLabels && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-t border-white/[0.06] px-4 py-3"
            >
              <p className="text-[10px] font-medium tracking-wider text-slate-600">
                SCANINFOGA COMMERCIAL PANEL
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
};

export default Sidebar;
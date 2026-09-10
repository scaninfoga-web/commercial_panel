"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  ChevronLeft,
  Menu,
  KeyRound,
  ActivityIcon,
  BookTextIcon,
  FileChartColumnIcon,
  X,
} from "lucide-react";

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
    links: [{ title: "Manage API Keys", icon: KeyRound, href: "/manage_api_keys" }],
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

interface SidebarProps {
  /**
   * Desktop (>= md): true = collapsed to icon-rail, false = expanded.
   * Mobile (< md):   true = drawer closed/hidden, false = drawer open.
   */
  collapsed: boolean;
  onToggle: () => void;
}

const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md`

const getIsMobile = () =>
  typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();
  // Lazy-initialized so the very first render already knows the viewport size —
  // avoids a flash of the wrong layout (desktop rail) on mobile before hydration.
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const isDrawerOpen = isMobile && !collapsed;

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    if (isMobile && !collapsed) {
      onToggle();
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
      if (e.key === "Escape") onToggle();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDrawerOpen, onToggle]);

  const showLabels = isMobile ? true : !collapsed;
  const isRail = !isMobile && collapsed;

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
            onClick={onToggle}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={
          isMobile
            ? { x: collapsed ? "-100%" : 0 }
            : { width: collapsed ? 72 : 260, x: 0 }
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
            onClick={onToggle}
            aria-label={isMobile ? "Close menu" : collapsed ? "Expand menu" : "Collapse menu"}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            {isMobile ? (
              <X className="h-4 w-4" />
            ) : collapsed ? (
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
                      {/* Active indicator bar — only in the expanded row layout.
                          In rail mode the background alone marks the active item,
                          which avoids the bar poking outside the rounded icon box. */}
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

                      {/* Tooltip when collapsed (desktop rail only) */}
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
                SCANINFOGA ADMIN
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
};

export default Sidebar;
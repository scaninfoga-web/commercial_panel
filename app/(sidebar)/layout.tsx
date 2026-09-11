"use client";

import Sidebar from "@/components/custom/sidebar";
import { useSidebar } from "@/context/SidebarContext";
import { Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isCollapsed, isMobileOpen, setIsMobileOpen, toggleSidebar } = useSidebar();

  const [showButton, setShowButton] = useState(true);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollTimeout.current = setTimeout(() => {
      setShowButton(false);
    }, 3000);

    const handleScroll = () => {
      setShowButton(true);

      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      scrollTimeout.current = setTimeout(() => {
        setShowButton(false);
      }, 3000);
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#060b17]">
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar />

      <main
        className={`flex h-full w-full flex-col overflow-y-auto overflow-x-hidden scrollbar-custom transition-all duration-300 ease-in-out pt-[calc(4.5rem+env(safe-area-inset-top))] px-4 pb-6 md:pt-20 md:px-6 ${
          isCollapsed ? "md:ml-[72px]" : "md:ml-[260px]"
        }`}
      >
        {children}
      </main>

      <AnimatePresence>
        {showButton && !isMobileOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.4, opacity: 0, y: 24, transition: { duration: 0.4, ease: "easeInOut" } }}
            transition={{ type: "spring", stiffness: 340, damping: 24 }}
            className="fixed right-5 z-50 md:hidden"
            style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
          >
            <motion.button
              onClick={toggleSidebar}
              whileTap={{ scale: 0.88 }}
              aria-label="Open menu"
              className="group relative flex h-14 w-14 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b17]"
            >
              <motion.span
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(16,185,129,0.95),rgba(16,185,129,0)_32%,rgba(56,189,248,0.75)_60%,rgba(16,185,129,0.95)_100%)]"
              />

              <motion.span
                aria-hidden
                animate={{ scale: [1, 1.4, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-emerald-500/40 blur-md"
              />

              <span className="absolute inset-[2.5px] rounded-full border border-white/10 bg-zinc-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-colors duration-300 group-active:bg-zinc-900/95" />

              <Menu className="relative h-5 w-5 text-white transition-transform duration-200 ease-out group-active:scale-90" strokeWidth={2.25} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
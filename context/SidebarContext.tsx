"use client";

import { createContext, useContext, useState } from "react";

const SidebarContext = createContext<any>(null);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop layout
  const [isMobileOpen, setIsMobileOpen] = useState(false); // Mobile drawer

  const toggleSidebar = () => {
    // Agar mobile screen hai toh mobile state toggle karo
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileOpen((prev) => !prev);
    } else {
      // Desktop par shrink toggle karo
      setIsCollapsed((prev) => !prev);
    }
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, isMobileOpen, toggleSidebar, setIsMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
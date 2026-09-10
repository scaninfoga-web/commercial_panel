"use client";

import { deleteCookie } from "cookies-next";

export const clearSession = () => {
  deleteCookie("accessToken", { path: "/" });
  deleteCookie("user", { path: "/" });
  deleteCookie("expiresAt", { path: "/" });

  try {
    sessionStorage.removeItem("client_info_v2");
    localStorage.removeItem("persist:root");
  } catch {}
};

export const signOut = () => {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.replace("/auth");
  }
};

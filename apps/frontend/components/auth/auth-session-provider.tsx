"use client";

import { createContext, useContext } from "react";

import type { AuthViewer } from "@/lib/auth-types";

type AuthSessionContextValue = {
  viewer: AuthViewer;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  children,
  viewer,
}: Readonly<{
  children: React.ReactNode;
  viewer: AuthViewer;
}>) {
  return <AuthSessionContext.Provider value={{ viewer }}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}

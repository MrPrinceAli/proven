"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { sessionKey } from "./session";

export interface AppConfig {
  demoMode: boolean;
  chainId: number;
  issuerName: string | null;
}

const SANDBOX_KEY = "proven:demo-user";

export function useAppConfig() {
  return useQuery({
    queryKey: ["app-config"],
    queryFn: () => api<AppConfig>("/config"),
    staleTime: Infinity,
  });
}

const readSandbox = () => {
  try {
    return window.localStorage.getItem(SANDBOX_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Demo-mode login (D-032). "user" resumes this browser's sandbox when there is one. */
export function useDemoLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: "user" | "issuer") =>
      api<{ role: string; userId: string }>("/auth/demo", {
        method: "POST",
        body: JSON.stringify(role === "user" ? { role, userId: readSandbox() } : { role }),
      }),
    onSuccess: async (res) => {
      if (res.role === "user") {
        try {
          window.localStorage.setItem(SANDBOX_KEY, res.userId);
        } catch {
          // Private mode: the sandbox just won't be resumable.
        }
      }
      await qc.invalidateQueries();
      await qc.refetchQueries({ queryKey: sessionKey });
    },
  });
}

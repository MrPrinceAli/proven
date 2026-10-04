"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export interface Me {
  user: { id: string; status: string; createdAt: string };
  wallet: { address: string; chainId: number; did: string } | null;
  profile: {
    /** D-034: shown instead of the @slug when set. */
    displayName: string;
    /** Seed for the illustrated avatar (never null for an existing profile). */
    avatarSeed: string;
    headline: string;
    summary: string;
    visibility: "public" | "private" | "recruiter-only";
    slug: string | null;
    updatedAt: string;
  } | null;
  roles: string[];
  /** Logged in through demo mode (D-032). */
  demo?: boolean;
  /** A wallet-less sandbox account created by demo mode. */
  sandbox?: boolean;
}

export const sessionKey = ["me"] as const;

/** Current session from GET /api/me; `data` is null when logged out. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await api<Me>("/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 30_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => queryClient.setQueryData(sessionKey, null),
  });
}

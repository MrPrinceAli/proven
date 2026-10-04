"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Claim, ClaimPath, EntityType } from "./claims";
import { sessionKey, type Me } from "./session";

export interface ClaimsResponse {
  claims: Record<ClaimPath, Claim[]>;
  summary: Record<string, number>;
}

export interface Evidence {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string;
  capturedAt: string;
  links: { entityType: EntityType; entityId: string }[];
  custody: { event: string; at: string; by: string; sha256: string }[];
}

export const claimsKey = ["claims"] as const;
export const evidenceKey = ["evidence"] as const;

export function useClaims() {
  return useQuery({ queryKey: claimsKey, queryFn: () => api<ClaimsResponse>("/me/claims") });
}

export function useEvidence() {
  return useQuery({ queryKey: evidenceKey, queryFn: () => api<Evidence[]>("/me/evidence") });
}

/** Invalidates everything a claim/evidence mutation can change. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: claimsKey }),
      qc.invalidateQueries({ queryKey: evidenceKey }),
    ]);
}

export function useSaveClaim(path: ClaimPath) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id
        ? api<Claim>(`/me/${path}/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : api<Claim>(`/me/${path}`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: refresh,
  });
}

export function useDeleteClaim(path: ClaimPath) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/me/${path}/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NonNullable<Me["profile"]>>) =>
      api<NonNullable<Me["profile"]>>("/me/profile", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (profile) => {
      qc.setQueryData<Me | null>(sessionKey, (me) => (me ? { ...me, profile } : me));
    },
  });
}

export function useUploadEvidence() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ file, fields }: { file: File; fields: Record<string, string> }) => {
      const form = new FormData();
      // Fields first, then the file (the API reads parts in order).
      for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
      form.append("file", file, file.name);
      return api<Evidence>("/me/evidence", { method: "POST", body: form });
    },
    onSuccess: refresh,
  });
}

export function useUpdateEvidence() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, string> }) =>
      api<Evidence>(`/me/evidence/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: refresh,
  });
}

export function useDeleteEvidence() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/me/evidence/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useLinkEvidence() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      id,
      entityType,
      entityId,
      unlink,
    }: {
      id: string;
      entityType: EntityType;
      entityId: string;
      unlink?: boolean;
    }) =>
      unlink
        ? api<{ status: string }>(`/me/evidence/${id}/links?entityType=${entityType}&entityId=${entityId}`, {
            method: "DELETE",
          })
        : api<{ status: string }>(`/me/evidence/${id}/links`, {
            method: "POST",
            body: JSON.stringify({ entityType, entityId }),
          }),
    onSuccess: refresh,
  });
}

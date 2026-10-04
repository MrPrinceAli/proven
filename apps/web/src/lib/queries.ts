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
  aiType: string | null;
  aiConfidence: number | null;
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

// ----- W5: verification requests & credentials -----

export interface IssuerSummary {
  id: string;
  name: string;
  did: string;
  domain: string | null;
}

export interface CredentialView {
  id: string;
  credentialId: string;
  status: "active" | "revoked" | "expired";
  name: string | null;
  issuer: { id: string; name: string; did: string };
  issuedAt: string;
  expiresAt: string | null;
  vcHash: string;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  anchor: { txHash: string; block: number | null; contract: string; chainId: number } | null;
  vc: unknown;
}

export interface MyRequest {
  id: string;
  entityType: EntityType;
  entityId: string;
  claim: { label: string; status: string | null };
  issuer: { id: string; name: string };
  state: "pending" | "approved" | "rejected";
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  credentialId: string | null;
}

export interface QueueItem {
  id: string;
  evidenceCount?: number;
  entityType: EntityType;
  entityId: string;
  claim: { label: string; status: string | null; [field: string]: unknown };
  requester: {
    did: string | null;
    slug: string | null;
    headline: string;
    displayName: string;
    avatarSeed: string | null;
  };
  state: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt: string | null;
}

export interface RequestDetail extends Omit<QueueItem, "evidenceCount"> {
  reason: string | null;
  evidence: {
    id: string;
    type: string;
    title: string | null;
    filename: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    sha256: string;
    capturedAt: string;
  }[];
}

export const myCredentialsKey = ["my-credentials"] as const;
export const myRequestsKey = ["my-requests"] as const;
export const issuerQueueKey = ["issuer-queue"] as const;
export const issuerCredentialsKey = ["issuer-credentials"] as const;

export function useIssuers() {
  return useQuery({ queryKey: ["issuers"], queryFn: () => api<IssuerSummary[]>("/issuers") });
}

export function useMyCredentials() {
  return useQuery({ queryKey: myCredentialsKey, queryFn: () => api<CredentialView[]>("/me/credentials") });
}

export function useMyRequests() {
  return useQuery({ queryKey: myRequestsKey, queryFn: () => api<MyRequest[]>("/me/verification-requests") });
}

export function useRequestVerification() {
  const qc = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: {
      entityType: EntityType;
      entityId: string;
      issuerId: string;
      evidenceIds: string[];
    }) => api<{ id: string }>("/me/verification-requests", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => Promise.all([refresh(), qc.invalidateQueries({ queryKey: myRequestsKey })]),
  });
}

export function useIssuerQueue(state: "pending" | "approved" | "rejected" | "all") {
  return useQuery({
    queryKey: [...issuerQueueKey, state],
    queryFn: () =>
      api<QueueItem[]>(`/issuer/verification-requests${state === "all" ? "" : `?state=${state}`}`),
  });
}

export function useIssuerRequest(id: string | null) {
  return useQuery({
    queryKey: ["issuer-request", id],
    queryFn: () => api<RequestDetail>(`/issuer/verification-requests/${id}`),
    enabled: Boolean(id),
  });
}

function useIssuerRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: issuerQueueKey }),
      qc.invalidateQueries({ queryKey: ["issuer-request"] }),
      qc.invalidateQueries({ queryKey: issuerCredentialsKey }),
    ]);
}

export function useDecideRequest() {
  const refresh = useIssuerRefresh();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: "approve" | "reject"; reason?: string }) =>
      api<{ credentialId?: string; txHash?: string | null }>(
        `/issuer/verification-requests/${id}/${decision}`,
        {
          method: "POST",
          ...(decision === "reject" ? { body: JSON.stringify({ reason }) } : {}),
        },
      ),
    onSuccess: refresh,
  });
}

export function useIssuerCredentials() {
  return useQuery({
    queryKey: issuerCredentialsKey,
    queryFn: () => api<CredentialView[]>("/issuer/credentials"),
  });
}

export function useRevokeCredential() {
  const refresh = useIssuerRefresh();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<{ txHash: string | null }>(`/issuer/credentials/${id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: refresh,
  });
}

// ----- W6: AI (always a draft or suggestion; the user decides) -----

export interface AiEnvelope<T> {
  aiGenerated: true;
  promptVersion: string;
  model: string;
  result: T;
  removed: string[];
}
export interface AiSummary {
  headline: string;
  summary: string;
  citations: string[];
  grounded: boolean;
}
export interface AiCv {
  sections: { title: string; items: { text: string; citations: string[] }[] }[];
}
export interface AiTailor {
  matched: { skill: string; evidenceId: string }[];
  gaps: { skill: string; note: string }[];
  cv: string;
}
export interface AiClaimCheck {
  claims: {
    claimId: string;
    claim: string;
    status: string;
    evidenceIds: string[];
    confidence: number;
    reason: string;
  }[];
}

const post = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

export function useAiSummary() {
  return useMutation({
    mutationFn: (freeText?: string) =>
      post<AiEnvelope<AiSummary>>("/ai/summary", freeText ? { freeText } : {}),
  });
}

export function useAiCv() {
  return useMutation({
    mutationFn: (jobDescription?: string) =>
      post<(AiEnvelope<AiCv> & { mode: "cv" }) | (AiEnvelope<AiTailor> & { mode: "tailor" })>(
        "/ai/cv",
        jobDescription ? { jobDescription } : {},
      ),
  });
}

export function useClassifyEvidence() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (evidenceId: string) =>
      post<AiEnvelope<{ type: string; confidence: number; rationale: string }>>("/ai/classify-evidence", {
        evidenceId,
      }),
    onSuccess: refresh,
  });
}

export function useClaimCheck() {
  return useMutation({ mutationFn: () => post<AiEnvelope<AiClaimCheck>>("/ai/claim-check", {}) });
}

export function useIssuerClaimCheck() {
  return useMutation({
    mutationFn: (requestId: string) =>
      api<AiEnvelope<AiClaimCheck> & { note: string }>(
        `/issuer/verification-requests/${requestId}/claim-check`,
      ),
  });
}

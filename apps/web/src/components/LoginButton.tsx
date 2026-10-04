"use client";

import { Button } from "@proven/ui";
import { useAppKit } from "@reown/appkit/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useConnect, useSignMessage, useSwitchChain } from "wagmi";
import { api, ApiError } from "@/lib/api";
import { sessionKey } from "@/lib/session";
import { hasAppKit, targetChain } from "@/lib/wallet";

type Step = "idle" | "connecting" | "signing" | "verifying";

const STEP_LABEL: Record<Step, string> = {
  idle: "Masuk dengan wallet",
  connecting: "Menghubungkan wallet…",
  signing: "Tanda tangani pesan di wallet…",
  verifying: "Memverifikasi…",
};

function AppKitConnect({ onOpen }: { onOpen: (open: () => void) => void }) {
  const { open } = useAppKit();
  useEffect(() => onOpen(() => void open()), [open, onOpen]);
  return null;
}

/** Connect wallet → nonce → sign EIP-4361 message → verify → /dashboard. */
export function LoginButton({ tone = "light" }: { tone?: "light" | "dark" } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const openModal = useRef<() => void>();
  const pendingLogin = useRef(false);
  // useAppKit only works in the browser after createAppKit ran.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function signIn(account: `0x${string}`, currentChainId: number | undefined) {
    setError(null);
    try {
      if (currentChainId !== targetChain.id) await switchChainAsync({ chainId: targetChain.id });
      setStep("signing");
      const { nonce } = await api<{ nonce: string }>("/auth/siwe/nonce", {
        method: "POST",
        body: JSON.stringify({ address: account, chainId: targetChain.id }),
      });
      const message = createSiweMessage({
        domain: window.location.host,
        address: account,
        statement: "Masuk ke Proven. Tanda tangan ini gratis dan tidak mengirim transaksi.",
        uri: window.location.origin,
        version: "1",
        chainId: targetChain.id,
        nonce,
        issuedAt: new Date(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000),
      });
      const signature = await signMessageAsync({ message });
      setStep("verifying");
      await api("/auth/siwe/verify", { method: "POST", body: JSON.stringify({ message, signature }) });
      await queryClient.invalidateQueries({ queryKey: sessionKey });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login dibatalkan atau gagal. Coba lagi.");
    } finally {
      setStep("idle");
    }
  }

  // AppKit connects asynchronously in its modal; continue the login once it reports an account.
  useEffect(() => {
    if (pendingLogin.current && isConnected && address) {
      pendingLogin.current = false;
      void signIn(address, chainId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, chainId]);

  async function onClick() {
    if (isConnected && address) return signIn(address, chainId);
    setStep("connecting");
    setError(null);
    if (hasAppKit) {
      pendingLogin.current = true;
      openModal.current?.();
      setStep("idle");
      return;
    }
    const injectedConnector = connectors[0];
    if (!injectedConnector) {
      setStep("idle");
      setError("Wallet tidak ditemukan. Pasang MetaMask lalu muat ulang halaman.");
      return;
    }
    try {
      const result = await connectAsync({ connector: injectedConnector, chainId: targetChain.id });
      await signIn(result.accounts[0], result.chainId);
    } catch {
      setStep("idle");
      setError("Wallet tidak terhubung. Coba lagi.");
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${tone === "dark" ? "items-start" : "items-center"}`}>
      {hasAppKit && mounted && <AppKitConnect onOpen={(open) => (openModal.current = open)} />}
      <Button
        variant={tone === "dark" ? "inverse" : "primary"}
        className={tone === "dark" ? "h-12 px-6 text-base" : undefined}
        onClick={onClick}
        disabled={step !== "idle"}
        aria-busy={step !== "idle"}
      >
        {STEP_LABEL[step]}
      </Button>
      {error && (
        <p role="alert" className={`text-sm ${tone === "dark" ? "text-red-200" : "text-red-700"}`}>
          {error}
        </p>
      )}
    </div>
  );
}

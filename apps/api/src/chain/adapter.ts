import { credentialRegistryAbi, issuerRegistryAbi } from "@proven/contracts";
import type { PrismaClient } from "@proven/db";
import { anchorFromTuple, type Anchor } from "@proven/vc";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddressEqual,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet, foundry } from "viem/chains";
import type { Config } from "../config";
import { problem, ProblemError } from "../problem";

export interface TxResult {
  txHash: Hex | null;
  blockNumber: bigint | null;
  /** True when nothing was sent because the chain already had this state (idempotency). */
  existing: boolean;
}

export interface ChainAdapter {
  chainId: number;
  registryAddress: Address;
  /** The backend relay's issuer account (server-only key), or null when read-only. */
  issuerAccount: LocalAccount | null;
  isIssuerActive(address: Address): Promise<boolean>;
  getAnchor(credentialHash: Hex): Promise<Anchor | null>;
  isRevoked(credentialHash: Hex): Promise<boolean>;
  anchorCredential(credentialHash: Hex, subjectRef: Hex): Promise<TxResult>;
  revokeCredential(credentialHash: Hex): Promise<TxResult>;
}

/** 1 confirmation on Anvil, 2 on BSC Testnet (§W4). */
export const confirmationsFor = (chainId: number) => (chainId === foundry.id ? 1 : 2);

const ISSUER_CACHE_MS = 60_000;
const LOG_CHUNK = 5_000n;
const LOG_LOOKBACK = 200_000n;

export function chainFor(chainId: number, rpcUrl: string): Chain {
  const known = [bscTestnet, foundry].find((c) => c.id === chainId);
  const base =
    known ??
    defineChain({
      id: chainId,
      name: `Chain ${chainId}`,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });
  return { ...base, rpcUrls: { ...base.rpcUrls, default: { http: [rpcUrl] } } };
}

/** Maps viem/contract failures to RFC 9457 problems. */
export function toProblem(error: unknown): ProblemError {
  if (error instanceof ProblemError) return error;
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const reason = revert.reason ?? revert.data?.errorName ?? "reverted";
      if (reason === "EXISTS") return problem(409, "already-anchored", "Credential hash is already anchored");
      if (reason === "NOT_ACTIVE_ISSUER") return problem(403, "forbidden", "Issuer is not active on-chain");
      if (reason === "NOT_ISSUER")
        return problem(403, "forbidden", "Only the issuing issuer or admin can revoke");
      if (reason === "NOT_FOUND") return problem(404, "not-found", "Credential hash is not anchored");
      if (reason === "ZERO_HASH") return problem(400, "validation-error", "Hash must not be zero");
      return problem(502, "chain-unavailable", `Contract reverted: ${reason}`);
    }
    return problem(502, "chain-unavailable", error.shortMessage);
  }
  return problem(502, "chain-unavailable", "Chain request failed");
}

interface AdapterDeps {
  chainId: number;
  rpcUrl: string;
  registryAddress: Address;
  issuerRegistryAddress: Address;
  issuerPrivateKey?: Hex;
  prisma: PrismaClient;
  publicClient?: PublicClient;
}

export function createChainAdapter(deps: AdapterDeps): ChainAdapter {
  const chain = chainFor(deps.chainId, deps.rpcUrl);
  const publicClient =
    deps.publicClient ?? (createPublicClient({ chain, transport: http(deps.rpcUrl) }) as PublicClient);
  const account = deps.issuerPrivateKey ? privateKeyToAccount(deps.issuerPrivateKey) : null;
  const walletClient = account ? createWalletClient({ account, chain, transport: http(deps.rpcUrl) }) : null;
  const registry = { address: deps.registryAddress, abi: credentialRegistryAbi } as const;
  const issuerCache = new Map<string, { value: boolean; expires: number }>();
  const confirmations = confirmationsFor(deps.chainId);

  const call = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      throw toProblem(error);
    }
  };

  async function getAnchor(credentialHash: Hex) {
    const tuple = await call(() =>
      publicClient.readContract({ ...registry, functionName: "getAnchor", args: [credentialHash] }),
    );
    return anchorFromTuple(tuple);
  }

  /** Finds the tx of an earlier event by scanning backwards in RPC-friendly chunks. */
  async function findEvent(eventName: "CredentialIssued" | "CredentialRevoked", credentialHash: Hex) {
    const latest = await call(() => publicClient.getBlockNumber());
    const floor = latest > LOG_LOOKBACK ? latest - LOG_LOOKBACK : 0n;
    for (let to = latest; to >= floor; to -= LOG_CHUNK) {
      const from = to - LOG_CHUNK + 1n > floor ? to - LOG_CHUNK + 1n : floor;
      const logs = await call(() =>
        publicClient.getContractEvents({
          ...registry,
          eventName,
          args: { credentialHash },
          fromBlock: from,
          toBlock: to,
        }),
      );
      const log = logs.at(-1);
      if (log) return { txHash: log.transactionHash, blockNumber: log.blockNumber };
      if (from === floor) break;
    }
    return { txHash: null, blockNumber: null };
  }

  /**
   * Serialises transactions of this issuer across serverless instances (D-006): the advisory
   * lock is held for the whole send + receipt wait, and the nonce is read as "pending".
   */
  async function withIssuerLock<T>(fn: () => Promise<T>): Promise<T> {
    return deps.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`proven-issuer:${account!.address}`}))`;
        return fn();
      },
      { maxWait: 30_000, timeout: 120_000 },
    );
  }

  async function confirm(txHash: Hex): Promise<TxResult> {
    const receipt = await call(() =>
      publicClient.waitForTransactionReceipt({ hash: txHash, confirmations, timeout: 90_000 }),
    );
    if (receipt.status !== "success")
      throw problem(502, "chain-unavailable", `Transaction ${txHash} reverted`);
    return { txHash, blockNumber: receipt.blockNumber, existing: false };
  }

  const pendingNonce = () =>
    call(() => publicClient.getTransactionCount({ address: account!.address, blockTag: "pending" }));

  async function sendIssue(credentialHash: Hex, subjectRef: Hex): Promise<TxResult> {
    // Simulate first so contract reverts (EXISTS, NOT_ACTIVE_ISSUER…) surface as problems before sending.
    const { request } = await call(() =>
      publicClient.simulateContract({
        ...registry,
        functionName: "issue",
        args: [credentialHash, subjectRef],
        account: account!,
      }),
    );
    const nonce = await pendingNonce();
    return confirm(await call(() => walletClient!.writeContract({ ...request, nonce })));
  }

  async function sendRevoke(credentialHash: Hex): Promise<TxResult> {
    const { request } = await call(() =>
      publicClient.simulateContract({
        ...registry,
        functionName: "revoke",
        args: [credentialHash],
        account: account!,
      }),
    );
    const nonce = await pendingNonce();
    return confirm(await call(() => walletClient!.writeContract({ ...request, nonce })));
  }

  const requireSigner = () => {
    if (!account || !walletClient)
      throw problem(502, "chain-unavailable", "ISSUER_PRIVATE_KEY is not configured");
  };

  return {
    chainId: deps.chainId,
    registryAddress: deps.registryAddress,
    issuerAccount: account,

    async isIssuerActive(address) {
      const key = address.toLowerCase();
      const cached = issuerCache.get(key);
      if (cached && cached.expires > Date.now()) return cached.value;
      const value = await call(() =>
        publicClient.readContract({
          address: deps.issuerRegistryAddress,
          abi: issuerRegistryAbi,
          functionName: "isActive",
          args: [address],
        }),
      );
      // Best-effort per-instance cache (serverless instances do not share memory).
      issuerCache.set(key, { value, expires: Date.now() + ISSUER_CACHE_MS });
      return value;
    },

    getAnchor,

    async isRevoked(credentialHash) {
      return call(() =>
        publicClient.readContract({ ...registry, functionName: "isRevoked", args: [credentialHash] }),
      );
    },

    async anchorCredential(credentialHash, subjectRef) {
      requireSigner();
      const existing = async (): Promise<TxResult | null> => {
        const anchor = await getAnchor(credentialHash);
        if (!anchor) return null;
        if (!isAddressEqual(anchor.issuer, account!.address)) {
          throw problem(409, "already-anchored", "Credential hash was anchored by another issuer");
        }
        if (anchor.subjectRef.toLowerCase() !== subjectRef.toLowerCase()) {
          throw problem(409, "already-anchored", "Credential hash is anchored for another subject");
        }
        return { ...(await findEvent("CredentialIssued", credentialHash)), existing: true };
      };
      const before = await existing();
      if (before) return before;
      return withIssuerLock(async () => (await existing()) ?? sendIssue(credentialHash, subjectRef));
    },

    async revokeCredential(credentialHash) {
      requireSigner();
      const existing = async (): Promise<TxResult | null> => {
        const anchor = await getAnchor(credentialHash);
        if (!anchor) throw problem(404, "not-found", "Credential hash is not anchored");
        return anchor.revoked
          ? { ...(await findEvent("CredentialRevoked", credentialHash)), existing: true }
          : null;
      };
      const before = await existing();
      if (before) return before;
      return withIssuerLock(async () => (await existing()) ?? sendRevoke(credentialHash));
    },
  };
}

/** Builds the adapter from config, or null while contracts are not configured yet. */
export function chainFromConfig(config: Config, prisma: PrismaClient): ChainAdapter | null {
  if (!config.registryAddress || !config.issuerRegistryAddress) return null;
  return createChainAdapter({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    registryAddress: config.registryAddress,
    issuerRegistryAddress: config.issuerRegistryAddress,
    issuerPrivateKey: config.issuerPrivateKey,
    prisma,
  });
}

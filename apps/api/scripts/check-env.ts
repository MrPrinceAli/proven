// pnpm check:env — BSC Testnet readiness checklist (§W8 1). Read-only: never sends a transaction.
// Prints what is missing; exits 1 when a required item fails. Also run by ops.yml (task check-env).
import { issuerRegistryAbi } from "@proven/contracts";
import { createPublicClient, formatEther, getAddress, http, isAddress, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

type Row = { ok: boolean | "warn"; label: string; hint?: string };
const rows: Row[] = [];
const check = (ok: boolean | "warn", label: string, hint?: string) => rows.push({ ok, label, hint });
const env = (n: string) => process.env[n]?.trim() || "";

const rpcUrl =
  env("BSC_TESTNET_RPC_URL") || env("RPC_URL") || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const client = createPublicClient({ chain: bscTestnet, transport: http(rpcUrl) });
const MIN_ISSUER = parseEther("0.005");
const MIN_DEPLOYER = parseEther("0.01");

check(
  !env("CHAIN_ID") || env("CHAIN_ID") === "97",
  "CHAIN_ID = 97",
  "Set CHAIN_ID=97 dan NEXT_PUBLIC_CHAIN_ID=97 di Vercel.",
);

let chainOk = false;
try {
  chainOk = (await client.getChainId()) === 97;
  check(chainOk, `RPC ${new URL(rpcUrl).host} menjawab sebagai BSC Testnet (97)`);
} catch {
  check(false, `RPC ${rpcUrl} bisa dihubungi`, "Pakai RPC lain (Alchemy/QuickNode) di BSC_TESTNET_RPC_URL.");
}

const address = (name: string): Address | null => (isAddress(env(name)) ? getAddress(env(name)) : null);

async function hasCode(name: string) {
  const a = address(name);
  if (!a)
    return check(false, `${name} diisi`, "Jalankan Actions → ops → deploy-contracts, lalu salin address.");
  if (!chainOk) return check("warn", `${name} punya kode kontrak (dilewati: RPC bermasalah)`);
  const code = await client.getCode({ address: a });
  check(Boolean(code && code !== "0x"), `${name} = ${a} adalah kontrak di BSC Testnet`);
}

async function balance(label: string, a: Address | null, min: bigint, hint: string) {
  if (!a) return check(false, `${label}: address tersedia`, hint);
  if (!chainOk) return check("warn", `${label}: saldo (dilewati: RPC bermasalah)`);
  const wei = await client.getBalance({ address: a });
  check(
    wei >= min,
    `${label} ${a}: ${formatEther(wei)} tBNB (min ${formatEther(min)})`,
    "Isi dari faucet BSC Testnet.",
  );
}

await hasCode("ISSUER_REGISTRY_ADDRESS");
await hasCode("REGISTRY_ADDRESS");

const issuer = address("ISSUER_ADDRESS");
check(Boolean(issuer), "ISSUER_ADDRESS valid (EIP-55)");
const did = env("ISSUER_DID");
if (issuer && did)
  check(did === `did:ethr:97:${issuer.toLowerCase()}`, "ISSUER_DID = did:ethr:97:{address lowercase}");
await balance("Issuer", issuer, MIN_ISSUER, "Isi ISSUER_ADDRESS.");

if (issuer && address("ISSUER_REGISTRY_ADDRESS") && chainOk) {
  const active = await client.readContract({
    address: address("ISSUER_REGISTRY_ADDRESS")!,
    abi: issuerRegistryAbi,
    functionName: "isActive",
    args: [issuer],
  });
  check(active, "Issuer aktif di IssuerRegistry", "Jalankan ops → deploy-contracts atau issuer-register.");
}

const deployerKey = env("DEPLOYER_PRIVATE_KEY");
const deployer = /^0x[0-9a-fA-F]{64}$/.test(deployerKey)
  ? privateKeyToAccount(deployerKey as `0x${string}`).address
  : address("DEPLOYER_ADDRESS");
if (deployer) await balance("Deployer", deployer, MIN_DEPLOYER, "");
else check("warn", "Deployer tidak diperiksa (DEPLOYER_PRIVATE_KEY/DEPLOYER_ADDRESS tidak ada)");

const pub = address("NEXT_PUBLIC_REGISTRY_ADDRESS");
if (env("NEXT_PUBLIC_REGISTRY_ADDRESS")) {
  check(
    pub !== null && pub === address("REGISTRY_ADDRESS"),
    "NEXT_PUBLIC_REGISTRY_ADDRESS = REGISTRY_ADDRESS",
  );
}

for (const r of rows) {
  const icon = r.ok === true ? "✅" : r.ok === "warn" ? "⚠️ " : "❌";
  console.log(`${icon} ${r.label}${r.ok === false && r.hint ? `\n   → ${r.hint}` : ""}`);
}
const failed = rows.filter((r) => r.ok === false).length;
console.log(failed ? `\n${failed} item belum siap.` : "\nSemua siap untuk BSC Testnet.");
process.exit(failed ? 1 : 0);

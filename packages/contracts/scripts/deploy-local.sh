#!/usr/bin/env bash
# Deploy ke Anvil (chainId 31337) memakai akun default Anvil — kunci publik, aman hanya untuk chain lokal/CI.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="$(cast chain-id --rpc-url "$RPC_URL")"
if [ "$CHAIN_ID" != "31337" ]; then
  echo "deploy-local hanya untuk Anvil (31337), RPC menunjuk chain $CHAIN_ID" >&2
  exit 1
fi

# Anvil #0 = deployer/admin, Anvil #1 = issuer.
export DEPLOYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export ISSUER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
export ISSUER_NAME="${ISSUER_NAME:-XYZ Community}"
export ISSUER_DID="did:ethr:31337:0x70997970c51812dc3a010c7d01b50e0d17dc79c8"

forge script script/Deploy.s.sol:DeployProven --rpc-url "$RPC_URL" --broadcast --silent

ISSUER_REGISTRY_ADDRESS="$(node -p "require('./deployments/31337.json').issuerRegistry")"
export ISSUER_REGISTRY_ADDRESS
forge script script/RegisterIssuer.s.sol:RegisterIssuer --rpc-url "$RPC_URL" --broadcast --silent

echo "deployments/31337.json:"
cat deployments/31337.json

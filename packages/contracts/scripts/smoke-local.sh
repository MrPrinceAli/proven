#!/usr/bin/env bash
# Smoke test §S8.6 terhadap Anvil: isActive → issue → getAnchor → isRevoked false → revoke → isRevoked true.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
ISSUER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
ISSUER_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" # Anvil #1 (publik)
ISSUER_REGISTRY_ADDRESS="$(node -p "require('./deployments/31337.json').issuerRegistry")"
REGISTRY_ADDRESS="$(node -p "require('./deployments/31337.json').credentialRegistry")"

expect() {
  if [ "$2" != "$3" ]; then
    echo "FAIL $1: expected $3, got $2" >&2
    exit 1
  fi
  echo "ok   $1 = $2"
}

expect "isActive(issuer)" "$(cast call "$ISSUER_REGISTRY_ADDRESS" "isActive(address)(bool)" "$ISSUER_ADDRESS" --rpc-url "$RPC_URL")" "true"

# Hash dummy hanya untuk smoke test; produksi = sha256(JCS(vc)) dari packages/vc. Unik per run agar bisa diulang.
VC_HASH="$(cast keccak "urn:uuid:smoke-$(date +%s%N)")"
SUBJECT_REF="$(cast keccak "did:ethr:31337:0xsubject")"

cast send "$REGISTRY_ADDRESS" "issue(bytes32,bytes32)" "$VC_HASH" "$SUBJECT_REF" \
  --rpc-url "$RPC_URL" --private-key "$ISSUER_PRIVATE_KEY" > /dev/null
ANCHOR="$(cast call "$REGISTRY_ADDRESS" "getAnchor(bytes32)(bytes32,bytes32,address,uint64,bool)" "$VC_HASH" --rpc-url "$RPC_URL")"
expect "getAnchor.credentialHash" "$(echo "$ANCHOR" | sed -n 1p)" "$VC_HASH"
expect "getAnchor.subjectRef" "$(echo "$ANCHOR" | sed -n 2p)" "$SUBJECT_REF"
expect "getAnchor.issuer" "$(echo "$ANCHOR" | sed -n 3p)" "$ISSUER_ADDRESS"
expect "isRevoked (before)" "$(cast call "$REGISTRY_ADDRESS" "isRevoked(bytes32)(bool)" "$VC_HASH" --rpc-url "$RPC_URL")" "false"

cast send "$REGISTRY_ADDRESS" "revoke(bytes32)" "$VC_HASH" \
  --rpc-url "$RPC_URL" --private-key "$ISSUER_PRIVATE_KEY" > /dev/null
expect "isRevoked (after)" "$(cast call "$REGISTRY_ADDRESS" "isRevoked(bytes32)(bool)" "$VC_HASH" --rpc-url "$RPC_URL")" "true"

echo "smoke test OK"

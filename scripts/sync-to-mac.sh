#!/usr/bin/env bash
# Sync LuminaDeck source + ASC API key from the Windows PC to the Mac.
# Mirrors CLAUDE.md's recipe but bundles the .keys/ transfer too.

set -euo pipefail

MAC_USER="rsaczr"
MAC_HOST="10.0.0.50"
MAC_REPO="\$HOME/LuminaDeck"

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$REPO_ROOT"

echo "[1/3] Tarring source (excluding node_modules / target / .git / .keys / installers)…"
TAR=/tmp/ld-sync.tar.gz
tar czf "$TAR" \
  --exclude='node_modules' \
  --exclude='target' \
  --exclude='.git' \
  --exclude='.keys' \
  --exclude='*.msix' \
  --exclude='*.exe' \
  --exclude='*.msi' \
  apps/mobile packages/shared scripts \
  package.json pnpm-workspace.yaml pnpm-lock.yaml \
  tsconfig.base.json turbo.json .npmrc

echo "[2/3] scp + extract on Mac…"
scp "$TAR" "$MAC_USER@$MAC_HOST:/tmp/"
ssh "$MAC_USER@$MAC_HOST" "mkdir -p $MAC_REPO && cd $MAC_REPO && tar xzf /tmp/ld-sync.tar.gz"

echo "[3/3] Syncing ASC API key (.keys/) to ~/.keys/ on Mac…"
ssh "$MAC_USER@$MAC_HOST" "mkdir -p \$HOME/.keys && chmod 700 \$HOME/.keys"
scp .keys/AuthKey_*.p8 "$MAC_USER@$MAC_HOST:~/.keys/"
ssh "$MAC_USER@$MAC_HOST" 'chmod 600 ~/.keys/AuthKey_*.p8'

echo "✅ Sync complete. Now SSH into Mac and run scripts/ios-archive-and-upload.sh"

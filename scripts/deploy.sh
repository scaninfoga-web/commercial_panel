#!/usr/bin/env bash
# =============================================================================
# Commercial Panel — Local Deploy Script
# Pushes code from local machine directly to EC2 server (no GitHub keys needed)
# Usage: bash scripts/deploy.sh
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SSH_KEY="${SSH_KEY:-$HOME/.ssh/jatin.pem}"
SERVER_USER="ubuntu"
SERVER_IP="13.234.26.49"
SERVER_DIR="/home/ubuntu/frontend_deployed/commercial_panel"
HOST_PORT=3009
CONTAINER_PORT=3009
CONTAINER_NAME="commercial_panel"
IMAGE_NAME="commercial-panel"
NETWORK="scaninfoga-network"
REPO_BRANCH="main"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
err()  { printf "${RED}ERROR: %s${NC}\n" "$*" >&2; }
info() { printf "${GREEN}%s${NC}\n" "$*"; }
warn() { printf "${YELLOW}%s${NC}\n" "$*"; }
head() { printf "\n${BLUE}── %s ──${NC}\n" "$*"; }

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [[ ! -f "package.json" ]] || [[ ! -f "Dockerfile" ]]; then
  err "Run this from the project root (package.json + Dockerfile must exist)"
  exit 1
fi

if [[ ! -f "$SSH_KEY" ]]; then
  err "SSH key not found at $SSH_KEY"
  err "Set custom path: SSH_KEY=/path/to/jatin.pem bash scripts/deploy.sh"
  exit 1
fi

ENV_FILE=""
[[ -f ".env" ]] && ENV_FILE=".env"
[[ -f ".env.local" ]] && ENV_FILE=".env.local"
if [[ -z "$ENV_FILE" ]]; then
  err ".env or .env.local not found in project root"
  exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  Commercial Panel — Deploy"
echo "=========================================="
echo "  Server:   ${SERVER_USER}@${SERVER_IP}"
echo "  Folder:   ${SERVER_DIR}"
echo "  Port:     ${HOST_PORT}"
echo "  Env file: ${ENV_FILE}"
echo "=========================================="

# ── PHASE 1: Git commit + push (optional) ────────────────────────────────────
head "Phase 1: Git status"

if git rev-parse --git-dir > /dev/null 2>&1; then
  DIRTY=$(git status --short | wc -l | tr -d ' ')
  if [[ "$DIRTY" -gt 0 ]]; then
    git status --short | sed 's/^/    /'
    echo ""
    read -rp "Commit message (Enter = skip commit): " COMMIT_MSG
    if [[ -n "$COMMIT_MSG" ]]; then
      git add -A
      git commit -m "$COMMIT_MSG" --quiet
      info "Committed: $(git rev-parse --short=8 HEAD)"
      info "Pushing to origin/${REPO_BRANCH}..."
      git push origin "$REPO_BRANCH" || warn "Push failed — continuing anyway"
    else
      info "Skipping commit — using current HEAD"
    fi
  else
    info "Nothing to commit"
  fi
else
  warn "Not a git repo — skipping git phase"
fi

# ── PHASE 2: Build tarball (excludes everything heavy) ───────────────────────
head "Phase 2: Packaging project"

TARBALL="/tmp/commercial_panel_$(date +%s).tar.gz"
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='*.log' \
    --exclude='tsconfig.tsbuildinfo' \
    --exclude='.DS_Store' \
    --exclude='.vscode' \
    --exclude='.idea' \
    --exclude='scripts/deploy.sh' \
    -czf "$TARBALL" .

SIZE=$(du -h "$TARBALL" | cut -f1)
info "Tarball: $TARBALL ($SIZE)"

# ── PHASE 3: SSH reachability ────────────────────────────────────────────────
head "Phase 3: SSH check"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o ServerAliveInterval=30)
rssh() { ssh "${SSH_OPTS[@]}" "${SERVER_USER}@${SERVER_IP}" "$@"; }

if ! rssh "true" > /dev/null 2>&1; then
  err "Cannot SSH to ${SERVER_USER}@${SERVER_IP} with key ${SSH_KEY}"
  rm -f "$TARBALL"
  exit 1
fi
info "Server reachable"

# ── PHASE 4: Upload + extract ────────────────────────────────────────────────
head "Phase 4: Uploading project"

rssh "mkdir -p ${SERVER_DIR}"
scp "${SSH_OPTS[@]}" "$TARBALL" "${SERVER_USER}@${SERVER_IP}:/tmp/deploy.tar.gz" > /dev/null

rssh "cd ${SERVER_DIR} && tar -xzf /tmp/deploy.tar.gz && rm -f /tmp/deploy.tar.gz"
info "Extracted to ${SERVER_DIR}"

# ── PHASE 5: Upload .env ─────────────────────────────────────────────────────
head "Phase 5: Uploading .env"

scp "${SSH_OPTS[@]}" "$ENV_FILE" "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/.env" > /dev/null
rssh "chmod 600 ${SERVER_DIR}/.env"
info ".env uploaded securely"

# ── PHASE 6: Remote build + deploy ───────────────────────────────────────────
head "Phase 6: Remote build & deploy"

rssh "export SERVER_DIR='${SERVER_DIR}' CONTAINER_NAME='${CONTAINER_NAME}' IMAGE_NAME='${IMAGE_NAME}' NETWORK='${NETWORK}' HOST_PORT='${HOST_PORT}' CONTAINER_PORT='${CONTAINER_PORT}'; bash -s" <<'REMOTE'
set -euo pipefail

cd "$SERVER_DIR"
ENV_FILE="${SERVER_DIR}/.env"

echo ""
echo "--- Reading build args from .env ---"
NEXT_PUBLIC_BACKEND_URL=$(grep -E '^NEXT_PUBLIC_BACKEND_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)
NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY=$(grep -E '^NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)
NEXT_PUBLIC_VIDEO_KYC_URL=$(grep -E '^NEXT_PUBLIC_VIDEO_KYC_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)

echo "  NEXT_PUBLIC_BACKEND_URL:         ${NEXT_PUBLIC_BACKEND_URL:-EMPTY}"
echo "  NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY: ${NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY:+SET}"
echo "  NEXT_PUBLIC_VIDEO_KYC_URL:       ${NEXT_PUBLIC_VIDEO_KYC_URL:-EMPTY}"

if [[ -z "$NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY" ]]; then
  echo "WARN: NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY missing — encrypted endpoints may fail"
fi

echo ""
echo "--- Ensuring Docker network ---"
docker network inspect "$NETWORK" > /dev/null 2>&1 || docker network create "$NETWORK"

echo ""
echo "--- Building image (this can take 3-5 minutes) ---"
T0=$(date +%s)
docker build \
  --tag "${IMAGE_NAME}:latest" \
  --build-arg NEXT_PUBLIC_BACKEND_URL="$NEXT_PUBLIC_BACKEND_URL" \
  --build-arg NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY="$NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY" \
  --build-arg NEXT_PUBLIC_VIDEO_KYC_URL="$NEXT_PUBLIC_VIDEO_KYC_URL" \
  --progress plain \
  .
echo "Built in $(( $(date +%s) - T0 ))s"

echo ""
echo "--- Replacing container ---"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  -e NODE_ENV=production \
  -e PORT="$CONTAINER_PORT" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  --security-opt no-new-privileges:true \
  --log-opt max-size=50m \
  --log-opt max-file=5 \
  "${IMAGE_NAME}:latest" > /dev/null

echo ""
echo "--- Container status ---"
sleep 2
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "--- Pruning old images ---"
docker image prune -f --filter "until=24h" > /dev/null 2>&1 || true

echo ""
echo "--- Recent logs ---"
docker logs --tail 15 "$CONTAINER_NAME" 2>&1 || true
REMOTE

# ── PHASE 7: Cleanup ─────────────────────────────────────────────────────────
rm -f "$TARBALL"

echo ""
info "=========================================="
info "  Deploy Complete"
info "=========================================="
info "  URL: http://${SERVER_IP}:${HOST_PORT}"
info "=========================================="
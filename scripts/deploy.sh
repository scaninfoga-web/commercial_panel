#!/usr/bin/env bash
# =============================================================================
# Commercial Panel — Local Deploy Script
# Pushes code from local machine directly to EC2 server (no GitHub keys needed)
#
# Features:
#   - Optional git commit + push
#   - Tarball package → SCP → remote extract
#   - Docker image built with timestamp tag (enables rollback)
#   - Health check after container swap (auto-rollback on failure)
#   - Keeps last 5 image tags; prunes older ones
#
# Usage: bash scripts/deploy.sh
#        SSH_KEY=/path/to/jatin.pem bash scripts/deploy.sh
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
HEALTH_CHECK_ATTEMPTS=6   # × 2 sec = up to 12 sec
KEEP_IMAGES=5             # number of timestamped images to retain

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; MAGENTA='\033[0;35m'; NC='\033[0m'
err()  { printf "${RED}ERROR: %s${NC}\n" "$*" >&2; }
info() { printf "${GREEN}%s${NC}\n" "$*"; }
warn() { printf "${YELLOW}%s${NC}\n" "$*"; }
head() { printf "\n${BLUE}── %s ──${NC}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$*"; }
fail() { printf "${RED}✗ %s${NC}\n" "$*"; }

# ── Global cleanup trap ──────────────────────────────────────────────────────
TARBALL=""
cleanup() {
  local exit_code=$?
  [[ -n "${TARBALL:-}" && -f "$TARBALL" ]] && rm -f "$TARBALL" 2>/dev/null || true
  if [[ "$exit_code" -ne 0 ]]; then
    echo ""
    printf "${RED}════════════════════════════════════════════${NC}\n"
    printf "${RED}  ✗ DEPLOY FAILED (exit code: ${exit_code})${NC}\n"
    printf "${RED}════════════════════════════════════════════${NC}\n"
  fi
}
trap cleanup EXIT

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
  exit 1
fi
ok "Server reachable"

# ── PHASE 4: Upload + extract ────────────────────────────────────────────────
head "Phase 4: Uploading project"

rssh "mkdir -p ${SERVER_DIR}"
scp "${SSH_OPTS[@]}" "$TARBALL" "${SERVER_USER}@${SERVER_IP}:/tmp/deploy.tar.gz" > /dev/null

rssh "cd ${SERVER_DIR} && tar -xzf /tmp/deploy.tar.gz && rm -f /tmp/deploy.tar.gz"
ok "Extracted to ${SERVER_DIR}"

# ── PHASE 5: Upload .env ─────────────────────────────────────────────────────
head "Phase 5: Uploading .env"

scp "${SSH_OPTS[@]}" "$ENV_FILE" "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/.env" > /dev/null
rssh "chmod 600 ${SERVER_DIR}/.env"
ok ".env uploaded securely"

# ── PHASE 6: Remote build + deploy ───────────────────────────────────────────
head "Phase 6: Remote build & deploy"

rssh "export SERVER_DIR='${SERVER_DIR}' CONTAINER_NAME='${CONTAINER_NAME}' IMAGE_NAME='${IMAGE_NAME}' NETWORK='${NETWORK}' HOST_PORT='${HOST_PORT}' CONTAINER_PORT='${CONTAINER_PORT}' HEALTH_CHECK_ATTEMPTS='${HEALTH_CHECK_ATTEMPTS}' KEEP_IMAGES='${KEEP_IMAGES}'; bash -s" <<'REMOTE'
set -euo pipefail

cd "$SERVER_DIR"
ENV_FILE="${SERVER_DIR}/.env"
ROLLBACK_IMAGE="${IMAGE_NAME}:rollback"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { printf "${GREEN}%s${NC}\n" "$*"; }
warn() { printf "${YELLOW}%s${NC}\n" "$*"; }
err()  { printf "${RED}%s${NC}\n" "$*" >&2; }
head() { printf "\n${BLUE}── %s ──${NC}\n" "$*"; }

# ─── 6.1 Read build args from .env ────────────────────────────────────────────
head "6.1 Reading build args from .env"
NEXT_PUBLIC_BACKEND_URL=$(grep -E '^NEXT_PUBLIC_BACKEND_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)
NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY=$(grep -E '^NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)
NEXT_PUBLIC_VIDEO_KYC_URL=$(grep -E '^NEXT_PUBLIC_VIDEO_KYC_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)

echo "  NEXT_PUBLIC_BACKEND_URL:         ${NEXT_PUBLIC_BACKEND_URL:-EMPTY}"
echo "  NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY: ${NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY:+SET}"
echo "  NEXT_PUBLIC_VIDEO_KYC_URL:       ${NEXT_PUBLIC_VIDEO_KYC_URL:-EMPTY}"

if [[ -z "$NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY" ]]; then
  warn "NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY missing — encrypted endpoints may fail"
fi

# ─── 6.2 Ensure Docker network ────────────────────────────────────────────────
head "6.2 Docker network"
docker network inspect "$NETWORK" > /dev/null 2>&1 || docker network create "$NETWORK"
info "Network ${NETWORK} ready"

# ─── 6.3 Save rollback point (before touching the container) ─────────────────
head "6.3 Saving rollback point"
CURRENT_IMAGE=$(docker inspect --format='{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || echo "")
if [[ -n "$CURRENT_IMAGE" ]]; then
  docker tag "$CURRENT_IMAGE" "$ROLLBACK_IMAGE" 2>/dev/null || true
  info "Rollback point: $CURRENT_IMAGE → $ROLLBACK_IMAGE"
else
  warn "No existing container — first deploy (no rollback point)"
fi

# ─── 6.4 Build new image with timestamp tag ──────────────────────────────────
head "6.4 Building image"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
IMAGE_TAG="${IMAGE_NAME}:${TIMESTAMP}"
T0=$(date +%s)

docker build \
  --tag "$IMAGE_TAG" \
  --tag "${IMAGE_NAME}:latest" \
  --build-arg NEXT_PUBLIC_BACKEND_URL="$NEXT_PUBLIC_BACKEND_URL" \
  --build-arg NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY="$NEXT_PUBLIC_RESP_ENC_PUBLIC_KEY" \
  --build-arg NEXT_PUBLIC_VIDEO_KYC_URL="$NEXT_PUBLIC_VIDEO_KYC_URL" \
  --progress plain \
  .

echo "Built in $(( $(date +%s) - T0 ))s"
info "Image: $IMAGE_TAG"

# ─── 6.5 Replace container ───────────────────────────────────────────────────
head "6.5 Replacing container"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true
info "Old container removed"

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
  "$IMAGE_TAG" > /dev/null

info "New container started"

# ─── 6.6 Health check ────────────────────────────────────────────────────────
head "6.6 Health check (up to $((HEALTH_CHECK_ATTEMPTS * 2))s)"
HEALTH_OK=0
HTTP="000"
for i in $(seq 1 "$HEALTH_CHECK_ATTEMPTS"); do
  sleep 2
  if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" -q | grep -q .; then
    echo "  Attempt $i/$HEALTH_CHECK_ATTEMPTS: container not running"
    break
  fi
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" || "$HTTP" == "307" || "$HTTP" == "302" ]]; then
    echo "  Attempt $i/$HEALTH_CHECK_ATTEMPTS: HTTP $HTTP ✓"
    HEALTH_OK=1
    break
  fi
  echo "  Attempt $i/$HEALTH_CHECK_ATTEMPTS: HTTP $HTTP — retrying..."
done

# ─── 6.7 On failure: rollback ────────────────────────────────────────────────
if [[ "$HEALTH_OK" != "1" ]]; then
  echo ""
  err "❌ Health check FAILED (last HTTP: $HTTP)"
  echo ""
  echo "--- Container logs (last 50 lines) ---"
  docker logs --tail 50 "$CONTAINER_NAME" 2>&1 || true
  echo ""

  if docker image inspect "$ROLLBACK_IMAGE" > /dev/null 2>&1; then
    echo "--- Rolling back to previous working image ---"
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
      "$ROLLBACK_IMAGE" > /dev/null

    sleep 3
    ROLLBACK_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${HOST_PORT}" 2>/dev/null || echo "000")
    if [[ "$ROLLBACK_HTTP" == "200" || "$ROLLBACK_HTTP" == "307" || "$ROLLBACK_HTTP" == "302" ]]; then
      info "✅ Rolled back successfully (HTTP $ROLLBACK_HTTP)"
      err "New image was left tagged: $IMAGE_TAG (inspect with 'docker logs $CONTAINER_NAME')"
    else
      err "⚠ Rollback container started but HTTP $ROLLBACK_HTTP — manual check needed"
    fi
  else
    err "⚠ No rollback image available — container left in failed state"
  fi
  exit 1
fi

info "✅ Health check passed (HTTP $HTTP)"

# ─── 6.8 Cleanup old timestamped images (keep last N) ────────────────────────
head "6.8 Cleaning old images"
OLD_IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' \
  | grep "^${IMAGE_NAME}:" \
  | grep -vE ":(latest|rollback)$" \
  | sort -r \
  | tail -n +$((KEEP_IMAGES + 1)) \
  || true)

if [[ -n "$OLD_IMAGES" ]]; then
  echo "$OLD_IMAGES" | while read -r img; do
    [[ -n "$img" ]] && docker rmi "$img" > /dev/null 2>&1 || true
  done
  echo "Removed old timestamped images (kept last $KEEP_IMAGES)"
else
  echo "No old images to clean"
fi

docker image prune -f > /dev/null 2>&1 || true

# ─── 6.9 Final status ────────────────────────────────────────────────────────
head "6.9 Status"
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "--- Recent logs (last 15) ---"
docker logs --tail 15 "$CONTAINER_NAME" 2>&1 || true

echo ""
info "Deployed image: $IMAGE_TAG"
REMOTE

# ── Done (trap handles tarball cleanup) ──────────────────────────────────────
echo ""
info "=========================================="
info "  Deploy Complete"
info "=========================================="
info "  URL: http://${SERVER_IP}:${HOST_PORT}"
info "=========================================="
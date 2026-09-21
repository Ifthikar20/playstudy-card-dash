#!/usr/bin/env bash
# deploy-aws.sh — build the AnotherNotes web app and ship it to the AWS box.
#
#   ./deploy-aws.sh              build, upload, swap the files nginx serves, health-check
#   ./deploy-aws.sh --check      verify key, SSH and the box; change nothing
#   ./deploy-aws.sh --start      start the EC2 instance first if it is stopped
#   ./deploy-aws.sh --no-build   ship dist/ as it is
#
# The API deploys on its own from playstudy-backend (its deploy-aws.sh), which also owns the
# stack definition, so a new box needs one API deploy before the first web deploy. This script
# replaces only the static files and nginx's config (deploy/aws/nginx.conf). No container is
# rebuilt: a changed config is checked with `nginx -t` and reloaded in place.
#
# Settings (environment variables):
#   PS_DEPLOY_HOST   ec2-user@<ip>. Normally left unset: the box has no Elastic IP, so its
#                    address changes on every stop/start, and the script asks AWS for the
#                    current one (instance PS_INSTANCE_ID, region PS_AWS_REGION).
#   PS_DEPLOY_KEY    default ~/.ssh/playstudy-turnstile.pem
#   TURNSTILE_MODE   off (default) | test | real — picks the build (build:off / build:test /
#                    build). A bare IP can only run off or test. It must agree with
#                    TURNSTILE_ENABLED on the box, which the API deploy sets; this script
#                    refuses a combination that would lock everyone out.
#
# Sign-ups: the bundle offers no way to create an account unless it is built with
# VITE_SIGNUPS_OPEN=true (see src/lib/signups.ts).
set -euo pipefail

INSTANCE_ID=${PS_INSTANCE_ID:-i-02887b9743e873b04}
REGION=${PS_AWS_REGION:-us-east-1}
HOST=${PS_DEPLOY_HOST:-}   # resolved from AWS below when empty; last known fallback further down
KEY=${PS_DEPLOY_KEY:-$HOME/.ssh/playstudy-turnstile.pem}
REMOTE_DIR=/opt/playstudy
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONF="$REPO/deploy/aws/nginx.conf"
TURNSTILE_MODE=${TURNSTILE_MODE:-off}

CHECK=0; DO_BUILD=1; START=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    --no-build) DO_BUILD=0 ;;
    --start) START=1 ;;
    -h|--help) awk 'NR == 1 { next } /^#/ { print; next } { exit }' "$0"; exit 0 ;;
    *) echo "unknown option: $arg (see --help)" >&2; exit 2 ;;
  esac
done

log() { printf '\n\033[1;36m==> [web] %s\033[0m\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

case "$TURNSTILE_MODE" in
  off)  BUILD_SCRIPT=${BUILD_SCRIPT:-build:off};  TS_ENABLED=false ;;
  test) BUILD_SCRIPT=${BUILD_SCRIPT:-build:test}; TS_ENABLED=true ;;
  real) BUILD_SCRIPT=${BUILD_SCRIPT:-build};      TS_ENABLED=true ;;
  *) die "TURNSTILE_MODE must be off, test or real (got '$TURNSTILE_MODE')" ;;
esac

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o BatchMode=yes -i "$KEY")
ssh_box() { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }

# ---- where is the box right now? ----------------------------------------------
# No Elastic IP is attached, so the public address changes on every stop/start.
# Ask AWS for the instance's state and current IP rather than trusting a constant.
instance_state_ip() {
  aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
    --query 'Reservations[0].Instances[0].[State.Name,PublicIpAddress]' --output text 2>/dev/null | tr '\t' ' '
}
if [ -z "$HOST" ]; then
  if command -v aws >/dev/null 2>&1; then
    read -r STATE IP <<<"$(instance_state_ip || true)"
    if [ "${STATE:-}" = "stopped" ] || [ "${STATE:-}" = "stopping" ]; then
      if [ "$START" = 1 ]; then
        log "instance $INSTANCE_ID is $STATE — starting it"
        aws ec2 start-instances --instance-ids "$INSTANCE_ID" --region "$REGION" >/dev/null
        aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
        read -r STATE IP <<<"$(instance_state_ip || true)"
        echo "started — new public IP: $IP (the old one is gone)"
      else
        die "instance $INSTANCE_ID is $STATE. Start it with:  ./deploy-aws.sh --start"
      fi
    fi
    if [ "${STATE:-}" = "running" ] && [ -n "${IP:-}" ] && [ "$IP" != "None" ]; then
      HOST="ec2-user@$IP"
    else
      echo "could not resolve the instance's IP from AWS (state: ${STATE:-unknown}); using the last known address" >&2
    fi
  fi
  HOST=${HOST:-ec2-user@100.49.56.40}   # Elastic IP since 2026-09-21 (anothernote.app points here); the AWS lookup above is authoritative
fi

# ---- preflight ---------------------------------------------------------------
log "preflight"
[ -f "$KEY" ] || die "SSH key not found: $KEY (set PS_DEPLOY_KEY)"
[ -f "$NGINX_CONF" ] || die "missing $NGINX_CONF"
[ -f "$REPO/package.json" ] || die "no package.json in $REPO — run this from the playstudy-card-dash repo"
for tool in ssh scp tar; do command -v "$tool" >/dev/null || die "$tool is not installed"; done
if [ "$DO_BUILD" = 1 ]; then command -v npm >/dev/null || die "npm is not installed"; fi
echo "key:   $KEY"
echo "host:  $HOST"
echo "build: $([ "$DO_BUILD" = 1 ] && echo "npm run $BUILD_SCRIPT" || echo "reuse dist/")  (Turnstile mode: $TURNSTILE_MODE)"
box_ready=0
for attempt in $(seq 1 12); do   # a freshly started instance takes a minute to accept SSH
  if ssh_box 'echo "box:   $(hostname) - up $(uptime -p 2>/dev/null | sed "s/^up //")";
    echo "disk:  $(df -h / | awk "NR==2{print \$4\" free of \"\$2}")";
    if [ -d /opt/playstudy ]; then cd /opt/playstudy && docker compose ps --format "table {{.Name}}\t{{.Status}}"; else echo "(no /opt/playstudy yet)"; fi'; then
    box_ready=1; break
  fi
  [ "$START" = 1 ] && [ "$attempt" -lt 12 ] && { echo "waiting for SSH…"; sleep 10; continue; }
  break
done
[ "$box_ready" = 1 ] || die "cannot reach $HOST over SSH — is the instance running, and is your current IP ($(curl -s -m 5 https://checkip.amazonaws.com || echo '?')) allowed on port 22 of security group sg-0d27fbc6c2f627ea5?"

# What the API side of the box expects. Only the Turnstile switch is read from its .env.
read -r BOX_TS HAS_STACK <<<"$(ssh_box 'ts=$(grep -E "^TURNSTILE_ENABLED=" /opt/playstudy/.env 2>/dev/null | tail -1 | cut -d= -f2);
  [ -f /opt/playstudy/docker-compose.yml ] && s=yes || s=no; echo "${ts:-unset} $s"' || true)"
echo "api:   TURNSTILE_ENABLED=${BOX_TS:-?} on the box, stack installed: ${HAS_STACK:-?}"
[ "${HAS_STACK:-no}" = yes ] || die "no stack on the box yet ($REMOTE_DIR/docker-compose.yml) — deploy the API first: playstudy-backend/deploy-aws.sh"
case "$(printf '%s' "${BOX_TS:-unset}" | tr '[:upper:]' '[:lower:]')" in
  true|1|yes)
    if [ "$TS_ENABLED" != true ]; then
      die "the box requires a Turnstile token (TURNSTILE_ENABLED=true) but a '$TURNSTILE_MODE' build has no widget, so every sign-in would be refused. Build with TURNSTILE_MODE=test or real, or deploy the API with TURNSTILE_MODE=off first."
    fi ;;
  *)
    if [ "$TS_ENABLED" = true ]; then
      echo "note:  the box has Turnstile off, so this build's widget has no effect until the API is deployed with TURNSTILE_MODE=$TURNSTILE_MODE"
    fi ;;
esac
if [ "$CHECK" = 1 ]; then log "check passed — nothing was changed"; exit 0; fi

# ---- build -------------------------------------------------------------------
if [ "$DO_BUILD" = 1 ]; then
  log "building (npm run $BUILD_SCRIPT)"
  ( cd "$REPO" && npm run "$BUILD_SCRIPT" )
fi
[ -f "$REPO/dist/index.html" ] || die "no build output in dist/"
# The API lives at /api on the same origin. A mode file that lost VITE_API_URL=/api falls back
# to the dev .env and ships a bundle that calls the visitor's own localhost.
if grep -rqs "localhost:8010" "$REPO/dist/assets"; then
  die "this bundle calls http://localhost:8010 — VITE_API_URL was not /api for this build (check .env.off / .env.test / .env.production)"
fi
BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$REPO/dist/index.html" | head -1)
[ -n "$BUNDLE" ] || die "cannot find the entry script in dist/index.html"

# ---- upload ------------------------------------------------------------------
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
tar czf "$TMP/web.tgz" -C "$REPO/dist" .
cp "$NGINX_CONF" "$TMP/nginx.conf.new"
log "uploading"
scp "${SSH_OPTS[@]}" "$TMP/web.tgz" "$TMP/nginx.conf.new" "$HOST:$REMOTE_DIR/"

# ---- install -----------------------------------------------------------------
log "swapping the site on the box"
ssh_box "bash -s -- $REMOTE_DIR" <<'REMOTE'
set -e
cd "$1"
# Clear the CONTENTS only: nginx bind-mounts ./web, and deleting the directory
# orphans the mount (nginx then serves nothing until it restarts).
mkdir -p web && find web -mindepth 1 -delete && tar xzf web.tgz -C web && rm -f web.tgz
# self-signed certificate for https (the microphone only works on secure pages)
mkdir -p certs
[ -f certs/selfsigned.crt ] || openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout certs/selfsigned.key -out certs/selfsigned.crt -subj '/CN=anothernotes' >/dev/null 2>&1
changed=0
if [ "$(sha256sum < nginx.conf.new)" != "$(sha256sum < nginx.conf 2>/dev/null || true)" ]; then
  [ -f nginx.conf ] && cp nginx.conf nginx.conf.prev
  # Rewrite in place: nginx bind-mounts this single file, and a replacement file
  # (a new inode) would stay invisible to the running container.
  cat nginx.conf.new > nginx.conf
  changed=1
fi
rm -f nginx.conf.new
if [ -z "$(docker compose ps -q nginx 2>/dev/null)" ]; then
  docker compose up -d --no-deps nginx
elif [ "$changed" = 1 ]; then
  # </dev/null on every exec: this script arrives on stdin, and `docker compose
  # exec` would otherwise swallow the rest of it.
  if docker compose exec -T nginx nginx -t </dev/null; then
    docker compose exec -T nginx nginx -s reload </dev/null
    echo "nginx.conf changed - reloaded"
  else
    [ -f nginx.conf.prev ] && cat nginx.conf.prev > nginx.conf
    echo "nginx -t rejected the new nginx.conf; the previous one is back in place" >&2
    exit 1
  fi
fi
REMOTE

# ---- health ------------------------------------------------------------------
log "checking the site"
ok=0
for _ in $(seq 1 10); do
  if ssh_box "curl -fsS -m 5 http://localhost/ | grep -q '$BUNDLE'"; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || die "nginx is not serving the new build (expected $BUNDLE in the page)"
if ! ssh_box "curl -fsS -m 5 -o /dev/null http://localhost/health"; then
  echo "warning: the site is up but the API is not answering through nginx — check it with playstudy-backend/deploy-aws.sh --check" >&2
fi
log "web deployed — https://anothernote.app/  (direct: https://${HOST#*@}/, self-signed certificate)"

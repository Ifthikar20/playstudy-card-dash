#!/usr/bin/env bash
# maintenance.sh: switch the live site's maintenance page on or off.
#
#   ./maintenance.sh on [key]   show maintenance.html to everyone. Without a key it keeps the
#                               current one (so unlocked browsers stay unlocked), or makes a
#                               random one the first time.
#   ./maintenance.sh off        open the app to everyone again
#   ./maintenance.sh status     is the gate on (as recorded AND as nginx serves it), and the key
#   ./maintenance.sh concerns   read what visitors sent with the page's concern/request form
#
# While the gate is on, open the console on the maintenance page and run
#   unlock("<key>")
# to get the real app in that browser (a cookie: up to 30 days, 7 in Safari). On a phone or
# tablet, open https://<site>/#unlock instead: the page then shows a key box. To see the
# public page again from an unlocked browser, use a private window, or run lock() in the
# console (it works on the maintenance page and, once deployed, in the app). The key is stored
# only on the box, in /opt/playstudy/maintenance.key. Every web deploy re-applies it, so a
# deploy never opens the site by accident.
#
# Nothing is rebuilt: this uploads public/maintenance.html, public/terms.html and
# deploy/aws/nginx.conf, fills the key into the config, checks it with `nginx -t` and reloads
# nginx. The key file changes only after that succeeds. The app files on the box are left
# exactly as they are.
set -euo pipefail

INSTANCE_ID=${PS_INSTANCE_ID:-i-02887b9743e873b04}
REGION=${PS_AWS_REGION:-us-east-1}
HOST=${PS_DEPLOY_HOST:-}
KEY=${PS_DEPLOY_KEY:-$HOME/.ssh/playstudy-turnstile.pem}
REMOTE_DIR=/opt/playstudy
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONF="$REPO/deploy/aws/nginx.conf"

die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

ACTION=${1:-status}
case "$ACTION" in
  on|off|status|concerns) ;;
  -h|--help) awk 'NR == 1 { next } /^#/ { print; next } { exit }' "$0"; exit 0 ;;
  *) die "usage: ./maintenance.sh on [key] | off | status | concerns" ;;
esac

if [ -z "$HOST" ]; then
  IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text 2>/dev/null || true)
  [ -n "$IP" ] && [ "$IP" != "None" ] || IP=100.49.56.40   # the Elastic IP
  HOST="ec2-user@$IP"
fi
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o BatchMode=yes -i "$KEY")
[ -f "$KEY" ] || die "SSH key not found: $KEY (set PS_DEPLOY_KEY)"
ssh_box() { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }

if [ "$ACTION" = status ]; then
  # Report both what is recorded (the key file) and what nginx actually serves, so a
  # config that lost the gate can't hide behind "ON".
  ssh_box "bash -s -- $REMOTE_DIR" <<'REMOTE'
cd "$1"
if [ -s maintenance.key ]; then echo "maintenance: ON   key: $(cat maintenance.key)"; else echo "maintenance: off"; fi
grep -q 'default 1;   # MAINTENANCE-DEFAULT' nginx.conf 2>/dev/null && cfg=on || cfg=off
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)
echo "live:        nginx.conf gate $cfg, / answers $code (503 = maintenance page, 200 = app)"
if { [ -s maintenance.key ] && [ "$cfg" = off ]; } || { [ ! -s maintenance.key ] && [ "$cfg" = on ]; }; then
  echo "WARNING: the key file and the live config disagree. Run ./maintenance.sh on (or off) again." >&2
fi
REMOTE
  exit 0
fi

if [ "$ACTION" = concerns ]; then
  # nginx keeps them in its container (see log_format concerns in deploy/aws/nginx.conf):
  # they survive reloads and restarts, not a re-created nginx container.
  ssh_box "bash -s -- $REMOTE_DIR" <<'REMOTE'
cd "$1"
docker compose exec -T nginx sh -c 'cat /var/log/nginx/concerns.log 2>/dev/null' </dev/null | python3 -c '
import json, sys
n = 0
for line in sys.stdin:
    try:
        row = json.loads(line)
        body = json.loads(row.get("body") or "{}")
    except ValueError:
        continue
    if not body.get("message"):
        continue
    n += 1
    print("-" * 60)
    print("%s  %s  from %s" % (row.get("time", "?"), (body.get("kind") or "?").upper(), row.get("ip", "?")))
    if body.get("email"):
        print("reply to: %s" % body["email"])
    print(str(body.get("message") or "").strip())
if n:
    print("-" * 60)
print("%d message%s" % (n, "" if n == 1 else "s"))
'
REMOTE
  exit 0
fi

PREVIEW_KEY=
if [ "$ACTION" = on ]; then
  # Keep the current key unless one is given: a new key would lock out every browser that
  # already unlocked.
  PREVIEW_KEY=${2:-$(ssh_box "cat $REMOTE_DIR/maintenance.key 2>/dev/null" | tr -dc 'A-Za-z0-9_-' || true)}
  if [ -z "$PREVIEW_KEY" ]; then
    PREVIEW_KEY=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20 || true)
  fi
  # nginx and sed both see the key, so keep it to characters neither treats specially.
  [[ "$PREVIEW_KEY" =~ ^[A-Za-z0-9_-]{8,}$ ]] || die "the key must be at least 8 characters of A-Z a-z 0-9 _ -"
fi

# Upload to a staging folder: nginx bind-mounts nginx.conf and web/, so both must be
# rewritten in place on the box, never replaced by scp.
PAGES=("$REPO/public/maintenance.html")
[ -f "$REPO/public/terms.html" ] && PAGES+=("$REPO/public/terms.html")
ssh_box "mkdir -p $REMOTE_DIR/.maint-upload"
scp "${SSH_OPTS[@]}" -q "$NGINX_CONF" "${PAGES[@]}" "$HOST:$REMOTE_DIR/.maint-upload/"
ssh_box "bash -s -- $REMOTE_DIR '$ACTION' '$PREVIEW_KEY'" <<'REMOTE'
set -e
cd "$1"
for page in maintenance.html terms.html; do
  [ -f ".maint-upload/$page" ] && cat ".maint-upload/$page" > "web/$page"
done
mv .maint-upload/nginx.conf nginx.conf.new && rm -rf .maint-upload
# Fill the key in (the same as deploy-aws.sh), and refuse if the markers didn't match: an
# nginx.conf without them would silently serve the open site.
if [ "$2" = on ]; then
  sed -i -e 's|default 0;   # MAINTENANCE-DEFAULT|default 1;   # MAINTENANCE-DEFAULT|' \
         -e "s|# MAINTENANCE-KEY|\"$3\" 0;   # MAINTENANCE-KEY|" nginx.conf.new
  if ! grep -q 'default 1;   # MAINTENANCE-DEFAULT' nginx.conf.new || ! grep -qF "\"$3\" 0;" nginx.conf.new; then
    rm -f nginx.conf.new
    echo "the maintenance markers are missing from nginx.conf; nothing was changed" >&2
    exit 1
  fi
fi
[ -f nginx.conf ] && cp nginx.conf nginx.conf.prev
cat nginx.conf.new > nginx.conf   # in place: nginx bind-mounts this file's inode
rm -f nginx.conf.new
if docker compose exec -T nginx nginx -t </dev/null; then
  docker compose exec -T nginx nginx -s reload </dev/null
else
  [ -f nginx.conf.prev ] && cat nginx.conf.prev > nginx.conf
  echo "nginx -t rejected the config; the previous one is back in place and the gate is unchanged" >&2
  exit 1
fi
# Only now record the new state, so the key file always matches what nginx serves.
if [ "$2" = on ]; then
  printf '%s\n' "$3" > maintenance.key.new && chmod 600 maintenance.key.new && mv maintenance.key.new maintenance.key
else
  rm -f maintenance.key
fi
sleep 1   # the reload finishes a moment after the signal
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)
echo "live: / answers $code"
if [ "$2" = on ] && [ "$code" != 503 ]; then echo "expected 503 (the maintenance page) - check ./maintenance.sh status" >&2; exit 1; fi
if [ "$2" = off ] && [ "$code" != 200 ]; then echo "expected 200 (the app) - check ./maintenance.sh status" >&2; exit 1; fi
REMOTE

if [ "$ACTION" = on ]; then
  printf '\nmaintenance: ON\n  key:     %s\n  unlock:  open the site, press F12 > Console, run  unlock("%s")\n           (phone/tablet: open the site with #unlock at the end of the address)\n  public view from an unlocked browser: a private window\n' "$PREVIEW_KEY" "$PREVIEW_KEY"
else
  printf '\nmaintenance: off. The app is open to everyone.\n'
fi

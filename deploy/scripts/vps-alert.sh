#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lightweight local watchdog for the Azimuth VPS. Runs from cron (every 15 min).
# Alerts on: root disk over threshold, or any expected container not running.
# Complements external uptime monitoring (UptimeRobot/Healthchecks) — this one
# catches disk pressure + worker/redis death that external HTTP checks can miss.
#
# Config (optional) in /etc/azimuth/alert.env:
#   ALERT_WEBHOOK=...   # Discord / Slack / ntfy.sh URL (auto-detected). Blank = log only.
#   DISK_THRESHOLD=85   # percent
#
# Alerts always go to the system journal (`journalctl -t azimuth-alert`) too.
# ─────────────────────────────────────────────────────────────────────────────
set -u

CONF=/etc/azimuth/alert.env
[ -f "$CONF" ] && . "$CONF"
DISK_THRESHOLD="${DISK_THRESHOLD:-85}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"
EXPECTED="redis server worker caddy"
HOST="$(hostname)"

notify() {
  msg="[Azimuth VPS ${HOST}] $1"
  logger -t azimuth-alert "$msg"
  [ -z "$ALERT_WEBHOOK" ] && return
  case "$ALERT_WEBHOOK" in
    *discord.com*) curl -fsS -m 10 -H "Content-Type: application/json" \
                     -d "{\"content\":\"${msg}\"}" "$ALERT_WEBHOOK" >/dev/null 2>&1 ;;
    *slack.com*)   curl -fsS -m 10 -H "Content-Type: application/json" \
                     -d "{\"text\":\"${msg}\"}" "$ALERT_WEBHOOK" >/dev/null 2>&1 ;;
    *)             curl -fsS -m 10 -d "$msg" "$ALERT_WEBHOOK" >/dev/null 2>&1 ;; # ntfy.sh etc
  esac
}

# ── Disk ─────────────────────────────────────────────────────────────────────
USE="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [ -n "$USE" ] && [ "$USE" -ge "$DISK_THRESHOLD" ]; then
  notify "DISK ${USE}% used on / (threshold ${DISK_THRESHOLD}%) — clear space."
fi

# ── Containers ───────────────────────────────────────────────────────────────
for svc in $EXPECTED; do
  cname="azimuth-${svc}-1"
  state="$(docker inspect -f '{{.State.Status}}' "$cname" 2>/dev/null || echo missing)"
  if [ "$state" != "running" ]; then
    notify "CONTAINER ${cname} is '${state}' (expected running)."
  fi
done

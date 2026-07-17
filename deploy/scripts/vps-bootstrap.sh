#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time bootstrap for a fresh Ubuntu 24.04 Hostinger VPS.
# Run as root:  ssh root@<vps-ip>  then  bash vps-bootstrap.sh
#
# Installs: Docker + compose plugin, UFW firewall, Node LTS + Claude Code,
# a 2G swapfile (safety net on the 8G box), and the /opt/azimuth layout.
# Idempotent — safe to re-run.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw

# ── Docker (official repo) ───────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "==> installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  echo "==> Docker already present"
fi

# ── Log rotation so container logs never eat the disk ────────────────────────
echo "==> capping container log size"
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

# ── Firewall: only SSH + HTTP + HTTPS ────────────────────────────────────────
echo "==> configuring UFW (22, 80, 443)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── Swap (2G) — cheap insurance against OOM during pulls/restarts ────────────
if [ ! -f /swapfile ]; then
  echo "==> creating 2G swapfile"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── Node LTS + Claude Code (you asked for it on the box) ──────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "==> installing Node.js LTS"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "==> installing Claude Code"
  npm install -g @anthropic-ai/claude-code
fi

# ── Dedicated non-root deploy user (in the docker group) ─────────────────────
DEPLOY_USER=deploy
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  echo "==> creating '$DEPLOY_USER' user"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
# Seed its SSH dir so you can drop the CI deploy key in later.
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

# ── Project layout (owned by the deploy user) ────────────────────────────────
echo "==> /opt/azimuth layout"
mkdir -p /opt/azimuth/deploy
chown -R "$DEPLOY_USER:$DEPLOY_USER" /opt/azimuth

# ── Weekly image prune so old GHCR layers don't accumulate ───────────────────
echo "==> weekly docker prune cron"
cat > /etc/cron.weekly/docker-prune <<'SH'
#!/bin/sh
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
SH
chmod +x /etc/cron.weekly/docker-prune

echo
echo "✅ Bootstrap done."
echo "   docker  : $(docker --version)"
echo "   compose : $(docker compose version | head -1)"
echo "   node    : $(node --version)"
echo "   claude  : $(claude --version 2>/dev/null || echo 'installed (run: claude)')"
echo
echo "Next (see deploy/README.md — do the app steps AS THE 'deploy' USER):"
echo "  1) Copy deploy/ files into /opt/azimuth/deploy/ (compose, Caddyfile, scripts)."
echo "  2) Create /opt/azimuth/deploy/.env.production from the example, fill secrets."
echo "  3) As 'deploy': docker login ghcr.io  (read:packages PAT)."
echo "  4) Add the CI deploy public key to /home/deploy/.ssh/authorized_keys."
echo "  5) Point DNS A record api.<domain> -> this VPS IP."
echo "  6) First deploy runs automatically on git push (GitHub Actions)."

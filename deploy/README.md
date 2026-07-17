# Azimuth VPS deployment

Backend (`server` + `worker`) runs on the Hostinger VPS via Docker Compose.
Postgres + Redis live on the same box (internal network, no public ports). The
`user` / `admin` Next.js apps are hosted separately (Vercel) and talk to
`https://api.<domain>`.

Images are **built in GitHub Actions and pulled from GHCR** — the VPS never
builds, keeping CPU/disk light.

```
GitHub push (master)
      │
      ▼
GitHub Actions ──build──▶ GHCR (azimuth-server / -worker / -migrate)
      │
      └──ssh──▶ VPS: deploy.sh <sha>
                   ├─ compose pull
                   ├─ migrate (one-shot, applies Drizzle migrations)
                   └─ up -d  (server, worker, caddy, postgres, redis)
```

---

## One-time setup

### 1. Bootstrap the VPS

SSH in as root and run the bootstrap (installs Docker, UFW, Node, Claude Code,
swap, log caps):

```bash
ssh root@<VPS_IP>
# paste/scp deploy/scripts/vps-bootstrap.sh, then:
bash vps-bootstrap.sh
```

Bootstrap creates a non-root **`deploy`** user (in the `docker` group) that owns
`/opt/azimuth` and runs the stack. CI logs in as this user.

### 2. Put the deploy files on the VPS

```bash
# from your laptop, repo root (scp as root, then hand ownership to deploy):
scp deploy/docker-compose.prod.yml deploy/Caddyfile root@<VPS_IP>:/opt/azimuth/deploy/
scp -r deploy/scripts root@<VPS_IP>:/opt/azimuth/deploy/
ssh root@<VPS_IP> 'chown -R deploy:deploy /opt/azimuth && chmod +x /opt/azimuth/deploy/scripts/*.sh'
```

### 3. Create the env file

```bash
ssh root@<VPS_IP>
su - deploy
cd /opt/azimuth/deploy
# copy the example (from repo) and fill secrets:
nano .env.production          # paste from deploy/.env.production.example, fill in
chmod 600 .env.production
```

Generate the secrets:

```bash
openssl rand -hex 32     # BETTER_AUTH_SECRET
openssl rand -base64 24  # POSTGRES_PASSWORD  (also update DATABASE_URL to match)
```

### 4. Let the VPS pull private GHCR images

Create a GitHub **classic PAT** with `read:packages`, then on the VPS **as the
`deploy` user** (so the token lands in `deploy`'s docker config, the account CI
uses):

```bash
su - deploy
echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin
```

(Stored in `/home/deploy/.docker/config.json`; pulls now work.)

### 5. Add the CI deploy key

On your laptop, make a dedicated keypair for GitHub Actions:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/azimuth_deploy -C "gh-actions-deploy" -N ""
```

Append the **public** key to the **deploy** user on the VPS:

```bash
ssh-copy-id -i ~/.ssh/azimuth_deploy.pub deploy@<VPS_IP>
# or, from a root shell on the VPS:
#   cat >> /home/deploy/.ssh/authorized_keys   (paste the .pub, Ctrl-D)
```

### 6. GitHub repo secrets

Repo → Settings → Secrets and variables → Actions:

| Secret         | Value                                            |
| -------------- | ------------------------------------------------ |
| `VPS_HOST`     | VPS IP                                           |
| `VPS_USER`     | `deploy`                                         |
| `VPS_SSH_KEY`  | contents of `~/.ssh/azimuth_deploy` (private)    |

`GITHUB_TOKEN` is automatic — no action needed for GHCR push.

### 7. DNS

Add an **A record**: `api.<yourdomain>` → `<VPS_IP>`. Caddy fetches the TLS cert
on first boot. Point the Vercel apps' API base URL at `https://api.<domain>`.

### 8. First deploy

Push to `master` (or run the workflow manually via **Actions → deploy → Run
workflow**). CI builds, pushes, and rolls out.

Seed the first admin once, after the stack is up:

```bash
ssh deploy@<VPS_IP>
cd /opt/azimuth/deploy
docker compose --env-file .env.production -f docker-compose.prod.yml \
  run --rm server node_modules/.bin/tsx src/seed-admin.ts
```

---

## Day-to-day

```bash
cd /opt/azimuth/deploy
C="docker compose --env-file .env.production -f docker-compose.prod.yml"

$C ps                 # status
$C logs -f server     # tail server
$C logs -f worker     # tail worker
$C restart server     # bounce a service
bash scripts/deploy.sh <sha-or-latest>   # manual rollout
```

Every `git push` to `master` that touches backend paths auto-deploys.

## Disk hygiene (already automated)

- Container logs capped at 10m × 3 (`daemon.json`).
- Weekly `docker image prune` via `/etc/cron.weekly/docker-prune`.
- `deploy.sh` prunes dangling images each rollout.

Check usage anytime: `docker system df` and `df -h`.

## Backups (recommended, not yet automated)

```bash
# postgres dump
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec postgres pg_dump -U azimuth azimuth_perfumers | gzip > ~/azimuth-$(date +%F).sql.gz
```

Wire this into a daily cron once you're live.

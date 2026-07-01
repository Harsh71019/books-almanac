# Connecting to Proxmox

## SSH into the server

```bash
ssh root@192.168.0.226
```

Passwordless — uses your SSH key automatically.

---

## Redeploy the app

```bash
# Copy a changed file then rebuild
scp <local-file> root@192.168.0.226:/opt/apps/books-app/<same-path>
ssh root@192.168.0.226 "cd /opt/apps/books-app && bash deploy.sh"
```

---

## Common commands

```bash
# Check all running containers
ssh root@192.168.0.226 "docker ps"

# Live server logs
ssh root@192.168.0.226 "docker logs -f books-app-server-1"

# Live nginx logs
ssh root@192.168.0.226 "docker logs -f books-app-client-1"

# Health check
curl http://192.168.0.226:3003/api/health

# Restart containers without rebuild
ssh root@192.168.0.226 "docker compose -f /opt/apps/books-app/docker-compose.yml restart"

# Shell into the server container
ssh root@192.168.0.226 "docker exec -it books-app-server-1 sh"

# Check env vars inside container
ssh root@192.168.0.226 "docker exec books-app-server-1 env"

# Free up disk space
ssh root@192.168.0.226 "docker image prune -a -f"
```

---

## App location

| | |
|---|---|
| Path | `/opt/apps/books-app/` |
| URL | `http://192.168.0.226:3003` |
| `.env` | `/opt/apps/books-app/.env` (server only, never committed) |

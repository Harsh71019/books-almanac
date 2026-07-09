# Deployment

App runs in Docker inside an LXC container on a home Proxmox server.

| | |
|---|---|
| Server | `192.168.0.226` |
| App path | `/opt/apps/books-app/` |
| URL | `http://192.168.0.226:3003` |

---

## Redeploy

```bash
scp <changed-file> root@192.168.0.226:/opt/apps/books-app/<path>
ssh root@192.168.0.226 "cd /opt/apps/books-app && bash deploy.sh"
```

`deploy.sh` rebuilds changed Docker images, restarts containers, and hits `/api/health` to confirm.

---

## Useful commands

```bash
# Logs
ssh root@192.168.0.226 "docker logs -f books-app-server-1"
ssh root@192.168.0.226 "docker logs -f books-app-client-1"

# Status
ssh root@192.168.0.226 "docker ps"

# Health check
curl http://192.168.0.226:3003/api/health

# Restart without rebuild
ssh root@192.168.0.226 "docker compose -f /opt/apps/books-app/docker-compose.yml restart"

# Shell into server container
ssh root@192.168.0.226 "docker exec -it books-app-server-1 sh"

# View env vars in container
ssh root@192.168.0.226 "docker exec books-app-server-1 env"

# Free disk space
ssh root@192.168.0.226 "docker image prune -a -f"
```

---

## Notes

- `.env` lives only on the server at `/opt/apps/books-app/.env` — never committed
- Source files are synced via `scp`, not `git pull` — the server has no git remote

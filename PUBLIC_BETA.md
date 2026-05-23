# Field Photo Mapper Public Beta

## Beta Limits

- Projects are capped at 50 photos.
- Uploads are capped by `MAX_UPLOAD_MB`, currently 512 MB per request.
- Premium larger batches are coming soon.
- Files are stored temporarily under `/app/tmp`.
- Jobs are cleaned up after export and stale jobs are removed automatically.

## Recommended Public Setup

Use Cloudflare Tunnel with Cloudflare Access. This avoids router port forwarding and lets Cloudflare handle email-based access control.

## 1. Configure Local Settings

```powershell
Copy-Item .env.example .env
notepad .env
```

Set:

```text
FIELD_MAPPER_PASSWORD=
MAX_PHOTOS_PER_JOB=50
CLOUDFLARE_TUNNEL_TOKEN=<paste token from Cloudflare>
```

Leave `FIELD_MAPPER_PASSWORD` blank if you are using Cloudflare Access. Set it only if you also want the browser-level shared password.

## 2. Create The Cloudflare Tunnel

In Cloudflare Zero Trust:

1. Go to `Networks` > `Tunnels`.
2. Create a tunnel.
3. Choose Docker as the connector environment.
4. Copy the tunnel token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.
5. Add a public hostname, such as `photos.yourdomain.com`.
6. Point the public hostname service to:

```text
http://field-photo-mapper:8080
```

## 3. Add Cloudflare Access

In Cloudflare Zero Trust:

1. Go to `Access` > `Applications`.
2. Add a self-hosted application for the same hostname.
3. Use One-time PIN as the login method.
4. Add an allow policy for your test users' email addresses.

## 4. Run With The Tunnel

```powershell
docker compose --profile cloudflare up -d --build
```

Check:

```powershell
docker compose ps
```

You should see both:

- `field-photo-mapper`
- `field-photo-mapper-tunnel`

## Local/Tailscale Testing

You can still test locally:

```text
http://localhost:8080
```

Or through Tailscale:

```text
http://100.89.93.95:8080
```

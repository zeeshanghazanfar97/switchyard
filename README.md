# Switchyard

**Switchyard** is a web editor for [Traefik](https://traefik.io) dynamic
configuration files. Instead of hand-editing `dynamic.yml`, you get a focused UI
to manage HTTP **routers**, **services** and **middlewares** — with live upstream
health checks and inline validation.

Traefik watches the file and hot-reloads, so changes applied in Switchyard take
effect immediately.

> Unofficial UI — not affiliated with Traefik Labs.

---

## Features

- **3-pane workbench** for routers, services and middlewares — create, edit and
  delete each entity, drag-to-attach middlewares, type-aware middleware config.
- **Live health checks** — the server probes every service's upstream servers
  over HTTP and reports `reachable` / `degraded` / `unreachable`.
- **Raw YAML view** — read, copy, export, import and round-trip-edit the file.
- **Inline validation** — orphaned services, undefined middleware references,
  invalid upstream URLs.
- **Atomic writes** — the config file is replaced atomically, so Traefik never
  sees a half-written file.
- **Authentication** — username/password login (Authentik / OpenID SSO
  scaffolded — see [Authentication](#authentication)).
- Dark / light themes.

## Architecture

| Layer | Stack |
| --- | --- |
| Backend | Node.js + Express — reads/writes the config file, runs health checks, handles auth |
| Frontend | React, built with Vite — served by the backend in production |

## Requirements

- **Docker** with the Compose plugin (recommended), **or**
- **Node.js 20+** and npm (to run without Docker).

---

## Quick start (Docker)

```bash
cp .env.example .env
# edit .env — at minimum set ADMIN_PASSWORD and SESSION_SECRET
docker compose up -d --build
```

Open <http://localhost:8080> and sign in with the `ADMIN_USERNAME` /
`ADMIN_PASSWORD` from your `.env`.

A sample `data/dynamic.yml` ships with the project so it runs out of the box.

---

## Configuration

All configuration is via environment variables loaded from `.env`. Copy
`.env.example` (fully annotated) and edit it. **Never commit `.env`.**

### Server

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Port the server listens on. |
| `NODE_ENV` | `development` | Set `production` for deployments. |
| `SESSION_SECRET` | — | Secret that signs the session cookie. Use a long random string. |
| `SECURE_COOKIES` | `false` | Send the session cookie over HTTPS only. Set `true` behind TLS. |

### Traefik config file

| Variable | Default | Description |
| --- | --- | --- |
| `TRAEFIK_DYNAMIC_FILE` | `./data/dynamic.yml` | Path to the dynamic config file Switchyard edits. |

### Authentication

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_USERNAME` | `admin` | Username for password login. |
| `ADMIN_PASSWORD` | — | Password for login. Empty disables password login. |
| `SSO_ENABLED` | `false` | Show/enable the SSO button (flow is stubbed). |
| `OIDC_PROVIDER_NAME` | `Authentik` | Display name on the SSO button. |
| `OIDC_ISSUER_URL` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` / `OIDC_SCOPES` | — | OpenID Connect settings. |

### Health checks

| Variable | Default | Description |
| --- | --- | --- |
| `HEALTH_CHECK_INTERVAL` | `30000` | Milliseconds between background health sweeps. |
| `HEALTH_CHECK_TIMEOUT` | `5000` | Per-request timeout in milliseconds. |

### Docker & Traefik integration

| Variable | Default | Description |
| --- | --- | --- |
| `TRAEFIK_DYNAMIC_DIR` | `./data` | Host directory bind-mounted into the container at `/data`. |
| `COMPOSE_FILE` | _(unset)_ | Set to `docker-compose.yml:docker-compose.traefik.yml` to deploy behind Traefik. |
| `TRAEFIK_NETWORK` | `traefik-public` | Existing external Docker network shared with Traefik. |
| `SWITCHYARD_HOST` | — | Hostname for the Traefik `Host(...)` router rule. |
| `TRAEFIK_ENTRYPOINTS` | `websecure` | Traefik entrypoint(s) for the router. |
| `TRAEFIK_CERTRESOLVER` | — | Traefik `certificatesResolver` name for TLS. |

---

## Deployment

### Option A — Docker Compose (recommended)

#### Standalone

```bash
cp .env.example .env
# edit .env:
#   - set ADMIN_PASSWORD and SESSION_SECRET
#   - point TRAEFIK_DYNAMIC_DIR at the directory holding your dynamic config
docker compose up -d --build
```

**Mounting your config** — `TRAEFIK_DYNAMIC_DIR` is bind-mounted to `/data`, and
the container edits `/data/dynamic.yml`. Point it at the directory containing
your real file, e.g. `TRAEFIK_DYNAMIC_DIR=/etc/traefik`. Mount the **directory**,
not the file — atomic writes require it. If your file isn't named `dynamic.yml`,
change `TRAEFIK_DYNAMIC_FILE` in `docker-compose.yml`.

#### Behind Traefik

Switchyard ships a `docker-compose.traefik.yml` overlay that registers the
container with Traefik **and stops publishing the host port** — so Switchyard is
reachable only through the proxy. Prerequisites: a running Traefik with the
Docker provider and an existing shared network.

Enable the overlay and set the routing values in `.env`:

```ini
COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml
SECURE_COOKIES=true
TRAEFIK_NETWORK=traefik-public          # your existing Traefik network
SWITCHYARD_HOST=switchyard.example.com
TRAEFIK_ENTRYPOINTS=websecure
TRAEFIK_CERTRESOLVER=cloudflare          # your cert resolver
```

Then deploy as usual — Compose loads both files automatically:

```bash
docker compose up -d --build
```

The overlay injects the values above as Traefik labels, attaches the container
to the external `TRAEFIK_NETWORK`, and removes the published port. Leave
`COMPOSE_FILE` unset (commented) to run standalone.

### Option B — Node.js (without Docker)

**Production:**

```bash
npm install
npm run build
NODE_ENV=production npm start          # serves the UI + API on :8080
```

**Development** (hot reload):

```bash
npm install
npm run dev                            # API on :8080, Vite UI on :5173
```

Run `npm start` behind your own TLS-terminating reverse proxy and set
`SECURE_COOKIES=true`.

---

## The Traefik dynamic config file

Switchyard reads and writes a single Traefik dynamic configuration file in the
standard format:

```yaml
http:
  routers:
    my-app:
      rule: "Host(`app.example.com`)"
      entryPoints: [websecure]
      service: my-app-service
      tls:
        certResolver: cloudflare
  services:
    my-app-service:
      loadBalancer:
        servers:
          - url: "http://10.0.0.10:8080"
  middlewares:
    secure-headers:
      headers:
        sslRedirect: true
```

Pressing **Apply changes** writes the file atomically; Traefik detects the change
and hot-reloads. See `data/dynamic.yml` for a complete sample.

## Health checks

Health checks run **server-side** — browsers can't reach private upstream IPs.
For every service, Switchyard sends an HTTP request to each upstream server:

- **up** — responded with `2xx` (or a redirect)
- **degraded** — responded, but with `4xx`/`5xx`
- **unreachable** — no response (connection refused, DNS failure, timeout)

Results refresh on an interval (`HEALTH_CHECK_INTERVAL`) and on demand via the
**Recheck** button.

## Authentication

- **Password login** is fully functional — credentials come from `ADMIN_USERNAME`
  / `ADMIN_PASSWORD`. Sessions use a signed cookie.
- **SSO** (Authentik / OpenID Connect) is **scaffolded but stubbed**: the login
  screen shows the provider button and all `OIDC_*` variables are read, but the
  authorization-code redirect flow is not implemented. The completion steps are
  documented in `server/routes/auth.js`.

## Security checklist

- [ ] Set a strong, unique `SESSION_SECRET`
      (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
- [ ] Set a strong `ADMIN_PASSWORD`.
- [ ] Set `SECURE_COOKIES=true` when serving over HTTPS.
- [ ] Don't expose Switchyard publicly without TLS — it edits your proxy config.
- [ ] Keep `.env` out of version control (already in `.gitignore`).

---

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development — Express (`:8080`) + Vite (`:5173`) with hot reload. |
| `npm run build` | Build the client into `client/dist`. |
| `npm start` | Run the production server (`:8080`). |
| `npm run docker:build` | Build the Docker image. |
| `npm run docker:up` | Build and start the stack via Compose. |
| `npm run docker:down` | Stop the Compose stack. |
| `npm run docker:logs` | Follow the container logs. |

## Project layout

```
switchyard/
├── server/              # Express backend
│   ├── index.js         # entry point — API + static client
│   ├── config.js        # environment configuration
│   ├── yamlStore.js     # read/write the Traefik dynamic config
│   ├── health.js        # upstream health checks
│   ├── auth.js          # password auth + session guard
│   └── routes/          # /api/auth, /api/config, /api/health
├── client/              # React + Vite frontend
│   └── src/             # UI components
├── data/
│   └── dynamic.yml      # sample Traefik dynamic config
├── Dockerfile                  # multi-stage build (build client → lean runtime)
├── docker-compose.yml          # base deployment (standalone)
├── docker-compose.traefik.yml  # overlay — run behind Traefik
└── .env.example                # annotated configuration template
```

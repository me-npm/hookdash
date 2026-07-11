<div align="center">

# ∿ hookdash

**Zero-config, self-hosted webhook gateway with a beautiful dashboard.**

Receive, queue, retry, and monitor webhooks — no Redis, no Postgres, just SQLite.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

[Quick Start](#-quick-start) · [Configuration](#-configuration) · [Dashboard](#-dashboard) · [API](#-api-reference) · [Docker](#-docker) · [Contributing](#-contributing)

</div>

---

## Why hookdash?

Every app that integrates with Stripe, GitHub, Twilio, or Shopify needs to handle webhooks. But webhooks are fragile — your server goes down, you lose events. You need retry logic, signature verification, monitoring, and replay capabilities.

**hookdash** gives you all of that in a single command:

```bash
npx hookdash start
```

No Redis. No Postgres. No Kafka. Just a single SQLite file and a beautiful dashboard.

### How it compares

| Feature | hookdash | Svix | Convoy | Hookdeck |
|---|---|---|---|---|
| Zero external deps | ✅ SQLite only | ❌ PG + Redis + Kafka | ❌ PG + Redis | ❌ Cloud only |
| Setup time | `npx hookdash` | Hours | Hours | Minutes |
| Self-hosted | ✅ | ✅ | ✅ | ❌ |
| Dashboard | ✅ Beautiful | ✅ | ✅ | ✅ |
| Signature verification | ✅ Multi-provider | ✅ | ✅ | ✅ |
| License | MIT | MIT (server) | Varies | Proprietary |
| Target audience | Devs & small teams | Enterprise | Enterprise | Everyone |

---

## ✨ Features

- 🪝 **Webhook Ingestion** — Receive webhooks from any service at `/webhook/:source`
- 🔐 **Signature Verification** — Built-in support for Stripe, GitHub, Twilio, Shopify, and generic HMAC
- 🔄 **Smart Retries** — Exponential backoff with jitter, configurable per-endpoint
- ⚡ **Circuit Breaker** — Auto-disable failing endpoints, probe for recovery
- 💀 **Dead Letter Queue** — Events that exceed retries are preserved for inspection
- 🔁 **One-Click Replay** — Re-deliver any failed event from the dashboard
- 📊 **Real-time Dashboard** — Beautiful dark UI with live event stream
- 📡 **Server-Sent Events** — Real-time updates without WebSocket complexity
- 🗄️ **SQLite Storage** — Zero-config, single file, fast, reliable
- 🐳 **Docker Ready** — Single container deployment
- ⚙️ **YAML Config** — Simple configuration with environment variable interpolation

---

## 🚀 Quick Start

### Option 1: npx (quickest)

```bash
# Create a config file
npx hookdash init

# Edit hookdash.config.yml with your settings, then:
npx hookdash start
```

### Option 2: Install globally

```bash
npm install -g hookdash
hookdash init
hookdash start
```

### Option 3: Docker

```bash
docker run -p 9090:9090 -v hookdash-data:/app/data hookdash/hookdash
```

### Test it works

```bash
# Send a test webhook
curl -X POST http://localhost:9090/webhook/my-service \
  -H "Content-Type: application/json" \
  -d '{"event": "test.event", "data": {"hello": "world"}}'

# Open the dashboard
open http://localhost:9090
```

---

## 📋 Configuration

Create a `hookdash.config.yml` in your project root:

```yaml
server:
  port: 9090
  host: 0.0.0.0

database:
  path: ./hookdash.db

delivery:
  poll_interval: 1000        # ms between delivery polls
  default_timeout: 30000     # ms per delivery attempt
  default_max_retries: 8     # retries before dead letter

sources:
  # Stripe
  - name: stripe
    provider: stripe
    signing_secret: ${STRIPE_WEBHOOK_SECRET}
    endpoints:
      - url: http://localhost:3000/api/webhooks/stripe
        events: ["payment_intent.*", "charge.*"]

  # GitHub
  - name: github
    provider: github
    signing_secret: ${GITHUB_WEBHOOK_SECRET}
    endpoints:
      - url: http://localhost:3000/api/webhooks/github

  # Generic HMAC-SHA256
  - name: my-service
    provider: generic
    signing_secret: my-secret-key
    endpoints:
      - url: http://localhost:3000/hooks
```

### Environment Variables

Use `${ENV_VAR}` syntax in your config to reference environment variables:

```yaml
signing_secret: ${STRIPE_WEBHOOK_SECRET}
```

### CLI Options

```bash
hookdash start [options]

Options:
  -p, --port <port>    Server port (overrides config)
  -h, --host <host>    Server host (overrides config)
  -c, --config <path>  Path to config file
  -d, --db <path>      Database file path
```

---

## 📊 Dashboard

The dashboard is available at `http://localhost:9090` and provides:

- **Event Explorer** — Search and filter all incoming webhooks
- **Event Detail** — View full payload, headers, and delivery timeline
- **Replay** — One-click re-delivery of any event
- **Stats** — Success rates, event volume, top sources
- **Endpoint Manager** — Configure and test forwarding destinations
- **Real-time Updates** — Live event stream via SSE

---

## 📡 API Reference

All API endpoints are available at `/api/`.

### Events

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | List events (paginated) |
| `GET` | `/api/events/:id` | Event detail + deliveries |
| `POST` | `/api/events/:id/replay` | Replay an event |
| `DELETE` | `/api/events/:id` | Delete an event |

**Query parameters for `GET /api/events`:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `per_page` | number | Items per page (default: 20, max: 100) |
| `source` | string | Filter by source name |
| `status` | string | Filter by delivery status |
| `event_type` | string | Filter by event type |
| `from` | string | ISO date, events after |
| `to` | string | ISO date, events before |
| `search` | string | Search in event body |

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/endpoints` | List endpoints |
| `POST` | `/api/endpoints` | Create endpoint |
| `PUT` | `/api/endpoints/:id` | Update endpoint |
| `DELETE` | `/api/endpoints/:id` | Delete endpoint |
| `POST` | `/api/endpoints/:id/test` | Test endpoint connectivity |

### Stats & Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Aggregate statistics |
| `GET` | `/api/stream` | SSE real-time event stream |
| `GET` | `/api/health` | Health check |

---

## 🪝 Webhook Providers

### Stripe

```yaml
- name: stripe
  provider: stripe
  signing_secret: ${STRIPE_WEBHOOK_SECRET}
```

Verifies using the `Stripe-Signature` header with HMAC-SHA256. Validates timestamp tolerance (5 minutes).

### GitHub

```yaml
- name: github
  provider: github
  signing_secret: ${GITHUB_WEBHOOK_SECRET}
```

Verifies using the `X-Hub-Signature-256` header with HMAC-SHA256.

### Twilio

```yaml
- name: twilio
  provider: twilio
  signing_secret: ${TWILIO_AUTH_TOKEN}
```

Verifies using the `X-Twilio-Signature` header with HMAC-SHA1.

### Shopify

```yaml
- name: shopify
  provider: shopify
  signing_secret: ${SHOPIFY_WEBHOOK_SECRET}
```

Verifies using the `X-Shopify-Hmac-Sha256` header with HMAC-SHA256 (Base64).

### Generic HMAC

```yaml
- name: my-service
  provider: generic
  signing_secret: my-secret-key
```

Verifies using `X-Webhook-Signature` or `X-Signature` header with HMAC-SHA256.

---

## 🔄 Retry Strategy

hookdash uses **exponential backoff with jitter**:

| Attempt | Delay (approx) |
|---|---|
| 1 | ~1s |
| 2 | ~2s |
| 3 | ~4s |
| 4 | ~8s |
| 5 | ~16s |
| 6 | ~32s |
| 7 | ~1 min |
| 8 | ~2 min |

After the configured max retries (default: 8), the event moves to the **dead letter queue** and can be replayed manually from the dashboard.

### Circuit Breaker

If an endpoint fails 5 times consecutively, hookdash **opens the circuit** and stops sending to that endpoint for 60 seconds. After the cooldown, it enters **half-open** state and probes with a single request.

---

## 🐳 Docker

### Using Docker Compose

```bash
# Clone the repo
git clone https://github.com/hookdash/hookdash.git
cd hookdash

# Create your config
cp hookdash.config.example.yml hookdash.config.yml

# Start
docker compose up -d
```

### Using Docker directly

```bash
docker build -t hookdash .
docker run -p 9090:9090 -v hookdash-data:/app/data hookdash
```

---

## 🛠 Development

```bash
# Clone
git clone https://github.com/hookdash/hookdash.git
cd hookdash

# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Start in dev mode (with hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## 🗺 Roadmap

- [ ] Web UI for creating sources (no YAML editing)
- [ ] Webhook forwarding transforms (modify payload before delivery)
- [ ] Rate limiting per source
- [ ] Authentication for dashboard (API key / basic auth)
- [ ] Metrics export (Prometheus)
- [ ] Webhook playground (send test events from dashboard)
- [ ] Plugin system for custom providers
- [ ] PostgreSQL adapter for high-volume deployments

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for developers who are tired of losing webhooks.**

[⭐ Star on GitHub](https://github.com/hookdash/hookdash) · [🐛 Report Bug](https://github.com/hookdash/hookdash/issues) · [💡 Request Feature](https://github.com/hookdash/hookdash/issues)

</div>

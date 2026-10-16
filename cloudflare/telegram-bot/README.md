# Cloudflare Telegram Worker

Isolated backend bridge for the existing Numerologia Online Telegram bot.

- Source: `src/index.js`.
- Deployment config: `wrangler.jsonc`.
- Cloudflare Git production branch: `main`.
- Cloudflare Deploy command (repository root): `npx wrangler deploy --config cloudflare/telegram-bot/wrangler.jsonc`.
- The Worker forwards validated Telegram webhook updates to REG.RU's existing PHP handler.
- The Worker **does not call setWebhook**; Telegram's webhook remains unchanged until separately tested and explicitly approved.
- REG.RU owns the MySQL database, user subscriptions, and daily forecasts.
- The Cloudflare runtime must have `BOT_TOKEN` (Secret) and `WEBHOOK_SECRET` configured; do not put their values in GitHub.
- Public GET `/health` reports whether the Worker is deployed and whether its REG.RU backend is reachable. It does not verify Telegram delivery.

Operational safety: Do not automatically switch Telegram webhooks or modify the daily mailing CRON when deploying this code.

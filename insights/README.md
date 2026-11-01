# Analytics v2 — REG.RU

Dashboard `/insights/`; `/analytics/` redirects to it. Uses existing account login,
but has an independent owner check compatible with the deployed account service.
No DNS, Cloudflare, external analytics service, font, chart library or paid API.

Events are sent in batches of at most 20 with a 2.5-second timeout, at most three
failed delivery attempts per page. The script loads asynchronously in idle time.
No navigation interception, synchronous requests, large content-bank reads or
dependency from any calculation module to analytics.

Tables: `numi_insights_events`, `numi_insights_intents`. Old analytics tables and
private backups are preserved. Test events never become orders. Reports read
only verified paid non-test RUB orders from `numi_orders` and never change them.
The bank/payment provider is not connected yet; real payments will remain zero.

Attribution: last logged-in checkout choice in the previous 24 hours before order
creation. One-time purchases require matching product section; club purchases
use the last club choice. Missing attribution remains explicitly unassigned.
Custom-question text, birth dates, passwords, raw referrer/query and IP are not
collected. Titles come from authored public UI. Sessions represent tabs, not people.
DNT and GPC are respected. Report dates use Europe/Samara, storage uses UTC.

Integration for the future checkout implementation: preserve the same account
session cookie and call `window.NumiInsights?.checkout('once'|'club')` on the
actual checkout choice (existing known buttons are observed automatically;
do not add a second call to those buttons). Server payment verification must
write `numi_orders.status='paid'`, `verified_at`, provider, amount and currency;
client-side clicks or success URLs cannot record payment.

Validation: Node report/filter/CSV tests; PHP validation and actual MySQL fixture
tests cover UUID deduplication, confirmed versus pending/refunded/sandbox orders,
question-to-subscription attribution and Samara date boundaries. Local QA preview
uses conspicuously labelled synthetic data and is not part of deployment.

`deploy.py` compares exact live checksums, privately backs up every replaced file,
installs API and dashboard first, checks health and negative authorization, then
adds one independent bootstrap to six existing HTML pages. Any failure restores
the previous files. Only known legacy runtime files are retired after success.

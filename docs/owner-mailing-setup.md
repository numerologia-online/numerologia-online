# Telegram owner broadcast (isolated)

The private backend file `owner-mailing.php` must be deployed **separately** to
`~/www/xn--c1adkkdfjbp1a4l.online/api/owner-mailing.php`.
It intentionally does **not** live in this public repository because it
contains the SHA-256 digest of a randomly generated one-time owner claim code.
Never upload the claim code, bot token, database config or subscriber data to GitHub.

The Cloudflare webhook Worker routes only /owner, /broadcast, /news_on,
/news_off, owner preview callbacks (bc:...) and replies to the owner draft
prompt to this independent endpoint. All other bot commands keep the
existing REG.RU route. The morning daily forecast CRON is unchanged.

**Single initial setup**:
1. Upload the one uniquely named `owner-mailing.php` to the REG.RU API folder.
2. Add **one new, separate** REG.RU task every five minutes:
   `php ~/www/xn--c1adkkdfjbp1a4l.online/api/owner-mailing.php --run`
   Verify the absolute path matches the account before enabling.
3. In the private chat with the bot, claim administration using the
   one-time setup code given directly to the owner: `/owner <secret-code>`.
4. Test `/news_on` from the owner's personal chat (separate opt-in).
5. Send `/broadcast`, enter a short message as a reply, choose the destination
   button, inspect the preview and tap **Confirm**.
6. The new cron task delivers the queued campaign to users who separately
   opted in via `/news_on`. `/news_off` stops these messages only.

Broadcasts are **never** sent to users merely because they subscribed to daily
forecasts; daily subscription consent is not marketing consent. The only owner
can create and confirm campaigns. The endpoint checks the same signed webhook
secret as the existing REG.RU bot handler. The owner pairing is single-use.
Delivery jobs are stored in a separate MySQL queue with uniqueness per user
per campaign; runs use a MySQL advisory lock.

**Rollback**: The new feature can be disabled independently by stopping only
the new owner-mailing cron and removing the new Cloudflare forwarding condition.
Do not alter the original morning forecast cron or PHP script.

The feature is NOT live until the private REG.RU file, one cron task and a
matching Cloudflare Worker deployment are all confirmed.

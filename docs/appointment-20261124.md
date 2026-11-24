# Личные разборы / 24.11.2026

Prices: life/couple/child 10000 RUB; year 3000 RUB. One booking per day (author's work date, not an hourly appointment); unavailable through 07.12.2026 inclusive. Real confirmed bookings display only service titles. No invented customers. Existing online reports 990/490 untouched.

New independent API reuses the live wallet's verified YooKassa transport and shop config. Private booking config is **disabled by default**. No real charges, no existing payment/DB schema changes in deployment. The booking table is additive and created only after enabling. Login required. No browser price, no public personal data. Unique active date prevents double booking, stable idempotence key on ambiguous payment creation, authenticated provider GET on callback. No automatic release of an uncertain payment.

Before enabling:
- Confirm the merchant's receipt treatment for named personal services, 100% advance, VAT code, and obligation to issue a closing receipt on actual delivery; do not assume the existing digital wallet advance review covers this.
- Agree actual delivery date/format, contact procedure, cancellation/refunds and amend public offer if needed.
- Configure the dedicated YooKassa notification route /api/numi-appointment.php?action=notify for success and cancellation (without replacing existing payment webhooks). Verify notifications and authenticated provider reconciliation in a test shop, verify the receipt and refund workflows. If provider supports only one shared webhook, add routing rather than replacing the current one.
- Configure private/numi-appointment/config.local.php from example, verify owner address and access. Confirm manual operation for closing receipts/refunds and ambiguous payment cases. If a paid booking is refunded or an uncertain booking has no provider id, reconcile in the provider dashboard before releasing its active_date. Never release a slot on timeout alone.
- Only after these checks set all gates true. No live test payment without owner approval.

Public page may be deployed with payment safely closed; displays clear status and links to existing online reports. Owner listing only when logged in as the verified owner and enabled. Existing wallet, Red Flag, prompts, API routes and subscriptions are unchanged.

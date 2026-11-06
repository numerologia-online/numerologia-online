/* Optional referral attribution only. Completely separate from Numi Insights counters. */
(() => {
  'use strict';
  if (window.NumiPartnerReferralLoaded) return;
  window.NumiPartnerReferralLoaded = true;
  try {
    // Never override a visitor's explicit choice about optional attribution.
    const consent = localStorage.getItem('numi_analytics_permission');
    if (consent !== 'allow') return;
    const ref = new URLSearchParams(location.search).get('ref');
    const valid = typeof ref === 'string' && /^[a-z][a-z0-9_-]{2,39}$/i.test(ref);
    const hasHint = () => document.cookie.split(';').some(x => x.trim() === 'numi_partner_hint=1');
    if (!valid && !hasHint()) return;
    const post = (action, data = {}) => fetch('/api/numi-partners.php?action=' + action, {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
    }).catch(() => {/* No attribution error may interrupt a purchase or navigation. */});
    if (valid) post('visit', {code: ref.toLowerCase()});
    else post('bind');
    // Optional explicit hook for the account/login integration after login completes.
    window.NumiPartnerReferral = Object.freeze({bind: () => hasHint() ? post('bind') : Promise.resolve()});
    // A passive retry after a login/checkout interaction covers common single-page logins.
    let retry = false;
    document.addEventListener('click', event => {
      if (retry || !hasHint()) return;
      const el = event.target instanceof Element ? event.target.closest('button,a') : null;
      if (!el) return;
      const label = ((el.id || '') + ' ' + (el.textContent || '')).toLowerCase();
      if (!/login|войти|оплат|купить|paywall|checkout/.test(label)) return;
      retry = true;
      setTimeout(() => post('bind'), 1200);
    }, {passive: true});
  } catch (_) {/* Isolated script must never interrupt the site. */}
})();

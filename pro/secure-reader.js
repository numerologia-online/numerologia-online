const pending = new Map();
const ticketKey = "numerologia-owner-oidc-ticket-v1";

export function readSignedMiniAppData() {
  const direct = window.Telegram?.WebApp?.initData;
  if (typeof direct === "string" && direct) return direct;
  return new URLSearchParams(location.hash.slice(1)).get("tgWebAppData") || "";
}

export function readBrowserOwnerTicket() {
  let ticket = new URLSearchParams(location.hash.slice(1)).get("tg_session");
  if (ticket !== null) {
    history.replaceState(null, "", location.pathname + location.search);
    try { sessionStorage.setItem(ticketKey, ticket); } catch (_) {}
  } else {
    try { ticket = sessionStorage.getItem(ticketKey) || ""; } catch (_) {}
  }
  return /^[A-Za-z0-9_.-]{16,5000}$/.test(ticket || "") ? ticket : "";
}

export function clearBrowserOwnerTicket() {
  try { sessionStorage.removeItem(ticketKey); } catch (_) {}
}

export async function readProJson(kind, birth, params = {}) {
  const body = {kind, ...params};
  if (birth) {
    const {year, month, day} = birth;
    body.birth_date = [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  }
  const signed = readSignedMiniAppData();
  if (kind !== "karma_preview") {
    if (signed && signed.length < 6000) body.init_data = signed;
    else {
      const ticket = readBrowserOwnerTicket();
      if (ticket) body.owner_ticket = ticket;
    }
  }
  const key = JSON.stringify(body);
  if (!pending.has(key)) {
    const req = fetch("/api/numi-life-content.php", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: key
    }).then(async response => {
      if (!response.ok) throw new Error("Не удалось загрузить разбор (" + response.status + ")");
      return response.json();
    }).finally(() => pending.delete(key));
    pending.set(key, req);
  }
  return pending.get(key);
}

export const loadProtectedFullReportSection = (birth, definition) =>
  readProJson("section", birth, {energy: definition.energy, chapter: definition.key});

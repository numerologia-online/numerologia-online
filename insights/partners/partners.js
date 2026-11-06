(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const number = new Intl.NumberFormat('ru-RU');
  const money = kop => (Number(kop || 0) / 100).toLocaleString('ru-RU', {maximumFractionDigits: 2}) + ' ₽';
  const base = '/api/numi-partners.php';
  const date = d => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Samara', year:'numeric', month:'2-digit', day:'2-digit'}).format(d);
  const today = new Date();
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - 29);
  $('from').value = date(start); $('to').value = date(today);
  function status(message, error = false) {
    $('status').textContent = message;
    $('status').className = error ? 'status error' : 'status';
  }
  async function request(path, init) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(base + path, {credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...init});
      let data = null; try { data = await response.json(); } catch (_) {}
      if (!response.ok || !data?.ok) throw new Error(
        ({OWNER_LOGIN_REQUIRED: 'Сначала войдите в основную аналитику под аккаунтом владельца.',
          PARTNERS_NOT_INSTALLED: 'Партнёрская база ещё не установлена на сервере.',
          CODE_EXISTS: 'Такой код уже существует. Придумайте другой.',
          BAD_RANGE: 'Проверьте даты.', INVALID_PARTNER: 'Проверьте имя, код и процент.'})[data?.error] ||
          'Нет ответа сервера: ' + response.status
      );
      return data;
    } finally { clearTimeout(timeout); }
  }
  function cell(tr, value) { const td = document.createElement('td'); td.textContent = value; tr.append(td); return td; }
  async function copy(text, button) {
    try { await navigator.clipboard.writeText(text); button.textContent = 'Скопировано'; }
    catch (_) { window.prompt('Скопируйте ссылку:', text); }
  }
  function render(data) {
    const body = $('rows'); body.replaceChildren();
    for (const p of data.partners) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      const name = document.createElement('div');
      name.className = 'name'; name.textContent = p.label + (p.active ? '' : ' (отключён)');
      const link = 'https://нумерология.online/?ref=' + p.code;
      const anchor = document.createElement('a');
      anchor.className = 'link'; anchor.href = link; anchor.textContent = link;
      anchor.rel = 'noreferrer'; anchor.target = '_blank';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'secondary small-button';
      button.textContent = 'Копировать'; button.addEventListener('click', () => copy(link, button));
      const info = document.createElement('div'); info.className = 'hint'; info.textContent = 'Комиссия ' + p.rate_bps / 100 + '%';
      td.append(name, anchor, info, button); tr.append(td);
      for (const value of [p.clicks, p.unique_links, p.registrations, p.accounts, p.buyers, p.paid_orders])
        cell(tr, number.format(Number(value)));
      cell(tr, money(p.revenue_kopeks));
      cell(tr, money(p.commission_kopeks));
      body.append(tr);
    }
    if (!data.partners.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 9; td.textContent = 'Партнёров пока нет. Создайте первую ссылку выше.';
      tr.append(td); body.append(tr);
    }
    status('Данные обновлены. Период: ' + data.from + ' — ' + data.to + '.');
  }
  async function load() {
    status('Загружаем…');
    try {
      const params = new URLSearchParams({action: 'partners', from: $('from').value, to: $('to').value});
      render(await request('?' + params));
    } catch (e) { status(e.message || 'Ошибка загрузки', true); }
  }
  $('filter').addEventListener('submit', event => { event.preventDefault(); load(); });
  $('create').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    const code = $('partner-code').value.toLowerCase().trim();
    const rate = Number($('partner-rate').value);
    $('new-link').textContent = '';
    try {
      if (!Number.isFinite(rate) || rate < 0 || rate > 50) throw new Error('Неверная комиссия.');
      const data = await request('?action=create', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({code, label: $('partner-name').value.trim(), rate_bps: Math.round(rate * 100)})
      });
      const link = document.createElement('a'); link.href = data.url; link.textContent = data.url;
      link.target = '_blank'; link.rel = 'noreferrer';
      const copyButton = document.createElement('button');
      copyButton.className = 'secondary small-button'; copyButton.type = 'button';
      copyButton.textContent = 'Копировать ссылку';
      copyButton.addEventListener('click', () => copy(data.url, copyButton));
      $('new-link').append('Ссылка создана: ', link, ' ', copyButton);
      await load();
    } catch (e) { $('new-link').textContent = e.message; }
    finally { button.disabled = false; }
  });
  load();
})();

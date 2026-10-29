import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";

const guard = fs.readFileSync(new URL("../telegram-scroll-guard.js", import.meta.url), "utf8");
const read = path => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");

function boot({ telegram = false, modern = true, loading = false, initData = "" } = {}) {
  let called = 0;
  let requestedVersion = "";
  let domReady;
  const webApp = {
    initData,
    isVersionAtLeast(version) {
      requestedVersion = version;
      return modern;
    },
    disableVerticalSwipes() { called++; }
  };
  const document = {
    readyState: loading ? "loading" : "complete",
    documentElement: { style: {} },
    body: { style: {} },
    addEventListener(type, fn) {
      assert.equal(type, "DOMContentLoaded");
      domReady = fn;
    }
  };
  const window = {
    Telegram: { WebApp: webApp },
    ...(telegram ? { TelegramWebviewProxy: {} } : {})
  };
  runInNewContext(guard, { window, document, location: { href: "https://numerologia-online.github.io/numerologia-online/" } });
  return { document, requestedVersion: () => requestedVersion, called: () => called, domReady: () => domReady?.() };
}

test("Telegram Mini App disables vertical closing swipes and overscroll chaining", () => {
  const app = boot({ telegram: true });
  assert.equal(app.called(), 1);
  assert.equal(app.requestedVersion(), "7.7");
  assert.equal(app.document.documentElement.style.overscrollBehaviorY, "none");
  assert.equal(app.document.body.style.overscrollBehaviorY, "none");
});

test("Ordinary Safari does not have its page scrolling changed", () => {
  const app = boot();
  assert.equal(app.called(), 0);
  assert.equal(app.document.documentElement.style.overscrollBehaviorY, undefined);
  assert.equal(app.document.body.style.overscrollBehaviorY, undefined);
});

test("Telegram clients below 7.7 retain their fallback behavior without errors", () => {
  const app = boot({ telegram: true, modern: false });
  assert.equal(app.called(), 0);
});

test("Guard also works when loaded before DOM is ready", () => {
  const app = boot({ telegram: true, loading: true });
  assert.equal(app.called(), 0);
  app.domReady();
  assert.equal(app.called(), 1);
});

test("All report entry pages load the guard after Telegram's SDK", () => {
  for (const path of ["index.html", "pro/index.html", "year/index.html", "child/index.html"]) {
    const html = read(path);
    const sdk = html.indexOf("https://telegram.org/js/telegram-web-app.js");
    const guardLocation = html.indexOf("telegram-scroll-guard.js?v=1");
    assert.ok(sdk > -1 && guardLocation > sdk, path + " must load Telegram SDK first");
    assert.equal(html.match(/telegram-scroll-guard.js\?v=1/g)?.length, 1);
  }
});

test("No aggressive touch interception that would break PDF scrolling", () => {
  assert.doesNotMatch(guard, /addEventListener\s*\(\s*["\x27]touchmove|\.preventDefault\s*\(|\.stopPropagation\s*\(|\.style\.touchAction\s*=/);
});

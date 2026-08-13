/**
 * Слой хранения. Один и тот же код работает в двух режимах:
 *
 *   через сервер (http://localhost:4173) → данные в data/state.json, общие для всех браузеров
 *   открыт файлом (file://)              → данные в localStorage этого браузера, как раньше
 *
 * При первом запуске через сервер накопленный localStorage переносится в файл,
 * так что прогресс не теряется.
 *
 * Использование:
 *   await Store.ready();
 *   const st = Store.get("lesson:xxx");
 *   Store.set("lesson:xxx", { ... });
 */
window.Store = (function () {
  const API = "/api/state";
  const PREFIXES = ["lesson:", "quiz:", "srs:", "cards:"];
  const overHttp = location.protocol === "http:" || location.protocol === "https:";

  let cache = {};
  let mode = "local";        // "server" | "local"
  let pending = false;
  let timer = null;
  let readyPromise = null;

  function readLocalAll() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !PREFIXES.some((p) => k.startsWith(p))) continue;
        try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (_) { /* мусор пропускаем */ }
      }
    } catch (_) { /* хранилище недоступно (приватный режим) */ }
    return out;
  }

  async function init() {
    if (overHttp) {
      try {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        cache = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
        mode = "server";

        // разовый перенос старого прогресса из браузера в файл
        const local = readLocalAll();
        const missing = Object.keys(local).filter((k) => !(k in cache));
        if (missing.length) {
          missing.forEach((k) => { cache[k] = local[k]; });
          await flush(true);
          console.info("[Store] перенесено из localStorage в файл: " + missing.length + " записей");
        }
        return mode;
      } catch (err) {
        console.warn("[Store] сервер недоступен, работаю на localStorage:", err.message);
      }
    }
    cache = readLocalAll();
    mode = "local";
    return mode;
  }

  function ready() {
    if (!readyPromise) readyPromise = init();
    return readyPromise;
  }

  function get(key) {
    return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
  }

  function set(key, value) {
    cache[key] = value;
    if (mode === "server") schedule();
    else { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  }

  function remove(key) {
    delete cache[key];
    if (mode === "server") schedule();
    else { try { localStorage.removeItem(key); } catch (_) {} }
  }

  function schedule() {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => { flush(); }, 300);
  }

  async function flush(force) {
    if (!pending && !force) return true;
    pending = false;
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cache)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return true;
    } catch (err) {
      pending = true;                       // попробуем при следующей записи
      console.warn("[Store] не удалось сохранить:", err.message);
      return false;
    }
  }

  // страховка: успеть отправить несохранённое при закрытии вкладки
  window.addEventListener("pagehide", () => {
    if (mode === "server" && pending && navigator.sendBeacon) {
      navigator.sendBeacon(API, new Blob([JSON.stringify(cache)], { type: "application/json" }));
      pending = false;
    }
  });

  return {
    ready, get, set, remove, flush,
    keys: () => Object.keys(cache),
    mode: () => mode
  };
})();

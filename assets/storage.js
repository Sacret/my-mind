/**
 * Слой хранения. Один и тот же код работает в двух режимах:
 *
 *   через свой сервер (localhost:4173)   → данные в data/state.json, общие для всех браузеров
 *   открыт файлом (file://)              → данные в localStorage этого браузера, как раньше
 *   чужой хост (GitHub Pages и прочее)   → тоже localStorage: у каждого посетителя свой прогресс
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
  // Сервер бывает только свой: localhost или эта же машина в домашней сети (npm run lan).
  // На чужом хосте — например на GitHub Pages — эндпоинта нет, и ходить за ним незачем:
  // там прогресс всегда живёт в браузере посетителя.
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const overHttp =
    (location.protocol === "http:" || location.protocol === "https:") && LOCAL_HOST.test(location.hostname);

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

  /**
   * Где открыта страница: "file" — двойным кликом по файлу, "own" — на своей
   * машине (есть шанс на сервер), "foreign" — чужой хост, публичная копия.
   */
  function place() {
    if (location.protocol === "file:") return "file";
    return overHttp ? "own" : "foreign";
  }

  /** Весь прогресс одним объектом — для выгрузки в файл. */
  function exportAll() {
    return JSON.parse(JSON.stringify(cache));
  }

  /**
   * Приём прогресса из файла. how = "merge" (по умолчанию) — записи из файла
   * добавляются к своим и перекрывают одноимённые; how = "replace" — прежний
   * прогресс стирается целиком. Возвращает, сколько записей принято.
   */
  async function importAll(data, how) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("файл не похож на выгрузку прогресса");
    }
    const incoming = {};
    Object.keys(data).forEach((k) => {
      if (PREFIXES.some((p) => k.startsWith(p))) incoming[k] = data[k];
    });
    const keys = Object.keys(incoming);
    if (!keys.length) throw new Error("в файле нет записей прогресса");

    if (how === "replace") {
      Object.keys(cache).forEach((k) => { if (!(k in incoming)) remove(k); });
    }
    keys.forEach((k) => set(k, incoming[k]));
    if (mode === "server" && !(await flush(true))) throw new Error("не удалось записать на сервер");
    return keys.length;
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
    exportAll, importAll, place,
    keys: () => Object.keys(cache),
    mode: () => mode
  };
})();

/**
 * Локальный сервер для my-mind. Без зависимостей — только встроенный Node.
 *
 *   node server.mjs           → http://127.0.0.1:4173 (только этот компьютер)
 *   node server.mjs --lan     → доступен с телефона и планшета в той же Wi-Fi сети
 *   PORT=8080 node server.mjs → другой порт
 *
 * Отдаёт файлы проекта и хранит весь прогресс в data/state.json.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, "data");
const STATE = path.join(DATA_DIR, "state.json");
const BACKUPS = path.join(DATA_DIR, "backups");

const PORT = Number(process.env.PORT) || 4173;
const LAN = process.argv.includes("--lan");
const HOST = LAN ? "0.0.0.0" : "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE, "utf8"));
  } catch {
    return {};
  }
}

async function writeState(obj) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  // раз в день откладываем копию — страховка от случайной перезаписи
  await fs.mkdir(BACKUPS, { recursive: true });
  const backup = path.join(BACKUPS, "state-" + today() + ".json");
  try {
    await fs.access(backup);
  } catch {
    try { await fs.copyFile(STATE, backup); } catch { /* первого запуска ещё не было */ }
  }

  // запись через временный файл: даже при обрыве state.json не окажется битым
  const tmp = STATE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fs.rename(tmp, STATE);
}

function readBody(req, limitBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limitBytes) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" });
  res.end(body);
};

async function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith("/")) rel += "index.html";

  const filePath = path.join(ROOT, rel);
  // защита от выхода за пределы папки проекта
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  // data/ наружу не отдаём — прогресс доступен только через API
  if (filePath.startsWith(DATA_DIR)) {
    res.writeHead(404).end("Not found");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) return serveStatic(req, res, rel + "/");
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    res.end("<h1>404</h1><p><a href='/'>к оглавлению</a></p>");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));

  // Разрешаем обращения со страниц, открытых как file:// — это нужно migrate.html,
  // который переносит старый localStorage (у него origin "null") в файл.
  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  }

  // Слияние: приходящие ключи побеждают, остальное в файле сохраняется.
  // Отдельная ручка от PUT, чтобы перенос не затирал уже накопленное.
  if (url.pathname === "/api/merge" && (req.method === "POST" || req.method === "PUT")) {
    try {
      const incoming = JSON.parse(await readBody(req));
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        return json(res, 400, { error: "expected object" });
      }
      const current = await readState();
      const added = Object.keys(incoming).filter((k) => !(k in current));
      const merged = { ...current, ...incoming };
      await writeState(merged);
      console.log(new Date().toLocaleTimeString("ru-RU") +
        "  слияние: получено " + Object.keys(incoming).length + ", новых ключей " + added.length);
      return json(res, 200, { ok: true, received: Object.keys(incoming).length, added: added.length, total: Object.keys(merged).length });
    } catch (err) {
      return json(res, 400, { error: String(err && err.message || err) });
    }
  }

  if (url.pathname === "/api/state") {
    try {
      if (req.method === "GET") {
        return json(res, 200, await readState());
      }
      if (req.method === "PUT" || req.method === "POST") {
        const raw = await readBody(req);
        let incoming;
        try {
          incoming = JSON.parse(raw);
        } catch {
          return json(res, 400, { error: "invalid json" });
        }
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
          return json(res, 400, { error: "expected object" });
        }
        await writeState(incoming);
        const keys = Object.keys(incoming).length;
        console.log(new Date().toLocaleTimeString("ru-RU") + "  сохранено, ключей: " + keys);
        return json(res, 200, { ok: true, keys });
      }
      res.writeHead(405).end("Method not allowed");
      return;
    } catch (err) {
      return json(res, 500, { error: String(err && err.message || err) });
    }
  }

  if (url.pathname === "/api/health") {
    return json(res, 200, { ok: true, storage: "file", path: path.relative(ROOT, STATE) });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end("Method not allowed");
    return;
  }
  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  my-mind запущен");
  console.log("  прогресс хранится в " + path.relative(ROOT, STATE));
  console.log("");
  console.log("  этот компьютер:  http://localhost:" + PORT);
  if (LAN) {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          console.log("  в сети Wi-Fi:    http://" + net.address + ":" + PORT + "   (" + name + ")");
        }
      }
    }
    console.log("");
    console.log("  ВНИМАНИЕ: режим --lan открывает доступ всем в этой сети, без пароля.");
    console.log("  Включай его только в доверенной сети — дома, но не в кафе.");
  } else {
    console.log("  для телефона в той же сети перезапусти: node server.mjs --lan");
  }
  console.log("");
  console.log("  остановить — Ctrl+C");
  console.log("");
});

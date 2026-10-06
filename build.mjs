/**
 * Сборка страниц my-mind. Без зависимостей — только встроенный Node.
 *
 *   npm run build          собрать всё
 *   npm run build -- --check   ничего не писать, только сказать, что изменится
 *
 * Источники лежат в src/pages/*.html: небольшая шапка с параметрами и разметка тела.
 * Общий каркас — src/layout.html, он описан ОДИН раз.
 *
 * Доступные подстановки внутри источника:
 *   {{root}}     — путь к корню проекта относительно страницы ("", "../", "../../")
 *   {{crumb}}    — липкая шапка: лого, ссылка на оглавление и путь до урока
 *   {{back}}     — кнопка «Назад» на оглавление внизу страницы
 *   {{scripts}}  — теги <script> из параметра js
 *   {{corner}}   — уголок со ссылкой на GitHub; в {{crumb}} он уже есть,
 *                  нужен только страницам со своей шапкой
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.join(ROOT, "src", "pages");
const LAYOUT = path.join(ROOT, "src", "layout.html");
const CHECK = process.argv.includes("--check");

/** Адрес сайта для Open Graph: превью в мессенджерах требуют абсолютных ссылок. */
const SITE_URL = "https://sacret.github.io/my-mind/";
const DESCRIPTION = "Личная программа обучения: уроки, тесты и карточки для повторения";

/** Значение для атрибута в двойных кавычках. */
function attr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Разбирает шапку вида ---\nkey: value\n--- в начале файла. */
function parseSource(raw, file) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("нет блока параметров в " + file);
  const meta = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    if (i < 0) throw new Error("непонятная строка параметров в " + file + ": " + line);
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of ["title", "out"]) {
    if (!meta[key]) throw new Error("в " + file + " не задан параметр " + key);
  }
  return { meta, body: m[2] };
}

/** Путь к корню относительно готовой страницы: "", "../", "../../" */
function rootPrefix(out) {
  const depth = out.split("/").length - 1;
  return "../".repeat(depth);
}

/** Уголок со ссылкой на репозиторий: стоит в правом краю липкой шапки, её высотой. */
const CORNER =
  '<a href="https://github.com/Sacret/my-mind" target="_blank" class="github-corner" aria-label="Исходный код на GitHub"><svg width="50" height="50" viewBox="0 0 250 250" aria-hidden="true"><path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z"></path><path d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2" fill="currentColor" style="transform-origin: 130px 106px;" class="octo-arm"></path><path d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z" fill="currentColor" class="octo-body"></path></svg></a>';

/**
 * Липкая шапка страницы: лого со ссылкой на оглавление и путь до текущего урока.
 * Путь приходит из параметра crumb строкой вида «· Работа · JavaScript · Урок 4»;
 * каждое звено выносим в свой <span> — на узком экране остаётся только последнее.
 */
function crumbHtml(root, tail) {
  const segments = tail
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => "<span>" + s + "</span>")
    .join("");
  return (
    '<header class="topbar">\n' +
    '  <div class="topbar-in">\n' +
    '    <a class="topbar-home" href="' + root + 'index.html">' +
    '<img class="mark" src="' + root + 'assets/icon.svg" alt="">' +
    '<span class="topbar-name">my-mind</span></a>\n' +
    (segments ? '    <div class="topbar-crumb">' + segments + "</div>\n" : "") +
    "  </div>\n" +
    "  " + CORNER + "\n" +
    "</header>"
  );
}

function backHtml(root) {
  return '<div class="back"><a href="' + root + 'index.html">← Назад</a></div>';
}

function scriptsHtml(root, list) {
  if (!list) return "";
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => '<script src="' + root + "assets/" + name + '.js"></script>')
    .join("\n");
}

function cssHtml(root, list) {
  if (!list) return "";
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((href) => '<link rel="stylesheet" href="' + root + href + '">\n')
    .join("");
}

function render(layout, source, file) {
  const { meta, body } = parseSource(source, file);
  const root = rootPrefix(meta.out);

  // собственный <style> страницы поднимаем из тела в <head>
  let rest = body;
  let style = "";
  const styleMatch = rest.match(/^<style>[\s\S]*?<\/style>\n/);
  if (styleMatch) {
    style = styleMatch[0];
    rest = rest.slice(style.length);
  }

  const html = rest
    .replace(/\{\{crumb\}\}/g, crumbHtml(root, meta.crumb || ""))
    .replace(/\{\{back\}\}/g, backHtml(root))
    .replace(/\{\{corner\}\}/g, CORNER)
    .replace(/\{\{scripts\}\}/g, scriptsHtml(root, meta.js))
    .replace(/\{\{root\}\}/g, root)
    .trimEnd();

  return {
    out: meta.out,
    text: layout
      .replace("{{source}}", file)
      .replace("{{title}}", meta.title)
      .replace(/\{\{ogTitle\}\}/g, () => attr(meta.title))
      .replace(/\{\{description\}\}/g, () => attr(meta.description || DESCRIPTION))
      .replace("{{url}}", () => SITE_URL + (meta.out === "index.html" ? "" : meta.out))
      .replace("{{css}}", cssHtml(root, meta.css))
      .replace("{{style}}", style)
      .replace("{{bodyClass}}", meta.body ? ' class="' + meta.body + '"' : "")
      .replace("{{body}}", html)
      .replace(/\{\{root\}\}/g, root)
  };
}

const layout = fs.readFileSync(LAYOUT, "utf8");
const sources = fs.readdirSync(PAGES).filter((f) => f.endsWith(".html")).sort();

let written = 0, same = 0, changed = [];
const produced = new Set();

for (const file of sources) {
  const { out, text } = render(layout, fs.readFileSync(path.join(PAGES, file), "utf8"), file);
  if (produced.has(out)) throw new Error("две страницы пишут в один файл: " + out);
  produced.add(out);

  const target = path.join(ROOT, out);
  const before = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;

  if (before === text) { same++; continue; }
  changed.push(out);
  if (!CHECK) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    written++;
  }
}

console.log("страниц в src/pages: " + sources.length);
console.log("без изменений: " + same);
if (CHECK) {
  console.log(changed.length ? "изменились бы: " + changed.length : "всё совпадает с собранным");
  changed.forEach((f) => console.log("  " + f));
  process.exit(changed.length ? 1 : 0);
} else {
  console.log("перезаписано: " + written);
  changed.forEach((f) => console.log("  " + f));
}

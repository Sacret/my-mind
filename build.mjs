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
 *   {{crumb}}    — строка навигации с иконкой и ссылкой на оглавление
 *   {{back}}     — кнопка «Назад» на оглавление внизу страницы
 *   {{scripts}}  — теги <script> из параметра js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.join(ROOT, "src", "pages");
const LAYOUT = path.join(ROOT, "src", "layout.html");
const CHECK = process.argv.includes("--check");

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

function crumbHtml(root, tail) {
  const link =
    '<a class="home" href="' + root + 'index.html">' +
    '<img class="mark" src="' + root + 'assets/icon.svg" alt="">my-mind</a>';
  return '<div class="crumb">' + link + (tail ? "<span>" + tail + "</span>" : "") + "</div>";
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
    .replace(/\{\{scripts\}\}/g, scriptsHtml(root, meta.js))
    .replace(/\{\{root\}\}/g, root)
    .trimEnd();

  return {
    out: meta.out,
    text: layout
      .replace("{{source}}", file)
      .replace("{{title}}", meta.title)
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

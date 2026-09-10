/**
 * История попыток входных тестов. Ответы теста лежат в quiz:<id> и при пересдаче
 * перезаписываются — здесь же копится то, что перезаписывать нельзя: результат
 * каждой проверки. Нужен Store (assets/storage.js), подключать после него.
 *
 *   Attempts.add("general-baseline-01", rec)   дописать попытку
 *   Attempts.list("general-baseline-01")       все попытки, от старых к новым
 *   Attempts.table(id)                         таблица «когда — сколько — Δ»
 *   Attempts.compare(id)                       разбор последней попытки против прошлой
 *
 * Запись одной попытки повторяет форму state.attempts у уроков (assets/lesson.js),
 * плюс разбивка по категориям — ради неё тест и пересдаётся:
 *   { date: "2026-09-10", score: 44, total: 50,
 *     wrong: [3, 12], unsure: [7],              номера вопросов с нуля
 *     cats: { "Логика": [2, 3], ... } }         верных из скольких
 *
 * Итог попытки храним готовым, а не пересчитываем потом из ответов: вопросы
 * правятся, и старая попытка иначе задним числом «меняла» бы балл.
 */
window.Attempts = (function () {
  const MAX = 30;                       // больше в оглавление всё равно не влезет
  const keyOf = (id) => "quiz:" + id + ":attempts";

  function list(id) {
    const v = Store.get(keyOf(id));
    return Array.isArray(v) ? v.slice() : [];
  }

  function add(id, rec) {
    const all = list(id);
    const last = all[all.length - 1];
    // «Проверить → Пересдать → Проверить» без единой правки — та же попытка, не новая
    const same = last && last.date === rec.date && last.score === rec.score &&
                 String(last.wrong) === String(rec.wrong) &&
                 String(last.unsure) === String(rec.unsure);
    if (same) all[all.length - 1] = rec;
    else all.push(rec);
    while (all.length > MAX) all.shift();
    Store.set(keyOf(id), all);
    return all;
  }

  function clear(id) { Store.remove(keyOf(id)); }

  const pct = (a) => Math.round(a.score / a.total * 100);
  const guessed = (a) => (a.unsure || []).length;

  /** Локальная дата в виде 2026-09-10 — тот же формат, что у уроков и календаря. */
  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
           "-" + String(d.getDate()).padStart(2, "0");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return d + "." + m + "." + y;
  }

  /** Номера вопросов, где результат изменился между попытками (в подписи — с единицы). */
  function diff(prev, cur) {
    const gained = [], lost = [];
    if (!prev || !cur) return { gained, lost };
    const was = prev.wrong || [], now = cur.wrong || [];
    was.forEach((i) => { if (!now.includes(i)) gained.push(i + 1); });
    now.forEach((i) => { if (!was.includes(i)) lost.push(i + 1); });
    return { gained: gained.sort((a, b) => a - b), lost: lost.sort((a, b) => a - b) };
  }

  /** Все категории обеих попыток в порядке первого появления. */
  function catNames(attempts) {
    const out = [];
    attempts.forEach((a) => Object.keys(a.cats || {}).forEach((c) => {
      if (!out.includes(c)) out.push(c);
    }));
    return out;
  }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /** Подпись изменения: +4 / −2 / без изменений. */
  function deltaCell(delta) {
    const td = el("td", "att-delta num");
    if (delta === null) { td.textContent = "—"; return td; }
    td.textContent = delta > 0 ? "+" + delta : delta < 0 ? "−" + Math.abs(delta) : "0";
    td.classList.add(delta > 0 ? "up" : delta < 0 ? "down" : "flat");
    return td;
  }

  /** Таблица попыток: строка на проверку, с изменением балла к предыдущей. */
  function table(id) {
    const all = list(id);
    if (!all.length) return null;

    const t = el("table", "att-table");
    const head = el("tr");
    ["Когда", "Результат", "%", "Δ", "Угадано"].forEach((h) => head.append(el("th", null, h)));
    t.append(head);

    all.forEach((a, i) => {
      const tr = el("tr");
      if (i === all.length - 1 && all.length > 1) tr.className = "att-last";
      tr.append(el("td", null, fmtDate(a.date)));
      tr.append(el("td", "num", a.score + " / " + a.total));
      tr.append(el("td", "num", pct(a) + "%"));
      tr.append(deltaCell(i ? a.score - all[i - 1].score : null));
      tr.append(el("td", "num", guessed(a) ? String(guessed(a)) : "—"));
      t.append(tr);
    });
    return t;
  }

  /**
   * Разбор последней попытки против предыдущей: по категориям и по вопросам.
   * Ради этого тест и пересдаётся — общий балл слишком крупная мера.
   */
  function compare(id) {
    const all = list(id);
    if (all.length < 2) return null;
    const prev = all[all.length - 2], cur = all[all.length - 1];

    const box = el("div", "att");
    const cats = el("table", "att-table att-cats");
    const ch = el("tr");
    ["Категория", fmtDate(prev.date), fmtDate(cur.date), "Δ"].forEach((h) => ch.append(el("th", null, h)));
    cats.append(ch);
    catNames([prev, cur]).forEach((c) => {
      const a = (prev.cats || {})[c], b = (cur.cats || {})[c];
      const tr = el("tr");
      tr.append(el("td", null, c));
      tr.append(el("td", "num", a ? a[0] + " / " + a[1] : "—"));
      tr.append(el("td", "num", b ? b[0] + " / " + b[1] : "—"));
      tr.append(deltaCell(a && b ? b[0] - a[0] : null));
      cats.append(tr);
    });
    box.append(cats);

    const d = diff(prev, cur);
    const p = el("p", "lead sm");
    if (!d.gained.length && !d.lost.length) {
      p.textContent = "Те же вопросы решены так же, как в прошлый раз.";
    } else {
      if (d.gained.length) {
        p.append(el("b", null, "Стало верно: "));
        p.append(document.createTextNode("#" + d.gained.join(", #") + ". "));
      }
      if (d.lost.length) {
        p.append(el("b", null, "Разучилось: "));
        p.append(document.createTextNode("#" + d.lost.join(", #") + "."));
      }
    }
    box.append(p);
    return box;
  }

  return { list, add, clear, diff, table, compare, today, fmtDate, pct, KEY: keyOf };
})();

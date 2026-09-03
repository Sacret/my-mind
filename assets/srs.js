/**
 * Политика интервальных повторений. Общая для страницы карточек и дашборда,
 * чтобы «сколько сегодня» считалось в одном месте.
 */
window.SRS = (function () {
  // Интервалы в днях по коробкам. Ошибка возвращает карточку в коробку 0.
  const INTERVALS = [0, 1, 3, 7, 16, 35];

  const KEY = "srs:v1";           // коробка и дата следующего показа по каждой карточке
  const KEY_AUTO = "cards:auto";  // карточки, сделанные из промахов в уроках
  const KEY_LOG = "srs:log";      // по дням: сколько оценок и сколько из них «не вспомнила»

  const LEECH = 3;                // столько провалов — и карточка считается залипшей
  const LEECH_CLEAR = 2;          // столько успехов подряд — и метка снимается
  const LOG_DAYS = 60;            // столько дней держим в журнале
  const RATE_DAYS = 14;           // за столько дней считаем долю «не вспомнила»
  const FORECAST_DAYS = 7;        // на столько дней вперёд строим прогноз нагрузки

  const DEFAULTS = {
    newPerDay: 10,   // сколько НОВЫХ карточек открывать за день
    maxPerDay: 40    // потолок карточек за день всего
  };

  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = () => iso(new Date());

  /**
   * Дата следующего показа с разбросом ±15%.
   * Разброс нужен, чтобы карточки одного урока не возвращались одним комком.
   */
  function nextDue(box) {
    const base = INTERVALS[Math.min(box, INTERVALS.length - 1)];
    let days = base;
    if (base >= 3) {
      const spread = Math.round(base * 0.15);
      days = base + Math.round((Math.random() * 2 - 1) * spread);
      days = Math.max(2, days);
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    return iso(d);
  }

  function settingsFrom(stored) {
    const s = stored || {};
    return {
      newPerDay: Number.isFinite(+s.newPerDay) && +s.newPerDay >= 0 ? +s.newPerDay : DEFAULTS.newPerDay,
      maxPerDay: Number.isFinite(+s.maxPerDay) && +s.maxPerDay > 0 ? +s.maxPerDay : DEFAULTS.maxPerDay
    };
  }

  /** Счётчики за сегодня; при смене даты обнуляются. */
  function dailyFrom(stored) {
    const d = stored || {};
    return d.date === today() ? { date: d.date, done: d.done || 0, fresh: d.fresh || 0 }
                              : { date: today(), done: 0, fresh: 0 };
  }

  /**
   * Что показывать сегодня.
   * Просроченные идут раньше новых: долг важнее притока.
   */
  function plan(cards, srs, settings, daily) {
    const t = today();
    const seen = (c) => !!srs[c.id];

    const dueAll = cards.filter((c) => seen(c) && srs[c.id].due <= t);
    const freshAll = cards.filter((c) => !seen(c));

    const budget = Math.max(0, settings.maxPerDay - daily.done);
    const newBudget = Math.max(0, settings.newPerDay - daily.fresh);

    const due = dueAll.slice(0, budget);
    const fresh = freshAll.slice(0, Math.min(newBudget, budget - due.length));

    return {
      due, fresh,
      session: due.concat(fresh),
      deferredDue: dueAll.length - due.length,
      waitingNew: freshAll.length - fresh.length,
      dueTotal: dueAll.length,
      newTotal: freshAll.length
    };
  }

  /**
   * Карточки, сделанные из промахов в уроках. Лежат отдельно от рукописных
   * (review/cards.js) — те правятся руками, эти появляются сами.
   */
  function autoCards() {
    const stored = (window.Store && Store.get(KEY_AUTO)) || {};
    return Object.keys(stored).map((id) => Object.assign({ id: id, auto: true }, stored[id]));
  }

  /** Полная колода: рукописные карточки плюс сделанные из промахов. */
  function deck(base) {
    return (base || []).concat(autoCards());
  }

  /**
   * Промах в уроке: вопрос становится карточкой и уходит в коробку 0.
   * Ключ карточки — урок и номер вопроса, поэтому повторный промах по тому же
   * вопросу не плодит дубли, а просто возвращает карточку в начало.
   */
  function noteMisses(cards) {
    if (!cards || !cards.length || !window.Store) return;
    const auto = Store.get(KEY_AUTO) || {};
    const boxes = Store.get(KEY) || {};
    cards.forEach((c) => {
      auto[c.id] = {
        lesson: c.lesson, front: c.front, back: c.back, note: c.note || "",
        code: !!c.code, src: c.src, date: today()
      };
      boxes[c.id] = { box: 0, due: today() };
    });
    Store.set(KEY_AUTO, auto);
    Store.set(KEY, boxes);
  }

  /**
   * Оценка карточки: куда её двигать. Здесь же копятся счётчики, по которым
   * дашборд считает залипшие карточки: seen — сколько раз спрашивали,
   * lapses — в скольких РАЗНЫХ сессиях не вспомнилась, streak — сколько
   * успехов подряд после последнего провала.
   * repeat — карточку уже оценивали сегодня и она вернулась в конец сессии.
   * Такой повтор не идёт в lapses: иначе один плохой вечер набирает порог
   * залипания сам по себе, без всякого забывания через интервал.
   */
  function applyGrade(entry, kind, repeat) {
    const st = Object.assign({ box: 0, seen: 0, lapses: 0, streak: 0 }, entry || {});
    st.seen = (st.seen || 0) + 1;
    if (kind === "again") {
      if (!repeat) st.lapses = (st.lapses || 0) + 1;
      st.streak = 0;
      st.box = 0;
      st.due = today();
    } else {
      st.streak = (st.streak || 0) + 1;
      st.box = Math.min(INTERVALS.length - 1, st.box + (kind === "easy" ? 2 : 1));
      st.due = nextDue(st.box);
    }
    return st;
  }

  /** Дневной журнал оценок: из него берётся доля «не вспомнила». */
  function logGrade(kind) {
    if (!window.Store) return;
    const log = Store.get(KEY_LOG) || {};
    const day = log[today()] || { done: 0, again: 0 };
    day.done += 1;
    if (kind === "again") day.again += 1;
    log[today()] = day;

    const keep = Object.keys(log).sort().slice(-LOG_DAYS);
    const trimmed = {};
    keep.forEach((d) => { trimmed[d] = log[d]; });
    Store.set(KEY_LOG, trimmed);
  }

  const addDays = (iso, n) => {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d + n);
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") +
           "-" + String(dt.getDate()).padStart(2, "0");
  };

  /**
   * Сводка для дашборда: по каким коробкам разложены карточки, сколько их придёт
   * в ближайшие дни, как часто ответ не вспоминается и какие карточки залипли.
   * Прогноз показывает, сколько карточек созреет, — дневные лимиты могут растянуть
   * этот объём на несколько дней.
   */
  function stats(cards, srs, log) {
    const t = today();
    const seen = cards.filter((c) => srs[c.id]);

    const boxes = INTERVALS.map((_, i) => ({
      box: i,
      days: INTERVALS[i],
      count: seen.filter((c) => (srs[c.id].box || 0) === i).length
    }));

    const forecast = [];
    for (let i = 0; i < FORECAST_DAYS; i++) {
      const date = addDays(t, i);
      // всё просроченное сваливается на сегодня — оно уже ждёт
      const count = seen.filter((c) => (i === 0 ? srs[c.id].due <= date : srs[c.id].due === date)).length;
      forecast.push({ date: date, count: count });
    }

    const days = Object.keys(log || {}).sort().slice(-RATE_DAYS);
    let done = 0, again = 0;
    days.forEach((d) => { done += log[d].done || 0; again += log[d].again || 0; });

    // Залипание — не приговор: карточка выходит из списка, когда после последнего
    // провала подряд идут LEECH_CLEAR успехов. Они всегда на разных днях, потому что
    // успех переводит карточку минимум в коробку 1.
    const leeches = seen
      .filter((c) => (srs[c.id].lapses || 0) >= LEECH && (srs[c.id].streak || 0) < LEECH_CLEAR)
      .map((c) => ({
        card: c, lapses: srs[c.id].lapses,
        box: srs[c.id].box || 0, streak: srs[c.id].streak || 0
      }))
      .sort((a, b) => b.lapses - a.lapses);

    return {
      boxes: boxes,
      fresh: cards.length - seen.length,
      forecast: forecast,
      rate: { days: days.length, done: done, again: again, share: done ? again / done : null },
      leeches: leeches
    };
  }

  return {
    INTERVALS, DEFAULTS, KEY, KEY_AUTO, KEY_LOG, LEECH, LEECH_CLEAR, RATE_DAYS,
    today, nextDue, settingsFrom, dailyFrom, plan,
    autoCards, deck, noteMisses,
    applyGrade, logGrade, stats
  };
})();

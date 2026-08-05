/**
 * Политика интервальных повторений. Общая для страницы карточек и дашборда,
 * чтобы «сколько сегодня» считалось в одном месте.
 */
window.SRS = (function () {
  // Интервалы в днях по коробкам. Ошибка возвращает карточку в коробку 0.
  const INTERVALS = [0, 1, 3, 7, 16, 35];

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

  return { INTERVALS, DEFAULTS, today, nextDue, settingsFrom, dailyFrom, plan };
})();

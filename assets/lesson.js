/**
 * Движок вопросов для уроков.
 * В уроке: <div id="quiz"></div> и вызов initQuiz("lesson-id", [ {t, o, a, e, code?}, ... ])
 *   t — текст вопроса, o — варианты, a — индекс верного, e — объяснение, code — моноширинный вопрос.
 * Ответы и факт прохождения хранятся в localStorage.
 *
 * Что пишется в хранилище по ключу "lesson:<id>":
 *   a<i>, u<i>  — ответ на вопрос и отметка «не уверена, угадала»
 *   lastScore   — результат последней проверки, unsure — сколько верных ответов угадано
 *   attempts    — история попыток: дата, результат и номера провалов каждой сдачи
 *
 * Угаданный правильный ответ тему не закрывает (см. Lessons.isDone), а провал и
 * угаданное уходят карточками в повторение — через SRS.noteMisses.
 *
 * Если в реестре (assets/lessons.js) у урока задан needs, а предыдущий урок темы ещё
 * не закрыт, страница не открывается: разбор скрывается, вместо вопросов — ссылка туда,
 * откуда нужно начать. Для этого разметку урока заворачивают в <div id="lesson-body">.
 */
function initQuiz(lessonId, questions) {
  // Store сначала поднимает состояние: с сервера, если он запущен, иначе из localStorage
  Store.ready().then(() => {
    const locked = window.Lessons ? Lessons.lockOf(lessonId) : null;
    if (locked) lockLesson(locked);
    else startQuiz(lessonId, questions);
  });
}

/** Путь к корню проекта берём из крошки — она есть на каждой странице. */
function pageRoot() {
  const home = document.querySelector(".crumb a.home");
  const href = home ? home.getAttribute("href") : "";
  return href.replace(/index\.html$/, "");
}

/** Урок ещё закрыт: прячем разбор и вопросы, объясняем, что пройти раньше. */
function lockLesson(prev) {
  const body = document.getElementById("lesson-body");
  if (body) body.classList.add("hidden");
  const head = document.querySelector(".quiz-head");
  if (head) head.classList.add("hidden");

  const box = document.createElement("div");
  box.className = "note err";
  box.append(Object.assign(document.createElement("b"), { textContent: "Урок пока закрыт." }));
  box.append(document.createTextNode(
    " Он продолжает предыдущий и без него читается вхолостую. Откроется, когда «" +
    prev.title + "» будет пройден на максимум — " + prev.total + " из " + prev.total + "."));
  box.append(document.createElement("br"));

  const a = document.createElement("a");
  a.href = pageRoot() + prev.href;
  a.textContent = "Начать с урока «" + prev.title + "» →";
  box.append(a);

  document.getElementById("quiz").append(box);
}

/** Локальная дата в виде 2026-08-12 — тот же формат, что у карточек и календаря. */
function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
         "-" + String(d.getDate()).padStart(2, "0");
}

function plural(n, one, few, many) {
  const t = n % 10, h = n % 100;
  if (t === 1 && h !== 11) return one;
  if (t >= 2 && t <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

function startQuiz(lessonId, questions) {
  const KEY = "lesson:" + lessonId;
  const root = document.getElementById("quiz");
  let state = Store.get(KEY) || {};
  let checked = false;
  let focus = null;              // номера вопросов в работе над ошибками; null — весь урок

  const note = document.createElement("div");
  note.className = "note hidden";
  note.append(Object.assign(document.createElement("b"), { textContent: "Работа над ошибками." }));
  note.append(document.createTextNode(
    " Здесь только вопросы, где был промах или отметка «угадала», — их ответы сброшены. " +
    "Остальные сохранены: результат всё равно считается по всему уроку."));

  const list = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "actions";
  const checkBtn = document.createElement("button");
  const missBtn = document.createElement("button");
  missBtn.className = "hidden";
  missBtn.textContent = "Работа над ошибками";
  const resetBtn = document.createElement("button");
  resetBtn.className = "ghost";
  resetBtn.textContent = "Сбросить";
  const scoreEl = document.createElement("span");
  scoreEl.className = "quiz-score";
  actions.append(checkBtn, missBtn, resetBtn, scoreEl);
  root.append(note, list, actions);

  function save() { Store.set(KEY, state); }

  const all = () => questions.map((_, i) => i);
  const shown = () => focus || all();
  const isRight = (i) => state["a" + i] === questions[i].a;
  const isGuessed = (i) => isRight(i) && !!state["u" + i];

  /** Что не усвоено: провалы и угаданное. Отсюда берутся и карточки, и работа над ошибками. */
  const misses = () => all().filter((i) => !isRight(i) || state["u" + i]);

  function answered() {
    return shown().filter((i) => state["a" + i] !== undefined).length;
  }

  function refreshButtons() {
    const n = answered(), need = shown().length;
    checkBtn.textContent = checked ? "Пройти заново" : "Проверить";
    checkBtn.disabled = !checked && n < need;
    missBtn.classList.toggle("hidden", !checked || !misses().length);
    if (!checked) {
      scoreEl.innerHTML = "";
      scoreEl.append(Object.assign(document.createElement("span"), {
        className: "muted", textContent: "отвечено " + n + " из " + need
      }));
    }
  }

  function render() {
    list.textContent = "";
    note.classList.toggle("hidden", !focus);

    shown().forEach((i) => {
      const q = questions[i];
      const card = document.createElement("div");
      card.className = "q";

      const head = document.createElement("div");
      head.className = "q-head";
      const num = document.createElement("span");
      num.className = "q-num";
      num.textContent = (i + 1) + ".";
      const txt = document.createElement("span");
      txt.className = "q-text" + (q.code ? " code" : "");
      txt.textContent = q.t;
      head.append(num, txt);
      card.append(head);

      q.o.forEach((opt, j) => {
        const lab = document.createElement("label");
        lab.className = "opt";
        const inp = document.createElement("input");
        inp.type = "radio";
        inp.name = lessonId + "-q" + i;
        inp.checked = state["a" + i] === j;
        inp.disabled = checked;
        inp.addEventListener("change", () => { state["a" + i] = j; save(); refreshButtons(); });
        const span = document.createElement("span");
        span.textContent = opt;
        lab.append(inp, span);
        card.append(lab);
      });

      // отметка «угадала»: верный ответ без опоры — такой же пробел, как ошибка
      const unsure = document.createElement("label");
      unsure.className = "unsure";
      const ub = document.createElement("input");
      ub.type = "checkbox";
      ub.checked = !!state["u" + i];
      ub.disabled = checked;
      ub.addEventListener("change", () => { state["u" + i] = ub.checked; save(); });
      unsure.append(ub, Object.assign(document.createElement("span"), {
        textContent: "не уверена, угадала"
      }));
      card.append(unsure);

      if (checked) {
        const ok = isRight(i), guessed = isGuessed(i);
        card.classList.add(ok ? (guessed ? "guessed" : "right") : "wrong");
        const v = document.createElement("div");
        v.className = "verdict " + (ok ? (guessed ? "meh" : "ok") : "no");
        v.textContent = !ok ? "Неверно. Правильный ответ: " + q.o[q.a]
                       : guessed ? "Верно, но угадано — вопрос вернётся карточкой"
                                 : "Верно";
        card.append(v);
        if (q.e) {
          const e = document.createElement("div");
          e.className = "exp";
          e.textContent = q.e;
          card.append(e);
        }
      }

      list.append(card);
    });
    refreshButtons();
  }

  /**
   * История попыток. Без неё пересдача затирала бы предыдущую, и не видно ни того,
   * что было провалено в первый раз, ни сколько заходов ушло на максимум.
   */
  function recordAttempt(score) {
    const attempt = {
      date: todayIso(),
      score: score,
      total: questions.length,
      wrong: all().filter((i) => !isRight(i)),
      unsure: all().filter(isGuessed)
    };
    const log = Array.isArray(state.attempts) ? state.attempts.slice() : [];
    const last = log[log.length - 1];
    const same = last && last.date === attempt.date && last.score === attempt.score &&
                 String(last.wrong) === String(attempt.wrong) &&
                 String(last.unsure) === String(attempt.unsure);
    if (!same) log.push(attempt);
    state.attempts = log.slice(-20);
  }

  /** Промахи и угаданное уходят карточками в повторение — каждый вопрос своей. */
  function makeCards() {
    if (!window.SRS || !SRS.noteMisses) return;
    SRS.noteMisses(misses().map((i) => {
      const q = questions[i];
      return {
        id: "auto:" + lessonId + ":q" + i,
        lesson: lessonId,
        front: q.t,
        back: q.o[q.a] + (q.e ? "\n\n" + q.e : ""),
        code: !!q.code,
        src: isRight(i) ? "unsure" : "wrong"
      };
    }));
  }

  function showScore(score, guessed) {
    scoreEl.textContent = score + " из " + questions.length;
    const tail = document.createElement("span");
    if (score === questions.length && !guessed) {
      tail.className = "done-badge";
      tail.textContent = "  ✓ тема закрыта";
    } else if (score === questions.length) {
      tail.className = "muted";
      tail.textContent = "  — но " + guessed + " " +
        plural(guessed, "ответ угадан", "ответа угаданы", "ответов угаданы") +
        ", тема не закрыта";
    } else {
      tail.className = "muted";
      tail.textContent = "  — перечитай разделы по ошибкам и пройди заново";
    }
    scoreEl.append(tail);
  }

  function check() {
    checked = true;
    focus = null;                       // после проверки показываем урок целиком
    const score = all().filter(isRight).length;
    const guessed = all().filter(isGuessed).length;
    state.lastScore = score;
    state.unsure = guessed;
    state.completed = true;
    state.date = todayIso();
    recordAttempt(score);
    save();
    makeCards();
    render();
    showScore(score, guessed);
    actions.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  checkBtn.addEventListener("click", () => {
    if (checked) {
      checked = false;
      render();
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      check();
    }
  });

  missBtn.addEventListener("click", () => {
    focus = misses();
    focus.forEach((i) => { delete state["a" + i]; delete state["u" + i]; });
    checked = false;
    save();
    render();
    list.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  resetBtn.addEventListener("click", () => {
    // история попыток переживает сброс: она про урок, а не про текущий заход
    state = { attempts: state.attempts || [] };
    checked = false;
    focus = null;
    save();
    render();
  });

  render();
}

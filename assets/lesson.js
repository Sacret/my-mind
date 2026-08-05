/**
 * Движок вопросов для уроков.
 * В уроке: <div id="quiz"></div> и вызов initQuiz("lesson-id", [ {t, o, a, e, code?}, ... ])
 *   t — текст вопроса, o — варианты, a — индекс верного, e — объяснение, code — моноширинный вопрос.
 * Ответы и факт прохождения хранятся в localStorage.
 */
function initQuiz(lessonId, questions) {
  // Store сначала поднимает состояние: с сервера, если он запущен, иначе из localStorage
  Store.ready().then(() => startQuiz(lessonId, questions));
}

function startQuiz(lessonId, questions) {
  const KEY = "lesson:" + lessonId;
  const root = document.getElementById("quiz");
  let state = Store.get(KEY) || {};
  let checked = false;

  const list = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "actions";
  const checkBtn = document.createElement("button");
  const resetBtn = document.createElement("button");
  resetBtn.className = "ghost";
  resetBtn.textContent = "Сбросить";
  const scoreEl = document.createElement("span");
  scoreEl.className = "quiz-score";
  actions.append(checkBtn, resetBtn, scoreEl);
  root.append(list, actions);

  function save() { Store.set(KEY, state); }

  function answered() {
    return questions.filter((_, i) => state["a" + i] !== undefined).length;
  }

  function refreshButtons() {
    const n = answered();
    checkBtn.textContent = checked ? "Пройти заново" : "Проверить";
    checkBtn.disabled = !checked && n < questions.length;
    if (!checked) {
      scoreEl.innerHTML = "";
      scoreEl.append(Object.assign(document.createElement("span"), {
        className: "muted", textContent: "отвечено " + n + " из " + questions.length
      }));
    }
  }

  function render() {
    list.textContent = "";
    questions.forEach((q, i) => {
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

      if (checked) {
        const ok = state["a" + i] === q.a;
        card.classList.add(ok ? "right" : "wrong");
        const v = document.createElement("div");
        v.className = "verdict " + (ok ? "ok" : "no");
        v.textContent = ok ? "Верно" : "Неверно. Правильный ответ: " + q.o[q.a];
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

  function check() {
    checked = true;
    const score = questions.filter((q, i) => state["a" + i] === q.a).length;
    state.lastScore = score;
    state.completed = true;
    state.date = new Date().toISOString().slice(0, 10);
    save();
    render();
    scoreEl.textContent = score + " из " + questions.length;
    if (score === questions.length) {
      const b = document.createElement("span");
      b.className = "done-badge";
      b.textContent = "  ✓ тема закрыта";
      scoreEl.append(b);
    } else {
      const b = document.createElement("span");
      b.className = "muted";
      b.textContent = "  — перечитай разделы по ошибкам и пройди заново";
      scoreEl.append(b);
    }
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

  resetBtn.addEventListener("click", () => {
    state = {};
    checked = false;
    save();
    render();
  });

  render();
}

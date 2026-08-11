/**
 * Реестр уроков — один список на весь проект: оглавление, карточки, сами страницы уроков.
 *
 *   id     — ключ в хранилище, полный ключ выглядит как "lesson:" + id
 *   short  — короткое имя для тега на карточке повторения
 *   total  — сколько в уроке вопросов; закрытым урок считается только при полном ответе
 *   needs  — id урока, который нужно закрыть раньше. Пока он не закрыт, этот заблокирован:
 *            в оглавлении строка не кликается, а сама страница прячет разбор и вопросы.
 *
 * Порядок в списке — порядок в оглавлении и в подсказке «следующий шаг»,
 * поэтому продолжение темы ставится сразу за своим первым уроком.
 */
window.LESSONS = [
  { track: "general", id: "general-logic-syllogisms",  title: "Кванторы и силлогизмы", short: "Кванторы и силлогизмы",
    sub: "закрывает вопрос #48 теста", href: "general/logic/lesson-01-syllogisms.html", total: 8 },
  { track: "general", id: "general-logic-word-problems", title: "Задачи в словах: перевод в уравнения", short: "Задачи в словах",
    sub: "закрывает вопрос #50 теста", href: "general/logic/lesson-02-word-problems.html", total: 8 },
  { track: "general", id: "general-math-probability",  title: "Вероятность и приём «хотя бы один»", short: "Вероятность",
    sub: "закрывает вопрос #5 теста", href: "general/math/lesson-01-probability.html", total: 7 },
  { track: "general", id: "general-math-quadratic",    title: "Квадратные уравнения и знаки корней", short: "Квадратные уравнения",
    sub: "закрывает вопрос #7 теста", href: "general/math/lesson-02-quadratic.html", total: 8 },
  { track: "general", id: "general-stats-averages",   title: "Среднее, медиана и обман выборки", short: "Статистика",
    sub: "новая область: статистика", href: "general/statistics/lesson-01-averages.html", total: 8 },
  { track: "general", id: "general-chem-everyday",    title: "Химия вокруг: почему мыло моет", short: "Химия вокруг",
    sub: "новая область: химия", href: "general/chemistry/lesson-01-everyday.html", total: 8 },
  { track: "general", id: "general-music-basics",     title: "Музыка изнутри: из чего она сделана", short: "Музыка",
    sub: "новая область: музыка", href: "general/music/lesson-01-how-music-works.html", total: 8 },
  { track: "general", id: "general-cinema-language",  title: "Кино как язык: монтаж, кадр, свет", short: "Кино как язык",
    sub: "новая область: кино", href: "general/cinema/lesson-01-film-language.html", total: 8 },
  { track: "general", id: "general-finance-basics",   title: "Сложный процент, риск и инфляция", short: "Финансы",
    sub: "новая область: финансы", href: "general/finance/lesson-01-money-basics.html", total: 8 },
  { track: "general", id: "general-brain-memory",     title: "Память, сон и внимание", short: "Память и сон",
    sub: "новая область: мозг", href: "general/brain/lesson-01-memory-sleep.html", total: 8 },
  { track: "general", id: "general-anatomy-body",     title: "Как устроено тело", short: "Как устроено тело",
    sub: "новая область: анатомия", href: "general/anatomy/lesson-01-body.html", total: 8 },
  { track: "general", id: "general-bio-evolution",    title: "Эволюция как алгоритм", short: "Эволюция",
    sub: "закрывает вопрос #15 теста", href: "general/biology/lesson-01-evolution.html", total: 8 },
  { track: "general", id: "general-astro-scale",      title: "Астрономия: масштабы и ближайшие соседи", short: "Астрономия",
    sub: "закрывает вопрос #10 теста", href: "general/astronomy/lesson-01-scale.html", total: 8 },
  { track: "general", id: "general-religion-history", title: "Как возникали и расходились религии", short: "История религий",
    sub: "новая область: история религий", href: "general/religion/lesson-01-history.html", total: 8 },
  { track: "general", id: "general-russian-commas",    title: "Запятая: где она обязательна, а где лишняя", short: "Запятая",
    sub: "новая область: русский язык", href: "general/russian/lesson-01-commas.html", total: 8 },
  { track: "general", id: "general-english-present-perfect", title: "Present Perfect против Past Simple", short: "Present Perfect",
    sub: "закрывает пробел из очереди README", href: "general/english/lesson-01-present-perfect.html", total: 8 },
  { track: "general", id: "general-photo-greatest",    title: "Величайшие фотографии: как кадр становится документом", short: "Величайшие фотографии",
    sub: "новая область: фотография", href: "general/photography/lesson-01-great-photographs.html", total: 8 },
  { track: "work",    id: "work-fundamentals-big-o",   title: "Сложность алгоритмов: O-нотация", short: "O-нотация",
    sub: "закрывает вопросы #1, #3, #5, #12 теста", href: "work/fundamentals/lesson-01-big-o.html", total: 8 },
  { track: "work",    id: "work-fundamentals-data-structures", title: "Структуры данных: что выбрать под задачу", short: "Структуры данных",
    sub: "закрывает вопросы #2, #6 теста", href: "work/fundamentals/lesson-02-data-structures.html", total: 8 },
  { track: "work",    id: "work-js-event-loop",        title: "Event loop: микрозадачи и макрозадачи", short: "Event loop",
    sub: "закрывает вопрос #16 теста", href: "work/javascript/lesson-01-event-loop.html", total: 7 },
  { track: "work",    id: "work-js-arrays-mutation",   title: "Мутации, ссылки и иммутабельность", short: "Мутации и иммутабельность",
    sub: "закрывает вопросы #20, #40 теста", href: "work/javascript/lesson-02-arrays-mutation.html", total: 8 },
  { track: "work",    id: "work-js-types-coercion",    title: "Типы, приведение и тихие потери данных", short: "Типы и приведение",
    sub: "закрывает вопросы #13, #21, #27 теста", href: "work/javascript/lesson-03-types-coercion.html", total: 8 },
  { track: "work",    id: "work-web-http-rest",        title: "HTTP и REST: методы, коды, CORS", short: "HTTP и REST",
    sub: "закрывает вопросы #4, #10 теста", href: "work/web/lesson-01-http-rest.html", total: 8 },
  { track: "work",    id: "work-css-layout-specificity", title: "Оси флексбокса и специфичность", short: "Флексбокс и специфичность",
    sub: "закрывает вопросы #28, #29 теста", href: "work/css/lesson-01-flexbox-specificity.html", total: 8 },
  { track: "work",    id: "work-react-state-context",  title: "React: состояние, поднятие и Context", short: "React: состояние",
    sub: "закрывает вопрос #47 теста", href: "work/react/lesson-01-state-context.html", total: 8 },
  { track: "work",    id: "work-react-effects-memo",   title: "React: эффекты, зависимости и мемоизация", short: "React: эффекты",
    sub: "продолжение первого урока по React", href: "work/react/lesson-02-effects-memo.html", total: 8,
    needs: "work-react-state-context" },
  { track: "work",    id: "work-history-programming",  title: "Откуда взялись абстракции", short: "История программирования",
    sub: "новая область: история отрасли", href: "work/history/lesson-01-programming.html", total: 8 }
];

window.Lessons = (function () {
  const byId = new Map(LESSONS.map((l) => [l.id, l]));

  /**
   * Урок закрыт = пройден на максимум. Планка одна и та же везде:
   * и для галочки в оглавлении, и для открытия следующего урока темы.
   */
  function isDone(id) {
    const l = byId.get(id);
    const st = window.Store ? Store.get("lesson:" + id) : null;
    return !!(l && st && st.completed && st.lastScore === l.total);
  }

  /** Урок, который надо закрыть раньше этого, — если он ещё не закрыт. Иначе null. */
  function lockOf(id) {
    const l = byId.get(id);
    if (!l || !l.needs) return null;
    return isDone(l.needs) ? null : byId.get(l.needs) || null;
  }

  return {
    all: LESSONS,
    get: (id) => byId.get(id) || null,
    title: (id) => (byId.get(id) ? byId.get(id).short : id),
    isDone,
    lockOf
  };
})();

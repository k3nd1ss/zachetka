"use strict";

/* ===== 1. Постоянные значения ===== */

// Ключ, под которым данные лежат в localStorage
const STORAGE_KEY = "student-diary-data";

// Внутри данных хранится короткий код, а на экране показывается русский текст
const CONTROL_LABELS = { credit: "Зачёт", diffCredit: "Дифзачёт", exam: "Экзамен" };
const RESULT_LABELS = { none: "Не сдавал", passed: "Сдал", failed: "Провалил" };
const WORK_TYPE_LABELS = { lab: "Лабораторная", rgr: "РГР", other: "Другое" };
const WORK_STATUS_LABELS = {
  todo: "Не сделана",
  done: "Сделана, не сдана",
  rejected: "Пробовал сдать — не приняли",
  submitted: "Сдана",
};

/* ===== 2. Состояние приложения ===== */

let currentTab = "subjects"; // открытая вкладка
let closedBlockOpen = false; // развёрнут ли блок «Закрытые предметы»
let workFilter = { status: "all", type: "all" }; // выбранный фильтр работ
let data = loadData(); // все данные пользователя

/* ===== 3. Сохранение и загрузка ===== */

function createEmptyData() {
  return { currentSemester: null, subjects: [] };
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Читает данные из localStorage. При любой проблеме возвращает пустые данные
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      return createEmptyData();
    }
    const parsed = JSON.parse(saved);
    if (isValidData(parsed)) {
      return normalizeData(parsed);
    }
    showStorageWarning("Сохранённые данные повреждены. Приложение запущено с пустыми данными.");
  } catch (error) {
    showStorageWarning("Не удалось прочитать данные. Приложение запущено с пустыми данными.");
  }
  return createEmptyData();
}

// Записывает данные в localStorage как текст в формате JSON
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showStorageWarning("Браузер не дал сохранить данные. После перезагрузки изменения пропадут.");
  }
}

function showStorageWarning(text) {
  const warning = document.getElementById("storage-warning");
  warning.textContent = text;
  warning.hidden = false;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

// Минимальная проверка формы данных: это объект со списком предметов
function isValidData(value) {
  return isObject(value) && Array.isArray(value.subjects);
}

// Если значения нет в списке допустимых, берём значение по умолчанию
function pickAllowed(value, labels, fallback) {
  return Object.keys(labels).includes(value) ? value : fallback;
}

function toText(value) {
  return typeof value === "string" ? value : "";
}

// Возвращает целое число от 1 и больше либо null
function toSemester(value) {
  const number = Number(value);
  return value !== "" && value !== null && Number.isInteger(number) && number >= 1 ? number : null;
}

// Приводит данные к правильному виду, чтобы испорченное поле не сломало приложение.
// id выдаём заново: так они гарантированно не повторяются
function normalizeData(raw) {
  return {
    currentSemester: toSemester(raw.currentSemester),
    subjects: raw.subjects.filter(isObject).map(normalizeSubject),
  };
}

function normalizeSubject(raw) {
  const works = Array.isArray(raw.works) ? raw.works : [];
  return {
    id: createId(),
    name: toText(raw.name).trim() || "Без названия",
    teacher: toText(raw.teacher),
    semester: toSemester(raw.semester) || 1,
    control: pickAllowed(raw.control, CONTROL_LABELS, "credit"),
    result: pickAllowed(raw.result, RESULT_LABELS, "none"),
    works: works.filter(isObject).map(normalizeWork),
  };
}

function normalizeWork(raw) {
  return {
    id: createId(),
    type: pickAllowed(raw.type, WORK_TYPE_LABELS, "other"),
    title: toText(raw.title).trim() || "Без названия",
    status: pickAllowed(raw.status, WORK_STATUS_LABELS, "todo"),
    note: toText(raw.note),
  };
}

/* ===== 4. К какой группе относится предмет ===== */

function isPastSemester(subject) {
  return data.currentSemester !== null && subject.semester < data.currentSemester;
}

// Долг: семестр уже прошёл, а итог не «сдал»
function isDebt(subject) {
  return isPastSemester(subject) && subject.result !== "passed";
}

// Закрытый предмет: семестр прошёл, итог «сдал»
function isClosed(subject) {
  return isPastSemester(subject) && subject.result === "passed";
}

// Всё остальное показывается во вкладке «Предметы»
function isActive(subject) {
  return !isPastSemester(subject);
}

// Сколько работ предмета уже сдано
function countSubmitted(subject) {
  return subject.works.filter((work) => work.status === "submitted").length;
}

function getUnsubmittedWorks(subject) {
  return subject.works.filter((work) => work.status !== "submitted");
}

function matchesFilter(work) {
  const statusFits = workFilter.status === "all" || work.status === workFilter.status;
  const typeFits = workFilter.type === "all" || work.type === workFilter.type;
  return statusFits && typeFits;
}

/* ===== 5. Помощники для создания элементов DOM ===== */

// textContent вставляет текст как текст, поэтому чужой HTML из данных не выполнится
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createButton(text, className, onClick) {
  const button = createElement("button", "button " + className, text);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function createInput(name, type, value) {
  const input = createElement("input", "input");
  input.name = name;
  input.type = type;
  input.value = value;
  return input;
}

function createNumberInput(name, value) {
  const input = createInput(name, "number", value);
  input.min = "1";
  input.step = "1";
  input.inputMode = "numeric";
  return input;
}

// Создаёт выпадающий список из объекта вида { код: "Текст" }
function createSelect(name, labels, value) {
  const select = createElement("select", "input");
  select.name = name;
  for (const code of Object.keys(labels)) {
    select.append(new Option(labels[code], code));
  }
  select.value = value;
  return select;
}

function createField(labelText, control) {
  const field = createElement("label", "field", labelText);
  field.append(control);
  return field;
}

/* ===== 6. Модальные окна ===== */

const modal = document.getElementById("modal");

function openModal(title, ...children) {
  modal.replaceChildren(createElement("h2", "modal-title", title), ...children);
  if (!modal.open) {
    modal.showModal();
  }
}

function closeModal() {
  modal.close();
}

// Собственное окно подтверждения вместо стандартного confirm()
function openConfirm(title, text, confirmLabel, onConfirm) {
  const actions = createElement("div", "form-actions");
  actions.append(
    createButton("Отмена", "", closeModal),
    createButton(confirmLabel, "button-danger", () => {
      closeModal();
      onConfirm();
    })
  );
  openModal(title, createElement("p", "modal-text", text), actions);
}

function openInfo(title, text) {
  const actions = createElement("div", "form-actions");
  actions.append(createButton("Понятно", "button-primary", closeModal));
  openModal(title, createElement("p", "modal-text", text), actions);
}

// Нижняя часть любой формы: «Отмена» и кнопка отправки
function createFormActions(submitLabel) {
  const actions = createElement("div", "form-actions");
  const submit = createElement("button", "button button-primary", submitLabel);
  submit.type = "submit";
  actions.append(createButton("Отмена", "", closeModal), submit);
  return actions;
}

/* ===== 7. Форма предмета и долга ===== */

function getDefaultSemester(forDebt) {
  if (forDebt) {
    return data.currentSemester - 1;
  }
  return data.currentSemester === null ? 1 : data.currentSemester;
}

function createBlankSubject(forDebt) {
  return {
    name: "",
    teacher: "",
    semester: getDefaultSemester(forDebt),
    control: "credit",
    result: "none",
  };
}

function canAddDebt() {
  return data.currentSemester !== null && data.currentSemester > 1;
}

function openNewSubjectForm() {
  openSubjectForm(null, false);
}

function openNewDebtForm() {
  if (canAddDebt()) {
    openSubjectForm(null, true);
    return;
  }
  openInfo(
    "Долг пока нельзя добавить",
    "Долг — это предмет прошлого семестра. Укажи в настройках текущий семестр больше 1."
  );
}

// subject = null означает, что создаётся новый предмет
function openSubjectForm(subject, forDebt) {
  const values = subject || createBlankSubject(forDebt);
  const form = createElement("form", "form");
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");

  const nameInput = createInput("name", "text", values.name);
  nameInput.required = true;
  const semesterInput = createNumberInput("semester", values.semester);
  semesterInput.required = true;

  form.append(
    createField("Название", nameInput),
    createField("Преподаватель", createInput("teacher", "text", values.teacher)),
    createField("Номер семестра", semesterInput),
    createField("Форма контроля", createSelect("control", CONTROL_LABELS, values.control)),
    createField("Итог по предмету", createSelect("result", RESULT_LABELS, values.result)),
    error,
    createFormActions("Сохранить")
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSubjectForm(form, error, subject, forDebt);
  });

  openModal(getSubjectFormTitle(subject, forDebt), form);
}

function getSubjectFormTitle(subject, forDebt) {
  if (subject) {
    return "Изменить предмет";
  }
  return forDebt ? "Новый долг" : "Новый предмет";
}

// Возвращает текст ошибки либо пустую строку, если всё правильно
function validateSubject(values, mustBePast) {
  if (values.name === "") {
    return "Укажи название предмета.";
  }
  if (values.semester === null) {
    return "Номер семестра должен быть целым числом от 1.";
  }
  if (mustBePast && values.semester >= data.currentSemester) {
    return "Семестр долга должен быть меньше текущего (" + data.currentSemester + ").";
  }
  return "";
}

function submitSubjectForm(form, error, subject, forDebt) {
  const fields = new FormData(form);
  const values = {
    name: fields.get("name").trim(),
    teacher: fields.get("teacher").trim(),
    semester: toSemester(fields.get("semester")),
    control: fields.get("control"),
    result: fields.get("result"),
  };

  error.textContent = validateSubject(values, forDebt && subject === null);
  if (error.textContent !== "") {
    return;
  }

  if (subject) {
    Object.assign(subject, values);
  } else {
    data.subjects.push({ id: createId(), ...values, works: [] });
  }
  updateAndClose();
}

function confirmDeleteSubject(subject) {
  openConfirm(
    "Удалить предмет?",
    "«" + subject.name + "» будет удалён вместе со всеми работами.",
    "Удалить",
    () => {
      data.subjects = data.subjects.filter((item) => item !== subject);
      updateData();
    }
  );
}

/* ===== 8. Форма работы ===== */

// work = null означает, что создаётся новая работа
function openWorkForm(subject, work) {
  const values = work || { type: "lab", title: "", status: "todo", note: "" };
  const form = createElement("form", "form");
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");

  const titleInput = createInput("title", "text", values.title);
  titleInput.required = true;
  const noteInput = createElement("textarea", "input");
  noteInput.name = "note";
  noteInput.value = values.note;

  form.append(
    createField("Тип работы", createSelect("type", WORK_TYPE_LABELS, values.type)),
    createField("Название или номер", titleInput),
    createField("Статус", createSelect("status", WORK_STATUS_LABELS, values.status)),
    createField("Заметка (необязательно)", noteInput),
    error,
    createFormActions("Сохранить")
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitWorkForm(form, error, subject, work);
  });

  openModal(work ? "Изменить работу" : "Новая работа", form);
}

function submitWorkForm(form, error, subject, work) {
  const fields = new FormData(form);
  const values = {
    type: fields.get("type"),
    title: fields.get("title").trim(),
    status: fields.get("status"),
    note: fields.get("note").trim(),
  };

  if (values.title === "") {
    error.textContent = "Укажи название или номер работы.";
    return;
  }

  if (work) {
    Object.assign(work, values);
  } else {
    subject.works.push({ id: createId(), ...values });
  }
  updateAndClose();
}

function confirmDeleteWork(subject, work) {
  openConfirm("Удалить работу?", "«" + work.title + "» будет удалена.", "Удалить", () => {
    subject.works = subject.works.filter((item) => item !== work);
    updateData();
  });
}

// Смена статуса прямо в строке работы
function changeWorkStatus(work, status) {
  work.status = status;
  updateData();
  // После перерисовки возвращаем фокус на тот же список, если он остался на экране
  const select = document.getElementById("status-" + work.id);
  if (select) {
    select.focus({ preventScroll: true });
  }
}

/* ===== 9. Экспорт и импорт ===== */

// Имя файла с датой, например student-diary-2026-11-05.json
function getExportFileName() {
  return "student-diary-" + new Date().toISOString().slice(0, 10) + ".json";
}

// Экспорт: превращаем данные в текст JSON и отдаём браузеру как файл
function exportData() {
  const text = JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = createElement("a");
  link.href = url;
  link.download = getExportFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Импорт: читаем файл и проверяем его. Текущие данные пока не трогаем
async function importFile(file, error) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (readError) {
    error.textContent = "Не удалось прочитать файл. Нужен JSON-файл, полученный через экспорт.";
    return;
  }
  if (!isValidData(parsed)) {
    error.textContent = "В файле нет данных дневника. Текущие данные не изменились.";
    return;
  }
  confirmImport(parsed);
}

function confirmImport(parsed) {
  openConfirm(
    "Заменить данные?",
    "Импорт заменит все текущие данные. Предметов в файле: " + parsed.subjects.length + ".",
    "Заменить",
    () => {
      data = normalizeData(parsed);
      updateData();
    }
  );
}

function createImportControls(error) {
  const input = createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.hidden = true;
  input.addEventListener("change", () => {
    if (input.files.length > 0) {
      importFile(input.files[0], error);
    }
    input.value = ""; // иначе повторный выбор того же файла не сработает
  });
  return [input, createButton("Импорт из файла", "", () => input.click())];
}

function createBackupSection() {
  const section = createElement("div", "backup");
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");
  const buttons = createElement("div", "action-row");
  buttons.append(createButton("Экспорт в файл", "", exportData), ...createImportControls(error));
  section.append(
    createElement("h3", "backup-title", "Резервная копия"),
    createElement("p", "backup-text", "Данные хранятся только в этом браузере. Файл защитит их от потери и поможет перенести на другое устройство."),
    buttons,
    error
  );
  return section;
}

/* ===== 10. Настройки ===== */

function openSettings() {
  const form = createElement("form", "form");
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");
  const semester = data.currentSemester === null ? "" : data.currentSemester;

  form.append(
    createField("Текущий семестр", createNumberInput("currentSemester", semester)),
    error,
    createFormActions("Сохранить")
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSettings(form, error);
  });

  openModal("Настройки", form, createBackupSection());
}

function submitSettings(form, error) {
  const value = new FormData(form).get("currentSemester");
  const semester = toSemester(value);
  if (value !== "" && semester === null) {
    error.textContent = "Семестр должен быть целым числом от 1.";
    return;
  }
  data.currentSemester = semester;
  updateAndClose();
}

/* ===== 11. Вывод на экран ===== */

// После любого изменения: сохранить данные и перерисовать экран
function updateData() {
  saveData();
  render();
}

function updateAndClose() {
  closeModal();
  updateData();
}

function createSubjectMeta(subject) {
  const parts = [
    subject.semester + " семестр",
    CONTROL_LABELS[subject.control],
    "Итог: " + RESULT_LABELS[subject.result],
  ];
  if (subject.teacher !== "") {
    parts.unshift(subject.teacher);
  }
  return createElement("p", "card-meta", parts.join(" · "));
}

function createProgress(subject) {
  if (subject.works.length === 0) {
    return createElement("p", "progress-text", "Работ пока нет");
  }
  const submitted = countSubmitted(subject);
  const percent = Math.round((submitted / subject.works.length) * 100);
  const wrapper = createElement("div");
  const track = createElement("div", "progress-track");
  const bar = createElement("div", "progress-bar");
  bar.style.width = percent + "%";
  track.append(bar);
  wrapper.append(
    track,
    createElement("p", "progress-text", "Сдано " + submitted + " из " + subject.works.length)
  );
  return wrapper;
}

function createStatusSelect(work) {
  const select = createSelect("status", WORK_STATUS_LABELS, work.status);
  select.id = "status-" + work.id;
  select.classList.add("status-select", "status-" + work.status);
  select.setAttribute("aria-label", "Статус работы «" + work.title + "»");
  select.addEventListener("change", () => changeWorkStatus(work, select.value));
  return select;
}

function createWorkRow(subject, work) {
  const row = createElement("li", "work");
  const heading = createElement("div", "work-heading");
  heading.append(
    createElement("span", "work-title", work.title),
    createElement("span", "work-type", WORK_TYPE_LABELS[work.type])
  );
  row.append(heading, createStatusSelect(work));
  if (work.note !== "") {
    row.append(createElement("p", "work-note", work.note));
  }

  const actions = createElement("div", "action-row");
  actions.append(
    createButton("Изменить", "", () => openWorkForm(subject, work)),
    createButton("Удалить", "button-danger", () => confirmDeleteWork(subject, work))
  );
  row.append(actions);
  return row;
}

// Список работ карточки: works — какие работы показать, emptyText — что написать, если их нет
function createWorkList(subject, works, emptyText) {
  if (works.length === 0) {
    return createElement("p", "work-empty", emptyText);
  }
  const list = createElement("ul", "work-list");
  list.append(...works.map((work) => createWorkRow(subject, work)));
  return list;
}

// Какие работы показать в обычной карточке и что написать, если их нет
function getSubjectWorksView(subject) {
  const emptyText = subject.works.length === 0 ? "" : "Нет работ, подходящих под фильтр.";
  return { works: subject.works.filter(matchesFilter), emptyText: emptyText };
}

// В карточке долга — только несданные работы
function getDebtWorksView(subject) {
  return {
    works: getUnsubmittedWorks(subject),
    emptyText: "Несданных работ нет. Осталось закрыть сам предмет.",
  };
}

function createSubjectCard(subject, getWorksView) {
  const view = getWorksView(subject);
  const card = createElement("article", "card");
  const header = createElement("div");
  header.append(
    createElement("h3", "card-title", subject.name),
    createSubjectMeta(subject)
  );

  const actions = createElement("div", "action-row");
  actions.append(
    createButton("Изменить", "", () => openSubjectForm(subject, false)),
    createButton("Удалить", "button-danger", () => confirmDeleteSubject(subject))
  );

  card.append(header, actions, createProgress(subject));
  if (view.works.length > 0 || view.emptyText !== "") {
    card.append(createWorkList(subject, view.works, view.emptyText));
  }
  card.append(
    createButton("+ Добавить работу", "button-wide", () => openWorkForm(subject, null))
  );
  return card;
}

function createCardList(subjects, getWorksView) {
  const list = createElement("div", "card-list");
  list.append(...subjects.map((subject) => createSubjectCard(subject, getWorksView)));
  return list;
}

// Фильтр работ: варианты списка — «Все» плюс все статусы или типы
function createFilterSelect(labelText, filterKey, labels) {
  const select = createSelect(filterKey, { all: "Все", ...labels }, workFilter[filterKey]);
  select.addEventListener("change", () => {
    workFilter[filterKey] = select.value;
    render();
  });
  return createField(labelText, select);
}

function createWorkFilter() {
  const filter = createElement("div", "filter");
  filter.append(
    createFilterSelect("Статус работ", "status", WORK_STATUS_LABELS),
    createFilterSelect("Тип работ", "type", WORK_TYPE_LABELS)
  );
  return filter;
}

// Подсказка первого запуска: показывает только то, что ещё не сделано
function createFirstRunHint() {
  const hasNoSubjects = data.subjects.length === 0;
  const hasNoSemester = data.currentSemester === null;
  if (!hasNoSubjects && !hasNoSemester) {
    return null;
  }
  const hint = createElement("section", "hint");
  hint.append(createElement("h2", "hint-title", "С чего начать"));
  const list = createElement("ul", "hint-list");
  if (hasNoSubjects) {
    list.append(createElement("li", "", "Добавь первый предмет"));
  }
  if (hasNoSemester) {
    list.append(createElement("li", "", "Укажи текущий семестр"));
  }
  hint.append(list);
  if (hasNoSemester) {
    hint.append(createButton("Указать семестр", "", openSettings));
  }
  return hint;
}

// Сворачиваемый блок для сданных предметов прошлых семестров
function createClosedBlock(subjects) {
  const block = createElement("details", "closed-block");
  block.open = closedBlockOpen;
  block.addEventListener("toggle", () => {
    closedBlockOpen = block.open;
  });
  block.append(
    createElement("summary", "closed-summary", "Закрытые предметы (" + subjects.length + ")"),
    createCardList(subjects, getSubjectWorksView)
  );
  return block;
}

function renderSubjectsTab() {
  const active = data.subjects.filter(isActive);
  const closed = data.subjects.filter(isClosed);
  const nodes = [createButton("+ Добавить предмет", "button-primary button-wide", openNewSubjectForm)];
  const hint = createFirstRunHint();

  if (hint) {
    nodes.unshift(hint);
  }
  if (data.subjects.length > 0) {
    nodes.push(createWorkFilter());
  }
  if (active.length > 0) {
    nodes.push(createCardList(active, getSubjectWorksView));
  } else if (data.subjects.length > 0) {
    nodes.push(createElement("p", "empty-message", "В текущем семестре предметов пока нет."));
  }
  if (closed.length > 0) {
    nodes.push(createClosedBlock(closed));
  }
  return nodes;
}

function renderDebtsTab() {
  const nodes = [createButton("+ Добавить долг", "button-primary button-wide", openNewDebtForm)];
  const debts = data.subjects.filter(isDebt);

  if (data.currentSemester === null) {
    nodes.push(createElement("p", "empty-message", "Укажи текущий семестр в настройках, и здесь появятся долги."));
  } else if (debts.length === 0) {
    nodes.push(createElement("p", "empty-message", "Долгов нет. Все прошлые семестры закрыты."));
  } else {
    nodes.push(createCardList(debts, getDebtWorksView));
  }
  return nodes;
}

function renderTabs() {
  const debtCount = data.subjects.filter(isDebt).length;
  for (const tab of document.querySelectorAll(".tab")) {
    if (tab.dataset.tab === currentTab) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
    if (tab.dataset.tab === "debts") {
      tab.textContent = debtCount > 0 ? "Долги (" + debtCount + ")" : "Долги";
    }
  }
}

function render() {
  renderTabs();
  const nodes = currentTab === "subjects" ? renderSubjectsTab() : renderDebtsTab();
  document.getElementById("content").replaceChildren(...nodes);
}

/* ===== 12. Запуск ===== */

function selectTab(tabName) {
  currentTab = tabName;
  render();
  window.scrollTo(0, 0);
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
}
document.getElementById("settings-button").addEventListener("click", openSettings);

render();

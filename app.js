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
  inProgress: "В работе",
  done: "Сделана, не сдана",
  rejected: "Пробовал сдать — не приняли",
  submitted: "Сдана",
};

// Цвет оформления по умолчанию и 10 готовых цветов на выбор
const DEFAULT_ACCENT = "#0f5c63";
const ACCENT_COLORS = [
  { name: "Красный", value: "#d32f2f" },
  { name: "Оранжевый", value: "#ef6c00" },
  { name: "Жёлтый", value: "#f9c80e" },
  { name: "Зелёный", value: "#2e7d32" },
  { name: "Бирюзовый", value: DEFAULT_ACCENT },
  { name: "Голубой", value: "#0288d1" },
  { name: "Синий", value: "#1e4fc2" },
  { name: "Фиолетовый", value: "#6a32b8" },
  { name: "Розовый", value: "#d81b7a" },
  { name: "Коричневый", value: "#6d4c41" },
];

// Поля профиля: код для хранения и подпись на экране
const PROFILE_FIELDS = [
  { key: "fullName", label: "ФИО" },
  { key: "university", label: "Вуз" },
  { key: "faculty", label: "Факультет или институт" },
  { key: "direction", label: "Направление подготовки" },
  { key: "group", label: "Группа" },
  { key: "recordBook", label: "Номер зачётной книжки" },
];

/* ===== 2. Состояние приложения ===== */

let currentTab = "subjects"; // открытая вкладка
let closedBlockOpen = false; // развёрнут ли блок «Закрытые предметы»
let workFilter = { status: "all", type: "all" }; // выбранный фильтр работ
const expandedSubjects = new Set(); // id развёрнутых карточек предметов
let data = loadData(); // все данные пользователя

/* ===== 3. Сохранение и загрузка ===== */

function createEmptyData() {
  return {
    currentSemester: null,
    accentColor: DEFAULT_ACCENT,
    profile: normalizeProfile({}),
    subjects: [],
  };
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
    accentColor: toAccentColor(raw.accentColor),
    profile: normalizeProfile(isObject(raw.profile) ? raw.profile : {}),
    subjects: raw.subjects.filter(isObject).map(normalizeSubject),
  };
}

// Цвет должен иметь вид #rrggbb, иначе берём цвет по умолчанию.
// В старых файлах экспорта цвета и профиля нет: они тоже получат значения по умолчанию
function toAccentColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_ACCENT;
}

function normalizeProfile(raw) {
  const profile = {};
  for (const field of PROFILE_FIELDS) {
    profile[field.key] = toText(raw[field.key]);
  }
  return profile;
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

// В учебном году 2 семестра: 1–2 семестр — 1 курс, 3–4 — 2 курс, 5–6 — 3 курс
function getCourse(semester) {
  return Math.ceil(semester / 2);
}

function formatSemester(semester) {
  return getCourse(semester) + " курс, " + semester + " семестр";
}

// Сколько работ предмета уже сдано
function countSubmitted(subject) {
  return subject.works.filter((work) => work.status === "submitted").length;
}

// Порядок типов в списке: сначала лабораторные, потом РГР, потом остальное
const WORK_TYPE_ORDER = Object.keys(WORK_TYPE_LABELS);

// Сортирует работы для показа: по типу, затем по названию.
// numeric: true сравнивает числа как числа, поэтому «ЛР 2» идёт раньше «ЛР 10».
// Порядок в самих данных не меняется: slice() делает копию списка
function sortWorks(works) {
  return works.slice().sort((a, b) => {
    const byType = WORK_TYPE_ORDER.indexOf(a.type) - WORK_TYPE_ORDER.indexOf(b.type);
    return byType !== 0 ? byType : a.title.localeCompare(b.title, "ru", { numeric: true, sensitivity: "base" });
  });
}

// Название для сравнения: без лишних пробелов и без разницы в регистре
function simplifyTitle(title) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

// Есть ли у предмета другая работа того же типа с таким же названием
function hasDuplicateWork(subject, values, editedWork) {
  return subject.works.some(
    (work) =>
      work !== editedWork &&
      work.type === values.type &&
      simplifyTitle(work.title) === simplifyTitle(values.title)
  );
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

// Поле семестра: под ним сразу видно, какой это курс
function createSemesterField(labelText, input) {
  const hint = createElement("span", "field-hint");
  const updateHint = () => {
    const semester = toSemester(input.value);
    hint.textContent = semester === null ? "" : "Это " + getCourse(semester) + " курс";
  };
  input.addEventListener("input", updateHint);
  updateHint();
  const field = createField(labelText, input);
  field.append(hint);
  return field;
}

/* ===== 6. Окна: шторка снизу и окно-предупреждение ===== */

const modal = document.getElementById("modal");
const SVG_NS = "http://www.w3.org/2000/svg";

// Шрифт как в style.css: нужен, чтобы измерить ширину текста
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Значки из линий. Рисуются цветом текста, поэтому перекрашиваются сами
const ICON_PATHS = {
  plus: "M12 5v14M5 12h14",
  chevron: "M9 6l6 6-6 6",
};

function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.append(path);
  return svg;
}

// Группа строк со скруглёнными углами, как в настройках iPhone
function createGroup(...children) {
  const group = createElement("div", "group");
  group.append(...children);
  return group;
}

// Подпись над группой мелкими заглавными буквами
function createSectionHeader(text) {
  return createElement("h3", "section-header", text);
}

// Пояснение под группой
function createFootnote(text) {
  return createElement("p", "footnote", text);
}

// Строка-кнопка во всю ширину группы: «Добавить работу», «Экспорт в файл»
function createRowButton(text, onClick, className, icon) {
  const button = createButton(text, "row-button " + (className || ""), onClick);
  if (icon) {
    button.prepend(createIcon(icon));
  }
  return button;
}

function createFormError() {
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");
  return error;
}

// Форма в шторке. Кнопка «Сохранить» стоит в шапке шторки, вне формы,
// и связана с ней через атрибут form="sheet-form"
function createSheetForm(onSubmit) {
  const form = createElement("form", "form");
  form.id = "sheet-form";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit();
  });
  return form;
}

// Шапка шторки: слева «Отмена», в центре заголовок, справа «Сохранить» или «Готово»
function createSheetHeader(title, submitLabel) {
  const header = createElement("div", "sheet-header");
  const heading = createElement("h2", "modal-title", title);
  if (submitLabel) {
    const submit = createElement("button", "button text-button text-button-bold", submitLabel);
    submit.type = "submit";
    submit.setAttribute("form", "sheet-form");
    header.append(createButton("Отмена", "text-button", closeModal), heading, submit);
  } else {
    header.append(createElement("span"), heading, createButton("Готово", "text-button text-button-bold", closeModal));
  }
  return header;
}

// Показывает окно. variant — «modal-sheet» (шторка) или «modal-alert» (предупреждение)
function showModal(variant, ...children) {
  modal.className = "modal " + variant;
  modal.replaceChildren(...children);
  if (!modal.open) {
    modal.showModal();
  }
  modal.scrollTop = 0;
}

// Шторка снизу. submitLabel нужен для форм; без него в шапке будет «Готово»
function openSheet(title, submitLabel, ...children) {
  const body = createElement("div", "sheet-body");
  body.append(...children);
  showModal("modal-sheet", createElement("div", "sheet-grabber"), createSheetHeader(title, submitLabel), body);
}

function closeModal() {
  modal.close();
}

// Нажатие на затемнённый фон мимо шторки закрывает её. Окно-предупреждение так не закрывается
modal.addEventListener("click", (event) => {
  const box = modal.getBoundingClientRect();
  const outside =
    event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  if (event.target === modal && outside && modal.classList.contains("modal-sheet")) {
    closeModal();
  }
});

// Окно-предупреждение по центру, как системное на iPhone
function openAlert(title, text, buttons) {
  const body = createElement("div", "alert-body");
  body.append(createElement("h2", "alert-title", title), createElement("p", "alert-text", text));
  const row = createElement("div", "alert-buttons");
  row.append(...buttons);
  showModal("modal-alert", body, row);
}

// Собственное окно подтверждения вместо стандартного confirm()
function openConfirm(title, text, confirmLabel, onConfirm) {
  openAlert(title, text, [
    createButton("Отмена", "alert-button", closeModal),
    createButton(confirmLabel, "alert-button alert-danger", () => {
      closeModal();
      onConfirm();
    }),
  ]);
}

function openInfo(title, text) {
  openAlert(title, text, [createButton("Понятно", "alert-button alert-bold", closeModal)]);
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
  const error = createFormError();
  const form = createSheetForm(() => submitSubjectForm(form, error, subject, forDebt));

  const nameInput = createInput("name", "text", values.name);
  nameInput.required = true;
  const semesterInput = createNumberInput("semester", values.semester);
  semesterInput.required = true;

  form.append(
    createGroup(
      createField("Название", nameInput),
      createField("Преподаватель", createInput("teacher", "text", values.teacher))
    ),
    createGroup(
      createSemesterField("Номер семестра", semesterInput),
      createField("Форма контроля", createSelect("control", CONTROL_LABELS, values.control)),
      createField("Итог по предмету", createSelect("result", RESULT_LABELS, values.result))
    ),
    error
  );
  // Удаление — внизу формы, как в приложениях iPhone
  if (subject) {
    form.append(createGroup(createRowButton("Удалить предмет", () => confirmDeleteSubject(subject), "row-danger")));
  }

  openSheet(getSubjectFormTitle(subject, forDebt), "Сохранить", form);
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
    // Новую карточку сразу разворачиваем, чтобы можно было добавить работы
    const id = createId();
    expandedSubjects.add(id);
    data.subjects.push({ id: id, ...values, works: [] });
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
  const error = createFormError();
  const form = createSheetForm(() => submitWorkForm(form, error, subject, work));

  const titleInput = createInput("title", "text", values.title);
  titleInput.required = true;
  const noteInput = createElement("textarea", "input");
  noteInput.name = "note";
  noteInput.value = values.note;

  form.append(
    createGroup(
      createField("Тип работы", createSelect("type", WORK_TYPE_LABELS, values.type)),
      createField("Название или номер", titleInput),
      createField("Статус", createSelect("status", WORK_STATUS_LABELS, values.status))
    ),
    createGroup(createField("Заметка (необязательно)", noteInput)),
    error
  );
  if (work) {
    form.append(createGroup(createRowButton("Удалить работу", () => confirmDeleteWork(subject, work), "row-danger")));
  }

  openSheet(work ? "Изменить работу" : "Новая работа", "Сохранить", form);
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
  if (hasDuplicateWork(subject, values, work)) {
    error.textContent = "Такая работа уже есть: «" + values.title + "» (" + WORK_TYPE_LABELS[values.type] + ").";
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
  return [input, createRowButton("Импорт из файла", () => input.click())];
}

function createBackupSection() {
  const block = createElement("div", "settings-block");
  const error = createFormError();
  const [input, importButton] = createImportControls(error);
  block.append(
    createSectionHeader("Резервная копия"),
    createGroup(createRowButton("Экспорт в файл", exportData), importButton),
    input,
    error,
    createFootnote("Данные хранятся только в этом браузере. Файл защитит их от потери и поможет перенести на другое устройство.")
  );
  return block;
}

/* ===== 10. Цвет оформления ===== */

function hexToRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

function rgbToHex(rgb) {
  return "#" + rgb.map((part) => Math.round(part).toString(16).padStart(2, "0")).join("");
}

// Смешивает два цвета. share — доля второго цвета от 0 до 1
function mixColors(first, second, share) {
  const target = hexToRgb(second);
  return rgbToHex(hexToRgb(first).map((part, i) => part + (target[i] - part) * share));
}

// Яркость цвета по формуле из стандарта доступности WCAG
function getLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((part) => {
    const channel = part / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Контраст двух цветов: чем больше число, тем легче читать текст
function getContrast(first, second) {
  const a = getLuminance(first);
  const b = getLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Какой текст читается на этом фоне: белый или чёрный. Один из них подходит для любого цвета
function getTextColorOn(background) {
  return getContrast(background, "#ffffff") >= getContrast(background, "#000000") ? "#ffffff" : "#000000";
}

// Цвет групп в тёмной теме: по нему проверяется контраст подписей
const SURFACE_COLOR = "#2c2c2e";

// Меняет цвет, пока контраст с фоном не станет не меньше нужного:
// на тёмном фоне осветляет, на светлом — затемняет.
// Без этого тёмно-синий или чёрный цвет сделал бы подписи невидимыми
function getReadableColor(color, background, minContrast) {
  const target = getLuminance(background) < 0.2 ? "#ffffff" : "#000000";
  let result = color;
  for (let share = 0.05; share <= 1 && getContrast(result, background) < minContrast; share += 0.05) {
    result = mixColors(color, target, share);
  }
  return result;
}

// Передаёт выбранный цвет в переменные CSS: весь интерфейс перекрашивается сам
function applyTheme() {
  const color = data.accentColor;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--accent", color);
  rootStyle.setProperty("--on-accent", getTextColorOn(color));
  // Подписи и значки цвета оформления: читаются на тёмных группах при любом цвете
  rootStyle.setProperty("--accent-text", getReadableColor(color, SURFACE_COLOR, 4.5));
  // Полоске прогресса хватает контраста 3:1, поэтому она ближе к выбранному цвету
  rootStyle.setProperty("--accent-bar", getReadableColor(color, SURFACE_COLOR, 3));
  // Шары на фоне: оттенок выбранного цвета, но с одинаковой яркостью для любого цвета.
  // Иначе тёмно-синие шары были бы не видны, а жёлтые — слишком яркими
  const { h, s } = hexToHsl(color);
  const saturation = Math.min(s, 70);
  rootStyle.setProperty("--orb-light", hslToHex(h, saturation, 30));
  rootStyle.setProperty("--orb-dark", hslToHex(h, saturation, 9));
  rootStyle.setProperty("--orb-rim", hslToHex(h, Math.min(s, 60), 72));
}

// Переводит цвет из #rrggbb в оттенок, насыщенность и светлоту (HSL)
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((part) => part / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const light = (max + min) / 2;
  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(light * 100) };
  }
  const saturation = delta / (1 - Math.abs(2 * light - 1));
  let hue = (r - g) / delta + 4;
  if (max === r) {
    hue = ((g - b) / delta + 6) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  }
  return { h: Math.round(hue * 60) % 360, s: Math.round(saturation * 100), l: Math.round(light * 100) };
}

// Обратный перевод: из HSL в #rrggbb
function hslToHex(h, s, l) {
  const saturation = s / 100;
  const light = l / 100;
  const amount = saturation * Math.min(light, 1 - light);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    return 255 * (light - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return rgbToHex([channel(0), channel(8), channel(4)]);
}

function isPresetColor(color) {
  return ACCENT_COLORS.some((preset) => preset.value === color);
}

// Отмечает выбранный кружок и показывает текущий цвет в строке «Свой цвет»
function showSelectedColor() {
  const color = data.accentColor;
  for (const swatch of document.querySelectorAll(".swatch")) {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
  }
  const dot = document.querySelector(".custom-dot");
  if (dot) {
    dot.classList.toggle("custom-dot-active", !isPresetColor(color));
    dot.style.setProperty("--dot-color", color);
    dot.style.color = getTextColorOn(color);
    document.getElementById("preview-dot").style.background = color;
  }
}

function setAccentColor(color) {
  data.accentColor = color;
  applyTheme();
  saveData();
  showSelectedColor();
}

// Цветные полоски ползунков зависят от остальных двух значений
function updateSliderTracks(h, s, l) {
  const saturation = document.getElementById("slider-s");
  const light = document.getElementById("slider-l");
  saturation.style.setProperty("--track", "linear-gradient(to right, hsl(" + h + ", 0%, " + l + "%), hsl(" + h + ", 100%, " + l + "%))");
  light.style.setProperty("--track", "linear-gradient(to right, #000000, hsl(" + h + ", " + s + "%, 50%), #ffffff)");
}

// Ставит ползунки в положение, соответствующее текущему цвету
function syncSliders() {
  const { h, s, l } = hexToHsl(data.accentColor);
  document.getElementById("slider-h").value = h;
  document.getElementById("slider-s").value = s;
  document.getElementById("slider-l").value = l;
  updateSliderTracks(h, s, l);
}

function syncHexInput() {
  const input = document.getElementById("hex-input");
  input.value = data.accentColor.toUpperCase();
  input.removeAttribute("aria-invalid");
}

function applySliders() {
  const h = Number(document.getElementById("slider-h").value);
  const s = Number(document.getElementById("slider-s").value);
  const l = Number(document.getElementById("slider-l").value);
  updateSliderTracks(h, s, l);
  setAccentColor(hslToHex(h, s, l));
  syncHexInput();
}

// Принимает код с решёткой и без неё. Если код неполный, возвращает null
function parseHex(text) {
  const value = text.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(value) ? "#" + value.toLowerCase() : null;
}

function applyHexInput(input) {
  const color = parseHex(input.value);
  if (color === null) {
    input.setAttribute("aria-invalid", "true");
    return;
  }
  input.removeAttribute("aria-invalid");
  setAccentColor(color);
  syncSliders();
}

function createSwatch(color) {
  const swatch = createElement("button", "swatch");
  swatch.type = "button";
  swatch.dataset.color = color.value;
  swatch.style.background = color.value;
  swatch.style.color = getTextColorOn(color.value);
  swatch.title = color.name;
  swatch.setAttribute("aria-label", color.name);
  swatch.setAttribute("aria-pressed", String(color.value === data.accentColor));
  swatch.addEventListener("click", () => {
    setAccentColor(color.value);
    syncSliders();
    syncHexInput();
  });
  return swatch;
}

function createSlider(id, label, max) {
  const slider = createElement("input", "slider");
  slider.type = "range";
  slider.id = id;
  slider.min = "0";
  slider.max = String(max);
  slider.addEventListener("input", applySliders);
  return createField(label, slider);
}

// Кружок с текущим цветом и поле для кода цвета
function createHexRow() {
  const input = createInput("hexColor", "text", "");
  input.id = "hex-input";
  input.maxLength = 7;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.addEventListener("input", () => applyHexInput(input));
  // Неполный код при выходе из поля заменяем на текущий цвет
  input.addEventListener("blur", syncHexInput);

  const preview = createElement("span", "preview-dot");
  preview.id = "preview-dot";
  const row = createElement("div", "hex-row");
  row.append(preview, createField("Код цвета", input));
  return row;
}

function createCustomPanel() {
  const panel = createElement("div", "custom-panel");
  panel.id = "custom-panel";
  panel.hidden = isPresetColor(data.accentColor);
  panel.append(
    createHexRow(),
    createSlider("slider-h", "Оттенок", 360),
    createSlider("slider-s", "Насыщенность", 100),
    createSlider("slider-l", "Светлота", 100)
  );
  return panel;
}

// Строка «Свой цвет»: открывает и закрывает панель с ползунками
function createCustomToggle(panel) {
  const toggle = createElement("button", "custom-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(!panel.hidden));
  toggle.setAttribute("aria-controls", panel.id);
  const chevron = createElement("span", "card-chevron");
  chevron.append(createIcon("chevron"));
  toggle.append(createElement("span", "custom-dot"), createElement("span", "custom-label", "Свой цвет"), chevron);
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  });
  return toggle;
}

function createColorSection() {
  const block = createElement("div", "settings-block");
  const swatches = createElement("div", "swatches");
  swatches.append(...ACCENT_COLORS.map(createSwatch));
  const panel = createCustomPanel();
  block.append(
    createSectionHeader("Цвет оформления"),
    createGroup(swatches, createCustomToggle(panel), panel),
    createFootnote("Фон и кнопки перекрашиваются сразу.")
  );
  return block;
}

// Заполняет панель цвета: это можно сделать, только когда она уже на странице
function initColorSection() {
  showSelectedColor();
  syncSliders();
  syncHexInput();
}

/* ===== 11. Настройки ===== */

// Семестр сохраняется сразу при вводе, как в настройках iPhone
function saveSemester(input, error) {
  const semester = toSemester(input.value);
  if (input.validity.badInput || (input.value !== "" && semester === null)) {
    error.textContent = "Семестр должен быть целым числом от 1.";
    return;
  }
  error.textContent = "";
  data.currentSemester = semester;
  updateData();
}

function openSettings() {
  const error = createFormError();
  const input = createNumberInput("currentSemester", data.currentSemester === null ? "" : data.currentSemester);
  input.addEventListener("input", () => saveSemester(input, error));

  const study = createElement("div", "settings-block");
  study.append(createSectionHeader("Учёба"), createGroup(createSemesterField("Текущий семестр", input)), error);

  openSheet("Настройки", null, study, createColorSection(), createBackupSection());
  initColorSection();
}

/* ===== 12. Вывод на экран ===== */

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
    formatSemester(subject.semester),
    CONTROL_LABELS[subject.control],
    "Итог: " + RESULT_LABELS[subject.result],
  ];
  if (subject.teacher !== "") {
    parts.unshift(subject.teacher);
  }
  return createElement("span", "card-meta", parts.join(" · "));
}

function createProgress(subject) {
  const wrapper = createElement("div", "progress");
  if (subject.works.length === 0) {
    wrapper.append(createElement("p", "progress-text", "Работ пока нет"));
    return wrapper;
  }
  const submitted = countSubmitted(subject);
  const percent = Math.round((submitted / subject.works.length) * 100);
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

// Выпадающий список обычно шириной с самый длинный вариант.
// Подгоняем ширину под выбранный текст, чтобы статус помещался рядом с названием
const measureContext = document.createElement("canvas").getContext("2d");

function fitSelectWidth(select, font) {
  measureContext.font = font;
  const textWidth = measureContext.measureText(select.selectedOptions[0].text).width;
  select.style.width = Math.ceil(textWidth) + 48 + "px";
}

function createStatusSelect(work) {
  const select = createSelect("status", WORK_STATUS_LABELS, work.status);
  select.id = "status-" + work.id;
  select.className = "status-select status-" + work.status;
  select.setAttribute("aria-label", "Статус работы «" + work.title + "»");
  select.addEventListener("change", () => changeWorkStatus(work, select.value));
  fitSelectWidth(select, "600 16px " + FONT_FAMILY);
  return select;
}

function createWorkRow(subject, work) {
  const row = createElement("li", "work");
  // Нажатие на название открывает форму: там работу можно изменить или удалить
  const main = createElement("button", "work-main");
  main.type = "button";
  main.title = "Изменить работу";
  main.addEventListener("click", () => openWorkForm(subject, work));
  main.append(
    createElement("span", "work-title", work.title),
    createElement("span", "work-type", WORK_TYPE_LABELS[work.type])
  );
  if (work.note !== "") {
    main.append(createElement("span", "work-note", work.note));
  }
  row.append(main, createStatusSelect(work));
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
  return { works: sortWorks(subject.works.filter(matchesFilter)), emptyText: emptyText };
}

// В карточке долга — только несданные работы
function getDebtWorksView(subject) {
  return {
    works: sortWorks(getUnsubmittedWorks(subject)),
    emptyText: "Несданных работ нет. Осталось закрыть сам предмет.",
  };
}

function isFilterActive() {
  return workFilter.status !== "all" || workFilter.type !== "all";
}

// Разворачивает или сворачивает карточку
function toggleSubject(subject) {
  if (expandedSubjects.has(subject.id)) {
    expandedSubjects.delete(subject.id);
  } else {
    expandedSubjects.add(subject.id);
  }
  render();
  // После перерисовки возвращаем фокус на ту же карточку
  document.getElementById("toggle-" + subject.id).focus({ preventScroll: true });
}

// Заголовок карточки — большая кнопка: нажатие в любом месте сворачивает и разворачивает
function createCardToggle(subject, expanded, locked) {
  const toggle = createElement("button", "card-toggle");
  toggle.type = "button";
  toggle.id = "toggle-" + subject.id;
  toggle.disabled = locked;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.addEventListener("click", () => toggleSubject(subject));

  const text = createElement("span", "card-toggle-text");
  text.append(createElement("span", "card-title", subject.name), createSubjectMeta(subject));
  const chevron = createElement("span", "card-chevron");
  chevron.append(createIcon("chevron"));
  toggle.append(text, chevron);

  const heading = createElement("h3", "card-heading");
  heading.append(toggle);
  return heading;
}

// То, что видно только в развёрнутой карточке
function createCardDetails(subject, view) {
  const nodes = [];
  if (view.works.length > 0 || view.emptyText !== "") {
    nodes.push(createWorkList(subject, view.works, view.emptyText));
  }
  nodes.push(
    createRowButton("Добавить работу", () => openWorkForm(subject, null), "", "plus"),
    createRowButton("Изменить предмет", () => openSubjectForm(subject, false))
  );
  return nodes;
}

function createSubjectCard(subject, getWorksView) {
  const view = getWorksView(subject);
  // При включённом фильтре карточки открыты: иначе результат фильтра не был бы виден
  const locked = getWorksView === getSubjectWorksView && isFilterActive();
  const expanded = locked || expandedSubjects.has(subject.id);

  const card = createElement("article", "card group");
  card.append(createCardToggle(subject, expanded, locked), createProgress(subject));
  if (expanded) {
    card.append(...createCardDetails(subject, view));
  }
  return card;
}

// Сколько колонок карточек помещается. Значения совпадают с @media в style.css
const TWO_COLUMNS = window.matchMedia("(min-width: 900px)");
const THREE_COLUMNS = window.matchMedia("(min-width: 1300px)");

function getColumnCount() {
  if (THREE_COLUMNS.matches) {
    return 3;
  }
  return TWO_COLUMNS.matches ? 2 : 1;
}

// Карточки раскладываются по колонкам по очереди: 1-я, 2-я, 3-я, снова 1-я...
// У каждой колонки своя высота, поэтому открытая карточка сдвигает вниз
// только карточки своей колонки, а соседние остаются на месте
function createCardList(subjects, getWorksView) {
  const count = getColumnCount();
  const columns = [];
  for (let i = 0; i < count; i++) {
    columns.push(createElement("div", "card-column"));
  }
  subjects.forEach((subject, index) => {
    columns[index % count].append(createSubjectCard(subject, getWorksView));
  });

  const list = createElement("div", "card-list");
  list.style.setProperty("--columns", count);
  list.append(...columns);
  return list;
}

// Заголовок вкладки крупным шрифтом и круглая кнопка «+», как в приложениях iPhone
function createPageHeader(title, addLabel, onAdd) {
  const header = createElement("div", "page-header");
  header.append(createElement("h2", "large-title", title));
  if (onAdd) {
    const add = createButton("", "add-button", onAdd);
    add.setAttribute("aria-label", addLabel);
    add.title = addLabel;
    add.append(createIcon("plus"));
    header.append(add);
  }
  return header;
}

// Фильтр работ: варианты списка — «Все» плюс все статусы или типы
function createFilterSelect(labelText, filterKey, labels) {
  const select = createSelect(filterKey, { all: "Все", ...labels }, workFilter[filterKey]);
  select.addEventListener("change", () => {
    workFilter[filterKey] = select.value;
    render();
  });
  fitSelectWidth(select, "17px " + FONT_FAMILY);
  const field = createField(labelText, select);
  field.classList.add("field-inline");
  return field;
}

function createWorkFilter() {
  const filter = createGroup(
    createFilterSelect("Статус работ", "status", WORK_STATUS_LABELS),
    createFilterSelect("Тип работ", "type", WORK_TYPE_LABELS)
  );
  filter.classList.add("filter");
  return filter;
}

// Подсказка первого запуска: показывает только то, что ещё не сделано
function createFirstRunHint() {
  const hasNoSubjects = data.subjects.length === 0;
  const hasNoSemester = data.currentSemester === null;
  if (!hasNoSubjects && !hasNoSemester) {
    return null;
  }
  const text = createElement("div", "hint-text");
  const list = createElement("ul", "hint-list");
  if (hasNoSubjects) {
    list.append(createElement("li", "", "Добавь первый предмет"));
  }
  if (hasNoSemester) {
    list.append(createElement("li", "", "Укажи текущий семестр"));
  }
  text.append(createElement("h2", "hint-title", "С чего начать"), list);

  const hint = createElement("section", "group hint");
  hint.append(text);
  if (hasNoSubjects) {
    hint.append(createRowButton("Добавить предмет", openNewSubjectForm, "", "plus"));
  }
  if (hasNoSemester) {
    hint.append(createRowButton("Указать семестр", openSettings));
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
  const nodes = [createPageHeader("Предметы", "Добавить предмет", openNewSubjectForm)];
  const hint = createFirstRunHint();

  if (hint) {
    nodes.push(hint);
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
  const nodes = [createPageHeader("Долги", "Добавить долг", openNewDebtForm)];
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

// Инициалы для круга в профиле: «Иванов Иван» → «ИИ»
function getInitials(fullName) {
  const words = fullName.trim().split(/\s+/).filter((word) => word !== "");
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase()).join("");
  return letters || "?";
}

function getProfileName() {
  return data.profile.fullName.trim() || "Студент";
}

// Круг с инициалами и имя обновляются прямо во время ввода ФИО
function updateProfileCard() {
  const avatar = document.querySelector(".avatar");
  if (avatar) {
    avatar.textContent = getInitials(data.profile.fullName);
    document.querySelector(".profile-name").textContent = getProfileName();
  }
}

// Поле профиля сохраняется сразу при вводе, поэтому кнопка «Сохранить» не нужна
function createProfileField(field) {
  const input = createInput(field.key, "text", data.profile[field.key]);
  input.addEventListener("input", () => {
    data.profile[field.key] = input.value;
    saveData();
    updateProfileCard();
  });
  return createField(field.label, input);
}

function getCurrentStudyText() {
  if (data.currentSemester === null) {
    return "Семестр не указан. Его можно задать в настройках.";
  }
  return formatSemester(data.currentSemester);
}

function createProfileCard() {
  const avatar = createElement("span", "avatar", getInitials(data.profile.fullName));
  avatar.setAttribute("aria-hidden", "true");
  const text = createElement("div", "profile-card-text");
  text.append(
    createElement("span", "card-title profile-name", getProfileName()),
    createElement("span", "card-meta", getCurrentStudyText())
  );
  const card = createElement("div", "group profile-card");
  card.append(avatar, text);
  return card;
}

function renderProfileTab() {
  const profile = createElement("div", "profile");
  profile.append(
    createProfileCard(),
    createSectionHeader("О себе"),
    createGroup(...PROFILE_FIELDS.map(createProfileField)),
    createFootnote("Сохраняется автоматически и хранится только на этом устройстве. Профиль попадает и в файл экспорта, поэтому не выкладывай этот файл в открытый доступ.")
  );
  return [createPageHeader("Профиль"), profile];
}

function renderTabs() {
  for (const tab of document.querySelectorAll(".tab")) {
    if (tab.dataset.tab === currentTab) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  }
  // Красный кружок с числом долгов на вкладке
  const debtCount = data.subjects.filter(isDebt).length;
  const badge = document.getElementById("debt-badge");
  badge.textContent = debtCount;
  badge.hidden = debtCount === 0;
}

// Какая функция рисует какую вкладку
const TAB_RENDERERS = {
  subjects: renderSubjectsTab,
  debts: renderDebtsTab,
  profile: renderProfileTab,
};

function render() {
  applyTheme();
  renderTabs();
  document.getElementById("content").replaceChildren(...TAB_RENDERERS[currentTab]());
}

/* ===== 13. Запуск ===== */

function selectTab(tabName) {
  currentTab = tabName;
  render();
  window.scrollTo(0, 0);
}

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
}
document.getElementById("settings-button").addEventListener("click", openSettings);
// Ширина окна изменилась так, что меняется число колонок: раскладываем карточки заново
TWO_COLUMNS.addEventListener("change", render);
THREE_COLUMNS.addEventListener("change", render);

// Манифест даёт иконку на главном экране Android и компьютера. При открытии
// двойным кликом браузер не может его прочитать и пишет ошибку, поэтому там не подключаем
function addManifestLink() {
  if (location.protocol === "file:") {
    return;
  }
  const link = createElement("link");
  link.rel = "manifest";
  link.href = "manifest.webmanifest";
  document.head.append(link);
}

addManifestLink();
render();

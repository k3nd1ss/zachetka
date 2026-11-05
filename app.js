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
    createSemesterField("Номер семестра", semesterInput),
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
  const section = createElement("div", "settings-section");
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");
  const buttons = createElement("div", "action-row");
  buttons.append(createButton("Экспорт в файл", "", exportData), ...createImportControls(error));
  section.append(
    createElement("h3", "settings-title", "Резервная копия"),
    createElement("p", "settings-text", "Данные хранятся только в этом браузере. Файл защитит их от потери и поможет перенести на другое устройство."),
    buttons,
    error
  );
  return section;
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

// Затемняет цвет, пока текст этого цвета не станет читаемым на фоне.
// Без этого жёлтый или белый цвет сделал бы подписи невидимыми
function getReadableColor(color, background) {
  let result = color;
  for (let share = 0.1; share <= 1 && getContrast(result, background) < 4.5; share += 0.1) {
    result = mixColors(color, "#000000", share);
  }
  return result;
}

// Передаёт выбранный цвет в переменные CSS: весь интерфейс перекрашивается сам
function applyTheme() {
  const color = data.accentColor;
  const soft = mixColors(color, "#ffffff", 0.85);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--accent", color);
  rootStyle.setProperty("--accent-soft", soft);
  rootStyle.setProperty("--accent-text", getReadableColor(color, soft));
  rootStyle.setProperty("--on-accent", getTextColorOn(color));
  document.querySelector('meta[name="theme-color"]').content = color;
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
  toggle.append(
    createElement("span", "custom-dot"),
    createElement("span", "custom-label", "Свой цвет"),
    createElement("span", "card-chevron")
  );
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  });
  return toggle;
}

function createColorSection() {
  const section = createElement("div", "settings-section");
  const swatches = createElement("div", "swatches");
  swatches.append(...ACCENT_COLORS.map(createSwatch));
  const panel = createCustomPanel();
  section.append(
    createElement("h3", "settings-title", "Цвет оформления"),
    swatches,
    createCustomToggle(panel),
    panel
  );
  return section;
}

// Заполняет панель цвета: это можно сделать, только когда она уже на странице
function initColorSection() {
  showSelectedColor();
  syncSliders();
  syncHexInput();
}

/* ===== 11. Настройки ===== */

function openSettings() {
  const form = createElement("form", "form");
  const error = createElement("p", "form-error");
  error.setAttribute("role", "alert");
  const semester = data.currentSemester === null ? "" : data.currentSemester;

  form.append(
    createSemesterField("Текущий семестр", createNumberInput("currentSemester", semester)),
    error,
    createFormActions("Сохранить")
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSettings(form, error);
  });

  openModal("Настройки", form, createColorSection(), createBackupSection());
  initColorSection();
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
  toggle.append(text, createElement("span", "card-chevron"));

  const heading = createElement("h3", "card-heading");
  heading.append(toggle);
  return heading;
}

// То, что видно только в развёрнутой карточке
function createCardDetails(subject, view) {
  const actions = createElement("div", "action-row");
  actions.append(
    createButton("Изменить", "", () => openSubjectForm(subject, false)),
    createButton("Удалить", "button-danger", () => confirmDeleteSubject(subject))
  );

  const nodes = [actions];
  if (view.works.length > 0 || view.emptyText !== "") {
    nodes.push(createWorkList(subject, view.works, view.emptyText));
  }
  nodes.push(createButton("+ Добавить работу", "button-wide", () => openWorkForm(subject, null)));
  return nodes;
}

function createSubjectCard(subject, getWorksView) {
  const view = getWorksView(subject);
  // При включённом фильтре карточки открыты: иначе результат фильтра не был бы виден
  const locked = getWorksView === getSubjectWorksView && isFilterActive();
  const expanded = locked || expandedSubjects.has(subject.id);

  const card = createElement("article", "card");
  card.append(createCardToggle(subject, expanded, locked), createProgress(subject));
  if (expanded) {
    card.append(...createCardDetails(subject, view));
  }
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

// Поле профиля сохраняется сразу при вводе, поэтому кнопка «Сохранить» не нужна
function createProfileField(field) {
  const input = createInput(field.key, "text", data.profile[field.key]);
  input.addEventListener("input", () => {
    data.profile[field.key] = input.value;
    saveData();
  });
  return createField(field.label, input);
}

function getCurrentStudyText() {
  if (data.currentSemester === null) {
    return "Текущий семестр не указан. Его можно задать в настройках.";
  }
  return "Сейчас: " + formatSemester(data.currentSemester);
}

function renderProfileTab() {
  const card = createElement("section", "card profile");
  const header = createElement("div");
  header.append(
    createElement("h2", "card-title", "Профиль студента"),
    createElement("p", "card-meta", getCurrentStudyText())
  );
  card.append(
    header,
    ...PROFILE_FIELDS.map(createProfileField),
    createElement("p", "card-meta", "Сохраняется автоматически и хранится только на этом устройстве. Профиль попадает и в файл экспорта, поэтому не выкладывай этот файл в открытый доступ.")
  );
  return [card];
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

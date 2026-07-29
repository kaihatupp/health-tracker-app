const STORAGE_KEY = "healthRecords";

const form = document.getElementById("record-form");
const dateInput = document.getElementById("date");
const recordsList = document.getElementById("records-list");

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function findRecord(date) {
  return loadRecords().find((r) => r.date === date) || null;
}

function upsertRecord(newRecord) {
  const records = loadRecords();
  const index = records.findIndex((r) => r.date === newRecord.date);
  if (index >= 0) {
    records[index] = newRecord;
  } else {
    records.push(newRecord);
  }
  records.sort((a, b) => (a.date < b.date ? 1 : -1));
  saveRecords(records);
  return records;
}

function formatValue(value, unit) {
  return value === null || value === undefined || value === "" ? "-" : `${value}${unit}`;
}

function renderRecords() {
  const records = loadRecords();
  recordsList.innerHTML = "";

  if (records.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "記録がまだありません";
    recordsList.appendChild(li);
    return;
  }

  for (const r of records) {
    const li = document.createElement("li");
    li.dataset.date = r.date;
    li.innerHTML = `
      <div class="record-date">${r.date}</div>
      <div>体重: ${formatValue(r.weight, " kg")} / 体脂肪率: ${formatValue(r.bodyFat, " %")}</div>
      <div>血圧: ${formatValue(r.systolic, "")} / ${formatValue(r.diastolic, "")} mmHg / 脈拍: ${formatValue(r.pulse, " 回/分")}</div>
    `;
    recordsList.appendChild(li);
  }
}

function getNumberOrNull(id) {
  const value = document.getElementById(id).value;
  return value === "" ? null : Number(value);
}

function setFieldValue(id, value) {
  document.getElementById(id).value = value === null || value === undefined ? "" : String(value);
}

function populateFormForDate(date) {
  const existing = findRecord(date);
  setFieldValue("weight", existing && existing.weight !== null ? existing.weight.toFixed(1) : "");
  setFieldValue("bodyFat", existing && existing.bodyFat !== null ? existing.bodyFat.toFixed(1) : "");
  setFieldValue("systolic", existing ? existing.systolic : "");
  setFieldValue("diastolic", existing ? existing.diastolic : "");
  setFieldValue("pulse", existing ? existing.pulse : "");
}

function attachAutoDecimalInput(el) {
  el.addEventListener("input", () => {
    const digits = el.value.replace(/[^0-9]/g, "").slice(0, 4);
    if (digits === "") {
      el.value = "";
      return;
    }
    el.value = (parseInt(digits, 10) / 10).toFixed(1);
  });
}

attachAutoDecimalInput(document.getElementById("weight"));
attachAutoDecimalInput(document.getElementById("bodyFat"));

dateInput.addEventListener("change", () => {
  populateFormForDate(dateInput.value);
});

recordsList.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-date]");
  if (!li) return;
  dateInput.value = li.dataset.date;
  populateFormForDate(li.dataset.date);
  form.scrollIntoView({ behavior: "smooth" });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = dateInput.value;
  if (!date) {
    alert("日付を入力してください");
    return;
  }

  const existing = findRecord(date);

  const newRecord = {
    date,
    weight: getNumberOrNull("weight") ?? (existing ? existing.weight : null),
    bodyFat: getNumberOrNull("bodyFat") ?? (existing ? existing.bodyFat : null),
    systolic: getNumberOrNull("systolic") ?? (existing ? existing.systolic : null),
    diastolic: getNumberOrNull("diastolic") ?? (existing ? existing.diastolic : null),
    pulse: getNumberOrNull("pulse") ?? (existing ? existing.pulse : null),
  };

  upsertRecord(newRecord);
  renderRecords();
  dateInput.value = todayString();
  populateFormForDate(dateInput.value);

  if (typeof renderChart === "function") {
    renderChart();
  }
});

dateInput.value = todayString();
populateFormForDate(dateInput.value);
renderRecords();

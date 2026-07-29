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

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const newRecord = {
    date: dateInput.value,
    weight: getNumberOrNull("weight"),
    bodyFat: getNumberOrNull("bodyFat"),
    systolic: getNumberOrNull("systolic"),
    diastolic: getNumberOrNull("diastolic"),
    pulse: getNumberOrNull("pulse"),
  };

  if (!newRecord.date) {
    alert("日付を入力してください");
    return;
  }

  upsertRecord(newRecord);
  renderRecords();
  form.reset();
  dateInput.value = todayString();

  if (typeof renderChart === "function") {
    renderChart();
  }
});

dateInput.value = todayString();
renderRecords();

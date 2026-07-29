const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");

exportBtn.addEventListener("click", () => {
  const json = JSON.stringify(loadRecords(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `vitaltrend-backup-${todayString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => {
  importFile.click();
});

function isValidImportedRecord(r) {
  return r && typeof r === "object" && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
}

function sanitizeImportedRecord(r) {
  const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  return {
    date: r.date,
    weight: num(r.weight),
    bodyFat: num(r.bodyFat),
    systolic: num(r.systolic),
    diastolic: num(r.diastolic),
    pulse: num(r.pulse),
  };
}

importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      alert("ファイルの読み込みに失敗しました。正しいバックアップファイルか確認してください。");
      importFile.value = "";
      return;
    }

    if (!Array.isArray(parsed)) {
      alert("ファイルの形式が正しくありません。");
      importFile.value = "";
      return;
    }

    const incoming = parsed.filter(isValidImportedRecord).map(sanitizeImportedRecord);
    if (incoming.length === 0) {
      alert("有効な記録が見つかりませんでした。");
      importFile.value = "";
      return;
    }

    const overlapCount = incoming.filter((r) => findRecord(r.date)).length;
    const message =
      overlapCount > 0
        ? `${incoming.length}件の記録を読み込みます。うち${overlapCount}件は既存の同じ日付のデータを上書きします。よろしいですか？`
        : `${incoming.length}件の記録を読み込みます。よろしいですか？`;

    if (!confirm(message)) {
      importFile.value = "";
      return;
    }

    const records = loadRecords();
    for (const rec of incoming) {
      const index = records.findIndex((r) => r.date === rec.date);
      if (index >= 0) {
        records[index] = rec;
      } else {
        records.push(rec);
      }
    }
    records.sort((a, b) => (a.date < b.date ? 1 : -1));
    saveRecords(records);

    renderRecords();
    populateFormForDate(dateInput.value);
    if (typeof renderChart === "function") {
      renderChart();
    }

    alert(`${incoming.length}件の記録を復元しました。`);
    importFile.value = "";
  };
  reader.readAsText(file);
});

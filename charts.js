const METRICS = {
  weight: {
    label: "体重",
    series: [{ field: "weight", label: "体重", unit: "kg", color: "#2f7d5e", yAxisID: "y" }],
    axes: [{ id: "y", position: "left", title: "体重 (kg)" }],
  },
  bodyFat: {
    label: "体脂肪率",
    series: [{ field: "bodyFat", label: "体脂肪率", unit: "%", color: "#e07a3f", yAxisID: "y" }],
    axes: [{ id: "y", position: "left", title: "体脂肪率 (%)" }],
  },
  bloodPressure: {
    label: "血圧",
    series: [
      { field: "systolic", label: "最高血圧", unit: "mmHg", color: "#c1443c", yAxisID: "y" },
      { field: "diastolic", label: "最低血圧", unit: "mmHg", color: "#4472c4", yAxisID: "y" },
    ],
    axes: [{ id: "y", position: "left", title: "血圧 (mmHg)" }],
  },
  pulse: {
    label: "脈拍",
    series: [{ field: "pulse", label: "脈拍", unit: "回/分", color: "#8b5fbf", yAxisID: "y" }],
    axes: [{ id: "y", position: "left", title: "脈拍 (回/分)" }],
  },
  weightBP: {
    label: "体重+血圧",
    series: [
      { field: "weight", label: "体重", unit: "kg", color: "#2f7d5e", yAxisID: "y" },
      { field: "systolic", label: "最高血圧", unit: "mmHg", color: "#c1443c", yAxisID: "y1" },
      { field: "diastolic", label: "最低血圧", unit: "mmHg", color: "#4472c4", yAxisID: "y1" },
    ],
    axes: [
      { id: "y", position: "left", title: "体重 (kg)" },
      { id: "y1", position: "right", title: "血圧 (mmHg)", grid: false },
    ],
  },
};

const GROUP_LIMIT = { day: 5, week: 12, month: 12 };

let currentMetric = "weight";
let currentPeriod = "day";
let chartInstance = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function weekStartKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return toDateKey(d);
}

function groupKeyForPeriod(dateStr, period) {
  if (period === "day") return dateStr;
  if (period === "week") return weekStartKey(dateStr);
  return dateStr.slice(0, 7);
}

function labelForGroup(key, period) {
  if (period === "month") return key;
  const [y, m, d] = key.split("-");
  return period === "week" ? `${m}/${d}週` : `${m}/${d}`;
}

function aggregate(records, period, fields) {
  const groups = new Map();

  for (const record of records) {
    const key = groupKeyForPeriod(record.date, period);
    if (!groups.has(key)) {
      groups.set(key, { key, sums: {}, counts: {} });
      for (const f of fields) {
        groups.get(key).sums[f] = 0;
        groups.get(key).counts[f] = 0;
      }
    }
    const g = groups.get(key);
    for (const f of fields) {
      const value = record[f];
      if (value !== null && value !== undefined && !Number.isNaN(value)) {
        g.sums[f] += value;
        g.counts[f] += 1;
      }
    }
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  const limited = sortedKeys.slice(-GROUP_LIMIT[period]);

  return limited.map((key) => {
    const g = groups.get(key);
    const values = {};
    for (const f of fields) {
      values[f] = g.counts[f] > 0 ? Math.round((g.sums[f] / g.counts[f]) * 10) / 10 : null;
    }
    return { key, label: labelForGroup(key, period), values };
  });
}

function renderChart() {
  const canvas = document.getElementById("chart-canvas");
  const emptyMsg = document.getElementById("chart-empty");
  const records = loadRecords().slice().sort((a, b) => (a.date > b.date ? 1 : -1));

  const metric = METRICS[currentMetric];
  const fields = metric.series.map((s) => s.field);
  const grouped = aggregate(records, currentPeriod, fields);
  const hasData = grouped.some((g) => fields.some((f) => g.values[f] !== null));

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!hasData) {
    canvas.hidden = true;
    emptyMsg.hidden = false;
    return;
  }

  canvas.hidden = false;
  emptyMsg.hidden = true;

  const labels = grouped.map((g) => g.label);
  const datasets = metric.series.map((s) => ({
    label: `${s.label} (${s.unit})`,
    data: grouped.map((g) => g.values[s.field]),
    borderColor: s.color,
    backgroundColor: s.color,
    yAxisID: s.yAxisID,
    spanGaps: true,
    tension: 0.25,
    pointRadius: 3,
  }));

  const scales = {};
  for (const axis of metric.axes) {
    scales[axis.id] = {
      type: "linear",
      position: axis.position,
      beginAtZero: false,
      title: { display: true, text: axis.title },
      grid: { drawOnChartArea: axis.grid !== false },
    };
  }

  chartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales,
      plugins: {
        legend: { display: metric.series.length > 1 },
      },
    },
  });
}

function setActive(buttons, activeBtn) {
  buttons.forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

document.querySelectorAll("#metric-tabs .selector-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentMetric = btn.dataset.metric;
    setActive(document.querySelectorAll("#metric-tabs .selector-btn"), btn);
    renderChart();
  });
});

document.querySelectorAll("#period-tabs .selector-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentPeriod = btn.dataset.period;
    setActive(document.querySelectorAll("#period-tabs .selector-btn"), btn);
    renderChart();
  });
});

document.querySelectorAll("#main-tabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setActive(document.querySelectorAll("#main-tabs .tab-btn"), btn);
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    if (btn.dataset.view === "graph") {
      renderChart();
    }
  });
});

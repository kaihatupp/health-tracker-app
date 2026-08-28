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

const GROUP_LIMIT = { day: 5, week: 4, month: 3 };

let currentMetric = "weight";
let currentPeriod = "day";
let currentOffset = 0;
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

  return sortedKeys.map((key) => {
    const g = groups.get(key);
    const values = {};
    for (const f of fields) {
      values[f] = g.counts[f] > 0 ? Math.round((g.sums[f] / g.counts[f]) * 10) / 10 : null;
    }
    return { key, label: labelForGroup(key, period), values };
  });
}

function paginate(allGroups, period, offset) {
  const pageSize = GROUP_LIMIT[period];
  const end = Math.max(allGroups.length - offset * pageSize, 0);
  const start = Math.max(end - pageSize, 0);
  return {
    page: allGroups.slice(start, end),
    hasOlder: start > 0,
    hasNewer: offset > 0,
  };
}

const SUMMARY_COUNT = 5;
const PERIOD_UNIT_LABEL = { day: "日", week: "週", month: "ヶ月" };

function formatSummaryValue(value, unit) {
  return value === null || value === undefined ? "―" : `${value}${unit}`;
}

function renderSummary(allGrouped, metric, period) {
  const summaryEl = document.getElementById("chart-summary");
  const subset = allGrouped.slice(-SUMMARY_COUNT);
  const hasData = subset.some((g) => metric.series.some((s) => g.values[s.field] !== null));

  if (subset.length === 0 || !hasData) {
    summaryEl.innerHTML = "";
    return;
  }

  if (period === "day") {
    const avgValues = metric.series.map((s) => {
      const vals = subset.map((g) => g.values[s.field]).filter((v) => v !== null && v !== undefined);
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      return `<span>${s.label} ${formatSummaryValue(avg, s.unit)}</span>`;
    });
    summaryEl.innerHTML = `
      <p class="summary-title">直近${subset.length}日間の平均</p>
      <ul class="summary-list">
        <li><span class="summary-label">平均値</span><span class="summary-values">${avgValues.join("")}</span></li>
      </ul>
    `;
    return;
  }

  const unitLabel = PERIOD_UNIT_LABEL[period];
  const items = subset
    .slice()
    .reverse()
    .map((g) => {
      const values = metric.series
        .map((s) => `<span>${s.label} ${formatSummaryValue(g.values[s.field], s.unit)}</span>`)
        .join("");
      return `<li><span class="summary-label">${g.label}</span><span class="summary-values">${values}</span></li>`;
    })
    .join("");
  summaryEl.innerHTML = `
    <p class="summary-title">直近${subset.length}${unitLabel}分の平均値</p>
    <ul class="summary-list">${items}</ul>
  `;
}

function renderChart() {
  const canvas = document.getElementById("chart-canvas");
  const emptyMsg = document.getElementById("chart-empty");
  const prevBtn = document.getElementById("chart-prev");
  const nextBtn = document.getElementById("chart-next");
  const rangeLabel = document.getElementById("chart-range-label");
  const records = loadRecords().slice().sort((a, b) => (a.date > b.date ? 1 : -1));

  const metric = METRICS[currentMetric];
  const fields = metric.series.map((s) => s.field);
  const allGrouped = aggregate(records, currentPeriod, fields);
  const { page: grouped, hasOlder, hasNewer } = paginate(allGrouped, currentPeriod, currentOffset);
  const hasData = grouped.some((g) => fields.some((f) => g.values[f] !== null));

  renderSummary(allGrouped, metric, currentPeriod);

  prevBtn.disabled = !hasOlder;
  nextBtn.disabled = !hasNewer;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (grouped.length === 0 || !hasData) {
    canvas.hidden = true;
    emptyMsg.hidden = false;
    rangeLabel.textContent = "";
    return;
  }

  canvas.hidden = false;
  emptyMsg.hidden = true;
  rangeLabel.textContent =
    grouped.length > 1 ? `${grouped[0].label} 〜 ${grouped[grouped.length - 1].label}` : grouped[0].label;

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
    currentOffset = 0;
    setActive(document.querySelectorAll("#metric-tabs .selector-btn"), btn);
    renderChart();
  });
});

document.querySelectorAll("#period-tabs .selector-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentPeriod = btn.dataset.period;
    currentOffset = 0;
    setActive(document.querySelectorAll("#period-tabs .selector-btn"), btn);
    renderChart();
  });
});

document.getElementById("chart-prev").addEventListener("click", () => {
  currentOffset += 1;
  renderChart();
});

document.getElementById("chart-next").addEventListener("click", () => {
  currentOffset = Math.max(currentOffset - 1, 0);
  renderChart();
});

document.querySelectorAll("#main-tabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const leavingInput = document.getElementById("view-input").classList.contains("active") && btn.dataset.view !== "input";
    if (leavingInput && !confirmDiscardIfDirty()) return;
    if (leavingInput) markFormClean();

    setActive(document.querySelectorAll("#main-tabs .tab-btn"), btn);
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");
    if (btn.dataset.view === "graph") {
      renderChart();
    }
  });
});

// ====== /js/graphs.js ======

// --- Color and shape helpers ---
const DAMAGE_COLORS = [
  "#34d399", // Normal wear
  "#fbbf24", // Minor Dent/Scratches
  "#ef4444", // Burn
  "#818cf8", // Collision
  "#f472b6", // Rear
  "#f59e42", // Front end
  "#a1a1aa", // Other
];
const DAMAGE_COLOR_MAP = {};
const DAMAGE_SHAPES = {
  "Run and Drive": "circle",
  Stationary: "rect",
  "No information": "triangle",
  Other: "cross",
};

function getDamageColor(damage) {
  if (!damage) return "#a1a1aa";
  if (damage.toLowerCase().includes("burn")) return "#ef4444";
  if (damage.toLowerCase().includes("normal wear")) return "#34d399";
  if (damage.toLowerCase().includes("minor dent")) return "#fbbf24";
  if (damage.toLowerCase().includes("collision")) return "#818cf8";
  if (damage.toLowerCase().includes("rear")) return "#f472b6";
  if (damage.toLowerCase().includes("front end")) return "#f59e42";
  return "#a1a1aa";
}

function getStatusShape(status) {
  if (!status) return "cross";
  if (status === "Run and Drive") return "circle";
  if (status === "Stationary") return "rect";
  if (status === "No information") return "triangle";
  return "cross";
}

// --- Scatter chart instance ---
let scatterChart = null;

// --- Tab logic ---
window.selectGraphsTab = function (tab) {
  document.querySelectorAll(".graphs-tab").forEach((btn) => {
    btn.classList.toggle("graphs-tab-active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".graphs-tab-content").forEach((div) => {
    div.style.display = div.id === "graphs-tab-" + tab ? "block" : "none";
  });
};

// --- Toggle logic ---
window.toggleGraphsSection = function () {
  const content = document.getElementById("graphs-content");
  const toggle = document.getElementById("graphs-toggle");
  const expanded = content.style.display === "block";
  content.style.display = expanded ? "none" : "block";
  toggle.style.transform = expanded ? "rotate(0deg)" : "rotate(180deg)";
};

// --- Main render function (called from main.js) ---
window.renderScatterChart = function (carList) {
  // Only show if there is at least one car with price and auctionDate
  const hasData = carList.some(
    (c) => typeof c.price === "number" && c.price > 0 && c.auctionDate,
  );
  document.getElementById("graphs-section").style.display = hasData
    ? ""
    : "none";
  if (!hasData) return;

  // Prepare data
  const data = carList
    .filter((c) => typeof c.price === "number" && c.price > 0 && c.auctionDate)
    .map((c, idx) => ({
      x: parseAuctionDateISO(c.auctionDate),
      y: c.price,
      backgroundColor: getDamageColor(c.damage),
      pointStyle: getStatusShape(c.status),
      car: c,
      _idx: idx,
    }));

  // Destroy previous chart if exists
  if (scatterChart) {
    scatterChart.destroy();
    scatterChart = null;
  }

  // Create chart
  const ctx = document.getElementById("scatterChart").getContext("2d");
  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Price vs Auction Date",
          data: data,
          backgroundColor: data.map((d) => d.backgroundColor),
          pointStyle: data.map((d) => d.pointStyle),
          pointRadius: 7,
          pointHoverRadius: 10,
          borderWidth: 1.5,
          borderColor: "#232329",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const c = ctx.raw.car;
              return [
                `${c.year} ${c.model}`,
                `Price: $${c.price.toLocaleString()}`,
                `Damage: ${c.damage}`,
                `Status: ${c.status}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
            tooltipFormat: "dd MMM yyyy",
            displayFormats: {
              month: "MMM yyyy",
              day: "dd MMM",
            },
          },
          title: {
            display: true,
            text: "Auction Date",
            color: "#e4e4e7",
            font: { weight: 600 },
          },
          grid: { color: "#232329" },
          ticks: { color: "#a1a1aa" },
        },
        y: {
          title: {
            display: true,
            text: "Price (USD)",
            color: "#e4e4e7",
            font: { weight: 600 },
          },
          grid: { color: "#232329" },
          ticks: {
            color: "#a1a1aa",
            callback: (v) => "$" + v.toLocaleString(),
          },
        },
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const car = data[idx].car;
          if (!car) return;
          // Scroll to the car listing by VIN
          const vin = car.vin;
          const carItems = document.querySelectorAll(".car-item");
          for (let item of carItems) {
            if (item.innerHTML.includes(vin)) {
              item.scrollIntoView({ behavior: "smooth", block: "center" });
              item.classList.add("car-item-highlight");
              setTimeout(
                () => item.classList.remove("car-item-highlight"),
                1200,
              );
              break;
            }
          }
        }
      },
    },
  });
  // --- Color legend (damage types) ---
  const colorLegendData = [
    { label: "Normal wear", color: "#34d399" },
    { label: "Minor Dent/Scratches", color: "#fbbf24" },
    { label: "Burn", color: "#ef4444" },
    { label: "Collision", color: "#818cf8" },
    { label: "Rear", color: "#f472b6" },
    { label: "Front end", color: "#f59e42" },
    { label: "Other", color: "#a1a1aa" },
  ];
  const colorLegendDiv = document.getElementById("scatter-legend-colors");
  colorLegendDiv.innerHTML =
    '<span style="margin-right:10px;color:#a1a1aa;">Damage:</span>' +
    colorLegendData
      .map(
        (d) =>
          `<span class="scatter-legend-item">
            <span class="scatter-legend-color" style="background:${d.color};"></span>
            <span>${d.label}</span>
          </span>`,
      )
      .join("");

  // --- Shape legend (status) ---
  const shapeLegendData = [
    { label: "Run and Drive", shape: "circle" },
    { label: "Stationary", shape: "rect" },
    { label: "No information", shape: "triangle" },
    { label: "Other", shape: "cross" },
  ];
  const shapeLegendDiv = document.getElementById("scatter-legend-shapes");
  shapeLegendDiv.innerHTML =
    '<span style="margin-right:10px;color:#a1a1aa;">Status:</span>' +
    shapeLegendData
      .map(
        (d) =>
          `<span class="scatter-legend-item">
            <span class="scatter-legend-shape">${getShapeSVG(d.shape)}</span>
            <span>${d.label}</span>
          </span>`,
      )
      .join("");

  // --- Helper: SVG for shapes ---
  function getShapeSVG(shape) {
    // All shapes are 18x18
    if (shape === "circle")
      return `<svg width="18" height="18"><circle cx="9" cy="9" r="7" fill="#34d399" stroke="#232329" stroke-width="2"/></svg>`;
    if (shape === "rect")
      return `<svg width="18" height="18"><rect x="3" y="3" width="12" height="12" rx="3" fill="#818cf8" stroke="#232329" stroke-width="2"/></svg>`;
    if (shape === "triangle")
      return `<svg width="18" height="18"><polygon points="9,3 15,15 3,15" fill="#fbbf24" stroke="#232329" stroke-width="2"/></svg>`;
    // cross
    return `<svg width="18" height="18"><line x1="4" y1="4" x2="14" y2="14" stroke="#a1a1aa" stroke-width="2"/><line x1="14" y1="4" x2="4" y2="14" stroke="#a1a1aa" stroke-width="2"/></svg>`;
  }
};

// --- Helper: parse "16 February 2025" to ISO date string ---
function parseAuctionDateISO(dateStr) {
  if (!dateStr) return null;
  const months = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };
  const m = dateStr.match(/(\d{1,2}) (\w+) (\d{4})/);
  if (!m) return null;
  const [_, d, mon, y] = m;
  return `${y}-${months[mon] || "01"}-${d.padStart(2, "0")}`;
}

// --- Optional: highlight effect for car-item on scroll ---
const style = document.createElement("style");
style.innerHTML = `
.car-item-highlight {
  box-shadow: 0 0 0 3px #34d399, 0 2px 16px rgba(0,0,0,0.25);
  transition: box-shadow 0.3s;
}
`;
document.head.appendChild(style);

// ====== Price Histogram (Tab 2) ======
let priceHistogramChart = null;

window.renderPriceHistogram = function (carList) {
  // Only show if there is at least one car with price > 0
  const prices = carList
    .map((c) => (typeof c.price === "number" ? c.price : null))
    .filter((p) => p && p > 0);
  if (!prices.length) {
    if (priceHistogramChart) {
      priceHistogramChart.destroy();
      priceHistogramChart = null;
    }
    document.getElementById("priceHistogram").style.display = "none";
    return;
  }
  document.getElementById("priceHistogram").style.display = "";

  // Calculate bins (let's use 12 bins for a good balance)
  const binCount = 12;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const binSize = Math.ceil((max - min) / binCount) || 1;
  const bins = Array(binCount).fill(0);
  prices.forEach((price) => {
    let idx = Math.floor((price - min) / binSize);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx]++;
  });

  // Bin labels
  const binLabels = [];
  for (let i = 0; i < binCount; i++) {
    const from = min + i * binSize;
    const to = from + binSize - 1;
    binLabels.push(`$${from.toLocaleString()}–$${to.toLocaleString()}`);
  }

  // Destroy previous chart if exists
  if (priceHistogramChart) {
    priceHistogramChart.destroy();
    priceHistogramChart = null;
  }

  // Create chart
  const ctx = document.getElementById("priceHistogram").getContext("2d");
  priceHistogramChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [
        {
          label: "Number of Cars",
          data: bins,
          backgroundColor: "#818cf8",
          borderRadius: 8,
          borderWidth: 0,
          hoverBackgroundColor: "#34d399",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} cars`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#232329" },
          ticks: {
            color: "#e4e4e7",
            font: { weight: 600 },
            autoSkip: false,
            maxRotation: 40,
            minRotation: 20,
          },
        },
        y: {
          grid: { color: "#232329" },
          ticks: {
            color: "#a1a1aa",
            precision: 0,
            beginAtZero: true,
          },
        },
      },
    },
  });
};

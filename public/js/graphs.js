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
window.scatterChart = null;

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
  if (window.scatterChart) {
    window.scatterChart.destroy();
    window.scatterChart = null;
  }

  // Create chart
  const ctx = document.getElementById("scatterChart").getContext("2d");
  window.scatterChart = new Chart(ctx, {
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
      animation: false,
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
window.priceHistogramChart = null;

window.renderPriceHistogram = function (carList) {
  // Only show if there is at least one car with price > 0
  let prices = carList
    .map((c) => (typeof c.price === "number" ? c.price : null))
    .filter((p) => p && p > 0);

  // Optional: exclude outliers over 99th percentile if toggle is checked
  const outlierToggle = document.getElementById("price-hist-ignore-outliers");
  if (outlierToggle && outlierToggle.checked && prices.length > 2) {
    const threshold = percentile(prices, 0.99);
    prices = prices.filter((p) => p <= threshold);
  }
  if (!prices.length) {
    if (window.priceHistogramChart) {
      window.priceHistogramChart.destroy();
      window.priceHistogramChart = null;
    }
    document.getElementById("priceHistogram").style.display = "none";
    return;
  }
  document.getElementById("priceHistogram").style.display = "";

  // Calculate dynamic number of bins using Sturges' formula, clamped
  const n = prices.length;
  const sturges = Math.ceil(Math.log2(n) + 1);
  const binCount = Math.min(30, Math.max(6, sturges));
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
  if (window.priceHistogramChart) {
    window.priceHistogramChart.destroy();
    window.priceHistogramChart = null;
  }

  // Create chart
  const ctx = document.getElementById("priceHistogram").getContext("2d");
  window.priceHistogramChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [
        {
          label: "Number of Cars",
          data: bins,
          backgroundColor: "#34d399",
          borderRadius: 8,
          borderWidth: 0,
          hoverBackgroundColor: "#10b981",
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
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

// ====== Mileage Histogram (New Tab) ======
window.mileageHistogramChart = null;

window.renderMileageHistogram = function (carList) {
  let miles = carList
    .map((c) => (typeof c.miles === "number" ? c.miles : null))
    // Exclude placeholder/no-info mileages and extreme placeholders
    .filter((m) => m && m > 0 && m < 900000);

  const outlierToggle = document.getElementById("mileage-hist-ignore-outliers");
  if (outlierToggle && outlierToggle.checked && miles.length > 2) {
    const threshold = percentile(miles, 0.99);
    miles = miles.filter((m) => m <= threshold);
  }

  if (!miles.length) {
    if (window.mileageHistogramChart) {
      window.mileageHistogramChart.destroy();
      window.mileageHistogramChart = null;
    }
    const canvas = document.getElementById("mileageHistogram");
    if (canvas) canvas.style.display = "none";
    return;
  }
  const canvas = document.getElementById("mileageHistogram");
  if (canvas) canvas.style.display = "";

  // Dynamic bins via Sturges, clamped
  const n = miles.length;
  const sturges = Math.ceil(Math.log2(n) + 1);
  const binCount = Math.min(30, Math.max(6, sturges));
  const min = Math.min(...miles);
  const max = Math.max(...miles);
  const binSize = Math.ceil((max - min) / binCount) || 1;
  const bins = Array(binCount).fill(0);
  miles.forEach((m) => {
    let idx = Math.floor((m - min) / binSize);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx]++;
  });

  // Labels
  const binLabels = [];
  for (let i = 0; i < binCount; i++) {
    const from = min + i * binSize;
    const to = from + binSize - 1;
    binLabels.push(`${from.toLocaleString()}–${to.toLocaleString()} mi`);
  }

  if (window.mileageHistogramChart) {
    window.mileageHistogramChart.destroy();
    window.mileageHistogramChart = null;
  }

  const ctx = document.getElementById("mileageHistogram").getContext("2d");
  window.mileageHistogramChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [
        {
          label: "Number of Cars",
          data: bins,
          backgroundColor: "#34d399",
          borderRadius: 8,
          borderWidth: 0,
          hoverBackgroundColor: "#10b981",
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
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

// Helper to compute percentile (0..1) using sorted copy and linear interpolation
function percentile(values, p) {
  if (!values.length) return 0;
  const arr = [...values].sort((a, b) => a - b);
  const pos = (arr.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) {
    return arr[base] + rest * (arr[base + 1] - arr[base]);
  } else {
    return arr[base];
  }
}

// ====== Price Box Plot by Damage Type (Tab 3) ======
window.boxPlotChart = null;

window.renderPriceBoxPlot = function (carList) {
  // Only show if there is at least one car with price > 0
  const validCars = carList.filter(
    (c) => typeof c.price === "number" && c.price > 0 && c.damage,
  );

  if (!validCars.length) {
    if (window.boxPlotChart) {
      window.boxPlotChart.destroy();
      window.boxPlotChart = null;
    }
    const canvas = document.getElementById("boxPlotChart");
    if (canvas) canvas.style.display = "none";
    let msg = document.getElementById("boxPlotMessage");
    if (!msg) {
      msg = document.createElement("p");
      msg.id = "boxPlotMessage";
      msg.style.cssText =
        "text-align:center;color:#a1a1aa;padding:40px;margin:0;";
      const parent = canvas ? canvas.parentElement : null;
      if (parent) parent.appendChild(msg);
    }
    msg.textContent = "Not enough data for box plots";
    msg.style.display = "";
    return;
  }
  const canvas = document.getElementById("boxPlotChart");
  if (canvas) canvas.style.display = "";
  const msg = document.getElementById("boxPlotMessage");
  if (msg) msg.style.display = "none";

  // Group cars by damage type
  const damageGroups = {};
  validCars.forEach((car) => {
    const damage = car.damage || "Unknown";
    if (!damageGroups[damage]) damageGroups[damage] = [];
    damageGroups[damage].push(car.price);
  });

  // Filter out damage types with fewer than 2 cars (lowered threshold)
  const filteredGroups = Object.fromEntries(
    Object.entries(damageGroups).filter(([_, prices]) => prices.length >= 2),
  );

  if (!Object.keys(filteredGroups).length) {
    if (window.boxPlotChart) {
      window.boxPlotChart.destroy();
      window.boxPlotChart = null;
    }
    if (canvas) canvas.style.display = "none";
    let msg = document.getElementById("boxPlotMessage");
    if (!msg) {
      msg = document.createElement("p");
      msg.id = "boxPlotMessage";
      msg.style.cssText =
        "text-align:center;color:#a1a1aa;padding:40px;margin:0;";
      const parent = canvas ? canvas.parentElement : null;
      if (parent) parent.appendChild(msg);
    }
    msg.textContent =
      "Not enough data for box plots (need at least 2 cars per damage type)";
    msg.style.display = "";
    return;
  }

  // Check if box plot is available
  if (!Chart.registry.getController("boxplot")) {
    console.error("Box plot controller not found. Falling back to bar chart.");
    renderDamageBarChart(filteredGroups);
    return;
  }

  // Prepare data for Chart.js box plot - CORRECTED FORMAT
  const labels = Object.keys(filteredGroups).sort();
  const datasets = [
    {
      label: "Price Distribution",
      data: labels.map((damage) => filteredGroups[damage]), // Direct array of prices
      backgroundColor: labels.map((damage) => getDamageColor(damage) + "80"), // 50% opacity
      borderColor: labels.map((damage) => getDamageColor(damage)),
      borderWidth: 2,
    },
  ];

  // Destroy previous chart if exists
  if (window.boxPlotChart) {
    window.boxPlotChart.destroy();
    window.boxPlotChart = null;
  }

  // Create chart
  const ctx = document.getElementById("boxPlotChart").getContext("2d");

  try {
    window.boxPlotChart = new Chart(ctx, {
      type: "boxplot",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const damage = ctx.label;
                const prices = filteredGroups[damage];
                const sorted = [...prices].sort((a, b) => a - b);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const median = getMedian(sorted);

                return [
                  `Damage: ${damage}`,
                  `Count: ${prices.length} cars`,
                  `Min: $${min.toLocaleString()}`,
                  `Median: $${Math.round(median).toLocaleString()}`,
                  `Max: $${max.toLocaleString()}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: "#232329" },
            ticks: {
              color: "#e4e4e7",
              font: { weight: 600 },
              maxRotation: 45,
              minRotation: 0,
            },
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
      },
    });
  } catch (error) {
    console.error("Error creating box plot, falling back to bar:", error);
    renderDamageBarChart(filteredGroups);
  }
};

// Fallback: render as bar chart showing average prices
function renderDamageBarChart(filteredGroups) {
  const msg = document.getElementById("boxPlotMessage");
  if (msg) msg.style.display = "none";
  const labels = Object.keys(filteredGroups).sort();
  const averages = labels.map((damage) => {
    const prices = filteredGroups[damage];
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  });

  if (window.boxPlotChart) {
    window.boxPlotChart.destroy();
    window.boxPlotChart = null;
  }

  const canvas = document.getElementById("boxPlotChart");
  if (canvas) canvas.style.display = "";
  const ctx = canvas.getContext("2d");
  window.boxPlotChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Average Price by Damage",
          data: averages,
          backgroundColor: labels.map((damage) => getDamageColor(damage)),
          borderRadius: 8,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => [
              `Average: $${Math.round(ctx.parsed.y).toLocaleString()}`,
              `Count: ${filteredGroups[ctx.label].length} cars`,
            ],
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#232329" },
          ticks: { color: "#e4e4e7", font: { weight: 600 }, maxRotation: 45 },
        },
        y: {
          grid: { color: "#232329" },
          ticks: {
            color: "#a1a1aa",
            callback: (v) => "$" + v.toLocaleString(),
          },
        },
      },
    },
  });
}

// Helper functions for quartile calculations (keep these)
function getMedian(sortedArray) {
  const mid = Math.floor(sortedArray.length / 2);
  return sortedArray.length % 2 !== 0
    ? sortedArray[mid]
    : (sortedArray[mid - 1] + sortedArray[mid]) / 2;
}

function getQuartile(sortedArray, quartile) {
  const pos = (sortedArray.length - 1) * quartile;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArray[base + 1] !== undefined) {
    return (
      sortedArray[base] + rest * (sortedArray[base + 1] - sortedArray[base])
    );
  } else {
    return sortedArray[base];
  }
}

// ====== Average Price/Mileage Over Time (Tab 4) ======
window.avgLineChart = null;
let currentMetric = "price";

window.renderAvgPriceLineChart = function (carList) {
  // Get selected metric
  const selector = document.getElementById("metric-selector");
  if (selector) {
    currentMetric = selector.value;
    // Add event listener if not already added
    if (!selector.hasAttribute("data-listener")) {
      selector.addEventListener("change", () => {
        // Re-render using the latest filtered dataset (not the first one)
        const latest = window.__datasetForGraphs || carList || [];
        window.renderAvgPriceLineChart(latest);
      });
      selector.setAttribute("data-listener", "true");
    }
  }

  // Only show if there is at least one car with the required data and auctionDate
  const validCars = carList.filter((car) => {
    const hasDate = car.auctionDate;
    const hasPrice = typeof car.price === "number" && car.price > 0;
    const hasMiles =
      typeof car.miles === "number" &&
      car.miles > 0 &&
      car.miles !== 999999 &&
      car.miles !== 999_999;

    if (currentMetric === "price") {
      return hasDate && hasPrice;
    } else {
      return hasDate && hasMiles;
    }
  });

  if (!validCars.length) {
    if (window.avgLineChart) {
      window.avgLineChart.destroy();
      window.avgLineChart = null;
    }
    document.getElementById("avgPriceLineChart").style.display = "none";
    return;
  }
  document.getElementById("avgPriceLineChart").style.display = "";

  // Group by auction date (YYYY-MM-DD)
  const dateMap = {};
  validCars.forEach((car) => {
    const date = parseAuctionDateISO(car.auctionDate);
    if (!date) return;
    if (!dateMap[date]) dateMap[date] = [];

    const value = currentMetric === "price" ? car.price : car.miles;
    dateMap[date].push(value);
  });

  // Sort dates
  const dates = Object.keys(dateMap).sort();

  // Calculate average value per date
  const avgValues = dates.map((date) => {
    const values = dateMap[date];
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  });

  // Calculate trend line using linear regression
  const trendData = calculateTrendLine(dates, avgValues);

  // Chart configuration based on metric
  const isPrice = currentMetric === "price";
  const config = {
    label: isPrice ? "Average Price" : "Average Mileage",
    yAxisTitle: isPrice ? "Average Price (USD)" : "Average Mileage (miles)",
    color: isPrice ? "#34d399" : "#818cf8",
    trendColor: isPrice ? "#fbbf24" : "#f472b6",
    formatter: isPrice
      ? (v) => `$${Math.round(v).toLocaleString()}`
      : (v) => `${Math.round(v).toLocaleString()} mi`,
  };

  // Destroy previous chart if exists
  if (window.avgLineChart) {
    window.avgLineChart.destroy();
    window.avgLineChart = null;
  }

  // Create chart
  const ctx = document.getElementById("avgPriceLineChart").getContext("2d");
  window.avgLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: config.label,
          data: avgValues,
          fill: false,
          borderColor: config.color,
          backgroundColor: config.color,
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 7,
          order: 1,
        },
        {
          label: "Trend Line",
          data: trendData,
          fill: false,
          borderColor: config.trendColor,
          backgroundColor: config.trendColor,
          borderDash: [5, 5],
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#e4e4e7",
            font: { size: 14 },
            usePointStyle: true,
            pointStyle: "line",
          },
        },
        tooltip: {
          callbacks: {
            title: (ctx) => {
              let dateStr = ctx[0].label || "";
              const d = new Date(dateStr);
              if (!isNaN(d)) {
                const day = d.getDate();
                const month = d.toLocaleString("default", { month: "short" });
                const year = d.getFullYear();
                return `${day} ${month} ${year}`;
              }
              return dateStr;
            },
            label: (ctx) => {
              const val = ctx.parsed.y;
              const label = ctx.dataset.label;
              return typeof val === "number"
                ? `${label}: ${config.formatter(val)}`
                : "";
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
            text: config.yAxisTitle,
            color: "#e4e4e7",
            font: { weight: 600 },
          },
          grid: { color: "#232329" },
          ticks: {
            color: "#a1a1aa",
            callback: config.formatter,
          },
        },
      },
    },
  });
};

// Helper function to calculate linear regression trend line (unchanged)
function calculateTrendLine(dates, values) {
  if (dates.length < 2) return [];

  // Convert dates to numeric values (days since first date)
  const firstDate = new Date(dates[0]);
  const x = dates.map((date) => {
    const d = new Date(date);
    return Math.floor((d - firstDate) / (1000 * 60 * 60 * 24)); // days difference
  });
  const y = values;

  // Calculate linear regression: y = mx + b
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  // Generate trend line points
  return x.map((xi) => m * xi + b);
}

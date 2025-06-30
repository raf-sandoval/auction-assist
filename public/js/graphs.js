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

// ====== Price Box Plot by Damage Type (Tab 3) ======
let boxPlotChart = null;

window.renderPriceBoxPlot = function (carList) {
  console.log("Rendering box plot with", carList.length, "cars");

  // Only show if there is at least one car with price > 0
  const validCars = carList.filter(
    (c) => typeof c.price === "number" && c.price > 0 && c.damage,
  );

  console.log("Valid cars for box plot:", validCars.length);

  if (!validCars.length) {
    if (boxPlotChart) {
      boxPlotChart.destroy();
      boxPlotChart = null;
    }
    document.getElementById("boxPlotChart").style.display = "none";
    return;
  }
  document.getElementById("boxPlotChart").style.display = "";

  // Group cars by damage type
  const damageGroups = {};
  validCars.forEach((car) => {
    const damage = car.damage || "Unknown";
    if (!damageGroups[damage]) damageGroups[damage] = [];
    damageGroups[damage].push(car.price);
  });

  console.log("Damage groups:", damageGroups);

  // Filter out damage types with fewer than 2 cars (lowered threshold)
  const filteredGroups = Object.fromEntries(
    Object.entries(damageGroups).filter(([_, prices]) => prices.length >= 2),
  );

  console.log("Filtered groups:", filteredGroups);

  if (!Object.keys(filteredGroups).length) {
    if (boxPlotChart) {
      boxPlotChart.destroy();
      boxPlotChart = null;
    }
    const canvas = document.getElementById("boxPlotChart");
    const container = canvas.parentElement;
    container.innerHTML =
      '<p style="text-align:center;color:#a1a1aa;padding:40px;">Not enough data for box plots (need at least 2 cars per damage type)</p>';
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

  console.log("Chart data:", { labels, datasets });

  // Destroy previous chart if exists
  if (boxPlotChart) {
    boxPlotChart.destroy();
    boxPlotChart = null;
  }

  // Create chart
  const ctx = document.getElementById("boxPlotChart").getContext("2d");

  try {
    boxPlotChart = new Chart(ctx, {
      type: "boxplot",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
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
    console.log("Box plot chart created successfully");
  } catch (error) {
    console.error("Error creating box plot:", error);
    renderDamageBarChart(filteredGroups);
  }
};

// Fallback: render as bar chart showing average prices
function renderDamageBarChart(filteredGroups) {
  console.log("Rendering fallback bar chart");
  const labels = Object.keys(filteredGroups).sort();
  const averages = labels.map((damage) => {
    const prices = filteredGroups[damage];
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  });

  if (boxPlotChart) {
    boxPlotChart.destroy();
    boxPlotChart = null;
  }

  const ctx = document.getElementById("boxPlotChart").getContext("2d");
  boxPlotChart = new Chart(ctx, {
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

// ====== Average Price Over Time (Tab 4) ======
let avgPriceLineChart = null;

// ===== Linear regression for trend line =====
function getLinearRegression(xVals, yVals) {
  const n = xVals.length;
  if (n < 2) return { m: 0, b: 0 };
  const sumX = xVals.reduce((a, b) => a + b, 0);
  const sumY = yVals.reduce((a, b) => a + b, 0);
  const sumXY = xVals.reduce((sum, x, i) => sum + x * yVals[i], 0);
  const sumXX = xVals.reduce((sum, x) => sum + x * x, 0);
  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

window.renderAvgPriceLineChart = function (carList) {
  // Only show if there is at least one car with price > 0 and auctionDate
  const validCars = carList.filter(
    (c) => typeof c.price === "number" && c.price > 0 && c.auctionDate,
  );
  if (!validCars.length) {
    if (avgPriceLineChart) {
      avgPriceLineChart.destroy();
      avgPriceLineChart = null;
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
    dateMap[date].push(car.price);
  });

  // Sort dates
  const dates = Object.keys(dateMap).sort();

  // Calculate average price per date
  const avgPrices = dates.map((date) => {
    const prices = dateMap[date];
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  });

  // Destroy previous chart if exists
  if (avgPriceLineChart) {
    avgPriceLineChart.destroy();
    avgPriceLineChart = null;
  }

  // Create chart
  const ctx = document.getElementById("avgPriceLineChart").getContext("2d");
  avgPriceLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Average Price",
          data: avgPrices,
          fill: false,
          borderColor: "#34d399",
          backgroundColor: "#34d399",
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (ctx) => {
              // ctx[0].parsed.x is a timestamp, ctx[0].label is an ISO string
              let dateStr = ctx[0].label || "";
              // Try to parse as ISO date
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
              return typeof val === "number"
                ? `$${Math.round(val).toLocaleString()}`
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
            text: "Average Price (USD)",
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
};

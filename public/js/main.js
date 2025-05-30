// Global variables
let carData = [];
let chart = null;
let selectedYear = null;
let yearMap = {};
let filterOptions = {};
let currentFilters = {
  damage: "All",
  status: "All",
  minPrice: 0,
  maxPrice: 0,
};
let currentSort = {
  by: "price",
  order: "asc",
};
let currentCarList = [];

// Bar colors
const defaultBarColor = "#818cf8";
const selectedBarColor = "#34d399"; // teal
const hoverBarColor = "#fbbf24";

// Utility functions
function groupByYear(data) {
  const map = {};
  data.forEach((car) => {
    if (!map[car.year]) map[car.year] = [];
    map[car.year].push(car);
  });
  return map;
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, c) => sum + (c.price || 0), 0) / arr.length;
}

function getBarColors(years, selectedYear) {
  return years.map((y) =>
    y == selectedYear ? selectedBarColor : defaultBarColor,
  );
}

function getUnique(arr, key) {
  const set = new Set();
  arr.forEach((item) => {
    if (item[key] && item[key] !== "N/A") set.add(item[key]);
  });
  return Array.from(set).sort();
}

function getPriceRange(arr) {
  let min = Infinity,
    max = 0;
  arr.forEach((car) => {
    if (typeof car.price === "number" && car.price > 0) {
      if (car.price < min) min = car.price;
      if (car.price > max) max = car.price;
    }
  });
  if (!isFinite(min)) min = 0;
  // Round up max to nearest 500
  max = Math.ceil(max / 500) * 500;
  return { min: 0, max: max };
}

// Filter functions
function renderFilterPanel() {
  const panel = document.getElementById("filter-panel");
  panel.innerHTML = "";

  // Title
  const title = document.createElement("div");
  title.id = "filter-panel-title";
  title.textContent = "Filters";
  panel.appendChild(title);

  // Two-column content
  const content = document.createElement("div");
  content.className = "filter-content";

  // Dropdowns stacked vertically
  const dropdowns = document.createElement("div");
  dropdowns.className = "filter-dropdowns";

  // Damage type
  const damageLabel = document.createElement("label");
  damageLabel.textContent = "Damage";
  const damageSelect = document.createElement("select");
  damageSelect.innerHTML =
    `<option value="All">All</option>` +
    filterOptions.damage
      .map((d) => `<option value="${d}">${d}</option>`)
      .join("");
  damageSelect.value = currentFilters.damage;
  damageSelect.onchange = (e) => {
    currentFilters.damage = e.target.value;
    updateFilteredData();
  };
  dropdowns.appendChild(damageLabel);
  dropdowns.appendChild(damageSelect);

  // Status
  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Status";
  const statusSelect = document.createElement("select");
  statusSelect.innerHTML =
    `<option value="All">All</option>` +
    filterOptions.status
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");
  statusSelect.value = currentFilters.status;
  statusSelect.onchange = (e) => {
    currentFilters.status = e.target.value;
    updateFilteredData();
  };
  dropdowns.appendChild(statusLabel);
  dropdowns.appendChild(statusSelect);

  // Sliders stacked vertically
  const sliders = document.createElement("div");
  sliders.className = "filter-sliders";

  // Price Range - Min
  const minSliderGroup = document.createElement("div");
  minSliderGroup.className = "slider-group";
  const minPriceLabel = document.createElement("label");
  minPriceLabel.textContent = "Minimum Price";
  minSliderGroup.appendChild(minPriceLabel);

  const minSliderLabels = document.createElement("div");
  minSliderLabels.className = "slider-labels";
  minSliderLabels.innerHTML = `<span>$<span id="minPriceLabel">${currentFilters.minPrice}</span></span>`;
  minSliderGroup.appendChild(minSliderLabels);

  const minSlider = document.createElement("input");
  minSlider.type = "range";
  minSlider.min = filterOptions.price.min;
  minSlider.max = filterOptions.price.max;
  minSlider.step = 100;
  minSlider.value = currentFilters.minPrice;
  minSlider.oninput = function () {
    if (parseInt(minSlider.value) > parseInt(maxSlider.value)) {
      minSlider.value = maxSlider.value;
    }
    currentFilters.minPrice = parseInt(minSlider.value);
    document.getElementById("minPriceLabel").textContent =
      currentFilters.minPrice;
  };
  minSlider.onchange = function () {
    if (parseInt(minSlider.value) > parseInt(maxSlider.value)) {
      minSlider.value = maxSlider.value;
    }
    currentFilters.minPrice = parseInt(minSlider.value);
    document.getElementById("minPriceLabel").textContent =
      currentFilters.minPrice;
    updateFilteredData();
  };
  minSliderGroup.appendChild(minSlider);

  // Price Range - Max
  const maxSliderGroup = document.createElement("div");
  maxSliderGroup.className = "slider-group";
  const maxPriceLabel = document.createElement("label");
  maxPriceLabel.textContent = "Maximum Price";
  maxSliderGroup.appendChild(maxPriceLabel);

  const maxSliderLabels = document.createElement("div");
  maxSliderLabels.className = "slider-labels";
  maxSliderLabels.innerHTML = `<span>$<span id="maxPriceLabel">${currentFilters.maxPrice}</span></span>`;
  maxSliderGroup.appendChild(maxSliderLabels);

  const maxSlider = document.createElement("input");
  maxSlider.type = "range";
  maxSlider.min = filterOptions.price.min;
  maxSlider.max = filterOptions.price.max;
  maxSlider.step = 100;
  maxSlider.value = currentFilters.maxPrice;
  maxSlider.oninput = function () {
    if (parseInt(maxSlider.value) < parseInt(minSlider.value)) {
      maxSlider.value = minSlider.value;
    }
    currentFilters.maxPrice = parseInt(maxSlider.value);
    document.getElementById("maxPriceLabel").textContent =
      currentFilters.maxPrice;
  };
  maxSlider.onchange = function () {
    if (parseInt(maxSlider.value) < parseInt(minSlider.value)) {
      maxSlider.value = minSlider.value;
    }
    currentFilters.maxPrice = parseInt(maxSlider.value);
    document.getElementById("maxPriceLabel").textContent =
      currentFilters.maxPrice;
    updateFilteredData();
  };
  maxSliderGroup.appendChild(maxSlider);

  sliders.appendChild(minSliderGroup);
  sliders.appendChild(maxSliderGroup);

  // Add columns to content
  content.appendChild(dropdowns);
  content.appendChild(sliders);

  panel.appendChild(content);
  panel.style.display = "";
}

function applyFilters(data) {
  return data.filter((car) => {
    // Damage
    if (currentFilters.damage !== "All" && car.damage !== currentFilters.damage)
      return false;
    // Status
    if (currentFilters.status !== "All" && car.status !== currentFilters.status)
      return false;
    // Price
    let price = typeof car.price === "number" ? car.price : 0;
    if (price < currentFilters.minPrice || price > currentFilters.maxPrice)
      return false;
    return true;
  });
}

function updateFilteredData() {
  // Filter the data
  const filtered = applyFilters(carData);
  // Group by year
  yearMap = groupByYear(filtered);
  // If selectedYear is not present, clear selection
  if (!yearMap[selectedYear]) selectedYear = null;
  renderChart(yearMap);
  if (selectedYear) {
    showCarList(selectedYear, yearMap[selectedYear]);
  } else {
    showCarList(null, []);
  }
}

// Chart functions
function renderChart(yearMapInput) {
  yearMap = yearMapInput; // Save for later use
  const years = Object.keys(yearMap).sort((a, b) => a - b);
  const avgs = years.map((y) => Math.round(average(yearMap[y])));
  const barColors = getBarColors(years, selectedYear);

  const ctx = document.getElementById("barChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          label: "Average Price",
          data: avgs,
          backgroundColor: barColors,
          borderRadius: 8,
          hoverBackgroundColor: hoverBarColor,
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
            label: (ctx) => `$${ctx.parsed.y.toLocaleString()}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#232329" },
          ticks: { color: "#e4e4e7", font: { weight: 600 } },
        },
        y: {
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
          const years = chart.data.labels;
          const year = years[idx];
          selectedYear = year;
          updateBarColors();
          showCarList(year, yearMap[year]);
        }
      },
    },
  });
  document.getElementById("chart-container").style.display = "";
}

function updateBarColors() {
  if (!chart) return;
  const years = chart.data.labels;
  chart.data.datasets[0].backgroundColor = getBarColors(years, selectedYear);
  chart.update();
}

// Sort and list functions
function renderSortPanel() {
  const sortPanel = document.getElementById("sort-panel");
  sortPanel.innerHTML = "";

  // Only show if there is a car list
  if (!selectedYear || !currentCarList.length) {
    sortPanel.style.display = "none";
    return;
  }

  // Sort by dropdown
  const sortByLabel = document.createElement("label");
  sortByLabel.textContent = "Sort by";
  sortByLabel.setAttribute("for", "sort-by");
  const sortBySelect = document.createElement("select");
  sortBySelect.id = "sort-by";
  sortBySelect.innerHTML = `
    <option value="price">Price</option>
    <option value="miles">Miles</option>
    <option value="auctionDate">Auction Date</option>
  `;
  sortBySelect.value = currentSort.by;

  // Order dropdown
  const orderLabel = document.createElement("label");
  orderLabel.textContent = "Order";
  orderLabel.setAttribute("for", "sort-order");
  const orderSelect = document.createElement("select");
  orderSelect.id = "sort-order";
  orderSelect.innerHTML = `
    <option value="asc">Ascending</option>
    <option value="desc">Descending</option>
  `;
  orderSelect.value = currentSort.order;

  // Apply button
  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply";
  applyBtn.onclick = function () {
    currentSort.by = sortBySelect.value;
    currentSort.order = orderSelect.value;
    showCarList(selectedYear, yearMap[selectedYear]);
  };

  sortPanel.appendChild(sortByLabel);
  sortPanel.appendChild(sortBySelect);
  sortPanel.appendChild(orderLabel);
  sortPanel.appendChild(orderSelect);
  sortPanel.appendChild(applyBtn);

  sortPanel.style.display = "";
}

function sortCars(cars) {
  const by = currentSort.by;
  const order = currentSort.order;
  return [...cars].sort((a, b) => {
    let aVal, bVal;
    if (by === "price") {
      aVal = typeof a.price === "number" ? a.price : 0;
      bVal = typeof b.price === "number" ? b.price : 0;
    } else if (by === "miles") {
      aVal = typeof a.miles === "number" ? a.miles : 0;
      bVal = typeof b.miles === "number" ? b.miles : 0;
    } else if (by === "auctionDate") {
      // Parse date as YYYY-MM-DD for comparison
      aVal = parseAuctionDate(a.auctionDate);
      bVal = parseAuctionDate(b.auctionDate);
    }
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

function parseAuctionDate(dateStr) {
  // Accepts "16 February 2025" and returns 20250216 as a number
  if (!dateStr) return 0;
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
  if (!m) return 0;
  const [_, d, mon, y] = m;
  return parseInt(`${y}${months[mon] || "01"}${d.padStart(2, "0")}`);
}

function showCarList(year, cars) {
  const listDiv = document.getElementById("car-list");
  currentCarList = cars || [];
  renderSortPanel();

  if (!year) {
    listDiv.innerHTML = `<div class="hint">Select a year in the graph to show a list of vehicles.</div>`;
    return;
  }
  if (!cars || !cars.length) {
    listDiv.innerHTML = `<p>No cars found for year ${year}.</p>`;
    return;
  }
  // Sort by current sort
  cars = sortCars(cars);

  let html = `<h2 style="margin-bottom:1rem;color:#fafafa;">${year} - ${cars.length} cars</h2>`;
  html += cars
    .map(
      (car) => `
    <div class="car-item" onclick="window.open('${car.url}', '_blank')">
      <img class="car-img" src="${
        car.imageUrl || ""
      }" alt="car" loading="lazy" />
      <div class="car-details">
        <div class="car-value car-price">$${
          car.price ? car.price.toLocaleString() : "N/A"
        }</div>
        <div class="car-value">${
          car.miles ? car.miles.toLocaleString() + " mi" : ""
        }</div>
        <div class="car-value">${car.damage || ""}</div>
        <div class="car-value">${car.status || ""}</div>
        <div class="car-value">${car.location || ""}</div>
        <div class="car-value"><span class="car-vin">${
          car.vin || ""
        }</span></div>
        <div class="car-value">${car.auctionDate || ""}</div>
        <div></div>
      </div>
    </div>
  `,
    )
    .join("");
  listDiv.innerHTML = html;
}

// Event listeners
document.getElementById("file-input").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      carData = JSON.parse(evt.target.result);
      if (!Array.isArray(carData)) throw new Error("Not an array");
      // Populate filter options
      filterOptions.damage = getUnique(carData, "damage");
      filterOptions.status = getUnique(carData, "status");
      filterOptions.price = getPriceRange(carData);
      currentFilters.minPrice = filterOptions.price.min;
      currentFilters.maxPrice = filterOptions.price.max;
      // Show filter panel
      renderFilterPanel();
      // Initial filter and chart
      updateFilteredData();
    } catch (err) {
      alert("Invalid JSON file!");
    }
  };
  reader.readAsText(file);
});

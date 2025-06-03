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
  const filtered = applyFilters(carData);
  yearMap = groupByYear(filtered);
  renderChart(yearMap);

  if (selectedYear && yearMap[selectedYear]) {
    showCarList(selectedYear, yearMap[selectedYear]);
  } else if (selectedYear && !yearMap[selectedYear]) {
    // Year was filtered out, show all years
    selectedYear = null;
    showCarList(null, filtered);
  } else {
    // Show all years by default
    showCarList(null, filtered);
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

  if (!currentCarList.length) {
    sortPanel.style.display = "none";
    return;
  }

  // Show All Years button (only show when a specific year is selected)
  if (selectedYear) {
    const showAllBtn = document.createElement("button");
    showAllBtn.textContent = "Show All Years";
    showAllBtn.style.background = "#6366f1";
    showAllBtn.style.color = "#fff";
    showAllBtn.style.border = "none";
    showAllBtn.style.borderRadius = "6px";
    showAllBtn.style.padding = "7px 18px";
    showAllBtn.style.fontSize = "1rem";
    showAllBtn.style.fontWeight = "600";
    showAllBtn.style.cursor = "pointer";
    showAllBtn.style.transition = "background 0.15s";
    showAllBtn.style.marginRight = "1rem";
    showAllBtn.onmouseover = () => (showAllBtn.style.background = "#4f46e5");
    showAllBtn.onmouseout = () => (showAllBtn.style.background = "#6366f1");
    showAllBtn.onclick = function () {
      selectedYear = null;
      updateBarColors();
      const filtered = applyFilters(carData);
      showCarList(null, filtered);
    };
    sortPanel.appendChild(showAllBtn);
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
    if (selectedYear) {
      showCarList(selectedYear, yearMap[selectedYear]);
    } else {
      const filtered = applyFilters(carData);
      showCarList(null, filtered);
    }
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

  if (year) {
    // Showing specific year
    currentCarList = cars || [];
    renderSortPanel();

    if (!cars || !cars.length) {
      listDiv.innerHTML = `<p>No cars found for year ${year}.</p>`;
      return;
    }

    cars = sortCars(cars);
    let html = `<h2 style="margin-bottom:1rem;color:#fafafa;">${year} - ${cars.length} cars</h2>`;
    html += generateCarListHTML(cars);
    listDiv.innerHTML = html;
  } else {
    // Showing all years
    currentCarList = cars || [];
    renderSortPanel();

    if (!cars || !cars.length) {
      listDiv.innerHTML = `<div class="hint">No cars match your current filters.</div>`;
      return;
    }

    cars = sortCars(cars);
    let html = `<h2 style="margin-bottom:1rem;color:#fafafa;">All Years - ${cars.length} cars</h2>`;
    html += generateCarListHTML(cars);
    listDiv.innerHTML = html;
  }
}

function generateCarListHTML(cars) {
  return cars
    .map(
      (car) => `
    <div class="car-item" onclick="window.open('${car.url}', '_blank')">
      <img class="car-img" src="${car.imageUrl || ""}" alt="car" loading="lazy" />
      <div class="car-details">
        <div class="car-value car-price">$${car.price ? car.price.toLocaleString() : "N/A"}</div>
        <div class="car-value">${car.miles ? car.miles.toLocaleString() + " mi" : ""}</div>
        <div class="car-value">${car.damage || ""}</div>
        <div class="car-value">${car.status || ""}</div>
        <div class="car-value">${car.location || ""}</div>
        <div class="car-value"><span class="car-vin">${car.vin || ""}</span></div>
        <div class="car-value">${car.auctionDate || ""}</div>
        <div class="car-value" style="color: #a1a1aa;">${car.year || ""}</div>
      </div>
    </div>
  `,
    )
    .join("");
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

// Help section functions
function toggleHelp() {
  const content = document.getElementById("help-content");
  const toggle = document.getElementById("help-toggle");

  if (content.classList.contains("expanded")) {
    content.classList.remove("expanded");
    toggle.classList.remove("expanded");
  } else {
    content.classList.add("expanded");
    toggle.classList.add("expanded");
  }
}

function copyBookmarklet() {
  const bookmarkletCode = document
    .getElementById("bookmarklet-code")
    .textContent.trim();
  const copyButton = document.querySelector(".copy-button");

  navigator.clipboard
    .writeText(bookmarkletCode)
    .then(() => {
      const originalText = copyButton.textContent;
      copyButton.textContent = "Copied!";
      copyButton.classList.add("copied");

      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.classList.remove("copied");
      }, 2000);
    })
    .catch((err) => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = bookmarkletCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      const originalText = copyButton.textContent;
      copyButton.textContent = "Copied!";
      copyButton.classList.add("copied");

      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.classList.remove("copied");
      }, 2000);
    });
}

// --- Price Toolbar Feature ---

let priceToolbarTimeout = null;
let priceToolbarMin = 0;
let priceToolbarMax = 0;
let priceToolbarValues = [];
let priceToolbarSortedCars = [];

function showPriceToolbar(cars) {
  if (!cars || !cars.length) {
    document.getElementById("price-toolbar").style.display = "none";
    return;
  }
  // Get sorted prices and cars
  priceToolbarSortedCars = [...cars].sort(
    (a, b) => (a.price || 0) - (b.price || 0),
  );
  priceToolbarValues = priceToolbarSortedCars.map((car) => car.price || 0);
  priceToolbarMin = priceToolbarValues[0];
  priceToolbarMax = priceToolbarValues[priceToolbarValues.length - 1];

  // Set min/max labels
  document.getElementById("price-toolbar-min").textContent =
    "$" + priceToolbarMin.toLocaleString();
  document.getElementById("price-toolbar-max").textContent =
    "$" + priceToolbarMax.toLocaleString();

  // Set slider attributes
  const slider = document.getElementById("price-toolbar-slider");
  slider.min = 0;
  slider.max = priceToolbarValues.length - 1;
  slider.value = 0;

  // Hide tooltip initially
  hidePriceToolbarTooltip();

  // Show toolbar
  document.getElementById("price-toolbar").style.display = "";

  // Scroll event
  window.addEventListener("scroll", onPriceToolbarScroll);
  slider.addEventListener("input", onPriceToolbarSliderInput);
  slider.addEventListener("change", onPriceToolbarSliderChange);
}

function hidePriceToolbar() {
  document.getElementById("price-toolbar").style.display = "none";
  window.removeEventListener("scroll", onPriceToolbarScroll);
}

function onPriceToolbarSliderInput(e) {
  const idx = parseInt(e.target.value, 10);
  showPriceToolbarTooltip(idx);
  scrollToCarByIndex(idx);
  resetPriceToolbarTooltipTimeout();
}

function onPriceToolbarSliderChange(e) {
  const idx = parseInt(e.target.value, 10);
  showPriceToolbarTooltip(idx);
  scrollToCarByIndex(idx);
  resetPriceToolbarTooltipTimeout();
}

function showPriceToolbarTooltip(idx) {
  const tooltip = document.getElementById("price-toolbar-tooltip");
  const slider = document.getElementById("price-toolbar-slider");
  const value = priceToolbarValues[idx];
  document.getElementById("price-toolbar-tooltip-value").textContent =
    "$" + value.toLocaleString();

  // Position tooltip above the slider thumb
  const sliderRect = slider.getBoundingClientRect();
  const min = parseInt(slider.min, 10);
  const max = parseInt(slider.max, 10);
  const percent = (idx - min) / (max - min || 1);
  const sliderWidth = slider.offsetWidth;
  const thumbX = percent * sliderWidth;

  tooltip.style.left = `${thumbX}px`;
  tooltip.style.display = "block";
  tooltip.style.opacity = "0.95";
}

function hidePriceToolbarTooltip() {
  const tooltip = document.getElementById("price-toolbar-tooltip");
  tooltip.style.display = "none";
}

function resetPriceToolbarTooltipTimeout() {
  clearTimeout(priceToolbarTimeout);
  priceToolbarTimeout = setTimeout(hidePriceToolbarTooltip, 2000);
}

function scrollToCarByIndex(idx) {
  // Find the car-item for this price
  const car = priceToolbarSortedCars[idx];
  if (!car) return;
  // Find the car-item in the DOM by VIN (unique)
  const vin = car.vin;
  const carItems = document.querySelectorAll(".car-item");
  for (let item of carItems) {
    if (item.innerHTML.includes(vin)) {
      item.scrollIntoView({ behavior: "smooth", block: "center" });
      break;
    }
  }
}

// When user scrolls, update slider to match the car in view
function onPriceToolbarScroll() {
  const carItems = document.querySelectorAll(".car-item");
  if (!carItems.length) return;
  let closestIdx = 0;
  let minDist = Infinity;
  const viewportTop = window.scrollY;
  for (let i = 0; i < carItems.length; i++) {
    const rect = carItems[i].getBoundingClientRect();
    const dist = Math.abs(rect.top);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }
  // Update slider value without triggering scroll
  const slider = document.getElementById("price-toolbar-slider");
  slider.value = closestIdx;
  showPriceToolbarTooltip(closestIdx);
  resetPriceToolbarTooltipTimeout();
}

// --- Integrate with car list rendering ---

// Modify showCarList to call showPriceToolbar/hidePriceToolbar
const originalShowCarList = showCarList;
showCarList = function (year, cars) {
  originalShowCarList(year, cars);
  if (cars && cars.length) {
    showPriceToolbar(cars);
  } else {
    hidePriceToolbar();
  }
};

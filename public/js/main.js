// Global variables
let carData = [];
let chart = null;
let selectedYear = null;
let yearMap = {};
let filterOptions = {};
let currentFilters = {
  damage: [],
  status: [],
  minPrice: 0,
  maxPrice: 0,
  special: null,
};
let currentSort = {
  by: "price",
  order: "asc",
};
let currentCarList = [];

// Bar colors (teal palette)
const defaultBarColor = "#34d399"; // primary teal
const selectedBarColor = "#10b981"; // selected/active teal
const hoverBarColor = "#6ee7b7"; // hover teal

const NON_RECOMMENDED_DAMAGES = [
  "Burn",
  "Burn - Engine",
  "Burn - Interior",
  "Mechanical",
  "Missing/Altered VIN",
  "Replaced VIN",
  "Undercarriage",
  "Water/Flood",
];

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

function getBarBorderColors(years, selectedYear) {
  return years.map((y) => (y == selectedYear ? "#ffffff" : "transparent"));
}

function getBarBorderWidths(years, selectedYear) {
  return years.map((y) => (y == selectedYear ? 3 : 0));
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

function removeDuplicates(arr) {
  const seen = new Set();
  const duplicateCount = arr.length;

  const uniqueArr = arr.filter((car) => {
    // Primary deduplication by VIN if available and not empty
    if (car.vin && car.vin.trim() !== "" && car.vin !== "N/A") {
      if (seen.has(car.vin)) {
        return false;
      }
      seen.add(car.vin);
      return true;
    }

    // Secondary deduplication by URL if VIN is not available
    if (car.url && car.url.trim() !== "") {
      if (seen.has(car.url)) {
        return false;
      }
      seen.add(car.url);
      return true;
    }

    // Fallback deduplication by combination of key fields
    const key = `${car.year}-${car.model}-${car.miles}-${car.location}-${car.auctionDate}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const removedCount = duplicateCount - uniqueArr.length;
  if (removedCount > 0) {
    console.log(
      `Removed ${removedCount} duplicate entries. Showing ${uniqueArr.length} unique cars.`,
    );
  }

  return uniqueArr;
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

  // Two-column content  ░░ Existing filters ░░
  const content = document.createElement("div");
  content.className = "filter-content";

  const dropdowns = document.createElement("div");
  dropdowns.className = "filter-dropdowns";

  // Helper to create checkbox list
  const createCheckboxGroup = (labelText, choices, selected, key) => {
    const group = document.createElement("div");
    group.className = "checkbox-group";
    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    group.appendChild(lbl);
    const list = document.createElement("div");
    list.className = "checkbox-list";
    choices.forEach((val) => {
      const safeId =
        `${key}-` +
        String(val)
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase();
      const item = document.createElement("div");
      item.className = "checkbox-item";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = safeId;
      input.value = val;
      input.checked = selected.includes(val);
      const l = document.createElement("label");
      l.setAttribute("for", safeId);
      l.textContent = val;
      input.onchange = (e) => {
        const arr = currentFilters[key] || [];
        const checked = e.target.checked;
        if (checked) {
          if (!arr.includes(val)) arr.push(val);
        } else {
          const idx = arr.indexOf(val);
          if (idx !== -1) arr.splice(idx, 1);
        }
        currentFilters[key] = arr;
        updateFilteredData();
      };
      item.appendChild(input);
      item.appendChild(l);
      list.appendChild(item);
    });
    group.appendChild(list);
    return { group, list };
  };

  // Build choices (respect quick filter)
  const damageChoices =
    currentFilters.special === "clean"
      ? ["Normal wear", "Minor Dent/Scratches"]
      : (filterOptions.damage || []).filter((d) => {
          if (currentFilters.special === "nonRecommended") {
            if (typeof d === "string" && d.toLowerCase().includes("burn"))
              return false;
            if (NON_RECOMMENDED_DAMAGES.includes(d)) return false;
          }
          return true;
        });
  const { group: damageGroup, list: damageList } = createCheckboxGroup(
    "Damage",
    damageChoices,
    currentFilters.damage || [],
    "damage",
  );
  // Limit damage list height when too many options
  damageList.classList.add("checkbox-list-damage");
  dropdowns.appendChild(damageGroup);

  const statusChoices = filterOptions.status || [];
  const { group: statusGroup, list: statusList } = createCheckboxGroup(
    "Status",
    statusChoices,
    currentFilters.status || [],
    "status",
  );
  dropdowns.appendChild(statusGroup);

  // Disable when clean active
  const disableDD = currentFilters.special === "clean";
  if (disableDD) {
    [damageList, statusList].forEach((list) => {
      list.classList.add("disabled");
      list
        .querySelectorAll("input[type='checkbox']")
        .forEach((el) => (el.disabled = true));
    });
  }

  // ----- Price sliders -----
  const sliders = document.createElement("div");
  sliders.className = "filter-sliders";

  const createSliderGroup = (labelText, isMin) => {
    const group = document.createElement("div");
    group.className = "slider-group";
    const lbl = document.createElement("label");
    lbl.textContent = labelText;
    group.appendChild(lbl);

    const lbls = document.createElement("div");
    lbls.className = "slider-labels";
    const spanId = isMin ? "minPriceLabel" : "maxPriceLabel";
    lbls.innerHTML = `<span>$<span id="${spanId}">${
      isMin ? currentFilters.minPrice : currentFilters.maxPrice
    }</span></span>`;
    group.appendChild(lbls);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = filterOptions.price.min;
    slider.max = filterOptions.price.max;
    slider.step = 100;
    slider.value = isMin ? currentFilters.minPrice : currentFilters.maxPrice;

    /* While dragging: only update the value display */
    slider.oninput = () => {
      if (isMin && +slider.value > currentFilters.maxPrice)
        slider.value = currentFilters.maxPrice;
      if (!isMin && +slider.value < currentFilters.minPrice)
        slider.value = currentFilters.minPrice;
      if (isMin) currentFilters.minPrice = +slider.value;
      else currentFilters.maxPrice = +slider.value;
      document.getElementById(spanId).textContent = slider.value;
    };

    /* When user releases the thumb: update value + refresh data */
    slider.onchange = () => {
      slider.oninput(); // keep labels/values in sync
      updateFilteredData(); // refresh chart & list
    };

    group.appendChild(slider);
    return group;
  };

  sliders.appendChild(createSliderGroup("Minimum Price", true));
  sliders.appendChild(createSliderGroup("Maximum Price", false));

  content.appendChild(dropdowns);
  content.appendChild(sliders);
  panel.appendChild(content);

  // Full-width separator
  const separator = document.createElement("div");
  separator.style.cssText = "width:100%;height:1px;background:#3f3f46;";
  panel.appendChild(separator);

  // Centered button row
  const quickRow = document.createElement("div");
  quickRow.style.cssText =
    "display:flex;justify-content:center;align-items:center;gap:18px;margin-bottom:8px;width:100%;";
  // Check if we actually have any non-recommended damages in the data
  const hasNonRecommended = carData.some((c) =>
    NON_RECOMMENDED_DAMAGES.includes(c.damage),
  );

  // ----- Button helper -----
  const makeBtn = (txt, title, key) => {
    const btn = document.createElement("button");
    btn.textContent = txt;
    btn.title = title;
    btn.style.cssText =
      "background:#27272a;color:#e4e4e7;border:1px solid #3f3f46;" +
      "border-radius:8px;padding:10px 22px;font-size:1.08rem;" +
      "cursor:pointer;transition:background .15s;font-weight:500;";
    const isActive = currentFilters.special === key;
    if (isActive) {
      btn.style.background = "#34d399";
      btn.style.color = "#18181b";
      btn.style.fontWeight = "600";
    }
    btn.onmouseenter = () =>
      (btn.style.background = isActive ? "#10b981" : "#3f3f46");
    btn.onmouseleave = () =>
      (btn.style.background = isActive ? "#34d399" : "#27272a");
    btn.onclick = () => {
      currentFilters.special = isActive ? null : key; // toggle
      renderFilterPanel();
      updateFilteredData();
    };
    return btn;
  };

  if (hasNonRecommended) {
    quickRow.appendChild(
      makeBtn(
        "Remove non-recommended damage",
        `Removes ${NON_RECOMMENDED_DAMAGES.join(", ")}`,
        "nonRecommended",
      ),
    );
  }

  quickRow.appendChild(
    makeBtn(
      "Clean vehicles only",
      "Shows only vehicles with minimal damage.",
      "clean",
    ),
  );

  panel.appendChild(quickRow);
  panel.style.display = "";
}

function applyFilters(data) {
  return data.filter((car) => {
    // ---- Special quick-filters first ----
    if (currentFilters.special === "nonRecommended") {
      // Remove any damage containing "burn" (case-insensitive)
      if (
        typeof car.damage === "string" &&
        car.damage.toLowerCase().includes("burn")
      ) {
        return false;
      }
      // Remove other non-recommended damages as before
      if (NON_RECOMMENDED_DAMAGES.includes(car.damage)) return false;
    }

    if (currentFilters.special === "clean") {
      const okDamage =
        car.damage === "Normal wear" || car.damage === "Minor Dent/Scratches";
      const okStatus = car.status === "Run and Drive";
      if (!(okDamage && okStatus)) return false;
    }

    // ---- Regular checkbox filters (ignored when 'clean' is active) ----
    if (currentFilters.special !== "clean") {
      const damageSelected = Array.isArray(currentFilters.damage)
        ? currentFilters.damage
        : [];
      const statusSelected = Array.isArray(currentFilters.status)
        ? currentFilters.status
        : [];

      if (damageSelected.length > 0 && !damageSelected.includes(car.damage)) {
        return false;
      }
      if (statusSelected.length > 0 && !statusSelected.includes(car.status)) {
        return false;
      }
    }

    // ---- Price sliders ----
    const price = typeof car.price === "number" ? car.price : 0;
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
  if (window.renderScatterChart) {
    window.renderScatterChart(applyFilters(carData));
  }
  if (window.renderPriceHistogram) {
    window.renderPriceHistogram(applyFilters(carData));
    const priceOutliersToggle = document.getElementById(
      "price-hist-ignore-outliers",
    );
    if (
      priceOutliersToggle &&
      !priceOutliersToggle.hasAttribute("data-listener")
    ) {
      priceOutliersToggle.addEventListener("change", () => {
        window.renderPriceHistogram(applyFilters(carData));
      });
      priceOutliersToggle.setAttribute("data-listener", "true");
    }
  }
  if (window.renderMileageHistogram) {
    window.renderMileageHistogram(applyFilters(carData));
    const mileageOutliersToggle = document.getElementById(
      "mileage-hist-ignore-outliers",
    );
    if (
      mileageOutliersToggle &&
      !mileageOutliersToggle.hasAttribute("data-listener")
    ) {
      mileageOutliersToggle.addEventListener("change", () => {
        window.renderMileageHistogram(applyFilters(carData));
      });
      mileageOutliersToggle.setAttribute("data-listener", "true");
    }
  }
  if (window.renderPriceBoxPlot) {
    window.renderPriceBoxPlot(filtered);
  }
  if (window.renderAvgPriceLineChart) {
    window.renderAvgPriceLineChart(filtered);
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
          borderColor: getBarBorderColors(years, selectedYear),
          borderWidth: getBarBorderWidths(years, selectedYear),
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
  chart.data.datasets[0].borderColor = getBarBorderColors(years, selectedYear);
  chart.data.datasets[0].borderWidth = getBarBorderWidths(years, selectedYear);
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
    // Toolbar will automatically update via showCarList
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
    .map((car) => {
      const auction = car.auction || ""; // "Copart" / "IAAI" or blank
      const eng = typeof car.engine_size === "number" ? car.engine_size : "";
      const safeUrl = car.url ? car.url.replace(/"/g, "&quot;") : "";
      const safeImg = (car.imageUrl || "").replace(/"/g, "&quot;");
      const hasValidPrice =
        typeof car.price === "number" && isFinite(car.price) && car.price > 0;
      const dataAttrs = `
        data-vin="${car.vin || ""}"
        data-year="${car.year || ""}"
        data-price="${car.price || 0}"
        data-location="${(car.location || "").replace(/"/g, "&quot;")}"
        data-auction="${auction}"
        data-engine-size="${eng}"
      `;
      return `
        <div class="car-item" ${dataAttrs} onclick="window.open('${safeUrl}', '_blank')">
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
        ${
          hasValidPrice
            ? `<button class="calc-btn" title="Calcular importación"
                onclick="event.stopPropagation(); window.openEstimateModal('${car.vin || ""}')">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a 1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7zm2 3h6a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm0 4h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm4 0h2a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zM9 15h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm4 0h2a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2z"/>
                </svg>
                Calcular
              </button>`
            : ""
        }
        Calcular
        </button>
        </div>
`;
    })
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
      // Expose to estimator UI
      window.carData = carData;
      if (
        window.EstimatorUI &&
        typeof window.EstimatorUI.onNewFileLoaded === "function"
      ) {
        window.EstimatorUI.onNewFileLoaded(carData);
      }
      // Remove duplicates from the loaded data
      carData = removeDuplicates(carData);
      // Populate filter options
      filterOptions.damage = getUnique(carData, "damage");
      filterOptions.status = getUnique(carData, "status");
      filterOptions.price = getPriceRange(carData);
      currentFilters.minPrice = filterOptions.price.min;
      currentFilters.maxPrice = filterOptions.price.max;
      // Select all by default for multi-select filters
      currentFilters.damage = [...filterOptions.damage];
      currentFilters.status = [...filterOptions.status];
      // Show filter panel
      renderFilterPanel();
      document.getElementById("graphs-section").style.display = "none";
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

// --- Dynamic Toolbar Feature ---

let toolbarTimeout = null;
let toolbarMin = 0;
let toolbarMax = 0;
let toolbarValues = [];
let toolbarSortedCars = [];
let toolbarSortType = "price"; // 'price', 'miles', 'auctionDate'
let toolbarSortOrder = "asc"; // 'asc', 'desc'

function showDynamicToolbar(cars) {
  if (!cars || !cars.length) {
    document.getElementById("price-toolbar").style.display = "none";
    return;
  }

  // Update toolbar based on current sort
  toolbarSortType = currentSort.by;
  toolbarSortOrder = currentSort.order;

  // Sort cars according to current sort settings
  toolbarSortedCars = sortCars([...cars]);

  // Extract values based on sort type
  toolbarValues = toolbarSortedCars.map((car) => getToolbarValue(car));
  toolbarMin = toolbarValues[0];
  toolbarMax = toolbarValues[toolbarValues.length - 1];

  // Set min/max labels with appropriate formatting
  document.getElementById("price-toolbar-min").textContent =
    formatToolbarValue(toolbarMin);
  document.getElementById("price-toolbar-max").textContent =
    formatToolbarValue(toolbarMax);

  // Set slider attributes
  const slider = document.getElementById("price-toolbar-slider");
  slider.min = 0;
  slider.max = toolbarValues.length - 1;
  slider.value = 0;

  // Hide tooltip initially
  hideToolbarTooltip();

  // Show toolbar
  document.getElementById("price-toolbar").style.display = "";

  // Update event listeners
  updateToolbarEventListeners();
}

function getToolbarValue(car) {
  switch (toolbarSortType) {
    case "price":
      return typeof car.price === "number" ? car.price : 0;
    case "miles":
      return typeof car.miles === "number" ? car.miles : 0;
    case "auctionDate":
      return parseAuctionDate(car.auctionDate);
    default:
      return 0;
  }
}

function formatToolbarValue(value) {
  switch (toolbarSortType) {
    case "price":
      return "$" + value.toLocaleString();
    case "miles":
      return value.toLocaleString() + " mi";
    case "auctionDate":
      return formatDateFromNumber(value);
    default:
      return value.toString();
  }
}

function formatDateFromNumber(dateNum) {
  if (!dateNum || dateNum === 0) return "N/A";
  const str = dateNum.toString();
  if (str.length !== 8) return "N/A";

  const year = str.substring(0, 4);
  const month = str.substring(4, 6);
  const day = str.substring(6, 8);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthName = months[parseInt(month) - 1] || "Jan";
  return `${parseInt(day)} ${monthName} ${year}`;
}

function hideDynamicToolbar() {
  document.getElementById("price-toolbar").style.display = "none";
  removeToolbarEventListeners();
}

function updateToolbarEventListeners() {
  const slider = document.getElementById("price-toolbar-slider");

  // Remove existing listeners
  removeToolbarEventListeners();

  // Add new listeners
  window.addEventListener("scroll", onToolbarScroll);
  slider.addEventListener("input", onToolbarSliderInput);
  slider.addEventListener("change", onToolbarSliderChange);
}

function removeToolbarEventListeners() {
  window.removeEventListener("scroll", onToolbarScroll);
  const slider = document.getElementById("price-toolbar-slider");
  slider.removeEventListener("input", onToolbarSliderInput);
  slider.removeEventListener("change", onToolbarSliderChange);
}

function onToolbarSliderInput(e) {
  const idx = parseInt(e.target.value, 10);
  showToolbarTooltip(idx);
  scrollToCarByIndex(idx);
  resetToolbarTooltipTimeout();
}

function onToolbarSliderChange(e) {
  const idx = parseInt(e.target.value, 10);
  showToolbarTooltip(idx);
  scrollToCarByIndex(idx);
  resetToolbarTooltipTimeout();
}

function showToolbarTooltip(idx) {
  const tooltip = document.getElementById("price-toolbar-tooltip");
  const slider = document.getElementById("price-toolbar-slider");
  const value = toolbarValues[idx];
  document.getElementById("price-toolbar-tooltip-value").textContent =
    formatToolbarValue(value);

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

function hideToolbarTooltip() {
  const tooltip = document.getElementById("price-toolbar-tooltip");
  tooltip.style.display = "none";
}

function resetToolbarTooltipTimeout() {
  clearTimeout(toolbarTimeout);
  toolbarTimeout = setTimeout(hideToolbarTooltip, 2000);
}

function scrollToCarByIndex(idx) {
  // Find the car-item for this sorted position
  const car = toolbarSortedCars[idx];
  if (!car) return;

  // Find the car-item in the DOM by VIN (unique identifier)
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
function onToolbarScroll() {
  const carItems = document.querySelectorAll(".car-item");
  if (!carItems.length || !toolbarSortedCars.length) return;

  let closestIdx = 0;
  let minDist = Infinity;

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
  if (closestIdx < toolbarValues.length) {
    slider.value = closestIdx;
    showToolbarTooltip(closestIdx);
    resetToolbarTooltipTimeout();
  }
}

// --- Integrate with car list rendering ---

// Modify showCarList to call showDynamicToolbar/hideDynamicToolbar
const originalShowCarList = showCarList;
showCarList = function (year, cars) {
  originalShowCarList(year, cars);
  if (cars && cars.length) {
    showDynamicToolbar(cars);
  } else {
    hideDynamicToolbar();
  }
  // Make the dataset accessible globally to the estimator module
  window.carData = carData;
};

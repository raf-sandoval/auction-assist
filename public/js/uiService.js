// public/js/uiService.js
import {
  filterOptions,
  currentFilters,
  currentSort,
  selectedYear,
  yearMap,
  currentCarList,
  setFilterOptions,
  setCurrentFilters,
  setCurrentSort,
  setCurrentCarList,
} from './state.js';
import { parseAuctionDate } from './utils.js';
// We need a way to trigger data updates from main.js
// Let's assume main.js will expose an updateFilteredData function
// and we'll import it or have it passed. For now, we'll call a placeholder.
import { updateFilteredDataAndChart, applySortAndRenderCarList } from './main.js';


export function renderFilterPanel() {
  const panel = document.getElementById("filter-panel");
  panel.innerHTML = ""; // Clear previous

  const title = document.createElement("div");
  title.id = "filter-panel-title";
  title.textContent = "Filters";
  panel.appendChild(title);

  const content = document.createElement("div");
  content.className = "filter-content";

  const dropdowns = document.createElement("div");
  dropdowns.className = "filter-dropdowns";

  // Damage type
  const damageLabel = document.createElement("label");
  damageLabel.textContent = "Damage";
  const damageSelect = document.createElement("select");
  damageSelect.innerHTML = `<option value="All">All</option>` +
    filterOptions.damage.map(d => `<option value="${d}">${d}</option>`).join("");
  damageSelect.value = currentFilters.damage;
  damageSelect.onchange = e => {
    setCurrentFilters({ ...currentFilters, damage: e.target.value });
    updateFilteredDataAndChart();
  };
  dropdowns.appendChild(damageLabel);
  dropdowns.appendChild(damageSelect);

  // Status
  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Status";
  const statusSelect = document.createElement("select");
  statusSelect.innerHTML = `<option value="All">All</option>` +
    filterOptions.status.map(s => `<option value="${s}">${s}</option>`).join("");
  statusSelect.value = currentFilters.status;
  statusSelect.onchange = e => {
    setCurrentFilters({ ...currentFilters, status: e.target.value });
    updateFilteredDataAndChart();
  };
  dropdowns.appendChild(statusLabel);
  dropdowns.appendChild(statusSelect);

  const sliders = document.createElement("div");
  sliders.className = "filter-sliders";

  // Min Price Slider
  const minSliderGroup = document.createElement("div");
  minSliderGroup.className = "slider-group";
  const minPriceLabelEl = document.createElement("label"); // Renamed to avoid conflict
  minPriceLabelEl.textContent = "Minimum Price";
  minSliderGroup.appendChild(minPriceLabelEl);

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

  const maxSlider = document.createElement("input"); // Define maxSlider before using in minSlider.oninput

  minSlider.oninput = function() {
    const newMinPrice = parseInt(minSlider.value);
    const currentMaxPrice = parseInt(maxSlider.value); // Get current maxSlider value
    if (newMinPrice > currentMaxPrice) {
      minSlider.value = currentMaxPrice; // Adjust if over max
    }
    setCurrentFilters({ ...currentFilters, minPrice: parseInt(minSlider.value) });
    document.getElementById("minPriceLabel").textContent = currentFilters.minPrice;
  };
  minSlider.onchange = function() { // Final update on release
    setCurrentFilters({ ...currentFilters, minPrice: parseInt(minSlider.value) });
    updateFilteredDataAndChart();
  };
  minSliderGroup.appendChild(minSlider);

  // Max Price Slider
  const maxSliderGroup = document.createElement("div");
  maxSliderGroup.className = "slider-group";
  const maxPriceLabelEl = document.createElement("label"); // Renamed
  maxPriceLabelEl.textContent = "Maximum Price";
  maxSliderGroup.appendChild(maxPriceLabelEl);

  const maxSliderLabels = document.createElement("div");
  maxSliderLabels.className = "slider-labels";
  maxSliderLabels.innerHTML = `<span>$<span id="maxPriceLabel">${currentFilters.maxPrice}</span></span>`;
  maxSliderGroup.appendChild(maxSliderLabels);

  // maxSlider was defined above
  maxSlider.type = "range";
  maxSlider.min = filterOptions.price.min;
  maxSlider.max = filterOptions.price.max;
  maxSlider.step = 100;
  maxSlider.value = currentFilters.maxPrice;
  maxSlider.oninput = function() {
    const newMaxPrice = parseInt(maxSlider.value);
    const currentMinPrice = parseInt(minSlider.value); // Get current minSlider value
    if (newMaxPrice < currentMinPrice) {
      maxSlider.value = currentMinPrice; // Adjust if under min
    }
    setCurrentFilters({ ...currentFilters, maxPrice: parseInt(maxSlider.value) });
    document.getElementById("maxPriceLabel").textContent = currentFilters.maxPrice;
  };
  maxSlider.onchange = function() { // Final update on release
    setCurrentFilters({ ...currentFilters, maxPrice: parseInt(maxSlider.value) });
    updateFilteredDataAndChart();
  };
  maxSliderGroup.appendChild(maxSlider);


  sliders.appendChild(minSliderGroup);
  sliders.appendChild(maxSliderGroup);

  content.appendChild(dropdowns);
  content.appendChild(sliders);
  panel.appendChild(content);
  panel.style.display = ""; // Show the panel
}


export function renderSortPanel() {
  const sortPanel = document.getElementById('sort-panel');
  sortPanel.innerHTML = '';

  if (!selectedYear || !currentCarList || !currentCarList.length) {
    sortPanel.style.display = 'none';
    return;
  }

  const sortByLabel = document.createElement('label');
  sortByLabel.textContent = "Sort by";
  sortByLabel.setAttribute('for', 'sort-by');
  const sortBySelect = document.createElement('select');
  sortBySelect.id = 'sort-by';
  sortBySelect.innerHTML = `
    <option value="price">Price</option>
    <option value="miles">Miles</option>
    <option value="auctionDate">Auction Date</option>
  `;
  sortBySelect.value = currentSort.by;

  const orderLabel = document.createElement('label');
  orderLabel.textContent = "Order";
  orderLabel.setAttribute('for', 'sort-order');
  const orderSelect = document.createElement('select');
  orderSelect.id = 'sort-order';
  orderSelect.innerHTML = `
    <option value="asc">Ascending</option>
    <option value="desc">Descending</option>
  `;
  orderSelect.value = currentSort.order;

  const applyBtn = document.createElement('button');
  applyBtn.textContent = "Apply";
  applyBtn.onclick = function() {
    setCurrentSort({ by: sortBySelect.value, order: orderSelect.value });
    // This function will be in main.js and handle sorting and re-rendering the list
    applySortAndRenderCarList();
  };

  sortPanel.appendChild(sortByLabel);
  sortPanel.appendChild(sortBySelect);
  sortPanel.appendChild(orderLabel);
  sortPanel.appendChild(orderSelect);
  sortPanel.appendChild(applyBtn);
  sortPanel.style.display = 'flex'; // Make it visible
}


export function showCarList(yearToList, cars) {
  const listDiv = document.getElementById('car-list');
  setCurrentCarList(cars || []); // Update state

  renderSortPanel(); // Show/hide sort panel based on new car list

  if (!yearToList) {
    listDiv.innerHTML = `<div class="hint">Select a year in the graph to show a list of vehicles.</div>`;
    return;
  }
  if (!cars || !cars.length) {
    listDiv.innerHTML = `<div class="hint">No cars found for year ${yearToList} with current filters.</div>`;
    return;
  }
  // Sorting is now handled by applySortAndRenderCarList in main.js before calling this
  // or this function is called with already sorted cars.
  // For simplicity, let's assume `cars` are already sorted when this is called by `applySortAndRenderCarList`.

  let html = `<h2 style="margin-bottom:1rem;color:#fafafa;">${yearToList} - ${cars.length} cars</h2>`;
  html += cars.map(car => `
    <div class="car-item" onclick="window.open('${car.url}', '_blank')">
      <img class="car-img" src="${car.imageUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" alt="${car.make} ${car.model}" loading="lazy" onerror="this.style.display='none'"/>
      <div class="car-details">
        <div class="car-value car-price">$${car.price ? car.price.toLocaleString() : 'N/A'}</div>
        <div class="car-value">${car.miles ? car.miles.toLocaleString() + ' mi' : 'N/A'}</div>
        <div class="car-value">${car.damage || 'N/A'}</div>
        <div class="car-value">${car.status || 'N/A'}</div>
        <div class="car-value">${car.location || 'N/A'}</div>
        <div class="car-value"><span class="car-vin">${car.vin || 'N/A'}</span></div>
        <div class="car-value">${car.auctionDate || 'N/A'}</div>
        <div></div> <!-- Placeholder for grid balance -->
      </div>
    </div>
  `).join('');
  listDiv.innerHTML = html;
}

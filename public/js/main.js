// public/js/main.js
import {
  carData,
  selectedYear,
  yearMap,
  filterOptions,
  currentFilters,
  currentSort,
  currentCarList,
  setCarData,
  setSelectedYear,
  setYearMap,
  setFilterOptions,
  setCurrentFilters,
  setCurrentSort,
  setCurrentCarList,
} from './state.js';
import { groupByYear, getUnique, getPriceRange, parseAuctionDate } from './utils.js';
import { fetchAuctionDataFromProxy, adaptApiCar } from './apiService.js';
import { renderChart, updateBarColors } from './chartService.js';
import { renderFilterPanel, renderSortPanel, showCarList } from './uiService.js';

// DOM Elements
const searchForm = document.getElementById('search-form');
const makeInput = document.getElementById('make-input');
const modelInput = document.getElementById('model-input');
const yearFromInput = document.getElementById('year-from-input');
const yearToInput = document.getElementById('year-to-input');
const carListDiv = document.getElementById('car-list');
const filterPanelDiv = document.getElementById('filter-panel');
const chartContainerDiv = document.getElementById('chart-container');
const sortPanelDiv = document.getElementById('sort-panel');


function applyFilters(dataToFilter) {
  return dataToFilter.filter(car => {
    if (currentFilters.damage !== "All" && car.damage !== currentFilters.damage) return false;
    if (currentFilters.status !== "All" && car.status !== currentFilters.status) return false;
    let price = typeof car.price === "number" ? car.price : 0;
    if (price < currentFilters.minPrice || price > currentFilters.maxPrice) return false;
    return true;
  });
}

function sortCars(carsToSort) {
  const by = currentSort.by;
  const order = currentSort.order;
  return [...carsToSort].sort((a, b) => {
    let aVal, bVal;
    if (by === "price") {
      aVal = typeof a.price === "number" ? a.price : 0;
      bVal = typeof b.price === "number" ? b.price : 0;
    } else if (by === "miles") {
      aVal = typeof a.miles === "number" ? a.miles : 0;
      bVal = typeof b.miles === "number" ? b.miles : 0;
    } else if (by === "auctionDate") {
      aVal = parseAuctionDate(a.auctionDate);
      bVal = parseAuctionDate(b.auctionDate);
    } else {
      return 0; // Should not happen
    }

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
}

// This function is called by UI elements when filters change
export function updateFilteredDataAndChart() {
  const filteredData = applyFilters(carData);
  const newYearMap = groupByYear(filteredData);
  setYearMap(newYearMap);

  if (selectedYear && !newYearMap[selectedYear]) {
    setSelectedYear(null); // Clear selection if year no longer exists with filters
  }

  renderChart(newYearMap); // Render chart with newly filtered & grouped data

  if (selectedYear) {
    // If a year is selected, filter its cars and show them
    const carsForSelectedYear = newYearMap[selectedYear] || [];
    const sortedCars = sortCars(carsForSelectedYear);
    showCarList(selectedYear, sortedCars);
  } else {
    // If no year is selected (or selection cleared), show empty list / hint
    showCarList(null, []);
  }
}


// This function is called by UI elements when sort options change
export function applySortAndRenderCarList() {
  if (selectedYear && yearMap[selectedYear]) {
    const carsToDisplay = yearMap[selectedYear] || []; // Get cars for the selected year from the current yearMap
    const filteredCarsForYear = applyFilters(carsToDisplay); // Apply current filters to this specific year's cars
    const sortedCars = sortCars(filteredCarsForYear);
    showCarList(selectedYear, sortedCars); // Render the sorted list
  } else {
    showCarList(selectedYear, []); // Or show empty if no year/cars
  }
}


async function handleSearchFormSubmit(event) {
  event.preventDefault();
  filterPanelDiv.style.display = 'none';
  chartContainerDiv.style.display = 'none';
  sortPanelDiv.style.display = 'none';
  carListDiv.innerHTML = `<div class="hint">Loading results...</div>`;
  setSelectedYear(null); // Reset selected year on new search

  const make = makeInput.value.trim();
  const model = modelInput.value.trim();
  const yearFrom = yearFromInput.value.trim();
  const yearTo = yearToInput.value.trim();

  if (!make || !model || !yearFrom || !yearTo) {
    alert("Please fill in all search fields.");
    carListDiv.innerHTML = `<div class="hint">Please fill in all search fields and try again.</div>`;
    return;
  }

  const rawApiCars = await fetchAuctionDataFromProxy(make, model, yearFrom, yearTo);

  if (!rawApiCars || rawApiCars.length === 0) {
    carListDiv.innerHTML = `<div class="hint">No results found for your search.</div>`;
    setCarData([]);
    setYearMap({});
    // Optionally clear filter options or set to default
    setFilterOptions({ damage: [], status: [], price: { min: 0, max: 0 } });
    setCurrentFilters({ damage: "All", status: "All", minPrice: 0, maxPrice: 0 });
    renderFilterPanel(); // Render empty/default filter panel
    return;
  }

  const adaptedCars = rawApiCars.map(adaptApiCar);
  setCarData(adaptedCars);

  // Initialize filter options based on the new dataset
  const newFilterOptions = {
    damage: getUnique(adaptedCars, "damage"),
    status: getUnique(adaptedCars, "status"),
    price: getPriceRange(adaptedCars)
  };
  setFilterOptions(newFilterOptions);

  // Reset filters to default but use new price range
  setCurrentFilters({
    damage: "All",
    status: "All",
    minPrice: newFilterOptions.price.min,
    maxPrice: newFilterOptions.price.max
  });

  renderFilterPanel(); // Render with new options and reset values
  updateFilteredDataAndChart(); // Initial chart and list render
}

// Initial setup
searchForm.addEventListener('submit', handleSearchFormSubmit);

// Initialize with a clear state
carListDiv.innerHTML = `<div class="hint">Enter search criteria above and click "Search".</div>`;

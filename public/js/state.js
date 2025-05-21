// public/js/state.js
export let carData = [];
export let chart = null; // This will hold the Chart.js instance
export let selectedYear = null;
export let yearMap = {}; // Result of groupByYear
export let filterOptions = {
  damage: [],
  status: [],
  price: { min: 0, max: 0 }
};
export let currentFilters = {
  damage: "All",
  status: "All",
  minPrice: 0,
  maxPrice: 0
};
export let currentSort = {
  by: "price",
  order: "asc"
};
export let currentCarList = []; // Cars currently displayed in the list for the selected year

// Bar colors
export const defaultBarColor = "#818cf8";
export const selectedBarColor = "#34d399";
export const hoverBarColor = "#fbbf24";

// Functions to update state (makes it cleaner if state becomes complex)
export function setCarData(data) {
  carData = data;
}
export function setChartInstance(instance) {
  chart = instance;
}
export function setSelectedYear(year) {
  selectedYear = year;
}
export function setYearMap(map) {
  yearMap = map;
}
export function setFilterOptions(options) {
  filterOptions = { ...filterOptions, ...options };
}
export function setCurrentFilters(filters) {
  currentFilters = { ...currentFilters, ...filters };
}
export function setCurrentSort(sort) {
  currentSort = { ...currentSort, ...sort };
}
export function setCurrentCarList(list) {
  currentCarList = list;
}

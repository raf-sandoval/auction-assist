// public/js/utils.js
export function groupByYear(data) {
  const map = {};
  data.forEach(car => {
    if (!map[car.year]) map[car.year] = [];
    map[car.year].push(car);
  });
  return map;
}

export function average(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((sum, c) => sum + (c.price || 0), 0) / arr.length;
}

export function getUnique(arr, key) {
  const set = new Set();
  arr.forEach(item => {
    if (item[key] && item[key] !== "N/A") set.add(item[key]);
  });
  return Array.from(set).sort();
}

export function getPriceRange(arr) {
  let min = Infinity, max = 0;
  arr.forEach(car => {
    if (typeof car.price === "number" && car.price > 0) {
      if (car.price < min) min = car.price;
      if (car.price > max) max = car.price;
    }
  });
  if (!isFinite(min)) min = 0;
  max = Math.ceil(max / 500) * 500; // Round up max to nearest 500
  return { min: 0, max: max };
}

export function parseAuctionDate(dateStr) {
  if (!dateStr) return 0;
  const months = {
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12"
  };
  const m = dateStr.match(/(\d{1,2}) (\w+) (\d{4})/);
  if (!m) return 0;
  const [_, d, mon, y] = m;
  return parseInt(`${y}${months[mon] || "01"}${d.padStart(2, "0")}`);
}

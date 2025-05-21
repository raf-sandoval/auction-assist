// public/js/apiService.js
export async function fetchAuctionDataFromProxy(
  make,
  model,
  yearFrom,
  yearTo,
  maxPages = 20,
) {
  let allCars = [];
  let page = 1;
  let totalPagesFromAPI = maxPages; // Initial assumption
  let lastPageReached = false;

  while (page <= totalPagesFromAPI && !lastPageReached && page <= maxPages) {
    // Use relative path for Cloudflare Pages Function
    const proxyUrl = `/api/search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${yearFrom}&year-to=${yearTo}&page=${page}`;
    try {
      const resp = await fetch(proxyUrl);
      if (!resp.ok) {
        console.error(
          `API Proxy error for page ${page}: ${resp.status} ${resp.statusText}`,
        );
        const errorBody = await resp.text();
        console.error("Error body:", errorBody);
        // Optionally, break or try next page with caution
        if (page === 1 && (resp.status === 404 || resp.status === 500)) {
          // If first page fails critically, stop
          throw new Error(
            `Critical API proxy error on first page: ${resp.status}`,
          );
        }
        // For other errors, maybe try to continue or log and break
        break;
      }
      const data = await resp.json();

      if (page === 1 && data.pagination && data.pagination.totalPages) {
        totalPagesFromAPI = data.pagination.totalPages;
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        allCars = allCars.concat(data.items);
      } else {
        lastPageReached = true; // No items or not an array means end of data for this query
      }
    } catch (err) {
      console.error(
        "Error fetching data via proxy for page " + page + ":",
        err,
      );
      // Decide if you want to stop all fetching or just skip this page
      // For simplicity, we'll break here.
      alert("Error fetching data from API. Check console for details.");
      break;
    }
    page++;
  }
  return allCars;
}

export function adaptApiCar(apiCar) {
  return {
    vin: apiCar.vin || "",
    year: apiCar.year || "", // Ensure year is present
    make: apiCar.make || "",
    model: apiCar.model || "",
    price: typeof apiCar.price === "number" ? apiCar.price : 0,
    miles: typeof apiCar.mileage === "number" ? apiCar.mileage : 0, // API uses mileage
    damage: apiCar.damage || "",
    status: apiCar.status || "",
    location: apiCar.location || "",
    auctionDate: apiCar.auctionDate || "",
    imageUrl: apiCar.image || "", // API uses image
    url: apiCar.url || "",
  };
}

// functions/api/search.js

// We expect query parameters like: make, model, year-from, year-to, page
export async function onRequestGet(context) {
  // context.request.url gives the full URL
  const url = new URL(context.request.url);
  const { searchParams } = url;

  const make = searchParams.get('make');
  const model = searchParams.get('model');
  const yearFrom = searchParams.get('year-from');
  const yearTo = searchParams.get('year-to');
  const page = searchParams.get('page') || '1'; // Default to page 1

  if (!make || !model || !yearFrom || !yearTo) {
    return new Response(JSON.stringify({ error: 'Missing required search parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const bidCarsApiUrl = `https://bid.cars/app/search/archived/request?search-type=filters&status=All&type=Automobile&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${yearFrom}&year-to=${yearTo}&auction-type=All&transmission=Manual&page=${page}`;

  try {
    const apiResponse = await fetch(bidCarsApiUrl, {
      // It's good practice to pass through some headers if the target API might need them,
      // but for this public API, it's likely not necessary.
      // headers: { 'User-Agent': 'Cloudflare-Worker-Proxy/1.0' }
    });

    if (!apiResponse.ok) {
      // Forward the status and try to get the error message from bid.cars
      const errorBody = await apiResponse.text();
      console.error(`Bid.cars API error: ${apiResponse.status}`, errorBody);
      return new Response(JSON.stringify({ error: `Failed to fetch from upstream API: ${apiResponse.status}`, details: errorBody }), {
        status: apiResponse.status, // Forward the status
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await apiResponse.json();

    // Important: Set CORS headers for your frontend to be able to call this function
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Allow any origin, or restrict to your Pages domain in production
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return new Response(JSON.stringify(data), { headers });

  } catch (error) {
    console.error('Error in Cloudflare Function proxy:', error);
    return new Response(JSON.stringify({ error: 'Proxy function failed', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

// Optional: Handle OPTIONS requests for CORS preflight
export async function onRequestOptions(context) {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}

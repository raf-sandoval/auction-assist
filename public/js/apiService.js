// functions/api/search.js

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const { searchParams } = url;

  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const yearFrom = searchParams.get("year-from");
  const yearTo = searchParams.get("year-to");
  const page = searchParams.get("page") || "1";

  if (!make || !model || !yearFrom || !yearTo) {
    return new Response(
      JSON.stringify({ error: "Missing required search parameters" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const bidCarsApiUrl = `https://bid.cars/app/search/archived/request?search-type=filters&status=All&type=Automobile&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year-from=${yearFrom}&year-to=${yearTo}&auction-type=All&transmission=Manual&page=${page}`;

  try {
    // Define headers for the outgoing request to bid.cars
    const requestHeadersToBidCars = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      // You can also try adding 'Accept' if User-Agent alone doesn't work
      // 'Accept': 'application/json, text/plain, */*'
    };

    const apiResponse = await fetch(bidCarsApiUrl, {
      headers: requestHeadersToBidCars, // Pass the defined headers
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(
        `Bid.cars API error: ${apiResponse.status} ${apiResponse.statusText}`,
        errorBody,
      );
      return new Response(
        JSON.stringify({
          error: `Failed to fetch from upstream API: ${apiResponse.status}`,
          details: errorBody,
        }),
        {
          status: apiResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const data = await apiResponse.json();

    const responseHeadersToClient = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    return new Response(JSON.stringify(data), {
      headers: responseHeadersToClient,
    });
  } catch (error) {
    console.error("Error in Cloudflare Function proxy:", error);
    return new Response(
      JSON.stringify({
        error: "Proxy function failed",
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

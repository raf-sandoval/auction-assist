export async function onRequestGet(context) {
  const { env } = context;

  // If today’s FX is already in KV, return it.
  const cached = await env.DATA.get("fx:usd_hnl", "json");
  const today = new Date().toISOString().slice(0, 10);
  if (cached && cached.date === today) {
    return json(cached);
  }

  // Refresh from source (prefer JSON instead of XML to avoid DOMParser)
  const url =
    "https://www.cors-anywhere.com/www.bch.hn/_api/web/lists('08a9876c-c6f1-4e73-8d13-0039b0442fab')/items?$select=Title,Fecha,Observacion,Valor&$top=1&$orderby=Fecha%20desc";

  // Ask for JSON response to avoid XML parsing server-side
  const res = await fetch(url, {
    headers: { Accept: "application/json;odata=verbose" },
  });

  let value = null;
  if (res.ok) {
    const data = await res.json();
    value = parseFloat(data?.d?.results?.[0]?.Valor);
  }

  // Fallback: keep existing cached if source unavailable
  if (!value || Number.isNaN(value)) {
    if (cached) return json(cached);
    // As last resort return 1 to avoid explosions in UI
    return json({ value: 1, date: today, stale: true });
  }

  const payload = { value, date: today };
  await env.DATA.put("fx:usd_hnl", JSON.stringify(payload));
  return json(payload);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

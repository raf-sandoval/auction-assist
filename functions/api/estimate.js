export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const input = await request.json();

    // Validate required inputs
    const errors = [];
    const year = Number(input.year);
    const price = Number(input.price);
    const rawLocation = String(input.location || "");
    const platform = String(input.platform || "").toLowerCase();
    const vin = String(input.vin || "");
    const engineSize =
      input.engineSize === undefined || input.engineSize === null
        ? undefined
        : Number(input.engineSize);

    if (!year || Number.isNaN(year)) errors.push("year is required");
    if (!price || Number.isNaN(price)) errors.push("price is required");
    if (!rawLocation) errors.push("location is required");
    if (!platform || !["copart", "iaai"].includes(platform))
      errors.push("platform must be 'copart' or 'iaai'");
    if (!vin) errors.push("vin is required");

    if (errors.length) {
      return json({ ok: false, errors }, 400);
    }

    // Load KV blobs
    const [
      feesImport,
      fxBlob,
      portsBlob,
      locationsBlob,
      // If later you want auction fees too:
      // copartFees, iaaiFees
    ] = await Promise.all([
      env.DATA.get("fees:import", "json"),
      env.DATA.get("fx:usd_hnl", "json"),
      env.DATA.get("ports", "json"),
      env.DATA.get(`locations:${platform}`, "json"),
      // env.DATA.get("fees:copart", "json"),
      // env.DATA.get("fees:iaai", "json"),
    ]);

    if (!feesImport || !portsBlob || !locationsBlob || !fxBlob) {
      return json(
        {
          ok: false,
          error:
            "Missing KV data. Ensure fees:import, fx:usd_hnl, ports, and locations:* are populated.",
        },
        500,
      );
    }

    const fx = Number(fxBlob.value);
    const fxAsOf = fxBlob.date;

    // Normalize and match location
    const locMatch = findLocation(locationsBlob, rawLocation);
    if (!locMatch) {
      return json(
        {
          ok: false,
          error: `Location not found for '${rawLocation}' on platform '${platform}'.`,
          hint: "Pass city and state abbreviation like 'Anaheim Co... (CA)', 'Phoenix (AZ)'.",
        },
        404,
      );
    }

    // Build per-port options from the location's shipping_cost array
    const gruaOptions = (locMatch.shipping_cost || []).map((s) => {
      const canonical = canonicalPort(s.port);
      return {
        portInput: s.port,
        port: canonical,
        gruaUSD: Number(s.price),
        gruaLps: round2(Number(s.price) * fx),
      };
    });

    // Seguro (insurance) is 1.5% of vehicle price
    const seguroUSD = round2(price * 0.015);
    const seguroLps = round2(seguroUSD * fx);
    const compradorIndirectoUSD = 50;
    const compradorIndirectoLps = round2(50 * fx);

    // VIN CAFTA logic
    const withCafta = /^[1457]/.test(vin.trim());
    const feeBranch = withCafta ? "withCafta" : "withoutCafta";

    // Category by engine size
    const category =
      typeof engineSize === "number" && engineSize > 0 && engineSize <= 1.5
        ? "smallEngine_1_5lOrLess"
        : "turismoCamioneta";

    // Pre-index ports by name for quick lookup
    const portIndex = indexPorts(portsBlob);

    // For each candidate port, compute breakdowns for all vehicle types
    const perPort = [];
    for (const g of gruaOptions) {
      const port = portIndex[g.port];
      if (!port) {
        // If a location references a port you don't have rates for, skip it
        continue;
      }

      const leadWeeks = {
        min: port.lead_weeks_min || null,
        max: port.lead_weeks_max || null,
      };

      const vehicleTypeQuotes = [];
      const rates = port.shipping_rates || {};
      for (const [vehType, fleteUSDraw] of Object.entries(rates)) {
        const fleteUSD = Number(fleteUSDraw);
        const fleteLps = round2(fleteUSD * fx);

        // CIF for this (port, vehicle type)
        const cifUSD = round2(
          price + g.gruaUSD + fleteUSD + seguroUSD + compradorIndirectoUSD,
        );
        const cifLps = round2(cifUSD * fx);

        // DAI / SC from CIF bracket
        const { daiPct, scPct } = findDaiAndSc(
          feesImport,
          feeBranch,
          category,
          cifUSD,
        );

        const daiUSD = round2((daiPct / 100) * cifUSD);
        const scUSD = round2((scPct / 100) * (cifUSD + daiUSD));
        const daiLps = round2(daiUSD * fx);
        const scLps = round2(scUSD * fx);

        const isvUSD = round2((cifUSD + daiUSD + scUSD) * 0.15);
        const isvLps = round2((cifLps + daiLps + scLps) * 0.15);

        // Ecotasa (Lempiras) by CIF
        const ecoLps = findEcoTaxLps(feesImport, cifUSD);
        const ecoUSD = round2(ecoLps / fx);

        // Fixed Lempiras fees (both Lps & converted USD)
        const feesLps = fixedLempiraFees();
        const feesUSD = {
          servicioDatos: round2(feesLps.servicioDatos / fx),
          dva: round2(feesLps.dva / fx),
          almacenaje: round2(feesLps.almacenaje / fx),
          tramiteAduanero: round2(feesLps.tramiteAduanero / fx),
          tramitePlacas: round2(feesLps.tramitePlacas / fx),
        };

        // Matricula IP (USD): 3% of CIF + 800
        const matriculaLps = round2(0.03 * cifUSD * fx + 800);
        const matriculaUSD = round2(matriculaLps / fx);

        // Bank transfer + commission (USD)
        const transferenciaUSD = 71;
        const comisionUSD = 300;
        const transferenciaLps = round2(transferenciaUSD * fx);
        const comisionLps = round2(comisionUSD * fx);

        // Build totals
        const componentsUSD = {
          price,
          grua: g.gruaUSD,
          flete: fleteUSD,
          seguro: seguroUSD,
          compradorIndirecto: compradorIndirectoUSD,
          cif: cifUSD,
          dai: daiUSD,
          sc: scUSD,
          isv: isvUSD,
          ecotasa: ecoUSD,
          servicioDatos: feesUSD.servicioDatos,
          dva: feesUSD.dva,
          almacenaje: feesUSD.almacenaje,
          tramiteAduanero: feesUSD.tramiteAduanero,
          tramitePlacas: feesUSD.tramitePlacas,
          matriculaIP: matriculaUSD,
          transferenciaInternacional: transferenciaUSD,
          comision: comisionUSD,
        };

        const componentsLps = {
          price: round2(price * fx),
          grua: g.gruaLps,
          flete: fleteLps,
          seguro: seguroLps,
          compradorIndirecto: compradorIndirectoLps,
          cif: cifLps,
          dai: daiLps,
          sc: scLps,
          isv: isvLps,
          ecotasa: ecoLps,
          servicioDatos: feesLps.servicioDatos,
          dva: feesLps.dva,
          almacenaje: feesLps.almacenaje,
          tramiteAduanero: feesLps.tramiteAduanero,
          tramitePlacas: feesLps.tramitePlacas,
          matriculaIP: matriculaLps,
          transferenciaInternacional: transferenciaLps,
          comision: comisionLps,
        };

        // Grouped totals
        const TAX_KEYS = ["dai", "sc", "isv", "servicioDatos", "ecotasa"];
        const DUTY_KEYS = [
          "almacenaje",
          "tramiteAduanero",
          "tramitePlacas",
          "dva",
          "matriculaIP",
        ];
        const OTHER_KEYS = ["transferenciaInternacional", "comision"];

        const taxesUSD = sumGroup(componentsUSD, TAX_KEYS);
        const dutiesUSD = sumGroup(componentsUSD, DUTY_KEYS);
        const otherUSD = sumGroup(componentsUSD, OTHER_KEYS);

        const taxesLps = sumGroup(componentsLps, TAX_KEYS);
        const dutiesLps = sumGroup(componentsLps, DUTY_KEYS);
        const otherLps = sumGroup(componentsLps, OTHER_KEYS);

        vehicleTypeQuotes.push({
          vehicleType: vehType,
          leadWeeks,
          fleteUSD,
          fleteLps,
          cifUSD,
          cifLps,
          daiPct,
          scPct,
          breakdown: {
            usd: componentsUSD,
            lps: componentsLps,
          },
          totals: {
            usd: {
              taxes: taxesUSD,
              duties: dutiesUSD,
              otherFees: otherUSD,
              total: taxesUSD + dutiesUSD + otherUSD,
            },
            lps: {
              taxes: taxesLps,
              duties: dutiesLps,
              otherFees: otherLps,
              total: taxesLps + dutiesLps + otherLps,
            },
          },
        });
      }

      perPort.push({
        port: g.port,
        leadWeeks,
        gruaUSD: g.gruaUSD,
        gruaLps: g.gruaLps,
        vehicleTypeQuotes,
      });
    }

    return json({
      ok: true,
      asOfFxDate: fxAsOf,
      input: {
        year,
        price,
        location: rawLocation,
        platform,
        vin,
        engineSize: isFinite(engineSize) ? engineSize : null,
        withCafta,
        category,
      },
      fx,
      matchedLocation: {
        title: locMatch.title,
        state: locMatch.state,
        coordinates: locMatch.coordinates || null,
      },
      results: perPort,
    });
  } catch (err) {
    return json(
      { ok: false, error: String(err?.message || err || "Unknown error") },
      500,
    );
  }
}

/* -------------------------- helpers -------------------------- */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function extractCityState(input) {
  // Examples:
  // 'Corpus Chr... (TX)' => city='corpus chr', state='tx'
  // 'Anaheim Co...' => city='anaheim co', state=null
  const s = String(input || "")
    .replace(/\u2026/g, "...") // normalize ellipsis character
    .trim();
  const m = s.match(/\(([^)]+)\)\s*$/);
  const state = m ? m[1].trim().toLowerCase() : null;
  const cityPart = s.replace(/\(([^)]+)\)\s*$/, "").trim();
  const city = cityPart
    .replace(/\.\.\.$/, "")
    .trim()
    .toLowerCase();
  return { city, state };
}

function normalizeTitleCityState(title) {
  // From 'Dallas (TX)' => {city:'dallas', state:'tx'}
  const m = String(title || "").match(/^(.*)\(([^)]+)\)\s*$/);
  if (!m) {
    return {
      city: String(title || "")
        .toLowerCase()
        .trim(),
      state: null,
    };
  }
  return {
    city: m[1].trim().toLowerCase(),
    state: m[2].trim().toLowerCase(),
  };
}

function findLocation(list, rawInput) {
  if (!Array.isArray(list)) return null;
  const { city: qCity, state: qState } = extractCityState(rawInput);

  // First pass: exact state match + city startsWith
  const pass1 = list.find((loc) => {
    const t = normalizeTitleCityState(loc.title);
    const stateOk = qState ? t.state === qState : true;
    const cityOk =
      !qCity || t.city.startsWith(qCity) || qCity.startsWith(t.city);
    return stateOk && cityOk;
  });
  if (pass1) return pass1;

  // Second pass: city contains
  const pass2 = list.find((loc) => {
    const t = normalizeTitleCityState(loc.title);
    return (
      t.city.includes(qCity) ||
      qCity.includes(t.city) ||
      String(loc.state || "").toLowerCase() === (qState || "")
    );
  });
  return pass2 || null;
}

function canonicalPort(name) {
  const s = String(name || "").toLowerCase();
  if (s.includes("everglades")) return "Port Everglades";
  if (s.includes("freeport")) return "Freeport (Houston)";
  if (s.includes("wilmington")) return "Port of Wilmington";
  return name;
}

function indexPorts(portsArr) {
  const idx = {};
  for (const p of portsArr || []) {
    idx[p.port] = p;
  }
  return idx;
}

function findDaiAndSc(feesImport, branch, category, cifUSD) {
  const ranges = feesImport?.[branch]?.[category] || [];
  for (const r of ranges) {
    if (cifUSD >= r.min && cifUSD <= r.max) {
      return { daiPct: Number(r.dai), scPct: Number(r.sc) };
    }
  }
  // Default fallback if not found
  return { daiPct: 0, scPct: 0 };
}

function findEcoTaxLps(feesImport, cifUSD) {
  const rs = feesImport?.ecoTaxLps || [];
  const hit = rs.find((r) => cifUSD >= r.min && cifUSD <= r.max);
  return hit ? Number(hit.amount) : 0;
}

function fixedLempiraFees() {
  return {
    servicioDatos: 124,
    dva: 124,
    almacenaje: 6250,
    tramiteAduanero: 3250,
    tramitePlacas: 500,
  };
}

function sumGroup(source, keys) {
  return keys.reduce((sum, k) => sum + Number(source[k] || 0), 0);
}

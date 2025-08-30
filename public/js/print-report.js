// /public/js/print-report.js
(function () {
  const API_URL = "/api/estimate";
  const MAX_SELECT = 5;

  // Natural language → API vehicleType keys (same as estimate-ui)
  const VEHICLE_OPTIONS = [
    { key: "small_cars", label: "Auto pequeño (sedán / hatchback)" },
    { key: "large_cars", label: "Auto grande (sedán grande)" },
    { key: "luxury_sedans", label: "Sedán de lujo" },
    { key: "motorcycles", label: "Motocicleta" },
    { key: "regular_suvs", label: "SUV mediano" },
    { key: "large_suvs", label: "SUV grande" },
    { key: "xl_suvs", label: "SUV XL" },
    { key: "single_cab_trucks", label: "Pickup cabina sencilla" },
    {
      key: "regular_cab_half_trucks",
      label: "Pickup 1/2 tonelada (cabina regular)",
    },
    { key: "high_cab_double_trucks", label: "Camión cabina alta doble" },
    { key: "extra_large_trucks", label: "Camión extra grande" },
  ];

  let fileToken = null;
  let selectedVins = new Set();

  // Preflight choices kept for the current file
  const preflightDefaults = {
    vehicleType: "small_cars",
    platformDefault: "copart",
    engineSize: "", // optional
  };

  // Inject Print button next to graphs header title
  function ensurePrintButton() {
    const header = document.querySelector(".graphs-header");
    if (!header || header.querySelector(".print-btn")) return;
    const btn = document.createElement("button");
    btn.className = "print-btn";
    btn.title = "Imprimir reporte";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 9V3h12v6h2a2 2 0 0 1 2 2v5h-4v5H8v-5H4v-5a2 2 0 0 1 2-2h0zm2-4v4h8V5H8zm8 12H8v3h8v-3zm-9-5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H7z"/>
      </svg>
      Imprimir reporte <span id="print-count" style="font-weight:700;margin-left:6px;">(0)</span>
    `;
    btn.onclick = onPrintClicked;
    header.appendChild(btn);
  }

  // Selection chip for each card
  function attachChips(cars) {
    const nodes = document.querySelectorAll(".car-item");
    nodes.forEach((card) => {
      const vin = card.getAttribute("data-vin") || "";
      if (!vin) return;
      let chip = card.querySelector(".report-chip");
      if (!chip) {
        chip = document.createElement("div");
        chip.className = "report-chip";
        chip.textContent = "Reporte";
        chip.onclick = (e) => {
          e.stopPropagation();
          toggleSelection(vin, chip);
        };
        card.appendChild(chip);
      }
      if (selectedVins.has(vin)) chip.classList.add("selected");
      else chip.classList.remove("selected");
    });
    updateCount();
  }

  function toggleSelection(vin, chip) {
    if (selectedVins.has(vin)) {
      selectedVins.delete(vin);
    } else {
      if (selectedVins.size >= MAX_SELECT) {
        alert(
          `Solo puedes seleccionar hasta ${MAX_SELECT} vehículos para el reporte.`,
        );
        return;
      }
      selectedVins.add(vin);
    }
    if (chip) chip.classList.toggle("selected");
    updateCount();
  }

  function updateCount() {
    const span = document.getElementById("print-count");
    if (span) span.textContent = `(${selectedVins.size})`;
  }

  // PRINT FLOW
  async function onPrintClicked() {
    // 1) Preflight: calculate any missing estimates for selected cars
    await runPreflightIfNeeded();

    // 2) Build the print DOM and print
    ensurePrintRoot();
    const root = document.getElementById("print-root");
    root.innerHTML = "";

    const filtersSummary = buildFiltersSummary();
    const charts = await snapshotCharts();

    // Cover page
    const cover = document.createElement("div");
    cover.className = "print-page";
    cover.innerHTML = `
      <div class="print-h1">Informe de Precios y Costos de Importación</div>
      <div class="print-subtle">${new Date().toLocaleString()}</div>
      <div class="print-section-title">Filtros actuales</div>
      <div class="print-subtle">${filtersSummary}</div>

      <div class="print-section-title">Gráficos</div>
      <div class="print-two-col">
        ${imgOrPlaceholder(charts.bar, "Precios promedio por año")}
        ${imgOrPlaceholder(charts.priceHist, "Histograma de precios")}
      </div>
      <div class="print-two-col" style="margin-top:12px">
        ${imgOrPlaceholder(charts.mileageHist, "Histograma de millaje")}
        ${imgOrPlaceholder(charts.boxPlot, "Precios por tipo de daño")}
      </div>
      <div style="margin-top:12px">
        ${imgOrPlaceholder(charts.avgLine, "Promedio a lo largo del tiempo")}
      </div>
    `;
    root.appendChild(cover);

    // One page per selected car
    const carsByVin = Object.create(null);
    (window.carData || []).forEach((c) => (carsByVin[c.vin] = c));

    for (const vin of selectedVins) {
      const car = carsByVin[vin];
      if (!car) continue;

      const estimateJson = extractEstimateFromCard(vin);
      if (!estimateJson) {
        root.appendChild(buildWarnPage(car));
        continue;
      }
      const page = await buildCarPage(car, estimateJson);
      root.appendChild(page);
    }

    window.print();
  }

  // PREFLIGHT (ask once, calculate for all missing)
  async function runPreflightIfNeeded() {
    const carsByVin = Object.create(null);
    (window.carData || []).forEach((c) => (carsByVin[c.vin] = c));

    const toCalc = [];
    const cannotCalc = [];
    for (const vin of selectedVins) {
      const car = carsByVin[vin];
      if (!car) continue;
      const hasEstimate = !!extractEstimateFromCard(vin);
      const validPrice =
        typeof car.price === "number" && isFinite(car.price) && car.price > 0;
      if (hasEstimate) continue;
      if (!validPrice) {
        cannotCalc.push(car);
        continue;
      }
      toCalc.push(car);
    }

    // If nothing to calculate, we’re done
    if (!toCalc.length) return;

    const { vehicleType, platformDefault, engineSize } =
      await showPreflightModal();

    // Call API for all in parallel (or small batches)
    await Promise.allSettled(
      toCalc.map((car) =>
        callEstimateAPI({
          car,
          vehicleType,
          platformDefault,
          engineSize,
        })
          .then((res) => attachEstimateToCard(car.vin, res))
          .catch(() => {
            // swallow; we'll show a warn page later if still missing
          }),
      ),
    );

    // Note: cars with invalid price are handled later as warning pages
  }

  // Preflight modal (ask once)
  function showPreflightModal() {
    return new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay show";
      const modal = document.createElement("div");
      modal.className = "modal show";

      const card = document.createElement("div");
      card.className = "modal-card";

      const header = document.createElement("div");
      header.className = "modal-header";
      const title = document.createElement("h3");
      title.className = "modal-title";
      title.textContent = "Parámetros para calcular (una vez)";
      const closeBtn = document.createElement("button");
      closeBtn.className = "modal-close";
      closeBtn.textContent = "Cancelar";
      closeBtn.onclick = () => {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
        reject(new Error("cancelled"));
      };
      header.appendChild(title);
      header.appendChild(closeBtn);

      const body = document.createElement("div");
      body.className = "modal-body";
      body.innerHTML = `
        <div class="modal-section">
          <div class="modal-row">
            <div class="modal-field">
              <label for="pf-veh-type">Tamaño del vehículo</label>
              <select id="pf-veh-type">
                ${VEHICLE_OPTIONS.map(
                  (o) =>
                    `<option value="${o.key}" ${
                      o.key === preflightDefaults.vehicleType ? "selected" : ""
                    }>${o.label}</option>`,
                ).join("")}
              </select>
            </div>
            <div class="modal-field">
              <label for="pf-platform">Plataforma por defecto</label>
              <select id="pf-platform">
                <option value="copart" ${
                  preflightDefaults.platformDefault === "copart"
                    ? "selected"
                    : ""
                }>Copart</option>
                <option value="iaai" ${
                  preflightDefaults.platformDefault === "iaai" ? "selected" : ""
                }>IAAI</option>
              </select>
            </div>
          </div>
          <div class="modal-row" style="margin-top:8px">
            <div class="modal-field">
              <label for="pf-engine">Tamaño de motor (L) (opcional)</label>
              <input id="pf-engine" type="number" step="0.1" min="0.6"
                placeholder="Ej. 1.5" value="${preflightDefaults.engineSize || ""}" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" id="pf-cancel">Cancelar</button>
            <button class="btn-primary" id="pf-continue">Continuar</button>
          </div>
        </div>
      `;

      const progress = document.createElement("div");
      progress.className = "modal-section";
      progress.style.display = "none";
      progress.innerHTML = `
        <div class="receipt-subtle" id="pf-progress-text">Calculando...</div>
      `;

      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(progress);
      modal.appendChild(card);
      document.body.appendChild(overlay);
      document.body.appendChild(modal);

      document.getElementById("pf-cancel").onclick = close;
      function close() {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
      }

      document.getElementById("pf-continue").onclick = () => {
        const vehicleType = document.getElementById("pf-veh-type").value;
        const platformDefault =
          document.getElementById("pf-platform").value || "copart";
        const engineSizeRaw = document.getElementById("pf-engine").value;
        const engineSize =
          engineSizeRaw !== "" && engineSizeRaw !== null
            ? Number(engineSizeRaw)
            : "";

        // persist defaults for this file
        preflightDefaults.vehicleType = vehicleType;
        preflightDefaults.platformDefault = platformDefault;
        preflightDefaults.engineSize = engineSize;

        // Feedback mode
        body.style.display = "none";
        progress.style.display = "";

        // Resolve and close; API runs in runPreflightIfNeeded
        close();
        resolve({ vehicleType, platformDefault, engineSize });
      };
    });
  }

  // API call for one car
  function callEstimateAPI({ car, vehicleType, platformDefault, engineSize }) {
    const platform =
      (car.auction ? String(car.auction).toLowerCase() : "") ||
      platformDefault ||
      "copart";
    const payload = {
      year: car.year,
      price: car.price,
      location: car.location,
      platform,
      vin: car.vin,
      vehicleType,
    };
    // Use one-time engineSize if provided, else car.engine_size (if numeric)
    const ez =
      engineSize !== "" && engineSize !== null && !Number.isNaN(engineSize)
        ? Number(engineSize)
        : typeof car.engine_size === "number"
          ? car.engine_size
          : undefined;
    if (ez !== undefined) payload.engineSize = ez;

    return fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(txt || `API error ${r.status}`);
      }
      return r.json();
    });
  }

  // PRINT DOM HELPERS (unchanged from prior version except minor reuse)
  function ensurePrintRoot() {
    if (!document.getElementById("print-root")) {
      const div = document.createElement("div");
      div.id = "print-root";
      document.body.appendChild(div);
    }
  }

  function buildFiltersSummary() {
    const parts = [];
    if (window.selectedYear) parts.push(`Año: ${window.selectedYear}`);
    if (window.currentFilters?.special === "clean")
      parts.push("Solo vehículos 'limpios'");
    if (window.currentFilters?.special === "nonRecommended")
      parts.push("Sin daños no recomendados");
    const min = window.currentFilters?.minPrice ?? null;
    const max = window.currentFilters?.maxPrice ?? null;
    if (min !== null && max !== null)
      parts.push(`Precio: $${min.toLocaleString()}–$${max.toLocaleString()}`);
    return parts.join(" · ") || "Todos";
  }

  async function snapshotCharts() {
    const out = {
      bar: null,
      priceHist: null,
      mileageHist: null,
      boxPlot: null,
      avgLine: null,
    };
    try {
      if (window.chart)
        out.bar = canvasDataURL(document.getElementById("barChart"));
    } catch {}
    try {
      if (window.priceHistogramChart)
        out.priceHist = canvasDataURL(
          document.getElementById("priceHistogram"),
        );
    } catch {}
    try {
      if (window.mileageHistogramChart)
        out.mileageHist = canvasDataURL(
          document.getElementById("mileageHistogram"),
        );
    } catch {}
    try {
      if (window.boxPlotChart)
        out.boxPlot = canvasDataURL(document.getElementById("boxPlotChart"));
    } catch {}
    try {
      if (window.avgLineChart)
        out.avgLine = canvasDataURL(
          document.getElementById("avgPriceLineChart"),
        );
    } catch {}
    return out;
  }
  function canvasDataURL(canvas) {
    try {
      return canvas ? canvas.toDataURL("image/png") : null;
    } catch {
      return null;
    }
  }
  function imgOrPlaceholder(dataUrl, title) {
    if (!dataUrl)
      return `<div><div class="print-subtle">${title}</div><div class="print-subtle">No hay datos</div></div>`;
    return `<div><div class="print-subtle">${title}</div><img class="print-chart" src="${dataUrl}" /></div>`;
  }

  function extractEstimateFromCard(vin) {
    const el = Array.from(document.querySelectorAll(".car-item")).find(
      (n) => (n.getAttribute("data-vin") || "") === vin,
    );
    if (!el) return null;
    const raw =
      el.getAttribute("data-estimate-json") || el.dataset.estimateJson;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function buildWarnPage(car) {
    const div = document.createElement("div");
    div.className = "print-page";
    div.innerHTML = `
      <div class="print-h1">${car.year || ""} ${car.model || ""}</div>
      <div class="print-subtle">${car.location || ""}</div>
      <p style="margin-top:12px;color:#a00">
        Este vehículo no tiene cálculo de importación disponible. Verifica el precio y usa “Calcular” para generarlo.
      </p>
    `;
    return div;
  }

  async function buildCarPage(car, res) {
    const pick = bestPort(res.results || []);
    const daiPct = Number(pick?.daiPct || 0);
    const scPct = Number(pick?.scPct || 0);

    const colgroup = `
      <colgroup>
        <col class="col-label" />
        <col class="col-usd" />
        <col class="col-lps" />
      </colgroup>
    `;

    const usd = pick?.breakdown?.usd || {};
    const lps = pick?.breakdown?.lps || {};

    const img = document.createElement("div");
    img.style.margin = "8px 0 12px 0";
    img.innerHTML = car.imageUrl
      ? `<img src="${car.imageUrl}" style="max-width:100%;border:1px solid #ddd;border-radius:8px" />`
      : "";

    const link = car.url
      ? `<div class="print-subtle" style="margin:6px 0"><a href="${car.url}">${car.url}</a></div>`
      : "";

    const page = document.createElement("div");
    page.className = "print-page";
    page.innerHTML = `
      <div class="print-h1">${car.year || ""} ${car.model || ""}</div>
      <div class="print-subtle">${car.location || ""} · VIN: ${car.vin || ""}</div>
      ${link}
      ${img.outerHTML}

      <div class="print-section-title">Factor de cambio utilizado: ${res.fx} · <span class="print-subtle">actualizado ${res.asOfFxDate}</span></div>

      <div class="print-receipt">
        <div class="print-section-title">Puerto seleccionado: ${pick?.port || "N/D"}</div>
        <div class="print-subtle" style="margin-bottom:8px">
          Grúa: ${fmtUSD(pick?.gruaUSD)} · ${fmtLps(pick?.gruaLps)} — Flete: ${fmtUSD(pick?.fleteUSD)} · ${fmtLps(pick?.fleteLps)}
        </div>

        <div class="print-section-title">Calculo CIF</div>
        <table class="print-table">
          ${colgroup}
          <tbody>
            <tr><td>Valor factura</td><td>${fmtUSD(usd.price)}</td><td>${fmtLps(lps.price)}</td></tr>
            <tr><td>Grúa</td><td>${fmtUSD(usd.grua)}</td><td>${fmtLps(lps.grua)}</td></tr>
            <tr><td>Flete</td><td>${fmtUSD(usd.flete)}</td><td>${fmtLps(lps.flete)}</td></tr>
            <tr><td>Seguro</td><td>${fmtUSD(usd.seguro)}</td><td>${fmtLps(lps.seguro)}</td></tr>
            <tr><td>Comprador indirecto</td><td>${fmtUSD(usd.compradorIndirecto)}</td><td>${fmtLps(lps.compradorIndirecto)}</td></tr>
            <tr class="print-total"><td>VALOR CIF</td><td>${fmtUSD(pick?.cifUSD)}</td><td>${fmtLps(pick?.cifLps)}</td></tr>
          </tbody>
        </table>

        <div class="print-section-title">Detalles de impuestos a pagar</div>
        <table class="print-table">
          ${colgroup}
          <tbody>
            <tr><td>DAI (${daiPct.toFixed(0)}%)</td><td>${fmtUSD(usd.dai)}</td><td>${fmtLps(lps.dai)}</td></tr>
            <tr><td>SC (${scPct.toFixed(0)}%)</td><td>${fmtUSD(usd.sc)}</td><td>${fmtLps(lps.sc)}</td></tr>
            <tr><td>ISV</td><td>${fmtUSD(usd.isv)}</td><td>${fmtLps(lps.isv)}</td></tr>
            ${rowIf(pick?.breakdown?.usd?.vehiculoAntiguo, pick?.breakdown?.lps?.vehiculoAntiguo, "Vehículo antiguo (Ley)")}
            <tr><td>Servicio de Datos</td><td>${fmtUSD(usd.servicioDatos)}</td><td>${fmtLps(lps.servicioDatos)}</td></tr>
            <tr><td>Ecotasa</td><td>${fmtUSD(usd.ecotasa)}</td><td>${fmtLps(lps.ecotasa)}</td></tr>
            <tr class="print-total"><td>IMPUESTOS TOTALES</td><td>${fmtUSD(pick?.totals?.usd?.taxes)}</td><td>${fmtLps(pick?.totals?.lps?.taxes)}</td></tr>
          </tbody>
        </table>

        <div class="print-section-title">Gastos de trámite aduanero</div>
        <table class="print-table">
          ${colgroup}
          <tbody>
            <tr><td>Estimado almacenaje</td><td>${fmtUSD(usd.almacenaje)}</td><td>${fmtLps(lps.almacenaje)}</td></tr>
            <tr><td>Trámite aduanero</td><td>${fmtUSD(usd.tramiteAduanero)}</td><td>${fmtLps(lps.tramiteAduanero)}</td></tr>
            <tr><td>Trámite de placas</td><td>${fmtUSD(usd.tramitePlacas)}</td><td>${fmtLps(lps.tramitePlacas)}</td></tr>
            <tr><td>DVA</td><td>${fmtUSD(usd.dva)}</td><td>${fmtLps(lps.dva)}</td></tr>
            <tr><td>Matrícula IP Aprox</td><td>${fmtUSD(usd.matriculaIP)}</td><td>${fmtLps(lps.matriculaIP)}</td></tr>
            <tr class="print-total"><td>TOTAL ADUANAS</td><td>${fmtUSD(pick?.totals?.usd?.duties)}</td><td>${fmtLps(pick?.totals?.lps?.duties)}</td></tr>
          </tbody>
        </table>

        <div class="print-section-title">Otros gastos</div>
        <table class="print-table">
          ${colgroup}
          <tbody>
            <tr><td>Transferencia internacional</td><td>${fmtUSD(usd.transferenciaInternacional)}</td><td>${fmtLps(lps.transferenciaInternacional)}</td></tr>
            <tr><td>Comisión</td><td>${fmtUSD(usd.comision)}</td><td>${fmtLps(lps.comision)}</td></tr>
            <tr class="print-total"><td>TOTAL FUERA DE ADUANA</td><td>${fmtUSD(pick?.totals?.usd?.otherFees)}</td><td>${fmtLps(pick?.totals?.lps?.otherFees)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
    return page;
  }

  // Helpers
  function bestPort(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return [...arr].sort((a, b) => totalUSD(a) - totalUSD(b))[0];
  }
  function totalUSD(r) {
    if (r?.totals?.usd?.total) return r.totals.usd.total;
    const t = r?.totals?.usd || {};
    return (
      (t.taxes || 0) + (t.duties || 0) + (t.otherFees || 0) + (r?.cifUSD || 0)
    );
  }
  function rowIf(usd, lps, label) {
    if (!usd && !lps) return "";
    if (Number(lps) <= 0) return "";
    return `<tr><td>${label}</td><td>${fmtUSD(usd)}</td><td>${fmtLps(lps)}</td></tr>`;
  }
  function fmtUSD(n) {
    return (
      "$" +
      (Number(n) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  function fmtLps(n) {
    return (
      "L " +
      (Number(n) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  // Public hooks
  window.PrintReport = {
    onListRendered(cars) {
      if (!fileToken) fileToken = String(Date.now());
      ensurePrintButton();
      attachChips(cars || []);
    },
    resetForNewFile() {
      fileToken = String(Date.now());
      selectedVins.clear();
      // keep preflightDefaults if you prefer; reset if not:
      // preflightDefaults.vehicleType = "small_cars";
      // preflightDefaults.platformDefault = "copart";
      // preflightDefaults.engineSize = "";
      updateCount();
      attachChips([]);
    },
  };

  // If estimate-ui notifies, clear selections
  if (
    window.EstimatorUI &&
    typeof window.EstimatorUI.onNewFileLoaded === "function"
  ) {
    const orig = window.EstimatorUI.onNewFileLoaded;
    window.EstimatorUI.onNewFileLoaded = function (...args) {
      selectedVins.clear();
      updateCount();
      return orig.apply(this, args);
    };
  }

  // Attach estimate JSON to card (same shape as Calculate)
  function attachEstimateToCard(vin, apiJson) {
    const card = Array.from(document.querySelectorAll(".car-item")).find(
      (el) => (el.getAttribute("data-vin") || "") === vin,
    );
    if (!card) return;
    const jsonStr = JSON.stringify(apiJson);
    card.dataset.estimateJson = jsonStr;
    card.setAttribute("data-estimate-json", jsonStr);
  }
})();

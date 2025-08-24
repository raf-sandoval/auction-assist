// /public/js/estimate-ui.js
(function () {
  const API_URL = "/api/estimate";

  // Natural language → API vehicleType keys
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

  // State kept for this page-load only (cleared on refresh or new upload)
  let fileToken = null; // changes when a new file is loaded
  const savedByVin = Object.create(null); // { vin: { vehicleType, engineSize, platform } }
  const defaults = { vehicleType: null, engineSize: null, platform: null };

  // Modal DOM
  let overlay, modal, bodyEl, titleEl;

  function ensureModal() {
    if (overlay && modal) return;
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", closeModal);

    modal = document.createElement("div");
    modal.className = "modal";

    const card = document.createElement("div");
    card.className = "modal-card";

    const header = document.createElement("div");
    header.className = "modal-header";

    titleEl = document.createElement("h3");
    titleEl.className = "modal-title";
    titleEl.textContent = "Calcular importación";

    const closeBtn = document.createElement("button");
    closeBtn.className = "modal-close";
    closeBtn.textContent = "Cerrar";
    closeBtn.addEventListener("click", closeModal);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    bodyEl = document.createElement("div");
    bodyEl.className = "modal-body";

    card.appendChild(header);
    card.appendChild(bodyEl);
    modal.appendChild(card);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  }

  function openModal() {
    ensureModal();
    overlay.classList.add("show");
    modal.classList.add("show");
  }

  function closeModal() {
    if (!modal) return;
    overlay.classList.remove("show");
    modal.classList.remove("show");
    // optional: clear bodyEl.innerHTML = "";
  }

  function getCarByVin(vin) {
    const list = (window.carData || []).filter((c) => c && c.vin);
    return list.find((c) => c.vin === vin) || null;
  }

  function buildPreForm(car) {
    const saved = savedByVin[car.vin] || {};
    const preVehicleType =
      saved.vehicleType || defaults.vehicleType || "small_cars";
    const preEngine =
      saved.engineSize ??
      (typeof car.engine_size === "number" ? car.engine_size : "");
    const prePlatform =
      saved.platform ||
      (car.auction ? String(car.auction).toLowerCase() : "") ||
      "copart";

    // If the scrape didn’t include engine/platform, we ask for it.
    const needsEngine =
      !(typeof car.engine_size === "number") || Number.isNaN(car.engine_size);
    const needsPlatform = !car.auction;

    const engineField = `
      <div class="modal-field" ${needsEngine ? "" : 'style="display:none"'} >
        <label for="est-engine">Tamaño de motor (L)</label>
        <input id="est-engine" type="number" step="0.1" min="0.6"
          placeholder="Ej. 1.5"
          value="${preEngine !== null && preEngine !== undefined ? preEngine : ""}" />
      </div>
    `;

    const platformField = `
      <div class="modal-field" ${needsPlatform ? "" : 'style="display:none"'} >
        <label for="est-platform">Plataforma</label>
        <select id="est-platform">
          <option value="copart" ${
            prePlatform === "copart" ? "selected" : ""
          }>Copart</option>
          <option value="iaai" ${
            prePlatform === "iaai" ? "selected" : ""
          }>IAAI</option>
        </select>
      </div>
    `;

    const vehicleField = `
      <div class="modal-field">
        <label for="est-veh-type">Tamaño del vehículo</label>
        <select id="est-veh-type">
          ${VEHICLE_OPTIONS.map(
            (o) =>
              `<option value="${o.key}" ${
                o.key === preVehicleType ? "selected" : ""
              }>${o.label}</option>`,
          ).join("")}
        </select>
      </div>
    `;

    const carInfo = `
      <div class="modal-section">
        <div class="receipt-subtle" style="margin-bottom:8px">
          ${car.year || ""} ${car.model || ""} — $${(
            car.price || 0
          ).toLocaleString()} — ${car.location || ""}
        </div>
        <div class="modal-row">
          ${vehicleField}
          ${engineField}
          ${platformField}
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" id="est-cancel">Cancelar</button>
          <button class="btn-primary" id="est-run">Calcular</button>
        </div>
      </div>
    `;

    return carInfo;
  }

  function runEstimate({ car, vehicleType, engineSize, platform }) {
    const payload = {
      year: car.year,
      price: car.price,
      location: car.location,
      platform: String(platform || "").toLowerCase(),
      vin: car.vin,
      vehicleType,
    };
    if (engineSize !== "" && engineSize !== null && engineSize !== undefined) {
      payload.engineSize = Number(engineSize);
    }

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

  function renderReceipt(res) {
    const fx = res.fx;
    const fxDate = res.asOfFxDate;

    if (!Array.isArray(res.results) || res.results.length === 0) {
      return `
        <div class="modal-section">
          <div class="receipt-subtle">No hay cotizaciones disponibles para el
          tipo de vehículo y ubicación seleccionados.</div>
        </div>
      `;
    }

    const ports = res.results
      .map((r) => {
        const b = r.breakdown || {};
        const usd = b.usd || {};
        const lps = b.lps || {};
        const t = r.totals || {};
        const tu = t.usd || {};
        const tl = t.lps || {};

        return `
        <div class="receipt-port">
          <h4>${r.port} ${
            r.leadWeeks && r.leadWeeks.min
              ? `<span class="receipt-subtle" style="font-weight:400">· ${r.leadWeeks.min}-${r.leadWeeks.max} semanas</span>`
              : ""
          }</h4>

          <div class="receipt-subtle" style="margin-bottom:8px">
            Grúa: ${fmtUSD(r.gruaUSD)} · ${fmtLps(r.gruaLps)} — Flete: ${fmtUSD(
              r.fleteUSD,
            )} · ${fmtLps(r.fleteLps)}
          </div>

          <div style="font-weight:800;color:#fafafa;margin-top:8px;margin-bottom:6px;">
            Calculo CIF
          </div>
          <table class="receipt-table">
            <tbody>
              <tr><td>Valor factura</td><td>${fmtUSD(usd.price)}</td><td>${fmtLps(
                lps.price,
              )}</td></tr>
              <tr><td>Grúa</td><td>${fmtUSD(usd.grua)}</td><td>${fmtLps(
                lps.grua,
              )}</td></tr>
              <tr><td>Flete</td><td>${fmtUSD(usd.flete)}</td><td>${fmtLps(
                lps.flete,
              )}</td></tr>
              <tr><td>Seguro</td><td>${fmtUSD(usd.seguro)}</td><td>${fmtLps(
                lps.seguro,
              )}</td></tr>
              <tr><td>Comprador indirecto</td><td>${fmtUSD(
                usd.compradorIndirecto,
              )}</td><td>${fmtLps(lps.compradorIndirecto)}</td></tr>
              <tr class="receipt-total"><td>VALOR CIF</td><td>${fmtUSD(
                r.cifUSD,
              )}</td><td>${fmtLps(r.cifLps)}</td></tr>
            </tbody>
          </table>

          <div style="font-weight:800;color:#fafafa;margin-top:12px;margin-bottom:6px;">
            Detalles de impuestos a pagar
          </div>
          <table class="receipt-table">
            <tbody>
              <tr><td>Derecho Arancelario de Importación (DAI)</td><td>${fmtUSD(
                usd.dai,
              )}</td><td>${fmtLps(lps.dai)}</td></tr>
              <tr><td>Selectivo al Consumo (SC)</td><td>${fmtUSD(
                usd.sc,
              )}</td><td>${fmtLps(lps.sc)}</td></tr>
              <tr><td>ISV</td><td>${fmtUSD(usd.isv)}</td><td>${fmtLps(
                lps.isv,
              )}</td></tr>
              <tr><td>Servicio de Datos</td><td>${fmtUSD(
                usd.servicioDatos,
              )}</td><td>${fmtLps(lps.servicioDatos)}</td></tr>
              <tr><td>Ecotasa</td><td>${fmtUSD(usd.ecotasa)}</td><td>${fmtLps(
                lps.ecotasa,
              )}</td></tr>
              <tr class="receipt-total"><td>IMPUESTOS TOTALES</td><td>${fmtUSD(
                (res?.resultsTotalsHack && res.resultsTotalsHack.taxesUSD) ||
                  r.totals.usd.taxes,
              )}</td><td>${fmtLps(
                (res?.resultsTotalsHack && res.resultsTotalsHack.taxesLps) ||
                  r.totals.lps.taxes,
              )}</td></tr>
            </tbody>
          </table>

          <div style="font-weight:800;color:#fafafa;margin-top:12px;margin-bottom:6px;">
            Gastos de trámite aduanero
          </div>
          <table class="receipt-table">
            <tbody>
              <tr><td>Estimado almacenaje</td><td>${fmtUSD(
                usd.almacenaje,
              )}</td><td>${fmtLps(lps.almacenaje)}</td></tr>
              <tr><td>Trámite aduanero</td><td>${fmtUSD(
                usd.tramiteAduanero,
              )}</td><td>${fmtLps(lps.tramiteAduanero)}</td></tr>
              <tr><td>Trámite de placas</td><td>${fmtUSD(
                usd.tramitePlacas,
              )}</td><td>${fmtLps(lps.tramitePlacas)}</td></tr>
              <tr><td>DVA</td><td>${fmtUSD(usd.dva)}</td><td>${fmtLps(
                lps.dva,
              )}</td></tr>
              <tr><td>Matrícula IP Aprox</td><td>${fmtUSD(
                usd.matriculaIP,
              )}</td><td>${fmtLps(lps.matriculaIP)}</td></tr>
              <tr class="receipt-total"><td>TOTAL ADUANAS</td><td>${fmtUSD(
                r.totals.usd.duties,
              )}</td><td>${fmtLps(r.totals.lps.duties)}</td></tr>
            </tbody>
          </table>

          <div style="font-weight:800;color:#fafafa;margin-top:12px;margin-bottom:6px;">
            Otros gastos
          </div>
          <table class="receipt-table">
            <tbody>
              <tr><td>Transferencia internacional</td><td>${fmtUSD(
                usd.transferenciaInternacional,
              )}</td><td>${fmtLps(lps.transferenciaInternacional)}</td></tr>
              <tr><td>Comisión</td><td>${fmtUSD(usd.comision)}</td><td>${fmtLps(
                lps.comision,
              )}</td></tr>
              <tr class="receipt-total"><td>TOTAL FUERA DE ADUANA</td><td>${fmtUSD(
                r.totals.usd.otherFees,
              )}</td><td>${fmtLps(r.totals.lps.otherFees)}</td></tr>
            </tbody>
          </table>
        </div>
        `;
      })
      .join("");

    return `
      <div class="receipt">
        <div class="receipt-head">
          <div class="receipt-title">Factor de cambio utilizado: ${fx}</div>
          <div class="receipt-subtle">actualizado ${fxDate}</div>
        </div>
        ${ports}
      </div>
    `;
  }

  function attachEstimateToCard(vin, apiJson) {
    // Find card by VIN (present in your markup)
    const card = Array.from(document.querySelectorAll(".car-item")).find((el) =>
      (el.getAttribute("data-vin") || "").includes(vin),
    );
    if (!card) return;
    // Store the whole API payload in a data attribute (stringified)
    // Keep it in-memory dataset and as an attribute for debug.
    const jsonStr = JSON.stringify(apiJson);
    card.dataset.estimateJson = jsonStr;
    card.setAttribute("data-estimate-json", jsonStr);
  }

  function showForm(car) {
    ensureModal();
    titleEl.textContent = "Calcular importación";
    bodyEl.innerHTML = buildPreForm(car);

    // Wire actions
    document.getElementById("est-cancel").onclick = closeModal;
    document.getElementById("est-run").onclick = async () => {
      const vehicleType = document.getElementById("est-veh-type").value;
      const engineInput = document.getElementById("est-engine");
      const platformSelect = document.getElementById("est-platform");

      const engineSize =
        engineInput && engineInput.value !== ""
          ? Number(engineInput.value)
          : car.engine_size;
      const platform =
        platformSelect && platformSelect.value
          ? platformSelect.value
          : (car.auction || "").toLowerCase();

      // Cache choices for this VIN and set defaults for this file
      savedByVin[car.vin] = { vehicleType, engineSize, platform };
      defaults.vehicleType = vehicleType;
      defaults.engineSize = engineSize;
      defaults.platform = platform;

      // Show loading message
      const btn = document.getElementById("est-run");
      btn.disabled = true;
      btn.textContent = "Calculando...";

      try {
        const res = await runEstimate({
          car,
          vehicleType,
          engineSize,
          platform,
        });
        attachEstimateToCard(car.vin, res);

        // Render receipt
        titleEl.textContent = `${car.year} ${car.model || ""} — ${car.location || ""}`;
        bodyEl.innerHTML = `
          <div class="modal-section" style="margin-bottom:8px">
            <div class="receipt-subtle" style="margin-bottom:6px">
              Plataforma: ${(platform || "").toUpperCase()} · VIN: ${car.vin}
            </div>
            <div class="receipt-subtle">
              Tipo: ${VEHICLE_OPTIONS.find((o) => o.key === vehicleType)?.label || vehicleType}
              ${
                engineSize ? ` · Motor: ${Number(engineSize).toFixed(1)} L` : ""
              }
            </div>
          </div>
          ${renderReceipt(res)}
          <div class="modal-actions" style="margin-top:12px">
            <button class="btn-primary" id="est-close">Cerrar</button>
          </div>
        `;
        document.getElementById("est-close").onclick = closeModal;
      } catch (err) {
        bodyEl.innerHTML = `
          <div class="modal-section">
            <div class="receipt-subtle" style="color:#ef4444">
              Error: ${String(err.message || err)}
            </div>
            <div class="modal-actions">
              <button class="btn-ghost" id="est-back">Volver</button>
            </div>
          </div>
        `;
        document.getElementById("est-back").onclick = () => showForm(car);
      } finally {
        btn.disabled = false;
        btn.textContent = "Calcular";
      }
    };

    openModal();
  }

  // Public API
  window.EstimatorUI = {
    onNewFileLoaded(cars) {
      // Reset per-file cache and defaults
      fileToken = String(Date.now());
      for (const k of Object.keys(savedByVin)) delete savedByVin[k];
      defaults.vehicleType = null;
      defaults.engineSize = null;
      defaults.platform = null;

      // Make sure we can find cars later
      window.carData = Array.isArray(cars) ? cars : [];
    },
  };

  // Global function used by the inline onclick on the button
  window.openEstimateModal = function (vin) {
    const car = getCarByVin(vin);
    if (!car) {
      alert("No se encontró el vehículo seleccionado.");
      return;
    }
    showForm(car);
  };
})();

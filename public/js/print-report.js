// /public/js/print-report.js
(function () {
  const API_URL = "/api/estimate";
  const MAX_SELECT = 5;
  const REPORT_TITLE_DEFAULT = "Informe de Precios y Costos de Importación";
  let reportTitle = REPORT_TITLE_DEFAULT;

  // Natural language → API keys (same as estimate-ui)
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

  const preflightDefaults = {
    vehicleType: "small_cars",
    platformDefault: "copart",
    engineSize: "",
  };

  // Floating FAB
  function ensureFab() {
    if (document.querySelector(".fab-print")) return;
    const btn = document.createElement("button");
    btn.className = "fab-print";
    btn.title = "Imprimir reporte";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 9V3h12v6h2a2 2 0 0 1 2 2v5h-4v5H8v-5H4v-5a2 2 0 0 1 2-2h0zm2-4v4h8V5H8zm8 12H8v3h8v-3zm-9-5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H7z"/>
      </svg>
      <span class="fab-print-badge" id="fab-print-count">0</span>
    `;
    btn.onclick = onPrintClicked;
    document.body.appendChild(btn);
  }

  function updateFabCount() {
    const el = document.getElementById("fab-print-count");
    if (el) el.textContent = String(selectedVins.size);
  }

  // Selection chip on cards
  function attachChips(cars) {
    const nodes = document.querySelectorAll(".car-item");
    nodes.forEach((card) => {
      const vin = card.getAttribute("data-vin") || "";
      if (!vin) return;
      // Hide chip if no valid price (we can’t calculate)
      const price = Number(card.getAttribute("data-price") || 0);
      const hasValidPrice = isFinite(price) && price > 0;

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
      chip.style.display = hasValidPrice ? "" : "none";

      if (selectedVins.has(vin)) chip.classList.add("selected");
      else chip.classList.remove("selected");
    });
    updateFabCount();
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
    updateFabCount();
  }

  // PRINT FLOW
  async function onPrintClicked() {
    // Ask for title first
    const title = await showPrintSettingsModal().catch(() => null);
    if (!title) return; // cancelled
    reportTitle = title || REPORT_TITLE_DEFAULT;

    // Then calculate any missing estimates if needed
    await runPreflightIfNeeded();

    ensurePrintRoot();
    const root = document.getElementById("print-root");
    root.innerHTML = "";

    // Capture current visibility state and ensure all graphs are visible before taking snapshots
    const originalVisibilityState = captureGraphsVisibilityState();
    await ensureGraphsVisible();

    const charts = await snapshotCharts();

    // Restore original visibility state
    restoreGraphsVisibilityState(originalVisibilityState);

    // Cover page
    const cover = document.createElement("div");
    cover.className = "print-page";
    cover.innerHTML = `
      <div class="print-h1">${reportTitle}</div>
      <div class="print-subtle">${new Date().toLocaleString()}</div>

      <div class="print-section-title">Gráficos</div>
      <div class="print-two-col">
        ${imgOrPlaceholder(charts.bar, "Precios promedio por año")}
        ${imgOrPlaceholder(charts.scatter, "Precios vs Fecha")}
      </div>
      <div class="print-two-col" style="margin-top:10px">
        ${imgOrPlaceholder(charts.priceHist, "Histograma de precios")}
        ${imgOrPlaceholder(charts.mileageHist, "Histograma de millaje")}
      </div>
      <div class="print-two-col" style="margin-top:10px">
        ${imgOrPlaceholder(charts.boxPlot, "Precios por tipo de daño")}
        ${imgOrPlaceholder(charts.avgLine, "Promedio a lo largo del tiempo")}
      </div>
    `;
    root.appendChild(cover);

    // Car pages
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
    for (const vin of selectedVins) {
      const car = carsByVin[vin];
      if (!car) continue;
      const hasEstimate = !!extractEstimateFromCard(vin);
      const validPrice = typeof car.price === "number" && car.price > 0;
      if (!hasEstimate && validPrice) toCalc.push(car);
    }
    if (!toCalc.length) return;

    const { vehicleType, platformDefault, engineSize } =
      await showPreflightModal();

    await Promise.allSettled(
      toCalc.map((car) =>
        callEstimateAPI({ car, vehicleType, platformDefault, engineSize })
          .then((res) => attachEstimateToCard(car.vin, res))
          .catch(() => {}),
      ),
    );
  }

  // PRINT SETTINGS MODAL — ask for the report title before printing
  function showPrintSettingsModal() {
    return new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay show";
      const modal = document.createElement("div");
      modal.className = "modal show";

      const card = document.createElement("div");
      card.className = "modal-card";

      const header = document.createElement("div");
      header.className = "modal-header";
      const titleEl = document.createElement("h3");
      titleEl.className = "modal-title";
      titleEl.textContent = "Configuración de impresión";
      const closeBtn = document.createElement("button");
      closeBtn.className = "modal-close";
      closeBtn.textContent = "Cancelar";
      closeBtn.onclick = () => {
        cleanup();
        reject(new Error("cancelled"));
      };
      header.appendChild(titleEl);
      header.appendChild(closeBtn);

      const body = document.createElement("div");
      body.className = "modal-body";
      body.innerHTML = `
        <div class="modal-section">
          <div class="modal-field">
            <label for="print-report-title">Título del reporte</label>
            <input id="print-report-title" type="text"
              placeholder="Ej. Informe de Precios y Costos de Importación"
              value="${(reportTitle || REPORT_TITLE_DEFAULT)
                .toString()
                .replace(/"/g, "&quot;")}" />
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" id="print-cancel">Cancelar</button>
            <button class="btn-primary" id="print-continue">Continuar</button>
          </div>
        </div>
      `;

      function cleanup() {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
      }

      card.appendChild(header);
      card.appendChild(body);
      modal.appendChild(card);
      document.body.appendChild(overlay);
      document.body.appendChild(modal);

      document.getElementById("print-cancel").onclick = () => {
        cleanup();
        reject(new Error("cancelled"));
      };
      document.getElementById("print-continue").onclick = () => {
        const input = document.getElementById("print-report-title");
        const val = (input?.value || "").trim();
        cleanup();
        resolve(val || REPORT_TITLE_DEFAULT);
      };
    });
  }

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
        cleanup();
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
                    `<option value="${o.key}" ${o.key === preflightDefaults.vehicleType ? "selected" : ""}>${o.label}</option>`,
                ).join("")}
              </select>
            </div>
            <div class="modal-field">
              <label for="pf-platform">Plataforma por defecto</label>
              <select id="pf-platform">
                <option value="copart" ${preflightDefaults.platformDefault === "copart" ? "selected" : ""}>Copart</option>
                <option value="iaai" ${preflightDefaults.platformDefault === "iaai" ? "selected" : ""}>IAAI</option>
              </select>
            </div>
          </div>
          <div class="modal-row" style="margin-top:8px">
            <div class="modal-field">
              <label for="pf-engine">Tamaño de motor (L) (opcional)</label>
              <input id="pf-engine" type="number" step="0.1" min="0.6" placeholder="Ej. 1.5" value="${preflightDefaults.engineSize || ""}" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-ghost" id="pf-cancel">Cancelar</button>
            <button class="btn-primary" id="pf-continue">Continuar</button>
          </div>
        </div>
      `;

      function cleanup() {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
      }

      card.appendChild(header);
      card.appendChild(body);
      modal.appendChild(card);
      document.body.appendChild(overlay);
      document.body.appendChild(modal);

      document.getElementById("pf-cancel").onclick = () => {
        cleanup();
        reject(new Error("cancelled"));
      };
      document.getElementById("pf-continue").onclick = () => {
        const vehicleType = document.getElementById("pf-veh-type").value;
        const platformDefault =
          document.getElementById("pf-platform").value || "copart";
        const engineSizeRaw = document.getElementById("pf-engine").value;
        const engineSize = engineSizeRaw !== "" ? Number(engineSizeRaw) : "";

        preflightDefaults.vehicleType = vehicleType;
        preflightDefaults.platformDefault = platformDefault;
        preflightDefaults.engineSize = engineSize;

        cleanup();
        resolve({ vehicleType, platformDefault, engineSize });
      };
    });
  }

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

  // Print DOM helpers
  function ensurePrintRoot() {
    if (!document.getElementById("print-root")) {
      const div = document.createElement("div");
      div.id = "print-root";
      document.body.appendChild(div);
    }
  }

  function captureGraphsVisibilityState() {
    const graphsSection = document.getElementById("graphs-section");
    const graphsContent = document.getElementById("graphs-content");
    const tabContents = document.querySelectorAll(".graphs-tab-content");

    return {
      graphsSection: graphsSection ? graphsSection.style.display : "",
      graphsContent: graphsContent ? graphsContent.style.display : "",
      tabContents: Array.from(tabContents).map(
        (content) => content.style.display,
      ),
    };
  }

  function restoreGraphsVisibilityState(state) {
    if (!state) return;

    const graphsSection = document.getElementById("graphs-section");
    if (graphsSection && state.graphsSection !== undefined) {
      graphsSection.style.display = state.graphsSection;
    }

    const graphsContent = document.getElementById("graphs-content");
    if (graphsContent && state.graphsContent !== undefined) {
      graphsContent.style.display = state.graphsContent;
    }

    const tabContents = document.querySelectorAll(".graphs-tab-content");
    tabContents.forEach((content, index) => {
      if (state.tabContents && state.tabContents[index] !== undefined) {
        content.style.display = state.tabContents[index];
      }
    });
  }

  function ensureGraphsVisible() {
    // Make graphs section visible
    const graphsSection = document.getElementById("graphs-section");
    if (graphsSection) {
      graphsSection.style.display = "";
    }

    // Make graphs content visible
    const graphsContent = document.getElementById("graphs-content");
    if (graphsContent) {
      graphsContent.style.display = "block";
    }

    // Make all graph tab contents visible temporarily
    const tabContents = document.querySelectorAll(".graphs-tab-content");
    tabContents.forEach((content) => {
      content.style.display = "block";
    });

    // Wait a moment for charts to render properly
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Robust snapshots: rebuild each chart onto an off-screen canvas
  async function snapshotCharts() {
    console.log("Taking chart snapshots...");
    console.log("Available charts:", {
      chart: !!window.chart,
      scatterChart: !!window.scatterChart,
      priceHistogramChart: !!window.priceHistogramChart,
      mileageHistogramChart: !!window.mileageHistogramChart,
      boxPlotChart: !!window.boxPlotChart,
      avgLineChart: !!window.avgLineChart,
    });

    const snapshots = {
      bar: null,
      scatter: null,
      priceHist: null,
      mileageHist: null,
      boxPlot: null,
      avgLine: null,
    };

    // Take snapshots sequentially to avoid conflicts
    try {
      if (
        window.chart &&
        window.chart.data &&
        window.chart.data.datasets &&
        window.chart.data.datasets.length > 0
      ) {
        console.log("Snapshotting bar chart...");
        snapshots.bar = await snapshotFromInstance(window.chart, 1100, 380);
      } else {
        console.log("Bar chart not available or has no data");
      }
    } catch (e) {
      console.error("Failed to snapshot bar chart:", e);
    }

    try {
      if (
        window.scatterChart &&
        window.scatterChart.data &&
        window.scatterChart.data.datasets &&
        window.scatterChart.data.datasets.length > 0
      ) {
        console.log("Snapshotting scatter chart...");
        snapshots.scatter = await snapshotFromInstance(
          window.scatterChart,
          1100,
          380,
        );
      } else {
        console.log("Scatter chart not available or has no data");
      }
    } catch (e) {
      console.error("Failed to snapshot scatter chart:", e);
    }

    try {
      if (
        window.priceHistogramChart &&
        window.priceHistogramChart.data &&
        window.priceHistogramChart.data.datasets &&
        window.priceHistogramChart.data.datasets.length > 0
      ) {
        console.log("Snapshotting price histogram...");
        snapshots.priceHist = await snapshotFromInstance(
          window.priceHistogramChart,
          1100,
          380,
        );
      } else {
        console.log("Price histogram chart not available or has no data");
      }
    } catch (e) {
      console.error("Failed to snapshot price histogram:", e);
    }

    try {
      if (
        window.mileageHistogramChart &&
        window.mileageHistogramChart.data &&
        window.mileageHistogramChart.data.datasets &&
        window.mileageHistogramChart.data.datasets.length > 0
      ) {
        console.log("Snapshotting mileage histogram...");
        snapshots.mileageHist = await snapshotFromInstance(
          window.mileageHistogramChart,
          1100,
          380,
        );
      } else {
        console.log("Mileage histogram chart not available or has no data");
      }
    } catch (e) {
      console.error("Failed to snapshot mileage histogram:", e);
    }

    try {
      if (
        window.boxPlotChart &&
        window.boxPlotChart.data &&
        window.boxPlotChart.data.datasets &&
        window.boxPlotChart.data.datasets.length > 0
      ) {
        console.log("Snapshotting box plot...");
        snapshots.boxPlot = await snapshotFromInstance(
          window.boxPlotChart,
          1100,
          380,
        );
      } else {
        console.log("Box plot chart not available or has no data");
      }
    } catch (e) {
      console.error("Failed to snapshot box plot:", e);
    }

    try {
      if (
        window.avgLineChart &&
        window.avgLineChart.data &&
        window.avgLineChart.data.datasets &&
        window.avgLineChart.data.datasets.length > 0
      ) {
        console.log("Snapshotting average line chart...");
        snapshots.avgLine = await snapshotFromInstance(
          window.avgLineChart,
          1100,
          380,
        );
      } else {
        console.log("Average line chart not available or has no data");
      }
    } catch (e) {
      console.error("Failed to snapshot average line chart:", e);
    }

    console.log("Chart snapshots complete:", {
      bar: !!snapshots.bar,
      scatter: !!snapshots.scatter,
      priceHist: !!snapshots.priceHist,
      mileageHist: !!snapshots.mileageHist,
      boxPlot: !!snapshots.boxPlot,
      avgLine: !!snapshots.avgLine,
    });

    return snapshots;
  }

  function snapshotFromInstance(instance, width = 1100, height = 380) {
    if (!instance) {
      console.log("No chart instance provided");
      return null;
    }

    if (
      !instance.data ||
      !instance.data.datasets ||
      instance.data.datasets.length === 0
    ) {
      console.log("Chart instance has no valid data");
      return null;
    }

    console.log("Chart instance type:", instance.config?.type);
    console.log("Chart has data:", !!instance.data);
    console.log("Chart datasets:", instance.data?.datasets?.length || 0);

    // Clone chart data shallowly (enough for static rendering)
    const data = cloneChartData(instance.data);
    if (
      !data ||
      !data.datasets ||
      data.datasets.every((d) => !d.data || d.data.length === 0)
    ) {
      console.log("No valid chart data to snapshot");
      return null; // nothing to draw
    }

    console.log("Creating temporary canvas for snapshot...");
    // Create an off-screen canvas
    const tmp = document.createElement("canvas");
    tmp.width = width;
    tmp.height = height;
    tmp.style.cssText =
      "position:fixed;left:-99999px;top:-99999px;display:block;";
    document.body.appendChild(tmp);

    // Build a minimal config that doesn't depend on container size
    const type = instance.config?.type || "bar";

    // Print palette: darker text, darker grid on white background
    const textColor = "#111827"; // gray-900
    const gridColor = "#9ca3af"; // gray-400
    const borderColor = "#111827"; // axes border

    // Ensure a white background in the exported image
    const bgPlugin = {
      id: "printBg",
      beforeDraw(chart) {
        const { ctx, width: w, height: h } = chart;
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      },
    };

    // Helpers to create axes with print colors
    const axis = (axisType) => ({
      type: axisType,
      display: true,
      grid: { color: gridColor, borderColor },
      ticks: { color: textColor },
      title: { color: textColor },
    });

    // Create type-specific options with a print-friendly palette
    const baseOptions = {
      responsive: false,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !!instance.options?.plugins?.legend?.display,
          position: "top",
          labels: { color: textColor },
        },
      },
    };

    // Add type-specific configurations
    if (type === "scatter") {
      const xType = instance.options?.scales?.x?.type || "time";
      baseOptions.scales = { x: axis(xType), y: axis("linear") };
    } else if (type === "boxplot") {
      baseOptions.scales = { x: axis("category"), y: axis("linear") };
    } else if (type === "line") {
      const xType = instance.options?.scales?.x?.type || "time";
      baseOptions.scales = { x: axis(xType), y: axis("linear") };
    } else {
      // Default for bar charts and others
      baseOptions.scales = { x: axis("category"), y: axis("linear") };
    }

    return new Promise((resolve) => {
      try {
        console.log("Creating temporary chart for snapshot...");
        const chart = new Chart(tmp.getContext("2d"), {
          type,
          data,
          options: baseOptions,
          plugins: [bgPlugin],
        });

        // Force update and wait for completion
        chart.update("none");

        // Add a small delay to ensure rendering is complete
        setTimeout(() => {
          let url = null;
          try {
            url = tmp.toDataURL("image/png");
            console.log("Snapshot created successfully");
          } catch (e) {
            console.error("Error converting canvas to data URL:", e);
          }

          chart.destroy();

          // Clean up canvas
          if (document.body.contains(tmp)) {
            document.body.removeChild(tmp);
          }

          resolve(url);
        }, 100);
      } catch (error) {
        console.error("Error creating chart snapshot:", error);
        if (document.body.contains(tmp)) {
          document.body.removeChild(tmp);
        }
        resolve(null);
      }
    });
  }

  function cloneChartData(src) {
    if (!src) return null;
    return {
      labels: Array.isArray(src.labels) ? [...src.labels] : [],
      datasets: Array.isArray(src.datasets)
        ? src.datasets.map((ds) => ({
            label: ds.label,
            data: Array.isArray(ds.data)
              ? ds.data.map((d) =>
                  d && typeof d === "object" && ("x" in d || "y" in d)
                    ? { x: d.x, y: d.y }
                    : d,
                )
              : [],
            backgroundColor: ds.backgroundColor,
            borderColor: ds.borderColor,
            borderWidth: ds.borderWidth,
            hoverBackgroundColor: ds.hoverBackgroundColor,
            outlierColor: ds.outlierColor, // boxplot plugin
            // Preserve a few style details for print fidelity
            pointStyle: ds.pointStyle,
            pointRadius: ds.pointRadius,
            pointHoverRadius: ds.pointHoverRadius,
            borderDash: ds.borderDash,
            tension: ds.tension,
            fill: ds.fill,
            order: ds.order,
          }))
        : [],
    };
  }

  function imgOrPlaceholder(dataUrl, title) {
    console.log(`imgOrPlaceholder called for "${title}":`, {
      hasDataUrl: !!dataUrl,
      dataUrlLength: dataUrl ? dataUrl.length : 0,
      dataUrlPrefix: dataUrl ? dataUrl.substring(0, 50) + "..." : "null",
    });

    if (!dataUrl) {
      console.log(`No data URL for "${title}" - showing placeholder`);
      return `<div><div class="print-subtle">${title}</div><div class="print-subtle">No hay datos</div></div>`;
    }

    console.log(`Using data URL for "${title}"`);
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
      <p style="margin-top:10px;color:#a00">
        Este vehículo no tiene cálculo de importación disponible.
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

    const img = car.imageUrl
      ? `<img src="${car.imageUrl}" class="print-car-img" />`
      : "";

    const link = car.url
      ? `<div class="print-subtle" style="margin:4px 0"><a href="${car.url}">${car.url}</a></div>`
      : "";

    const page = document.createElement("div");
    page.className = "print-page";
    page.innerHTML = `
      <div class="print-h1">${car.year || ""} ${car.model || ""}</div>
      <div class="print-subtle">${car.location || ""} · VIN: ${car.vin || ""}</div>
      ${link}
      ${img}

      <div class="print-section-title">Factor de cambio utilizado: ${res.fx} · <span class="print-subtle">actualizado ${res.asOfFxDate}</span></div>

      <div class="print-receipt">
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
            ${rowIf(usd.vehiculoAntiguo, lps.vehiculoAntiguo, "Vehículo antiguo (Ley)")}
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
            <tr class="print-total"><td>TOTAL FUERA DE ADUANA</td><td>${fmtUSD(pick?.totals?.usd?.total)}</td><td>${fmtLps(pick?.totals?.lps?.total)}</td></tr>
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
      ensureFab();
      attachChips(cars || []);
    },
    resetForNewFile() {
      fileToken = String(Date.now());
      selectedVins.clear();
      updateFabCount();
      attachChips([]);
    },
  };

  // Clear selections when new file loaded (via estimate-ui hook if present)
  if (
    window.EstimatorUI &&
    typeof window.EstimatorUI.onNewFileLoaded === "function"
  ) {
    const orig = window.EstimatorUI.onNewFileLoaded;
    window.EstimatorUI.onNewFileLoaded = function (...args) {
      selectedVins.clear();
      updateFabCount();
      return orig.apply(this, args);
    };
  }

  // Attach estimate JSON to card (same as Calculate)
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

// public/js/chartService.js
import {
  chart as chartState, // aliasing to avoid conflict with Chart.js library
  selectedYear,
  yearMap,
  defaultBarColor,
  selectedBarColor,
  hoverBarColor,
  setChartInstance,
  setSelectedYear,
} from './state.js';
import { average } from './utils.js';
import { showCarList } from './uiService.js'; // We'll need this for onClick

function getBarColors(years, currentSelectedYear) {
  return years.map(y => (y == currentSelectedYear ? selectedBarColor : defaultBarColor));
}

export function renderChart(currentYearMap) {
  const years = Object.keys(currentYearMap).sort((a, b) => a - b);
  const avgs = years.map(y => Math.round(average(currentYearMap[y])));
  const barColors = getBarColors(years, selectedYear);

  const ctx = document.getElementById('barChart').getContext('2d');
  if (chartState) {
    chartState.destroy();
  }
  const newChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Average Price',
        data: avgs,
        backgroundColor: barColors,
        borderRadius: 8,
        hoverBackgroundColor: hoverBarColor,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: tooltipCtx => `$${tooltipCtx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#232329' },
          ticks: { color: '#e4e4e7', font: { weight: 600 } }
        },
        y: {
          grid: { color: '#232329' },
          ticks: {
            color: '#a1a1aa',
            callback: v => '$' + v.toLocaleString()
          }
        }
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const clickedYear = newChartInstance.data.labels[idx];
          setSelectedYear(clickedYear);
          updateBarColors(); // Uses the new selectedYear from state
          // Pass the full yearMap from state, not just the potentially filtered one
          showCarList(clickedYear, yearMap[clickedYear]);
        }
      }
    }
  });
  setChartInstance(newChartInstance);
  document.getElementById('chart-container').style.display = '';
}

export function updateBarColors() {
  if (!chartState) return;
  const years = chartState.data.labels;
  chartState.data.datasets[0].backgroundColor = getBarColors(years, selectedYear);
  chartState.update();
}

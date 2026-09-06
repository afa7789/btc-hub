// scripts/chart_draw.js
// All chart drawing functions for DEBASE

// Draw Bitcoin Halving Chart with vertical lines and shaded regions
function halvingDraw({
  divId = "halving-chart",
  halvingTimestamps = [],
  nextHalving = null,
  width = 800,
  height = 400,
  btcData = null,
}) {
  const chartDiv = document.getElementById(divId);
  if (!chartDiv) return;

  chartDiv.style.height = `${height}px`;
  chartDiv.style.width = "100%";

  const margin = { top: 70, right: 30, bottom: 60, left: 60 };
  const halvings = halvingTimestamps.map((ts) => new Date(ts * 1000));
  const allHalvings = [...halvings];
  if (nextHalving) allHalvings.push(nextHalving);

  const minDate = new Date(halvings[0].getTime() - 600 * 24 * 3600 * 1000);
  const maxDate = new Date(nextHalving.getTime() + 600 * 24 * 3600 * 1000);

  const x = d3
    .scaleTime()
    .domain([minDate, maxDate])
    .range([margin.left, width - margin.right]);

  d3.select(`#${divId}`).selectAll("*").remove();

  const svg = d3
    .select(`#${divId}`)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%");

  allHalvings.forEach((halving, i) => {
    const beforeStart = new Date(halving.getTime() - 500 * 24 * 3600 * 1000);
    const afterEnd = new Date(halving.getTime() + 500 * 24 * 3600 * 1000);

    svg
      .append("rect")
      .attr("x", Math.max(margin.left, x(beforeStart)))
      .attr("y", margin.top)
      .attr(
        "width",
        Math.max(0, x(halving) - Math.max(margin.left, x(beforeStart))),
      )
      .attr("height", height - margin.top - margin.bottom)
      .attr("fill", "#e0f7fa")
      .attr("opacity", 0.15);

    svg
      .append("rect")
      .attr("x", x(halving))
      .attr("y", margin.top)
      .attr(
        "width",
        Math.max(0, Math.min(width - margin.right, x(afterEnd)) - x(halving)),
      )
      .attr("height", height - margin.top - margin.bottom)
      .attr("fill", "#ffe0b2")
      .attr("opacity", 0.15);
  });

  if (btcData?.timestamp && btcData.price && btcData.timestamp.length > 0) {
    const filteredData = btcData.timestamp
      .map((date, i) => ({ date: new Date(date), price: btcData.price[i] }))
      .filter((d) => d.date >= minDate && d.date <= maxDate && d.price > 0);

    if (filteredData.length > 0) {
      const minPrice = Math.max(
        0.01,
        d3.min(filteredData, (d) => d.price),
      );
      let maxPrice = d3.max(filteredData, (d) => d.price);
      maxPrice = maxPrice * 2.0;
      const btcY = d3
        .scaleLog()
        .domain([minPrice, maxPrice])
        .range([height - margin.bottom, margin.top]);

      const btcLine = d3
        .line()
        .x((d) => x(d.date))
        .y((d) => btcY(d.price))
        .curve(d3.curveMonotoneX);

      svg
        .append("path")
        .datum(filteredData)
        .attr("fill", "none")
        .attr("stroke", "#f7931a")
        .attr("stroke-width", 2)
        .attr("d", btcLine);

      halvings.forEach((halving, i) => {
        const beforeStart = new Date(
          halving.getTime() - 500 * 24 * 3600 * 1000,
        );
        const beforeData = filteredData.filter(
          (d) => d.date >= beforeStart && d.date <= halving,
        );

        if (beforeData.length > 1) {
          svg
            .append("path")
            .datum(beforeData)
            .attr("fill", "none")
            .attr("stroke", "#1976d2")
            .attr("stroke-width", 3)
            .attr("d", btcLine);
        }

        const afterEnd = new Date(halving.getTime() + 500 * 24 * 3600 * 1000);
        const afterData = filteredData.filter(
          (d) => d.date >= halving && d.date <= afterEnd,
        );

        if (afterData.length > 1) {
          svg
            .append("path")
            .datum(afterData)
            .attr("fill", "none")
            .attr("stroke", "#388e3c")
            .attr("stroke-width", 3)
            .attr("d", btcLine);
        }
      });

      svg
        .append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(
          d3
            .axisLeft(btcY)
            .ticks(5)
            .tickFormat((d) => `$${d3.format(".2s")(d)}`),
        );

      svg
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", margin.left - 50)
        .attr("x", 0 - height / 2)
        .attr("dy", "-1em")
        .style("text-anchor", "middle")
        .style("fill", "#f7931a")
        .text("BTC Price (USD, log scale)");
    }
  }

  halvings.forEach((halving, i) => {
    svg
      .append("line")
      .attr("x1", x(halving))
      .attr("x2", x(halving))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#d32f2f")
      .attr("stroke-width", 2);

    svg
      .append("text")
      .attr("x", x(halving))
      .attr("y", margin.top + 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#d32f2f")
      .style("font-size", "0.8em")
      .text(`Halving ${i + 1}`);
  });

  if (nextHalving) {
    svg
      .append("line")
      .attr("x1", x(nextHalving))
      .attr("x2", x(nextHalving))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#1976d2")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,2");

    svg
      .append("text")
      .attr("x", x(nextHalving))
      .attr("y", margin.top + 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#1976d2")
      .style("font-size", "0.8em")
      .text("Next Halving");
  }

  svg
    .append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%Y")));

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", margin.top - 40)
    .attr("text-anchor", "middle")
    .text("Bitcoin Halvings and Price Cycles")
    .style("font-weight", "bold")
    .style("font-size", "1.2em");
}

function drawCombinedChart(
  dataSets,
  divId = "combined-gold-chart",
  title = "PREÇO DO OURO",
  labelLeft = "USD $",
) {
  const chartDiv = document.getElementById(divId);

  if (!chartDiv) {
    console.log(`Chart container with id ${divId} not found.`);
    return;
  }

  const containerWidth = chartDiv.clientWidth;
  const containerHeight =
    chartDiv.clientHeight > 0
      ? chartDiv.clientHeight
      : window.innerWidth <= 600
        ? 400
        : 400;

  const internalWidth = containerWidth;
  const internalHeight =
    window.innerWidth <= 400 ? 450 : window.innerWidth <= 600 ? 400 : 400;

  const margin = {
    top: window.innerWidth <= 400 ? 60 : window.innerWidth <= 600 ? 50 : 40,
    right: window.innerWidth <= 400 ? 20 : window.innerWidth <= 600 ? 25 : 30,
    bottom: window.innerWidth <= 400 ? 80 : window.innerWidth <= 600 ? 70 : 60,
    left: window.innerWidth <= 400 ? 55 : window.innerWidth <= 600 ? 50 : 60,
  };

  d3.select(`#${divId}`).selectAll("*").remove();

  let allDates = [];
  let allPrices = [];

  dataSets.forEach((dataSet) => {
    dataSet.parsedData = dataSet.data.timestamp.map((d, i) => ({
      date: new Date(d),
      price: dataSet.data.price[i],
    }));
    allDates = allDates.concat(dataSet.parsedData.map((d) => d.date));
    allPrices = allPrices.concat(dataSet.parsedData.map((d) => d.price));
  });

  const svg = d3
    .select(`#${divId}`)
    .append("svg")
    // viewBox em vez de width/height fixos: o desenho escala como unidade em
    // vez de amontoar texto de tamanho constante num espaco que encolheu.
    .attr("viewBox", `0 0 ${internalWidth} ${internalHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%");

  const x = d3
    .scaleTime()
    .domain(d3.extent(allDates))
    .range([margin.left, internalWidth - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(allPrices) * 1.05])
    .nice()
    .range([internalHeight - margin.bottom, margin.top]);

  const numXTicks =
    window.innerWidth <= 400 ? 3 : window.innerWidth <= 600 ? 4 : 6;
  const numYTicks =
    window.innerWidth <= 400 ? 4 : window.innerWidth <= 600 ? 5 : 6;

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${internalHeight - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(numXTicks)
        .tickSize(-(internalHeight - margin.top - margin.bottom))
        .tickFormat(""),
    );

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(numYTicks)
        .tickSize(-(internalWidth - margin.left - margin.right))
        .tickFormat(""),
    );

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${internalHeight - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(numXTicks));

  if (window.innerWidth <= 600) {
    xAxis
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");
  }

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(numYTicks));

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr(
      "y",
      window.innerWidth <= 400 ? 10 : window.innerWidth <= 600 ? 10 : 20,
    )
    .attr("x", 0 - internalHeight / 2)
    .attr("dy", "-1em")
    .style("text-anchor", "middle")
    .text(labelLeft);

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.price))
    .curve(d3.curveLinear);

  dataSets.forEach((dataSet) => {
    svg
      .append("path")
      .datum(dataSet.parsedData)
      .attr("class", `line ${dataSet.cssClass}`)
      .attr("fill", "none")
      .attr("stroke", dataSet.color)
      .attr("d", line);
  });

  svg
    .append("text")
    .attr("x", internalWidth / 2)
    .attr(
      "y",
      window.innerWidth <= 400 ? 30 : window.innerWidth <= 600 ? 25 : 20,
    )
    .attr("text-anchor", "middle")
    .text(title.toUpperCase());

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr(
      "transform",
      `translate(${margin.left}, ${internalHeight - margin.bottom + 40})`,
    );

  dataSets.forEach((d, i) => {
    const legendRow = legend
      .append("g")
      .attr("transform", `translate(0, ${i * 20})`);

    legendRow
      .append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", d.color);

    legendRow
      .append("text")
      .attr("x", 20)
      .attr("y", 10)
      .attr("text-anchor", "start")
      .style("font-size", "0.8em")
      .text(d.label);
  });
}

function drawDollarPurchasingPowerChart(purchasingPowerData) {
  if (
    !purchasingPowerData ||
    !purchasingPowerData.timestamp ||
    !purchasingPowerData.value
  ) {
    console.error("Error: Invalid or missing purchasingPowerData");
    return;
  }
  if (
    purchasingPowerData.timestamp.length !== purchasingPowerData.value.length
  ) {
    console.error("Error: Mismatch between timestamp and value arrays");
    return;
  }

  const data = purchasingPowerData.timestamp
    .map((d, i) => {
      const date = new Date(d);
      const value = purchasingPowerData.value[i];

      if (Number.isNaN(date) || !Number.isFinite(value) || value <= 0) {
        console.warn("Invalid data point:", {
          timestamp: d,
          value: value,
          date: date,
        });
      }

      return { date, value };
    })
    .filter(
      (d) => !Number.isNaN(d.date) && Number.isFinite(d.value) && d.value > 0,
    );

  if (data.length === 0) {
    console.error("Error: No valid data points after filtering");
    return;
  }

  const chartDiv = document.getElementById("usd-purchasing-power-chart");
  if (!chartDiv) {
    console.error(
      "Error: Chart container #usd-purchasing-power-chart not found",
    );
    return;
  }

  const containerWidth = chartDiv.clientWidth || window.innerWidth;
  const containerHeight =
    chartDiv.clientHeight > 0
      ? chartDiv.clientHeight
      : window.innerWidth <= 600
        ? 400
        : 400;
  const internalWidth = containerWidth;
  const internalHeight =
    window.innerWidth <= 400 ? 450 : window.innerWidth <= 600 ? 400 : 400;

  const margin = {
    top: window.innerWidth <= 400 ? 60 : window.innerWidth <= 600 ? 50 : 40,
    right: window.innerWidth <= 400 ? 20 : window.innerWidth <= 600 ? 25 : 30,
    bottom: window.innerWidth <= 400 ? 80 : window.innerWidth <= 600 ? 70 : 60,
    left: window.innerWidth <= 400 ? 70 : window.innerWidth <= 600 ? 65 : 80,
  };

  d3.select("#usd-purchasing-power-chart").selectAll("*").remove();

  const svg = d3
    .select("#usd-purchasing-power-chart")
    .append("svg")
    // viewBox em vez de width/height fixos: o desenho escala como unidade em
    // vez de amontoar texto de tamanho constante num espaco que encolheu.
    .attr("viewBox", `0 0 ${internalWidth} ${internalHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%");

  const x = d3
    .scaleTime()
    .domain(d3.extent(data, (d) => d.date))
    .range([margin.left, internalWidth - margin.right]);

  const y = d3
    .scaleLog()
    .domain([Math.max(d3.min(data, (d) => d.value) * 0.8, 0.01), 1.05])
    .range([internalHeight - margin.bottom, margin.top])
    .clamp(true);

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${internalHeight - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(6)
        .tickSize(-(internalHeight - margin.top - margin.bottom))
        .tickFormat(""),
    );

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(6)
        .tickSize(-(internalWidth - margin.left - margin.right))
        .tickFormat(""),
    );

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${internalHeight - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6));

  if (window.innerWidth <= 600) {
    xAxis
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");
  }

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(6)
        .tickFormat((d) => d.toFixed(2)),
    );

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr(
      "y",
      window.innerWidth <= 400 ? 10 : window.innerWidth <= 600 ? 10 : 15,
    )
    .attr("x", 0 - internalHeight / 2)
    .attr("dy", "-1em")
    .style("text-anchor", "middle")
    .text("Relative Purchasing Power");

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.value))
    .curve(d3.curveLinear);

  svg
    .append("path")
    .datum(data)
    .attr("class", "line usd-purchasing-power-line")
    .attr("fill", "none")
    .attr("stroke", "#FFFFFF")
    .attr(
      "stroke-width",
      window.innerWidth <= 400 ? 10 : window.innerWidth <= 600 ? 8 : 3,
    )
    .attr("d", line);

  svg
    .append("text")
    .attr("x", internalWidth / 2)
    .attr(
      "y",
      window.innerWidth <= 400 ? 30 : window.innerWidth <= 600 ? 25 : 20,
    )
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("DOLLAR PURCHASING POWER (CPI)");
}

function drawRelativeGrowthChart(
  dataSets,
  divId = "crypto-relative-growth-usd-chart",
  title = "CRYPTO RELATIVE GROWTH IN USD",
) {
  const chartDiv = document.getElementById(divId);
  if (!chartDiv) {
    console.log(`Chart container with id ${divId} not found.`);
    return;
  }

  const containerWidth = chartDiv.clientWidth;
  const containerHeight =
    chartDiv.clientHeight > 0
      ? chartDiv.clientHeight
      : window.innerWidth <= 600
        ? 400
        : 400;

  const internalWidth = containerWidth;
  const internalHeight =
    window.innerWidth <= 400 ? 450 : window.innerWidth <= 600 ? 400 : 400;

  const margin = {
    top: window.innerWidth <= 400 ? 60 : window.innerWidth <= 600 ? 50 : 40,
    right: window.innerWidth <= 400 ? 20 : window.innerWidth <= 600 ? 25 : 30,
    bottom: window.innerWidth <= 400 ? 80 : window.innerWidth <= 600 ? 70 : 60,
    left: window.innerWidth <= 400 ? 70 : window.innerWidth <= 600 ? 65 : 80,
  };

  d3.select(`#${divId}`).selectAll("*").remove();

  let allDates = [];
  let allPrices = [];
  const validDataSets = [];

  dataSets.forEach((dataSet) => {
    const validPrices = dataSet.data.price.filter(
      (p) => !Number.isNaN(p) && p > 0,
    );
    if (validPrices.length > 0) {
      dataSet.parsedData = dataSet.data.timestamp
        .map((d, i) => ({
          date: new Date(d),
          price: dataSet.data.price[i],
        }))
        .filter((d) => !Number.isNaN(d.price) && d.price > 0);

      if (dataSet.parsedData.length > 0) {
        validDataSets.push(dataSet);
        allDates = allDates.concat(dataSet.parsedData.map((d) => d.date));
        allPrices = allPrices.concat(dataSet.parsedData.map((d) => d.price));
      }
    }
  });

  if (validDataSets.length === 0) {
    console.error("No valid data to display in relative growth chart");
    return;
  }

  const svg = d3
    .select(`#${divId}`)
    .append("svg")
    // viewBox em vez de width/height fixos: o desenho escala como unidade em
    // vez de amontoar texto de tamanho constante num espaco que encolheu.
    .attr("viewBox", `0 0 ${internalWidth} ${internalHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%");

  const x = d3
    .scaleTime()
    .domain(d3.extent(allDates))
    .range([margin.left, internalWidth - margin.right]);

  const maxPrice = d3.max(allPrices);
  const minPrice = d3.min(allPrices.filter((p) => p > 0));
  const useLogScale = maxPrice / minPrice > 100;

  let y;
  if (useLogScale) {
    y = d3
      .scaleLog()
      .domain([Math.max(minPrice * 0.8, 0.1), maxPrice * 1.2])
      .range([internalHeight - margin.bottom, margin.top])
      .clamp(true);
  } else {
    y = d3
      .scaleLinear()
      .domain([0, maxPrice * 1.05])
      .range([internalHeight - margin.bottom, margin.top]);
  }

  const numXTicks =
    window.innerWidth <= 400 ? 3 : window.innerWidth <= 600 ? 4 : 6;
  const numYTicks =
    window.innerWidth <= 400 ? 3 : window.innerWidth <= 600 ? 4 : 5;

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${internalHeight - margin.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(numXTicks)
        .tickSize(-(internalHeight - margin.top - margin.bottom))
        .tickFormat(""),
    )
    .selectAll(".tick line")
    .attr("stroke", "#ccc")
    .attr("stroke-opacity", 0.15);

  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(numYTicks)
        .tickSize(-(internalWidth - margin.left - margin.right))
        .tickFormat(""),
    )
    .selectAll(".tick line")
    .attr("stroke", "#ccc")
    .attr("stroke-opacity", 0.15);

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${internalHeight - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(numXTicks));

  if (window.innerWidth <= 600) {
    xAxis
      .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");
  }

  const yAxis = svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`);
  if (useLogScale) {
    const logMin = Math.max(minPrice * 0.8, 0.1);
    const logMax = maxPrice * 1.2;
    let tickVals = [];
    const steps = [
      0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
      50000, 100000, 200000, 500000, 1000000,
    ];
    tickVals = steps.filter((v) => v >= logMin && v <= logMax);
    yAxis.call(
      d3
        .axisLeft(y)
        .tickValues(tickVals)
        .tickFormat((d) => {
          if (d >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
          if (d >= 1000) return `${(d / 1000).toFixed(1)}K`;
          if (d >= 1) return `${d.toFixed(0)}x`;
          return d.toFixed(2);
        }),
    );
  } else {
    yAxis.call(
      d3
        .axisLeft(y)
        .ticks(numYTicks)
        .tickFormat((d) => {
          if (d >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
          if (d >= 1000) return `${(d / 1000).toFixed(1)}K`;
          if (d >= 1) return `${d.toFixed(0)}x`;
          return d.toFixed(2);
        }),
    );
  }

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr(
      "y",
      window.innerWidth <= 400 ? 10 : window.innerWidth <= 600 ? 10 : 15,
    )
    .attr("x", 0 - internalHeight / 2)
    .attr("dy", "-1em")
    .style("text-anchor", "middle")
    .text("Growth Multiplier");

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.price))
    .curve(d3.curveLinear)
    .defined((d) => !Number.isNaN(d.price) && d.price > 0);

  validDataSets.forEach((dataSet) => {
    svg
      .append("path")
      .datum(dataSet.parsedData)
      .attr("class", `line ${dataSet.cssClass}`)
      .attr("fill", "none")
      .attr("stroke", dataSet.color)
      .attr("stroke-width", 2)
      .attr("d", line);
  });

  svg
    .append("text")
    .attr("x", internalWidth / 2)
    .attr(
      "y",
      window.innerWidth <= 400 ? 30 : window.innerWidth <= 600 ? 25 : 20,
    )
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text(title);

  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr(
      "transform",
      `translate(${margin.left}, ${internalHeight - margin.bottom + 40})`,
    );

  validDataSets.forEach((d, i) => {
    const legendRow = legend
      .append("g")
      .attr("transform", `translate(0, ${i * 20})`);

    legendRow
      .append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", d.color);

    legendRow
      .append("text")
      .attr("x", 20)
      .attr("y", 10)
      .attr("text-anchor", "start")
      .style("font-size", "0.8em")
      .text(d.label);
  });

  svg
    .append("line")
    .attr("x1", margin.left)
    .attr("x2", internalWidth - margin.right)
    .attr("y1", y(1))
    .attr("y2", y(1))
    .attr("stroke", "#666")
    .attr("stroke-dasharray", "3,3")
    .attr("opacity", 0.5);

  svg
    .append("text")
    .attr("x", margin.left + 5)
    .attr("y", y(1) - 5)
    .style("font-size", "0.7em")
    .style("fill", "#666")
    .text("1x");
}

const chart_drawing = {
  drawCombinedChart,
  drawDollarPurchasingPowerChart,
  drawRelativeGrowthChart,
  halvingDraw,
};

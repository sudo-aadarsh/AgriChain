const bc = require("./blockchain");

const cache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "AgriChain/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAfterShipTracking({ carrier, trackingNumber }) {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!carrier || !trackingNumber) return null;
  if (!apiKey) {
    return {
      provider: "AfterShip",
      status: "API Key Missing",
      note: "Set AFTERSHIP_API_KEY in backend environment to enable live tracking lookups.",
      checkpoints: [],
    };
  }

  const key = `aftership:${carrier}:${trackingNumber}`;
  return cached(key, 1000 * 45, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `https://api.aftership.com/v4/trackings/${encodeURIComponent(carrier)}/${encodeURIComponent(trackingNumber)}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "aftership-api-key": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "AgriChain/1.0",
        },
      });
      if (!res.ok) {
        return {
          provider: "AfterShip",
          status: "Unavailable",
          note: `Tracking lookup failed (${res.status}). Check carrier slug + tracking number.`,
          checkpoints: [],
        };
      }

      const json = await res.json();
      const t = json?.data?.tracking;
      if (!t) return null;

      return {
        provider: "AfterShip",
        status: t.tag || t.subtag || "Unknown",
        statusText: t.subtag_message || null,
        carrier: t.slug || carrier,
        trackingNumber: t.tracking_number || trackingNumber,
        expectedDelivery: t.expected_delivery || null,
        lastMile: t.last_mile_tracking_supported || false,
        checkpoints: (t.checkpoints || []).slice(0, 5).map((cp) => ({
          city: cp.city || "",
          country: cp.country_name || "",
          message: cp.message || "",
          time: cp.checkpoint_time || cp.created_at || null,
        })),
      };
    } finally {
      clearTimeout(timer);
    }
  });
}

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.data;
  const data = await loader();
  cache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

function normalizeLocation(location = "") {
  return String(location).trim().toLowerCase();
}

function buildLocationCandidates(location = "") {
  const raw = String(location || "").trim();
  if (!raw) return [];

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates = new Set();
  candidates.add(raw);

  if (parts.length > 0) {
    candidates.add(parts[0]);
    candidates.add(parts[parts.length - 1]);
  }
  if (parts.length > 1) {
    candidates.add(`${parts[parts.length - 2]}, ${parts[parts.length - 1]}`);
  }

  // Bias toward India for this dataset.
  for (const c of Array.from(candidates)) {
    if (!/india/i.test(c)) candidates.add(`${c}, India`);
  }

  return Array.from(candidates).filter(Boolean);
}

async function geocodeLocation(location) {
  const key = `geo:${normalizeLocation(location)}`;
  return cached(key, 1000 * 60 * 60 * 6, async () => {
    if (!location) return null;
    const attempts = buildLocationCandidates(location);
    let row = null;
    for (const name of attempts) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
      const json = await fetchJson(url).catch(() => null);
      row = json?.results?.[0];
      if (row) break;
    }
    if (!row) return null;
    return {
      name: row.name,
      admin1: row.admin1,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
    };
  });
}

function weatherCodeToText(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
  };
  return map[code] || "Unknown";
}

async function getWeatherForLocation(location) {
  const geo = await geocodeLocation(location);
  if (!geo) return null;

  const key = `wx:${geo.latitude}:${geo.longitude}`;
  return cached(key, 1000 * 60 * 8, async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`;
    const json = await fetchJson(url);
    const cur = json?.current;
    if (!cur) return null;
    return {
      location: [geo.name, geo.admin1, geo.country].filter(Boolean).join(", "),
      temperatureC: cur.temperature_2m,
      humidity: cur.relative_humidity_2m,
      windKmh: cur.wind_speed_10m,
      precipitationMm: cur.precipitation,
      weatherCode: cur.weather_code,
      weatherText: weatherCodeToText(cur.weather_code),
      observedAt: cur.time,
      source: "Open-Meteo",
    };
  });
}

function productToBenchmark(productName = "") {
  const n = productName.toLowerCase();
  if (/(rice|basmati)/.test(n)) return { symbol: "ZR=F", label: "Rough Rice Futures" };
  if (/(wheat|atta)/.test(n)) return { symbol: "ZW=F", label: "Wheat Futures" };
  if (/(maize|corn)/.test(n)) return { symbol: "ZC=F", label: "Corn Futures" };
  if (/(soy|moong|chana|toor|dal|pulse)/.test(n)) return { symbol: "ZS=F", label: "Soybean Futures" };
  if (/(cotton)/.test(n)) return { symbol: "CT=F", label: "Cotton Futures" };
  if (/(sugar)/.test(n)) return { symbol: "SB=F", label: "Sugar Futures" };
  return { symbol: "ZC=F", label: "Corn Futures" };
}

async function getBenchmarkQuote(symbol, label) {
  const key = `quote:${symbol}`;
  const raw = await cached(key, 1000 * 45, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`;
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const close = result?.indicators?.quote?.[0]?.close || [];
    const latestClose = [...close].reverse().find((v) => typeof v === "number");
    const price = meta?.regularMarketPrice ?? latestClose ?? meta?.previousClose ?? null;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
    const changePct = price && previousClose ? Number((((price - previousClose) / previousClose) * 100).toFixed(2)) : null;

    return {
      symbol,
      price,
      previousClose,
      changePct,
      currency: "USD",
      marketTime: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      source: "Yahoo Finance",
    };
  });
  return { ...raw, label };
}

async function getUsdInr() {
  return cached("fx:USDINR", 1000 * 60 * 10, async () => {
    const json = await fetchJson("https://open.er-api.com/v6/latest/USD");
    return {
      pair: "USD/INR",
      rate: json?.rates?.INR || null,
      updatedAt: json?.time_last_update_utc || null,
      source: "Open Exchange Rates (ERAPI)",
    };
  });
}

function buildLogisticsSignal(currentWeather) {
  if (!currentWeather) {
    return { risk: "Unknown", etaImpactMinutes: 0, note: "No weather telemetry available." };
  }
  const riskScore =
    (currentWeather.precipitationMm >= 5 ? 40 : currentWeather.precipitationMm >= 1 ? 20 : 0) +
    (currentWeather.windKmh >= 35 ? 30 : currentWeather.windKmh >= 20 ? 15 : 0);
  if (riskScore >= 50) {
    return { risk: "High", etaImpactMinutes: 35, note: "Heavy weather can delay shipment updates." };
  }
  if (riskScore >= 20) {
    return { risk: "Medium", etaImpactMinutes: 15, note: "Moderate weather may impact transit pace." };
  }
  return { risk: "Low", etaImpactMinutes: 5, note: "Weather conditions are favorable for transport." };
}

function estimateInrBenchmark(quote, usdInr) {
  if (!quote?.price || !usdInr?.rate) return null;
  return Number((quote.price * usdInr.rate).toFixed(2));
}

async function getRealtimeOverview({ productName, originLocation, currentLocation }) {
  const bench = productToBenchmark(productName);

  const [quote, fx, originWeather, currentWeather] = await Promise.all([
    getBenchmarkQuote(bench.symbol, bench.label).catch(() => null),
    getUsdInr().catch(() => null),
    getWeatherForLocation(originLocation).catch(() => null),
    getWeatherForLocation(currentLocation || originLocation).catch(() => null),
  ]);

  const effectiveCurrentWeather = currentWeather || originWeather || null;
  const logistics = buildLogisticsSignal(effectiveCurrentWeather);
  const benchmarkInr = estimateInrBenchmark(quote, fx);

  return {
    updatedAt: new Date().toISOString(),
    productName,
    benchmark: {
      ...quote,
      approximateInr: benchmarkInr,
    },
    forex: fx,
    weather: {
      origin: originWeather,
      current: effectiveCurrentWeather,
    },
    logistics,
  };
}

async function getRealtimeForBatch(batchId) {
  const batch = await bc.getBatch(Number(batchId));
  const steps = await bc.getSupplyChainSteps(Number(batchId));
  const latestStep = steps.length ? steps[steps.length - 1] : null;
  const logisticsMeta = bc.getLogisticsForBatch(Number(batchId));
  const base = await getRealtimeOverview({
    productName: batch.productName,
    originLocation: batch.originLocation,
    currentLocation: latestStep?.location || batch.originLocation,
  });
  const liveTracking = await fetchAfterShipTracking({
    carrier: logisticsMeta?.carrier,
    trackingNumber: logisticsMeta?.trackingNumber,
  }).catch(() => null);

  return {
    ...base,
    logistics: {
      ...base.logistics,
      tracking: liveTracking,
      trackingConfigured: Boolean(logisticsMeta?.carrier && logisticsMeta?.trackingNumber),
      trackingProvider: logisticsMeta?.provider || null,
      carrier: logisticsMeta?.carrier || null,
      trackingNumber: logisticsMeta?.trackingNumber || null,
    },
  };
}

async function getTicker() {
  const contracts = [
    { symbol: "ZR=F", label: "Rice" },
    { symbol: "ZW=F", label: "Wheat" },
    { symbol: "ZC=F", label: "Corn" },
    { symbol: "ZS=F", label: "Soybean" },
    { symbol: "SB=F", label: "Sugar" },
    { symbol: "CT=F", label: "Cotton" },
  ];
  const rows = [];
  for (const c of contracts) {
    try {
      // Avoid bursting Yahoo endpoint.
      if (rows.length) await sleep(120);
      const q = await getBenchmarkQuote(c.symbol, c.label);
      rows.push({ label: c.label, ...q });
    } catch {
      rows.push({ label: c.label, symbol: c.symbol, price: null, changePct: null, currency: "USD" });
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    source: "Yahoo Finance",
    rows,
  };
}

module.exports = {
  getRealtimeOverview,
  getRealtimeForBatch,
  getTicker,
};

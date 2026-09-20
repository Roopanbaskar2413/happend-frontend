// Live conditions for wherever the visitor actually is — not tied to any one
// destination. Open-Meteo needs no API key. Everything here is best-effort: the
// caller must treat failure/denial as normal and fall back to decorative-only theming.

const WEATHER_LABELS = {
  0: "clear skies",
  1: "clear skies",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "foggy",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  56: "freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "freezing rain",
  80: "rain showers",
  81: "rain showers",
  82: "heavy showers",
  95: "thunderstorms",
  96: "thunderstorms",
  99: "severe thunderstorms",
};

function classify(code) {
  if (code === 0 || code === 1) return "clear";
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  return "clear";
}

export function getUserLocation({ timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("geolocation unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: timeoutMs, maximumAge: 10 * 60 * 1000 }
    );
  });
}

export async function getWeatherFor(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather fetch failed: ${res.status}`);
  const data = await res.json();
  const code = data.current.weather_code;
  return {
    condition: classify(code),
    label: WEATHER_LABELS[code] ?? "mixed conditions",
    temperatureC: Math.round(data.current.temperature_2m),
    windKph: Math.round(data.current.wind_speed_10m),
    isHot: data.current.temperature_2m >= 35,
    isWindy: data.current.wind_speed_10m >= 25,
  };
}

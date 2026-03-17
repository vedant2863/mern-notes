/**
 * ============================================================
 *  FILE 8 : The Jugaad Adapter — Adapter Pattern
 *  Topic  : Adapter (Wrapper)
 *  Where you'll see this: API wrappers, payment gateways, storage layers
 * ============================================================
 */

// STORY: Electrician Pappu converts foreign laptop chargers to fit
// Indian 3-pin sockets using jugaad adapters near Nehru Place.

console.log("=== FILE 08: The Jugaad Adapter ===\n");

// ────────────────────────────────────
// BLOCK 1 — Object Adapter (wrapping a third-party API)
// ────────────────────────────────────

console.log("--- Block 1: Object Adapter ---");

// Foreign weather API — we cannot change this
const foreignWeatherAPI = {
  fetch_weather(city_name) {
    return {
      city_name: city_name,
      temp_fahrenheit: 72,
      wind_speed_mph: 5,
      conditions: "partly_cloudy",
    };
  },
};

// Our app expects: getWeather(city) -> { city, tempCelsius, windKmh, description }

class WeatherAdapter {
  constructor(foreignAPI) {
    this._api = foreignAPI;
  }

  getWeather(city) {
    const raw = this._api.fetch_weather(city);

    // Convert the description from snake_case to readable text
    const words = raw.conditions.split("_");
    const description = words.join(" ");

    return {
      city: raw.city_name,
      tempCelsius: Math.round((raw.temp_fahrenheit - 32) * (5 / 9)),
      windKmh: Math.round(raw.wind_speed_mph * 1.609),
      description: description,
    };
  }
}

const weather = new WeatherAdapter(foreignWeatherAPI);
const report = weather.getWeather("Delhi");
console.log(report.city + ": " + report.tempCelsius + "C, " + report.windKmh + " km/h, " + report.description);

// ────────────────────────────────────
// BLOCK 2 — Class Adapter (extends the foreign class)
// ────────────────────────────────────

console.log("\n--- Block 2: Class Adapter ---");

class RazorpayishProcessor {
  createCharge(amountInPaise, currencyCode) {
    const id = "pay_" + Date.now();
    return {
      id: id,
      amount: amountInPaise,
      currency: currencyCode,
      status: "succeeded",
    };
  }
}

// Our app expects: pay(rupees) -> { transactionId, amount, success }

class PaymentAdapter extends RazorpayishProcessor {
  pay(rupees, currency) {
    const paise = Math.round(rupees * 100);
    const result = this.createCharge(paise, currency || "inr");
    return {
      transactionId: result.id,
      amount: rupees,
      success: result.status === "succeeded",
    };
  }
}

const txn = new PaymentAdapter().pay(499.99);
console.log("Transaction:", txn.transactionId, "| Amount:", txn.amount, "| Success:", txn.success);

// ────────────────────────────────────
// BLOCK 3 — Sync Storage to Async Storage Adapter
// ────────────────────────────────────

console.log("\n--- Block 3: Sync -> Async Storage Adapter ---");

// Simulated localStorage (Node.js doesn't have one)
const localStorageSim = {
  _store: new Map(),

  getItem(key) {
    if (this._store.has(key)) return this._store.get(key);
    return null;
  },
  setItem(key, value) {
    this._store.set(key, String(value));
  },
  removeItem(key) {
    this._store.delete(key);
  },
};

class AsyncStorageAdapter {
  constructor(syncStorage) {
    this._storage = syncStorage;
  }

  async getItem(key) {
    const raw = this._storage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  async setItem(key, value) {
    this._storage.setItem(key, JSON.stringify(value));
  }

  async removeItem(key) {
    this._storage.removeItem(key);
  }
}

async function storageDemo() {
  const storage = new AsyncStorageAdapter(localStorageSim);

  await storage.setItem("user", { name: "Pappu", role: "electrician" });
  const user = await storage.getItem("user");
  console.log("User:", user.name, "|", user.role);

  await storage.removeItem("user");
  console.log("After removal:", await storage.getItem("user")); // null
}

storageDemo();

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Adapter wraps an incompatible interface to match what you expect.
// 2. Object Adapter: wrap the foreign object inside (delegation).
// 3. Class Adapter: extend the foreign class and add your interface.
// 4. Adapters change the INTERFACE, not the functionality.

console.log("\n=== Pappu packs his adapters and heads to the next customer. ===");

/** ============================================================
 *  FILE 02: REST API DESIGN
 *  ============================================================
 *  Topics: REST principles, URI design, CRUD mapping, versioning,
 *          pagination, filtering, HATEOAS, idempotency
 *
 *  WHY THIS MATTERS:
 *  REST is the dominant API style. Badly designed APIs lead to
 *  confusion, breaking changes, and angry developers. A well-
 *  designed REST API is intuitive, scalable, and evolvable.
 *  ============================================================ */

// STORY: Swiggy Restaurant API
// Every restaurant on Swiggy is a "resource" with a unique URI.
// Scrolling for more restaurants is pagination. Filtering by
// cuisine maps to query parameters. The entire Swiggy experience
// is a REST API underneath.

console.log("=".repeat(70));
console.log("  FILE 02: REST API DESIGN");
console.log("=".repeat(70));
console.log();

// ================================================================
// SECTION 1 — REST Principles
// ================================================================

// WHY: REST is a set of constraints (statelessness, uniform
// interface, etc.) that make APIs predictable and scalable.

console.log("--- SECTION 1: REST Principles ---\n");

const restPrinciples = [
  { name: "Client-Server",    example: "Swiggy app and backend evolve independently", violation: "Server sending UI HTML mixed with data" },
  { name: "Statelessness",    example: "Every call includes auth token -- no server session", violation: "Server remembering page between requests" },
  { name: "Cacheability",     example: "Menu cached 5min; cart total cannot be cached", violation: "Dynamic data with no Cache-Control header" },
  { name: "Uniform Interface", example: "GET /restaurants/123 always means fetch #123", violation: "POST /getRestaurant with body {id: 123}" },
  { name: "Layered System",   example: "Client cannot tell if talking to server, CDN, or LB", violation: "Client needs to know internal topology" },
];

restPrinciples.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.name}`);
  console.log(`     Example: ${p.example}`);
  console.log(`     Violation: ${p.violation}\n`);
});

// ================================================================
// SECTION 2 — URI Design Best Practices
// ================================================================

// WHY: URIs are the nouns of your API. Good URIs are self-
// documenting -- developers should guess them without docs.

console.log("--- SECTION 2: URI Design ---\n");

console.log("  GOOD URIs:");
const goodURIs = [
  ["GET /api/v1/restaurants",           "List all restaurants"],
  ["GET /api/v1/restaurants/42/menu",   "Menu for restaurant 42"],
  ["POST /api/v1/orders",              "Create a new order"],
  ["GET /api/v1/users/me/orders",      "List my orders"],
  ["GET /api/v1/restaurants?cuisine=south-indian&city=bangalore", "Filter via query params"],
];
goodURIs.forEach(([uri, desc]) => console.log(`    ${uri.padEnd(55)} -> ${desc}`));

console.log("\n  BAD URIs:");
const badURIs = [
  ["GET /getRestaurant/42",  "Verb in URI -- use HTTP methods for verbs"],
  ["POST /api/createOrder",  "Should be POST /api/orders"],
  ["GET /api/Restaurants",   "Uppercase -- URIs should be lowercase"],
];
badURIs.forEach(([uri, why]) => console.log(`    ${uri.padEnd(30)} -> ${why}`));
console.log("\n  Rules: NOUNS not VERBS | Plural | Lowercase | Nest sub-resources | Query params for filters");
console.log();

// ================================================================
// SECTION 3 — CRUD to HTTP Mapping
// ================================================================

// WHY: Correct mapping ensures predictable behavior, proper
// caching, and clear semantics.

console.log("--- SECTION 3: CRUD to HTTP Mapping ---\n");

class SwiggyAPI {
  constructor() {
    this.restaurants = new Map([
      [1, { id: 1, name: "Meghana Foods", cuisine: "Biryani", city: "Bangalore", rating: 4.5 }],
      [2, { id: 2, name: "Saravana Bhavan", cuisine: "South Indian", city: "Chennai", rating: 4.3 }],
    ]);
    this.orders = new Map();
    this.nextOrderId = 100;
  }

  createOrder(data) {
    const id = this.nextOrderId++;
    const order = { id, ...data, status: "placed", createdAt: new Date().toISOString() };
    this.orders.set(id, order);
    console.log(`  POST /orders -> 201 Created: ${JSON.stringify(order)}`);
    return order;
  }

  listRestaurants(filters) {
    let results = Array.from(this.restaurants.values());
    if (filters.city) results = results.filter((r) => r.city.toLowerCase() === filters.city.toLowerCase());
    console.log(`  GET /restaurants?${new URLSearchParams(filters)} -> 200 OK (${results.length} found)`);
    results.forEach((r) => console.log(`    - ${r.name} (${r.cuisine}, ${r.city})`));
    return results;
  }

  patchOrder(id, updates) {
    const order = this.orders.get(id);
    if (!order) { console.log(`  PATCH /orders/${id} -> 404`); return null; }
    Object.assign(order, updates);
    console.log(`  PATCH /orders/${id} -> 200 OK: ${JSON.stringify(order)}`);
    return order;
  }

  cancelOrder(id) {
    if (!this.orders.has(id)) { console.log(`  DELETE /orders/${id} -> 404`); return false; }
    this.orders.delete(id);
    console.log(`  DELETE /orders/${id} -> 204 No Content`);
    return true;
  }
}

const swiggy = new SwiggyAPI();
swiggy.listRestaurants({ city: "bangalore" });
console.log();
swiggy.createOrder({ restaurantId: 1, items: ["Biryani", "Raita"], total: 450 });
console.log();
swiggy.patchOrder(100, { status: "preparing" });
console.log();
swiggy.cancelOrder(100);
console.log();

// ================================================================
// SECTION 4 — API Versioning Strategies
// ================================================================

// WHY: APIs evolve. Without versioning, every change breaks
// existing clients.

console.log("--- SECTION 4: API Versioning ---\n");

const versioningStrategies = [
  { name: "URI Path",      example: "/api/v1/restaurants vs /api/v2/restaurants", pros: "Simple, explicit",  cons: "URL pollution" },
  { name: "Header",        example: "Accept: application/vnd.swiggy.v2+json",   pros: "Cleanest URIs",    cons: "Hard to test" },
  { name: "Additive Only", example: "Always add fields, never remove",           pros: "No versioning",    cons: "Tech debt" },
];

versioningStrategies.forEach((v) => {
  console.log(`  ${v.name.padEnd(15)} ${v.example}`);
  console.log(`${"".padEnd(18)}Pros: ${v.pros} | Cons: ${v.cons}`);
});

console.log("\n  Recommendation: Start with URI path versioning (/v1/).");
console.log();

// ================================================================
// SECTION 5 — Pagination (Offset and Cursor)
// ================================================================

// WHY: Returning ALL restaurants would crash the app. Pagination
// returns data in manageable chunks.

console.log("--- SECTION 5: Pagination ---\n");

class PaginationDemo {
  constructor() {
    this.data = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1, name: `Restaurant-${i + 1}`, rating: (3.5 + Math.random() * 1.5).toFixed(1),
    }));
  }

  offsetPaginate(page, limit) {
    const offset = (page - 1) * limit;
    const items = this.data.slice(offset, offset + limit);
    const totalPages = Math.ceil(this.data.length / limit);
    console.log(`  Offset: GET /restaurants?page=${page}&limit=${limit}`);
    console.log(`    Items: ${items.map((r) => r.name).join(", ")}`);
    console.log(`    Page ${page}/${totalPages}. Problem: duplicates if data shifts.`);
  }

  cursorPaginate(afterId, limit) {
    let start = afterId ? this.data.findIndex((r) => r.id === afterId) + 1 : 0;
    const items = this.data.slice(start, start + limit);
    const nextCursor = items.length ? items[items.length - 1].id : null;
    console.log(`  Cursor: GET /restaurants?after=${afterId || "start"}&limit=${limit}`);
    console.log(`    Items: ${items.map((r) => r.name).join(", ")}`);
    console.log(`    Next cursor: ${nextCursor}. Advantage: stable under inserts.`);
  }
}

const paginator = new PaginationDemo();
paginator.offsetPaginate(1, 5);
paginator.cursorPaginate(null, 5);
paginator.cursorPaginate(5, 5);
console.log();

// ================================================================
// SECTION 6 — Filtering and Sorting
// ================================================================

// WHY: Users need to narrow results. Swiggy lets you filter by
// cuisine, rating, delivery time -- all via query params.

console.log("--- SECTION 6: Filtering and Sorting ---\n");

class FilterEngine {
  constructor(data) { this.data = data; }
  apply(params) {
    let result = [...this.data];
    if (params.cuisine) result = result.filter((r) => r.cuisine === params.cuisine);
    if (params.minRating) result = result.filter((r) => r.rating >= params.minRating);
    if (params.sortBy) {
      const order = params.sortOrder === "desc" ? -1 : 1;
      result.sort((a, b) => (a[params.sortBy] > b[params.sortBy] ? order : -order));
    }
    return result;
  }
}

const restaurants = [
  { name: "Meghana Foods", cuisine: "Biryani", rating: 4.5, deliveryTime: 30 },
  { name: "MTR", cuisine: "South Indian", rating: 4.4, deliveryTime: 20 },
  { name: "Paradise", cuisine: "Biryani", rating: 4.7, deliveryTime: 35 },
];

const engine = new FilterEngine(restaurants);
console.log("  GET /restaurants?cuisine=Biryani&sortBy=rating&sortOrder=desc");
engine.apply({ cuisine: "Biryani", sortBy: "rating", sortOrder: "desc" })
  .forEach((r) => console.log(`    - ${r.name} (Rating: ${r.rating})`));
console.log();

// ================================================================
// SECTION 7 — HATEOAS Links
// ================================================================

// WHY: HATEOAS makes APIs self-discoverable. The response tells
// the client what actions are available next.

console.log("--- SECTION 7: HATEOAS Links ---\n");

function buildHATEOASResponse(order) {
  const links = [{ rel: "self", href: `/api/v1/orders/${order.id}`, method: "GET" }];
  if (order.status === "placed") {
    links.push({ rel: "cancel", href: `/api/v1/orders/${order.id}`, method: "DELETE" });
    links.push({ rel: "track", href: `/api/v1/orders/${order.id}/tracking`, method: "GET" });
  }
  if (order.status === "delivered") {
    links.push({ rel: "rate", href: `/api/v1/orders/${order.id}/rating`, method: "POST" });
    links.push({ rel: "reorder", href: `/api/v1/orders`, method: "POST" });
  }
  return { ...order, _links: links };
}

console.log("  Placed order:");
console.log(JSON.stringify(buildHATEOASResponse({ id: 501, status: "placed", total: 450 }), null, 4));
console.log("\n  Delivered order:");
console.log(JSON.stringify(buildHATEOASResponse({ id: 502, status: "delivered", total: 280 }), null, 4));
console.log("\n  Available actions change based on order status.");
console.log();

// ================================================================
// SECTION 8 — Idempotency
// ================================================================

// WHY: If a user clicks "Pay" and the connection drops, did the
// payment go through? Idempotency keys prevent double-charging.

console.log("--- SECTION 8: Idempotency ---\n");

class IdempotencyDemo {
  constructor() { this.processed = new Map(); this.balance = 1000; }

  processPayment(key, amount, desc) {
    console.log(`  ${desc} (Rs ${amount}) Key: ${key}`);
    if (this.processed.has(key)) {
      console.log(`  IDEMPOTENT: Already processed! Balance: Rs ${this.balance}`);
      return this.processed.get(key);
    }
    this.balance -= amount;
    const result = { txnId: "TXN" + Date.now(), amount, balance: this.balance };
    this.processed.set(key, result);
    console.log(`  NEW: Processed. Balance: Rs ${this.balance}`);
    return result;
  }
}

const payment = new IdempotencyDemo();
const key = "order-501-pay";
payment.processPayment(key, 450, "Biryani payment");
console.log();
console.log("  ... Network timeout! User retries ...\n");
payment.processPayment(key, 450, "Biryani payment (RETRY)");
console.log("\n  Only Rs 450 deducted once, despite 2 attempts.");
console.log();

// ================================================================
// KEY TAKEAWAYS
// ================================================================
console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. REST = constraints (stateless, uniform interface), not just HTTP.");
console.log();
console.log("  2. URIs are nouns (/restaurants), HTTP methods are verbs.");
console.log();
console.log("  3. Version APIs from day one. URI path versioning is simplest.");
console.log();
console.log("  4. Cursor pagination > offset for large, changing datasets.");
console.log();
console.log("  5. Query params for filtering/sorting -- keep URIs clean.");
console.log();
console.log("  6. HATEOAS: response tells client what actions are available next.");
console.log();
console.log("  7. Idempotency keys prevent double-charging. POST is the most");
console.log("     dangerous method because it is NOT idempotent by default.");
console.log();

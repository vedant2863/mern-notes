/** ============================================================
 *  FILE 22: MONOLITH TO MICROSERVICES
 *  ============================================================
 *  Topic: Monolith, microservices, service boundaries, strangler
 *         fig, shared DB anti-pattern
 *
 *  WHY THIS MATTERS:
 *  Most companies start with a monolith because it is simple.
 *  As the product grows, it becomes a bottleneck for velocity,
 *  scaling, and reliability. Understanding safe decomposition
 *  is a critical senior engineer skill.
 *  ============================================================ */

// STORY: MakeMyTrip Evolution
// MakeMyTrip started as a single monolith for flights, hotels,
// buses, and holidays. A hotel pricing fix required redeploying
// everything — risking flight bookings. They adopted the strangler
// fig pattern, peeling off services until the monolith was hollow.

console.log("=".repeat(70));
console.log("  FILE 22: MONOLITH TO MICROSERVICES");
console.log("  Service Boundaries, Strangler Fig, Shared DB Anti-Pattern");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Monolith Architecture
// ════════════════════════════════════════════════════════════════

// WHY: Understand what a monolith looks like and why teams choose it.

console.log("--- SECTION 1: Monolith Architecture ---\n");

class MakeMyTripMonolith {
  constructor() {
    this.db = { users: [], flights: [], hotels: [], bookings: [] };
    this.nextId = 1;
    console.log("  MakeMyTrip Monolith: Single codebase | Single DB | Single deploy");
  }
  registerUser(name) { const u = { id: this.nextId++, name }; this.db.users.push(u); return u; }
  searchFlights(from, to) {
    const r = [{ id: `FL-${this.nextId++}`, from, to, price: 4500, airline: "IndiGo" }];
    this.db.flights.push(...r); return r;
  }
  searchHotels(city) {
    const r = [{ id: `HT-${this.nextId++}`, city, price: 2500, name: "OYO" }];
    this.db.hotels.push(...r); return r;
  }
  book(userId, itemId, type) {
    const b = { id: `BK-${this.nextId++}`, userId, itemId, type, status: "confirmed" };
    this.db.bookings.push(b);
    console.log(`    Booking ${b.id}: ${type} ${itemId} for user ${userId}`);
    return b;
  }
  getStats() { return Object.fromEntries(Object.entries(this.db).map(([k, v]) => [k, v.length])); }
}

const mono = new MakeMyTripMonolith();
const user = mono.registerUser("Rajesh");
const flights = mono.searchFlights("DEL", "BOM");
mono.searchHotels("Mumbai");
mono.book(user.id, flights[0].id, "flight");
console.log("  Stats:", JSON.stringify(mono.getStats()));

console.log("\n  BENEFITS: Simple dev, simple deploy, in-process calls, ACID transactions");
console.log("  DRAWBACKS: All-or-nothing scaling, deployment risk, tech lock-in, team coupling\n");

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Microservices Architecture
// ════════════════════════════════════════════════════════════════

// WHY: Microservices isolate each domain into its own deployable unit.

console.log("--- SECTION 2: Microservices Architecture ---\n");

class FlightService {
  constructor() { this.db = []; this.nextId = 1000; }
  search(from, to) {
    const r = [{ id: `FL-${this.nextId++}`, from, to, price: 4500 }];
    this.db.push(...r);
    console.log(`  [FlightService] Found ${r.length} flights ${from}->${to}`);
    return r;
  }
  book(flightId, userId) {
    console.log(`  [FlightService] Booked FBK-${this.nextId++}`);
  }
}

class HotelService {
  constructor() { this.db = []; this.nextId = 2000; }
  search(city) {
    const r = [{ id: `HT-${this.nextId++}`, city, price: 2500 }];
    this.db.push(...r);
    console.log(`  [HotelService] Found ${r.length} hotels in ${city}`);
    return r;
  }
}

const fSvc = new FlightService();
const hSvc = new HotelService();
fSvc.search("DEL", "BOM"); hSvc.search("Mumbai");
fSvc.book("FL-1000", 1);
console.log("  Each service has its own database and deploys independently\n");

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Service Boundary Identification (DDD)
// ════════════════════════════════════════════════════════════════

// WHY: Wrong boundaries create a distributed monolith — worst of both worlds.

console.log("--- SECTION 3: Service Boundary Identification (DDD) ---\n");

const domains = {
  "Flight Booking": { entities: ["Flight", "Seat", "Airline"], events: ["FlightBooked", "FlightCancelled"] },
  "Hotel Booking": { entities: ["Hotel", "Room"], events: ["HotelBooked", "HotelCancelled"] },
  "Payment": { entities: ["Payment", "Refund"], events: ["PaymentCompleted", "RefundIssued"] },
  "User Management": { entities: ["User", "Profile"], events: ["UserRegistered"] },
};
for (const [ctx, d] of Object.entries(domains)) {
  console.log(`  [${ctx}] Entities: ${d.entities.join(", ")} | Events: ${d.events.join(", ")}`);
}
console.log("\n  RULE: If two modules share no entities and communicate only through events,");
console.log("  they are separate bounded contexts.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Strangler Fig Pattern
// ════════════════════════════════════════════════════════════════

// WHY: Rewriting from scratch is risky. Strangler fig migrates
// incrementally via a routing proxy.

console.log("--- SECTION 4: Strangler Fig Pattern ---\n");

class StranglerFigMigration {
  constructor() {
    this.monolith = new MakeMyTripMonolith();
    this.flightSvc = new FlightService();
    this.hotelSvc = new HotelService();
    this.routing = { flights: "monolith", hotels: "monolith", buses: "monolith" };
  }
  route(domain, ...args) {
    const target = this.routing[domain];
    console.log(`    [Router] ${domain} -> ${target.toUpperCase()}`);
    if (target === "microservice") {
      if (domain === "flights") return this.flightSvc.search(...args);
      if (domain === "hotels") return this.hotelSvc.search(...args);
    } else {
      if (domain === "flights") return this.monolith.searchFlights(...args);
      if (domain === "hotels") return this.monolith.searchHotels(...args);
    }
  }
  migrate(domain) {
    this.routing[domain] = "microservice";
    console.log(`  Migrated "${domain}" to microservice`);
  }
}

const mig = new StranglerFigMigration();
console.log("  INITIAL — everything in monolith:");
mig.route("flights", "DEL", "BOM");
mig.migrate("flights");
console.log("  After migrating flights:");
mig.route("flights", "DEL", "BOM");
mig.migrate("hotels"); mig.migrate("buses");
console.log(`  Final routing: ${JSON.stringify(mig.routing)}`);
console.log("  Monolith is now EMPTY and can be decommissioned!\n");

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Shared Database Anti-Pattern
// ════════════════════════════════════════════════════════════════

// WHY: Multiple services sharing a DB lose independent deployability.

console.log("--- SECTION 5: Shared Database Anti-Pattern ---\n");

console.log("  ANTI-PATTERN: Both services read/write same bookings table");
console.log("  Flight team adds 'seatClass' column -> Hotel service breaks!\n");
console.log("  Problems: tight coupling, deployment lock, no encapsulation, scaling bottleneck\n");

console.log("  SOLUTION: Database Per Service");
[["FlightService", "PostgreSQL", "flights, flight_bookings"],
 ["HotelService", "MongoDB", "hotels, hotel_bookings"],
 ["PaymentService", "PostgreSQL", "payments, refunds"],
].forEach(([svc, db, tables]) => console.log(`    ${svc} -> ${db}: [${tables}]`));
console.log("    Each team picks best DB, schema changes are local, independent scaling\n");

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Inter-Service Communication
// ════════════════════════════════════════════════════════════════

// WHY: Sync vs async profoundly affects latency, coupling, and resilience.

console.log("--- SECTION 6: Inter-Service Communication ---\n");

console.log("  Synchronous (REST/gRPC):");
console.log("    Client -> FlightService -> PaymentService -> Response");
console.log("    Tight coupling, waits for response, cascading failure\n");

console.log("  Asynchronous (Events):");
class MsgBus {
  constructor() { this.subs = {}; }
  subscribe(topic, name, fn) { if (!this.subs[topic]) this.subs[topic] = []; this.subs[topic].push({ name, fn }); }
  publish(topic, msg) {
    console.log(`    [Bus] Published "${topic}"`);
    (this.subs[topic] || []).forEach(({ name, fn }) => { console.log(`      -> ${name} handling`); fn(msg); });
  }
}
const bus = new MsgBus();
bus.subscribe("booking.created", "PaymentService", (m) => console.log(`         Processing Rs.${m.amount}`));
bus.subscribe("booking.created", "NotificationService", (m) => console.log(`         Emailing user ${m.userId}`));
bus.publish("booking.created", { bookingId: "BK-201", userId: 1, amount: 4500 });

console.log("\n  Comparison:");
[["Coupling", "Tight", "Loose"], ["Latency", "Waits for response", "Fire and forget"],
 ["Failure", "Cascading", "Isolated"], ["Consistency", "Immediate", "Eventual"],
].forEach(([a, s, as]) => console.log(`    ${a.padEnd(14)} | ${s.padEnd(22)} | ${as}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — Migration Checklist
// ════════════════════════════════════════════════════════════════

// WHY: Migration requires organizational, process, and cultural
// changes beyond just technical work.

console.log("--- SECTION 7: Migration Checklist ---\n");

[{ p: "Phase 0 (Month 1-2)", t: ["Identify bounded contexts", "Map dependencies", "Deploy API gateway"] },
 { p: "Phase 1 (Month 3-4)", t: ["Pick least coupled domain", "Build new service with own DB", "Strangler fig routing"] },
 { p: "Phase 2 (Month 5-12)", t: ["Extract remaining services", "Add async messaging", "Implement distributed tracing"] },
 { p: "Phase 3 (Month 12+)", t: ["Verify zero monolith traffic", "Decommission shared DB"] },
].forEach(({ p, t }) => { console.log(`  ${p}`); t.forEach((s) => console.log(`    - ${s}`)); console.log(); });

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Start with a monolith for small teams and early products.");
console.log("  2. Use DDD bounded contexts to find correct service boundaries.");
console.log("  3. Strangler fig enables incremental migration via routing proxy.");
console.log("  4. Shared database is an anti-pattern — it couples services.");
console.log("  5. Each microservice must own its data store.");
console.log("  6. Use sync (REST/gRPC) for queries, async (events) for commands.");
console.log("  7. Migration is organizational as much as technical.");
console.log("  8. Extract the least coupled, lowest risk service first.");
console.log();
console.log('  "MakeMyTrip did not rewrite overnight. Like the strangler fig,');
console.log('   they built new services around the old system until it was');
console.log('   hollow — and then they turned it off."');
console.log();

/** ============================================================
 *  FILE 23: API GATEWAY AND SERVICE DISCOVERY
 *  ============================================================
 *  Topic: Gateway responsibilities, service registry, client/
 *         server-side discovery, sidecar pattern
 *
 *  WHY THIS MATTERS:
 *  In a microservices world, clients should not need to know
 *  addresses of dozens of services. An API Gateway provides a
 *  single entry point. Service discovery ensures services find
 *  each other dynamically as instances scale.
 *  ============================================================ */

// STORY: JioMart E-Commerce
// The API Gateway is JioMart's mall entrance — checks identity,
// directs to the right shop, and prevents overcrowding. The
// service registry is the mall directory that updates as shops
// open or close.

console.log("=".repeat(70));
console.log("  FILE 23: API GATEWAY AND SERVICE DISCOVERY");
console.log("  Routing, Auth, Rate Limiting, Registry, Sidecar");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — API Gateway Implementation
// ════════════════════════════════════════════════════════════════

// WHY: Without a gateway, every client must know every service
// address, handle auth, and manage retries independently.

console.log("--- SECTION 1: API Gateway Implementation ---\n");

console.log("  Gateway responsibilities:");
console.log("    Routing, Authentication, Rate Limiting, Load Balancing, Circuit Breaking, Logging\n");

class APIGateway {
  constructor() { this.routes = {}; this.middleware = []; this.rateLimits = {}; }
  registerRoute(path, service) { this.routes[path] = service; }
  addMiddleware(name, fn) { this.middleware.push({ name, fn }); }
  handle(req) {
    console.log(`  [Gateway] ${req.method} ${req.path}`);
    for (const mw of this.middleware) {
      const r = mw.fn(req, this);
      if (!r.pass) { console.log(`    BLOCKED by ${mw.name}: ${r.reason}`); return { status: r.status }; }
    }
    const route = Object.keys(this.routes).find((r) => req.path.startsWith(r));
    if (!route) { console.log("    404 — No matching route"); return { status: 404 }; }
    const svc = this.routes[route];
    console.log(`    Routing to ${svc.name}`);
    return { status: 200, body: `Response from ${svc.name}` };
  }
}

const gw = new APIGateway();
gw.registerRoute("/api/products", { name: "ProductService" });
gw.registerRoute("/api/cart", { name: "CartService" });
gw.registerRoute("/api/orders", { name: "OrderService" });

gw.addMiddleware("auth", (req) => {
  if (req.path.startsWith("/api/products") && req.method === "GET") return { pass: true };
  if (!req.headers || !req.headers.authorization) return { pass: false, status: 401, reason: "Missing auth token" };
  return { pass: true };
});
gw.addMiddleware("rateLimit", (req, gateway) => {
  const id = req.clientId || "anon";
  gateway.rateLimits[id] = (gateway.rateLimits[id] || 0) + 1;
  if (gateway.rateLimits[id] > 5) return { pass: false, status: 429, reason: "Rate limit exceeded" };
  return { pass: true };
});

gw.handle({ method: "GET", path: "/api/products/1", clientId: "u1" });
gw.handle({ method: "POST", path: "/api/orders", clientId: "u1" });
gw.handle({ method: "POST", path: "/api/orders", clientId: "u1", headers: { authorization: "Bearer valid-token" } });
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Service Registry
// ════════════════════════════════════════════════════════════════

// WHY: In dynamic environments, service instances come and go.
// A registry tracks which instances are alive and their location.

console.log("--- SECTION 2: Service Registry ---\n");

class ServiceRegistry {
  constructor() { this.services = {}; }
  register(name, id, host, port, meta = {}) {
    if (!this.services[name]) this.services[name] = [];
    this.services[name].push({ id, host, port, meta, status: "UP", lastHeartbeat: Date.now() });
    console.log(`  [Registry] Registered: ${name}/${id} at ${host}:${port}`);
  }
  deregister(name, id) {
    if (this.services[name]) this.services[name] = this.services[name].filter((i) => i.id !== id);
    console.log(`  [Registry] Deregistered: ${name}/${id}`);
  }
  getInstances(name) { return (this.services[name] || []).filter((i) => i.status === "UP"); }
  heartbeat(name, id) {
    const inst = (this.services[name] || []).find((i) => i.id === id);
    if (inst) inst.lastHeartbeat = Date.now();
  }
  evictStale(maxAge) {
    const now = Date.now();
    for (const instances of Object.values(this.services)) {
      instances.forEach((i) => { if (now - i.lastHeartbeat > maxAge) { i.status = "DOWN"; console.log(`  [Registry] Evicted stale: ${i.id}`); } });
    }
  }
}

const reg = new ServiceRegistry();
reg.register("product-service", "prod-1", "10.0.1.1", 8081, { version: "2.1" });
reg.register("product-service", "prod-2", "10.0.1.2", 8081, { version: "2.1" });
reg.register("cart-service", "cart-1", "10.0.2.1", 8082, { version: "1.5" });
reg.register("order-service", "order-1", "10.0.3.1", 8083, { version: "3.0" });

console.log("\n  Lifecycle: register on startup, heartbeat periodically,");
console.log("  deregister on shutdown, evict stale on crash.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Client-Side vs Server-Side Discovery
// ════════════════════════════════════════════════════════════════

// WHY: Two approaches — client queries registry directly, or LB
// handles discovery so clients stay simple.

console.log("--- SECTION 3: Client-Side vs Server-Side Discovery ---\n");

class ClientDiscovery {
  constructor(registry) { this.registry = registry; this.rrIndex = {}; }
  discover(name) {
    const instances = this.registry.getInstances(name);
    if (!instances.length) return null;
    if (!this.rrIndex[name]) this.rrIndex[name] = 0;
    const chosen = instances[this.rrIndex[name]++ % instances.length];
    console.log(`  [Client] ${name}: ${chosen.id} @ ${chosen.host}:${chosen.port}`);
    return chosen;
  }
}
console.log("Client-Side Discovery (round-robin):");
const cd = new ClientDiscovery(reg);
cd.discover("product-service"); cd.discover("product-service");
console.log("  Pros: No extra hop. Cons: Every client needs discovery logic.\n");

class ServerSideLB {
  constructor(registry) { this.registry = registry; this.rrIndex = {}; }
  route(name) {
    const inst = this.registry.getInstances(name);
    if (!inst.length) return { status: 503 };
    if (!this.rrIndex[name]) this.rrIndex[name] = 0;
    const target = inst[this.rrIndex[name]++ % inst.length];
    console.log(`  [LB] ${name} -> ${target.id} @ ${target.host}:${target.port}`);
    return { status: 200, handler: target.id };
  }
}
console.log("Server-Side Discovery (load balancer):");
const lb = new ServerSideLB(reg);
lb.route("product-service"); lb.route("product-service");
console.log("  Pros: Clients are simple. Cons: Extra hop, LB is potential bottleneck.\n");

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Sidecar Pattern
// ════════════════════════════════════════════════════════════════

// WHY: A helper process alongside each service handles discovery,
// LB, retries, and observability. Basis of service meshes (Istio).

console.log("--- SECTION 4: Sidecar Pattern ---\n");

class Sidecar {
  constructor(instanceId, registry) { this.instanceId = instanceId; this.registry = registry; }
  intercept(targetService, request) {
    console.log(`  [Sidecar:${this.instanceId}] Call to ${targetService}`);
    const inst = this.registry.getInstances(targetService);
    if (!inst.length) { console.log("    No instances!"); return { status: 503 }; }
    console.log(`    Routing to ${inst[0].id} @ ${inst[0].host}:${inst[0].port}${request.path}`);
    return { status: 200 };
  }
}
const sc = new Sidecar("cart-1", reg);
sc.intercept("product-service", { path: "/products/42" });
console.log("\n  Sidecar handles: discovery, LB, retries, circuit breaking, mTLS, metrics");
console.log("  Used in: Istio (Envoy), Linkerd, Consul Connect\n");

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Gateway Patterns and Technology
// ════════════════════════════════════════════════════════════════

// WHY: Real gateways implement BFF, aggregation, canary routing.

console.log("--- SECTION 5: Gateway Patterns and Technology ---\n");

[["Backend for Frontend (BFF)", "Separate gateways for mobile, web, third-party"],
 ["Request Aggregation", "Combine multiple service calls into one response"],
 ["Canary Routing", "Route 5% traffic to new version"],
 ["Edge Authentication", "Validate tokens at gateway, pass X-User-Id downstream"],
].forEach(([name, desc]) => console.log(`  ${name}: ${desc}`));

console.log("\n  API Gateways: Kong, AWS API Gateway, Envoy, Traefik");
console.log("  Service Discovery: Consul, etcd, ZooKeeper, Eureka, Kubernetes DNS\n");

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. API Gateway is the single entry point: routing, auth, rate limiting.");
console.log("  2. Service Registry keeps a live directory of running instances.");
console.log("  3. Client-side discovery: client queries registry, controls LB.");
console.log("  4. Server-side discovery: LB sits between client and registry.");
console.log("  5. Sidecar pattern offloads discovery and security from app code.");
console.log("  6. Health checks detect degraded instances faster than heartbeats.");
console.log("  7. BFF gives each client type its own optimized gateway.");
console.log();
console.log('  "Just as JioMart\'s mall entrance guides every customer to the right');
console.log('   shop, an API Gateway shields clients from the chaos of microservices."');
console.log();

/** ============================================================
 *  FILE 30: DESIGN A NOTIFICATION SYSTEM
 *  ============================================================
 *  Topic: Multi-channel delivery (push/SMS/email), priority queues,
 *         template engine, user preferences, rate limiting
 *
 *  WHY THIS MATTERS:
 *  Swiggy sends 100M+ notifications daily. Too many = opt-outs,
 *  too few = missed orders. Smart routing, rate limiting, and
 *  prioritization determine if users stay or uninstall.
 *  ============================================================ */

// STORY: Swiggy Order Notifications
// Rahul orders biryani: push "Order Confirmed", SMS backup if push
// fails, push "Raju is on the way", push "Arriving in 5 min", email
// receipt. Each respects preferences and rate limits, even during
// IPL final night with 10M simultaneous orders.

console.log("=".repeat(70));
console.log("  FILE 30: DESIGN A NOTIFICATION SYSTEM");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Requirements and Channel Comparison
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1 — Requirements and Channel Comparison");
console.log("-".repeat(50));

console.log("  Channel Comparison:");
console.log(`  ${"Channel".padEnd(10)} ${"Latency".padEnd(12)} ${"Cost".padEnd(15)} ${"Reach"}`);
console.log("  " + "-".repeat(50));
[["push", "100ms", "Free", "App installed"], ["sms", "2-5s", "Rs 0.15/msg", "Any phone"],
 ["email", "5-30s", "Rs 0.01/msg", "Has email"]
].forEach(([ch, lat, cost, reach]) => console.log(`  ${ch.padEnd(10)} ${lat.padEnd(12)} ${cost.padEnd(15)} ${reach}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Notification Types and Priority
// ════════════════════════════════════════════════════════════════

// WHY: OTP and order alerts must jump ahead of promotional notifications.

console.log("SECTION 2 — Notification Types and Priority");
console.log("-".repeat(50));

const notificationTypes = {
  ORDER_CONFIRMED:   { channels: ["push", "sms"], priority: 1, category: "order" },
  DELIVERY_ARRIVING: { channels: ["push"],        priority: 1, category: "order" },
  ORDER_DELIVERED:   { channels: ["push", "email"], priority: 2, category: "order" },
  PAYMENT_FAILED:    { channels: ["push", "sms", "email"], priority: 1, category: "payment" },
  OTP_CODE:          { channels: ["sms"],          priority: 1, category: "auth" },
  PROMO_OFFER:       { channels: ["push", "email"], priority: 4, category: "marketing" },
  RATING_REQUEST:    { channels: ["push"],         priority: 3, category: "engagement" },
};

console.log(`  ${"Type".padEnd(22)} ${"Priority".padEnd(10)} ${"Channels"}`);
Object.entries(notificationTypes).forEach(([key, nt]) => {
  const label = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"][nt.priority];
  console.log(`  ${key.padEnd(22)} ${label.padEnd(10)} ${nt.channels.join(", ")}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Priority Queue
// ════════════════════════════════════════════════════════════════

console.log("SECTION 3 — Priority Queue");
console.log("-".repeat(50));

class PriorityQueue {
  constructor() { this.queues = { 1: [], 2: [], 3: [], 4: [] }; }
  enqueue(item, priority) { this.queues[priority].push({ ...item, priority }); }
  dequeue() {
    for (let p = 1; p <= 4; p++) { if (this.queues[p].length > 0) return this.queues[p].shift(); }
    return null;
  }
  size() { let t = 0; for (let p = 1; p <= 4; p++) t += this.queues[p].length; return t; }
}

const notifQueue = new PriorityQueue();
[{ type: "PROMO_OFFER", message: "50% off biryani!", priority: 4 },
 { type: "ORDER_CONFIRMED", message: "Order #123 confirmed", priority: 1 },
 { type: "OTP_CODE", message: "OTP: 847291", priority: 1 },
 { type: "RATING_REQUEST", message: "Rate your order", priority: 3 },
].forEach(item => notifQueue.enqueue(item, item.priority));

console.log("Dequeuing (highest priority first):");
let item, order = 1;
while ((item = notifQueue.dequeue()) !== null) {
  const label = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"][item.priority];
  console.log(`  ${order++}. [${label.padEnd(8)}] ${item.message}`);
}
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Template Engine
// ════════════════════════════════════════════════════════════════

// WHY: Templates ensure consistent messaging and easy localization.

console.log("SECTION 4 — Template Engine");
console.log("-".repeat(50));

class TemplateEngine {
  constructor() { this.templates = new Map(); }
  register(id, template) { this.templates.set(id, template); }
  render(id, variables) {
    const template = this.templates.get(id);
    if (!template) return null;
    const rendered = {};
    for (const [channel, ct] of Object.entries(template.channels)) {
      let body = ct.body || "";
      for (const [key, value] of Object.entries(variables)) body = body.split(`{{${key}}}`).join(String(value));
      rendered[channel] = { title: ct.title || "", body };
    }
    return rendered;
  }
}

const templateEngine = new TemplateEngine();
templateEngine.register("ORDER_CONFIRMED", {
  channels: {
    push: { title: "Order Confirmed!", body: "Order #{{orderId}} from {{restaurant}}. Rs {{amount}}. ETA: {{eta}} min." },
    sms: { title: "", body: "Swiggy: Order #{{orderId}} from {{restaurant}}. Rs {{amount}}. ETA: {{eta}} min." }
  }
});

const rendered = templateEngine.render("ORDER_CONFIRMED", { orderId: "SW-789", restaurant: "Paradise Biryani", amount: "450", eta: "35" });
console.log("  ORDER_CONFIRMED:");
Object.entries(rendered).forEach(([ch, c]) => console.log(`    [${ch.toUpperCase()}] ${c.body}`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — User Preferences and Rate Limiting
// ════════════════════════════════════════════════════════════════

// WHY: Users must control channels. Rate limiting prevents fatigue.

console.log("SECTION 5 — User Preferences and Rate Limiting");
console.log("-".repeat(50));

class UserPreferences {
  constructor() { this.preferences = new Map(); }
  setDefaults(userId) {
    this.preferences.set(userId, {
      channels: { push: true, sms: true, email: true },
      categories: { order: true, payment: true, marketing: true, auth: true, engagement: true },
      quietHours: { start: 23, end: 7 }
    });
  }
  disableCategory(userId, category) {
    const p = this.preferences.get(userId);
    if (p) p.categories[category] = false;
  }
  disableChannel(userId, channel) {
    const p = this.preferences.get(userId);
    if (p) p.channels[channel] = false;
  }
  resolveChannels(userId, notifType) {
    const p = this.preferences.get(userId);
    if (!p) return [];
    const config = notificationTypes[notifType];
    if (!config || !p.categories[config.category]) return [];
    return config.channels.filter(ch => p.channels[ch]);
  }
}

class RateLimiter {
  constructor() {
    this.limits = { push: { perHour: 10, perDay: 30 }, sms: { perHour: 3, perDay: 5 }, email: { perHour: 2, perDay: 10 } };
    this.counters = new Map();
  }
  checkAndIncrement(userId, channel, priority) {
    if (priority === 1) return { allowed: true, reason: "Critical bypasses rate limit" };
    const key = `${userId}:${channel}`;
    if (!this.counters.has(key)) this.counters.set(key, { hourly: 0, daily: 0 });
    const c = this.counters.get(key), l = this.limits[channel];
    if (!l) return { allowed: true };
    if (c.hourly >= l.perHour) return { allowed: false, reason: `Hourly limit (${l.perHour})` };
    if (c.daily >= l.perDay) return { allowed: false, reason: `Daily limit (${l.perDay})` };
    c.hourly++; c.daily++;
    return { allowed: true, remaining: l.perHour - c.hourly };
  }
}

const userPrefs = new UserPreferences();
userPrefs.setDefaults("rahul");
userPrefs.disableCategory("rahul", "marketing");

console.log("Channel resolution for Rahul (marketing disabled):");
["ORDER_CONFIRMED", "PROMO_OFFER", "OTP_CODE"].forEach(type => {
  const channels = userPrefs.resolveChannels("rahul", type);
  console.log(`  ${type.padEnd(20)} -> [${channels.join(", ") || "NONE"}]`);
});

const rateLimiter = new RateLimiter();
console.log("\nRate limiting IPL night promos:");
for (let i = 1; i <= 12; i++) {
  const r = rateLimiter.checkAndIncrement("rahul", "push", 4);
  if (i <= 3 || i >= 10) console.log(`  Push #${String(i).padStart(2)}: ${r.allowed ? "ALLOWED" : "BLOCKED"} ${r.reason || ""}`);
  else if (i === 4) console.log("  ...");
}
console.log("\nCritical OTP always passes:");
console.log(`  OTP SMS: ${rateLimiter.checkAndIncrement("rahul", "sms", 1).allowed ? "ALLOWED" : "BLOCKED"} (critical)`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Notification Router and Delivery Tracking
// ════════════════════════════════════════════════════════════════

// WHY: Router combines preferences + rate limits + templates + fallback.

console.log("SECTION 6 — Notification Router and Delivery Tracking");
console.log("-".repeat(50));

class NotificationRouter {
  constructor(preferences, rateLimiter, templateEngine) {
    this.preferences = preferences; this.rateLimiter = rateLimiter; this.templateEngine = templateEngine;
    this.stats = { delivered: 0, skipped: 0 };
  }
  route(userId, notifType, variables) {
    const channels = this.preferences.resolveChannels(userId, notifType);
    if (!channels.length) { this.stats.skipped++; return { deliveries: [], skipped: "No channels" }; }
    const config = notificationTypes[notifType];
    const deliveries = [];
    channels.forEach(ch => {
      const r = this.rateLimiter.checkAndIncrement(userId, ch, config.priority);
      if (!r.allowed) { this.stats.skipped++; return; }
      const rendered = this.templateEngine.render(notifType, variables);
      const content = rendered && rendered[ch] ? rendered[ch] : { body: `${notifType}: ${JSON.stringify(variables)}` };
      deliveries.push({ channel: ch, body: content.body });
      this.stats.delivered++;
    });
    return { deliveries };
  }
}

const router = new NotificationRouter(
  (() => { const p = new UserPreferences(); p.setDefaults("rahul"); return p; })(),
  new RateLimiter(),
  templateEngine
);

console.log("Swiggy order notification flow:\n");
[{ type: "ORDER_CONFIRMED", vars: { orderId: "SW-789", restaurant: "Paradise Biryani", amount: "450", eta: "35" } },
 { type: "DELIVERY_ARRIVING", vars: { deliveryPerson: "Raju", eta: "3", restaurant: "Paradise Biryani" } },
].forEach(n => {
  const result = router.route("rahul", n.type, n.vars);
  console.log(`  ${n.type}:`);
  result.deliveries.forEach(d => console.log(`    [${d.channel.toUpperCase()}] ${d.body.substring(0, 70)}`));
  if (result.skipped) console.log(`    [SKIPPED] ${result.skipped}`);
});

console.log(`\n  Stats: ${router.stats.delivered} delivered, ${router.stats.skipped} skipped`);
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Priority queues ensure OTP and order alerts are sent before promos.");
console.log("  2. Template engines enable consistent messaging across channels.");
console.log("  3. User preferences must be respected — wrong channel = uninstall.");
console.log("  4. Rate limiting prevents notification fatigue (10 push/hr, 5 SMS/day).");
console.log("  5. Critical notifications (OTP, payment) bypass rate limits and quiet hours.");
console.log("  6. Fallback channels (push fails -> SMS) ensure delivery reliability.");
console.log("  7. During surge events (IPL nights), the queue absorbs load spikes.");
console.log();
console.log('  "The best notification is one the user wanted, on the channel');
console.log('   they prefer, at the time they expected it."');
console.log();

/**
 * ============================================================
 *  FILE 11 : The Facade Pattern
 *  Topic   : Facade, Simplified Interface
 *  Impact  : Express middleware stacks, AWS SDK wrappers,
 *            React custom hooks that combine multiple API calls
 * ============================================================
 */

// STORY: IRCTC is India's single window for railway bookings.
// Passengers never deal with PNR, coach, or payment directly —
// one bookTicket() call handles everything.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Facade over a Complex Subsystem
// ────────────────────────────────────────────────────────────

class PNRService {
  generatePNR(train) {
    return "PNR generated for train " + train;
  }
}

class CoachAllotment {
  assignCoach(passenger) {
    return "Coach B2 allotted to " + passenger;
  }
}

class PaymentGateway {
  processPayment(amount) {
    return "Payment of Rs." + amount + " processed via UPI";
  }
}

// The Facade — one method instead of three
class IRCTCBooking {
  constructor() {
    this.pnr = new PNRService();
    this.coach = new CoachAllotment();
    this.payment = new PaymentGateway();
  }

  bookTicket(passenger, train, fare) {
    let steps = [];
    steps.push(this.pnr.generatePNR(train));
    steps.push(this.coach.assignCoach(passenger));
    steps.push(this.payment.processPayment(fare));
    return steps;
  }
}

console.log("=== BLOCK 1: Facade over Complex Subsystem ===");
const irctc = new IRCTCBooking();
let results = irctc.bookTicket("Ramesh Kumar", "Rajdhani Express", 2450);
for (let i = 0; i < results.length; i++) {
  console.log(results[i]);
}

// ────────────────────────────────────────────────────────────
// BLOCK 2 — API Facade (combining multiple service calls)
// ────────────────────────────────────────────────────────────

class PassengerService {
  getPassenger(id) {
    return { id: id, name: "Sunita Devi" };
  }
}

class TicketService {
  getTickets(passengerId) {
    return [
      { id: "T1", train: "Rajdhani Express" },
      { id: "T2", train: "Shatabdi Express" },
    ];
  }
}

class WaitlistManager {
  getPosition(passengerId) {
    return 7;
  }
}

// One call replaces three separate calls
class DashboardFacade {
  constructor() {
    this.passengers = new PassengerService();
    this.tickets = new TicketService();
    this.waitlist = new WaitlistManager();
  }

  getDashboard(passengerId) {
    let passenger = this.passengers.getPassenger(passengerId);
    let tickets = this.tickets.getTickets(passengerId);
    return {
      name: passenger.name,
      totalBookings: tickets.length,
      waitlistPosition: this.waitlist.getPosition(passengerId),
    };
  }
}

console.log("\n=== BLOCK 2: API Facade ===");
let data = new DashboardFacade().getDashboard(1);
console.log("Passenger: " + data.name);
console.log("Bookings: " + data.totalBookings);
console.log("Waitlist: " + data.waitlistPosition);

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Facade for Complex Initialization
// ────────────────────────────────────────────────────────────

class Database {
  connect() {
    this.connected = true;
    return "Database connected";
  }
}

class Cache {
  warm() {
    this.ready = true;
    return "Cache warmed";
  }
}

class SMSService {
  init(provider) {
    this.provider = provider;
    return "SMS initialized (" + provider + ")";
  }
}

class IRCTC {
  constructor() {
    this.db = new Database();
    this.cache = new Cache();
    this.sms = new SMSService();
  }

  // Callers just call init() — no need to know the order
  init() {
    let steps = [];
    steps.push(this.sms.init("BSNL"));
    steps.push(this.db.connect());
    steps.push(this.cache.warm());
    steps.push("IRCTC is ready");
    return steps;
  }
}

console.log("\n=== BLOCK 3: Complex Initialization Facade ===");
let bootSteps = new IRCTC().init();
for (let i = 0; i < bootSteps.length; i++) {
  console.log(bootSteps[i]);
}

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. A Facade wraps a complex subsystem behind one simple method.
// 2. It does NOT add new behavior — it delegates to existing parts.
// 3. Callers stay decoupled from internal classes.
// 4. Common in SDK wrappers, API aggregation, app bootstrap.

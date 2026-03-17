/**
 * ============================================================
 *  FILE 13 : The Bridge Pattern
 *  Topic   : Bridge, Abstraction/Implementation Separation
 *  Impact  : Cross-platform rendering, notification services,
 *            database drivers in ORMs like Prisma/Sequelize
 * ============================================================
 */

// STORY: UIDAI runs the Aadhaar notification system. Notification
// types (KYC, OTP) are separate from delivery channels (SMS, Email).
// Operator Mehra can swap either side without touching the other.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Notification Type + Delivery Channel Bridge
// ────────────────────────────────────────────────────────────

// Without Bridge: SMSKyc, SMSOTP, EmailKyc, EmailOTP = 4 classes
// With Bridge: 2 types + 2 channels = 4 classes but M+N not MxN

class SMSChannel {
  deliver(to, subject, body) {
    return "SMS to " + to + ": [" + subject + "] " + body;
  }
}

class EmailChannel {
  deliver(to, subject, body) {
    return "EMAIL to " + to + ": [" + subject + "] " + body;
  }
}

class WhatsAppChannel {
  deliver(to, subject, body) {
    return "WHATSAPP to " + to + ": [" + subject + "] " + body;
  }
}

// Each notification holds a reference to a channel — this IS the bridge
class KYCUpdate {
  constructor(channel) {
    this.channel = channel;
  }

  send(to, details) {
    let body = "Your KYC has been updated: " + details;
    return this.channel.deliver(to, "KYC UPDATE", body);
  }
}

class OTPNotification {
  constructor(channel) {
    this.channel = channel;
  }

  send(to, otp) {
    let body = "Your Aadhaar OTP is " + otp;
    return this.channel.deliver(to, "OTP", body);
  }
}

class SchemeAlert {
  constructor(channel) {
    this.channel = channel;
  }

  send(to, scheme) {
    let body = "You are eligible for: " + scheme;
    return this.channel.deliver(to, "SCHEME ALERT", body);
  }
}

console.log("=== BLOCK 1: Notification + Channel Bridge ===");
let sms = new SMSChannel();
let email = new EmailChannel();
let whatsapp = new WhatsAppChannel();

console.log(new KYCUpdate(sms).send("+919876543210", "address changed"));
console.log(new KYCUpdate(email).send("mehra@uidai.gov.in", "address changed"));
console.log(new OTPNotification(whatsapp).send("+919876543210", "482913"));
console.log(new SchemeAlert(sms).send("+919876543210", "PM Kisan Yojana"));

console.log("Combos possible: 9, Classes written: 6");

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Data Persistence Bridge
// ────────────────────────────────────────────────────────────

class RESTBackend {
  save(collection, data) {
    return "REST POST /" + collection + " " + JSON.stringify(data);
  }

  load(collection, id) {
    return "REST GET /" + collection + "/" + id;
  }
}

class GraphQLBackend {
  save(collection, data) {
    let fields = Object.keys(data).join(", ");
    return "mutation { create" + collection + "(" + fields + ") }";
  }

  load(collection, id) {
    return "query { " + collection + "(id: " + id + ") { ...fields } }";
  }
}

// The Model holds the bridge to any backend
class Model {
  constructor(collection, backend) {
    this.collection = collection;
    this.backend = backend;
  }

  save(data) {
    return this.backend.save(this.collection, data);
  }

  findById(id) {
    return this.backend.load(this.collection, id);
  }
}

console.log("\n=== BLOCK 2: Data Persistence Bridge ===");
let rest = new RESTBackend();
let gql = new GraphQLBackend();

let citizenRest = new Model("Citizen", rest);
let citizenGql = new Model("Citizen", gql);

console.log(citizenRest.save({ name: "Mehra", role: "operator" }));
console.log(citizenGql.findById("c1"));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Bridge separates abstraction from implementation — both vary independently.
// 2. Avoids class explosion: MxN combos become M+N classes.
// 3. The bridge is the reference the abstraction holds to its implementation.
// 4. Common in notification channels, persistence backends, rendering engines.

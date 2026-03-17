// ============================================================
// FILE 16: CONDITIONALS
// Topic: Decision-making — if/else, ternary, switch, logical assignment
// WHY: Every program must make choices. Mastering conditionals
//      means writing logic that is both correct and readable.
// ============================================================

// ============================================================
// EXAMPLE 1 — IRCTC Ticket Booking Journey
// Story: A passenger books a train ticket on IRCTC.
// Every choice leads to a different booking outcome.
// ============================================================

// --- if, else if, else ---

const seatsAvailable = 75;

if (seatsAvailable <= 0) {
  console.log("Train fully booked — try Tatkal tomorrow.");
} else if (seatsAvailable < 30) {
  console.log("Hurry! Only a few seats left.");
} else {
  console.log("Seats available! Proceed with booking.");
}

// --- Ternary Operator ---

const documents = ["aadhaar", "pan-card", "passport"];
const canBookTatkal = documents.includes("aadhaar") ? "Yes" : "No";
console.log("Can book Tatkal?", canBookTatkal);

// Avoid nested ternaries — use early returns instead
function getStatusMessage(status) {
  if (status === "confirmed") return "Your berth is confirmed!";
  if (status === "waiting") return "You are on the waitlist...";
  if (status === "rac") return "RAC — you get a side berth.";
  return "Check PNR status again.";
}
console.log(getStatusMessage("waiting"));

// --- switch with break and fall-through ---

const chosenClass = "AC3";

switch (chosenClass) {
  case "Sleeper":
    console.log("Sleeper Class — affordable and breezy.");
    break;
  case "AC3":
    console.log("AC 3-Tier — comfortable with AC.");
    break;
  case "AC2":
    console.log("AC 2-Tier — extra space and privacy.");
    break;
  default:
    console.log("Invalid class.");
}

// Intentional fall-through — multiple cases share one outcome
const coachType = "3A";
switch (coachType) {
  case "3A":
  case "3E":
  case "CC":
    console.log("AC coach — blankets provided!");
    break;
  case "SL":
  case "2S":
    console.log("Non-AC coach — carry your own bedding.");
    break;
  default:
    console.log("Unknown coach type.");
}


// ============================================================
// EXAMPLE 2 — Logical Assignment Operators
// Story: The passenger manages booking preferences
// using modern assignment shortcuts.
// ============================================================

// --- ||= assigns if falsy ---
let passengerName = "";
passengerName ||= "Guest Passenger";
console.log(passengerName); // Guest Passenger

// CAUTION: 0 is falsy, so ||= WILL reassign it
let loyaltyPoints = 0;
loyaltyPoints ||= 100;
console.log(loyaltyPoints); // 100

// --- ??= assigns only if null/undefined ---
let waitlistPosition = 0;
waitlistPosition ??= 3;
console.log(waitlistPosition); // 0 (preserved — 0 is not null)

let quotaType = null;
quotaType ??= "General";
console.log(quotaType); // General

// --- &&= assigns only if truthy ---
let activeBooking = "PNR-4523178";
activeBooking &&= `${activeBooking} [CONFIRMED]`;
console.log(activeBooking); // PNR-4523178 [CONFIRMED]

let cancelledBooking = null;
cancelledBooking &&= `${cancelledBooking} [REFUNDED]`;
console.log(cancelledBooking); // null (falsy — no assignment)

// --- Practical: building a config with defaults ---
function startBooking(options = {}) {
  options.passengerName ??= "Guest";
  options.travelClass ??= "Sleeper";
  options.meals ??= 1;
  options.seatPreference ||= "lower_berth";
  console.log("Booking config:", options);
}
startBooking({ passengerName: "Sharma ji", seatPreference: "" });


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. if/else handles any condition — most readable for
//    complex branching logic.
// 2. Ternary is great for simple inline decisions.
//    AVOID nesting ternaries.
// 3. switch compares one value against many cases; use break
//    unless you want fall-through.
// 4. ||= assigns when falsy — watch out with 0 and "".
// 5. ??= assigns only when null/undefined — safe for 0 and "".
// 6. &&= assigns only when truthy — augment existing values.
// ============================================================

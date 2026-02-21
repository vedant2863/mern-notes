/**
 * ============================================================
 *  FILE 23: call(), apply(), and bind()
 * ============================================================
 *  Topic: Explicitly setting the value of `this` when
 *         invoking or creating functions.
 *
 *  Why it matters: These three methods give you full manual
 *  control over `this`. They let you borrow methods, set
 *  context for callbacks, and create partially applied
 *  functions — all essential patterns in real codebases.
 * ============================================================
 *
 *  STORY: Think of functions as freelance chefs for hire.
 *  With call() and apply() you invite Chef sahab for a one-time
 *  catering gig — you hand him a kitchen (thisArg) and he
 *  cooks the dish immediately. With bind() Chef sahab signs a
 *  permanent contract: a brand-new function is returned that
 *  will ALWAYS cook for that kitchen, no matter who calls
 *  him later.
 * ============================================================
 */

// ============================================================
//  EXAMPLE 1 — Freelance Chefs: call() and apply()
// ============================================================

// WHY: Sometimes a function lives on one object but you need
// it to operate on another. call() and apply() invoke the
// function immediately with a chosen `this`.

// ----- Our freelance chef function -----
function cookDish(ingredient, style) {
  return `${this.name} prepares ${ingredient} in "${style}" style!`;
}

const sharmaKitchen = { name: "Sharma ji's Kitchen" };
const guptaKitchen  = { name: "Gupta ji's Kitchen" };

// ----- call(): arguments listed one by one -----
console.log("--- call() ---");
console.log(cookDish.call(sharmaKitchen, "paneer and spices", "Mughlai"));
// Output: Sharma ji's Kitchen prepares paneer and spices in "Mughlai" style!

console.log(cookDish.call(guptaKitchen, "dal and rice", "Rajasthani"));
// Output: Gupta ji's Kitchen prepares dal and rice in "Rajasthani" style!

// ----- apply(): arguments passed as an array -----
console.log("\n--- apply() ---");
const guptaOrder = ["chole and kulche", "Punjabi Dhaba"];
console.log(cookDish.apply(guptaKitchen, guptaOrder));
// Output: Gupta ji's Kitchen prepares chole and kulche in "Punjabi Dhaba" style!

// apply() is handy when you already have arguments in an array.
const bills = [1100, 2100, 501, 5100, 251];
console.log("Max bill:", Math.max.apply(null, bills));
// Output: Max bill: 5100
// (Modern alternative: Math.max(...bills))

// ----- Method borrowing -----
console.log("\n--- Method borrowing ---");
const streetVendor = {
  name: "Raju Chaat Corner",
  serve(item) {
    return `${this.name} serves ${item} with extra masala`;
  },
};

// Borrow streetVendor's method for Sharma kitchen — a one-time job.
console.log(streetVendor.serve.call(sharmaKitchen, "pani puri"));
// Output: Sharma ji's Kitchen serves pani puri with extra masala

// The freelance chef (serve) temporarily worked for Sharma ji
// but still belongs to the street vendor.
console.log(streetVendor.serve("dahi bhalla"));
// Output: Raju Chaat Corner serves dahi bhalla with extra masala


// ============================================================
//  EXAMPLE 2 — Signing a Contract: bind()
// ============================================================

// WHY: bind() does NOT invoke the function. It returns a NEW
// function with `this` permanently locked. This is critical
// for callbacks (event handlers, setTimeout, etc.) where you
// need the context to stick.

const cateringNetwork = {
  name: "Delhi Tiffin Service",
  motto: "Ghar jaisa khana",
  announce() {
    return `Network: ${this.name} — "${this.motto}"`;
  },
  deliverAfterDelay() {
    // Without bind, setTimeout would lose `this`.
    setTimeout(
      function () {
        console.log(`[Lost context] Network: ${this?.name || "UNKNOWN"}`);
        // Output: [Lost context] Network: UNKNOWN
      },
      100
    );

    // With bind, `this` is locked to cateringNetwork.
    setTimeout(
      function () {
        console.log(`[Bound context] Network: ${this.name}`);
        // Output: [Bound context] Network: Delhi Tiffin Service
      }.bind(this),
      200
    );
  },
};

console.log("\n--- bind() basic ---");
const boundAnnounce = cateringNetwork.announce.bind(cateringNetwork);

// Even though we detach it, `this` stays locked.
const detached = boundAnnounce;
console.log(detached());
// Output: Network: Delhi Tiffin Service — "Ghar jaisa khana"

console.log("\n--- bind() with setTimeout ---");
cateringNetwork.deliverAfterDelay();

// ----- Partial application with bind -----
console.log("\n--- Partial application ---");

function prepareDish(base, item, topping) {
  return `Prepared ${base} ${item} with ${topping} topping`;
}

// Lock the first argument; the rest are supplied later.
const prepareButter = prepareDish.bind(null, "butter");
console.log(prepareButter("chicken", "cream"));
// Output: Prepared butter chicken with cream topping

console.log(prepareButter("paneer", "kasuri methi"));
// Output: Prepared butter paneer with kasuri methi topping

// Lock two arguments.
const prepareButterChicken = prepareDish.bind(null, "butter", "chicken");
console.log(prepareButterChicken("tandoori masala"));
// Output: Prepared butter chicken with tandoori masala topping


// ============================================================
//  call vs apply vs bind — Quick Reference
// ============================================================
//
//  Method  | Invokes immediately? | Args format        | Returns
//  --------|----------------------|--------------------|----------
//  call()  | YES                  | comma-separated    | result
//  apply() | YES                  | array              | result
//  bind()  | NO                   | comma-separated    | new fn
//
//  Mnemonic:
//    call  = C for Commas
//    apply = A for Array
//    bind  = B for "Bound" (a new function, for later)
// ============================================================

console.log("\n--- Quick demo comparing all three ---");

function reportDelivery(location, status) {
  return `${this.name} at ${location}: ${status}`;
}

const deliveryBoy = { name: "Raju from Swiggy" };

// call — immediate, comma args
console.log("call: ", reportDelivery.call(deliveryBoy, "Sharma Niwas", "order delivered"));
// Output: call:  Raju from Swiggy at Sharma Niwas: order delivered

// apply — immediate, array args
console.log("apply:", reportDelivery.apply(deliveryBoy, ["Gupta Bhawan", "cooking in progress"]));
// Output: apply: Raju from Swiggy at Gupta Bhawan: cooking in progress

// bind — deferred, returns new function
const boundReport = reportDelivery.bind(deliveryBoy, "Verma Villa");
console.log("bind: ", boundReport("on the way"));
// Output: bind:  Raju from Swiggy at Verma Villa: on the way


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. call() and apply() invoke a function immediately with a
//    chosen `this`. The only difference is how you pass args:
//    commas (call) vs array (apply).
// 2. bind() returns a NEW function with `this` permanently
//    locked — it does NOT call the original.
// 3. Method borrowing: use call/apply to run one object's
//    method in the context of another object.
// 4. Partial application: bind() can pre-fill arguments,
//    creating specialized versions of general functions.
// 5. In modern JS, arrow functions and spread syntax reduce
//    the need for apply/bind, but knowing all three is
//    essential for reading existing codebases.
// ============================================================

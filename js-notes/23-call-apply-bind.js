/**
 * ============================================================
 *  FILE 23: call(), apply(), and bind()
 * ============================================================
 *  Topic: Explicitly setting `this` when invoking functions.
 * ============================================================
 *
 *  STORY: Functions are freelance chefs. call() and apply()
 *  hire one for a one-time gig — hand him a kitchen (thisArg)
 *  and he cooks immediately. bind() signs a permanent contract:
 *  a new function that ALWAYS cooks for that kitchen.
 * ============================================================
 */

// ============================================================
//  BLOCK 1 — call() and apply()
// ============================================================

// call() invokes immediately, args comma-separated.
// apply() invokes immediately, args as an array.

function cookDish(ingredient, style) {
  return `${this.name} prepares ${ingredient} in "${style}" style!`;
}

const sharmaKitchen = { name: "Sharma ji's Kitchen" };
const guptaKitchen  = { name: "Gupta ji's Kitchen" };

console.log("--- call() ---");
console.log(cookDish.call(sharmaKitchen, "paneer", "Mughlai"));
console.log(cookDish.call(guptaKitchen, "dal", "Rajasthani"));

console.log("\n--- apply() ---");
console.log(cookDish.apply(guptaKitchen, ["chole", "Punjabi"]));

// apply() is handy when args are already in an array
const bills = [1100, 2100, 501, 5100, 251];
console.log("Max bill:", Math.max.apply(null, bills)); // 5100

// --- Method borrowing ---
console.log("\n--- Method borrowing ---");
const vendor = {
  name: "Raju Chaat Corner",
  serve(item) { return `${this.name} serves ${item}`; },
};

// Borrow vendor's method for Sharma kitchen
console.log(vendor.serve.call(sharmaKitchen, "pani puri"));


// ============================================================
//  BLOCK 2 — bind()
// ============================================================

// bind() does NOT invoke — it returns a NEW function
// with `this` permanently locked.

const network = {
  name: "Delhi Tiffin Service",
  motto: "Ghar jaisa khana",
  announce() {
    return `Network: ${this.name} — "${this.motto}"`;
  },
};

console.log("\n--- bind() basic ---");
const boundAnnounce = network.announce.bind(network);
console.log(boundAnnounce());

// --- Partial application with bind ---
console.log("\n--- Partial application ---");

function prepareDish(base, item, topping) {
  return `Prepared ${base} ${item} with ${topping}`;
}

const prepareButter = prepareDish.bind(null, "butter");
console.log(prepareButter("chicken", "cream"));
console.log(prepareButter("paneer", "kasuri methi"));


// ============================================================
//  SECTION — Quick Reference
// ============================================================
//
//  Method  | Invokes? | Args format     | Returns
//  --------|----------|-----------------|----------
//  call()  | YES      | comma-separated | result
//  apply() | YES      | array           | result
//  bind()  | NO       | comma-separated | new fn
//
//  Mnemonic: Call=Commas, Apply=Array, Bind=Bound (for later)


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. call() and apply() invoke immediately with a chosen `this`.
//    Only difference: commas (call) vs array (apply).
// 2. bind() returns a NEW function with `this` permanently locked.
// 3. Method borrowing: call/apply run one object's method
//    in the context of another.
// 4. Partial application: bind() can pre-fill arguments.
// 5. Arrow functions and spread reduce the need for apply/bind,
//    but all three are essential for reading existing code.
// ============================================================

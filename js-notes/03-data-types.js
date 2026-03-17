/**
 * ============================================================
 *  FILE 3 : Data Types
 * ============================================================
 *  Topic  : 7 primitives + 1 non-primitive (object).
 *           typeof quirks. Primitive vs reference copy behaviour.
 *
 *  WHY: Every value belongs to a type. Understanding types prevents
 *  bugs like "my object changed when I only edited the copy."
 * ============================================================
 */

// STORY: You're the billing clerk at Sharma ji's Kirana Store.
// Every product and price is a JavaScript data type.

// ────────────────────────────────────────────────────────────
// SECTION 1 — The 7 Primitive Types
// ────────────────────────────────────────────────────────────

const productName = "Toor Dal";                    // string
const pricePerKg = 75;                             // number (64-bit float)
const annualRevenue = 9007199254740993n;            // bigint
const inStock = true;                              // boolean
let discountCoupon;                                // undefined
const pendingReturn = null;                        // null
const uniqueReceiptId = Symbol("receipt_001");     // symbol

console.log(typeof productName);     // "string"
console.log(typeof pricePerKg);      // "number"
console.log(typeof annualRevenue);   // "bigint"
console.log(typeof inStock);         // "boolean"
console.log(typeof discountCoupon);  // "undefined"
console.log(typeof pendingReturn);   // "object"  <-- FAMOUS BUG!
console.log(typeof uniqueReceiptId); // "symbol"

// ────────────────────────────────────────────────────────────
// SECTION 2 — The 1 Non-Primitive: Object
// ────────────────────────────────────────────────────────────

const customerDetails = { name: "Verma ji", loyaltyPoints: 12 };
const shoppingList = ["Toor Dal", "Amul Butter", "Aashirvaad Atta"];

console.log(typeof customerDetails);  // "object"
console.log(typeof shoppingList);     // "object" (arrays are objects)
console.log(typeof function(){});     // "function" (special case)

// ────────────────────────────────────────────────────────────
// SECTION 3 — typeof Quirks
// ────────────────────────────────────────────────────────────

// typeof null === "object"  — legacy bug, check with value === null
console.log(null === null);                  // true
console.log(Array.isArray(shoppingList));     // true (proper array check)

// ────────────────────────────────────────────────────────────
// SECTION 4 — Primitive vs Reference: Copy Behaviour
// ────────────────────────────────────────────────────────────

// Primitives: copy by value (independent)
let originalStock = 100;
let clonedStock = originalStock;
clonedStock = 80;
console.log("Original:", originalStock, "| Clone:", clonedStock);
// 100 | 80 — completely independent

// Objects: copy by reference (shared)
const originalProduct = { name: "Toor Dal", price: 50 };
const clonedProduct = originalProduct; // same object!
clonedProduct.price = 999;
console.log("Original price:", originalProduct.price); // 999 — OOPS!

// ────────────────────────────────────────────────────────────
// SECTION 5 — How to Actually Copy an Object
// ────────────────────────────────────────────────────────────

// Shallow copy with spread
const originalItem = { name: "Amul Butter", price: 40, offers: { festive: 10 } };
const itemCopy = { ...originalItem };
itemCopy.price = 60;
console.log("Original price:", originalItem.price); // 40 (safe)

// But nested objects are still shared!
itemCopy.offers.festive = 99;
console.log("Original festive:", originalItem.offers.festive); // 99 (shared!)

// Deep copy with structuredClone
const originalCombo = { name: "Festival Pack", contents: { dal: 50, ghee: 30 } };
const comboDeep = structuredClone(originalCombo);
comboDeep.contents.dal = 999;
console.log("Original dal:", originalCombo.contents.dal); // 50 (independent!)

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. 7 primitive types + 1 non-primitive (object).
// 2. typeof null === "object" is a legacy bug — use === null.
// 3. Arrays are objects; use Array.isArray() to check.
// 4. Primitives copy by VALUE — independent copies.
// 5. Objects copy by REFERENCE — both point to the same data.
// 6. Spread { ...obj } for shallow copies,
//    structuredClone(obj) for deep copies.
// ============================================================

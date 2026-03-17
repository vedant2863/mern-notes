// ============================================================
// FILE 14: CLOSURES INTERNALS IN V8
// Topic: How V8 stores closures, Context objects, and memory implications
// WHY: Every event handler and callback creates a closure. V8 allocates
// heap-based Context objects to keep captured variables alive.
// Understanding this reveals why some patterns silently leak memory.
// ============================================================

// ============================================================
// SECTION 1 — What Is a Closure at the Engine Level?
// Story: Myntra displays 50+ products per page. Each "Add to Cart"
// button captures that product's ID and price via a V8 Context object.
// ============================================================

function createProductHandler(productId, price) {
    // V8 creates a Context object on the heap: { productId, price }
    return function addToCart() {
        // Hidden [[Environment]] slot points to that Context
        console.log(`Adding product ${productId} (Rs.${price}) to cart`);
    };
}

const handler1 = createProductHandler("SHIRT-001", 999);
handler1();  // Adding product SHIRT-001 (Rs.999) to cart

// ============================================================
// SECTION 2 — V8 Context Objects: Stack vs Heap
// Story: Myntra's recommendation engine saw unexpected memory
// growth. Understanding Context objects explained why.
// ============================================================

// WHY: When inner functions capture variables, V8 moves them to a
// Context object on the HEAP. Non-captured vars die with the stack.

//   STACK (short-lived)         HEAP (long-lived)
//   ┌─────────────────┐       ┌──────────────────┐
//   │ createHandler()  │──────►│ Context Object   │
//   │  captured var    │       │  captured: "..."  │
//   │  localVar = 42   │       └────────┬─────────┘
//   └─────────────────┘       handler.[[Environment]]
//   (gone after return)

function demonstrateContext() {
    let captured = "I live on the heap!";
    let notCaptured = "I die with the stack frame";
    // V8 only puts 'captured' in Context (escape analysis)
    return function inner() { console.log(captured); };
}
demonstrateContext()();  // "I live on the heap!"

// ============================================================
// SECTION 3 — Context Chain (Nested Closures)
// Story: Myntra's filter: category -> brand -> price. Each level
// captures variables, forming a chain of Context objects.
// ============================================================

function categoryFilter(category) {
    return function brandFilter(brand) {
        return function priceFilter(maxPrice) {
            console.log(`Filter: ${category} > ${brand} < Rs.${maxPrice}`);
        };
    };
}
categoryFilter("Shirts")("Nike")(2000);
//   priceFilter.[[Env]] → Context{maxPrice} → Context{brand} → Context{category}

// ============================================================
// SECTION 4 — The Shared Context Problem
// Story: ALL inner functions in one scope share a SINGLE Context.
// Even if each only uses one variable, everything stays alive.
// ============================================================

// WHY: V8 creates ONE shared Context per scope. This causes
// "accidental capture" — the #1 closure memory leak pattern.

function createProductCard(product) {
    const name = product.name;
    const price = product.price;
    const hugeImageData = new Array(100000).fill(0);  // 800KB+

    function getName() { return name; }
    function getPrice() { return price; }
    // ALL three share ONE Context: { name, price, hugeImageData }
    // Even if we only keep getName(), hugeImageData stays alive!
    return { getName, getPrice };
}
const card = createProductCard({ name: "T-Shirt", price: 999 });
console.log("Name:", card.getName());

// ============================================================
// SECTION 5 — Fixing Accidental Capture
// Story: A timer callback in the same scope as a large dataset
// kept it alive forever, even though the callback never used it.
// ============================================================

// THE LEAK:
function setupPage_LEAKY() {
    const products = new Array(50000).fill({ name: "item" });  // ~4MB
    const pageTitle = "Myntra Sale";
    const timer = setInterval(() => { /* only uses pageTitle */ }, 60000);
    return () => clearInterval(timer);
}

// THE FIX: separate scopes
function setupPage_FIXED() {
    const count = (() => {
        const products = new Array(50000).fill({ name: "item" });
        return products.length;  // products eligible for GC
    })();
    const pageTitle = "Myntra Sale";
    const timer = setInterval(() => { /* pageTitle + count are small */ }, 60000);
    return () => clearInterval(timer);
}
const c1 = setupPage_LEAKY(), c2 = setupPage_FIXED();
c1(); c2();
console.log("FIX: Move large data into separate function scope");

// ============================================================
// SECTION 6 — eval() Forces Full Context Capture
// Story: Legacy code with eval() forced V8 to capture EVERY
// variable, causing 10x memory usage.
// ============================================================

function normalClosure() {
    const a = 1, b = 2, hugeData = new Array(10000);
    return function() { return a; };  // Only 'a' captured
}
function evalClosure() {
    const a = 1, b = 2, hugeData = new Array(10000);
    return function(code) { return eval(code); };  // ALL captured!
}
console.log("Normal captures only 'a':", normalClosure()());
console.log("eval captures everything:", evalClosure()("hugeData.length"));  // 10000

// ============================================================
// SECTION 7 — Arrow Functions Capture `this` via Closure
// Story: Arrow functions don't have their own `this`. They
// capture it from the enclosing scope via the Context object.
// ============================================================

class ProductCard {
    constructor(name, price) { this.name = name; this.price = price; }
    setupHandlers() {
        const arrowH = () => console.log(`  Arrow: ${this.name} @ Rs.${this.price}`);
        const regularH = function() { console.log(`  Regular: ${this ? this.name : "undefined"}`); };
        return { arrowH, regularH };
    }
}
const { arrowH, regularH } = new ProductCard("Kurta", 1299).setupHandlers();
arrowH();     // Arrow: Kurta @ Rs.1299 (this captured in Context)
regularH();   // Regular: undefined (this depends on call site)

// ============================================================
// SECTION 8 — Classic Loop Closure Problem
// Story: var in loops — all closures share ONE variable.
// let creates a fresh Context per iteration.
// ============================================================

const handlers = [];
for (var i = 0; i < 5; i++) handlers.push(function() { return i; });
console.log("var loop:", handlers.map(h => h()));  // [5,5,5,5,5]

const handlersLet = [];
for (let k = 0; k < 5; k++) handlersLet.push(function() { return k; });
console.log("let loop:", handlersLet.map(h => h()));  // [0,1,2,3,4]

// ============================================================
// SECTION 9 — Closure vs Class: Memory Trade-off
// Story: Classes share methods via prototype. Closures create
// new function objects per instance.
// ============================================================

function createCounterClosure() {
    let count = 0;
    return { inc() { count++; }, get() { return count; } };
}
class CounterClass {
    #count = 0;
    inc() { this.#count++; }
    get() { return this.#count; }
}

const N = 100000;
console.time("Closure x" + N); for (let i = 0; i < N; i++) createCounterClosure(); console.timeEnd("Closure x" + N);
console.time("Class x" + N); for (let i = 0; i < N; i++) new CounterClass(); console.timeEnd("Class x" + N);
console.log("Classes share methods via prototype → less memory");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. A closure = function + V8 Context object on the heap
//    holding captured variables.
//
// 2. ONE shared Context per scope — ALL inner functions share it.
//    This causes "accidental capture" memory leaks.
//
// 3. Fix leaks: separate scopes for large data, nullify refs,
//    use WeakRef, or event delegation.
//
// 4. eval() forces V8 to capture EVERY variable (avoid it).
//
// 5. Arrow functions capture `this` via closure; regular
//    functions get `this` at call time.
//
// 6. Classes are more memory-efficient than closures for many
//    instances (shared prototype methods).
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("FILE 14 COMPLETE — Closures Internals");
console.log("=".repeat(60));

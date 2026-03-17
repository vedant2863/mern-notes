// ============================================================
// FILE 07: HIDDEN CLASSES AND SHAPES
// Topic: How V8 organizes objects internally for fast property access
// WHY: Every object gets a hidden blueprint called a "hidden class."
//   Understanding this unlocks why some patterns are 10x faster
//   and why property order matters more than you'd think.
// ============================================================

// ============================================================
// SECTION 1 — What is a Hidden Class?
// Story: V8 doesn't use a hash map for properties. It creates a
//   "hidden class" describing layout, like a C struct.
// ============================================================

// Hidden class = a descriptor telling V8:
//   1. What properties does this object have?
//   2. In what ORDER were they added?
//   3. At what OFFSET in memory is each property stored?
//
//   HC0: {} → add "id" → HC1: {id@0} → add "name" → HC2: {id@0, name@1}

function createProduct(id, name, price) {
    const product = {};
    product.id = id;       // HC0 → HC1
    product.name = name;   // HC1 → HC2
    product.price = price; // HC2 → HC3
    return product;
}

const product1 = createProduct(1, "iPhone 15", 79999);
const product2 = createProduct(2, "Samsung S24", 69999);

// Both share the SAME hidden class HC3
// Accessing product2.price = go to offset 2 → done!
console.log("product1:", product1);
console.log("product2:", product2);
console.log("Both share the same hidden class — fast offset-based access!\n");


// ============================================================
// SECTION 2 — Why Property Order Matters
// Story: Same properties in different order = DIFFERENT hidden
//   classes, doubling memory overhead and slowing access.
// ============================================================

function createOrderA(orderId, restaurant, total) {
    const order = {};
    order.orderId = orderId;       // orderId first
    order.restaurant = restaurant;
    order.total = total;
    return order;
}

function createOrderB(orderId, restaurant, total) {
    const order = {};
    order.restaurant = restaurant; // restaurant first — different order!
    order.orderId = orderId;
    order.total = total;
    return order;
}

const orderA = createOrderA("ORD001", "Biryani Blues", 450);
const orderB = createOrderB("ORD002", "Pizza Hut", 799);

console.log("orderA and orderB have DIFFERENT hidden classes due to property order!\n");


// ============================================================
// SECTION 3 — Inline Caches (ICs)
// Story: When a function always receives same-shape objects, V8's
//   Inline Cache remembers the property offset — no lookup needed.
// ============================================================

// WHY: ICs "remember" the hidden class at a code location.
// Same shape every time = cache hit = instant access.

// --- Monomorphic IC (1 shape — FAST) ---
function getBalance(wallet) {
    return wallet.balance;  // IC remembers: "balance is at offset 1"
}

const wallet1 = { userId: "U001", balance: 5000 };
const wallet2 = { userId: "U002", balance: 12000 };
console.log("Balance 1:", getBalance(wallet1));  // IC initialized
console.log("Balance 2:", getBalance(wallet2));  // IC hit — same shape!

// --- Megamorphic IC (5+ shapes — SLOW) ---
function getName(obj) { return obj.name; }

const shapes = [
    { name: "Alice" },
    { name: "Bob", age: 25 },
    { name: "Charlie", age: 30, city: "Delhi" },
    { name: "Diana", role: "admin" },
    { name: "Eve", score: 95, grade: "A" },
    { name: "Frank", x: 1, y: 2, z: 3 },
];
shapes.forEach(obj => getName(obj));
console.log("6 different shapes → IC gives up → slow dictionary lookup!");

//  IC State     │ # Shapes │ Speed
//  Monomorphic  │  1       │ Fastest
//  Polymorphic  │  2-4     │ Fast
//  Megamorphic  │  5+      │ Slow
console.log();


// ============================================================
// SECTION 4 — The delete Operator Destroys Hidden Classes
// Story: Using `delete` on a property kicks V8 out of fast mode.
//   The object becomes a slow hash-map-based dictionary.
// ============================================================

// BAD: delete destroys hidden class
const order = { id: 1, item: "Biryani", deliveryNotes: "" };
delete order.deliveryNotes;  // Now in "slow mode"!
console.log("After delete — object in slow dictionary mode:", order);

// GOOD: set to undefined instead
const orderGood = { id: 2, item: "Dosa", deliveryNotes: "" };
orderGood.deliveryNotes = undefined;  // Hidden class preserved!
console.log("Using undefined — still in fast mode:", orderGood);
console.log();


// ============================================================
// SECTION 5 — Initialize ALL Properties Upfront
// Story: Conditional property addition creates multiple hidden
//   classes. Always initialize everything for consistent shapes.
// ============================================================

// BAD: conditional properties
function createClothingBad(name, price, discount) {
    const item = { name, price };
    if (discount) item.discount = discount;
    if (price > 2000) item.isPremium = true;
    return item;  // Multiple possible shapes!
}

// GOOD: always present, default values
function createClothingGood(name, price, discount) {
    return {
        name,
        price,
        discount: discount || 0,
        isPremium: price > 2000,
    };
}

console.log("BAD shapes vary:", createClothingBad("Shirt", 999, null));
console.log("GOOD same shape:", createClothingGood("Shirt", 999, null));
console.log();


// ============================================================
// SECTION 6 — Classes are Hidden-Class Friendly
// Story: ES6 class constructors guarantee same property order
//   for every instance — automatic shape consistency.
// ============================================================

class Reward {
    constructor(userId, points, tier) {
        this.userId = userId;
        this.points = points;
        this.tier = tier;
        this.redeemed = false;
        this.expiresAt = null;
        this.history = [];
    }
}

const r1 = new Reward("U100", 5000, "Gold");
const r2 = new Reward("U200", 12000, "Platinum");
console.log("All Reward instances share the same hidden class:", r1, r2);
console.log();


// ============================================================
// SECTION 7 — Performance Benchmark
// ============================================================

function benchmarkSameShape() {
    const products = [];
    for (let i = 0; i < 100000; i++) {
        products.push({ id: i, name: "Product " + i, price: i * 10 });
    }
    const start = process.hrtime.bigint();
    let total = 0;
    for (let i = 0; i < products.length; i++) total += products[i].price;
    const end = process.hrtime.bigint();
    return { total, durationMs: Number(end - start) / 1_000_000 };
}

function benchmarkDifferentShapes() {
    const products = [];
    for (let i = 0; i < 100000; i++) {
        const obj = {};
        if (i % 3 === 0) { obj.price = i * 10; obj.name = "P" + i; obj.id = i; }
        else if (i % 3 === 1) { obj.id = i; obj.price = i * 10; obj.name = "P" + i; }
        else { obj.name = "P" + i; obj.id = i; obj.price = i * 10; obj.extra = true; }
        products.push(obj);
    }
    const start = process.hrtime.bigint();
    let total = 0;
    for (let i = 0; i < products.length; i++) total += products[i].price;
    const end = process.hrtime.bigint();
    return { total, durationMs: Number(end - start) / 1_000_000 };
}

benchmarkSameShape(); benchmarkDifferentShapes(); // warm up
const sameResult = benchmarkSameShape();
const diffResult = benchmarkDifferentShapes();

console.log("=== Performance Benchmark ===");
console.log(`Same shape:      ${sameResult.durationMs.toFixed(2)} ms`);
console.log(`Different shapes: ${diffResult.durationMs.toFixed(2)} ms`);
console.log(`Mixed shapes are ~${(diffResult.durationMs / sameResult.durationMs).toFixed(1)}x slower`);
console.log();


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. V8 assigns a "hidden class" to every object describing its
//    property layout — names, order, and memory offsets.
//
// 2. Same properties in same order = same hidden class = fast access.
//    Different order = different class, even with identical properties.
//
// 3. Inline Caches remember hidden classes at property access sites.
//    Monomorphic (1 shape) = fast. Megamorphic (5+) = slow.
//
// 4. `delete` destroys hidden classes. Use `= undefined` instead.
//
// 5. Always initialize ALL properties in constructors, same order.
//    Use classes or factory functions for consistency.
// ============================================================

console.log("=== FILE 07 COMPLETE ===\n");

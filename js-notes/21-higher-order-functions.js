// ============================================================
// FILE 21: HIGHER-ORDER FUNCTIONS
// Topic: Functions that accept/return functions — callbacks,
//        composition, currying, partial application
// WHY: Higher-order functions are the heart of functional JS.
//      They enable abstract, reusable, composable logic.
// ============================================================

// ============================================================
// EXAMPLE 1 — The Maruti Suzuki Assembly Line
// Story: Each station on the line is a function — stations
// can be swapped, chained, and configured on the fly.
// ============================================================

// --- Functions That Take Functions (Callbacks) ---

function assemblyLine(cars, stationFn) {
  return cars.map(stationFn);
}

const rawBodies = ["alto", "swift", "baleno", "brezza"];
const painted = assemblyLine(rawBodies, (car) => car.toUpperCase());
console.log(painted); // [ 'ALTO', 'SWIFT', 'BALENO', 'BREZZA' ]

// Quality gate — splits items by a test function
function qualityGate(items, testFn) {
  const passed = [], failed = [];
  for (const item of items) {
    (testFn(item) ? passed : failed).push(item);
  }
  return { passed, failed };
}

const inventory = [
  { name: "Engine Block", rating: 92 },
  { name: "Steering Column", rating: 45 },
  { name: "Transmission Unit", rating: 97 },
];
const qc = qualityGate(inventory, (p) => p.rating >= 80);
console.log("Passed:", qc.passed.map((p) => p.name));

// --- Functions That Return Functions ---

function createStamper(prefix) {
  let serial = 0;
  return (model) => `${prefix}-${String(++serial).padStart(4, "0")}-${model}`;
}

const comStamper = createStamper("COM");
console.log(comStamper("Eeco"));      // COM-0001-Eeco
console.log(comStamper("SuperCarry")); // COM-0002-SuperCarry

// --- Composition: compose() and pipe() ---

function compose(...fns) {
  return (value) => fns.reduceRight((acc, fn) => fn(acc), value);
}

function pipe(...fns) {
  return (value) => fns.reduce((acc, fn) => fn(acc), value);
}

const clean = (s) => s.trim().toLowerCase();
const stamp = (s) => `MARUTI-${s}`;
const pack  = (s) => `[DISPATCHED: ${s}]`;

const processModel = pipe(clean, stamp, pack);
console.log(processModel("  Swift DZire  "));
// [DISPATCHED: MARUTI-swift dzire]


// ============================================================
// EXAMPLE 2 — Currying & Partial Application
// ============================================================

// --- Currying: f(a, b, c) => f(a)(b)(c) ---

const configureCar = (platform) => (engine) => (trim) =>
  `${platform} + ${engine} + ${trim}`;

console.log(configureCar("Heartect")("K-Series")("ZXi+"));

// Generic curry utility
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}

function assembleCar(platform, engine, trim) {
  return `${platform} + ${engine} + ${trim}`;
}

const curriedAssemble = curry(assembleCar);
console.log(curriedAssemble("Heartect")("K-Series")("ZXi+"));
console.log(curriedAssemble("Heartect", "K-Series")("ZXi+"));

// --- Partial Application: pre-fill some arguments ---

function partial(fn, ...preset) {
  return (...later) => fn(...preset, ...later);
}

function logProduction(timestamp, plant, model, status) {
  return `[${timestamp}] ${plant} | ${model} — ${status}`;
}

const logGurgaon = partial(logProduction, "2025-06-15", "Gurgaon Plant");
console.log(logGurgaon("Swift", "ASSEMBLED"));

// .bind() also works for partial application
const logManesar = logProduction.bind(null, "2025-06-15", "Manesar Plant");
console.log(logManesar("Brezza", "SHIPPED"));

// --- Real-World: Array Methods Are Higher-Order ---

const cars = [
  { name: "Swift", weight: 890, operational: true },
  { name: "Alto", weight: 730, operational: true },
  { name: "Ciaz", weight: 1070, operational: false },
];

// Chaining filter + map + sort
const report = cars
  .filter((c) => c.operational)
  .sort((a, b) => b.weight - a.weight)
  .map((c) => `${c.name}: ${c.weight}kg`);
console.log(report); // [ 'Swift: 890kg', 'Alto: 730kg' ]

// --- Configurable Pipeline ---

const filterBy = (key, val) => (arr) => arr.filter((item) => item[key] === val);
const sortBy = (key) => (arr) => [...arr].sort((a, b) => a[key] - b[key]);
const mapTo = (fn) => (arr) => arr.map(fn);

const activeByWeight = pipe(
  filterBy("operational", true),
  sortBy("weight"),
  mapTo((c) => `${c.name}: ${c.weight}kg`)
);
console.log(activeByWeight(cars)); // [ 'Alto: 730kg', 'Swift: 890kg' ]


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. A HIGHER-ORDER FUNCTION takes a function, returns a
//    function, or both.
// 2. CALLBACKS inject behavior into reusable structures.
// 3. RETURNING FUNCTIONS creates factories with private state.
// 4. PIPE (left-to-right) and COMPOSE (right-to-left) chain
//    small functions into complex transformations.
// 5. CURRYING: f(a, b, c) => f(a)(b)(c).
// 6. PARTIAL APPLICATION pre-fills arguments for specialization.
// 7. All built-in array methods (map, filter, reduce, sort)
//    are higher-order functions.
// ============================================================

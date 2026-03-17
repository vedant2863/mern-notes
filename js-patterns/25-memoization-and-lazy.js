/**
 * FILE 25 : Memoization, Lazy Evaluation & Thunks
 * Topic   : Performance & Evaluation Patterns
 * Used in : React.memo/useMemo, lazy loading, Redux thunk
 */

// STORY: UPSC Aspirant Priya caches solved previous year questions and
// delays loading optional subject notes until she actually needs them.

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Memoization
// ────────────────────────────────────────────────────────────

function memoize(fn) {
  const cache = new Map();
  return function () {
    const args = Array.from(arguments);
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

console.log("=== Priya's Memoized PYQs ===");

let solveCount = 0;
const solvePYQ = memoize(function (topic) {
  solveCount++;
  return "PYQ on " + topic + " solved";
});

console.log(solvePYQ("Indian Polity"));
console.log(solvePYQ("Indian Polity")); // cached, no recompute
console.log(solvePYQ("Geography"));
console.log("Actual solves:", solveCount); // 2

// Memoized Fibonacci: without memo O(2^n), with memo O(n)
const fib = memoize(function (n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
});
console.log("fib(30) =", fib(30));

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Lazy Evaluation
// ────────────────────────────────────────────────────────────

class OptionalSubject {
  constructor(title, rawNotes) {
    this.title = title;
    this.rawNotes = rawNotes;
    this._wordCount = null;
  }

  // Computes on first access, then caches
  get wordCount() {
    if (this._wordCount === null) {
      console.log("  [Lazy] Counting words for " + this.title + "...");
      const words = this.rawNotes.split(" ");
      const counts = {};
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        counts[word] = (counts[word] || 0) + 1;
      }
      this._wordCount = counts;
    }
    return this._wordCount;
  }
}

console.log("\n=== Lazy Loading Notes ===");

const sociology = new OptionalSubject("Sociology", "caste class caste mobility stratification caste");
console.log("Subject created:", sociology.title);
console.log("Word 'caste':", sociology.wordCount["caste"]); // triggers lazy load
sociology.wordCount; // second access, instant, no log

// Generators produce values lazily, one at a time
function* naturalNumbers() {
  let n = 1;
  while (true) {
    yield n;
    n++;
  }
}

function* take(count, gen) {
  let i = 0;
  for (const val of gen) {
    if (i >= count) return;
    yield val;
    i++;
  }
}

const first5 = Array.from(take(5, naturalNumbers()));
console.log("First 5 natural numbers:", first5);

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Thunks (delayed computation)
// ────────────────────────────────────────────────────────────

function createThunk(computation) {
  let computed = false;
  let value;
  return function () {
    if (!computed) {
      value = computation();
      computed = true;
    }
    return value;
  };
}

console.log("\n=== Thunks (Delayed Computation) ===");

let evalCount = 0;
const heavyThunk = createThunk(function () {
  evalCount++;
  return 250 * 4;
});

console.log("Before force: evaluations =", evalCount); // 0
console.log("First force:", heavyThunk());              // 1000
console.log("Second force:", heavyThunk());             // 1000 (cached)
console.log("After forces: evaluations =", evalCount);  // 1

// Redux-style thunk: action creator returns a function instead of an object
function createStore(reducer, initial) {
  let state = initial;
  function dispatch(action) {
    if (typeof action === "function") {
      return action(dispatch);
    }
    state = reducer(state, action);
  }
  function getState() { return state; }
  return { dispatch: dispatch, getState: getState };
}

const store = createStore(function (state, action) {
  if (action.type === "SET_ANSWER") {
    return { answer: action.payload };
  }
  return state;
}, { answer: null });

store.dispatch(function (dispatch) {
  dispatch({ type: "SET_ANSWER", payload: "Indian Economy answer evaluated" });
});
console.log("Store:", store.getState().answer);

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Memoization caches results by input. Great for pure functions called often.
// 2. Lazy evaluation (getters, generators) defers work until actually needed.
// 3. Thunks wrap computation for delayed execution. Redux thunks enable async dispatch.

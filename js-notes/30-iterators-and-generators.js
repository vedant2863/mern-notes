/**
 * ========================================================
 *  FILE 30: ITERATORS AND GENERATORS
 * ========================================================
 *  Topic: Iterator/iterable protocols, generator functions,
 *         yield, delegation, lazy sequences, two-way comms.
 * ========================================================
 *
 *  STORY — Dadi's Bedtime Kahani
 *  Dadi tells one chapter, then pauses — waiting for "aur
 *  sunao!" before continuing. Each chapter is yielded only
 *  when asked. That's exactly how generators work.
 * ========================================================
 */

// ========================================================
//  BLOCK 1 — Iterator & Iterable Protocols
// ========================================================

// An ITERATOR has a next() returning { value, done }.
// An ITERABLE has [Symbol.iterator]() returning an iterator.

const dadiKiKahani = {
  chapters: ["Birbal Ka Sawaal", "Akbar Ka Insaaf", "Birbal Ki Chaalaaki"],
  [Symbol.iterator]() {
    let idx = 0;
    const ch = this.chapters;
    return {
      next() {
        return idx < ch.length
          ? { value: ch[idx++], done: false }
          : { value: undefined, done: true };
      }
    };
  }
};

console.log("--- Dadi's Kahani (iterable) ---");
for (const chapter of dadiKiKahani) {
  console.log(`Dadi narrates: "${chapter}"`);
}

// Spread & destructuring also use the iterable protocol
const [first, second] = dadiKiKahani;
console.log(first, second);


// ========================================================
//  BLOCK 2 — Generator Functions & yield
// ========================================================

// Generators (function*) auto-produce iterators.
// yield pauses execution; next() resumes it.

function* dadiKahaniGen() {
  yield "The Magical Peacock";
  yield "The River Crossing";
  yield "The Grand Celebration";
}

console.log("\n--- Generator storytelling ---");
const gen = dadiKahaniGen();
console.log(gen.next()); // { value: 'The Magical Peacock', done: false }
console.log(gen.next()); // { value: 'The River Crossing', done: false }
console.log(gen.next()); // { value: 'The Grand Celebration', done: false }
console.log(gen.next()); // { value: undefined, done: true }


// ========================================================
//  SECTION — yield* Delegation
// ========================================================

// yield* delegates to another iterable/generator.

function* prologue() {
  yield "Nani Ka Ghar";
  yield "Galli Ka Cricket";
}

function* fullSaga() {
  yield* prologue();
  yield "School Ka Pehla Din";
  yield "Epilogue: Nayi Subah";
}

console.log("\n--- yield* delegation ---");
for (const part of fullSaga()) console.log(part);


// ========================================================
//  SECTION — Lazy / Infinite Sequences
// ========================================================

function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

const fib = fibonacci();
const first10 = [];
for (let i = 0; i < 10; i++) first10.push(fib.next().value);
console.log("\nFibonacci:", first10);

function* range(start, end, step = 1) {
  for (let i = start; i < end; i += step) yield i;
}
console.log([...range(0, 10, 2)]); // [0, 2, 4, 6, 8]


// ========================================================
//  SECTION — Two-Way Communication & Paginator
// ========================================================

// gen.next(value) sends data INTO the generator.
function* interactiveKahani() {
  const r1 = yield "Raja ne talwar uthaai...";
  const r2 = yield "Usne raakshas ka saamna kiya...";
  yield `Raja ${r2 === "taaliyan" ? "jeet gaya!" : "mushkil se bacha."}`;
}

console.log("\n--- Two-way communication ---");
const chat = interactiveKahani();
console.log(chat.next().value);
console.log(chat.next("haaye").value);
console.log(chat.next("taaliyan").value);

// --- Paginator ---
function* paginator(data, pageSize) {
  for (let i = 0; i < data.length; i += pageSize) {
    yield data.slice(i, i + pageSize);
  }
}

const pages = paginator(["Gulab Jamun", "Rasgulla", "Jalebi", "Barfi", "Ladoo"], 2);
console.log("\nPage 1:", pages.next().value);
console.log("Page 2:", pages.next().value);
console.log("Page 3:", pages.next().value);


/**
 * ========================================================
 *  KEY TAKEAWAYS
 * ========================================================
 *  1. ITERATOR: object with next() returning { value, done }.
 *  2. ITERABLE: object with [Symbol.iterator]() returning
 *     an iterator. Powers for...of, spread, destructuring.
 *  3. Generators (function*) auto-produce iterators.
 *     yield pauses; next() resumes.
 *  4. yield* delegates to another iterable.
 *  5. Generators are LAZY — infinite sequences are safe.
 *  6. gen.next(value) sends data in (two-way coroutines).
 *  7. Practical: range(), fibonacci, paginators, and making
 *     classes iterable with *[Symbol.iterator].
 * ========================================================
 */

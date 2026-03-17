// ============================================================
// FILE 05: CALL STACK DEEP DIVE
// Topic: The LIFO data structure that manages function execution order
// WHY: The call stack is the core runtime structure in JS. Every function
//   call, return, and error trace involves it. Understanding it is key
//   to debugging overflows, reading traces, and grasping single-threading.
// ============================================================

// ============================================================
// SECTION 1 — How the Call Stack Works
// STORY: The call stack is a LIFO (Last In, First Out) structure. Function
//   call = push frame, function return = pop frame. Only the top frame
//   executes at any time.
// ============================================================

console.log("=== SECTION 1: The Call Stack ===");

// Stack at deepest point of a nested call chain:
//  +-------------------+
//  | applyDiscount()   |  <- TOP: executing
//  +-------------------+
//  | calculateFare()   |  <- waiting
//  +-------------------+
//  | validateUser()    |  <- waiting
//  +-------------------+
//  | main()            |  <- BOTTOM
//  +-------------------+

function validateUser(userId) {
    console.log("  [PUSH] validateUser");
    const isValid = checkSeat(userId);
    console.log("  [POP]  validateUser");
    return isValid;
}

function checkSeat(userId) {
    console.log("  [PUSH] checkSeat");
    const fare = calculateFare("2A", 42);
    console.log("  [POP]  checkSeat");
    return fare > 0;
}

function calculateFare(coach, seat) {
    console.log("  [PUSH] calculateFare");
    const result = 500 * 0.9;
    console.log("  [POP]  calculateFare returns", result);
    return result;
}

validateUser("USR-101");
console.log("");

// Each frame contains: function ref, return address, arguments,
// local variables, and execution context.

// ============================================================
// SECTION 2 — console.trace() and Error.stack
// STORY: console.trace() prints the live call stack. Error.stack captures
//   it as a string. Both are essential for debugging.
// ============================================================

console.log("=== SECTION 2: Inspecting the Stack ===");

function processOrder() { calculateTotal(); }
function calculateTotal() { addTax(); }
function addTax() {
    console.log("  --- console.trace() ---");
    console.trace("  addTax called");
    console.log("");
    const stackTrace = new Error().stack;
    console.log("  --- Error.stack ---");
    console.log("  " + stackTrace.split('\n').slice(0, 4).join('\n  '));
    console.log("");
}

processOrder();

// ============================================================
// SECTION 3 — Stack Overflow
// STORY: Infinite or excessively deep recursion pushes frames until
//   the stack runs out of space: "RangeError: Maximum call stack size exceeded."
// ============================================================

console.log("=== SECTION 3: Stack Overflow ===");

function causeOverflow(n) { return causeOverflow(n + 1); }

try {
    causeOverflow(0);
} catch (e) {
    console.log("  Error:", e.message);
}

function measureStackDepth(depth) {
    try { return measureStackDepth(depth + 1); }
    catch (e) { return depth; }
}

console.log(`  Max stack depth: ~${measureStackDepth(0)} frames`);
console.log("  Typical: 10,000-25,000 (varies by engine and frame size)");
console.log("");

// ============================================================
// SECTION 4 — Tail Call Optimization (TCO)
// STORY: If the LAST thing a function does is call another function,
//   the engine could reuse the frame (no stack growth). But only Safari
//   implements TCO -- V8 removed it.
// ============================================================

console.log("=== SECTION 4: Tail Call Optimization ===");

// Tail-recursive (last operation IS the call):
function factorialTail(n, acc = 1) {
    if (n <= 1) return acc;
    return factorialTail(n - 1, n * acc); // tail position
}

// NOT tail-recursive (multiply happens AFTER call returns):
function factorialNonTail(n) {
    if (n <= 1) return 1;
    return n * factorialNonTail(n - 1);  // NOT tail position
}

console.log("  Tail-recursive factorial(10):", factorialTail(10));
console.log("  Non-tail factorial(10):", factorialNonTail(10));
console.log("  TCO status: Only Safari (JSC). V8/SpiderMonkey = NO.");
console.log("");

// ============================================================
// SECTION 5 — Recursion to Iteration + Trampoline
// STORY: Since TCO isn't reliable, convert deep recursion to iteration
//   using a manual stack (array) or the trampoline pattern.
// ============================================================

console.log("=== SECTION 5: Recursion -> Iteration ===");

// Iterative Fibonacci: O(n) time, O(1) space, no stack risk
function fibIterative(n) {
    if (n <= 1) return n;
    let prev = 0, curr = 1;
    for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
    }
    return curr;
}

console.log("  fibIterative(10):", fibIterative(10));

// Iterative tree traversal with manual stack:
function flattenIterative(root) {
    const result = [];
    const stack = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        result.push(node.name);
        if (node.children) {
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }
    }
    return result;
}

const tree = {
    name: "Electronics",
    children: [
        { name: "Phones", children: [
            { name: "Apple" }, { name: "Samsung" },
        ]},
        { name: "Laptops", children: [
            { name: "Dell" }, { name: "HP" },
        ]},
    ],
};

console.log("  Iterative flatten:", flattenIterative(tree));
console.log("");

// Trampoline: converts recursion to a loop, stack depth always 1
function trampoline(fn) {
    let result = fn;
    while (typeof result === 'function') result = result();
    return result;
}

function trampolinedFactorial(n, acc = 1) {
    if (n <= 1) return acc;
    return () => trampolinedFactorial(n - 1, n * acc); // return thunk, not recurse
}

console.log("  Trampolined factorial(10):", trampoline(() => trampolinedFactorial(10)));
console.log("  Trampolined factorial(100):", trampoline(() => trampolinedFactorial(100)).toString().substring(0, 30) + "...");
console.log("  No stack overflow even for large n!");
console.log("");

// ============================================================
// SECTION 6 — Async and the Call Stack
// STORY: Async callbacks do NOT run on the same stack as their caller.
//   They run on a FRESH stack scheduled by the event loop.
// ============================================================

console.log("=== SECTION 6: Async and the Call Stack ===");

// Sync: main() -> checkout() -> validate()  (all on SAME stack)
// Async: main() -> scheduleAPI()  (stack clears)
//        ... event loop picks up callback ...
//        apiCallback()  (FRESH stack!)

function synchronousFlow() {
    console.log("  [sync] Step 1: Start");
    console.log("  [sync] Step 2: Validate (same stack)");
    console.log("  [sync] Step 3: Done (same stack)");
}

function asynchronousFlow() {
    console.log("  [async] Step 1: Start");
    setTimeout(() => {
        console.log("  [async] Step 3: Callback (NEW stack!)");
    }, 0);
    console.log("  [async] Step 2: setTimeout scheduled, stack continues");
}

synchronousFlow();
console.log("");
asynchronousFlow();
console.log("");

setTimeout(() => {
    // --- Reading Stack Traces ---
    console.log("=== BONUS: Reading Stack Traces ===");

    function createPayment(amount) { return validateAmount(amount); }
    function validateAmount(amount) {
        if (amount <= 0) throw new Error(`Invalid amount: ${amount}`);
        return true;
    }

    try {
        createPayment(-500);
    } catch (e) {
        console.log("  Error:", e.message);
        const lines = e.stack.split('\n');
        lines.slice(0, 4).forEach((line, i) => {
            console.log(`  ${line}${i === 0 ? '  <-- error' : `  <-- frame ${i}`}`);
        });
    }
    console.log("  Read bottom-to-top: entry -> ... -> error location");
    console.log("");

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    console.log("=== KEY TAKEAWAYS ===");
    console.log("1. Call stack = LIFO: push on call, pop on return");
    console.log("2. Frame = function + return address + locals + context");
    console.log("3. Single-threaded: one stack, one thing at a time");
    console.log("4. Stack overflow: too-deep recursion -> RangeError");
    console.log("5. TCO: only Safari. V8/SpiderMonkey don't support it");
    console.log("6. Convert recursion to iteration or use trampoline");
    console.log("7. Async callbacks run on a FRESH stack (event loop)");
    console.log("8. console.trace() and Error.stack for debugging");
}, 10);

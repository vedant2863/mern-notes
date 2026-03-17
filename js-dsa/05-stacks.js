// ============================================================
// FILE 05: STACKS
// Topic: LIFO data structure, implementations, and classic problems
// WHY: Stacks power browser back buttons, undo/redo, call stacks,
//   expression evaluation, and monotonic stack patterns.
// ============================================================

// ============================================================
// STORY — PhonePe Navigation Stack
// Navigate: Home -> Send Money -> Amount -> Confirm -> Receipt.
// Each screen is PUSHED. Pressing "Back" POPS. LIFO in action.
// ============================================================

console.log("=== STACKS: LIFO (Last In, First Out) ===\n");

// ============================================================
// SECTION 1 — Stack Implementation (Array-Based)
// push/pop at end are both O(1). Simple and cache-friendly.
// ============================================================

class StackArray {
  constructor() { this.items = []; }
  push(item) { this.items.push(item); return this; }
  pop() {
    if (this.isEmpty()) throw new Error("Stack Underflow");
    return this.items.pop();
  }
  peek() { return this.isEmpty() ? undefined : this.items[this.items.length - 1]; }
  isEmpty() { return this.items.length === 0; }
  size() { return this.items.length; }
  display() { console.log("Stack:", [...this.items].reverse().join(" -> ")); }
}

// All operations O(1). Linked-list variant gives O(1) worst case (no resize).

const navStack = new StackArray();
navStack.push("Home"); navStack.push("Send Money"); navStack.push("Confirm");
navStack.display();
console.log("Back:", navStack.pop());    // Confirm
console.log("Now at:", navStack.peek()); // Send Money

// ============================================================
// SECTION 2 — Valid Parentheses
// Push opening brackets, pop on closing, check match. O(n).
// ============================================================

function isValidParentheses(str) {
  const stack = [];
  const match = { ")": "(", "]": "[", "}": "{" };
  for (const char of str) {
    if ("([{".includes(char)) {
      stack.push(char);
    } else if (")]}".includes(char)) {
      if (stack.length === 0 || stack.pop() !== match[char]) return false;
    }
  }
  return stack.length === 0;
}

console.log("\n--- Valid Parentheses ---");
console.log("'({[]})':", isValidParentheses("({[]})"));   // true
console.log("'([)]':", isValidParentheses("([)]"));       // false

// ============================================================
// SECTION 3 — Reverse Polish Notation (Postfix Evaluation)
// Push numbers, pop two on operator, push result. O(n).
// ============================================================

function evalRPN(tokens) {
  const stack = [];
  for (const token of tokens) {
    if (["+", "-", "*", "/"].includes(token)) {
      const b = stack.pop(), a = stack.pop();
      switch (token) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": stack.push(Math.trunc(a / b)); break;
      }
    } else {
      stack.push(Number(token));
    }
  }
  return stack[0];
}

console.log("\n--- RPN ---");
console.log('["2","3","+","4","*"] =', evalRPN(["2", "3", "+", "4", "*"])); // 20

// ============================================================
// SECTION 4 — Min Stack: O(1) getMin
// Auxiliary stack tracks minimums alongside the main stack.
// ============================================================

class MinStack {
  constructor() { this.stack = []; this.minStack = []; }
  push(val) {
    this.stack.push(val);
    if (this.minStack.length === 0 || val <= this.minStack[this.minStack.length - 1])
      this.minStack.push(val);
  }
  pop() {
    const val = this.stack.pop();
    if (val === this.minStack[this.minStack.length - 1]) this.minStack.pop();
    return val;
  }
  top() { return this.stack[this.stack.length - 1]; }
  getMin() { return this.minStack[this.minStack.length - 1]; }
}

console.log("\n--- Min Stack ---");
const minStack = new MinStack();
minStack.push(500); minStack.push(200); minStack.push(800); minStack.push(100);
console.log("Min:", minStack.getMin()); // 100
minStack.pop();
console.log("After pop, min:", minStack.getMin()); // 200

// ============================================================
// SECTION 5 — Next Greater Element (Monotonic Stack)
// Decreasing stack: pop when a greater element found. O(n).
// Each index pushed once, popped once -> O(2n) = O(n).
// ============================================================

function nextGreaterElement(arr) {
  const result = new Array(arr.length).fill(-1);
  const stack = []; // stack of indices
  for (let i = 0; i < arr.length; i++) {
    while (stack.length > 0 && arr[i] > arr[stack[stack.length - 1]])
      result[stack.pop()] = arr[i];
    stack.push(i);
  }
  return result;
}

console.log("\n--- Next Greater Element ---");
console.log("Input:", [4, 5, 2, 25, 7, 18]);
console.log("Result:", nextGreaterElement([4, 5, 2, 25, 7, 18])); // [5,25,25,-1,18,-1]

// ============================================================
// SECTION 6 — Queue Using Two Stacks
// inStack for enqueue, outStack for dequeue. O(1) amortized.
// ============================================================

class QueueFromStacks {
  constructor() { this.inStack = []; this.outStack = []; }
  enqueue(item) { this.inStack.push(item); }
  dequeue() {
    if (this.outStack.length === 0)
      while (this.inStack.length > 0) this.outStack.push(this.inStack.pop());
    if (this.outStack.length === 0) throw new Error("Queue empty");
    return this.outStack.pop();
  }
  isEmpty() { return this.inStack.length === 0 && this.outStack.length === 0; }
}

console.log("\n--- Queue from Two Stacks ---");
const q = new QueueFromStacks();
q.enqueue("Order 1"); q.enqueue("Order 2"); q.enqueue("Order 3");
console.log("Dequeue:", q.dequeue()); // Order 1 (FIFO)
console.log("Dequeue:", q.dequeue()); // Order 2

// ============================================================
// SECTION 7 — Browser History (Two Stacks)
// Visit pushes to backStack. Back pops to forwardStack.
// New visit clears forwardStack.
// ============================================================

class BrowserHistory {
  constructor(homepage) { this.backStack = [homepage]; this.forwardStack = []; }
  visit(url) { this.backStack.push(url); this.forwardStack = []; }
  back() {
    if (this.backStack.length <= 1) return this.backStack[0];
    this.forwardStack.push(this.backStack.pop());
    return this.backStack[this.backStack.length - 1];
  }
  forward() {
    if (this.forwardStack.length === 0) return this.backStack[this.backStack.length - 1];
    const page = this.forwardStack.pop();
    this.backStack.push(page);
    return page;
  }
}

// Same pattern powers Undo/Redo — undoStack + redoStack, new action clears redo.

console.log("\n--- Browser History ---");
const browser = new BrowserHistory("google.com");
browser.visit("flipkart.com");
browser.visit("flipkart.com/phones");
console.log("Back:", browser.back());      // flipkart.com
console.log("Back:", browser.back());      // google.com
console.log("Forward:", browser.forward()); // flipkart.com

// ============================================================
// SECTION 8 — Daily Temperatures (Monotonic Stack Variant)
// Same pattern as Next Greater Element, but returns index DISTANCE.
// ============================================================

function dailyTemperatures(temps) {
  const result = new Array(temps.length).fill(0);
  const stack = [];
  for (let i = 0; i < temps.length; i++) {
    while (stack.length > 0 && temps[i] > temps[stack[stack.length - 1]]) {
      const prev = stack.pop();
      result[prev] = i - prev;
    }
    stack.push(i);
  }
  return result;
}

console.log("\n--- Daily Temperatures ---");
console.log("Wait days:", dailyTemperatures([30, 28, 35, 32, 38, 25, 27, 40]));
// [2, 1, 2, 1, 3, 1, 1, 0]

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Stack = LIFO. push/pop/peek all O(1)
// 2. Valid Parentheses: push opening, pop on closing — O(n)
// 3. RPN: push numbers, pop two on operator — O(n)
// 4. Min Stack: auxiliary stack tracks mins — O(1) getMin
// 5. Monotonic stack: solves "next greater/smaller" in O(n)
// 6. Two stacks simulate a queue — O(1) amortized
// 7. Browser history and undo/redo are real-world two-stack patterns
// 8. JS call stack: each function call pushes a frame, return pops it
// ============================================================

/**
 * FILE 21 : Chain of Responsibility & Middleware
 * Topic   : Behavioral Design Patterns
 * Used in : Express.js middleware, form validation, approval workflows
 */

// STORY: Babu Tripathi's sarkari file passes from clerk to officer to
// secretary. Each babu either approves or forwards to the next level.

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Classic Chain (linked handler objects)
// ────────────────────────────────────────────────────────────

class ApprovalHandler {
  constructor(name) {
    this.name = name;
    this.next = null;
  }

  setNext(handler) {
    this.next = handler;
    return handler;
  }

  handle(file) {
    if (this.next) {
      return this.next.handle(file);
    }
    return this.name + " approved " + file.title;
  }
}

class Clerk extends ApprovalHandler {
  handle(file) {
    if (file.amount <= 10000) {
      console.log("  " + this.name + " approved " + file.amount);
      return this.name + " approved " + file.title;
    }
    console.log("  " + this.name + " forwarding (too large)");
    return super.handle(file);
  }
}

class SectionOfficer extends ApprovalHandler {
  handle(file) {
    if (file.amount <= 100000) {
      console.log("  " + this.name + " approved " + file.amount);
      return this.name + " approved " + file.title;
    }
    console.log("  " + this.name + " forwarding (too large)");
    return super.handle(file);
  }
}

class UnderSecretary extends ApprovalHandler {
  handle(file) {
    if (!file.docsComplete) {
      return this.name + " rejected " + file.title + " (docs missing)";
    }
    console.log("  " + this.name + " docs verified OK");
    return super.handle(file);
  }
}

console.log("=== Sarkari File Approval Chain ===");

const clerk = new Clerk("Clerk Sharma");
const officer = new SectionOfficer("SO Verma");
const secretary = new UnderSecretary("US Joshi");
clerk.setNext(officer).setNext(secretary);

console.log(clerk.handle({ title: "Leave", amount: 5000, docsComplete: true }));
console.log(clerk.handle({ title: "Budget", amount: 75000, docsComplete: true }));
console.log(clerk.handle({ title: "Tender", amount: 500000, docsComplete: false }));

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Express-style Middleware Chain
// ────────────────────────────────────────────────────────────

class MiddlewareChain {
  constructor() {
    this.stack = [];
  }

  use(fn) {
    this.stack.push(fn);
  }

  run(req, res) {
    let index = 0;
    const self = this;

    function next() {
      const fn = self.stack[index];
      index = index + 1;
      if (fn) {
        fn(req, res, next);
      }
    }
    next();
  }
}

console.log("\n=== Express-style Middleware ===");

const app = new MiddlewareChain();

app.use(function logger(req, res, next) {
  console.log("  [Logger] " + req.method + " " + req.url);
  next();
});

app.use(function auth(req, res, next) {
  if (!req.token) {
    console.log("  [Auth] No token - rejected");
    res.status = 401;
    return;
  }
  console.log("  [Auth] Token valid");
  req.user = "Babu Tripathi";
  next();
});

app.use(function handler(req, res, next) {
  res.status = 200;
  res.body = "Namaste " + req.user + ", here are your files";
  console.log("  [Handler] " + res.body);
});

const res1 = {};
app.run({ method: "GET", url: "/files", token: "sarkari123" }, res1);
console.log("  Status:", res1.status);

const res2 = {};
app.run({ method: "GET", url: "/secret", token: null }, res2);
console.log("  Status:", res2.status);

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Chain of Responsibility: file doesn't know which babu approves it.
// 2. Express middleware is this pattern: each (req, res, next) either responds or calls next().
// 3. Great when approval levels change at runtime.

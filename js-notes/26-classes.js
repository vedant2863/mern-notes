/**
 * ============================================================
 *  FILE 26: Classes in JavaScript
 * ============================================================
 *  Topic: The `class` syntax — syntactic sugar over prototypes.
 * ============================================================
 *
 *  STORY: The IPL Cricket Academy. Every cricketer is enrolled
 *  through the Academy's class blueprint — a name, a role, and
 *  shared training methods. Each cricketer is a unique instance.
 * ============================================================
 */

// ============================================================
//  BLOCK 1 — Defining a Class
// ============================================================

class Cricketer {
  constructor(name, role) {
    this.name = name;
    this.role = role;
    this.matchesPlayed = 0;
    this.stamina = 100;
  }

  introduce() {
    return `${this.name} the ${this.role} (Matches:${this.matchesPlayed}, Stamina:${this.stamina})`;
  }

  practice(hours) {
    this.matchesPlayed += Math.floor((hours * 10) / 50);
    return `${this.name} practised ${hours}h. Matches:${this.matchesPlayed}`;
  }

  takeFatigue(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
    return this.stamina > 0
      ? `${this.name} stamina: ${this.stamina}`
      : `${this.name} is exhausted!`;
  }
}

console.log("--- The IPL Cricket Academy ---");
const player1 = new Cricketer("Virat", "Batsman");
const player2 = new Cricketer("Bumrah", "Bowler");

console.log(player1.introduce());
console.log(player1.practice(10));
console.log(player2.takeFatigue(35));

// Methods live on prototype, shared across instances
console.log(player1.introduce === player2.introduce); // true
console.log(typeof Cricketer); // "function" — class IS sugar


// ============================================================
//  BLOCK 2 — Class Expressions & `this` Gotcha
// ============================================================

// Classes can be assigned to variables (class expressions).
const MatchSchedule = class {
  constructor() { this.matches = []; }

  add(opponent, venue) {
    this.matches.push({ opponent, venue });
    return `Added: vs "${opponent}" at ${venue}`;
  }
};

const schedule = new MatchSchedule();
console.log("\n" + schedule.add("Chennai Super Kings", "Wankhede"));

// --- `this` gotcha: detaching a method ---
console.log("\n--- this gotcha ---");
const introduceVirat = player1.introduce;
try {
  introduceVirat(); // `this` is undefined (strict mode)
} catch (e) {
  console.log(`Error: ${e.message}`);
}

// Fix 1: bind
const bound = player1.introduce.bind(player1);
console.log(bound());

// Fix 2: arrow in constructor (each instance gets own copy)
class Debutant {
  constructor(name) {
    this.name = name;
    this.walkOut = () => `${this.name} walks out to bat!`;
  }
}

const d1 = new Debutant("Shubman");
const detached = d1.walkOut;
console.log(detached()); // works — arrow captured `this`


// ============================================================
//  KEY TAKEAWAYS
// ============================================================
// 1. `class` is sugar over constructor + prototypes.
// 2. constructor() runs on `new`. Methods go on the prototype.
// 3. Classes enforce strict mode — detaching a method makes
//    `this` undefined, not global.
// 4. Fix with bind() or arrow functions in the constructor
//    (trade-off: per-instance copies).
// 5. Class expressions work like function expressions.
// ============================================================

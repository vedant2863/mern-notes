/**
 * ============================================================
 *  FILE 20 : The State Pattern
 *  Topic   : State, Finite State Machine
 *  Impact  : UI loading states, game character behavior,
 *            checkout flows, React useReducer, XState library
 * ============================================================
 */

// STORY: Traffic Controller Anand manages the ITO junction signal
// in Delhi. Each light changes behavior based on its current state
// (green -> yellow -> red -> green). The signal "just knows" what to do.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Classic State Pattern (Chai Vending Machine)
// ────────────────────────────────────────────────────────────

console.log("=== BLOCK 1: Chai Vending Machine ===");

class IdleState {
  constructor(machine) {
    this.machine = machine;
  }
  insertCoin(amount) {
    this.machine.balance = this.machine.balance + amount;
    console.log("  Coin inserted: Rs." + amount + " (balance: Rs." + this.machine.balance + ")");
    this.machine.setState(this.machine.hasMoneyState);
  }
  selectItem() {
    console.log("  Please insert a coin first");
  }
  dispense() {
    console.log("  Please insert a coin first");
  }
}

class HasMoneyState {
  constructor(machine) {
    this.machine = machine;
  }
  insertCoin(amount) {
    this.machine.balance = this.machine.balance + amount;
    console.log("  Added coin: Rs." + amount + " (balance: Rs." + this.machine.balance + ")");
  }
  selectItem(item) {
    if (this.machine.balance >= item.price) {
      console.log("  Selected: " + item.name + " (Rs." + item.price + ")");
      this.machine.selectedItem = item;
      this.machine.setState(this.machine.dispensingState);
      this.machine.dispense();
    } else {
      console.log("  Not enough for " + item.name + ". Need Rs." + item.price + ", have Rs." + this.machine.balance);
    }
  }
  dispense() {
    console.log("  Please select an item first");
  }
}

class DispensingState {
  constructor(machine) {
    this.machine = machine;
  }
  insertCoin() {
    console.log("  Please wait, dispensing...");
  }
  selectItem() {
    console.log("  Please wait, dispensing...");
  }
  dispense() {
    let item = this.machine.selectedItem;
    this.machine.balance = this.machine.balance - item.price;
    console.log("  Dispensed: " + item.name + "! Remaining: Rs." + this.machine.balance);
    if (this.machine.balance > 0) {
      this.machine.setState(this.machine.hasMoneyState);
    } else {
      this.machine.setState(this.machine.idleState);
    }
  }
}

class ChaiVendingMachine {
  constructor() {
    this.balance = 0;
    this.selectedItem = null;
    this.idleState = new IdleState(this);
    this.hasMoneyState = new HasMoneyState(this);
    this.dispensingState = new DispensingState(this);
    this.state = this.idleState;
  }
  setState(newState) {
    this.state = newState;
  }
  insertCoin(amount) { this.state.insertCoin(amount); }
  selectItem(item) { this.state.selectItem(item); }
  dispense() { this.state.dispense(); }
}

let vm = new ChaiVendingMachine();
let masalaChai = { name: "Masala Chai", price: 15 };

vm.selectItem(masalaChai);
vm.insertCoin(10);
vm.selectItem(masalaChai);
vm.insertCoin(10);
vm.selectItem(masalaChai);

// ────────────────────────────────────────────────────────────
// BLOCK 2 — FSM with Transition Table (ITO Junction)
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 2: FSM with Transition Table ===");

class StateMachine {
  constructor(config) {
    this.states = config.states;
    this.current = config.initial;
  }

  getState() {
    return this.current;
  }

  transition(event) {
    let stateConfig = this.states[this.current];
    if (!stateConfig || !stateConfig.on || !stateConfig.on[event]) {
      console.log("  [FSM] No transition for '" + event + "' in state '" + this.current + "'");
      return false;
    }

    let prev = this.current;
    this.current = stateConfig.on[event];

    let nextConfig = this.states[this.current];
    if (nextConfig && nextConfig.onEnter) {
      nextConfig.onEnter();
    }

    console.log("  [FSM] " + prev + " --" + event + "--> " + this.current);
    return true;
  }
}

let light = new StateMachine({
  initial: "green",
  states: {
    green: {
      on: { TIMER: "yellow" },
      onEnter: function () { console.log("  Signal is GREEN - Chalo!"); }
    },
    yellow: {
      on: { TIMER: "red" },
      onEnter: function () { console.log("  Signal is YELLOW - Dhire!"); }
    },
    red: {
      on: { TIMER: "green" },
      onEnter: function () { console.log("  Signal is RED - Ruko!"); }
    },
  }
});

light.transition("TIMER");
light.transition("TIMER");
light.transition("TIMER");
light.transition("WALK");

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. State pattern delegates behavior to state objects — no if/else chains.
// 2. Each state knows its own behavior AND which state comes next.
// 3. FSMs use a transition table to formalize all valid state changes.
// 4. Invalid transitions are safely ignored — the system stays consistent.

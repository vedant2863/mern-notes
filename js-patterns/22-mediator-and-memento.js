/**
 * FILE 22 : Mediator & Memento Patterns
 * Topic   : Behavioral Design Patterns
 * Used in : Chat rooms, form coordination (Mediator), undo/redo in editors (Memento)
 */

// STORY: ATC Officer Kapoor coordinates flights at Mumbai airport (Mediator).
// The flight data recorder captures snapshots for replay (Memento).

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Mediator (ATC tower coordinates flights)
// ────────────────────────────────────────────────────────────

class ControlTower {
  constructor() {
    this.flights = {};
    this.log = [];
  }

  register(flight) {
    this.flights[flight.name] = flight;
    flight.tower = this;
  }

  send(message, from, toName) {
    this.log.push(from.name + " -> " + toName + ": " + message);
    const target = this.flights[toName];
    if (target) {
      target.receive(message, from.name);
    } else {
      console.log("  [Tower] " + toName + " not found");
    }
  }

  broadcast(message, from) {
    this.log.push(from.name + " -> ALL: " + message);
    const names = Object.keys(this.flights);
    for (let i = 0; i < names.length; i++) {
      if (names[i] !== from.name) {
        this.flights[names[i]].receive(message, from.name);
      }
    }
  }
}

class Flight {
  constructor(name) {
    this.name = name;
    this.tower = null;
    this.inbox = [];
  }

  send(message, toName) {
    this.tower.send(message, this, toName);
  }

  broadcast(message) {
    this.tower.broadcast(message, this);
  }

  receive(message, from) {
    this.inbox.push({ from: from, message: message });
    console.log("  [" + this.name + "] from " + from + ': "' + message + '"');
  }
}

console.log("=== Mumbai ATC Tower (Mediator) ===");

const tower = new ControlTower();
const ai101 = new Flight("AI-101");
const indigo = new Flight("6E-302");
const spicejet = new Flight("SG-205");

tower.register(ai101);
tower.register(indigo);
tower.register(spicejet);

ai101.send("Runway 27 clear for landing", "6E-302");
spicejet.broadcast("Turbulence near Pune at FL350");
console.log("  Tower log entries:", tower.log.length);

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Memento (save/restore state)
// ────────────────────────────────────────────────────────────

class FlightRecorder {
  constructor() {
    this.altitude = "0ft";
    this.heading = "N";
  }

  update(altitude, heading) {
    this.altitude = altitude;
    this.heading = heading;
  }

  save() {
    return { altitude: this.altitude, heading: this.heading };
  }

  restore(snapshot) {
    this.altitude = snapshot.altitude;
    this.heading = snapshot.heading;
  }

  toString() {
    return this.altitude + ", " + this.heading;
  }
}

console.log("\n=== Flight Data Recorder (Memento) ===");

const recorder = new FlightRecorder();
const history = [];

history.push(recorder.save());
recorder.update("FL350", "Mumbai-Delhi");
console.log("  Update 1:", recorder.toString());

history.push(recorder.save());
recorder.update("FL380", "Over-Nagpur");
console.log("  Update 2:", recorder.toString());

// Undo - restore in reverse
recorder.restore(history.pop());
console.log("  Undo 1:", recorder.toString());

recorder.restore(history.pop());
console.log("  Undo 2:", recorder.toString());

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Mediator: flights talk to the tower, not to each other. Reduces coupling.
// 2. Memento: save() creates a snapshot, restore() brings it back. Perfect for undo.
// 3. JSON.parse(JSON.stringify(obj)) is a quick deep-clone for plain objects.

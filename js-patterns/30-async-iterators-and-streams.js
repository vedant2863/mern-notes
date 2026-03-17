/**
 * FILE 30 : Async Iterators & Streams
 * Topic   : Async Generators, Observable, Actor Model
 * Used in : Node.js streams, RxJS observables, real-time data feeds
 */

// STORY: Ganga Canal Engineer Mira manages water flow from Haridwar to
// the fields -- controlling the rate, watching sensors, dispatching operators.

(async function () {

const sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Async Generators & for-await-of
// ────────────────────────────────────────────────────────────
console.log("=== BLOCK 1: Async Generators ===");

// Async generators yield values over time, one at a time
async function* canalFlow(count) {
  for (let i = 1; i <= count; i++) {
    await sleep(5);
    yield { level: i * 10, sensor: "Lock-" + i };
  }
}

const levels = [];
for await (const reading of canalFlow(4)) {
  levels.push(reading.level);
}
console.log("Canal levels:", levels);

// Composing async generators: filter and transform streams
async function* filterStream(source, test) {
  for await (const item of source) {
    if (test(item)) yield item;
  }
}

async function* mapStream(source, fn) {
  for await (const item of source) {
    yield fn(item);
  }
}

// Chain: generate -> filter high levels -> format as string
const highSource = filterStream(
  canalFlow(5),
  function (r) { return r.level >= 30; }
);
const formatted = mapStream(
  highSource,
  function (r) { return r.sensor + ":" + r.level + "cm"; }
);

const highLevels = [];
for await (const entry of formatted) {
  highLevels.push(entry);
}
console.log("High water levels:", highLevels);

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Simple Observable
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 2: Observable ===");

// Observable pushes values to subscribers (unlike iterators where consumer pulls)

class Observable {
  constructor(subscribeFn) {
    this.subscribeFn = subscribeFn;
  }

  subscribe(observer) {
    let stopped = false;

    const safe = {
      next: function (v) { if (!stopped) observer.next(v); },
      error: function (e) { if (!stopped && observer.error) observer.error(e); },
      complete: function () { if (!stopped && observer.complete) observer.complete(); },
    };

    this.subscribeFn(safe);

    return {
      unsubscribe: function () { stopped = true; },
    };
  }

  filter(test) {
    const self = this;
    return new Observable(function (obs) {
      self.subscribe({
        next: function (v) { if (test(v)) obs.next(v); },
        error: function (e) { obs.error(e); },
        complete: function () { obs.complete(); },
      });
    });
  }

  map(fn) {
    const self = this;
    return new Observable(function (obs) {
      self.subscribe({
        next: function (v) { obs.next(fn(v)); },
        error: function (e) { obs.error(e); },
        complete: function () { obs.complete(); },
      });
    });
  }
}

// Canal sensor emits readings, filter for flood alerts
const alerts = await new Promise(function (resolve) {
  const collected = [];
  let count = 0;

  const sensor = new Observable(function (observer) {
    const id = setInterval(function () {
      count++;
      if (count <= 5) {
        observer.next(count * 12);
      } else {
        observer.complete();
        clearInterval(id);
      }
    }, 5);
  });

  sensor
    .filter(function (level) { return level > 24; })
    .map(function (level) { return "FloodAlert:" + level + "cm"; })
    .subscribe({
      next: function (val) { collected.push(val); },
      complete: function () { resolve(collected); },
    });
});
console.log("Sensor alerts:", alerts);

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Actor Model (message queue, isolated state)
// ────────────────────────────────────────────────────────────
console.log("\n=== BLOCK 3: Actor Model ===");

// Actors isolate state behind async message queues: no shared state, just messages

class Actor {
  constructor(handler) {
    this.handler = handler;
    this.state = {};
    this.queue = [];
    this.busy = false;
  }

  async send(message) {
    this.queue.push(message);
    if (!this.busy) {
      await this.drain();
    }
  }

  async drain() {
    this.busy = true;
    while (this.queue.length > 0) {
      const msg = this.queue.shift();
      this.state = await this.handler(this.state, msg);
    }
    this.busy = false;
  }
}

const barrage = new Actor(async function (state, msg) {
  await sleep(2);
  const waterLevel = (state.waterLevel || 0) + msg.change;
  return { waterLevel: waterLevel, lastAction: msg.type };
});

await barrage.send({ type: "monsoon-inflow", change: 30 });
await barrage.send({ type: "gate-release", change: -10 });
await barrage.send({ type: "monsoon-inflow", change: 15 });
await sleep(20);
console.log("Barrage state:", barrage.state);

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Async generators + for-await-of: pull-based streaming, consumer controls pace.
// 2. Observable: push-based, the source decides when to emit. map/filter compose like arrays.
// 3. Actor model: isolate state behind message queues. No shared mutation, just messages.
// 4. for-await naturally provides backpressure -- waits before pulling next value.

})();

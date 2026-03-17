/**
 * ============================================================
 *  FILE 32 : MVC, MVP, and MVVM Patterns
 *  WHERE YOU SEE THIS: Express (MVC), Android apps (MVP),
 *    Vue/Angular (MVVM), React (similar to MVC)
 * ============================================================
 */

// STORY: Director Rohit runs a Bollywood set. The script is the Model,
// the camera is the View, and Rohit is the Controller who connects them.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — MVC (Model-View-Controller)
// ────────────────────────────────────────────────────────────

class SceneModel {
  constructor() {
    this.scenes = [];
    this.listeners = [];
  }

  subscribe(fn) { this.listeners.push(fn); }

  notify() {
    for (var i = 0; i < this.listeners.length; i++) {
      this.listeners[i]();
    }
  }

  add(dialogue) {
    this.scenes.push({ dialogue: dialogue, shot: false });
    this.notify();
  }

  toggle(index) {
    this.scenes[index].shot = !this.scenes[index].shot;
    this.notify();
  }

  getAll() { return this.scenes; }
}

class CameraView {
  render(scenes) {
    var lines = [];
    for (var i = 0; i < scenes.length; i++) {
      var mark = scenes[i].shot ? "x" : " ";
      lines.push("  " + i + ". [" + mark + "] " + scenes[i].dialogue);
    }
    return "Camera (MVC):\n" + lines.join("\n");
  }
}

class DirectorController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    var self = this;
    model.subscribe(function() {
      console.log(self.view.render(self.model.getAll()));
    });
  }

  addScene(dialogue) { this.model.add(dialogue); }
  markShot(i) { this.model.toggle(i); }
}

console.log("=== MVC Pattern ===");
var ctrl = new DirectorController(new SceneModel(), new CameraView());
ctrl.addScene("Mere paas maa hai");
ctrl.addScene("Mogambo khush hua");
ctrl.markShot(0);

// ────────────────────────────────────────────────────────────
// BLOCK 2 — MVP (Model-View-Presenter)
// ────────────────────────────────────────────────────────────
// View is "passive" — zero logic. Presenter tells it exactly what to show.

class CastModel {
  constructor() { this.actors = []; }
  add(name, role) { this.actors.push({ name: name, role: role }); }
  getAll() { return this.actors; }
}

class MonitorView {
  show(text) { console.log(text); }
}

class CastPresenter {
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  addActor(name, role) {
    this.model.add(name, role);
    var actors = this.model.getAll();
    var lines = [];
    for (var i = 0; i < actors.length; i++) {
      lines.push("  " + actors[i].name + " -> " + actors[i].role);
    }
    this.view.show("Cast Board (MVP):\n" + lines.join("\n"));
  }
}

console.log("\n=== MVP Pattern ===");
var presenter = new CastPresenter(new CastModel(), new MonitorView());
presenter.addActor("Shah Rukh", "Raj");
presenter.addActor("Kajol", "Simran");

// ────────────────────────────────────────────────────────────
// BLOCK 3 — MVVM (Model-View-ViewModel)
// ────────────────────────────────────────────────────────────
// ViewModel exposes observable state. View binds to it.
// Changes auto-reflect — this is how Vue and Angular work.

class TicketViewModel {
  constructor(price, qty) {
    this._price = price;
    this._qty = qty;
    this._bindings = [];
  }

  getTotal() { return this._price * this._qty; }
  getPrice() { return this._price; }
  getQty() { return this._qty; }

  setPrice(v) { this._price = v; this._notify(); }
  setQty(v) { this._qty = v; this._notify(); }

  bind(renderFn) { this._bindings.push(renderFn); }

  _notify() {
    var self = this;
    for (var i = 0; i < this._bindings.length; i++) {
      this._bindings[i](self);
    }
  }
}

console.log("\n=== MVVM Pattern ===");
var vm = new TicketViewModel(500, 4);
vm.bind(function(vm) {
  console.log("Teleprompter: " + vm.getQty() + " tickets @ " + vm.getPrice() + " = " + vm.getTotal());
});

vm.setQty(6);
vm.setPrice(750);

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. MVC: Controller handles input, Model holds state, View renders.
// 2. MVP: Presenter does ALL logic, View is a dumb display.
// 3. MVVM: ViewModel binds to View reactively — Vue/Angular style.
// 4. All three separate concerns — the difference is where logic lives.
// 5. MVC for server-side, MVP for testable UIs, MVVM for reactive frameworks.

/**
 * ============================================================
 *  FILE 40 : Swiggy Dashboard (Mini Project)
 *  Patterns used: Composite, Observer, State, Decorator
 *  WHERE YOU SEE THIS: React component tree, Vue reactivity,
 *    any UI framework with state management
 * ============================================================
 */

// STORY: The Swiggy Dashboard tracks live restaurant orders. Components
// form a tree, react to state changes automatically, and decorators
// add logging without touching original code.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Simple Reactive State
// ────────────────────────────────────────────────────────────
// When state changes, all subscribers get notified automatically.

class ReactiveState {
  constructor(initial) {
    this.data = initial;
    this.subscribers = [];
  }

  get(key) { return this.data[key]; }

  set(key, value) {
    var old = this.data[key];
    this.data[key] = value;
    if (old !== value) {
      this._notify(key, value, old);
    }
  }

  subscribe(fn) {
    this.subscribers.push(fn);
  }

  _notify(key, value, old) {
    for (var i = 0; i < this.subscribers.length; i++) {
      this.subscribers[i]({ key: key, value: value, old: old });
    }
  }
}

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Component Tree (Composite)
// ────────────────────────────────────────────────────────────
// mount() cascades to all children — just like React.

class Component {
  constructor(name, props) {
    this.name = name;
    this.props = props || {};
    this.children = [];
    this.mounted = false;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return this;
  }

  mount() {
    this.mounted = true;
    for (var i = 0; i < this.children.length; i++) {
      this.children[i].mount();
    }
    return this;
  }

  update(newProps) {
    var keys = Object.keys(newProps || {});
    for (var i = 0; i < keys.length; i++) {
      this.props[keys[i]] = newProps[keys[i]];
    }
    for (var j = 0; j < this.children.length; j++) {
      this.children[j].update();
    }
  }

  render() { return "<" + this.name + "/>"; }

  toTree(indent) {
    indent = indent || 0;
    var pad = "";
    for (var p = 0; p < indent; p++) pad += "  ";

    var result = pad + this.render();
    for (var i = 0; i < this.children.length; i++) {
      result += "\n" + this.children[i].toTree(indent + 1);
    }
    return result;
  }
}

class Dashboard extends Component {
  render() { return "<Dashboard restaurant=\"" + this.props.restaurant + "\">"; }
}

class Header extends Component {
  render() { return "<Header text=\"" + (this.props.text || "") + "\">"; }
}

class OrderList extends Component {
  render() {
    var orders = this.props.orders || [];
    return "<OrderList count=" + orders.length + ">";
  }
}

class OrderCard extends Component {
  render() {
    return "<OrderCard [" + (this.props.status || "Placed") + "] \"" + this.props.item + "\">";
  }
}

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Decorator (add logging without modifying source)
// ────────────────────────────────────────────────────────────

function withLogging(component) {
  component.logs = [];
  var originalMount = component.mount.bind(component);
  component.mount = function() {
    component.logs.push("[LOG] " + component.name + " mounting");
    return originalMount();
  };
  return component;
}

// ────────────────────────────────────────────────────────────
// DEMO — All patterns working together
// ────────────────────────────────────────────────────────────

console.log("=== Swiggy Dashboard ===\n");

// 1. Build component tree
var app = new Dashboard("Dashboard", { restaurant: "Meghana's Biryani" });
var header = new Header("Header", { text: "Welcome to Swiggy" });
var orderList = new OrderList("OrderList", { orders: [] });

app.addChild(withLogging(header));
app.addChild(orderList);
app.mount();

console.log("--- Component Tree ---");
console.log(app.toTree());

// 2. Reactive store
var store = new ReactiveState({
  restaurant: "Meghana's Biryani",
  orders: []
});

// When orders change, update the OrderList component
store.subscribe(function(change) {
  if (change.key === "orders") {
    orderList.update({ orders: change.value });
  }
});

// 3. Add orders through the store
var orders = [];
orders.push({ item: "Hyderabadi Biryani", status: "Placed", price: 350 });
orders.push({ item: "Masala Dosa", status: "Placed", price: 120 });
store.set("orders", orders);

console.log("\nOrders:", store.get("orders").length);

// 4. Add OrderCards as children
orderList.children = [];
var currentOrders = store.get("orders");
for (var i = 0; i < currentOrders.length; i++) {
  var card = new OrderCard("OrderCard-" + i, {
    item: currentOrders[i].item,
    status: currentOrders[i].status
  });
  orderList.addChild(card);
  card.mount();
}

console.log("\n--- Tree with Orders ---");
console.log(app.toTree());

// 5. Update status
currentOrders[0].status = "Preparing";
store.set("orders", currentOrders);
console.log("Order 0 status:", store.get("orders")[0].status);

// 6. Check decorator logs
console.log("Header logs:", header.logs.join(", "));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Composite treats single components and trees with the same API.
// 2. Reactive state auto-notifies subscribers on change — like Vue.
// 3. Decorators (withLogging) add behavior without touching source.
// 4. Store + subscribe lets components react to relevant state.
// 5. This is a simplified version of how React/Vue work internally.

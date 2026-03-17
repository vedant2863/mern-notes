/**
 * ============================================================
 *  FILE 33 : Repository, Service Layer & Unit of Work
 *  WHERE YOU SEE THIS: Express/NestJS backends, any app that
 *    separates database access from business logic
 * ============================================================
 */

// STORY: Seth Govind ji runs a kirana store. He separates godown shelves
// (Repository) from business decisions (Service Layer) like pricing
// and stock checks.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Repository Pattern
// ────────────────────────────────────────────────────────────
// Hides WHERE data lives. Consumers call findById — never know the storage.

class GodownRepo {
  constructor() {
    this.store = {};
    this.nextId = 1;
  }

  create(item) {
    var id = this.nextId;
    this.nextId++;
    var record = { id: id, name: item.name, qty: item.qty, price: item.price };
    this.store[id] = record;
    return record;
  }

  findById(id) {
    return this.store[id] || null;
  }

  findAll() {
    var results = [];
    var keys = Object.keys(this.store);
    for (var i = 0; i < keys.length; i++) {
      results.push(this.store[keys[i]]);
    }
    return results;
  }

  update(id, changes) {
    var existing = this.store[id];
    if (!existing) return null;
    var keys = Object.keys(changes);
    for (var i = 0; i < keys.length; i++) {
      existing[keys[i]] = changes[keys[i]];
    }
    return existing;
  }

  remove(id) {
    delete this.store[id];
  }
}

console.log("=== Repository Pattern ===");
var kiranaRepo = new GodownRepo();
kiranaRepo.create({ name: "Atta 10kg", qty: 200, price: 450 });
kiranaRepo.create({ name: "Toor Dal 1kg", qty: 50, price: 160 });
console.log("Item #1:", kiranaRepo.findById(1).name);
console.log("All count:", kiranaRepo.findAll().length);

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Service Layer (Business Logic)
// ────────────────────────────────────────────────────────────
// Sits between controllers and repos. Enforces business rules.

class KiranaService {
  constructor(itemRepo, orderRepo) {
    this.items = itemRepo;
    this.orders = orderRepo;
  }

  placeOrder(itemId, qty) {
    var product = this.items.findById(itemId);
    if (!product) {
      throw new Error("Item not found");
    }

    if (product.qty < qty) {
      return { success: false, reason: "Insufficient stock" };
    }

    this.items.update(itemId, { qty: product.qty - qty });

    var total = product.price * qty;
    var order = this.orders.create({
      name: "Order for item " + itemId,
      qty: qty,
      price: total
    });

    return { success: true, order: order };
  }
}

console.log("\n=== Service Layer ===");
var orderRepo = new GodownRepo();
var service = new KiranaService(kiranaRepo, orderRepo);

var o1 = service.placeOrder(1, 50);
console.log("Order success:", o1.success, "| Total:", o1.order.price);

var o2 = service.placeOrder(1, 999);
console.log("Oversell blocked:", o2.reason);

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Unit of Work (Batch Changes)
// ────────────────────────────────────────────────────────────
// Collects all changes, commits them as one batch — or rolls back.

class UnitOfWork {
  constructor() {
    this.operations = [];
  }

  addCreate(repo, item) {
    this.operations.push({ type: "create", repo: repo, item: item });
  }

  addUpdate(repo, id, changes) {
    this.operations.push({ type: "update", repo: repo, id: id, changes: changes });
  }

  commit() {
    for (var i = 0; i < this.operations.length; i++) {
      var op = this.operations[i];
      if (op.type === "create") {
        op.repo.create(op.item);
      } else if (op.type === "update") {
        op.repo.update(op.id, op.changes);
      }
    }
    var count = this.operations.length;
    this.operations = [];
    return { success: true, count: count };
  }

  rollback() {
    var count = this.operations.length;
    this.operations = [];
    return count;
  }
}

console.log("\n=== Unit of Work ===");
var godownRepo = new GodownRepo();
var uow = new UnitOfWork();

uow.addCreate(godownRepo, { name: "Mustard Oil", qty: 300, price: 185 });
uow.addCreate(godownRepo, { name: "Sugar 1kg", qty: 250, price: 45 });
console.log("Pending ops:", uow.operations.length);

var result = uow.commit();
console.log("Committed:", result.success, "| ops:", result.count);

var uow2 = new UnitOfWork();
uow2.addCreate(godownRepo, { name: "Phantom Item", qty: 0, price: 0 });
console.log("Rolled back:", uow2.rollback());

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Repository abstracts data access — swap storage without changing logic.
// 2. Service Layer enforces business rules between controllers and repos.
// 3. Unit of Work batches mutations and commits or rolls back as one.
// 4. Together: storage | logic | transactions — clean separation.
// 5. Test services by injecting fake repos — no database needed.

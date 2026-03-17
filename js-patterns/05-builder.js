/**
 * ============================================================
 *  FILE 5 : Rajma Chawal Tiffin Service — Builder Pattern
 *  Topic  : Builder, Director, Fluent Builder
 *  Where you'll see this: Knex query builder, Mongoose schema, test fixtures
 * ============================================================
 */

// STORY: Amma builds complex thali orders step by step for her
// tiffin service. Endless combos, but always a controlled process.

console.log("=== FILE 05: Rajma Chawal Tiffin Service ===\n");

// ────────────────────────────────────
// BLOCK 1 — Builder with Director
// ────────────────────────────────────

class Thali {
  constructor() {
    this.items = [];
    this.drink = null;
    this.notes = "";
  }

  toString() {
    let result = "Items: " + this.items.join(", ");
    if (this.drink) result += " | Drink: " + this.drink;
    if (this.notes) result += " | Notes: " + this.notes;
    return result;
  }
}

class ThaliBuilder {
  constructor() { this.thali = new Thali(); }

  addDal(item)   { this.thali.items.push("Dal(" + item + ")");   return this; }
  addRoti(item)  { this.thali.items.push("Roti(" + item + ")");  return this; }
  addSabzi(item) { this.thali.items.push("Sabzi(" + item + ")"); return this; }
  addRice(item)  { this.thali.items.push("Rice(" + item + ")");  return this; }
  addSweet(item) { this.thali.items.push("Sweet(" + item + ")"); return this; }
  setDrink(item) { this.thali.drink = item; return this; }
  setNotes(text) { this.thali.notes = text; return this; }

  build() {
    const result = this.thali;
    this.thali = new Thali(); // reset so builder is reusable
    return result;
  }
}

// Director knows the recipes — client code stays clean
class ThaliDirector {
  constructor(builder) { this.builder = builder; }

  makePunjabiThali() {
    return this.builder
      .addDal("Dal Makhani").addRoti("Butter Naan")
      .addSabzi("Paneer Butter Masala").addRice("Jeera Rice")
      .addSweet("Gulab Jamun").setDrink("Lassi")
      .setNotes("Amma's Punjabi special").build();
  }

  makeSouthIndianThali() {
    return this.builder
      .addDal("Sambar").addRice("Steamed Rice")
      .addSabzi("Avial").setDrink("Buttermilk").build();
  }
}

const builder = new ThaliBuilder();
const director = new ThaliDirector(builder);

console.log("Punjabi:", director.makePunjabiThali().toString());
console.log("South Indian:", director.makeSouthIndianThali().toString());

// You can also build custom thalis directly
const custom = builder
  .addDal("Rajma").addRice("Chawal")
  .addSabzi("Aloo Gobi").setDrink("Chaas").build();
console.log("Custom:", custom.toString());

// ────────────────────────────────────
// BLOCK 2 — Fluent Query Builder
// ────────────────────────────────────

console.log("\n--- Fluent Query Builder ---");

class QueryBuilder {
  constructor(table) {
    this._table = table;
    this._fields = ["*"];
    this._conditions = [];
    this._orderField = null;
    this._orderDir = "ASC";
    this._limitVal = null;
  }

  select(fields) {
    this._fields = fields;
    return this;
  }

  where(condition) {
    this._conditions.push(condition);
    return this;
  }

  orderBy(field, dir) {
    this._orderField = field;
    this._orderDir = dir || "ASC";
    return this;
  }

  limit(n) {
    this._limitVal = n;
    return this;
  }

  build() {
    let sql = "SELECT " + this._fields.join(", ") + " FROM " + this._table;
    if (this._conditions.length > 0) {
      sql += " WHERE " + this._conditions.join(" AND ");
    }
    if (this._orderField) {
      sql += " ORDER BY " + this._orderField + " " + this._orderDir;
    }
    if (this._limitVal !== null) {
      sql += " LIMIT " + this._limitVal;
    }
    return sql;
  }
}

const query = new QueryBuilder("tiffin_orders")
  .select(["customer", "thali_type", "price"])
  .where("thali_type = 'Punjabi'")
  .where("price >= 150")
  .orderBy("price", "DESC")
  .limit(10)
  .build();

console.log("Query:", query);
console.log("Simple:", new QueryBuilder("daily_menu").build());

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Builder constructs complex objects step by step — no mega-constructors.
// 2. Director encapsulates common presets (recipes).
// 3. Fluent Builders return "this" so you can chain method calls.
// 4. Always reset state after build() so the builder is reusable.

console.log("\n=== Amma packs the last tiffin. Khana taiyaar hai! ===");

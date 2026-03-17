/**
 * ============================================================
 *  FILE 12 : The Composite Pattern
 *  Topic   : Composite, Tree Structure
 *  Impact  : React component trees, file explorers,
 *            nested menu systems, org chart UIs
 * ============================================================
 */

// STORY: Colonel Chauhan commands an Indian Army brigade.
// A single jawan and an entire battalion both respond to
// the same orders — "report strength", "march forward".

// ────────────────────────────────────────────────────────────
// BLOCK 1 — File System Tree
// ────────────────────────────────────────────────────────────

class File {
  constructor(name, size) {
    this.name = name;
    this.size = size;
  }

  getSize() {
    return this.size;
  }

  print(indent) {
    indent = indent || "";
    return indent + "File: " + this.name + " (" + this.size + "KB)";
  }
}

class Directory {
  constructor(name) {
    this.name = name;
    this.children = [];
  }

  add(child) {
    this.children.push(child);
    return this;
  }

  getSize() {
    let total = 0;
    for (let i = 0; i < this.children.length; i++) {
      total = total + this.children[i].getSize();
    }
    return total;
  }

  print(indent) {
    indent = indent || "";
    let lines = [indent + "Dir: " + this.name + "/"];
    for (let i = 0; i < this.children.length; i++) {
      lines.push(this.children[i].print(indent + "  "));
    }
    return lines.join("\n");
  }
}

console.log("=== BLOCK 1: File System Tree ===");
let src = new Directory("src");
let utils = new Directory("utils");
utils.add(new File("helpers.js", 12));
utils.add(new File("logger.js", 8));
src.add(new File("index.js", 25));
src.add(utils);

console.log(src.print());
console.log("Total size: " + src.getSize() + "KB");

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Mess System with Nested Submenus
// ────────────────────────────────────────────────────────────

class MenuItem {
  constructor(name, price) {
    this.name = name;
    this.price = price;
  }

  display(indent) {
    indent = indent || "";
    return indent + this.name + " — Rs." + this.price;
  }

  countItems() {
    return 1;
  }
}

class SubMenu {
  constructor(title) {
    this.title = title;
    this.items = [];
  }

  add(item) {
    this.items.push(item);
    return this;
  }

  display(indent) {
    indent = indent || "";
    let lines = [indent + "[" + this.title + "]"];
    for (let i = 0; i < this.items.length; i++) {
      lines.push(this.items[i].display(indent + "  "));
    }
    return lines.join("\n");
  }

  countItems() {
    let total = 0;
    for (let i = 0; i < this.items.length; i++) {
      total = total + this.items[i].countItems();
    }
    return total;
  }
}

console.log("\n=== BLOCK 2: Mess System ===");
let mainMenu = new SubMenu("Chauhan Brigade Mess Hall");

let breakfast = new SubMenu("Breakfast");
breakfast.add(new MenuItem("Aloo Paratha & Dahi", 45));
breakfast.add(new MenuItem("Poha", 25));

let drinks = new SubMenu("Drinks");
drinks.add(new MenuItem("Masala Chai", 15));
drinks.add(new MenuItem("Nimbu Pani", 10));
breakfast.add(drinks);

let dinner = new SubMenu("Dinner");
dinner.add(new MenuItem("Mutton Curry & Roti", 120));
dinner.add(new MenuItem("Rajma Chawal", 60));

mainMenu.add(breakfast);
mainMenu.add(dinner);

console.log(mainMenu.display());
console.log("Total menu items: " + mainMenu.countItems());

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Composite lets you treat single items and groups the same way.
// 2. Recursive delegation fans operations out to every leaf.
// 3. Common in file systems, UI trees, org charts, menus.
// 4. No if/else needed to check if something is a leaf or branch.

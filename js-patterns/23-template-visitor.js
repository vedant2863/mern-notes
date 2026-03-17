/**
 * FILE 23 : Template Method & Visitor Patterns
 * Topic   : Behavioral Design Patterns
 * Used in : React component lifecycle (Template), Babel AST transforms (Visitor)
 */

// STORY: Sthapati Vishwakarma follows Vastu blueprints for temples (Template).
// GST Inspector Mehta visits every shop on the street (Visitor).

// ────────────────────────────────────────────────────────────
//  BLOCK 1 : Template Method (fixed skeleton, override steps)
// ────────────────────────────────────────────────────────────

class TempleBlueprint {
  build() {
    const steps = [];
    steps.push(this.layFoundation());
    steps.push(this.erectPillars());
    steps.push(this.buildSanctum());
    steps.push(this.addTower());
    return steps;
  }

  layFoundation() { return "generic stone foundation"; }
  erectPillars() { return "generic pillars"; }
  buildSanctum() { return "generic sanctum"; }
  addTower() { return "plain tower"; }
}

class DravidianTemple extends TempleBlueprint {
  layFoundation() { return "granite platform with Vastu grid"; }
  erectPillars() { return "carved granite pillars"; }
  buildSanctum() { return "dark granite garbhagriha"; }
  addTower() { return "towering gopuram with painted stucco"; }
}

class NagaraTemple extends TempleBlueprint {
  layFoundation() { return "sandstone jagati platform"; }
  erectPillars() { return "carved sandstone pillars"; }
  buildSanctum() { return "marble garbhagriha with idol"; }
  // addTower() uses default "plain tower"
}

console.log("=== Temple Blueprints (Template Method) ===");

const dravidian = new DravidianTemple().build();
console.log("  Dravidian:", dravidian.join(" -> "));

const nagara = new NagaraTemple().build();
console.log("  Nagara:", nagara.join(" -> "));

// ────────────────────────────────────────────────────────────
//  BLOCK 2 : Visitor (GST Inspector visits shops)
// ────────────────────────────────────────────────────────────

class KiranaShop {
  constructor(revenue) { this.revenue = revenue; }
  accept(visitor) { return visitor.visitKirana(this); }
}

class MedicalShop {
  constructor(revenue) { this.revenue = revenue; }
  accept(visitor) { return visitor.visitMedical(this); }
}

class GSTVisitor {
  visitKirana(shop) {
    return Math.round(shop.revenue * 0.05);
  }
  visitMedical(shop) {
    return Math.round(shop.revenue * 0.12);
  }
}

class ComplianceVisitor {
  visitKirana(shop) {
    if (shop.revenue > 2000000) return "GST registration needed";
    return "Exempt";
  }
  visitMedical(shop) {
    if (shop.revenue > 2000000) return "GST + Drug License check";
    return "Drug License only";
  }
}

console.log("\n=== GST Inspector Mehta (Visitor) ===");

const kirana = new KiranaShop(500000);
const medical = new MedicalShop(3000000);
const gst = new GSTVisitor();
const compliance = new ComplianceVisitor();

console.log("  Kirana GST:", kirana.accept(gst), "| Compliance:", kirana.accept(compliance));
console.log("  Medical GST:", medical.accept(gst), "| Compliance:", medical.accept(compliance));

// ────────────────────────────────────────────────────────────
//  BLOCK 3 : Visitor on a Tree (Chandni Chowk Market)
// ────────────────────────────────────────────────────────────

class Market {
  constructor(name, children) {
    this.name = name;
    this.children = children || [];
  }
  accept(visitor) { return visitor.visitMarket(this); }
}

class Shop {
  constructor(name, rent) {
    this.name = name;
    this.rent = rent;
  }
  accept(visitor) { return visitor.visitShop(this); }
}

class RentVisitor {
  visitShop(node) {
    return node.rent;
  }
  visitMarket(node) {
    let total = 0;
    for (let i = 0; i < node.children.length; i++) {
      total = total + node.children[i].accept(this);
    }
    return total;
  }
}

console.log("\n=== Chandni Chowk Market (Tree Visitor) ===");

const market = new Market("Chandni Chowk", [
  new Market("Spice Lane", [new Shop("Sharma Masala", 25000), new Shop("Gupta Dry Fruits", 18000)]),
  new Market("Cloth Lane", [new Shop("Bansal Sarees", 40000), new Shop("Agarwal Silks", 35000)]),
  new Shop("Jain Chai Stall", 8000),
]);

console.log("  Total rent:", market.accept(new RentVisitor()));

// ────────────────────────────────────────────────────────────
//  KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Template Method locks the build sequence; subclasses only override steps.
// 2. Visitor separates operations from structure: shop.accept(visitor) -> visitor.visitX(shop).
// 3. Adding a new inspection = new visitor class. No shop code changes.
// 4. Trade-off: adding a new shop TYPE means updating every visitor.

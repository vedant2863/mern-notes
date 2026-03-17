/**
 * ============================================================
 *  FILE 4 : Gupta ji's Wedding Planner — Abstract Factory
 *  Topic  : Abstract Factory, Factory Families
 *  Where you'll see this: UI theme systems, cross-platform kits
 * ============================================================
 */

// STORY: Gupta ji creates themed wedding kits. Each kit has matching
// venue, music, and decoration — swap the theme in one place.

console.log("=== FILE 04: Gupta ji's Wedding Planner ===\n");

// ────────────────────────────────────
// BLOCK 1 — Themed Wedding Kit Factories
// ────────────────────────────────────

function createProduct(name, style, category) {
  return {
    name: name,
    style: style,
    category: category,
    render() {
      return "[" + style + " " + category + ": " + name + "]";
    },
  };
}

class NorthIndianWeddingFactory {
  createVenue(name) { return createProduct(name, "NorthIndian", "Venue"); }
  createMusic(name) { return createProduct(name, "NorthIndian", "Music"); }
  createDecoration(name) { return createProduct(name, "NorthIndian", "Decoration"); }
}

class SouthIndianWeddingFactory {
  createVenue(name) { return createProduct(name, "SouthIndian", "Venue"); }
  createMusic(name) { return createProduct(name, "SouthIndian", "Music"); }
  createDecoration(name) { return createProduct(name, "SouthIndian", "Decoration"); }
}

// Client code works with ANY factory — it never knows the theme
function planWedding(factory) {
  const venue = factory.createVenue("Grand Mandap");
  const music = factory.createMusic("Shehnai Ensemble");
  const decoration = factory.createDecoration("Marigold Archway");
  return { venue, music, decoration };
}

const northKit = planWedding(new NorthIndianWeddingFactory());
console.log(northKit.venue.render());
console.log(northKit.music.render());

const southKit = planWedding(new SouthIndianWeddingFactory());
console.log(southKit.venue.render());
console.log(southKit.decoration.render());

// ────────────────────────────────────
// BLOCK 2 — Registry for Dynamic Theme Selection
// ────────────────────────────────────

console.log("\n--- Region-Based Factory Selection ---");

const factoryRegistry = {
  northindian: NorthIndianWeddingFactory,
  southindian: SouthIndianWeddingFactory,
};

function getWeddingFactory(region) {
  const Factory = factoryRegistry[region];
  if (!Factory) {
    throw new Error("Gupta ji has no kit for region: " + region);
  }
  return new Factory();
}

// Adding a new theme — just one class and one registry entry
class RajasthaniWeddingFactory {
  createVenue(name) { return createProduct(name, "Rajasthani", "Venue"); }
  createMusic(name) { return createProduct(name, "Rajasthani", "Music"); }
  createDecoration(name) { return createProduct(name, "Rajasthani", "Decoration"); }
}
factoryRegistry.rajasthani = RajasthaniWeddingFactory;

const rajKit = planWedding(getWeddingFactory("rajasthani"));
console.log(rajKit.venue.render());

try {
  getWeddingFactory("european");
} catch (err) {
  console.log("Error:", err.message);
}

// ────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────
// 1. Abstract Factory creates FAMILIES of related objects (venue + music + decor).
// 2. Swap the entire family by changing one factory instance.
// 3. A registry avoids brittle switch statements for theme selection.
// 4. Factory Method = one product. Abstract Factory = a family of products.

console.log("\n=== Gupta ji ships the kits. Every item matches the theme. ===");

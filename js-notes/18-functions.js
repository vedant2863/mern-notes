// ============================================================
// FILE 18: FUNCTIONS
// Topic: Declaration styles, parameters, return values, IIFE,
//        first-class functions, pure functions
// WHY: Functions are the fundamental unit of reusable logic in JS.
// ============================================================

// ============================================================
// EXAMPLE 1 — Amma's Masala Kitchen: Recipe Formats
// Story: Each recipe format illustrates a different
// way to define and use functions.
// ============================================================

// --- Function Declaration (hoisted — callable before it appears) ---

console.log(cookDish("Jeera Rice", 3));

function cookDish(dish, servings) {
  return `Cooking ${dish} (serves ${servings})... Dish ready!`;
}

// --- Function Expression (NOT hoisted) ---

const prepareChutney = function (ingredient) {
  return `Grinding chutney with ${ingredient}...`;
};
console.log(prepareChutney("Mint"));

// Named expression — name visible only inside (useful for recursion)
const factorialRotis = function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
};
console.log("5! =", factorialRotis(5));

// --- Arrow Function (no own `this`, no `arguments`, not hoisted) ---

const grindMasala = (spice) => `Grinding ${spice}...`;
console.log(grindMasala("Garam Masala"));

// Implicit return of an object — wrap in ()
const createRecipe = (name, spice) => ({ name, spice, created: Date.now() });
console.log(createRecipe("Paneer Tikka", 7));

// --- Default Parameters ---

function prepareIngredient(name, quantity = 2, unit = "tsp") {
  console.log(`Adding ${quantity} ${unit} of ${name}`);
}
prepareIngredient("Haldi", undefined, "pinch"); // 2 pinch of Haldi

// --- Rest Parameters ---

function makeTadka(dish, ...toppings) {
  console.log(`${dish} gets: ${toppings.join(", ")}`);
}
makeTadka("Dal Fry", "Cumin Seeds", "Curry Leaves", "Hing");

// --- Return Values ---

// Returning multiple values via object
function analyzeDish(name) {
  return { name, spiceLevel: Math.floor(Math.random() * 100), isVeg: true };
}

// Guard clauses with early return
function validateRecipe(recipe) {
  if (!recipe) return "Error: No recipe provided";
  if (!recipe.name) return "Error: Recipe must have a name";
  return `Recipe "${recipe.name}" is valid!`;
}
console.log(validateRecipe({ name: "Masala Chai", ingredients: ["Tea"] }));


// ============================================================
// EXAMPLE 2 — Advanced Techniques
// ============================================================

// --- IIFE (private scope, one-time initialization) ---

const ammasKitchen = (function () {
  let dishesCooked = 0;
  return {
    cook() { return `Cooked dish #${++dishesCooked}`; },
    getCount() { return dishesCooked; },
  };
})();

console.log(ammasKitchen.cook()); // Cooked dish #1
console.log(ammasKitchen.cook()); // Cooked dish #2

// --- Functions as First-Class Citizens ---

// Passed as argument (callback)
const ingredients = ["haldi", "jeera", "dhania"];
const prepared = ingredients.map((item) => item.toUpperCase());
console.log(prepared);

// Returned from function (factory)
function createRecipeMaker(cuisine) {
  return (ingredient) => `${cuisine} dish made with ${ingredient}`;
}
const makeSouthIndian = createRecipeMaker("South Indian");
console.log(makeSouthIndian("Coconut"));

// Stored in data structure
const recipes = {
  dal: (qty) => `Cook ${qty} cups of dal`,
  roti: (count) => `Roll ${count} rotis`,
};
console.log(recipes.roti(10));

// --- Pure Functions vs Side Effects ---

// PURE — same input always gives same output, no side effects
function calculateServings(base, multiplier) {
  return base * multiplier;
}

// IMPURE — mutates external state
let globalCount = 0;
function cookAndCount(name) {
  globalCount++;
  return `Cooked ${name}. Total: ${globalCount}`;
}

// Pure alternative — returns new data, no mutation
function addToMenu(menu, newDish) {
  return [...menu, newDish];
}
const todaysMenu = ["Dal Makhani", "Jeera Rice"];
const updatedMenu = addToMenu(todaysMenu, "Gulab Jamun");
console.log(todaysMenu);   // unchanged
console.log(updatedMenu);  // includes Gulab Jamun


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Declarations are hoisted; expressions and arrows are not.
// 2. Arrow functions have no own `this`, no `arguments`, no `new`.
// 3. Default params handle undefined correctly — no || needed.
// 4. Rest params (...args) collect into a real array.
// 5. IIFE creates a one-time private scope.
// 6. Functions are first-class: store, pass, and return them.
// 7. Pure functions (no side effects, deterministic) are
//    easier to test. Isolate side effects to program edges.
// ============================================================

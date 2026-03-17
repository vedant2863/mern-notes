// ============================================================
//  FILE 2 : Variables & Mutability
// ============================================================
//  Topic  : let, mut, shadowing, const, static, type inference,
//           naming conventions, destructuring, scope
// ============================================================

// ============================================================
// STORY: Amma has two kinds of recipes — carved in stone (const):
// turmeric = always 1 tsp. Written in pencil (let mut): sugar
// depends on who's coming. Immutable by default, mutable by choice.
// ============================================================

const AMMA_TURMERIC_TSP: f64 = 1.0;
const MAX_GUESTS: u32 = 50;

// Static — fixed memory address, lives entire program
static KITCHEN_NAME: &str = "Amma's Kitchen";
static mut DISHES_SERVED: u32 = 0; // mutable static = unsafe!

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — Immutable Variables (default)
    // ──────────────────────────────────────────────────────────

    let dal_servings = 4;
    println!("Dal servings: {}", dal_servings);
    // dal_servings = 6;  // ERROR: cannot assign twice to immutable variable

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — Mutable Variables
    // ──────────────────────────────────────────────────────────
    // `mut` signals intent: "I know this will change."

    let mut sugar_tsp = 2.0;
    println!("Sugar for Amma: {} tsp", sugar_tsp);
    sugar_tsp = 3.5;
    sugar_tsp += 0.5;
    println!("Extra sweet: {} tsp", sugar_tsp);

    let mut shopping_list = String::from("Rice");
    shopping_list.push_str(", Dal, Ghee");
    println!("Shopping: {}", shopping_list);

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — Shadowing
    // ──────────────────────────────────────────────────────────
    // Reuses the name with a new value AND can change TYPE.

    let guests = 5;
    let guests = guests + 3; // shadow with new value
    let guests = "eight";    // shadow with new TYPE — fine!
    println!("Guests (word): {}", guests);

    // mut CANNOT change type:
    // let mut count = 5; count = "five"; // ERROR: mismatched types

    // Shadowing in inner scope
    let spice_level = "medium";
    {
        let spice_level = "extra hot"; // shadows only in this block
        println!("Inside: {}", spice_level);
    }
    println!("Outside: {}", spice_level);

    // Practical: parsing string to number
    let price = "150";
    let price: i32 = price.parse().expect("Not a number!");
    println!("Price (parsed): ₹{}", price);

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — Constants
    // ──────────────────────────────────────────────────────────
    // Compile-time, inlined, MUST have type annotation.

    println!("Turmeric: {} tsp (always)", AMMA_TURMERIC_TSP);
    println!("Max guests: {}", MAX_GUESTS);

    // const vs let:
    // const → type required, compile-time, SCREAMING_SNAKE_CASE
    // let   → type inferred, runtime, snake_case

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — Static Variables
    // ──────────────────────────────────────────────────────────
    // Unlike const: has a fixed memory address, can take references.

    println!("Kitchen: {}", KITCHEN_NAME);

    unsafe {
        DISHES_SERVED += 1;
        println!("Dishes served: {}", DISHES_SERVED);
    }
    // In practice, prefer AtomicU32 or Mutex over mutable static.

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Type Inference
    // ──────────────────────────────────────────────────────────

    let servings = 4;          // i32 (default int)
    let temperature = 98.6;    // f64 (default float)
    let is_ready = true;       // bool

    // Explicit annotation when ambiguous
    let parsed: i64 = "42".parse().expect("parse failed");

    // Turbofish syntax ::<Type>
    let parsed_turbo = "100".parse::<u32>().expect("parse failed");
    println!("Parsed: {}, Turbofish: {}", parsed, parsed_turbo);

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Naming Conventions
    // ──────────────────────────────────────────────────────────
    // snake_case       → variables, functions, modules
    // SCREAMING_SNAKE  → constants, statics
    // CamelCase        → types, traits, enums, structs
    // _prefix          → unused variables (suppresses warnings)

    let _unused_spice = "cardamom"; // no warning
    let _ = complex_calculation();  // discard entirely

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Destructuring
    // ──────────────────────────────────────────────────────────

    let recipe = ("Sambar", 30, true);
    let (dish, time, veg) = recipe;
    println!("{}: {} min, veg={}", dish, time, veg);

    let (name, _, _) = recipe; // ignore parts with _
    println!("Just the name: {}", name);

    let [morning, _, evening] = ["Breakfast", "Lunch", "Dinner"];
    println!("Evening meal: {}", evening);

    // ──────────────────────────────────────────────────────────
    // SECTION 9 — Swap & Multiple Assignment
    // ──────────────────────────────────────────────────────────

    let (x, y, z) = (1, 2, 3);
    println!("x={}, y={}, z={}", x, y, z);

    let mut a = "Idli";
    let mut b = "Dosa";
    std::mem::swap(&mut a, &mut b);
    println!("After swap: a={}, b={}", a, b);

    // ──────────────────────────────────────────────────────────
    // SECTION 10 — Scope & Block Expressions
    // ──────────────────────────────────────────────────────────
    // Variables live only within their block. Blocks return their
    // last expression (no semicolon).

    {
        let kitchen_temp = 42;
        println!("Inside kitchen: {}°C", kitchen_temp);
    }
    // kitchen_temp is dropped here

    let dinner_status = {
        let guests = 8;
        let dishes = 5;
        if guests > dishes { "Need more food!" } else { "We're good" }
    };
    println!("Status: {}", dinner_status);

    // ──────────────────────────────────────────────────────────
    // Common Gotchas
    // ──────────────────────────────────────────────────────────

    // Uninitialized variables must be assigned before use
    let total: i32;
    total = 42;
    println!("Total: {}", total);

    // Type changes need shadowing, not mut
    let input = "123";
    let input: i32 = input.parse().unwrap();
    println!("Input: {}", input);

    // Builder-style accumulation
    let mut order = String::new();
    order.push_str("1x Chai, 2x Samosa, 1x Jalebi");
    println!("Order: {}", order);

    println!("\n--- Amma's kitchen is ready to serve! ---");
}

fn complex_calculation() -> i32 { 42 }

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Variables are IMMUTABLE by default — use mut to opt in
// 2. Shadowing creates a NEW variable (can change type)
// 3. mut changes value but not type
// 4. const = compile-time, inlined, SCREAMING_SNAKE_CASE
// 5. static = fixed address, 'static lifetime, mutable = unsafe
// 6. Rust infers types; annotate when ambiguous
// 7. _prefix suppresses unused variable warnings
// 8. Block expressions return last expression (no ;)
// 9. Variables are dropped at end of scope
// ============================================================

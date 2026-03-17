// ============================================================
// FILE 17: CLOSURES — Anonymous Functions That Capture Context
// ============================================================
// Closures capture variables from their surrounding scope.
// They power map, filter, fold, callbacks, and concurrency.
// Almost every real Rust program uses closures extensively.
// ============================================================

// ============================================================
// STORY: Ola Surge Pricing Algorithm
// ============================================================
// During a Mumbai monsoon, each ride pricing closure "captures"
// the current demand_multiplier from its environment. When
// demand spikes near Andheri at 6 PM, the closure captures
// 2.5x. The function body is the same, but the captured
// context changes everything.
// ============================================================

use std::fmt;

// ============================================================
// 1. CLOSURE SYNTAX
// ============================================================

fn demonstrate_basic_syntax() {
    println!("--- 1. Closure Syntax ---");

    let add = |x: i32, y: i32| -> i32 { x + y };
    let multiply = |x, y| x * y;
    let double = |x: i32| x * 2;
    let greet = || println!("  Namaste from Ola!");

    let calculate_fare = |distance_km: f64, surge: f64| {
        let base_fare = 50.0;
        let per_km = 12.0;
        (base_fare + per_km * distance_km) * surge
    };

    println!("  add(3, 4) = {}", add(3, 4));
    println!("  multiply(5, 6) = {}", multiply(5, 6));
    println!("  double(21) = {}", double(21));
    greet();
    println!("  Fare (10km, 1.5x surge): Rs.{:.0}", calculate_fare(10.0, 1.5));
}

// ============================================================
// 2. CAPTURING VARIABLES
// ============================================================
// Closures capture by: immutable ref (Fn), mutable ref (FnMut),
// or ownership (FnOnce).

fn demonstrate_capturing() {
    println!("\n--- 2. Capturing Variables ---");

    // Capture by immutable reference (Fn)
    let city = String::from("Mumbai");
    let surge = 2.0;
    let display_surge = || println!("  Surge in {}: {}x", city, surge);
    display_surge();
    display_surge();
    println!("  City still available: {}", city);

    // Capture by mutable reference (FnMut)
    let mut ride_count = 0;
    let mut count_ride = || {
        ride_count += 1;
        println!("  Ride #{} booked", ride_count);
    };
    count_ride();
    count_ride();

    // Capture by ownership (FnOnce)
    let promo = String::from("MONSOON50");
    let consume_promo = || {
        let used = promo;
        println!("  Applied promo: {}", used);
    };
    consume_promo();
    // promo no longer available
}

// ============================================================
// 3. Fn, FnMut, FnOnce TRAITS
// ============================================================
// Fn <: FnMut <: FnOnce (subtype relationship)

fn call_fn(f: &dyn Fn()) { f(); f(); }

fn call_fn_once(f: impl FnOnce() -> String) -> String { f() }

fn demonstrate_closure_traits() {
    println!("\n--- 3. Fn / FnMut / FnOnce Traits ---");

    let zone = "Andheri";
    let show_zone = || println!("  Zone: {}", zone);
    call_fn(&show_zone);

    let voucher = String::from("FIRSTRIDE");
    let use_voucher = || format!("Voucher '{}' redeemed!", voucher);
    println!("  {}", call_fn_once(use_voucher));
}

// ============================================================
// 4. MOVE KEYWORD
// ============================================================
// Forces ownership transfer. Essential for threads.

fn demonstrate_move_closures() {
    println!("\n--- 4. Move Closures ---");

    let driver = String::from("Rajesh");
    let greet_move = move || println!("  Driver: {}", driver);
    greet_move();
    // driver no longer available

    // Move with Copy types — copies the value, original still works
    let surge = 1.5_f64;
    let calc = move || surge * 100.0;
    println!("  Calc result: {}", calc());
    println!("  Surge still available: {}", surge);
}

// ============================================================
// 5. CLOSURES AS FUNCTION PARAMETERS
// ============================================================

fn apply_surge(base_fare: f64, strategy: impl Fn(f64) -> f64) -> f64 {
    strategy(base_fare)
}

fn apply_all_transforms(fare: f64, transforms: &[&dyn Fn(f64) -> f64]) -> f64 {
    transforms.iter().fold(fare, |result, t| t(result))
}

fn demonstrate_closures_as_params() {
    println!("\n--- 5. Closures as Function Parameters ---");

    let base = 200.0;
    println!("  Peak surge: Rs.{:.0}", apply_surge(base, |f| f * 2.5));
    println!("  Rain surge: Rs.{:.0}", apply_surge(base, |f| f * 1.8));
    println!("  No surge: Rs.{:.0}", apply_surge(base, |f| f));

    let add_gst = |f: f64| f * 1.18;
    let add_tip = |f: f64| f + 20.0;
    let round_up = |f: f64| (f / 10.0).ceil() * 10.0;
    let transforms: Vec<&dyn Fn(f64) -> f64> = vec![&add_gst, &add_tip, &round_up];
    println!("  After GST + tip + rounding: Rs.{:.0}", apply_all_transforms(200.0, &transforms));
}

// ============================================================
// 6. RETURNING CLOSURES
// ============================================================
// Must use impl Fn or Box<dyn Fn> (closures have anonymous types).

fn make_surge_calculator(multiplier: f64) -> impl Fn(f64) -> f64 {
    move |base_fare| base_fare * multiplier
}

fn get_pricing_strategy(time_of_day: u32) -> Box<dyn Fn(f64) -> f64> {
    match time_of_day {
        6..=9 | 17..=20 => Box::new(|fare| fare * 2.0),
        22..=23 | 0..=5 => Box::new(|fare| fare * 1.5),
        _ => Box::new(|fare| fare),
    }
}

fn demonstrate_returning_closures() {
    println!("\n--- 6. Returning Closures ---");

    let mumbai = make_surge_calculator(2.5);
    let delhi = make_surge_calculator(1.8);
    println!("  Mumbai Rs.100 ride: Rs.{:.0}", mumbai(100.0));
    println!("  Delhi Rs.100 ride: Rs.{:.0}", delhi(100.0));

    let morning = get_pricing_strategy(8);
    let night = get_pricing_strategy(23);
    println!("  8 AM (Rs.100): Rs.{:.0}", morning(100.0));
    println!("  11 PM (Rs.100): Rs.{:.0}", night(100.0));
}

// ============================================================
// 7. CLOSURES WITH ITERATORS
// ============================================================

fn demonstrate_iterator_closures() {
    println!("\n--- 7. Closures with Iterators ---");

    let fares = vec![120.0, 250.0, 80.0, 340.0, 190.0];

    let with_gst: Vec<f64> = fares.iter().map(|f| f * 1.18).collect();
    println!("  With GST: {:?}", with_gst);

    let premium: Vec<&f64> = fares.iter().filter(|f| **f > 200.0).collect();
    println!("  Premium rides (>200): {:?}", premium);

    let total: f64 = fares.iter().fold(0.0, |acc, f| acc + f);
    println!("  Total fares: Rs.{:.0}", total);

    let first_expensive = fares.iter().find(|f| **f > 300.0);
    println!("  First ride >300: {:?}", first_expensive);
}

// ============================================================
// 8. PRACTICAL PATTERNS
// ============================================================

struct Ride { distance_km: f64, fare: f64, zone: String }

impl fmt::Display for Ride {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Ride({}, Rs.{:.0}, {})", self.distance_km, self.fare, self.zone)
    }
}

// Closure-based builder pattern
struct FareCalculator { steps: Vec<Box<dyn Fn(f64) -> f64>> }

impl FareCalculator {
    fn new() -> Self { FareCalculator { steps: Vec::new() } }

    fn add_step(mut self, step: impl Fn(f64) -> f64 + 'static) -> Self {
        self.steps.push(Box::new(step));
        self
    }

    fn calculate(&self, base: f64) -> f64 {
        self.steps.iter().fold(base, |fare, step| step(fare))
    }
}

fn demonstrate_practical_patterns() {
    println!("\n--- 8. Practical Patterns ---");

    let calculator = FareCalculator::new()
        .add_step(|f| f * 1.5)
        .add_step(|f| f + 25.0)
        .add_step(|f| f * 1.18)
        .add_step(|f| (f * 100.0).round() / 100.0);

    println!("  Builder fare (200 base): Rs.{:.2}", calculator.calculate(200.0));

    println!("  impl Fn = static dispatch = zero cost (prefer this)");
    println!("  dyn Fn = dynamic dispatch = small vtable overhead");
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST CLOSURES: Ola Surge Pricing ===\n");

    demonstrate_basic_syntax();
    demonstrate_capturing();
    demonstrate_closure_traits();
    demonstrate_move_closures();
    demonstrate_closures_as_params();
    demonstrate_returning_closures();
    demonstrate_iterator_closures();
    demonstrate_practical_patterns();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. Closure syntax: |args| body (pipes, not parentheses)");
    println!("2. Closures capture variables from their environment");
    println!("3. Three modes: by ref (Fn), mut ref (FnMut), ownership (FnOnce)");
    println!("4. `move` forces ownership transfer (essential for threads)");
    println!("5. Pass closures with impl Fn (static) or dyn Fn (dynamic)");
    println!("6. Return closures with impl Fn or Box<dyn Fn>");
    println!("7. Closures power iterators: map, filter, fold, find");
    println!("8. Static dispatch (impl Fn) is zero-cost — prefer it");
}

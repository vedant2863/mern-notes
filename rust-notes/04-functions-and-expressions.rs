// ============================================================
//  FILE 4 : Functions & Expressions
// ============================================================
//  Topic  : fn, parameters, return values, expressions vs
//           statements, early return, function pointers, const fn
// ============================================================

// ============================================================
// STORY: IRCTC reservation clerks — each takes input (params),
// does processing, gives output (return). The key insight: Rust
// clerks "express" their result as the LAST expression — no
// explicit return stamp needed.
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — Basic Functions
    // ──────────────────────────────────────────────────────────

    greet_passenger("Ramesh");
    greet_passenger("Sharma ji");

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — Parameters & Return Values
    // ──────────────────────────────────────────────────────────
    // All params and return types MUST have explicit type annotations.

    let fare = calculate_fare(500, "3AC");
    println!("Fare for 500km in 3AC: ₹{:.2}", fare);

    // Multiple return values via tuple
    let (base, tax, total) = fare_with_tax(1000, "2AC");
    println!("Base: ₹{}, Tax: ₹{:.2}, Total: ₹{:.2}", base, tax, total);

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — Expressions vs Statements
    // ──────────────────────────────────────────────────────────
    // EXPRESSION: returns a value → 5 + 3, if/else, block
    // STATEMENT:  no value       → let x = 5;
    // Adding ; turns an expression into a statement (returns ())

    let platform = {
        let train = "Rajdhani";
        let number = 12301;
        format!("{} ({})", train, number) // no ; = return value
    };
    println!("Train: {}", platform);

    // if/else as expression
    let distance = 1200;
    let train_type = if distance > 1000 { "Superfast" } else { "Express" };
    println!("{}km → {}", distance, train_type);

    // match as expression
    let class = "1AC";
    let berth_count = match class {
        "1AC" => 18, "2AC" => 46, "3AC" => 64, "SL" => 72, _ => 0,
    };
    println!("{} has {} berths", class, berth_count);

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — Early Return
    // ──────────────────────────────────────────────────────────
    // Last expression is implicit return. Use `return` only for
    // short-circuiting.

    println!("PNR 1234567890: {}", check_pnr("1234567890"));
    println!("PNR 123: {}", check_pnr("123"));

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — Functions Returning Nothing
    // ──────────────────────────────────────────────────────────
    // Returns () (unit type). Can omit return type.

    stamp_ticket("Ramesh", "12301");

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Nested Functions
    // ──────────────────────────────────────────────────────────
    // Can't capture outer variables (unlike closures — File 17).

    fn format_pnr(digits: &str) -> String {
        fn add_dashes(s: &str) -> String {
            format!("{}-{}-{}", &s[..3], &s[3..7], &s[7..])
        }
        add_dashes(digits)
    }
    println!("Formatted PNR: {}", format_pnr("1234567890"));

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Function Pointers
    // ──────────────────────────────────────────────────────────
    // Functions are first-class: store in variables, pass as params.

    let fare_fn: fn(u32, &str) -> f64 = calculate_fare;
    println!("Via pointer: ₹{}", fare_fn(300, "SL"));

    // Higher-order: passing different pricing strategies
    let prices = [100, 250, 500, 1000];
    let discounted: Vec<f64> = prices.iter()
        .map(|&p| apply_discount(p, senior_discount))
        .collect();
    println!("Senior prices: {:?}", discounted);

    let tatkal: Vec<f64> = prices.iter()
        .map(|&p| apply_discount(p, tatkal_surcharge))
        .collect();
    println!("Tatkal prices: {:?}", tatkal);

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Diverging Functions (!)
    // ──────────────────────────────────────────────────────────
    // Functions that never return: panic!, loop {}, exit().
    // The `!` type coerces to any type.

    let status: &str = if true { "Running" } else { panic!("Unreachable") };
    println!("Status: {}", status);

    // ──────────────────────────────────────────────────────────
    // SECTION 9 — Practical Patterns
    // ──────────────────────────────────────────────────────────

    let receipt = build_receipt("Ramesh", "Delhi", "Mumbai", 1500.0);
    println!("{}", receipt);

    // Guard clauses (early return)
    println!("Can book: {}", can_book_tatkal(9, true));
    println!("Can book: {}", can_book_tatkal(11, true));

    // ──────────────────────────────────────────────────────────
    // SECTION 10 — const fn (compile-time evaluation)
    // ──────────────────────────────────────────────────────────

    const PLATFORM_COUNT: u32 = count_platforms(8, 4);
    println!("Total platforms: {}", PLATFORM_COUNT);

    println!("\n--- IRCTC counter is now closed. Thank you! ---");
}

// ============================================================
// Function Declarations
// ============================================================

fn greet_passenger(name: &str) {
    println!("Namaste, {}! Welcome to IRCTC.", name);
}

fn calculate_fare(distance_km: u32, class: &str) -> f64 {
    let rate = match class {
        "1AC" => 3.0, "2AC" => 2.0, "3AC" => 1.5, "SL" => 0.5, _ => 1.0,
    };
    distance_km as f64 * rate
}

fn fare_with_tax(distance_km: u32, class: &str) -> (f64, f64, f64) {
    let base = calculate_fare(distance_km, class);
    let tax = base * 0.18;
    (base, tax, base + tax)
}

fn check_pnr(pnr: &str) -> &str {
    if pnr.len() != 10 { return "Invalid PNR"; }
    "Confirmed"
}

fn stamp_ticket(name: &str, train: &str) {
    println!("Ticket stamped for {} on train {}", name, train);
}

fn senior_discount(price: u32) -> f64 { price as f64 * 0.6 }
fn tatkal_surcharge(price: u32) -> f64 { price as f64 * 1.3 }

fn apply_discount(price: u32, strategy: fn(u32) -> f64) -> f64 {
    strategy(price)
}

fn build_receipt(name: &str, from: &str, to: &str, fare: f64) -> String {
    format!("=== IRCTC RECEIPT ===\nPassenger: {}\nRoute: {} -> {}\nFare: ₹{:.2}\n====================",
        name, from, to, fare)
}

fn can_book_tatkal(hour: u32, has_id: bool) -> bool {
    if hour < 10 || hour > 12 { return false; }
    if !has_id { return false; }
    true
}

const fn count_platforms(main: u32, sub: u32) -> u32 { main + sub }

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. fn params MUST have type annotations — no inference
// 2. Last expression (no ;) is the implicit return value
// 3. Adding ; turns expression into statement (returns ())
// 4. if/else, match, blocks all return values (expressions)
// 5. Use `return` only for early exits
// 6. Functions returning nothing return () (unit type)
// 7. Function pointers: fn(T) -> U — first-class values
// 8. const fn runs at compile time — zero runtime cost
// ============================================================

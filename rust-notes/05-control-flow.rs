// ============================================================
//  FILE 5 : Control Flow
// ============================================================
//  Topic  : if/else, loop, while, for, break with value,
//           continue, labels, nested loops, ranges
// ============================================================

// ============================================================
// STORY: A Mumbai auto-rickshaw ride — if/else is "meter or
// fixed?", loop is the ticking meter, while drives until CNG
// runs out, for visits each stop. break with value = "kitna hua?"
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — if/else (it's an EXPRESSION)
    // ──────────────────────────────────────────────────────────
    // Conditions must be bool — no truthy/falsy like JS.

    let traffic_signal = "red";
    if traffic_signal == "green" {
        println!("Chalo bhaiya!");
    } else if traffic_signal == "yellow" {
        println!("Dhire dhire...");
    } else {
        println!("Ruko, signal hai.");
    }

    // if as expression (like ternary)
    let fare_type = "meter";
    let base_fare = if fare_type == "meter" { 23 } else { 50 };
    println!("Base fare: ₹{}", base_fare);
    // Both branches must return the same type

    // Nested if-else (prefer match for complex logic)
    let hour = 14;
    let shift = if hour < 6 { "Night" }
        else if hour < 12 { "Morning" }
        else if hour < 18 { "Afternoon" }
        else { "Evening" };
    println!("Shift: {}", shift);

    // if let — preview (full coverage in enums file)
    let maybe_tip: Option<u32> = Some(20);
    if let Some(tip) = maybe_tip {
        println!("Tip received: ₹{}", tip);
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — loop (infinite until break)
    // ──────────────────────────────────────────────────────────
    // Unique to Rust: loop can RETURN a value via `break value`.

    let mut distance = 0;
    let final_fare = loop {
        distance += 1;
        if distance >= 10 {
            break distance * 14 + 23; // break WITH value
        }
    };
    println!("Fare for {}km: ₹{}", distance, final_fare);

    // Retry pattern
    let mut attempts = 0;
    let connection = loop {
        attempts += 1;
        if attempts == 3 { break "Connected!"; }
        println!("Attempt {}... retrying", attempts);
    };
    println!("{} (after {} attempts)", connection, attempts);

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — while
    // ──────────────────────────────────────────────────────────

    let mut cng_level = 3;
    while cng_level > 0 {
        println!("CNG: {} bars — driving...", cng_level);
        cng_level -= 1;
    }
    println!("CNG empty! Refuel.");

    // while let — great with Option/iterators
    let mut stops = vec!["Andheri", "Bandra", "Dadar"];
    while let Some(stop) = stops.pop() {
        println!("Crossed: {}", stop);
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — for (most common, iterator-based)
    // ──────────────────────────────────────────────────────────

    // Exclusive range
    for km in 1..4 {
        println!("Km {}: ₹{}", km, km * 14 + 23);
    }

    // Inclusive range
    for stop in 1..=3 { println!("Stop {} of 3", stop); }

    // Iterating with enumerate
    let landmarks = ["Gateway of India", "Marine Drive", "CST Station"];
    for (i, place) in landmarks.iter().enumerate() {
        println!("  {}. {}", i + 1, place);
    }

    // rev, step_by, zip
    print!("Countdown: ");
    for n in (1..=5).rev() { print!("{} ", n); }
    println!("Go!");

    print!("Every 5km: ");
    for km in (0..=20).step_by(5) { print!("{} ", km); }
    println!();

    let stops = ["Andheri", "Bandra", "Dadar"];
    let times = [10, 18, 25];
    for (stop, time) in stops.iter().zip(times.iter()) {
        println!("{}: {} min", stop, time);
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — break & continue
    // ──────────────────────────────────────────────────────────

    let stops = ["Andheri", "CLOSED", "Bandra", "CLOSED", "Dadar"];
    for stop in &stops {
        if *stop == "CLOSED" { continue; }
        println!("Stopping at: {}", stop);
    }

    let route = ["Churchgate", "Marine Lines", "Charni Road", "Mumbai Central"];
    for stop in &route {
        println!("At: {}", stop);
        if *stop == "Charni Road" { println!("Destination!"); break; }
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Loop Labels (nested loop control)
    // ──────────────────────────────────────────────────────────

    'outer: for row in 0..5 {
        for col in 0..5 {
            if row == 2 && col == 3 {
                println!("Found target at ({}, {})", row, col);
                break 'outer;
            }
        }
    }

    // Label with break value
    let mut x = 0;
    let result = 'search: loop {
        x += 1;
        if x * x > 100 { break 'search x; }
    };
    println!("First x where x*x > 100: {}", result);

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Practical Patterns
    // ──────────────────────────────────────────────────────────

    // Find min — manual vs idiomatic
    let fares = [45, 67, 23, 89, 12, 56];
    let cheapest = fares.iter().min().unwrap();
    println!("Cheapest fare: ₹{}", cheapest);

    // Sum — idiomatic
    let distances = [3, 7, 2, 5, 8];
    let total: i32 = distances.iter().sum();
    println!("Total distance: {} km", total);

    // Fare chart (matrix iteration)
    let classes = ["SL", "3AC", "2AC"];
    let dists = [100, 500, 1000];
    for class in &classes {
        print!("{:>4}:", class);
        for &d in &dists {
            let rate: f64 = match *class {
                "SL" => 0.5, "3AC" => 1.5, "2AC" => 2.0, _ => 1.0,
            };
            print!(" ₹{:>6.0}", d as f64 * rate);
        }
        println!();
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Which Loop When?
    // ──────────────────────────────────────────────────────────
    // for ... in  → most common, safest (iterator-based)
    // loop        → infinite/retry/search with break value
    // while       → condition-based
    // while let   → draining Option/iterators
    //
    // for is FASTER than manual indexing: no bounds checks,
    // compiler can vectorize/unroll.

    println!("\n--- Auto-rickshaw ride complete! ---");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. if/else is an EXPRESSION — assign its result to a variable
// 2. Conditions must be bool — no truthy/falsy
// 3. loop + break value is unique to Rust — perfect for retries
// 4. while let drains Option/iterators elegantly
// 5. for ... in is most idiomatic — iterator-based, fast
// 6. 'label: lets you break/continue outer loops
// 7. for is faster than manual indexing (no bounds checks)
// ============================================================

// ============================================================
//  FILE 7 : References & Borrowing
// ============================================================
//  Topic  : &T, &mut T, borrowing rules, dangling references,
//           NLL, dereferencing, iteration modes
// ============================================================

// ============================================================
// STORY: Your Royal Enfield in hostel. Immutable borrow (&T):
// roommates ride it (read) but can't repaint it. Mutable borrow
// (&mut T): only the mechanic has it — no one else touches it.
// The warden (compiler) enforces: many readers OR one writer.
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — Immutable References (&T)
    // ──────────────────────────────────────────────────────────
    // Multiple &T can coexist. No ownership transfer.

    let bullet = String::from("Royal Enfield Classic 350");

    let rider1 = &bullet;
    let rider2 = &bullet;
    println!("Rider 1: {}, Rider 2: {}", rider1, rider2);
    println!("Owner still has: {}", bullet);

    // Pass reference to function — no ownership transfer
    let length = measure_bike(&bullet);
    println!("{} — length: {}", bullet, length);

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — Mutable References (&mut T)
    // ──────────────────────────────────────────────────────────
    // Only ONE &mut T at a time. Prevents data races.

    let mut bike_color = String::from("Black");
    let mechanic = &mut bike_color;
    mechanic.push_str(" with Gold stripes");
    println!("After paint: {}", mechanic);
    // Can't use bike_color while mechanic holds &mut
    println!("Owner sees: {}", bike_color); // OK — mechanic's borrow ended

    let mut mileage = String::from("ODO: 15000");
    update_mileage(&mut mileage, 500);
    println!("{}", mileage);

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — THE TWO RULES
    // ──────────────────────────────────────────────────────────
    // RULE 1: Any number of &T  OR  exactly one &mut T (not both)
    // RULE 2: References must always be valid (no dangling)

    // Multiple &T → OK
    let bike = String::from("Bullet");
    let r1 = &bike;
    let r2 = &bike;
    println!("{}, {}", r1, r2);

    // One &mut T → OK
    let mut bike = String::from("Bullet");
    let m1 = &mut bike;
    m1.push_str(" 500");
    println!("{}", m1);

    // &T and &mut T at same time → ERROR
    // let mut bike = String::from("Bullet");
    // let r1 = &bike;
    // let m1 = &mut bike;  // ERROR
    // println!("{}", r1);

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — Non-Lexical Lifetimes (NLL)
    // ──────────────────────────────────────────────────────────
    // Borrow ends at LAST USE, not end of scope.

    let mut bike = String::from("RE Classic");
    let r1 = &bike;
    let r2 = &bike;
    println!("Readers: {}, {}", r1, r2);
    // r1, r2 done — now we CAN take &mut
    let m1 = &mut bike;
    m1.push_str(" 350");
    println!("Modified: {}", m1);

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — Dangling References
    // ──────────────────────────────────────────────────────────
    // Rust prevents at compile time. Return owned data instead.

    // fn dangle() -> &String { let s = String::from("hi"); &s } // ERROR
    fn no_dangle() -> String { String::from("hello") }
    println!("Safe: {}", no_dangle());

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — References in Structs (preview)
    // ──────────────────────────────────────────────────────────
    // Structs with references need lifetime annotations (File 16).

    struct Bike { model: String, cc: u32 }

    let my_bike = Bike { model: String::from("Classic 350"), cc: 349 };
    display_bike(&my_bike);

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Common Patterns
    // ──────────────────────────────────────────────────────────

    // Read-only access to large data
    let garage = vec![
        String::from("Classic 350"),
        String::from("Meteor 350"),
        String::from("Himalayan 450"),
    ];
    print_garage(&garage);
    println!("Garage still has {} bikes", garage.len());

    // Modify through &mut
    let mut scores = vec![85, 90, 78, 92];
    add_bonus(&mut scores, 5);
    println!("With bonus: {:?}", scores);

    // Reborrowing
    let mut data = vec![1, 2, 3];
    let data_ref = &mut data;
    let sum: i32 = data_ref.iter().sum(); // implicit reborrow as &
    println!("Sum: {}", sum);
    data_ref.push(4);
    println!("Data: {:?}", data_ref);

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Dereferencing (*)
    // ──────────────────────────────────────────────────────────
    // Rust auto-derefs for method calls and ==. Use * explicitly
    // when needed.

    let speed = 80;
    let speed_ref = &speed;
    println!("Speed: {} km/h", *speed_ref);

    let name = String::from("Bullet");
    let name_ref = &name;
    println!("Length: {}", name_ref.len()); // auto-deref

    let mut rpm = 3000;
    let rpm_ref = &mut rpm;
    *rpm_ref += 500;
    println!("RPM: {}", rpm);

    // ──────────────────────────────────────────────────────────
    // SECTION 9 — Borrowing in Iteration
    // ──────────────────────────────────────────────────────────
    // Three modes:
    //   &collection  → immutable borrow (most common)
    //   &mut collection → modify each element
    //   collection (no &) → consumes (move)

    let bikes = vec!["Classic", "Meteor", "Himalayan"];
    for bike in &bikes { print!("{} ", bike); }
    println!();

    let mut prices = vec![100, 200, 300];
    for price in &mut prices { *price += 50; }
    println!("Updated prices: {:?}", prices);

    // ──────────────────────────────────────────────────────────
    // SECTION 10 — Common Borrow Checker Fixes
    // ──────────────────────────────────────────────────────────

    // Fix: separate mutable borrows into distinct scopes
    let mut items = vec![1, 2, 3];
    { let a = &mut items; a.push(4); }
    { let b = &mut items; b.push(5); }
    println!("Items: {:?}", items);

    // Fix: finish immutable borrows before mutable
    let mut data = vec![1, 2, 3];
    let len = data.len(); // immutable borrow finishes immediately
    data.push(4);
    println!("Len was: {}, now: {:?}", len, data);

    println!("\n--- Ride complete! Bike returned safely. ---");
}

// ============================================================
// Function Declarations
// ============================================================

fn measure_bike(bike: &String) -> usize { bike.len() }

fn update_mileage(odo: &mut String, km: u32) {
    odo.push_str(&format!(" (+{} km serviced)", km));
}

struct Bike { model: String, cc: u32 }

fn display_bike(bike: &Bike) {
    println!("Bike: {} ({}cc)", bike.model, bike.cc);
}

fn print_garage(bikes: &Vec<String>) {
    println!("\n--- Garage ---");
    for (i, bike) in bikes.iter().enumerate() {
        println!("  {}. {}", i + 1, bike);
    }
}

fn add_bonus(scores: &mut Vec<i32>, bonus: i32) {
    for score in scores.iter_mut() { *score += bonus; }
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. &T = immutable reference (many allowed)
// 2. &mut T = mutable reference (exactly ONE at a time)
// 3. Can't have &T and &mut T active simultaneously
// 4. References must never outlive the data they point to
// 5. NLL: borrow ends at last use, not end of scope
// 6. * dereferences; Rust auto-derefs for methods and ==
// 7. Iteration: &col (borrow), &mut col (modify), col (consume)
// 8. Fix overlapping borrows by separating into scopes
// ============================================================

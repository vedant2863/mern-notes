// ============================================================
// FILE 16: LIFETIMES — How Rust Tracks Reference Validity
// ============================================================
// Lifetimes ensure every reference is valid for as long as
// it's used. They prevent dangling references at compile time
// with ZERO runtime cost.
// ============================================================

// ============================================================
// STORY: Tatkal Ticket Validity Period
// ============================================================
// A Tatkal ticket is valid ONLY for a specific train journey.
// Similarly, a reference (&T) is valid only as long as the
// data it points to exists. The lifetime annotation 'a is
// like the validity period — it tells the compiler "this
// reference is valid for THIS long."
// ============================================================

use std::fmt;

// ============================================================
// 1. WHY LIFETIMES EXIST
// ============================================================

fn demonstrate_dangling_problem() {
    println!("--- 1. Why Lifetimes Exist ---");

    let result;
    {
        let ticket_number = String::from("TKT-2024-MUM-DEL");
        result = ticket_number.len(); // Copy the length, not a reference
    }
    println!("  Ticket number length: {}", result);

    // This would NOT compile:
    // let reference;
    // { let data = String::from("temporary"); reference = &data; }
    // println!("{}", reference); // data already dropped!
    println!("  (Dangling reference example won't compile — Rust prevents it!)");
}

// ============================================================
// 2. LIFETIME ANNOTATIONS 'a
// ============================================================
// Annotations DESCRIBE relationships, don't change them.
// 'a means the return lives for the SHORTER of both inputs.

fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() { x } else { y }
}

fn demonstrate_lifetime_annotations() {
    println!("\n--- 2. Lifetime Annotations ---");

    let train_a = "Duronto Express";
    let train_b = "Garib Rath";
    println!("  Longer name: {}", longest(train_a, train_b));
}

// ============================================================
// 3. FUNCTION LIFETIMES — Different Patterns
// ============================================================

// Only x's lifetime matters — we never return y
fn first_train<'a>(x: &'a str, _y: &str) -> &'a str { x }

fn demonstrate_function_lifetimes() {
    println!("\n--- 3. Function Lifetimes ---");

    let express = "Chennai Express";
    let local = String::from("Mumbai Local");
    println!("  First train: {}", first_train(express, &local));
}

// ============================================================
// 4. STRUCT LIFETIMES
// ============================================================
// Structs holding references MUST declare lifetimes.

#[derive(Debug)]
struct TatkalTicket<'a> {
    passenger_name: &'a str,
    train_name: &'a str,
    pnr: String,
}

impl<'a> TatkalTicket<'a> {
    fn summary(&self) -> String {
        format!("PNR: {} | {} on {}", self.pnr, self.passenger_name, self.train_name)
    }
}

impl<'a> fmt::Display for TatkalTicket<'a> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {} -> {}", self.pnr, self.passenger_name, self.train_name)
    }
}

fn demonstrate_struct_lifetimes() {
    println!("\n--- 4. Struct Lifetimes ---");

    let passenger = String::from("Rahul Sharma");
    let train = String::from("Rajdhani Express");
    let ticket = TatkalTicket {
        passenger_name: &passenger, train_name: &train,
        pnr: String::from("PNR-8472615"),
    };
    println!("  Ticket: {}", ticket);
    println!("  Summary: {}", ticket.summary());
}

// ============================================================
// 5. LIFETIME ELISION RULES
// ============================================================
// Rust infers lifetimes with 3 rules. You rarely write 'a.
// Rule 1: Each ref param gets its own lifetime.
// Rule 2: One input lifetime -> applied to all outputs.
// Rule 3: &self lifetime -> applied to outputs.

fn demonstrate_elision_rules() {
    println!("\n--- 5. Lifetime Elision Rules ---");

    // No 'a needed — Rule 1+2 cover it
    fn first_word(s: &str) -> &str {
        let bytes = s.as_bytes();
        for (i, &byte) in bytes.iter().enumerate() {
            if byte == b' ' { return &s[..i]; }
        }
        s
    }

    let station = String::from("New Delhi Railway Station");
    println!("  First word: {}", first_word(&station));

    // Rule 3: Methods with &self
    struct TrainSchedule { name: String, departure: String }
    impl TrainSchedule {
        fn get_name(&self) -> &str { &self.name }
        fn info(&self) -> String { format!("{} departs at {}", self.name, self.departure) }
    }

    let schedule = TrainSchedule {
        name: String::from("Shatabdi Express"), departure: String::from("06:00 AM"),
    };
    println!("  Train: {}", schedule.get_name());
    println!("  Info: {}", schedule.info());
}

// ============================================================
// 6. STATIC LIFETIME
// ============================================================
// 'static means data lives for the entire program.
// All string literals are 'static.

fn demonstrate_static_lifetime() {
    println!("\n--- 6. 'static Lifetime ---");

    let station: &'static str = "Chhatrapati Shivaji Maharaj Terminus";
    println!("  Static station: {}", station);

    // T: 'static means T owns all its data (no non-static references)
    fn is_owned_type<T: 'static>(_val: T) {
        println!("  This type owns all its data");
    }
    is_owned_type(String::from("owned"));
    is_owned_type(42i32);
}

// ============================================================
// 7. LIFETIME BOUNDS ON GENERICS
// ============================================================

fn longest_with_announcement<'a, T: fmt::Display>(
    x: &'a str, y: &'a str, announcement: T,
) -> &'a str {
    println!("  Announcement: {}", announcement);
    if x.len() >= y.len() { x } else { y }
}

struct TicketHolder<'a, T: fmt::Display> {
    name: &'a str,
    ticket_type: T,
}

impl<'a, T: fmt::Display> TicketHolder<'a, T> {
    fn display_ticket(&self) -> String {
        format!("Passenger: {} | Ticket: {}", self.name, self.ticket_type)
    }
}

fn demonstrate_lifetime_bounds() {
    println!("\n--- 7. Lifetime Bounds on Generics ---");

    let result = longest_with_announcement("Vande Bharat", "Tejas", "Comparing trains!");
    println!("  Longest: {}", result);

    let name = String::from("Priya Patel");
    let holder = TicketHolder { name: &name, ticket_type: "1AC Tatkal" };
    println!("  {}", holder.display_ticket());
}

// ============================================================
// 8. PRACTICAL PATTERNS
// ============================================================

// Parser that returns slices of the input
struct StationParser<'a> {
    input: &'a str,
    position: usize,
}

impl<'a> StationParser<'a> {
    fn new(input: &'a str) -> Self { StationParser { input, position: 0 } }

    fn next_station(&mut self) -> Option<&'a str> {
        if self.position >= self.input.len() { return None; }
        let remaining = &self.input[self.position..];
        match remaining.find(',') {
            Some(comma_pos) => {
                let station = &self.input[self.position..self.position + comma_pos];
                self.position += comma_pos + 1;
                while self.position < self.input.len()
                    && self.input.as_bytes()[self.position] == b' ' {
                    self.position += 1;
                }
                Some(station.trim())
            }
            None => {
                let station = &self.input[self.position..];
                self.position = self.input.len();
                Some(station.trim())
            }
        }
    }
}

fn demonstrate_practical_patterns() {
    println!("\n--- 8. Practical Patterns ---");

    let route = String::from("Mumbai, Pune, Lonavala, Karjat, Panvel");
    let mut parser = StationParser::new(&route);
    print!("  Stations:");
    while let Some(station) = parser.next_station() { print!(" [{}]", station); }
    println!();
}

// ============================================================
// 9. COMMON MISTAKES AND FIXES
// ============================================================

fn demonstrate_common_mistakes() {
    println!("\n--- 9. Common Mistakes & Fixes ---");

    // Mistake: returning reference to local variable
    // Fix: return owned type
    fn good() -> String { String::from("hello") }
    println!("  Fix 1 (return owned): {}", good());

    println!("  Lifetimes describe relationships; they don't extend data's life.");
    println!("  When in doubt, return owned types instead of references.");
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST LIFETIMES: Tatkal Ticket Validity ===\n");

    demonstrate_dangling_problem();
    demonstrate_lifetime_annotations();
    demonstrate_function_lifetimes();
    demonstrate_struct_lifetimes();
    demonstrate_elision_rules();
    demonstrate_static_lifetime();
    demonstrate_lifetime_bounds();
    demonstrate_practical_patterns();
    demonstrate_common_mistakes();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. Lifetimes prevent dangling references at compile time");
    println!("2. 'a annotations DESCRIBE relationships, don't change them");
    println!("3. Compiler picks the SHORTER lifetime when 'a is shared");
    println!("4. Structs with references need lifetime annotations");
    println!("5. Elision rules cover most cases (you rarely write 'a)");
    println!("6. 'static means data lives for the entire program");
    println!("7. String literals are always 'static");
    println!("8. When in doubt, return owned types instead of references");
}

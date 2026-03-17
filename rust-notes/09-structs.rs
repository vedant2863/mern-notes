// ============================================================
// 09 - STRUCTS IN RUST
// ============================================================
// Structs bundle related data into named types with methods.
// Every real app — web servers, games, databases — models its
// domain using structs. They're the backbone of Rust's type system.
// ============================================================

// ============================================================
// STORY: Booking a train ticket on IRCTC. The reservation form
// has fields (name, age, class, PNR) — each with a specific type.
// You can't submit with missing fields. Once booked, you can
// check status, cancel, upgrade. Struct = the form. Methods =
// the actions you perform on it.
// ============================================================

use std::fmt;

// ============================================================
// 1. BASIC STRUCT
// ============================================================

#[derive(Debug)]
struct Passenger {
    name: String,
    age: u8,
    train_number: u32,
    class: String,
    pnr: String,
}

fn demo_basic_struct() {
    println!("=== 1. Basic Struct ===\n");

    // Every field must be initialized — no partial construction.
    let passenger = Passenger {
        name: String::from("Rajesh Kumar"),
        age: 35,
        train_number: 12301,
        class: String::from("AC-3"),
        pnr: String::from("PNR4829371"),
    };

    println!("Passenger: {}, Train: {}", passenger.name, passenger.train_number);
    println!("Debug: {:?}", passenger);
}

// ============================================================
// 2. MUTABLE STRUCTS & FIELD SHORTHAND
// ============================================================
// Entire binding must be mut — no per-field mutability.

fn demo_mutable_and_shorthand() {
    println!("\n=== 2. Mutable & Shorthand ===\n");

    let name = String::from("Priya Sharma");
    let age = 28;

    // Field init shorthand: `name` instead of `name: name`
    let mut booking = Passenger {
        name, age,
        train_number: 12951,
        class: String::from("Sleeper"),
        pnr: String::from("PNR5567823"),
    };

    println!("Before: {} in {}", booking.name, booking.class);
    booking.class = String::from("AC-2");
    println!("After: {} in {}", booking.name, booking.class);
}

// ============================================================
// 3. STRUCT UPDATE SYNTAX (..)
// ============================================================

#[derive(Debug)]
struct TrainRoute {
    train_number: u32,
    name: String,
    origin: String,
    destination: String,
    distance_km: u32,
    is_superfast: bool,
}

fn demo_update_syntax() {
    println!("\n=== 3. Update Syntax ===\n");

    let rajdhani = TrainRoute {
        train_number: 12301,
        name: String::from("Rajdhani Express"),
        origin: String::from("New Delhi"),
        destination: String::from("Howrah"),
        distance_km: 1447,
        is_superfast: true,
    };

    // ..rajdhani fills remaining fields. Moves String fields!
    let return_train = TrainRoute {
        train_number: 12302,
        origin: String::from("Howrah"),
        destination: String::from("New Delhi"),
        ..rajdhani
    };

    println!("Return: {:?}", return_train);
    // Copy types (u32, bool) still accessible on rajdhani
    println!("Original distance: {}", rajdhani.distance_km);
}

// ============================================================
// 4. IMPL BLOCKS — METHODS & ASSOCIATED FUNCTIONS
// ============================================================

#[derive(Debug)]
struct IrctcBooking {
    passenger_name: String,
    pnr: String,
    fare: f64,
    is_confirmed: bool,
    class: String,
}

impl IrctcBooking {
    // Associated function (constructor) — called with ::
    fn new(name: &str, pnr: &str, fare: f64, class: &str) -> Self {
        Self {
            passenger_name: String::from(name),
            pnr: String::from(pnr),
            fare, is_confirmed: false,
            class: String::from(class),
        }
    }

    fn display_ticket(&self) {
        println!("--- IRCTC E-Ticket ---");
        println!("Passenger: {}, PNR: {}, Class: {}", self.passenger_name, self.pnr, self.class);
        println!("Fare: Rs. {:.2}, Status: {}",
            self.fare, if self.is_confirmed { "Confirmed" } else { "Waiting" });
    }

    fn confirm(&mut self) {
        self.is_confirmed = true;
        println!("{}'s booking confirmed!", self.passenger_name);
    }

    fn total_fare(&self) -> f64 { self.fare * 1.05 } // 5% service tax

    // Takes self by value — consumes the struct
    fn cancel(self) -> String {
        format!("Booking {} cancelled. Refund: Rs. {:.2}", self.pnr, self.fare * 0.75)
    }
}

fn demo_methods() {
    println!("\n=== 4. Methods ===\n");

    let mut booking = IrctcBooking::new("Anita Desai", "PNR9988776", 1850.0, "AC-3");
    booking.display_ticket();
    println!("Total fare: Rs. {:.2}", booking.total_fare());

    booking.confirm();
    let msg = booking.cancel(); // booking consumed here
    println!("{}", msg);
    // booking.display_ticket(); // ERROR: booking moved
}

// ============================================================
// 5. DISPLAY TRAIT — CUSTOM FORMATTING
// ============================================================

struct CoachInfo {
    coach_type: String,
    number: u8,
    total_seats: u16,
    available_seats: u16,
}

impl fmt::Display for CoachInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[Coach {}-{}] Seats: {}/{}",
            self.coach_type, self.number, self.available_seats, self.total_seats)
    }
}

fn demo_display_trait() {
    println!("\n=== 5. Display Trait ===\n");

    let coach = CoachInfo {
        coach_type: String::from("S"), number: 4,
        total_seats: 72, available_seats: 23,
    };
    println!("{}", coach); // uses Display
}

// ============================================================
// 6. TUPLE STRUCTS (type-safe wrappers)
// ============================================================

#[derive(Debug)]
struct Kilometers(f64);

#[derive(Debug)]
struct RupeesPerKm(f64);

impl Kilometers {
    fn fare(&self, rate: &RupeesPerKm) -> f64 { self.0 * rate.0 }
}

fn demo_tuple_structs() {
    println!("\n=== 6. Tuple Structs ===\n");

    let distance = Kilometers(350.0);
    let rate = RupeesPerKm(1.25);

    // Type safety: can't pass Kilometers where RupeesPerKm expected
    println!("Fare: Rs. {:.2}", distance.fare(&rate));
}

// ============================================================
// 7. UNIT STRUCTS (markers, zero-size)
// ============================================================

struct GeneralClass;
struct SleeperClass;

trait ClassInfo {
    fn name(&self) -> &str;
    fn fare_multiplier(&self) -> f64;
}

impl ClassInfo for GeneralClass {
    fn name(&self) -> &str { "General" }
    fn fare_multiplier(&self) -> f64 { 1.0 }
}

impl ClassInfo for SleeperClass {
    fn name(&self) -> &str { "Sleeper" }
    fn fare_multiplier(&self) -> f64 { 2.5 }
}

fn demo_unit_structs() {
    println!("\n=== 7. Unit Structs ===\n");

    let base = 250.0;
    let general = GeneralClass;
    let sleeper = SleeperClass;
    println!("{}: Rs. {:.2}", general.name(), base * general.fare_multiplier());
    println!("{}: Rs. {:.2}", sleeper.name(), base * sleeper.fare_multiplier());
}

// ============================================================
// 8. BUILDER PATTERN
// ============================================================

#[derive(Debug)]
struct Ticket {
    passenger_name: String,
    train_number: u32,
    from: String,
    to: String,
    class: String,
    meal_preference: Option<String>,
    lower_berth: bool,
}

struct TicketBuilder {
    passenger_name: String,
    train_number: u32,
    from: String,
    to: String,
    class: String,
    meal_preference: Option<String>,
    lower_berth: bool,
}

impl TicketBuilder {
    fn new(name: &str, train: u32, from: &str, to: &str) -> Self {
        Self {
            passenger_name: String::from(name),
            train_number: train,
            from: String::from(from),
            to: String::from(to),
            class: String::from("Sleeper"),
            meal_preference: None,
            lower_berth: false,
        }
    }

    // Each setter returns self for chaining
    fn class(mut self, class: &str) -> Self { self.class = String::from(class); self }
    fn meal(mut self, meal: &str) -> Self { self.meal_preference = Some(String::from(meal)); self }
    fn lower_berth(mut self) -> Self { self.lower_berth = true; self }

    fn build(self) -> Ticket {
        Ticket {
            passenger_name: self.passenger_name,
            train_number: self.train_number,
            from: self.from, to: self.to,
            class: self.class,
            meal_preference: self.meal_preference,
            lower_berth: self.lower_berth,
        }
    }
}

fn demo_builder() {
    println!("\n=== 8. Builder Pattern ===\n");

    let ticket = TicketBuilder::new("Vikram Mehta", 12952, "Mumbai", "Delhi")
        .class("AC-2")
        .meal("Veg")
        .lower_berth()
        .build();
    println!("{:#?}", ticket);

    // Minimal — only required fields, defaults for rest
    let basic = TicketBuilder::new("Sita Ram", 14055, "Delhi", "Jaipur").build();
    println!("\nBasic: {:#?}", basic);
}

// ============================================================
// 9. METHODS RETURNING REFERENCES
// ============================================================

#[derive(Debug)]
struct Station {
    code: String,
    full_name: String,
    zone: String,
    platforms: u8,
}

impl Station {
    fn new(code: &str, name: &str, zone: &str, platforms: u8) -> Self {
        Self {
            code: String::from(code), full_name: String::from(name),
            zone: String::from(zone), platforms,
        }
    }

    fn short_info(&self) -> String {
        format!("{} ({}) - {} zone, {} platforms",
            self.full_name, self.code, self.zone, self.platforms)
    }

    fn code(&self) -> &str { &self.code }
    fn is_major(&self) -> bool { self.platforms >= 10 }
}

fn demo_references() {
    println!("\n=== 9. Returning References ===\n");

    let ndls = Station::new("NDLS", "New Delhi", "Northern", 16);
    println!("{}", ndls.short_info());
    println!("Major: {}, Code: {}", ndls.is_major(), ndls.code());
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    demo_basic_struct();
    demo_mutable_and_shorthand();
    demo_update_syntax();
    demo_methods();
    demo_display_trait();
    demo_tuple_structs();
    demo_unit_structs();
    demo_builder();
    demo_references();

    println!("\n=== KEY TAKEAWAYS ===\n");
    println!("1. Structs bundle data — all fields must be initialized.");
    println!("2. impl blocks attach methods (&self, &mut self) and constructors (Self::new).");
    println!("3. Struct update syntax (..) fills remaining fields (moves non-Copy).");
    println!("4. #[derive(Debug)] for {{:?}}. Implement Display for user-facing {{}}.");
    println!("5. Tuple structs wrap types for type safety (Km vs Rs).");
    println!("6. Unit structs = zero-cost type-level markers.");
    println!("7. Builder pattern = fluent API for complex construction.");
    println!("8. cancel(self) consumes the struct — can't use afterward.");
    println!("9. No inheritance in Rust — composition + traits instead.");
}

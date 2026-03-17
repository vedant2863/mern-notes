// ============================================================
// FILE 15: TRAITS — Shared Behavior in Rust
// ============================================================
// Traits define shared behavior — like interfaces in Java.
// They enable polymorphism, operator overloading, and are
// the foundation of Rust's generics system.
// ============================================================

// ============================================================
// STORY: Zomato Restaurant Rating System
// ============================================================
// Every restaurant — South Indian, North Indian, or Mughlai —
// must implement the "Rateable" trait. They all have different
// cuisines, but every one must provide a rating and description.
// A trait says "you MUST have these abilities." The restaurant
// decides HOW; the WHAT is fixed by the trait.
// ============================================================

use std::fmt;
use std::ops::Add;

// ============================================================
// 1. DEFINING A TRAIT
// ============================================================

trait Rateable {
    fn rating(&self) -> f64;
    fn cuisine_type(&self) -> &str;

    // Default methods reduce boilerplate
    fn star_display(&self) -> String {
        let stars = self.rating();
        if stars >= 4.5 { format!("{:.1} - Outstanding!", stars) }
        else if stars >= 4.0 { format!("{:.1} - Very Good", stars) }
        else if stars >= 3.0 { format!("{:.1} - Good", stars) }
        else { format!("{:.1} - Average", stars) }
    }

    fn summary(&self) -> String {
        format!("{} cuisine | Rating: {}", self.cuisine_type(), self.star_display())
    }
}

// ============================================================
// 2. IMPLEMENTING A TRAIT
// ============================================================

struct SouthIndianRestaurant { name: String, dosa_varieties: u32, avg_rating: f64 }
struct NorthIndianDhaba { name: String, is_highway: bool, avg_rating: f64 }

impl Rateable for SouthIndianRestaurant {
    fn rating(&self) -> f64 { self.avg_rating }
    fn cuisine_type(&self) -> &str { "South Indian" }
    fn star_display(&self) -> String {
        format!("{:.1} ({} dosa varieties!)", self.avg_rating, self.dosa_varieties)
    }
}

impl Rateable for NorthIndianDhaba {
    fn rating(&self) -> f64 {
        if self.is_highway { self.avg_rating + 0.2 } else { self.avg_rating }
    }
    fn cuisine_type(&self) -> &str { "North Indian" }
}

// ============================================================
// 3. TRAIT BOUNDS
// ============================================================

fn print_rating<T: Rateable>(item: &T) {
    println!("  Rating: {}", item.star_display());
}

fn is_top_rated(item: &impl Rateable) -> bool {
    item.rating() >= 4.5
}

// ============================================================
// 4. IMPLEMENTING Display (Standard Library Trait)
// ============================================================

impl fmt::Display for SouthIndianRestaurant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} (South Indian, {} dosas)", self.name, self.dosa_varieties)
    }
}

impl fmt::Display for NorthIndianDhaba {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let location = if self.is_highway { "Highway" } else { "City" };
        write!(f, "{} ({} Dhaba)", self.name, location)
    }
}

// ============================================================
// 5. TRAIT OBJECTS — Dynamic Dispatch with dyn
// ============================================================
// dyn Trait gives runtime polymorphism. Slightly slower but
// allows heterogeneous collections.

fn print_all_ratings(restaurants: &[&dyn Rateable]) {
    println!("\n--- All Ratings ---");
    for (i, r) in restaurants.iter().enumerate() {
        println!("  {}. {} | {}", i + 1, r.cuisine_type(), r.star_display());
    }
}

// ============================================================
// 6. DERIVE MACROS
// ============================================================

#[derive(Debug, Clone, PartialEq)]
struct MenuItem { name: String, price: f64, is_veg: bool }

// ============================================================
// 7. OPERATOR OVERLOADING
// ============================================================

#[derive(Debug, Clone, Copy)]
struct Rupees { paise: i64 }

impl Rupees {
    fn new(rupees: i64, paise: i64) -> Self {
        Rupees { paise: rupees * 100 + paise }
    }
}

impl Add for Rupees {
    type Output = Rupees;
    fn add(self, other: Rupees) -> Rupees {
        Rupees { paise: self.paise + other.paise }
    }
}

impl fmt::Display for Rupees {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Rs.{}.{:02}", self.paise / 100, (self.paise % 100).abs())
    }
}

impl PartialEq for Rupees {
    fn eq(&self, other: &Self) -> bool { self.paise == other.paise }
}

// ============================================================
// 8. SUPERTRAITS
// ============================================================
// trait Child: Parent requires Parent to be implemented first.

trait PremiumListed: Rateable + fmt::Display {
    fn membership_tier(&self) -> &str;
    fn premium_badge(&self) -> String {
        format!("[PREMIUM {}] {} | {}", self.membership_tier(), self, self.summary())
    }
}

// ============================================================
// 9. ASSOCIATED TYPES
// ============================================================

trait FoodDelivery {
    type Item;
    fn next_order(&mut self) -> Option<Self::Item>;
}

struct OrderQueue { orders: Vec<String>, index: usize }

impl FoodDelivery for OrderQueue {
    type Item = String;
    fn next_order(&mut self) -> Option<Self::Item> {
        if self.index < self.orders.len() {
            let order = self.orders[self.index].clone();
            self.index += 1;
            Some(order)
        } else { None }
    }
}

// ============================================================
// 10. BLANKET IMPLEMENTATIONS
// ============================================================

trait Describable { fn describe(&self) -> String; }

impl<T: Rateable> Describable for T {
    fn describe(&self) -> String {
        format!("A {} restaurant rated {}", self.cuisine_type(), self.star_display())
    }
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST TRAITS: Zomato Rating System ===\n");

    let saravana = SouthIndianRestaurant {
        name: String::from("Saravana Bhavan"), dosa_varieties: 42, avg_rating: 4.7,
    };
    let pehalwan = NorthIndianDhaba {
        name: String::from("Pehalwan Dhaba"), is_highway: true, avg_rating: 4.1,
    };

    // --- Trait Implementation ---
    println!("--- 1. Trait Implementation ---");
    println!("  {}: {}", saravana.name, saravana.summary());
    println!("  {}: {}", pehalwan.name, pehalwan.summary());

    // --- Trait Bounds ---
    println!("\n--- 2. Trait Bounds ---");
    print!("  Saravana: "); print_rating(&saravana);
    println!("  Is Saravana top-rated? {}", is_top_rated(&saravana));

    // --- Trait Objects ---
    println!("\n--- 3. Trait Objects (dyn) ---");
    let restaurants: Vec<&dyn Rateable> = vec![&saravana, &pehalwan];
    print_all_ratings(&restaurants);

    // --- Derive Macros ---
    println!("\n--- 4. Derive Macros ---");
    let item = MenuItem { name: String::from("Butter Chicken"), price: 350.0, is_veg: false };
    let copy = item.clone();
    println!("  Debug: {:?}", item);
    println!("  Equal? {}", item == copy);

    // --- Operator Overloading ---
    println!("\n--- 5. Operator Overloading ---");
    let dosa_price = Rupees::new(120, 50);
    let coffee_price = Rupees::new(45, 0);
    let total = dosa_price + coffee_price;
    println!("  {} + {} = {}", dosa_price, coffee_price, total);
    println!("  Equal? {}", dosa_price == Rupees::new(120, 50));

    // --- Associated Types ---
    println!("\n--- 6. Associated Types ---");
    let mut queue = OrderQueue {
        orders: vec![String::from("Masala Dosa"), String::from("Biryani")],
        index: 0,
    };
    while let Some(order) = queue.next_order() {
        println!("  Delivering: {}", order);
    }

    // --- Blanket Implementations ---
    println!("\n--- 7. Blanket Implementations ---");
    println!("  {}", saravana.describe());
    println!("  {}", pehalwan.describe());

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. Traits define shared behavior (like interfaces)");
    println!("2. impl Trait for Type fulfills the contract");
    println!("3. Default methods reduce boilerplate");
    println!("4. Trait bounds restrict generics: fn foo<T: Trait>(x: T)");
    println!("5. dyn Trait enables dynamic dispatch (runtime polymorphism)");
    println!("6. #[derive(Debug, Clone, PartialEq)] auto-implements common traits");
    println!("7. Operator overloading = implementing std::ops traits");
    println!("8. Supertraits: trait Child: Parent requires Parent first");
    println!("9. Associated types fix the generic per implementation");
    println!("10. Blanket impls: impl<T: X> Y for T gives Y to all X implementors");
}

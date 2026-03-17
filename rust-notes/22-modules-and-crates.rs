// ============================================================
// 22. MODULES AND CRATES IN RUST
// ============================================================
// Modules organize code into namespaces with access control.
// Crates are compilation units — libraries or binaries.
// ============================================================

// ============================================================
// STORY: THE TATA GROUP COMPANY STRUCTURE
// ============================================================
// Tata Sons (parent) = top-level CRATE/MODULE
// TCS, Tata Motors = PUBLIC subsidiaries (pub mod)
// Tata Strategic Group = PRIVATE subsidiary (mod)
// Each subsidiary has departments = nested modules
// Public quarterly results = pub fn
// Internal salary data = private fn
// Tata Motors selling Jaguar = re-export (pub use)
// ============================================================

// ============================================================
// SECTION 1: THE mod KEYWORD — DEFINING MODULES
// ============================================================
// Everything inside a module is PRIVATE by default.

mod tata_sons {
    fn internal_strategy() -> String {
        String::from("Expand into semiconductors by 2027")
    }

    pub fn public_announcement() -> String {
        let _strategy = internal_strategy();
        String::from("Tata Group reports strong Q3 results!")
    }

    pub mod tcs {
        pub fn revenue() -> u64 { 250_000_000_000 }
        fn employee_salary_data() -> String { String::from("Confidential") }
        pub fn employee_count() -> u64 { 600_000 }

        pub mod cloud_division {
            pub fn services() -> Vec<String> {
                vec![String::from("AWS Migration"), String::from("Azure Consulting")]
            }
        }
    }

    pub mod tata_motors {
        pub fn models() -> Vec<String> {
            vec![String::from("Nexon"), String::from("Harrier"), String::from("Safari")]
        }

        fn production_cost(model: &str) -> u32 {
            match model { "Nexon" => 600_000, "Harrier" => 1_200_000, _ => 800_000 }
        }

        pub fn showroom_price(model: &str) -> u32 {
            (production_cost(model) as f64 * 1.3) as u32
        }

        pub mod ev_division {
            pub fn upcoming_models() -> Vec<String> {
                vec![String::from("Curvv EV"), String::from("Nexon EV Max")]
            }
        }
    }
}

// ============================================================
// SECTION 2: pub KEYWORD — CONTROLLING VISIBILITY
// ============================================================
// Private by default. pub exposes items. Struct fields have
// independent visibility from the struct itself.

mod visibility_demo {
    pub struct PublicReport {
        pub title: String,
        pub summary: String,
        confidential_notes: String, // private field
    }

    impl PublicReport {
        // Constructor required since confidential_notes is private
        pub fn new(title: String, summary: String, notes: String) -> Self {
            PublicReport { title, summary, confidential_notes: notes }
        }

        pub fn safe_notes(&self) -> String {
            format!("[REDACTED] {} chars of notes", self.confidential_notes.len())
        }
    }

    pub enum Department { Engineering, Marketing, Finance, HR }
}

// ============================================================
// SECTION 3: use KEYWORD — BRINGING ITEMS INTO SCOPE
// ============================================================

use tata_sons::tcs;
use tata_sons::tata_motors::models;
use tata_sons::tata_motors::ev_division::upcoming_models as ev_models;
use tata_sons::tata_motors::{showroom_price, ev_division};

// ============================================================
// SECTION 4: self, super, AND crate PATHS
// ============================================================
// self = current module, super = parent, crate = crate root

mod indian_railway {
    pub mod booking {
        pub fn book_ticket(train: &str) -> String {
            format!("Ticket booked on {}", train)
        }
        pub fn check_pnr(pnr: u64) -> String {
            format!("PNR {} status: Confirmed", pnr)
        }
    }

    pub mod cancellation {
        pub fn cancel_ticket(pnr: u64) -> String {
            let _status = super::booking::check_pnr(pnr);
            format!("Ticket with PNR {} cancelled. Refund initiated.", pnr)
        }
    }

    pub mod admin {
        pub fn system_check() -> String {
            let _motors = crate::tata_sons::tata_motors::models();
            String::from("System check: All modules operational")
        }
    }
}

// ============================================================
// SECTION 5: pub(crate) AND RESTRICTED VISIBILITY
// ============================================================
// pub(crate) = visible within crate only
// pub(super) = visible to parent module only

mod payment_system {
    pub(crate) fn process_payment(amount: u64) -> String {
        format!("Processing payment of Rs. {}", amount)
    }

    pub mod upi {
        pub(super) fn validate_upi_id(id: &str) -> bool { id.contains('@') }

        pub fn pay(upi_id: &str, amount: u64) -> String {
            if validate_upi_id(upi_id) {
                super::process_payment(amount)
            } else {
                String::from("Invalid UPI ID")
            }
        }
    }

    pub fn test_upi_validation() -> bool {
        upi::validate_upi_id("user@paytm")
    }
}

// ============================================================
// SECTION 6: RE-EXPORTING WITH pub use
// ============================================================
// Present a clean API regardless of internal structure.

mod ecommerce_platform {
    mod internal {
        pub mod database {
            pub fn connect() -> String { String::from("Connected to PostgreSQL") }
        }
        pub mod cache {
            pub fn get(key: &str) -> Option<String> {
                if key == "popular_item" { Some(String::from("iPhone 15")) } else { None }
            }
        }
    }

    pub use internal::database::connect;
    pub use internal::cache::get as cache_get;
}

// ============================================================
// SECTION 7-9: PROJECT STRUCTURE (Reference)
// ============================================================
// Cargo.toml defines project metadata, dependencies, build config.
//
// src/main.rs  -> Binary crate (has fn main)
// src/lib.rs   -> Library crate (reusable, no main)
// A package can have both.
//
// Module file styles:
//   OLD: src/models/mod.rs (every file named mod.rs)
//   NEW: src/models.rs + src/models/ folder (recommended)
//
// Workspaces manage multiple crates in one repo:
//   [workspace]
//   members = ["crate-a", "crate-b"]
//   Benefits: shared target/, shared Cargo.lock, one cargo build

// ============================================================
// SECTION 10: PRACTICAL EXAMPLE — Online Store
// ============================================================

mod online_store {
    pub mod models {
        #[derive(Debug)]
        pub struct Product {
            pub name: String,
            pub price: f64,
            sku: String,
        }

        impl Product {
            pub fn new(name: &str, price: f64, sku: &str) -> Self {
                Product { name: name.to_string(), price, sku: sku.to_string() }
            }
            pub fn sku(&self) -> &str { &self.sku }
        }

        #[derive(Debug)]
        pub struct Order {
            pub id: u64,
            pub products: Vec<Product>,
            pub customer_name: String,
        }

        impl Order {
            pub fn total(&self) -> f64 { self.products.iter().map(|p| p.price).sum() }
        }
    }

    pub mod cart {
        use super::models::Product;

        pub struct ShoppingCart { items: Vec<Product> }

        impl ShoppingCart {
            pub fn new() -> Self { ShoppingCart { items: Vec::new() } }
            pub fn add(&mut self, product: Product) { self.items.push(product); }
            pub fn item_count(&self) -> usize { self.items.len() }
            pub fn total(&self) -> f64 { self.items.iter().map(|p| p.price).sum() }
            pub fn checkout(self) -> Vec<Product> { self.items }
        }
    }

    mod payment {
        pub fn process(amount: f64) -> Result<String, String> {
            if amount > 0.0 { Ok(format!("Payment of Rs. {:.2} processed", amount)) }
            else { Err(String::from("Invalid payment amount")) }
        }
    }

    pub use models::{Product, Order};
    pub use cart::ShoppingCart;

    pub fn place_order(cart: ShoppingCart, customer: &str) -> Result<Order, String> {
        let total = cart.total();
        let products = cart.checkout();
        payment::process(total)?;
        Ok(Order { id: 1001, products, customer_name: customer.to_string() })
    }
}

fn main() {
    println!("=== Rust Modules and Crates ===\n");

    println!("--- 1. Basic Module Access ---");
    println!("{}", tata_sons::public_announcement());

    println!("\n--- 2. Nested Module Access ---");
    println!("TCS Revenue: Rs. {}", tcs::revenue());
    println!("TCS Cloud: {:?}", tcs::cloud_division::services());

    println!("\n--- 3. Using `use` Imports ---");
    println!("Tata Motors: {:?}", models());
    println!("EVs: {:?}", ev_models());
    println!("Nexon Price: Rs. {}", showroom_price("Nexon"));

    println!("\n--- 4. Path Navigation ---");
    println!("{}", indian_railway::booking::book_ticket("Shatabdi Express"));
    println!("{}", indian_railway::cancellation::cancel_ticket(4521367890));
    println!("{}", indian_railway::admin::system_check());

    println!("\n--- 5. Restricted Visibility ---");
    println!("{}", payment_system::process_payment(5000));
    println!("{}", payment_system::upi::pay("user@paytm", 1500));
    println!("{}", payment_system::upi::pay("invalid_id", 1500));

    println!("\n--- 6. Re-exports ---");
    println!("{}", ecommerce_platform::connect());
    println!("Cached: {:?}", ecommerce_platform::cache_get("popular_item"));

    println!("\n--- 7. Struct Visibility ---");
    let report = visibility_demo::PublicReport::new(
        String::from("Q3 Results"), String::from("Revenue up 15%"),
        String::from("CEO considering acquisition of startup XYZ"),
    );
    println!("Report: {} - {}", report.title, report.summary);
    println!("{}", report.safe_notes());

    println!("\n--- 8. Online Store (Full Example) ---");
    let mut cart = online_store::ShoppingCart::new();
    cart.add(online_store::Product::new("Laptop", 75000.0, "LAP-001"));
    cart.add(online_store::Product::new("Mouse", 1500.0, "MOU-001"));
    println!("Cart: {} items, Rs. {:.2}", cart.item_count(), cart.total());

    match online_store::place_order(cart, "Rahul Sharma") {
        Ok(order) => {
            println!("Order #{} for {} — Rs. {:.2}", order.id, order.customer_name, order.total());
            for p in &order.products {
                println!("  - {} (Rs. {:.2}) [SKU: {}]", p.name, p.price, p.sku());
            }
        }
        Err(e) => println!("Order failed: {}", e),
    }
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. mod groups code into namespaces. Everything is PRIVATE by
//    default — use pub to expose items.
// 2. use brings items into scope. Rename with as, group with {}.
// 3. self (current), super (parent), crate (root) for navigation.
// 4. pub(crate) = this crate only, pub(super) = parent only.
// 5. pub use re-exports give users a clean, flat API.
// 6. lib.rs = library, main.rs = binary. A package can have both.
// 7. Modern file style: models.rs + models/ folder (not mod.rs).
// 8. Workspaces share builds and lock files across crates.
// ============================================================

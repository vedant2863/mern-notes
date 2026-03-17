// ============================================================
// 10 - ENUMS AND PATTERN MATCHING IN RUST
// ============================================================
// Enums carry data per variant (tagged unions, but safe). Combined
// with match, they model complex states and force exhaustive
// handling. Option and Result (both enums) replace null/exceptions.
// ============================================================

// ============================================================
// STORY: You order biryani on Swiggy. Each state carries different
// data: Placed has order ID, OutForDelivery has driver name/phone,
// Delivered has timestamp. match forces you to handle EVERY state.
// Add "Cancelled"? Every match must update — compiler enforces it.
// ============================================================

// ============================================================
// 1. BASIC ENUMS (C-STYLE)
// ============================================================

#[derive(Debug, PartialEq)]
enum TrainClass {
    General, Sleeper, AcThree, AcTwo, AcFirst,
}

impl TrainClass {
    fn fare_multiplier(&self) -> f64 {
        match self {
            TrainClass::General => 1.0, TrainClass::Sleeper => 2.5,
            TrainClass::AcThree => 4.0, TrainClass::AcTwo => 6.0,
            TrainClass::AcFirst => 8.5,
        }
    }
}

fn demo_basic_enum() {
    println!("=== 1. Basic Enums ===\n");

    let my_class = TrainClass::AcThree;
    println!("Class: {:?}, Fare: Rs. {:.2}", my_class, 200.0 * my_class.fare_multiplier());

    if my_class == TrainClass::AcThree {
        println!("AC Three Tier — blanket provided!");
    }
}

// ============================================================
// 2. ENUMS WITH DATA (Rust's superpower)
// ============================================================
// Each variant holds different types/amounts of data.

#[derive(Debug)]
enum SwiggyStatus {
    Placed { order_id: String, items: Vec<String> },
    Confirmed { restaurant: String, eta_minutes: u32 },
    OutForDelivery { partner_name: String, partner_phone: String, eta_minutes: u32 },
    Delivered { delivered_at: String },
    Cancelled { reason: String, refund: f64 },
}

fn describe_order(status: &SwiggyStatus) {
    // match is exhaustive — remove an arm and it won't compile
    match status {
        SwiggyStatus::Placed { order_id, items } =>
            println!("Order {} placed: {:?}", order_id, items),
        SwiggyStatus::Confirmed { restaurant, eta_minutes } =>
            println!("Confirmed by {}. ~{} min.", restaurant, eta_minutes),
        SwiggyStatus::OutForDelivery { partner_name, eta_minutes, .. } =>
            println!("{} on the way! ETA: {} min.", partner_name, eta_minutes),
        SwiggyStatus::Delivered { delivered_at } =>
            println!("Delivered at {}. Rate your experience!", delivered_at),
        SwiggyStatus::Cancelled { reason, refund } =>
            println!("Cancelled: {}. Refund: Rs. {:.2}", reason, refund),
    }
}

fn demo_enum_with_data() {
    println!("\n=== 2. Enums with Data ===\n");

    let statuses = vec![
        SwiggyStatus::Placed {
            order_id: String::from("SW-29381"),
            items: vec![String::from("Biryani"), String::from("Raita")],
        },
        SwiggyStatus::OutForDelivery {
            partner_name: String::from("Ramesh"),
            partner_phone: String::from("98765-43210"),
            eta_minutes: 8,
        },
        SwiggyStatus::Delivered { delivered_at: String::from("7:45 PM") },
    ];

    for s in &statuses { describe_order(s); }
}

// ============================================================
// 3. OPTION<T> — Rust's null replacement
// ============================================================
// enum Option<T> { Some(T), None }

fn find_train(code: &str) -> Option<String> {
    match code {
        "12301" => Some(String::from("Rajdhani Express")),
        "12951" => Some(String::from("Mumbai Rajdhani")),
        _ => None,
    }
}

fn demo_option() {
    println!("\n=== 3. Option<T> ===\n");

    // match — explicit handling
    match find_train("12301") {
        Some(name) => println!("Found: {}", name),
        None => println!("Not found"),
    }

    // unwrap_or, map, is_some
    let name = find_train("99999").unwrap_or(String::from("Unknown"));
    println!("Train: {}", name);

    let upper = find_train("12301").map(|n| n.to_uppercase());
    println!("Uppercase: {:?}", upper);

    println!("12301 exists: {}", find_train("12301").is_some());
}

// ============================================================
// 4. MATCH PATTERNS (guards, ranges, tuples, wildcards)
// ============================================================

#[derive(Debug)]
enum UpiStatus {
    Success(f64),
    Pending,
    Failed(String),
}

fn demo_match_patterns() {
    println!("\n=== 4. Match Patterns ===\n");

    let payments = vec![
        UpiStatus::Success(499.0),
        UpiStatus::Pending,
        UpiStatus::Failed(String::from("Insufficient balance")),
        UpiStatus::Success(1200.0),
    ];

    for payment in &payments {
        let msg = match payment {
            UpiStatus::Success(amt) if *amt > 1000.0 =>
                format!("Large payment Rs. {:.2}!", amt),
            UpiStatus::Success(amt) =>
                format!("Payment Rs. {:.2} done.", amt),
            UpiStatus::Pending => String::from("Pending..."),
            UpiStatus::Failed(reason) => format!("Failed: {}", reason),
        };
        println!("{}", msg);
    }

    // Ranges and wildcards
    let platform = 5;
    let zone = match platform {
        1..=3 => "Zone A", 4..=7 => "Zone B", 8..=12 => "Zone C", _ => "Unknown",
    };
    println!("Platform {} → {}", platform, zone);

    // Tuple matching
    let (age, has_concession) = (65, true);
    let ticket = match (age, has_concession) {
        (0..=4, _) => "Free",
        (5..=11, _) => "Half fare",
        (_, true) => "Concession",
        _ => "Regular",
    };
    println!("Ticket: {}", ticket);
}

// ============================================================
// 5. IF LET & WHILE LET
// ============================================================

fn demo_if_let_while_let() {
    println!("\n=== 5. if let & while let ===\n");

    // if let — when you only care about one variant
    let order = SwiggyStatus::OutForDelivery {
        partner_name: String::from("Suresh"),
        partner_phone: String::from("91234-56789"),
        eta_minutes: 5,
    };

    if let SwiggyStatus::OutForDelivery { partner_name, eta_minutes, .. } = &order {
        println!("{} arriving in {} min!", partner_name, eta_minutes);
    }

    // while let — loop until pattern fails
    let mut queue: Vec<String> = vec![
        String::from("Dosa"), String::from("Idli"), String::from("Chai"),
    ];

    println!("Processing:");
    while let Some(item) = queue.pop() {
        println!("  Serving: {}", item);
    }
}

// ============================================================
// 6. ENUM METHODS
// ============================================================

#[derive(Debug)]
enum Meal {
    Veg { name: String, price: f64 },
    NonVeg { name: String, price: f64 },
    Combo { items: Vec<String>, price: f64, discount: f64 },
}

impl Meal {
    fn new_veg(name: &str, price: f64) -> Self {
        Meal::Veg { name: String::from(name), price }
    }

    fn final_price(&self) -> f64 {
        match self {
            Meal::Veg { price, .. } | Meal::NonVeg { price, .. } => *price,
            Meal::Combo { price, discount, .. } => price * (1.0 - discount / 100.0),
        }
    }

    fn description(&self) -> String {
        match self {
            Meal::Veg { name, price } => format!("[VEG] {} - Rs. {:.2}", name, price),
            Meal::NonVeg { name, price } => format!("[NON-VEG] {} - Rs. {:.2}", name, price),
            Meal::Combo { items, price, discount } =>
                format!("[COMBO] {:?} - Rs. {:.2} ({}% off)", items, price, discount),
        }
    }

    fn is_veg(&self) -> bool { matches!(self, Meal::Veg { .. }) }
}

fn demo_enum_methods() {
    println!("\n=== 6. Enum Methods ===\n");

    let menu = vec![
        Meal::new_veg("Paneer Butter Masala", 220.0),
        Meal::NonVeg { name: String::from("Chicken Biryani"), price: 280.0 },
        Meal::Combo {
            items: vec![String::from("Dal"), String::from("Rice"), String::from("Roti")],
            price: 350.0, discount: 15.0,
        },
    ];

    for meal in &menu {
        println!("{} → Rs. {:.2} (veg: {})", meal.description(), meal.final_price(), meal.is_veg());
    }
}

// ============================================================
// 7. NESTED ENUMS & STATE MACHINE
// ============================================================

#[derive(Debug)]
enum PaymentMethod {
    Upi(String),
    Card { last_four: String, bank: String },
    Cod,
}

#[derive(Debug)]
enum OrderState {
    Cart,
    Checkout { payment: PaymentMethod },
    Shipped { tracking_id: String, carrier: String },
    Delivered,
}

#[derive(Debug)]
struct Order {
    id: String,
    item: String,
    state: OrderState,
}

impl Order {
    fn new(id: &str, item: &str) -> Self {
        Self { id: String::from(id), item: String::from(item), state: OrderState::Cart }
    }

    fn checkout(mut self, payment: PaymentMethod) -> Self {
        self.state = OrderState::Checkout { payment };
        self
    }

    fn ship(mut self, tracking: &str, carrier: &str) -> Self {
        self.state = OrderState::Shipped {
            tracking_id: String::from(tracking), carrier: String::from(carrier),
        };
        self
    }

    fn deliver(mut self) -> Self { self.state = OrderState::Delivered; self }

    fn status(&self) -> String {
        match &self.state {
            OrderState::Cart => format!("{} in cart", self.item),
            OrderState::Checkout { payment } => {
                let method = match payment {
                    PaymentMethod::Upi(id) => format!("UPI ({})", id),
                    PaymentMethod::Card { last_four, bank } => format!("{} ***{}", bank, last_four),
                    PaymentMethod::Cod => String::from("COD"),
                };
                format!("Checkout: {} via {}", self.item, method)
            }
            OrderState::Shipped { tracking_id, carrier } =>
                format!("{} shipped via {} ({})", self.item, carrier, tracking_id),
            OrderState::Delivered => format!("{} delivered!", self.item),
        }
    }
}

fn demo_state_machine() {
    println!("\n=== 7. State Machine ===\n");

    let order = Order::new("FK-92817", "OnePlus Nord")
        .checkout(PaymentMethod::Upi(String::from("rahul@okicici")))
        .ship("DL-29381-X", "Delhivery")
        .deliver();

    println!("Final: {}", order.status());
}

// ============================================================
// 8. matches! MACRO
// ============================================================

fn demo_matches_macro() {
    println!("\n=== 8. matches! Macro ===\n");

    let classes = vec![
        TrainClass::General, TrainClass::Sleeper,
        TrainClass::AcThree, TrainClass::AcTwo, TrainClass::AcFirst,
    ];

    let ac: Vec<&TrainClass> = classes.iter()
        .filter(|c| matches!(c, TrainClass::AcThree | TrainClass::AcTwo | TrainClass::AcFirst))
        .collect();
    println!("AC classes: {:?}", ac);

    let big = matches!(UpiStatus::Success(2000.0), UpiStatus::Success(x) if x > 1000.0);
    println!("Big success: {}", big);
}

// ============================================================
// 9. PRACTICAL: Food Order System
// ============================================================

#[derive(Debug)]
enum FoodItem {
    MainCourse(String, f64),
    Starter(String, f64),
    Beverage(String, f64),
    Dessert(String, f64),
}

impl FoodItem {
    fn price(&self) -> f64 {
        match self {
            FoodItem::MainCourse(_, p) | FoodItem::Starter(_, p)
            | FoodItem::Beverage(_, p) | FoodItem::Dessert(_, p) => *p,
        }
    }
    fn name(&self) -> &str {
        match self {
            FoodItem::MainCourse(n, _) | FoodItem::Starter(n, _)
            | FoodItem::Beverage(n, _) | FoodItem::Dessert(n, _) => n,
        }
    }
    fn category(&self) -> &str {
        match self {
            FoodItem::MainCourse(..) => "Main", FoodItem::Starter(..) => "Starter",
            FoodItem::Beverage(..) => "Drink", FoodItem::Dessert(..) => "Dessert",
        }
    }
}

fn demo_food_order() {
    println!("\n=== 9. Food Order System ===\n");

    let order = vec![
        FoodItem::Starter(String::from("Paneer Tikka"), 180.0),
        FoodItem::MainCourse(String::from("Dal Makhani"), 220.0),
        FoodItem::Beverage(String::from("Masala Chai"), 40.0),
        FoodItem::Dessert(String::from("Gulab Jamun"), 90.0),
    ];

    let mut total = 0.0;
    for item in &order {
        println!("  [{}] {} - Rs. {:.2}", item.category(), item.name(), item.price());
        total += item.price();
    }

    let gst = total * 0.05;
    println!("Subtotal: Rs. {:.2}, GST: Rs. {:.2}, Total: Rs. {:.2}", total, gst, total + gst);

    let drinks = order.iter().filter(|i| matches!(i, FoodItem::Beverage(..))).count();
    println!("Beverages ordered: {}", drinks);
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    demo_basic_enum();
    demo_enum_with_data();
    demo_option();
    demo_match_patterns();
    demo_if_let_while_let();
    demo_enum_methods();
    demo_state_machine();
    demo_matches_macro();
    demo_food_order();

    println!("\n=== KEY TAKEAWAYS ===\n");
    println!("1. Rust enums carry data — each variant holds different types.");
    println!("2. match is exhaustive — compiler forces handling ALL variants.");
    println!("3. Option<T> replaces null: Some(value) or None, always checked.");
    println!("4. if let = shorthand for one variant. while let = loop until None.");
    println!("5. Enums have methods via impl, just like structs.");
    println!("6. matches!() macro returns bool for quick pattern checks.");
    println!("7. Nested enums model complex state machines safely.");
    println!("8. Guards (if x > 10), ranges (1..=5), wildcards (_) in patterns.");
    println!("9. Enums + match = the heart of idiomatic Rust.");
}

// ============================================================
// 14 - GENERICS IN RUST
// ============================================================
// Generics let you write ONE function/struct/enum that works
// with MANY types. Rust generics are "zero cost" — the compiler
// generates specialized code for each type (monomorphization).
// Vec<T>, Option<T>, Result<T,E> — all generic!
// ============================================================

// ============================================================
// STORY: The Chai Tapri Menu Template
// ============================================================
// The tapri owner has a template: "_______ Chai — Rs. ___"
// He fills in blanks for Masala, Ginger, Cutting chai. The
// TEMPLATE is the same, the CONTENT changes. That's generics.
// Type parameters (T) are the blanks. Type bounds (T: Display)
// say what "fits." The compiler generates optimized code for
// each type — monomorphization: zero runtime cost.
// ============================================================

use std::fmt;

// ============================================================
// 1. GENERIC FUNCTIONS
// ============================================================

fn find_largest<T: PartialOrd + fmt::Display>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in &list[1..] {
        if item > largest { largest = item; }
    }
    largest
}

fn demo_generic_functions() {
    println!("=== 1. Generic Functions ===\n");

    let numbers = vec![34, 50, 25, 100, 65];
    println!("Largest number: {}", find_largest(&numbers));

    let decimals = vec![2.5, 7.8, 1.2, 9.3, 4.5];
    println!("Largest decimal: {}", find_largest(&decimals));

    let words = vec!["Masala", "Ginger", "Cutting", "Tandoori"];
    println!("Largest word: {}", find_largest(&words));
}

// ============================================================
// 2. GENERIC STRUCTS
// ============================================================

#[derive(Debug)]
struct MenuItem<T> {
    name: String,
    price: f64,
    extra_info: T,
}

impl<T: fmt::Debug> MenuItem<T> {
    fn new(name: &str, price: f64, extra_info: T) -> Self {
        Self { name: String::from(name), price, extra_info }
    }

    fn display(&self) {
        println!("  {} - Rs. {:.2} (info: {:?})", self.name, self.price, self.extra_info);
    }
}

// Methods only for specific type combination
#[derive(Debug)]
struct Pair<T, U> { first: T, second: U }

impl Pair<String, f64> {
    fn as_price_tag(&self) -> String {
        format!("{}: Rs. {:.2}", self.first, self.second)
    }
}

fn demo_generic_structs() {
    println!("\n=== 2. Generic Structs ===\n");

    let chai = MenuItem::new("Masala Chai", 15.0, "Contains ginger and cardamom");
    let samosa = MenuItem::new("Samosa", 12.0, 250_u32);
    chai.display();
    samosa.display();

    let labeled = Pair { first: String::from("Chai"), second: 15.0 };
    println!("  Price tag: {}", labeled.as_price_tag());
}

// ============================================================
// 3. GENERIC ENUMS
// ============================================================

#[derive(Debug)]
enum OrderStatus<T> {
    Pending,
    Processing(String),
    Completed(T),
    Failed(String),
}

impl<T: fmt::Debug> OrderStatus<T> {
    fn describe(&self) -> String {
        match self {
            OrderStatus::Pending => String::from("Order is pending"),
            OrderStatus::Processing(msg) => format!("Processing: {}", msg),
            OrderStatus::Completed(result) => format!("Completed with: {:?}", result),
            OrderStatus::Failed(err) => format!("Failed: {}", err),
        }
    }
}

fn demo_generic_enums() {
    println!("\n=== 3. Generic Enums ===\n");

    let food: OrderStatus<String> = OrderStatus::Completed(String::from("Delivered to table 5"));
    let online: OrderStatus<u32> = OrderStatus::Completed(98765);
    println!("{}", food.describe());
    println!("{}", online.describe());
}

// ============================================================
// 4. TYPE CONSTRAINTS (BOUNDS)
// ============================================================

fn clamp<T: PartialOrd>(value: T, min: T, max: T) -> T {
    if value < min { min }
    else if value > max { max }
    else { value }
}

fn print_if_positive<T: PartialOrd + Default + fmt::Display>(value: T) {
    if value > T::default() {
        println!("  Positive: {}", value);
    } else {
        println!("  Not positive: {}", value);
    }
}

fn demo_type_constraints() {
    println!("\n=== 4. Type Constraints ===\n");

    println!("Clamp 15 to [0, 10]: {}", clamp(15, 0, 10));
    println!("Clamp 3.5 to [1.0, 5.0]: {}", clamp(3.5, 1.0, 5.0));

    print_if_positive(42);
    print_if_positive(-5);
}

// ============================================================
// 5. WHERE CLAUSE
// ============================================================
// Cleaner syntax for complex bounds.

fn summarize<T, U>(items: &[T], transform: U) -> String
where
    T: fmt::Display,
    U: Fn(&T) -> String,
{
    items.iter().map(|item| transform(item))
        .collect::<Vec<String>>().join(", ")
}

fn merge_and_sort<T>(mut a: Vec<T>, mut b: Vec<T>) -> Vec<T>
where T: Ord + fmt::Debug,
{
    a.append(&mut b);
    a.sort();
    a
}

fn demo_where_clause() {
    println!("\n=== 5. Where Clause ===\n");

    let prices = vec![99.0_f64, 199.0, 499.0, 79.0];
    println!("Prices: {}", summarize(&prices, |p| format!("Rs. {:.2}", p)));

    let merged = merge_and_sort(vec![5, 3, 8], vec![1, 9, 4]);
    println!("Merged: {:?}", merged);
}

// ============================================================
// 6. MONOMORPHIZATION — ZERO-COST ABSTRACTION
// ============================================================

fn add_values<T: std::ops::Add<Output = T>>(a: T, b: T) -> T { a + b }

fn demo_monomorphization() {
    println!("\n=== 6. Monomorphization ===\n");

    // Compiler generates: add_values_i32, add_values_f64, etc.
    println!("i32: {} + {} = {}", 10, 20, add_values(10, 20));
    println!("f64: {} + {} = {}", 3.14, 2.86, add_values(3.14, 2.86));
    println!("Zero runtime cost — no vtable, no boxing, no indirection.");
}

// ============================================================
// 7. IMPL ON GENERIC TYPES
// ============================================================

#[derive(Debug)]
struct Inventory<T> {
    items: Vec<T>,
    name: String,
}

impl<T> Inventory<T> {
    fn new(name: &str) -> Self {
        Self { items: Vec::new(), name: String::from(name) }
    }
    fn add(&mut self, item: T) { self.items.push(item); }
    fn count(&self) -> usize { self.items.len() }
}

// Methods only when T: Display
impl<T: fmt::Display> Inventory<T> {
    fn display_all(&self) {
        println!("  {} ({} items):", self.name, self.count());
        for (i, item) in self.items.iter().enumerate() {
            println!("    {}. {}", i + 1, item);
        }
    }
}

// Methods only when T: PartialOrd + Display
impl<T: PartialOrd + fmt::Display> Inventory<T> {
    fn find_max(&self) -> Option<&T> {
        self.items.iter().reduce(|max, item| if item > max { item } else { max })
    }
}

fn demo_impl_on_generics() {
    println!("\n=== 7. Impl on Generic Types ===\n");

    let mut chai_menu: Inventory<String> = Inventory::new("Chai Menu");
    chai_menu.add(String::from("Masala Chai"));
    chai_menu.add(String::from("Ginger Chai"));
    chai_menu.add(String::from("Tandoori Chai"));
    chai_menu.display_all();

    if let Some(max) = chai_menu.find_max() {
        println!("  Max (alphabetical): {}", max);
    }

    let mut prices: Inventory<f64> = Inventory::new("Prices");
    prices.add(15.0);
    prices.add(25.0);
    prices.add(10.0);
    prices.display_all();
    if let Some(max) = prices.find_max() {
        println!("  Most expensive: Rs. {:.2}", max);
    }
}

// ============================================================
// 8. PRACTICAL EXAMPLE — GENERIC DATA TABLE
// ============================================================

#[derive(Debug, Clone)]
struct DataTable<T> {
    name: String,
    columns: Vec<String>,
    rows: Vec<Vec<T>>,
}

impl<T> DataTable<T> {
    fn new(name: &str, columns: Vec<&str>) -> Self {
        Self {
            name: String::from(name),
            columns: columns.into_iter().map(String::from).collect(),
            rows: Vec::new(),
        }
    }

    fn add_row(&mut self, row: Vec<T>) {
        assert_eq!(row.len(), self.columns.len(), "Row length must match column count");
        self.rows.push(row);
    }
}

impl<T: fmt::Display> DataTable<T> {
    fn print_table(&self) {
        println!("\n  Table: {} ({} rows x {} cols)",
            self.name, self.rows.len(), self.columns.len());
        println!("  {}", self.columns.join(" | "));
        println!("  {}", "-".repeat(self.columns.len() * 12));
        for row in &self.rows {
            let formatted: Vec<String> = row.iter().map(|v| format!("{}", v)).collect();
            println!("  {}", formatted.join(" | "));
        }
    }
}

impl<T: Clone + PartialOrd> DataTable<T> {
    fn sort_by_column(&mut self, col_index: usize) {
        self.rows.sort_by(|a, b| {
            a[col_index].partial_cmp(&b[col_index]).unwrap_or(std::cmp::Ordering::Equal)
        });
    }
}

fn demo_practical_data_table() {
    println!("\n=== 8. Practical: Generic Data Table ===\n");

    let mut scores = DataTable::new("Cricket Scores", vec!["Runs", "Balls", "Fours"]);
    scores.add_row(vec![85, 60, 10]);
    scores.add_row(vec![120, 80, 14]);
    scores.add_row(vec![45, 35, 6]);
    scores.sort_by_column(0);
    scores.print_table();
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    demo_generic_functions();
    demo_generic_structs();
    demo_generic_enums();
    demo_type_constraints();
    demo_where_clause();
    demo_monomorphization();
    demo_impl_on_generics();
    demo_practical_data_table();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===\n");
    println!("1. Generics let you write code once for many types: fn foo<T>(x: T).");
    println!("2. Type bounds (T: Display + Clone) restrict what T can be.");
    println!("3. Generic structs/enums: Vec<T>, Option<T>, Result<T,E>.");
    println!("4. where clause: cleaner syntax for complex bounds.");
    println!("5. Monomorphization: compiler generates type-specific code — zero cost.");
    println!("6. impl<T> Struct<T> for all T. impl Struct<Concrete> for specific types.");
    println!("7. impl<T: Bound> Struct<T> for conditional methods.");
    println!("8. Generics + traits = Rust's answer to OOP polymorphism, but safer.");
}

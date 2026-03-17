// ============================================================
// 13 - COLLECTIONS: HashMap AND String
// ============================================================
// HashMap is Rust's key-value store — O(1) average lookup.
// String (owned, heap) vs &str (borrowed, slice) appears in
// every Rust program. Mastering the entry API and String vs
// &str will save you hours fighting the borrow checker.
// ============================================================

// ============================================================
// STORY: The Flipkart Warehouse Inventory
// ============================================================
// Every product has a unique SKU mapped to its stock count.
// When shipments arrive, INSERT or UPDATE. When someone orders,
// DECREMENT. The entry API handles "insert if absent, update
// if present" in one elegant call.
// ============================================================

use std::collections::BTreeMap;
use std::collections::HashMap;

// ============================================================
// 1. CREATING HashMaps
// ============================================================

fn demo_creating_hashmaps() {
    println!("=== 1. Creating HashMaps ===\n");

    let mut inventory: HashMap<String, u32> = HashMap::new();
    inventory.insert(String::from("SKU-IPHONE15"), 342);
    inventory.insert(String::from("SKU-ONEPLUS12"), 128);
    println!("From new: {:?}", inventory);

    let prices: HashMap<&str, f64> = HashMap::from([
        ("Laptop", 59999.0), ("Phone", 29999.0), ("Tablet", 19999.0),
    ]);
    println!("From array: {:?}", prices);

    // From two parallel iterators using zip()
    let products = vec!["Mouse", "Keyboard", "Monitor"];
    let stocks = vec![500, 320, 85];
    let stock_map: HashMap<&str, i32> = products.into_iter().zip(stocks.into_iter()).collect();
    println!("From zip: {:?}", stock_map);
}

// ============================================================
// 2. INSERT, GET, REMOVE
// ============================================================

fn demo_basic_operations() {
    println!("\n=== 2. Insert, Get, Remove ===\n");

    let mut warehouse: HashMap<String, u32> = HashMap::new();

    // insert returns None if key was new, Some(old_value) if it existed
    let old = warehouse.insert(String::from("SKU-TV55"), 50);
    println!("First insert: old value = {:?}", old);

    let old = warehouse.insert(String::from("SKU-TV55"), 75);
    println!("Update insert: old value = {:?}", old);

    warehouse.insert(String::from("SKU-FRIDGE"), 30);
    warehouse.insert(String::from("SKU-AC"), 45);

    match warehouse.get("SKU-TV55") {
        Some(&count) => println!("TV55 stock: {}", count),
        None => println!("TV55 not found"),
    }

    println!("Has fridge: {}", warehouse.contains_key("SKU-FRIDGE"));

    let removed = warehouse.remove("SKU-AC");
    println!("Removed AC: {:?}", removed);
    println!("Items: {}, Empty: {}", warehouse.len(), warehouse.is_empty());
}

// ============================================================
// 3. THE ENTRY API
// ============================================================
// Handles "get or insert" atomically without double lookups.

fn demo_entry_api() {
    println!("\n=== 3. Entry API ===\n");

    // or_insert — insert default if key absent
    let mut stock: HashMap<String, u32> = HashMap::new();
    stock.entry(String::from("Widget")).or_insert(100);
    stock.entry(String::from("Widget")).or_insert(200); // Won't overwrite
    println!("Widget (or_insert): {}", stock["Widget"]);

    // Classic word counter pattern
    let words = vec!["chai", "samosa", "chai", "jalebi", "chai", "samosa"];
    let mut word_count: HashMap<&str, u32> = HashMap::new();
    for word in &words {
        *word_count.entry(word).or_insert(0) += 1;
    }
    println!("Word counts: {:?}", word_count);

    // and_modify + or_insert chain
    let mut scores: HashMap<String, u32> = HashMap::new();
    let players = vec!["Virat", "Rohit", "Virat", "Dhoni", "Virat", "Rohit"];
    for player in players {
        scores.entry(String::from(player))
            .and_modify(|s| *s += 1)
            .or_insert(1);
    }
    println!("Appearances: {:?}", scores);
}

// ============================================================
// 4. ITERATING OVER HashMaps
// ============================================================

fn demo_iteration() {
    println!("\n=== 4. Iterating HashMaps ===\n");

    let mut inventory: HashMap<&str, u32> = HashMap::from([
        ("Laptop", 45), ("Phone", 230), ("Tablet", 67),
        ("Earbuds", 500), ("Charger", 890),
    ]);

    let total_stock: u32 = inventory.values().sum();
    println!("Total units: {}", total_stock);

    // iter_mut() for modifying values in-place
    for (product, stock) in inventory.iter_mut() {
        let addition = (*stock as f64 * 0.1) as u32;
        *stock += addition;
        println!("  {}: +{} = {}", product, addition, stock);
    }

    // retain — filter HashMap in-place
    inventory.retain(|_, &mut stock| stock > 100);
    let mut kept: Vec<(&str, u32)> = inventory.iter().map(|(&k, &v)| (k, v)).collect();
    kept.sort_by_key(|(k, _)| *k);
    println!("After retain (stock > 100): {:?}", kept);
}

// ============================================================
// 5. BTreeMap — ORDERED MAP
// ============================================================
// Keeps keys sorted. O(log n) vs HashMap's O(1).

fn demo_btreemap() {
    println!("\n=== 5. BTreeMap (Ordered) ===\n");

    let mut marks: BTreeMap<String, Vec<u32>> = BTreeMap::new();
    marks.insert(String::from("Rahul"), vec![85, 92, 78]);
    marks.insert(String::from("Anita"), vec![95, 88, 91]);
    marks.insert(String::from("Priya"), vec![70, 82, 88]);

    println!("Student marks (sorted by name):");
    for (name, scores) in &marks {
        let avg: f64 = scores.iter().sum::<u32>() as f64 / scores.len() as f64;
        println!("  {}: {:?} (avg: {:.1})", name, scores, avg);
    }

    println!("First: {:?}", marks.iter().next().map(|(k, _)| k.as_str()));
    println!("Last: {:?}", marks.iter().next_back().map(|(k, _)| k.as_str()));
}

// ============================================================
// 6. STRING VS &str
// ============================================================
// String: owned, heap, growable. &str: borrowed slice.
// &String auto-coerces to &str (deref coercion).

fn demo_string_vs_str() {
    println!("\n=== 6. String vs &str ===\n");

    let greeting: &str = "Namaste";
    let owned: String = String::from("Namaste");
    println!("&str: {}, String: {}", greeting, owned);

    // &String coerces to &str
    fn greet(name: &str) { println!("  Hello, {}!", name); }
    greet("Priya");
    greet(&String::from("Rahul"));

    // String is mutable, &str is not
    let mut mutable = String::from("Jai ");
    mutable.push_str("Hind!");
    println!("Mutated: {}", mutable);
}

// ============================================================
// 7. STRING METHODS
// ============================================================

fn demo_string_methods() {
    println!("\n=== 7. String Methods ===\n");

    let mut msg = String::from("Jai");
    msg.push_str(" Hind");
    msg.push('!');
    println!("push_str/push: {}", msg);

    let address = format!("{}, PIN: {}", "Mumbai", 400001);
    println!("format!: {}", address);

    // + operator takes ownership of the left side
    let hello = String::from("Hello");
    let world = String::from(" World");
    let combined = hello + &world;
    println!("+ operator: {}", combined);

    let sentence = String::from("Rust is blazing fast and memory safe");
    println!("contains 'fast': {}", sentence.contains("fast"));

    let csv = "Mumbai,Delhi,Chennai,Kolkata";
    let cities: Vec<&str> = csv.split(',').collect();
    println!("split: {:?}", cities);

    println!("trim: '{}'", "   Hello India   ".trim());
    println!("upper: {}", "namaste".to_uppercase());

    // len() is bytes, not characters
    let hindi = String::from("नमस्ते");
    println!("'{}': {} bytes, {} chars", hindi, hindi.len(), hindi.chars().count());
}

// ============================================================
// 8. PRACTICAL: INVENTORY SYSTEM
// ============================================================

#[derive(Debug)]
struct Product {
    name: String,
    price: f64,
    stock: u32,
    category: String,
}

impl Product {
    fn new(name: &str, price: f64, stock: u32, category: &str) -> Self {
        Self { name: String::from(name), price, stock, category: String::from(category) }
    }
}

fn demo_practical_inventory() {
    println!("\n=== 8. Practical: Inventory System ===\n");

    let mut inventory: HashMap<String, Product> = HashMap::new();
    let products = vec![
        ("SKU-001", Product::new("iPhone 15", 79999.0, 150, "Phones")),
        ("SKU-002", Product::new("OnePlus 12", 42999.0, 280, "Phones")),
        ("SKU-003", Product::new("MacBook Air", 99999.0, 45, "Laptops")),
        ("SKU-004", Product::new("AirPods Pro", 24999.0, 500, "Audio")),
    ];
    for (sku, product) in products {
        inventory.insert(String::from(sku), product);
    }
    println!("Inventory loaded: {} products", inventory.len());

    // Process an order
    if let Some(product) = inventory.get_mut("SKU-001") {
        if product.stock > 0 {
            product.stock -= 1;
            println!("Sold 1x {}. Remaining: {}", product.name, product.stock);
        }
    }

    // Category-wise stock summary
    let mut category_summary: HashMap<&str, (u32, f64)> = HashMap::new();
    for product in inventory.values() {
        let entry = category_summary.entry(product.category.as_str()).or_insert((0, 0.0));
        entry.0 += product.stock;
        entry.1 += product.price * product.stock as f64;
    }

    println!("\nCategory Summary:");
    let mut summary: Vec<_> = category_summary.iter().collect();
    summary.sort_by_key(|(k, _)| *k);
    for (category, (units, value)) in summary {
        println!("  {}: {} units, total value Rs. {:.2}", category, units, value);
    }
}

// ============================================================
// 9. COMBINING STRINGS AND HASHMAPS
// ============================================================

fn demo_string_hashmap_combo() {
    println!("\n=== 9. Strings + HashMaps Combined ===\n");

    // Parse a config string into a HashMap
    let config_text = "host=127.0.0.1;port=8080;db=myapp;timeout=30";
    let config: HashMap<&str, &str> = config_text
        .split(';')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            match (parts.next(), parts.next()) {
                (Some(k), Some(v)) => Some((k, v)),
                _ => None,
            }
        })
        .collect();

    println!("Parsed config:");
    let mut sorted_config: Vec<_> = config.iter().collect();
    sorted_config.sort_by_key(|(k, _)| **k);
    for (key, value) in &sorted_config {
        println!("  {} = {}", key, value);
    }

    // Word frequency counter
    let text = "to be or not to be that is the question";
    let mut freq: HashMap<&str, u32> = HashMap::new();
    for word in text.split_whitespace() {
        *freq.entry(word).or_insert(0) += 1;
    }
    let mut sorted_freq: Vec<_> = freq.iter().collect();
    sorted_freq.sort_by(|a, b| b.1.cmp(a.1));

    println!("\nWord frequency (top 5):");
    for (word, count) in sorted_freq.iter().take(5) {
        println!("  {:>10}: {} ({})", word, "#".repeat(**count as usize), count);
    }
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    demo_creating_hashmaps();
    demo_basic_operations();
    demo_entry_api();
    demo_iteration();
    demo_btreemap();
    demo_string_vs_str();
    demo_string_methods();
    demo_practical_inventory();
    demo_string_hashmap_combo();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===\n");
    println!("1. HashMap<K,V> provides O(1) average insert/get/remove.");
    println!("2. entry() API: or_insert, and_modify — no double lookups.");
    println!("3. BTreeMap keeps keys sorted. Use for ordered iteration/ranges.");
    println!("4. String is owned (heap, growable). &str is borrowed (slice).");
    println!("5. &String auto-coerces to &str. Accept &str in function params.");
    println!("6. format!() creates Strings. join() concatenates slices.");
    println!("7. String::len() is bytes, not characters. Use .chars().count().");
    println!("8. HashMap + String: parse text into maps, format maps to text.");
}

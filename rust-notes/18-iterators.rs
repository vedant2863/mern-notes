// ============================================================
// FILE 18: ITERATORS — Lazy, Composable Data Pipelines
// ============================================================
// Iterators process sequences lazily and efficiently. They
// replace manual loops with composable chains. The compiler
// optimizes them to be as fast as hand-written loops.
// ============================================================

// ============================================================
// STORY: Dabbawala Sorting Line Pipeline
// ============================================================
// Mumbai's dabbawalas deliver 200,000+ lunchboxes daily.
// Each dabba passes through a PIPELINE: collect, sort/map,
// filter, group, deliver. Each station is LAZY — it only
// processes the next dabba when asked. That's Rust iterators.
// ============================================================

use std::collections::HashMap;
use std::fmt;

// ============================================================
// 1. ITERATOR TRAIT BASICS
// ============================================================
// One required method: next() -> Option<Item>.

fn demonstrate_iterator_basics() {
    println!("--- 1. Iterator Trait Basics ---");

    let stations = vec!["Churchgate", "Marine Lines", "Charni Road", "Grant Road"];
    let mut iter = stations.iter();
    println!("  First: {:?}", iter.next());
    println!("  Second: {:?}", iter.next());

    // Three ways to iterate:
    // .iter() -> &T, .iter_mut() -> &mut T, .into_iter() -> T
    let mut dabbas = vec![101, 102, 103];
    for dabba in dabbas.iter_mut() { *dabba += 1000; }
    println!("  After marking: {:?}", dabbas);
}

// ============================================================
// 2. CONSUMING ADAPTORS
// ============================================================
// Call next() until exhausted. "Consume" the iterator.

fn demonstrate_consuming_adaptors() {
    println!("\n--- 2. Consuming Adaptors ---");

    let times = vec![25, 30, 15, 45, 20, 35];

    println!("  Total: {} min", times.iter().sum::<i32>());
    println!("  Count: {}", times.iter().count());
    println!("  Fastest: {} min", times.iter().min().unwrap());
    println!("  Slowest: {} min", times.iter().max().unwrap());

    let doubled: Vec<i32> = times.iter().map(|t| t * 2).collect();
    println!("  Doubled: {:?}", doubled);

    // collect into HashMap
    let zones = vec!["Andheri", "Bandra", "Colaba"];
    let codes = vec![1, 2, 3];
    let zone_map: HashMap<&str, i32> = zones.iter().copied().zip(codes.iter().copied()).collect();
    println!("  Zone map: {:?}", zone_map);

    println!("  Any slow (>40)? {}", times.iter().any(|&t| t > 40));
    println!("  First >30: {:?}", times.iter().find(|&&t| t > 30));
}

// ============================================================
// 3. LAZY EVALUATION
// ============================================================
// Adaptors do NOTHING until a consuming method pulls values.

fn demonstrate_lazy_evaluation() {
    println!("\n--- 3. Lazy Evaluation ---");

    let dabbas = vec![1, 2, 3, 4, 5];

    println!("  Collecting:");
    let result: Vec<i32> = dabbas.iter()
        .map(|d| { println!("    mapping {}", d); d * 10 })
        .filter(|d| { println!("    filtering {}", d); *d > 20 })
        .collect();
    println!("  Result: {:?}", result);

    // Lazy = early stopping with find
    println!("\n  Early stopping:");
    let first_big = dabbas.iter()
        .map(|d| { println!("    mapping {}", d); d * 10 })
        .find(|d| *d > 30);
    println!("  Found: {:?}", first_big);
}

// ============================================================
// 4. ITERATOR ADAPTORS
// ============================================================

fn demonstrate_iterator_adaptors() {
    println!("\n--- 4. Iterator Adaptors ---");

    let dabbas = vec![
        ("D001", "Andheri", 2), ("D002", "Bandra", 5),
        ("D003", "Colaba", 1), ("D004", "Andheri", 3),
        ("D005", "Dadar", 4), ("D006", "Bandra", 6),
    ];

    // filter_map — filter + transform in one step
    let heavy: Vec<String> = dabbas.iter()
        .filter_map(|(id, _, w)| if *w > 3 { Some(format!("{} ({}kg)", id, w)) } else { None })
        .collect();
    println!("  Heavy dabbas: {:?}", heavy);

    // zip
    let names = vec!["Raj", "Priya"];
    let scores = vec![95, 88];
    let paired: Vec<_> = names.iter().zip(scores.iter()).collect();
    println!("  Zipped: {:?}", paired);

    // chain
    let morning = vec!["D001", "D002"];
    let evening = vec!["D003", "D004"];
    let all: Vec<_> = morning.iter().chain(evening.iter()).collect();
    println!("  Chained: {:?}", all);

    // take / skip
    let first_two: Vec<_> = dabbas.iter().take(2).collect();
    println!("  First 2: {:?}", first_two);

    // flat_map
    let zones = vec!["Andheri-East", "Bandra-West"];
    let words: Vec<&str> = zones.iter().flat_map(|z| z.split('-')).collect();
    println!("  Flat mapped: {:?}", words);

    // flatten
    let nested = vec![vec![1, 2], vec![3, 4], vec![5]];
    let flat: Vec<_> = nested.iter().flatten().collect();
    println!("  Flattened: {:?}", flat);
}

// ============================================================
// 5. fold AND reduce
// ============================================================

fn demonstrate_fold_reduce() {
    println!("\n--- 5. fold and reduce ---");

    let weights = vec![2, 5, 1, 3, 4, 6];

    let total = weights.iter().fold(0, |acc, &w| acc + w);
    println!("  Total weight: {} kg", total);

    // fold to find min and max simultaneously
    let (min, max) = weights.iter()
        .fold((i32::MAX, i32::MIN), |(min, max), &w| (min.min(w), max.max(w)));
    println!("  Min: {}, Max: {}", min, max);

    // fold to group by category
    let dabbas = vec![("Andheri", 2), ("Bandra", 5), ("Andheri", 3), ("Bandra", 1)];
    let grouped = dabbas.iter().fold(HashMap::new(), |mut map: HashMap<&str, Vec<i32>>, &(zone, w)| {
        map.entry(zone).or_default().push(w);
        map
    });
    println!("  Grouped: {:?}", grouped);
}

// ============================================================
// 6. CUSTOM ITERATOR
// ============================================================

struct DabbaRoute { stations: Vec<String>, current: usize }

impl DabbaRoute {
    fn new(stations: Vec<&str>) -> Self {
        DabbaRoute { stations: stations.into_iter().map(String::from).collect(), current: 0 }
    }
}

impl Iterator for DabbaRoute {
    type Item = String;
    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.stations.len() {
            let station = self.stations[self.current].clone();
            self.current += 1;
            Some(station)
        } else { None }
    }
}

// Infinite iterator
struct Fibonacci { a: u64, b: u64 }

impl Fibonacci { fn new() -> Self { Fibonacci { a: 0, b: 1 } } }

impl Iterator for Fibonacci {
    type Item = u64;
    fn next(&mut self) -> Option<Self::Item> {
        let result = self.a;
        let new_b = self.a + self.b;
        self.a = self.b;
        self.b = new_b;
        Some(result)
    }
}

fn demonstrate_custom_iterator() {
    println!("\n--- 6. Custom Iterator ---");

    let route = DabbaRoute::new(vec!["Churchgate", "Marine Lines", "Charni Road", "Mumbai Central"]);
    print!("  Route:");
    for station in route { print!(" -> {}", station); }
    println!();

    let fibs: Vec<u64> = Fibonacci::new().take(10).collect();
    println!("  First 10 Fibonacci: {:?}", fibs);

    let fib_sum: u64 = Fibonacci::new().take(20).sum();
    println!("  Sum of first 20 Fibonacci: {}", fib_sum);
}

// ============================================================
// 7. IntoIterator
// ============================================================
// Lets your type be used in for loops.

struct DabbaCollection { dabbas: Vec<(String, String)> }

impl DabbaCollection {
    fn new() -> Self { DabbaCollection { dabbas: Vec::new() } }
    fn add(&mut self, id: &str, dest: &str) {
        self.dabbas.push((String::from(id), String::from(dest)));
    }
}

impl IntoIterator for DabbaCollection {
    type Item = (String, String);
    type IntoIter = std::vec::IntoIter<(String, String)>;
    fn into_iter(self) -> Self::IntoIter { self.dabbas.into_iter() }
}

fn demonstrate_into_iterator() {
    println!("\n--- 7. IntoIterator ---");

    let mut col = DabbaCollection::new();
    col.add("D001", "Andheri");
    col.add("D002", "Bandra");

    for (id, dest) in col {
        println!("    {} -> {}", id, dest);
    }
}

// ============================================================
// 8. PRACTICAL PIPELINES
// ============================================================

#[derive(Debug, Clone)]
struct Dabba { id: String, zone: String, weight_kg: f64, is_fragile: bool, delivery_time_min: u32 }

impl Dabba {
    fn new(id: &str, zone: &str, weight: f64, fragile: bool, time: u32) -> Self {
        Dabba { id: String::from(id), zone: String::from(zone), weight_kg: weight, is_fragile: fragile, delivery_time_min: time }
    }
}

impl fmt::Display for Dabba {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}({}, {:.1}kg{})", self.id, self.zone, self.weight_kg,
            if self.is_fragile { ", FRAGILE" } else { "" })
    }
}

fn demonstrate_practical_pipelines() {
    println!("\n--- 8. Practical Pipelines ---");

    let dabbas = vec![
        Dabba::new("D001", "Andheri", 2.5, false, 25),
        Dabba::new("D002", "Bandra", 5.0, true, 30),
        Dabba::new("D003", "Colaba", 1.0, false, 45),
        Dabba::new("D004", "Andheri", 3.5, true, 20),
        Dabba::new("D005", "Dadar", 4.0, false, 35),
        Dabba::new("D006", "Bandra", 6.0, false, 15),
    ];

    // Heavy fragile dabbas
    println!("  Heavy fragile dabbas:");
    for d in dabbas.iter().filter(|d| d.is_fragile && d.weight_kg > 2.0) {
        println!("    {}", d);
    }

    // Weight per zone
    let zone_weights: HashMap<&str, f64> = dabbas.iter().fold(HashMap::new(), |mut map, d| {
        *map.entry(d.zone.as_str()).or_insert(0.0) += d.weight_kg;
        map
    });
    let mut sorted: Vec<_> = zone_weights.iter().collect();
    sorted.sort_by_key(|(z, _)| *z);
    println!("  Weight per zone:");
    for (zone, weight) in &sorted { println!("    {}: {:.1} kg", zone, weight); }

    // Partition fragile/normal
    let (fragile, normal): (Vec<_>, Vec<_>) = dabbas.iter().partition(|d| d.is_fragile);
    println!("  Fragile: {}, Normal: {}", fragile.len(), normal.len());

    // Heaviest non-fragile zone
    let zone = dabbas.iter()
        .filter(|d| !d.is_fragile)
        .max_by(|a, b| a.weight_kg.partial_cmp(&b.weight_kg).unwrap())
        .map(|d| &d.zone);
    println!("  Heaviest normal dabba zone: {:?}", zone);
}

// ============================================================
// 9. STANDARD ITERATORS
// ============================================================

fn demonstrate_standard_iterators() {
    println!("\n--- 9. Standard Iterators ---");

    println!("  Sum 1..=100: {}", (1..=100).sum::<i32>());

    let with_header: Vec<&str> = std::iter::once("HEADER")
        .chain(vec!["row1", "row2", "row3"].into_iter())
        .collect();
    println!("  Once + chain: {:?}", with_header);

    let powers: Vec<u64> = std::iter::successors(Some(1u64), |&p| p.checked_mul(2))
        .take(10).collect();
    println!("  Powers of 2: {:?}", powers);

    let combined: Vec<i32> = (1..=3).chain(10..=12).chain(100..=102).collect();
    println!("  Combined ranges: {:?}", combined);
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST ITERATORS: Dabbawala Pipeline ===\n");

    demonstrate_iterator_basics();
    demonstrate_consuming_adaptors();
    demonstrate_lazy_evaluation();
    demonstrate_iterator_adaptors();
    demonstrate_fold_reduce();
    demonstrate_custom_iterator();
    demonstrate_into_iterator();
    demonstrate_practical_pipelines();
    demonstrate_standard_iterators();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. Iterator trait needs only next() -> Option<Item>");
    println!("2. .iter() borrows, .iter_mut() mutably borrows, .into_iter() consumes");
    println!("3. Adaptors (map, filter) are LAZY — no work until consumed");
    println!("4. Consuming adaptors (collect, sum, fold) drive the pipeline");
    println!("5. fold is the most general accumulator");
    println!("6. Implement Iterator for custom types to get 70+ methods free");
    println!("7. IntoIterator enables for-loop support");
    println!("8. Iterator chains compile to the same code as hand-written loops");
}

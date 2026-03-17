// ============================================================
// FILE 19: SMART POINTERS — Heap Allocation and Shared Ownership
// ============================================================
// Smart pointers manage heap memory, enable shared ownership,
// provide interior mutability, and make recursive data
// structures possible.
// ============================================================

// ============================================================
// STORY: Netflix India Shared Screen Plan
// ============================================================
// Box<T> = MOBILE plan (1 screen) — one owner, data on heap.
// Rc<T> = BASIC plan (family sharing) — multiple owners, NOT
//         thread-safe. When the LAST member cancels, data freed.
// Arc<T> = PREMIUM plan — like Rc but thread-safe.
// RefCell<T> = PARENTAL CONTROLS — mutate behind an immutable
//              reference, with runtime borrow checking.
// ============================================================

use std::cell::RefCell;
use std::fmt;
use std::ops::Deref;
use std::rc::Rc;
use std::sync::Arc;
use std::borrow::Cow;

// ============================================================
// 1. Box<T> — Single Owner on Heap
// ============================================================

fn demonstrate_box() {
    println!("--- 1. Box<T> — Single Owner on Heap ---");

    let subscription = Box::new(String::from("Netflix Mobile Plan"));
    println!("  Plan: {}", subscription);

    let price = Box::new(199);
    let unboxed: i32 = *price;
    println!("  Unboxed price: Rs.{}", unboxed);

    // Box for trait objects
    let plans: Vec<Box<dyn fmt::Display>> = vec![
        Box::new(String::from("Mobile Plan")), Box::new(199), Box::new(true),
    ];
    print!("  Plans:");
    for plan in &plans { print!(" [{}]", plan); }
    println!();
}

// ============================================================
// 2. RECURSIVE TYPES WITH Box
// ============================================================

#[derive(Debug)]
enum WatchList {
    Show(String, Box<WatchList>),
    End,
}

impl WatchList {
    fn new() -> Self { WatchList::End }
    fn prepend(self, show: &str) -> Self {
        WatchList::Show(String::from(show), Box::new(self))
    }
    fn display(&self) {
        match self {
            WatchList::Show(name, next) => {
                print!("{}", name);
                if !matches!(**next, WatchList::End) { print!(" -> "); }
                next.display();
            }
            WatchList::End => println!(),
        }
    }
}

fn demonstrate_recursive_types() {
    println!("\n--- 2. Recursive Types with Box ---");

    let watchlist = WatchList::new()
        .prepend("Sacred Games")
        .prepend("Mirzapur")
        .prepend("Panchayat");
    print!("  Watchlist: ");
    watchlist.display();
}

// ============================================================
// 3. DEREF TRAIT
// ============================================================

struct MyBox<T>(T);

impl<T> MyBox<T> { fn new(x: T) -> MyBox<T> { MyBox(x) } }

impl<T> Deref for MyBox<T> {
    type Target = T;
    fn deref(&self) -> &T { &self.0 }
}

fn greet_subscriber(name: &str) { println!("  Welcome, {}!", name); }

fn demonstrate_deref() {
    println!("\n--- 3. Deref Trait ---");

    // Deref coercion: &Box<String> -> &String -> &str
    let boxed = Box::new(String::from("Rahul"));
    greet_subscriber(&boxed);

    let my_boxed = MyBox::new(String::from("Priya"));
    greet_subscriber(&my_boxed);
}

// ============================================================
// 4. DROP TRAIT
// ============================================================

struct Subscription { plan: String, user: String }

impl Subscription {
    fn new(plan: &str, user: &str) -> Self {
        println!("  [Created] {} for {}", plan, user);
        Subscription { plan: String::from(plan), user: String::from(user) }
    }
}

impl Drop for Subscription {
    fn drop(&mut self) {
        println!("  [Dropped] {} for {} cancelled", self.plan, self.user);
    }
}

fn demonstrate_drop() {
    println!("\n--- 4. Drop Trait ---");
    let _sub1 = Subscription::new("Premium", "Amit");
    {
        let _sub2 = Subscription::new("Basic", "Priya");
    } // _sub2 dropped here
    let sub3 = Subscription::new("Mobile", "Rahul");
    drop(sub3); // Explicit early drop
    println!("  End of demonstrate_drop");
}

// ============================================================
// 5. Rc<T> — Reference Counted Shared Ownership
// ============================================================

fn demonstrate_rc() {
    println!("\n--- 5. Rc<T> — Shared Ownership ---");

    let show = Rc::new(String::from("Sacred Games"));
    println!("  Created, ref count: {}", Rc::strong_count(&show));

    let mom = Rc::clone(&show);
    let dad = Rc::clone(&show);
    println!("  After 2 clones, ref count: {}", Rc::strong_count(&show));

    {
        let _kid = Rc::clone(&show);
        println!("  Kid joined, ref count: {}", Rc::strong_count(&show));
    }
    println!("  Kid left, ref count: {}", Rc::strong_count(&show));
    println!("  Mom: {}, Dad: {}", mom, dad);
}

// ============================================================
// 6. RefCell<T> — Interior Mutability
// ============================================================
// Moves borrow checking to RUNTIME. Panics on violation.

fn demonstrate_refcell() {
    println!("\n--- 6. RefCell<T> — Interior Mutability ---");

    let history = RefCell::new(vec!["Panchayat S1", "Mirzapur S1"]);
    println!("  History: {:?}", history.borrow());

    history.borrow_mut().push("Sacred Games S1");
    println!("  After adding: {:?}", history.borrow());

    // Interior mutability pattern
    struct WatchTracker {
        shows: RefCell<Vec<String>>,
        view_count: RefCell<u32>,
    }

    impl WatchTracker {
        fn new() -> Self {
            WatchTracker { shows: RefCell::new(Vec::new()), view_count: RefCell::new(0) }
        }
        fn watch(&self, show: &str) {
            self.shows.borrow_mut().push(String::from(show));
            *self.view_count.borrow_mut() += 1;
        }
        fn report(&self) -> String {
            format!("Watched {} shows: {:?}", self.view_count.borrow(), self.shows.borrow())
        }
    }

    let tracker = WatchTracker::new();
    tracker.watch("Kota Factory");
    tracker.watch("TVF Pitchers");
    println!("  {}", tracker.report());
}

// ============================================================
// 7. Rc<RefCell<T>> — Shared Mutable State
// ============================================================

fn demonstrate_rc_refcell() {
    println!("\n--- 7. Rc<RefCell<T>> — Shared + Mutable ---");

    let family_list = Rc::new(RefCell::new(vec![String::from("Panchayat")]));
    let moms = Rc::clone(&family_list);
    let dads = Rc::clone(&family_list);

    moms.borrow_mut().push(String::from("Delhi Crime"));
    dads.borrow_mut().push(String::from("Scam 1992"));

    println!("  Family watchlist: {:?}", family_list.borrow());
    println!("  Ref count: {}", Rc::strong_count(&family_list));
}

// ============================================================
// 8. Arc<T> — Thread-Safe Reference Counting
// ============================================================

fn demonstrate_arc() {
    println!("\n--- 8. Arc<T> — Thread-Safe Sharing ---");

    let catalog = Arc::new(vec!["Sacred Games", "Mirzapur", "Panchayat"]);
    let thread_catalog = Arc::clone(&catalog);
    println!("  Ref count: {}", Arc::strong_count(&catalog));
    println!("  Same data? {}", Arc::ptr_eq(&catalog, &thread_catalog));

    drop(thread_catalog);
    println!("  After drop, ref count: {}", Arc::strong_count(&catalog));
    println!("  Arc + Mutex = thread-safe shared mutable state");
}

// ============================================================
// 9. Cow<T> — Clone on Write
// ============================================================

fn normalize_title(title: &str) -> Cow<str> {
    if title.contains("  ") || title.starts_with(' ') || title.ends_with(' ') {
        Cow::Owned(title.split_whitespace().collect::<Vec<_>>().join(" "))
    } else {
        Cow::Borrowed(title)
    }
}

fn demonstrate_cow() {
    println!("\n--- 9. Cow<T> — Clone on Write ---");

    let titles = vec!["Panchayat", "  Kota  Factory ", "Delhi Crime"];
    for title in &titles {
        let norm = normalize_title(title);
        let status = if matches!(norm, Cow::Borrowed(_)) { "zero-copy" } else { "allocated" };
        println!("  '{}' -> '{}' ({})", title, norm, status);
    }
}

// ============================================================
// 10. COMPARISON TABLE
// ============================================================

fn demonstrate_comparison() {
    println!("\n--- 10. When to Use What ---");
    println!("  Box<T>:          heap allocation, recursive types, trait objects");
    println!("  Rc<T>:           multiple owners, single-threaded");
    println!("  Arc<T>:          multiple owners, thread-safe");
    println!("  RefCell<T>:      interior mutability, runtime borrow check");
    println!("  Rc<RefCell<T>>:  shared + mutable, single thread");
    println!("  Arc<Mutex<T>>:   shared + mutable, multi thread");
    println!("  Cow<T>:          borrow when possible, clone when necessary");
}

// ============================================================
// 11. PRACTICAL: CONTENT CACHE
// ============================================================

struct ContentCache {
    entries: RefCell<Vec<(String, String)>>,
    max_size: usize,
    hits: RefCell<u32>,
    misses: RefCell<u32>,
}

impl ContentCache {
    fn new(max_size: usize) -> Self {
        ContentCache { entries: RefCell::new(Vec::new()), max_size, hits: RefCell::new(0), misses: RefCell::new(0) }
    }

    fn get(&self, key: &str) -> Option<String> {
        for (k, v) in self.entries.borrow().iter() {
            if k == key { *self.hits.borrow_mut() += 1; return Some(v.clone()); }
        }
        *self.misses.borrow_mut() += 1;
        None
    }

    fn put(&self, key: &str, value: &str) {
        let mut entries = self.entries.borrow_mut();
        entries.retain(|(k, _)| k != key);
        if entries.len() >= self.max_size { entries.remove(0); }
        entries.push((String::from(key), String::from(value)));
    }

    fn stats(&self) -> String {
        format!("Cache: {} entries, {} hits, {} misses",
            self.entries.borrow().len(), self.hits.borrow(), self.misses.borrow())
    }
}

fn demonstrate_practical_cache() {
    println!("\n--- 11. Practical: Content Cache ---");

    let cache = ContentCache::new(3);
    cache.put("sacred-games", "Sacred Games - Crime Thriller");
    cache.put("mirzapur", "Mirzapur - Action Drama");
    cache.put("panchayat", "Panchayat - Comedy Drama");

    println!("  {}", cache.get("mirzapur").unwrap_or_default());
    let miss = cache.get("delhi-crime");
    println!("  Delhi Crime: {:?}", miss);
    println!("  {}", cache.stats());
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST SMART POINTERS: Netflix India Plan ===\n");

    demonstrate_box();
    demonstrate_recursive_types();
    demonstrate_deref();
    demonstrate_drop();
    demonstrate_rc();
    demonstrate_refcell();
    demonstrate_rc_refcell();
    demonstrate_arc();
    demonstrate_cow();
    demonstrate_comparison();
    demonstrate_practical_cache();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. Box<T>: heap allocation, single owner, zero overhead");
    println!("2. Box enables recursive types (linked lists, trees)");
    println!("3. Deref trait makes smart pointers transparent");
    println!("4. Drop trait runs cleanup code automatically");
    println!("5. Rc<T>: multiple owners, reference counted, NOT thread-safe");
    println!("6. RefCell<T>: interior mutability, runtime borrow checking");
    println!("7. Rc<RefCell<T>>: shared + mutable in single-threaded code");
    println!("8. Arc<T>: like Rc but thread-safe (atomic operations)");
    println!("9. Cow<T>: borrow when possible, clone when necessary");
    println!("10. Choose the simplest pointer that meets your needs");
}

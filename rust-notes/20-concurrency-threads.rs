// ============================================================
// FILE 20: CONCURRENCY WITH THREADS — Fearless Parallelism
// ============================================================
// Rust's ownership system prevents data races at compile time.
// If your code compiles, it's free from data races.
// ============================================================

// ============================================================
// STORY: Amma's Dhaba Kitchen Crew
// ============================================================
// A busy dhaba near a highway. Each cook (thread) works on
// their own dish. The shared spice rack (shared state) needs
// a lock (Mutex) — only one cook accesses it at a time.
// Rust's ownership system is like Amma — she ensures no two
// cooks fight over the same ingredient at compile time!
// ============================================================

use std::sync::{Arc, Mutex, Barrier};
use std::thread;
use std::time::Duration;

// ============================================================
// 1. SPAWNING THREADS
// ============================================================

fn demonstrate_spawning() {
    println!("--- 1. Spawning Threads ---");

    let handle = thread::spawn(|| {
        for i in 1..=3 {
            println!("  [Cook 1] Preparing dish {}...", i);
            thread::sleep(Duration::from_millis(10));
        }
    });

    for i in 1..=3 {
        println!("  [Amma] Checking order {}...", i);
        thread::sleep(Duration::from_millis(10));
    }

    handle.join().unwrap();
    println!("  All done!");
}

// ============================================================
// 2. JoinHandle — Return Values from Threads
// ============================================================

fn demonstrate_join_handle() {
    println!("\n--- 2. JoinHandle ---");

    let handle = thread::spawn(|| { (1..=100).sum::<i32>() });
    println!("  Sum 1..=100 from thread: {}", handle.join().unwrap());

    let mut handles = vec![];
    for cook_id in 1..=4 {
        handles.push(thread::spawn(move || {
            thread::sleep(Duration::from_millis(10));
            format!("Dish from Cook {}", cook_id)
        }));
    }
    let dishes: Vec<String> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    println!("  All dishes: {:?}", dishes);
}

// ============================================================
// 3. MOVE CLOSURES FOR THREADS
// ============================================================

fn demonstrate_move_closures() {
    println!("\n--- 3. Move Closures for Threads ---");

    let recipe = String::from("Sambar");
    let handle = thread::spawn(move || {
        println!("  Cook is making: {}", recipe);
        recipe.len()
    });
    println!("  Recipe name length: {}", handle.join().unwrap());

    // Copy types: move copies the value, original still works
    let quantity = 42_u32;
    let handle = thread::spawn(move || println!("  Quantity: {}", quantity));
    handle.join().unwrap();
    println!("  Quantity still here: {}", quantity);
}

// ============================================================
// 4. Arc<Mutex<T>> — SHARED MUTABLE STATE
// ============================================================

fn demonstrate_arc_mutex() {
    println!("\n--- 4. Arc<Mutex<T>> — Shared Mutable State ---");

    let order_count = Arc::new(Mutex::new(0_u32));
    let mut handles = vec![];

    for cook_id in 1..=5 {
        let counter = Arc::clone(&order_count);
        handles.push(thread::spawn(move || {
            for _ in 0..10 {
                let mut count = counter.lock().unwrap();
                *count += 1;
            } // MutexGuard dropped = lock released
            println!("  Cook {} finished 10 orders", cook_id);
        }));
    }

    for h in handles { h.join().unwrap(); }
    println!("  Total orders: {} (expected: 50)", *order_count.lock().unwrap());
}

// ============================================================
// 5. SCOPED THREADS
// ============================================================
// Can BORROW from parent scope. All threads finish before
// scope ends. Added in Rust 1.63.

fn demonstrate_scoped_threads() {
    println!("\n--- 5. Scoped Threads ---");

    let ingredients = vec!["Rice", "Dal", "Vegetables", "Spices"];
    let total_weight = Mutex::new(0u32);

    thread::scope(|s| {
        for (i, ingredient) in ingredients.iter().enumerate() {
            s.spawn(|| {
                let weight = (i + 1) as u32 * 100;
                println!("  Processing: {} ({}g)", ingredient, weight);
                *total_weight.lock().unwrap() += weight;
            });
        }
    });

    println!("  Ingredients still available: {:?}", ingredients);
    println!("  Total weight: {}g", total_weight.lock().unwrap());

    // Scoped threads with return values
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8];
    let results: Vec<i32> = thread::scope(|s| {
        let mut handles = vec![];
        for chunk in numbers.chunks(2) {
            handles.push(s.spawn(|| chunk.iter().sum::<i32>()));
        }
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });
    println!("  Chunk sums: {:?}, Total: {}", results, results.iter().sum::<i32>());
}

// ============================================================
// 6. PANIC IN THREADS
// ============================================================
// Thread panics don't crash main — caught by join().

fn demonstrate_thread_panic() {
    println!("\n--- 6. Panic in Threads ---");

    let handle = thread::spawn(|| { panic!("Cook dropped the biryani!"); });
    match handle.join() {
        Ok(_) => println!("  Thread completed"),
        Err(e) => {
            if let Some(msg) = e.downcast_ref::<&str>() {
                println!("  Thread panicked: {}", msg);
            }
        }
    }
    println!("  Main thread is still alive!");
}

// ============================================================
// 7. BARRIER
// ============================================================
// Makes threads wait until all reach the same point.

fn demonstrate_barrier() {
    println!("\n--- 7. Barrier ---");

    let num_cooks = 4;
    let barrier = Arc::new(Barrier::new(num_cooks));
    let mut handles = vec![];

    for cook_id in 1..=num_cooks {
        let b = Arc::clone(&barrier);
        handles.push(thread::spawn(move || {
            thread::sleep(Duration::from_millis(cook_id as u64 * 20));
            println!("  Cook {} finished prep", cook_id);
            b.wait();
            println!("  Cook {} starts cooking!", cook_id);
        }));
    }

    for h in handles { h.join().unwrap(); }
}

// ============================================================
// 8. PRACTICAL: PARALLEL MAP
// ============================================================

fn parallel_map<T, R, F>(data: Vec<T>, f: F) -> Vec<R>
where
    T: Send + 'static, R: Send + 'static,
    F: Fn(T) -> R + Send + Sync + 'static,
{
    let f = Arc::new(f);
    let handles: Vec<_> = data.into_iter()
        .map(|item| { let f = Arc::clone(&f); thread::spawn(move || f(item)) })
        .collect();
    handles.into_iter().map(|h| h.join().unwrap()).collect()
}

fn demonstrate_parallel_map() {
    println!("\n--- 8. Practical: Parallel Map ---");

    let orders = vec!["Masala Dosa", "Idli", "Vada", "Uttapam"];
    let prepared = parallel_map(
        orders.into_iter().map(String::from).collect(),
        |order| { thread::sleep(Duration::from_millis(10)); format!("{} (ready!)", order) },
    );
    for order in &prepared { println!("    {}", order); }

    let numbers: Vec<u64> = (1..=8).collect();
    let squares = parallel_map(numbers, |n| n * n);
    println!("  Squares: {:?}", squares);
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST CONCURRENCY: Amma's Dhaba Kitchen ===\n");

    demonstrate_spawning();
    demonstrate_join_handle();
    demonstrate_move_closures();
    demonstrate_arc_mutex();
    demonstrate_scoped_threads();
    demonstrate_thread_panic();
    demonstrate_barrier();
    demonstrate_parallel_map();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. thread::spawn creates OS threads with closures");
    println!("2. JoinHandle.join() waits and gets the return value");
    println!("3. `move` closures transfer ownership to threads");
    println!("4. Arc<Mutex<T>> = thread-safe shared mutable state");
    println!("5. Mutex::lock() returns a guard that auto-unlocks on drop");
    println!("6. thread::scope lets threads borrow from parent scope");
    println!("7. Thread panics don't crash main — caught by join()");
    println!("8. Rust prevents data races at COMPILE TIME — fearless concurrency!");
}

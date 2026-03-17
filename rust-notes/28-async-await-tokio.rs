// ============================================================
// 28. ASYNC/AWAIT AND TOKIO IN RUST
// ============================================================
// Async lets your program do useful work WHILE waiting for I/O.
// Tokio is Rust's most popular async runtime, powering Discord,
// Cloudflare, and AWS production systems.
// ============================================================

// CARGO.TOML:
// [dependencies]
// tokio = { version = "1", features = ["full"] }

// ============================================================
// STORY: SWIGGY ORDER ORCHESTRATOR
// ============================================================
// Friday night in Bangalore. One order needs to SIMULTANEOUSLY:
//   a. Validate payment (2s)    b. Check restaurant (1s)
//   c. Find delivery partner (3s)  d. Calculate ETA (0.5s)
//
// SYNC: 2+1+3+0.5 = 6.5s (too slow!)
// ASYNC: max(2,1,3,0.5) = 3s (much better!)
//
// Multiply by 10,000 orders — async handles them all without
// spawning 10,000 threads.
// ============================================================

use tokio::time::{sleep, Duration, timeout};
use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;

// ============================================================
// SECTION 1: ASYNC FN AND .AWAIT
// ============================================================
// async fn returns a Future. .await pauses and lets other tasks run.

async fn validate_payment(order_id: &str, amount: f64) -> Result<String, String> {
    println!("[Payment] Validating Rs. {:.0} for {}...", amount, order_id);
    sleep(Duration::from_millis(500)).await;
    if amount > 0.0 { Ok(format!("TXN-{}-OK", order_id)) }
    else { Err(String::from("Invalid amount")) }
}

async fn check_restaurant(restaurant: &str) -> Result<bool, String> {
    println!("[Restaurant] Checking {}...", restaurant);
    sleep(Duration::from_millis(300)).await;
    Ok(true)
}

async fn find_delivery_partner(area: &str) -> Result<String, String> {
    println!("[Delivery] Searching in {}...", area);
    sleep(Duration::from_millis(700)).await;
    Ok(format!("Raju (4.8 stars, {})", area))
}

async fn estimate_delivery_time(restaurant: &str, address: &str) -> Result<u32, String> {
    println!("[ETA] {} to {}...", restaurant, address);
    sleep(Duration::from_millis(200)).await;
    Ok(35)
}

// ============================================================
// SECTION 2: SEQUENTIAL VS CONCURRENT
// ============================================================

async fn demo_sequential() {
    println!("--- 2. Sequential ---\n");
    let start = std::time::Instant::now();

    let _p = validate_payment("ORD-001", 599.0).await;
    let _r = check_restaurant("Meghana Foods").await;
    let _d = find_delivery_partner("Koramangala").await;
    let _e = estimate_delivery_time("Meghana Foods", "HSR Layout").await;

    println!("Time: {:.1}s (sum of all waits)\n", start.elapsed().as_secs_f64());
}

// ============================================================
// SECTION 3: tokio::join! — CONCURRENT EXECUTION
// ============================================================
// Runs all futures concurrently. Time = max of all durations.

async fn demo_concurrent_join() {
    println!("--- 3. Concurrent with join! ---\n");
    let start = std::time::Instant::now();

    let (payment, restaurant, partner, eta) = tokio::join!(
        validate_payment("ORD-002", 799.0),
        check_restaurant("Empire Restaurant"),
        find_delivery_partner("Indiranagar"),
        estimate_delivery_time("Empire", "MG Road"),
    );

    println!("\nPayment: {:?}", payment);
    println!("Restaurant: {:?}", restaurant);
    println!("Partner: {:?}", partner);
    println!("ETA: {:?}", eta);
    println!("Time: {:.1}s (max, not sum!)\n", start.elapsed().as_secs_f64());
}

// ============================================================
// SECTION 4: tokio::spawn — INDEPENDENT TASKS
// ============================================================
// spawn returns JoinHandle. Task runs in background. Requires 'static data.

async fn demo_spawn() {
    println!("--- 4. Spawning Tasks ---\n");
    let start = std::time::Instant::now();

    let h1 = tokio::spawn(async {
        sleep(Duration::from_millis(400)).await;
        String::from("Order 101: Biryani confirmed")
    });
    let h2 = tokio::spawn(async {
        sleep(Duration::from_millis(400)).await;
        String::from("Order 102: Dosa confirmed")
    });

    println!("[Main] Orders dispatched, doing other work...");
    sleep(Duration::from_millis(100)).await;

    println!("{}", h1.await.expect("Task panicked"));
    println!("{}", h2.await.expect("Task panicked"));
    println!("Time: {:.1}s\n", start.elapsed().as_secs_f64());
}

// ============================================================
// SECTION 5: tokio::select! — RACING TASKS
// ============================================================
// Returns when FIRST future completes. Others are cancelled.

async fn demo_select() {
    println!("--- 5. Racing with select! ---\n");
    let start = std::time::Instant::now();

    tokio::select! {
        _ = async { sleep(Duration::from_millis(600)).await; } => {
            println!("Zone A responded first");
        }
        _ = async { sleep(Duration::from_millis(300)).await; } => {
            println!("Zone B responded first (fastest!)");
        }
        _ = async { sleep(Duration::from_millis(800)).await; } => {
            println!("Zone C responded first");
        }
    }

    println!("Time: {:.1}s\n", start.elapsed().as_secs_f64());
}

// ============================================================
// SECTION 6: TIMEOUTS
// ============================================================
// timeout() wraps any future with a deadline. Cancels on expiry.

async fn demo_timeout() {
    println!("--- 6. Timeouts ---\n");

    // Slow gateway with 2s timeout
    match timeout(Duration::from_secs(2), async {
        sleep(Duration::from_secs(5)).await;
        String::from("Payment processed")
    }).await {
        Ok(result) => println!("Success: {}", result),
        Err(_) => println!("TIMEOUT! Gateway didn't respond in 2s."),
    }

    // Fast operation
    match timeout(Duration::from_secs(2), check_restaurant("Paradise")).await {
        Ok(result) => println!("Success: {:?}", result),
        Err(_) => println!("TIMEOUT!"),
    }
    println!();
}

// ============================================================
// SECTION 7: ASYNC CHANNELS (tokio::sync::mpsc)
// ============================================================
// Bounded channel for async task communication.

#[derive(Debug)]
struct OrderNotification {
    order_id: String,
    restaurant: String,
    status: String,
}

async fn demo_channels() {
    println!("--- 7. Async Channels ---\n");

    let (tx, mut rx) = mpsc::channel::<OrderNotification>(32);

    let tx1 = tx.clone();
    tokio::spawn(async move {
        sleep(Duration::from_millis(200)).await;
        tx1.send(OrderNotification {
            order_id: "ORD-201".into(), restaurant: "Meghana Foods".into(),
            status: "Ready".into(),
        }).await.unwrap();
    });

    let tx2 = tx.clone();
    tokio::spawn(async move {
        sleep(Duration::from_millis(400)).await;
        tx2.send(OrderNotification {
            order_id: "ORD-202".into(), restaurant: "MTR".into(),
            status: "Ready".into(),
        }).await.unwrap();
    });

    drop(tx); // Close channel when all senders drop

    let mut count = 0;
    while let Some(n) = rx.recv().await {
        count += 1;
        println!("  [{}] {} from {} -> {}", count, n.order_id, n.restaurant, n.status);
    }
    println!("Total: {}\n", count);
}

// ============================================================
// SECTION 8: ASYNC MUTEX
// ============================================================
// Arc<Mutex<T>> for shared state across tasks.
// tokio::sync::Mutex doesn't block the thread.

async fn demo_async_mutex() {
    println!("--- 8. Async Mutex ---\n");

    let order_count = Arc::new(Mutex::new(0u32));
    let total_revenue = Arc::new(Mutex::new(0.0f64));
    let mut handles = vec![];

    for (id, amount) in [("ORD-301", 350.0), ("ORD-302", 450.0), ("ORD-303", 200.0)] {
        let count = Arc::clone(&order_count);
        let revenue = Arc::clone(&total_revenue);
        handles.push(tokio::spawn(async move {
            sleep(Duration::from_millis(100)).await;
            *count.lock().await += 1;
            *revenue.lock().await += amount;
            println!("  [{}] Processed Rs. {:.0}", id, amount);
        }));
    }

    for h in handles { h.await.unwrap(); }
    println!("\nFinal: {} orders, Rs. {:.0}\n",
        *order_count.lock().await, *total_revenue.lock().await);
}

// ============================================================
// SECTION 9: CONCURRENT API CALLS PATTERN
// ============================================================

async fn demo_concurrent_api_calls() {
    println!("--- 9. Concurrent API Calls ---\n");
    let start = std::time::Instant::now();

    let restaurants = vec![("Meghana", 300u64), ("Empire", 500), ("MTR", 200)];
    let mut handles = vec![];

    for (name, delay) in restaurants {
        let name = name.to_string();
        handles.push(tokio::spawn(async move {
            println!("  Fetching {}...", name);
            sleep(Duration::from_millis(delay)).await;
            format!("{} - Thali Rs.250, Biryani Rs.350", name)
        }));
    }

    for h in handles {
        match h.await {
            Ok(menu) => println!("  {}", menu),
            Err(e) => println!("  Error: {}", e),
        }
    }
    println!("Time: {:.1}s (concurrent)\n", start.elapsed().as_secs_f64());
}

// ============================================================
// SECTION 10: TIMEOUT WITH FALLBACK
// ============================================================

async fn demo_timeout_with_fallback() {
    println!("--- 10. Timeout with Fallback ---\n");

    let restaurant = "Meghana Foods";
    let eta = match timeout(Duration::from_millis(500), async {
        sleep(Duration::from_millis(800)).await;
        35u32
    }).await {
        Ok(live) => { println!("Live ETA: {} min", live); live }
        Err(_) => { let cached = 40; println!("Timed out! Cached ETA: {} min", cached); cached }
    };

    println!("Showing user: ~{} minutes\n", eta);
}

// ============================================================
// MAIN
// ============================================================

#[tokio::main]
async fn main() {
    println!("=== Async/Await and Tokio ===\n");

    println!("--- 1. Basic Async ---\n");
    let p = validate_payment("ORD-000", 499.0).await;
    println!("Result: {:?}\n", p);

    demo_sequential().await;
    demo_concurrent_join().await;
    demo_spawn().await;
    demo_select().await;
    demo_timeout().await;
    demo_channels().await;
    demo_async_mutex().await;
    demo_concurrent_api_calls().await;
    demo_timeout_with_fallback().await;

    println!("=== Async/Await Complete ===");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. async fn returns a Future — lazy, does nothing until .awaited.
// 2. .await pauses the task, lets others run. Cooperative multitasking.
// 3. #[tokio::main] sets up the runtime (event loop, scheduler).
// 4. join! = run concurrently, wait for ALL. Time = max.
// 5. spawn = independent background task. Requires 'static data.
// 6. select! = race futures, first wins, others cancelled.
// 7. timeout() wraps a future with a deadline. Cancels on expiry.
// 8. mpsc channels for async task communication. Closes when
//    all senders drop.
// 9. tokio::sync::Mutex for shared state — doesn't block threads.
// ============================================================

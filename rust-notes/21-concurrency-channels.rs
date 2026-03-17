// ============================================================
// FILE 21: CONCURRENCY WITH CHANNELS — Message Passing
// ============================================================
// Channels let threads communicate by SENDING messages instead
// of sharing memory. Follows the Go proverb: "Share memory by
// communicating."
// ============================================================

// ============================================================
// STORY: Dabbawala Relay Network
// ============================================================
// Mumbai's dabbawala system maps perfectly to channels:
//
// SENDER (tx) = Housewife hands dabba to the dabbawala
// CHANNEL = The railway network + sorting system
// RECEIVER (rx) = Office worker picks up dabba (blocks until arrival)
// MPSC = Multiple housewives send through one network,
//        one collection point per office
//
// When all senders drop, the channel closes.
// ============================================================

use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use std::sync::{Arc, Mutex};

// ============================================================
// SECTION 1: BASIC CHANNEL — Send and Receive
// ============================================================
// mpsc::channel() creates an unbounded sender/receiver pair.
// tx.send() is non-blocking, rx.recv() blocks until a message arrives.

fn demonstrate_basic_channel() {
    println!("--- 1. Basic Channel ---");

    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let dabba = String::from("Rajma Chawal from Andheri");
        println!("  [Sender] Sending: {}", dabba);
        tx.send(dabba).unwrap(); // send() takes ownership — dabba is moved
    });

    let received = rx.recv().unwrap();
    println!("  [Receiver] Got: {}", received);
}

// ============================================================
// SECTION 2: SENDING MULTIPLE MESSAGES
// ============================================================
// rx acts as an iterator, yielding messages until the channel closes.

fn demonstrate_multiple_messages() {
    println!("\n--- 2. Multiple Messages ---");

    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let dabbas = vec![
            String::from("Poha from Dadar"),
            String::from("Upma from Matunga"),
            String::from("Idli from Sion"),
        ];
        for dabba in dabbas {
            tx.send(dabba).unwrap();
            thread::sleep(Duration::from_millis(30));
        }
    });

    for dabba in rx {
        println!("  [Receiver] Delivered: {}", dabba);
    }
    println!("  Channel closed — all senders dropped");
}

// ============================================================
// SECTION 3: MULTIPLE PRODUCERS (MPSC)
// ============================================================
// Clone the sender so each producer has its own handle.

fn demonstrate_multiple_producers() {
    println!("\n--- 3. Multiple Producers (MPSC) ---");

    let (tx, rx) = mpsc::channel();

    let tx_andheri = tx.clone();
    thread::spawn(move || {
        for dabba in ["Thali-A1", "Thali-A2"] {
            tx_andheri.send(format!("[Andheri] {}", dabba)).unwrap();
            thread::sleep(Duration::from_millis(20));
        }
    });

    let tx_dadar = tx; // Last one — no clone needed
    thread::spawn(move || {
        for dabba in ["Tiffin-D1", "Tiffin-D2", "Tiffin-D3"] {
            tx_dadar.send(format!("[Dadar] {}", dabba)).unwrap();
            thread::sleep(Duration::from_millis(15));
        }
    });

    let mut count = 0;
    for dabba in rx {
        count += 1;
        println!("  Office received #{}: {}", count, dabba);
    }
    println!("  Total dabbas received: {}", count);
}

// ============================================================
// SECTION 4: SYNC CHANNEL — Bounded Buffer
// ============================================================
// sync_channel(n) blocks send() when buffer is full,
// creating backpressure against fast producers.

fn demonstrate_sync_channel() {
    println!("\n--- 4. Sync Channel (Bounded) ---");

    let (tx, rx) = mpsc::sync_channel(2);

    thread::spawn(move || {
        for i in 1..=5 {
            println!("  [Producer] Sending dabba {}...", i);
            tx.send(format!("Dabba-{}", i)).unwrap();
            println!("  [Producer] Dabba {} sent!", i);
        }
    });

    thread::sleep(Duration::from_millis(100));
    for dabba in rx {
        println!("  [Consumer] Processing: {}", dabba);
        thread::sleep(Duration::from_millis(50));
    }
}

// ============================================================
// SECTION 5: NON-BLOCKING OPERATIONS
// ============================================================
// try_recv() returns immediately. recv_timeout() blocks for a limited time.

fn demonstrate_non_blocking() {
    println!("\n--- 5. Non-Blocking Operations ---");

    let (tx, rx) = mpsc::channel();
    tx.send("First dabba").unwrap();

    match rx.try_recv() {
        Ok(msg) => println!("  Got: {}", msg),
        Err(mpsc::TryRecvError::Empty) => println!("  No message yet"),
        Err(mpsc::TryRecvError::Disconnected) => println!("  Channel closed"),
    }

    match rx.try_recv() {
        Ok(msg) => println!("  Got: {}", msg),
        Err(mpsc::TryRecvError::Empty) => println!("  Channel empty"),
        Err(mpsc::TryRecvError::Disconnected) => println!("  Channel closed"),
    }

    drop(tx);

    let (tx2, rx2) = mpsc::channel::<String>();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(100));
        let _ = tx2.send(String::from("Delayed dabba"));
    });

    match rx2.recv_timeout(Duration::from_millis(50)) {
        Ok(msg) => println!("  Got: {}", msg),
        Err(mpsc::RecvTimeoutError::Timeout) => println!("  Timed out after 50ms"),
        Err(mpsc::RecvTimeoutError::Disconnected) => println!("  Channel closed"),
    }

    match rx2.recv_timeout(Duration::from_millis(200)) {
        Ok(msg) => println!("  Got: {}", msg),
        Err(_) => println!("  Still nothing"),
    }
}

// ============================================================
// SECTION 6: SENDING CUSTOM TYPES
// ============================================================
// Channels can send any type that implements Send.

#[derive(Debug)]
struct Dabba {
    id: u32,
    from: String,
    to: String,
    contents: String,
    weight_grams: u32,
}

impl Dabba {
    fn new(id: u32, from: &str, to: &str, contents: &str, weight: u32) -> Self {
        Dabba {
            id,
            from: String::from(from),
            to: String::from(to),
            contents: String::from(contents),
            weight_grams: weight,
        }
    }
}

impl std::fmt::Display for Dabba {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Dabba#{} [{}->{}] {} ({}g)",
            self.id, self.from, self.to, self.contents, self.weight_grams)
    }
}

fn demonstrate_custom_types() {
    println!("\n--- 6. Sending Custom Types ---");

    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let dabbas = vec![
            Dabba::new(1, "Andheri", "Nariman Point", "Dal Rice", 500),
            Dabba::new(2, "Borivali", "BKC", "Chole Chawal", 600),
            Dabba::new(3, "Thane", "Fort", "Sabzi Roti", 450),
        ];
        for dabba in dabbas {
            tx.send(dabba).unwrap();
        }
    });

    let mut total_weight = 0;
    for dabba in rx {
        total_weight += dabba.weight_grams;
        println!("  [Deliver] {}", dabba);
    }
    println!("  Total weight carried: {}g", total_weight);
}

// ============================================================
// SECTION 7: TASK PIPELINE — Multi-Stage Processing
// ============================================================
// Chain channels for processing pipelines: collect -> sort -> deliver.

fn demonstrate_pipeline() {
    println!("\n--- 7. Task Pipeline ---");

    let (collect_tx, sort_rx) = mpsc::channel();
    let (sort_tx, deliver_rx) = mpsc::channel();

    // Stage 1: Collection
    thread::spawn(move || {
        let sources = vec![("Andheri", "Rajma"), ("Bandra", "Biryani"), ("Dadar", "Thali")];
        for (i, (area, food)) in sources.iter().enumerate() {
            let dabba = format!("D{:03}|{}|{}", i + 1, area, food);
            collect_tx.send(dabba).unwrap();
        }
    });

    // Stage 2: Sorting
    thread::spawn(move || {
        for dabba in sort_rx {
            let sorted = format!("{} -> SORTED", dabba);
            sort_tx.send(sorted).unwrap();
        }
    });

    // Stage 3: Delivery
    let mut delivered = 0;
    for dabba in deliver_rx {
        delivered += 1;
        println!("  [Deliver] {} -> DONE", dabba);
    }
    println!("  Pipeline complete! {} dabbas delivered", delivered);
}

// ============================================================
// SECTION 8: FAN-OUT — One Producer, Multiple Workers
// ============================================================
// Distribute work round-robin to worker threads.

fn demonstrate_fan_out() {
    println!("\n--- 8. Fan-Out Pattern ---");

    let num_workers = 3;
    let mut worker_txs: Vec<mpsc::Sender<String>> = Vec::new();
    let mut handles = Vec::new();
    let (result_tx, result_rx) = mpsc::channel();

    for worker_id in 0..num_workers {
        let (tx, rx) = mpsc::channel::<String>();
        worker_txs.push(tx);
        let result_tx = result_tx.clone();
        let handle = thread::spawn(move || {
            for task in rx {
                let result = format!("Worker-{} processed '{}'", worker_id + 1, task.to_uppercase());
                thread::sleep(Duration::from_millis(20));
                result_tx.send(result).unwrap();
            }
        });
        handles.push(handle);
    }

    let tasks = vec!["wash rice", "chop onions", "heat oil", "fry spices", "boil water", "serve food"];
    for (i, task) in tasks.iter().enumerate() {
        worker_txs[i % num_workers].send(String::from(*task)).unwrap();
    }

    drop(worker_txs);
    drop(result_tx);

    let mut results: Vec<String> = result_rx.into_iter().collect();
    results.sort();

    for handle in handles {
        handle.join().unwrap();
    }

    println!("  Results ({} total):", results.len());
    for result in &results {
        println!("    {}", result);
    }
}

// ============================================================
// SECTION 9: PRACTICAL — Concurrent Log Aggregator
// ============================================================

fn demonstrate_log_aggregator() {
    println!("\n--- 9. Practical: Log Aggregator ---");

    #[derive(Debug)]
    enum LogLevel { Info, Warning, Error }

    struct LogEntry {
        source: String,
        level: LogLevel,
        message: String,
    }

    impl std::fmt::Display for LogEntry {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            let level_str = match self.level {
                LogLevel::Info => "INFO",
                LogLevel::Warning => "WARN",
                LogLevel::Error => "ERROR",
            };
            write!(f, "[{}] {}: {}", level_str, self.source, self.message)
        }
    }

    let (tx, rx) = mpsc::channel::<LogEntry>();
    let stats = Arc::new(Mutex::new((0u32, 0u32, 0u32)));

    let tx1 = tx.clone();
    thread::spawn(move || {
        for (level, msg) in [(LogLevel::Info, "GET /menu"), (LogLevel::Warning, "Slow query: 2.5s")] {
            tx1.send(LogEntry { source: String::from("WebServer"), level, message: String::from(msg) }).unwrap();
        }
    });

    let tx2 = tx.clone();
    thread::spawn(move || {
        for (level, msg) in [(LogLevel::Info, "Pool: 5/10 active"), (LogLevel::Error, "Query failed")] {
            tx2.send(LogEntry { source: String::from("Database"), level, message: String::from(msg) }).unwrap();
        }
    });

    let tx3 = tx;
    thread::spawn(move || {
        for (level, msg) in [(LogLevel::Info, "Payment Rs.500"), (LogLevel::Error, "Gateway timeout")] {
            tx3.send(LogEntry { source: String::from("Payment"), level, message: String::from(msg) }).unwrap();
        }
    });

    let stats_clone = Arc::clone(&stats);
    for entry in rx {
        println!("  {}", entry);
        let mut s = stats_clone.lock().unwrap();
        match entry.level {
            LogLevel::Info => s.0 += 1,
            LogLevel::Warning => s.1 += 1,
            LogLevel::Error => s.2 += 1,
        }
    }

    let final_stats = stats.lock().unwrap();
    println!("\n  Log Summary: {} info, {} warnings, {} errors",
        final_stats.0, final_stats.1, final_stats.2);
}

// ============================================================
// MAIN
// ============================================================
fn main() {
    println!("=== RUST CHANNELS: Dabbawala Relay Network ===\n");

    demonstrate_basic_channel();
    demonstrate_multiple_messages();
    demonstrate_multiple_producers();
    demonstrate_sync_channel();
    demonstrate_non_blocking();
    demonstrate_custom_types();
    demonstrate_pipeline();
    demonstrate_fan_out();
    demonstrate_log_aggregator();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===");
    println!("1. mpsc::channel() creates unbounded sender/receiver pair");
    println!("2. send() transfers ownership — data moves into channel");
    println!("3. recv() blocks, try_recv() returns immediately");
    println!("4. tx.clone() creates multiple producers (MPSC pattern)");
    println!("5. Channel closes when ALL senders are dropped");
    println!("6. sync_channel(n) creates bounded channel with backpressure");
    println!("7. Receiver implements Iterator — use in for loops");
    println!("8. Chain channels for processing pipelines");
    println!("9. Channels > shared memory for most concurrent patterns");
}

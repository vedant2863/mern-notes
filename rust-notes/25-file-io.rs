// ============================================================
// 25. FILE I/O IN RUST
// ============================================================
// Rust's file I/O is safe, efficient, and explicit about errors.
// Every possible failure must be handled — no silent failures.
// ============================================================

// ============================================================
// STORY: INDIA POST SORTING ROOM
// ============================================================
// RECEIVING = Reading files (open bag, take out letters)
// SORTING = Path/PathBuf (address hierarchy like state/pin/name)
// STAMPING = Writing files (fresh stamp or additional stamp)
// DISPATCHING = copy, rename, delete
// CHECKING = metadata (exists? size? modified when?)
// ============================================================

use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

// ============================================================
// SECTION 1: READING FILES
// ============================================================

fn demo_read_to_string() {
    println!("--- 1. Reading Files ---\n");

    let file_path = "/tmp/rust_demo_letter.txt";
    let content = "Sender: Rahul Sharma, Delhi\nReceiver: Priya Patel, Mumbai\nSubject: Wedding Invitation";
    fs::write(file_path, content).expect("Failed to create file");

    // fs::read_to_string — simplest, loads entire file
    match fs::read_to_string(file_path) {
        Ok(text) => println!("Contents ({} bytes):\n{}", text.len(), text),
        Err(e) => eprintln!("Error: {}", e),
    }

    // File::open + read_to_string — more control
    let mut file = File::open(file_path).expect("Cannot open");
    let mut contents = String::new();
    file.read_to_string(&mut contents).expect("Cannot read");
    println!("\nRead {} bytes via File::open", contents.len());

    // fs::read — returns Vec<u8> for binary files
    let bytes = fs::read(file_path).expect("Cannot read bytes");
    println!("File has {} bytes", bytes.len());
}

// ============================================================
// SECTION 2: BUFFERED READING — Line by Line
// ============================================================
// BufReader for large files — reads in chunks, processes one line at a time.

fn demo_buffered_reading() {
    println!("\n--- 2. Buffered Reading ---\n");

    let file_path = "/tmp/rust_demo_post_offices.csv";
    let data = "PIN,Office,State,Region\n110001,New Delhi GPO,Delhi,Central\n400001,Mumbai GPO,Maharashtra,Western\n600001,Chennai GPO,Tamil Nadu,Southern";
    fs::write(file_path, data).expect("Cannot write");

    let file = File::open(file_path).expect("Cannot open");
    let reader = BufReader::new(file);

    let mut southern = 0;
    for (i, line_result) in reader.lines().enumerate() {
        match line_result {
            Ok(line) => {
                if i == 0 { println!("Header: {}", line); continue; }
                let fields: Vec<&str> = line.split(',').collect();
                if fields.len() == 4 {
                    println!("  PIN: {}, Office: {}", fields[0], fields[1]);
                    if fields[3] == "Southern" { southern += 1; }
                }
            }
            Err(e) => eprintln!("Error line {}: {}", i, e),
        }
    }
    println!("Southern offices: {}", southern);
}

// ============================================================
// SECTION 3: WRITING FILES
// ============================================================

fn demo_writing_files() {
    println!("\n--- 3. Writing Files ---\n");

    // fs::write — simplest, creates or overwrites
    let report_path = "/tmp/rust_demo_report.txt";
    fs::write(report_path, "Delivery Report\nItems: 1247\nSuccess Rate: 93.8%\n").expect("Cannot write");
    println!("Written report to: {}", report_path);

    // File::create + writeln! — incremental writing
    let log_path = "/tmp/rust_demo_log.txt";
    let mut file = File::create(log_path).expect("Cannot create");
    writeln!(file, "=== Sorting Log ===").unwrap();
    for (id, from, to) in [("PKG-001", "Delhi", "Mumbai"), ("LTR-042", "Chennai", "Bangalore")] {
        writeln!(file, "[{}] {} -> {}", id, from, to).unwrap();
    }

    // BufWriter — efficient for many small writes
    let stats_path = "/tmp/rust_demo_stats.csv";
    let file = File::create(stats_path).expect("Cannot create");
    let mut writer = BufWriter::new(file);
    writeln!(writer, "Month,Letters,Revenue").unwrap();
    for (month, letters, rev) in [("Jan", 15000, 450000), ("Feb", 12000, 380000)] {
        writeln!(writer, "{},{},{}", month, letters, rev).unwrap();
    }
    writer.flush().expect("flush failed");
    println!("Written stats to: {}", stats_path);
}

// ============================================================
// SECTION 4: APPENDING TO FILES
// ============================================================
// OpenOptions gives fine-grained control: append, create, read, write.

fn demo_appending() {
    println!("\n--- 4. Appending ---\n");

    let log_path = "/tmp/rust_demo_audit.log";
    fs::write(log_path, "=== Audit Log ===\n").expect("Cannot create");

    let mut file = OpenOptions::new()
        .append(true)
        .open(log_path)
        .expect("Cannot open for appending");

    for entry in ["09:15 - Mail received (42 items)", "09:22 - Sorting started", "10:00 - Batch dispatched"] {
        writeln!(file, "{}", entry).expect("Cannot append");
    }

    println!("{}", fs::read_to_string(log_path).unwrap());
}

// ============================================================
// SECTION 5: PATH AND PATHBUF
// ============================================================
// Path (borrowed, like &str) and PathBuf (owned, like String).

fn demo_paths() {
    println!("--- 5. Paths ---\n");

    let mut route = PathBuf::from("/india_post");
    route.push("delhi");
    route.push("central_hub");
    println!("Route: {}", route.display());

    let file_path = Path::new("/home/postmaster/reports/daily.pdf");
    println!("File name:  {:?}", file_path.file_name());
    println!("Extension:  {:?}", file_path.extension());
    println!("Parent:     {:?}", file_path.parent());
    println!("Absolute:   {}", file_path.is_absolute());

    let joined = Path::new("/india_post").join("delhi").join("letter.txt");
    println!("Joined: {}", joined.display());
}

// ============================================================
// SECTION 6: FILE EXISTENCE AND METADATA
// ============================================================

fn demo_file_checks() {
    println!("\n--- 6. File Checks ---\n");

    let existing = "/tmp/rust_demo_letter.txt";
    println!("'{}' exists: {}", existing, Path::new(existing).exists());
    println!("Is file: {}", Path::new(existing).is_file());

    match fs::metadata(existing) {
        Ok(meta) => {
            println!("Size: {} bytes", meta.len());
            println!("Readonly: {}", meta.permissions().readonly());
        }
        Err(e) => eprintln!("Cannot get metadata: {}", e),
    }
}

// ============================================================
// SECTION 7: DIRECTORY OPERATIONS
// ============================================================

fn demo_directories() {
    println!("\n--- 7. Directories ---\n");

    let nested = "/tmp/rust_demo_mailroom/delhi/zone_a";
    fs::create_dir_all(nested).expect("Cannot create");
    println!("Created: {}", nested);

    fs::write(format!("{}/tracking.txt", nested), "PKG-001: In Transit\n").expect("Cannot write");
    println!("Created tracking file");

    fs::remove_dir_all("/tmp/rust_demo_mailroom").expect("Cannot remove");
    println!("Removed directory tree");
}

// ============================================================
// SECTION 8: COPY, RENAME, DELETE
// ============================================================

fn demo_file_operations() {
    println!("\n--- 8. Copy, Rename, Delete ---\n");

    let original = "/tmp/rust_demo_original.txt";
    let copy_path = "/tmp/rust_demo_copy.txt";
    let renamed = "/tmp/rust_demo_renamed.txt";

    fs::write(original, "Important notice from GPO").expect("Cannot write");

    match fs::copy(original, copy_path) {
        Ok(bytes) => println!("Copied {} bytes", bytes),
        Err(e) => eprintln!("Copy failed: {}", e),
    }

    fs::rename(copy_path, renamed).expect("Rename failed");
    println!("Renamed to: {}", renamed);
    println!("Copy exists: {}", Path::new(copy_path).exists());

    fs::remove_file(renamed).expect("Delete failed");
    println!("Deleted: {}", renamed);
}

// ============================================================
// SECTION 9: DIRECTORY ITERATION
// ============================================================

fn demo_directory_iteration() {
    println!("\n--- 9. Directory Iteration ---\n");

    let dir = "/tmp/rust_demo_sorting";
    fs::create_dir_all(dir).expect("Cannot create");

    for (name, content) in [("letter_001.txt", "From Delhi"), ("parcel_002.txt", "For Mumbai")] {
        fs::write(format!("{}/{}", dir, name), content).expect("Cannot write");
    }
    fs::create_dir_all(format!("{}/outbox", dir)).expect("Cannot create");

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let ft = entry.file_type().expect("Cannot get type");
            let name = entry.file_name();
            if ft.is_file() { println!("  [FILE] {:?}", name); }
            else if ft.is_dir() { println!("  [DIR]  {:?}/", name); }
        }
    }

    fs::remove_dir_all(dir).expect("Cannot clean up");
}

// ============================================================
// SECTION 10: PRACTICAL — Log File Processor
// ============================================================

fn demo_practical_example() {
    println!("\n--- 10. Log Processor ---\n");

    let log_dir = "/tmp/rust_demo_post_logs";
    fs::create_dir_all(log_dir).expect("Cannot create");

    fs::write(format!("{}/north.log", log_dir),
        "DELIVERED PKG-101 Delhi\nFAILED PKG-102 Lucknow\nDELIVERED PKG-103 Jaipur\n").unwrap();
    fs::write(format!("{}/south.log", log_dir),
        "DELIVERED PKG-201 Chennai\nFAILED PKG-203 Hyderabad\nDELIVERED PKG-204 Kochi\n").unwrap();

    let mut delivered = 0u32;
    let mut failed = 0u32;
    let mut failed_items: Vec<String> = Vec::new();

    if let Ok(entries) = fs::read_dir(log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "log") {
                let reader = BufReader::new(File::open(&path).unwrap());
                for line in reader.lines().flatten() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        match parts[0] {
                            "DELIVERED" => delivered += 1,
                            "FAILED" => { failed += 1; failed_items.push(format!("{} ({})", parts[1], parts[2])); }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    let total = delivered + failed;
    let rate = if total > 0 { (delivered as f64 / total as f64) * 100.0 } else { 0.0 };
    println!("Delivered: {}, Failed: {}, Rate: {:.1}%", delivered, failed, rate);
    for item in &failed_items { println!("  Failed: {}", item); }

    fs::remove_dir_all(log_dir).expect("Cannot clean up");
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    println!("=== Rust File I/O ===\n");

    demo_read_to_string();
    demo_buffered_reading();
    demo_writing_files();
    demo_appending();
    demo_paths();
    demo_file_checks();
    demo_directories();
    demo_file_operations();
    demo_directory_iteration();
    demo_practical_example();

    for path in ["/tmp/rust_demo_letter.txt", "/tmp/rust_demo_post_offices.csv",
                 "/tmp/rust_demo_report.txt", "/tmp/rust_demo_log.txt",
                 "/tmp/rust_demo_stats.csv", "/tmp/rust_demo_audit.log",
                 "/tmp/rust_demo_original.txt"] {
        let _ = fs::remove_file(path);
    }
    println!("\n=== File I/O Complete ===");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. fs::read_to_string() for small files. BufReader for large.
// 2. fs::write() for simple writes. BufWriter for many small writes.
// 3. OpenOptions for append, create, truncate control.
// 4. Path (borrowed) / PathBuf (owned) handle OS-specific paths.
// 5. fs::create_dir_all() = mkdir -p, fs::remove_dir_all() = rm -rf.
// 6. fs::copy(), fs::rename(), fs::remove_file() — all return Result.
// 7. fs::read_dir() iterates entries. Use .flatten() for convenience.
// 8. All file ops return Result — Rust forces explicit error handling.
// ============================================================

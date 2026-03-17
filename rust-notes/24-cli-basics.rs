// ============================================================
// 24. CLI BASICS IN RUST
// ============================================================
// Rust produces fast, small, self-contained binaries — perfect
// for CLI tools. Many popular tools (ripgrep, fd, bat) are Rust.
// ============================================================

// ============================================================
// STORY: THE RAILWAY ENQUIRY COUNTER
// ============================================================
// A traveller asks: "When does the Rajdhani leave?"
// The CLERK (your program):
// 1. READS the question (args or stdin)
// 2. LOOKS UP the answer (processes data)
// 3. RESPONDS clearly (stdout)
// 4. Invalid query? Says so (stderr + exit code)
// The station BOARD = environment variables
// ============================================================

use std::collections::HashMap;
use std::io::{self, BufRead, Write};

// ============================================================
// SECTION 1: READING COMMAND LINE ARGUMENTS
// ============================================================

fn demo_basic_args() {
    println!("--- 1. Command Line Arguments ---\n");

    let args: Vec<String> = std::env::args().collect();
    println!("Program: {}", args[0]);
    println!("Total args: {}", args.len());

    if args.len() > 1 {
        for (i, arg) in args.iter().enumerate().skip(1) {
            println!("  [{}]: {}", i, arg);
        }
    } else {
        println!("No args. Try: cargo run -- hello world");
    }
}

// ============================================================
// SECTION 2: PARSING ARGUMENTS MANUALLY
// ============================================================
// For simple tools, manual parsing works. For complex CLIs, use clap.

fn demo_manual_parsing() {
    println!("\n--- 2. Manual Argument Parsing ---\n");

    let args: Vec<String> = std::env::args().collect();
    let mut train = String::from("Unknown");
    let mut from = String::from("Unknown");
    let mut verbose = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--train" | "-t" if i + 1 < args.len() => { train = args[i + 1].clone(); i += 2; }
            "--from" | "-f" if i + 1 < args.len() => { from = args[i + 1].clone(); i += 2; }
            "--verbose" | "-v" => { verbose = true; i += 1; }
            "--help" | "-h" => {
                println!("Usage: railway_enquiry [OPTIONS]");
                println!("  -t, --train <NAME>   Train name");
                println!("  -f, --from <CITY>    Departure city");
                println!("  -v, --verbose        Detailed info");
                return;
            }
            other => { eprintln!("Warning: Unknown arg '{}'", other); i += 1; }
        }
    }

    println!("Query: {} from {}", train, from);
    if verbose { println!("Verbose mode: ON"); }
}

// ============================================================
// SECTION 3: READING FROM STDIN
// ============================================================
// read_line for single input, stdin.lock().lines() for multi-line.

fn demo_stdin_reading() {
    println!("\n--- 3. Reading from STDIN ---\n");

    println!("Enter your name:");
    let mut name = String::new();
    match io::stdin().read_line(&mut name) {
        Ok(bytes) => println!("Hello, {}! ({} bytes)", name.trim(), bytes),
        Err(e) => eprintln!("Error: {}", e),
    }

    println!("\nEnter stations (empty line to stop):");
    let stdin = io::stdin();
    let mut stations: Vec<String> = Vec::new();

    for line in stdin.lock().lines() {
        match line {
            Ok(s) if s.is_empty() => break,
            Ok(s) => stations.push(s),
            Err(e) => { eprintln!("Error: {}", e); break; }
        }
    }

    println!("\nStations ({}):", stations.len());
    for (i, s) in stations.iter().enumerate() {
        println!("  {}. {}", i + 1, s);
    }
}

// ============================================================
// SECTION 4: STDOUT AND STDERR
// ============================================================
// stdout = data output, stderr = errors/diagnostics.
// Lock stdout for performance in loops.

fn demo_stdout_stderr() {
    println!("\n--- 4. STDOUT and STDERR ---\n");

    println!("Normal output (STDOUT)");
    eprintln!("Error output (STDERR)");

    let stdout = io::stdout();
    let mut handle = stdout.lock();
    writeln!(handle, "Fast output (locked handle)").unwrap();
    handle.flush().unwrap();

    let train = "Rajdhani Express";
    println!("\n{:=<40}", "");
    println!("  {:20} Platform {}", train, 3);
    println!("{:=<40}", "");
}

// ============================================================
// SECTION 5: BUILDING A REPL
// ============================================================
// REPL = Read-Eval-Print Loop. Pattern: prompt -> read -> parse -> execute.

fn demo_repl() {
    println!("\n--- 5. Railway Enquiry REPL ---\n");

    let mut schedule: HashMap<String, (String, String, String)> = HashMap::new();
    schedule.insert("rajdhani".into(), ("New Delhi".into(), "Mumbai Central".into(), "16:55".into()));
    schedule.insert("shatabdi".into(), ("New Delhi".into(), "Bhopal".into(), "06:15".into()));
    schedule.insert("vande bharat".into(), ("New Delhi".into(), "Varanasi".into(), "06:00".into()));

    println!("Commands: search <train>, list, help, quit\n");

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout_handle = stdout.lock();

    loop {
        write!(stdout_handle, "enquiry> ").unwrap();
        stdout_handle.flush().unwrap();

        let mut input = String::new();
        match stdin.lock().read_line(&mut input) {
            Ok(0) => { println!("\nGoodbye!"); break; }
            Ok(_) => {
                let input = input.trim().to_lowercase();
                let parts: Vec<&str> = input.splitn(2, ' ').collect();

                match parts[0] {
                    "quit" | "q" => { println!("Goodbye!"); break; }
                    "list" => {
                        for (name, (from, to, time)) in &schedule {
                            println!("  {:<15} {} -> {} at {}", name, from, to, time);
                        }
                    }
                    "search" | "s" if parts.len() >= 2 => {
                        let query = parts[1];
                        let found: Vec<_> = schedule.iter()
                            .filter(|(n, _)| n.contains(query)).collect();
                        if found.is_empty() { println!("No trains matching '{}'", query); }
                        for (name, (from, to, time)) in found {
                            println!("  {} | {} -> {} | {}", name, from, to, time);
                        }
                    }
                    "" => continue,
                    other => eprintln!("Unknown: '{}'. Type 'help'.", other),
                }
            }
            Err(e) => { eprintln!("Error: {}", e); break; }
        }
    }
}

// ============================================================
// SECTION 6: EXIT CODES AND ENVIRONMENT VARIABLES
// ============================================================

fn demo_exit_codes() {
    println!("\n--- 6. Exit Codes ---\n");
    println!("  0 = Success, 1 = Error, 2 = Invalid args, 130 = Ctrl+C");
    println!("  Idiomatic: return Result from main() instead of process::exit()");
}

fn demo_env_vars() {
    println!("\n--- 7. Environment Variables ---\n");

    match std::env::var("HOME") {
        Ok(home) => println!("HOME: {}", home),
        Err(e) => println!("HOME not set: {}", e),
    }

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| String::from("postgresql://localhost/railway_db"));
    println!("Database URL: {}", db_url);

    println!("\nFirst 3 env vars:");
    for (i, (key, value)) in std::env::vars().enumerate() {
        if i >= 3 { println!("  ..."); break; }
        let v = if value.len() > 50 { format!("{}...", &value[..50]) } else { value };
        println!("  {} = {}", key, v);
    }
}

// ============================================================
// SECTION 8: MINI CLI TOOL — Unit Converter
// ============================================================

fn mini_tool() {
    println!("\n--- 8. Mini CLI Tool: Unit Converter ---\n");

    let args: Vec<String> = std::env::args().collect();
    let (value_str, target_unit) = if args.len() >= 2 {
        let unit = if args.len() >= 4 && args[2] == "--to" { args[3].clone() }
                   else { String::from("miles") };
        (args[1].clone(), unit)
    } else {
        (String::from("1384"), String::from("miles"))
    };

    let km: f64 = match value_str.parse() {
        Ok(v) => v,
        Err(e) => { eprintln!("Error: '{}' not a number: {}", value_str, e); return; }
    };

    let (result, label) = match target_unit.as_str() {
        "miles" | "mi" => (km * 0.621371, "miles"),
        "meters" | "m" => (km * 1000.0, "meters"),
        "feet" | "ft" => (km * 3280.84, "feet"),
        unknown => { eprintln!("Unknown unit '{}'. Use: miles, meters, feet", unknown); return; }
    };

    println!("{:.1} km = {:.1} {}", km, result, label);
    println!("\nAll conversions for {:.1} km:", km);
    println!("  {:<10} {:.1}", "Miles:", km * 0.621371);
    println!("  {:<10} {:.0}", "Meters:", km * 1000.0);
    println!("  {:<10} {:.0}", "Feet:", km * 3280.84);
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    println!("=== Rust CLI Basics ===\n");

    demo_basic_args();
    demo_manual_parsing();
    demo_stdout_stderr();
    demo_exit_codes();
    demo_env_vars();
    mini_tool();

    // Uncomment for interactive demos:
    // demo_stdin_reading();
    // demo_repl();

    println!("\n=== CLI Basics Complete ===");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. std::env::args() returns command line args as Strings.
// 2. For complex CLIs use clap. Manual parsing with match is
//    fine for simple tools.
// 3. stdin: read_line() for single, lock().lines() for multi.
// 4. println! (stdout), eprintln! (stderr). Lock for performance.
// 5. REPL: loop { prompt -> read -> parse -> execute }.
// 6. Prefer returning Result from main() over process::exit().
// 7. std::env::var("KEY") reads env vars. unwrap_or for defaults.
// 8. Separate stdout (data) from stderr (errors) so users can
//    redirect independently: ./app > out.txt 2> err.txt
// ============================================================

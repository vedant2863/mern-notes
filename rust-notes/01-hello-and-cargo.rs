// ============================================================
//  FILE 1 : Hello World & Cargo
// ============================================================
//  Topic  : Hello World, println!, cargo, comments, main fn,
//           rustc, formatting
// ============================================================

// ============================================================
// STORY: Ramesh bhaiya ran a chai tapri for 20 years on pen and
// paper. Going digital means: set up the stall (cargo new),
// write the menu (main.rs), shout "Tapri is open!" (println!).
// ============================================================

// ============================================================
// HOW TO RUN
// ============================================================
//   rustc 01-hello-and-cargo.rs && ./01-hello-and-cargo
//   — OR in a project —
//   cargo new my_tapri && cd my_tapri && cargo run
//
// Install Rust: https://rustup.rs
// ============================================================

// ============================================================
// CARGO COMMANDS CHEATSHEET
// ============================================================
// cargo new project_name    → Create new project
// cargo build               → Compile (debug)
// cargo build --release     → Compile (optimized)
// cargo run                 → Build + run
// cargo check               → Fast check, no binary
// cargo test / cargo fmt / cargo clippy
// ============================================================

// ============================================================
// CARGO.TOML — every project has one at the root:
//
// [package]
// name = "my_tapri"
// version = "0.1.0"
// edition = "2021"
//
// [dependencies]
// serde = "1.0"          # crates.io dependency
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — Hello World
    // ──────────────────────────────────────────────────────────
    // main() is the entry point. println! is a MACRO (note the !).

    println!("Namaste, Rust duniya!");

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — println! Formatting
    // ──────────────────────────────────────────────────────────
    // {} = Display, {:?} = Debug. Compile-time format checking.

    let tapri_name = "Ramesh Tapri";
    let chai_price = 15;
    println!("Welcome to {}!", tapri_name);
    println!("Chai: ₹{}, Samosa: ₹{}", chai_price, 12);

    // Named and positional arguments
    println!("{item} costs ₹{price}", item = "Bun Maska", price = 20);
    println!("{0} loves {1}. {1} is the best!", "Ramesh", "Rust");

    // Debug formats
    let menu = ["Chai", "Samosa", "Vada Pav"];
    println!("Menu: {:?}", menu);
    println!("Menu (pretty):\n{:#?}", menu);

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — Formatting Tricks
    // ──────────────────────────────────────────────────────────
    // Padding, alignment, number bases, float precision:
    //
    //  | Syntax       | Effect              | Example output    |
    //  |--------------|---------------------|-------------------|
    //  | {:<15}       | left-align, width 15| "Chai           " |
    //  | {:>5}        | right-align         | "   15"           |
    //  | {:^15}       | center-align        | "     Chai      " |
    //  | {:0>5}       | zero-pad            | "00015"           |
    //  | {:b} {:x}    | binary / hex        | "101010" / "ff"   |
    //  | {:.2}        | 2 decimal places    | "3.14"            |

    let item = "Chai";
    println!("|{:<15}| ₹{:>5}|", item, 15);
    println!("|{:->15}| ₹{:0>5}|", item, 15);

    println!("Hex: {:x}, Binary: {:b}", 255, 42);

    let pi = 3.14159265;
    println!("Pi = {:.2}", pi);

    let crore = 1_00_00_000;
    println!("1 crore = {}", crore);

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — Comments
    // ──────────────────────────────────────────────────────────
    // //  → line comment (most common)
    // /* */ → block comment
    // /// → doc comment (Markdown, generates HTML with `cargo doc`)
    // //! → module-level doc comment (top of lib.rs)

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — print! vs println! vs eprint! vs eprintln!
    // ──────────────────────────────────────────────────────────

    print!("No newline. ");
    print!("Same line.\n");
    println!("This adds a newline automatically.");
    eprintln!("Error: Chai machine is broken!"); // writes to stderr

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Escape Characters & Raw Strings
    // ──────────────────────────────────────────────────────────

    println!("Tab:\tIndented");
    println!("Backslash: \\");
    println!("Quote: \"Hello\"");
    println!("Unicode: \u{0928}\u{092E}\u{0938}\u{094D}\u{0924}\u{0947}"); // नमस्ते

    // Raw strings — no escaping needed
    println!(r"C:\Users\ramesh\tapri");
    println!(r#"He said "Ek cutting chai!""#);

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Project Structure
    // ──────────────────────────────────────────────────────────
    // my_tapri/
    // ├── Cargo.toml        ← config
    // ├── Cargo.lock        ← exact dependency versions
    // ├── src/
    // │   ├── main.rs       ← binary entry point
    // │   └── lib.rs        ← library code (optional)
    // ├── tests/            ← integration tests
    // └── target/           ← build artifacts (gitignored)

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Useful Macros
    // ──────────────────────────────────────────────────────────

    let order = "Cutting Chai";
    dbg!(order); // prints [file:line] order = "Cutting Chai"

    // todo!("...")       → panics, marks unfinished code
    // unimplemented!()   → similar semantic
    // unreachable!()     → marks code that should never run

    assert!(2 + 2 == 4);
    assert_eq!(2 + 2, 4);
    assert_ne!(2 + 2, 5);

    // format! returns a String instead of printing
    let receipt = format!("Order: {} — ₹{}", "Chai", 15);
    println!("{}", receipt);

    println!("\n--- Ramesh Tapri is officially open! ---");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. fn main() is the entry point — every binary needs it
// 2. println! is a MACRO (!) — {} Display, {:?} Debug
// 3. Cargo: build, run, test, fmt, clippy — all-in-one tool
// 4. Cargo.toml = project config (name, version, deps)
// 5. Comments: //, /* */, /// (doc), //! (module doc)
// 6. format! returns String; println! writes to stdout
// 7. dbg!, todo!, assert! are essential dev macros
// 8. Raw strings r"..." and r#"..."# avoid escaping
// ============================================================

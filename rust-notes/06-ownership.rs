// ============================================================
//  FILE 6 : Ownership
// ============================================================
//  Topic  : Ownership rules, move semantics, Copy trait,
//           Clone trait, stack vs heap, drop, String vs &str
// ============================================================

// ============================================================
// STORY: Your Aadhaar card has exactly ONE owner at a time.
// You can photocopy simple docs (Copy), make a certified
// duplicate (Clone), or hand it over (Move). But two people
// can NEVER hold the same original.
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — Stack vs Heap
    // ──────────────────────────────────────────────────────────
    // Stack: fixed-size (i32, f64, bool, char, arrays, tuples)
    //   → fast push/pop, LIFO
    // Heap: dynamic-size (String, Vec, HashMap)
    //   → slower, requires allocation + pointer

    let aadhaar_number: i64 = 1234_5678_9012; // stack
    let aadhaar_name = String::from("Ramesh Kumar Sharma"); // heap
    // aadhaar_name on stack = [ptr | len | cap], data on heap

    println!("Aadhaar: {}, Name: {}", aadhaar_number, aadhaar_name);

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — The Three Ownership Rules
    // ──────────────────────────────────────────────────────────
    // 1. Each value has exactly ONE owner
    // 2. When the owner goes out of scope, value is dropped
    // 3. Ownership can be transferred (moved)

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — Move (heap data)
    // ──────────────────────────────────────────────────────────
    // Assignment of heap data MOVES ownership. Original is invalidated.

    let holder_1 = String::from("Ramesh's Aadhaar");
    let holder_2 = holder_1; // MOVE — holder_1 is now invalid
    // println!("{}", holder_1); // ERROR: value used after move
    println!("New holder: {}", holder_2);

    // Move into function — ownership transferred
    let bank_doc = String::from("Property Deed #4521");
    submit_to_bank(bank_doc);
    // bank_doc is no longer usable here

    // Move out via return
    let new_doc = create_document();
    println!("Received: {}", new_doc);

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — Copy (stack data)
    // ──────────────────────────────────────────────────────────
    // Types implementing Copy are duplicated on assignment.
    // All stack-only types: i32, f64, bool, char, &str,
    // tuples/arrays of Copy types.

    let pin_code = 411001_u32;
    let pin_backup = pin_code; // COPY, not move!
    println!("Original: {}, Backup: {}", pin_code, pin_backup);

    let greeting: &str = "Namaste";
    let greeting_copy = greeting; // &str is Copy
    println!("{} and {}", greeting, greeting_copy);

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — Clone (explicit deep copy)
    // ──────────────────────────────────────────────────────────

    let original = String::from("Land Deed: Plot 42, Pune");
    let certified_copy = original.clone();
    println!("Original: {}", original);     // still valid
    println!("Copy: {}", certified_copy);

    let mut doc_a = String::from("Draft v1");
    let doc_b = doc_a.clone();
    doc_a.push_str(" — REVISED");
    println!("A: {}, B: {}", doc_a, doc_b); // independent

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Drop on Scope Exit
    // ──────────────────────────────────────────────────────────

    {
        let temp_id = String::from("Temp ID: 9999");
        println!("Inside scope: {}", temp_id);
    } // temp_id dropped here — memory freed. No GC needed.

    let _tracker = DropTracker { name: String::from("Aadhaar Card") };
    let _tracker2 = DropTracker { name: String::from("PAN Card") };
    // Drop order: LIFO — PAN Card first, then Aadhaar Card

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Ownership with Functions
    // ──────────────────────────────────────────────────────────

    // Move into function
    let passport = String::from("Passport: J1234567");
    verify_document(passport);
    // passport is gone — moved into the function

    // Copy into function (i32 is Copy)
    let age = 35;
    verify_age(age);
    println!("Age still accessible: {}", age);

    // Get ownership back via return
    let visa = String::from("Tourist Visa");
    let visa = process_and_return(visa);
    println!("Got visa back: {}", visa);

    // Return multiple values via tuple
    let doc = String::from("Application Form");
    let (doc, word_count) = count_and_return(doc);
    println!("Doc: {}, Words: {}", doc, word_count);

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — String vs &str
    // ──────────────────────────────────────────────────────────
    // String = owned, heap, growable
    // &str   = borrowed reference, read-only view

    let mut full_name = String::from("Ramesh");
    full_name.push_str(" Kumar Sharma");
    println!("Full name: {}", full_name);

    let first: &str = "Ramesh";               // literal = &str
    let last: &str = &full_name[7..12];       // slice of String = &str
    println!("First: {}, Last: {}", first, last);

    // Converting: &str → String costs allocation
    let owned: String = String::from("hello");
    let borrowed: &str = &owned;               // free
    let owned_again: String = borrowed.to_string(); // allocates

    // ──────────────────────────────────────────────────────────
    // SECTION 9 — Common Patterns
    // ──────────────────────────────────────────────────────────

    // Clone when you need two copies
    let config = String::from("debug=true");
    let backup = config.clone();
    use_config(config);
    println!("Backup: {}", backup);

    // Borrow instead of moving (preview of File 07)
    let data = String::from("Important Data");
    let len = calculate_length(&data);
    println!("{} has {} chars", data, len);

    // ──────────────────────────────────────────────────────────
    // SECTION 10 — Ownership Visualized
    // ──────────────────────────────────────────────────────────
    //   let s1 = String::from("hello");
    //   STACK           HEAP
    //   s1: [ptr|5|5] → ['h','e','l','l','o']
    //
    //   let s2 = s1;    // MOVE
    //   s1: [INVALID]
    //   s2: [ptr|5|5] → ['h','e','l','l','o']
    //
    //   let s3 = s2.clone();  // CLONE
    //   s2: [ptr] → ['h','e','l','l','o']
    //   s3: [ptr] → ['h','e','l','l','o']  (new allocation!)

    println!("\n--- Ownership lesson complete! ---");
}

// ============================================================
// Function Declarations
// ============================================================

fn submit_to_bank(doc: String) {
    println!("Bank received: {}", doc);
}

fn create_document() -> String {
    String::from("Birth Certificate #7890")
}

fn process_and_return(mut doc: String) -> String {
    doc.push_str(" — APPROVED");
    doc
}

fn count_and_return(doc: String) -> (String, usize) {
    let count = doc.split_whitespace().count();
    (doc, count)
}

fn calculate_length(s: &String) -> usize { s.len() }
fn verify_document(doc: String) { println!("Verified: {}", doc); }
fn verify_age(age: i32) { println!("Age verified: {}", age); }
fn use_config(config: String) { println!("Using config: {}", config); }

struct DropTracker { name: String }

impl Drop for DropTracker {
    fn drop(&mut self) {
        println!("Dropping: {}", self.name);
    }
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Each value has exactly ONE owner
// 2. When owner leaves scope, value is dropped (no GC)
// 3. Assignment of heap data = MOVE (original invalidated)
// 4. Stack data (i32, bool, char, f64) implements Copy
// 5. .clone() = explicit deep copy (allocates new heap memory)
// 6. Passing to functions = move (heap) or copy (stack)
// 7. Return values transfer ownership back to caller
// 8. String = owned heap data; &str = borrowed reference
// ============================================================

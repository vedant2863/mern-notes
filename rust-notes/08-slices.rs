// ============================================================
//  FILE 8 : Slices
// ============================================================
//  Topic  : &str, &[T], string slices, array slices, range
//           syntax, slice patterns, UTF-8 handling
// ============================================================

// ============================================================
// STORY: Dadi reads the morning newspaper. She doesn't tear out
// pages — she marks sections with pencil (slices). A slice is
// just a VIEW: pointer + length, no ownership, no allocation.
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — String Slices (&str)
    // ──────────────────────────────────────────────────────────

    let newspaper = String::from("Breaking: Monsoon arrives in Mumbai today!");
    let headline = &newspaper[0..8];   // "Breaking"
    let location = &newspaper[29..35]; // "Mumbai"
    println!("Headline: {}, Location: {}", headline, location);

    // Range variants: [..7] from start, [8..] to end, [..] everything
    let s = String::from("Namaste Bharat");
    println!("{} | {} | {}", &s[..7], &s[8..], &s[..]);

    // String literals ARE &str already
    let greeting: &str = "Namaste";
    println!("Literal: {}", greeting);

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — Array/Vec Slices (&[T])
    // ──────────────────────────────────────────────────────────

    let classifieds = ["Jobs", "Property", "Matrimonial", "Education", "Services"];
    let first_three = &classifieds[..3];
    let last_two = &classifieds[3..];
    println!("First 3: {:?}, Last 2: {:?}", first_three, last_two);

    let prices: Vec<i32> = vec![150, 200, 350, 120, 450];
    let mid = &prices[1..3];
    println!("Mid-range: {:?}, Length: {}", mid, mid.len());

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — Slice Methods
    // ──────────────────────────────────────────────────────────

    let numbers = [5, 3, 8, 1, 9, 2, 7];

    println!("Contains 8? {}", numbers.contains(&8));
    println!("First: {:?}, Last: {:?}", numbers.first(), numbers.last());

    let mut sortable = [5, 3, 8, 1, 9];
    sortable.sort();
    println!("Sorted: {:?}", sortable);
    sortable.sort_by(|a, b| b.cmp(a));
    println!("Descending: {:?}", sortable);

    // Windows and chunks
    let sales = [100, 200, 150, 300, 250, 400];
    for window in sales.windows(3) {
        let avg: i32 = window.iter().sum::<i32>() / 3;
        println!("  {:?} avg: {}", window, avg);
    }

    for chunk in sales.chunks(2) {
        println!("  Chunk: {:?}", chunk);
    }

    // Split on value
    let data = [1, 0, 2, 0, 3];
    let parts: Vec<&[i32]> = data.split(|&x| x == 0).collect();
    println!("Split on 0: {:?}", parts);

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — String Slice Methods
    // ──────────────────────────────────────────────────────────

    let article = "  Mumbai rains: Heavy showers expected!  ";
    println!("Trimmed: '{}'", article.trim());

    let headline = "Monsoon-hits-Kerala-coast";
    let words: Vec<&str> = headline.split('-').collect();
    println!("Words: {:?}", words);

    let text = "chai   samosa   jalebi";
    let items: Vec<&str> = text.split_whitespace().collect();
    println!("Items: {:?}", items);

    let news = "India wins cricket match against Australia";
    println!("Contains 'cricket': {}", news.contains("cricket"));
    println!("Find 'wins': {:?}", news.find("wins"));

    println!("Upper: {}", "namaste".to_uppercase());
    println!("Replace: {}", "Bad word".replace("Bad", "***"));

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — UTF-8 Caution
    // ──────────────────────────────────────────────────────────
    // Byte index != char index. Slicing at wrong boundary PANICS.

    let hindi = "नमस्ते भारत";
    println!("Bytes: {}, Chars: {}", hindi.len(), hindi.chars().count());

    // let bad = &hindi[0..2]; // PANIC: mid-character
    // Safe: use .chars()
    let first_three: String = hindi.chars().take(3).collect();
    println!("First 3 chars: {}", first_three);

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Prefer Slices in Function Params
    // ──────────────────────────────────────────────────────────
    // Accept &str not &String, &[T] not &Vec<T> — more general.

    fn print_name(name: &str) { println!("Name: {}", name); }

    let owned = String::from("Ramesh");
    print_name(&owned);   // &String auto-coerces to &str
    print_name("Sharma"); // &str directly

    fn sum_slice(numbers: &[i32]) -> i32 { numbers.iter().sum() }

    let array = [1, 2, 3, 4, 5];
    let vector = vec![10, 20, 30];
    println!("Array sum: {}, Vec sum: {}", sum_slice(&array), sum_slice(&vector));

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Mutable Slices
    // ──────────────────────────────────────────────────────────

    let mut scores = [78, 92, 65, 88, 71];
    let first_half = &mut scores[..3];
    for s in first_half.iter_mut() { *s += 5; } // grace marks
    println!("After grace: {:?}", scores);

    scores.swap(0, 4);
    let mut blanks = [0; 5];
    blanks[1..4].fill(42);
    println!("Filled: {:?}", blanks);

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Slice Patterns (match)
    // ──────────────────────────────────────────────────────────

    let sections = ["Sports", "Politics", "Business", "Tech"];
    match sections {
        [] => println!("Empty!"),
        [only] => println!("Just: {}", only),
        [first, .., last] => println!("From {} to {}", first, last),
    }

    let pages = [1, 2, 3, 4, 5];
    if let [first, rest @ ..] = pages {
        println!("Page 1: {}, remaining: {:?}", first, rest);
    }

    // ──────────────────────────────────────────────────────────
    // SECTION 9 — First Word (slice vs allocation)
    // ──────────────────────────────────────────────────────────

    fn first_word(s: &str) -> &str {
        match s.find(' ') {
            Some(i) => &s[..i],
            None => s,
        }
    }

    let article = "Monsoon arrives early this year";
    println!("First word: {}", first_word(article));

    // ──────────────────────────────────────────────────────────
    // SECTION 10 — Practical: CSV Parser
    // ──────────────────────────────────────────────────────────

    let ad = "SALE|2BHK|Mumbai|₹85L";
    let fields: Vec<&str> = ad.split('|').collect();
    println!("Type: {}, Location: {}", fields[0], fields[2]);

    let csv = "Name,Age,City\nRamesh,35,Pune\nSuresh,28,Mumbai";
    for (i, line) in csv.lines().enumerate() {
        let cols: Vec<&str> = line.split(',').collect();
        if i == 0 { println!("Headers: {:?}", cols); }
        else { println!("Row {}: {:?}", i, cols); }
    }

    println!("\n--- Dadi has finished reading! ---");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. &str = pointer + length into string data (no allocation)
// 2. &[T] = slice into an array or Vec
// 3. Slices borrow — they don't own data
// 4. Range syntax: [..3], [2..], [1..4], [..]
// 5. Prefer &str over &String, &[T] over &Vec<T> in params
// 6. String literals are &str (point into binary)
// 7. UTF-8: byte index != char index — use .chars() safely
// 8. Mutable slices (&mut [T]) allow in-place modification
// 9. Slice patterns: [first, .., last] in match
// ============================================================

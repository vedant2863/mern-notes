// ============================================================
//  FILE 3 : Data Types
// ============================================================
//  Topic  : i32, f64, bool, char, tuples, arrays, casting,
//           type aliases, numeric limits
// ============================================================

// ============================================================
// STORY: Sharma ji runs a kirana store — he tracks packets (u32),
// weight (f64), open/closed (bool), grade (char), daily sales
// (array), item details (tuple). "Galat type = galat hisaab!"
// ============================================================

fn main() {
    // ──────────────────────────────────────────────────────────
    // SECTION 1 — Integer Types
    // ──────────────────────────────────────────────────────────
    //  | Type  | Size     | Range                    |
    //  |-------|----------|--------------------------|
    //  | i8    | 1 byte   | -128 to 127              |
    //  | i32   | 4 bytes  | ±2.1 billion (default)   |
    //  | i64   | 8 bytes  | ±9.2 quintillion         |
    //  | u8    | 1 byte   | 0 to 255                 |
    //  | u32   | 4 bytes  | 0 to 4.2 billion         |
    //  | usize | arch     | pointer-sized (indexing)  |

    let rice_packets: i32 = 150;
    let atta_packets: u32 = 200;
    let big_stock: i64 = 1_000_000; // underscores for readability

    println!("Rice: {}, Atta: {}", rice_packets, atta_packets);

    // Numeric literals
    let hex = 0xff;
    let binary = 0b1111_0000;
    let byte: u8 = b'A';
    println!("Hex: {}, Binary: {}, Byte: {}", hex, binary, byte);

    // Limits and overflow handling
    println!("i32 range: {} to {}", i32::MIN, i32::MAX);

    let max_u8: u8 = 255;
    println!("Wrapping: {}", max_u8.wrapping_add(1));     // 0
    println!("Saturating: {}", max_u8.saturating_add(1));  // 255
    println!("Checked: {:?}", max_u8.checked_add(1));      // None

    // ──────────────────────────────────────────────────────────
    // SECTION 2 — Floating Point
    // ──────────────────────────────────────────────────────────
    // f64 (default, double precision) vs f32 (faster, less precise)

    let rice_kg: f64 = 25.75;
    let total_cost = rice_kg * 45.50;
    println!("Rice cost: ₹{:.2}", total_cost);

    // Float gotcha: 0.1 + 0.2 != 0.3 (IEEE 754)
    println!("0.1 + 0.2 = {}", 0.1_f64 + 0.2);

    // Useful methods
    println!("Floor: {}, Ceil: {}, Sqrt: {}",
             3.7_f64.floor(), 3.2_f64.ceil(), 16.0_f64.sqrt());

    let nan = f64::NAN;
    println!("NaN == NaN: {}, Is NaN: {}", nan == nan, nan.is_nan());

    // ──────────────────────────────────────────────────────────
    // SECTION 3 — Boolean
    // ──────────────────────────────────────────────────────────

    let store_open: bool = true;
    let stock_empty = false;
    let can_sell = store_open && !stock_empty;
    println!("Can sell: {}", can_sell);

    println!("true as i32: {}", true as i32); // 1

    // ──────────────────────────────────────────────────────────
    // SECTION 4 — Character (4 bytes, full Unicode)
    // ──────────────────────────────────────────────────────────

    let grade: char = 'A';
    let hindi = 'अ';
    println!("Grade: {}, Hindi: {}", grade, hindi);
    println!("Is alphabetic: {}, Is digit: {}", 'R'.is_alphabetic(), '5'.is_ascii_digit());

    // 'A' = char (4 bytes), "A" = &str (pointer + length)

    // ──────────────────────────────────────────────────────────
    // SECTION 5 — Tuples (group different types, fixed length)
    // ──────────────────────────────────────────────────────────

    let item: (&str, f64, u32) = ("Toor Dal", 120.50, 30);
    println!("Item: {}, Price: ₹{}, Qty: {}", item.0, item.1, item.2);

    // Destructuring
    let (name, price, qty) = item;
    println!("{} × {} = ₹{:.2}", name, qty, price * qty as f64);

    // Unit type () — empty tuple, like void
    let nothing: () = ();
    println!("Unit: {:?}", nothing);

    // ──────────────────────────────────────────────────────────
    // SECTION 6 — Arrays (fixed size, same type, stack-allocated)
    // ──────────────────────────────────────────────────────────
    // Type: [T; N]

    let daily_sales: [i32; 7] = [1200, 1500, 800, 2000, 1800, 2500, 900];
    println!("Monday: ₹{}, Length: {}", daily_sales[0], daily_sales.len());

    let zeros = [0; 5]; // [0, 0, 0, 0, 0]
    println!("Zeros: {:?}", zeros);

    let mut prices = [10, 20, 30, 40, 50];
    prices[2] = 35;
    println!("Updated: {:?}", prices);

    // Slicing, safe access, iteration
    println!("First 3 days: {:?}", &daily_sales[0..3]);

    match daily_sales.get(10) {
        Some(val) => println!("Day 10: {}", val),
        None => println!("Day 10: doesn't exist!"),
    }

    let mut sortable = [5, 3, 8, 1, 9];
    sortable.sort();
    println!("Sorted: {:?}", sortable);

    let total: i32 = daily_sales.iter().sum();
    println!("Weekly total: ₹{}", total);

    // ──────────────────────────────────────────────────────────
    // SECTION 7 — Type Casting (`as`)
    // ──────────────────────────────────────────────────────────
    // Rust NEVER converts implicitly. You must cast explicitly.

    let packets: i32 = 42;
    let packets_f64 = packets as f64;

    let price_float: f64 = 99.99;
    let price_int = price_float as i32; // truncates, not rounds!
    println!("Truncated: {}", price_int);

    // Narrowing wraps: 300 as u8 = 44 (300 % 256)
    let big: i32 = 300;
    println!("300 as u8: {}", big as u8);

    // char <-> integer
    println!("'A' as u32: {}, 66u8 as char: {}", 'A' as u32, 66u8 as char);

    // ──────────────────────────────────────────────────────────
    // SECTION 8 — Type Aliases & Operators
    // ──────────────────────────────────────────────────────────

    type Rupees = f64;
    let dal_price: Rupees = 120.0;
    let dal_qty: u32 = 5;
    println!("Dal total: ₹{}", dal_price * dal_qty as Rupees);

    // Arithmetic
    let (a, b) = (17, 5);
    println!("{} + {} = {},  {} / {} = {},  {} % {} = {}",
             a, b, a + b, a, b, a / b, a, b, a % b);
    println!("7 / 2 = {} (int), 7.0 / 2.0 = {} (float)", 7 / 2, 7.0 / 2.0);

    // ──────────────────────────────────────────────────────────
    // SECTION 9 — Memory Sizes
    // ──────────────────────────────────────────────────────────

    println!("\n--- Type sizes ---");
    println!("bool: {}B, char: {}B, i32: {}B, f64: {}B, usize: {}B",
        std::mem::size_of::<bool>(),
        std::mem::size_of::<char>(),
        std::mem::size_of::<i32>(),
        std::mem::size_of::<f64>(),
        std::mem::size_of::<usize>());

    println!("\n--- Sharma ji's inventory is balanced! ---");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. i32 = default integer, f64 = default float
// 2. Unsigned (u8, u32...) can't hold negatives
// 3. char is 4 bytes — full Unicode, not just ASCII
// 4. Tuples group different types; arrays group same types
// 5. Arrays: fixed-size, stack-allocated [T; N]
// 6. Rust NEVER converts types implicitly — use `as`
// 7. Narrowing casts can silently wrap/truncate
// 8. Use checked_add/saturating_add for safe overflow
// 9. .get(index) returns Option instead of panicking
// ============================================================

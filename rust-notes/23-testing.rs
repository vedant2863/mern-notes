// ============================================================
// 23. TESTING IN RUST
// ============================================================
// Rust has a built-in testing framework — no external libraries
// needed. The compiler and cargo make writing tests effortless.
// ============================================================

// ============================================================
// STORY: MARUTI SUZUKI QUALITY CHECK LINE
// ============================================================
// Every car at the Manesar factory gets inspected:
// UNIT CHECKS = test one component (unit tests)
// INTEGRATION CHECKS = test components together (integration tests)
// EXPECTED FAILURES = airbag SHOULD deploy (#[should_panic])
// SKIPPED CHECKS = crash tests only for certification (#[ignore])
// ============================================================

// ============================================================
// SECTION 1: FUNCTIONS UNDER TEST
// ============================================================

fn calculate_on_road_price(ex_showroom: f64, registration: f64) -> f64 {
    let gst = ex_showroom * 0.28;
    ex_showroom + gst + registration
}

fn is_available(model: &str) -> bool {
    let available = vec!["Swift", "Baleno", "Brezza", "Ertiga", "Fronx"];
    available.contains(&model)
}

fn calculate_emi(principal: f64, annual_rate: f64, months: u32) -> f64 {
    let monthly_rate = annual_rate / 12.0 / 100.0;
    let factor = (1.0 + monthly_rate).powi(months as i32);
    (principal * monthly_rate * factor) / (factor - 1.0)
}

fn performance_grade(kmpl: f64) -> &'static str {
    match kmpl as u32 {
        0..=10 => "Poor",
        11..=15 => "Average",
        16..=20 => "Good",
        21..=25 => "Excellent",
        _ => "Outstanding",
    }
}

fn validate_registration(reg: &str) -> Result<String, String> {
    if reg.len() < 9 || reg.len() > 13 {
        return Err(String::from("Invalid registration length"));
    }
    if !reg.starts_with("MH") && !reg.starts_with("DL") && !reg.starts_with("KA") {
        return Err(format!("Unknown state code in {}", reg));
    }
    Ok(format!("Valid: {}", reg))
}

fn calculate_mileage(distance_km: f64, fuel_litres: f64) -> f64 {
    if fuel_litres == 0.0 {
        panic!("Cannot calculate mileage: fuel consumed is zero!");
    }
    distance_km / fuel_litres
}

// ============================================================
// SECTION 2: THE TEST MODULE
// ============================================================
// #[cfg(test)] compiles this module ONLY during testing.
// Tests CAN access private functions — this is intentional.

#[cfg(test)]
mod tests {
    use super::*;

    // --- assert! — basic boolean ---
    #[test]
    fn test_swift_is_available() {
        assert!(is_available("Swift"));
    }

    #[test]
    fn test_unknown_model_not_available() {
        assert!(!is_available("Creta"));
    }

    // --- assert_eq! / assert_ne! — value comparison ---
    #[test]
    fn test_on_road_price_calculation() {
        let price = calculate_on_road_price(800_000.0, 50_000.0);
        assert_eq!(price, 1_074_000.0);
    }

    #[test]
    fn test_performance_grades() {
        assert_eq!(performance_grade(8.0), "Poor");
        assert_eq!(performance_grade(14.0), "Average");
        assert_eq!(performance_grade(23.0), "Excellent");
        assert_eq!(performance_grade(28.0), "Outstanding");
    }

    #[test]
    fn test_grades_are_distinct() {
        assert_ne!(performance_grade(8.0), performance_grade(23.0));
    }

    // --- Custom failure messages ---
    #[test]
    fn test_emi_calculation() {
        let emi = calculate_emi(700_000.0, 8.5, 60);
        let expected = 14_369.0;
        assert!(
            (emi - expected).abs() < 1.0,
            "EMI wrong! Expected ~{}, got {}",
            expected, emi
        );
    }

    // --- #[should_panic] — testing correct panics ---
    #[test]
    #[should_panic(expected = "fuel consumed is zero")]
    fn test_zero_fuel_panics() {
        calculate_mileage(200.0, 0.0);
    }

    // --- Tests returning Result<T, E> ---
    #[test]
    fn test_valid_registration() -> Result<(), String> {
        let result = validate_registration("MH12AB1234")?;
        assert_eq!(result, "Valid: MH12AB1234");
        Ok(())
    }

    #[test]
    fn test_invalid_registration_length() {
        let result = validate_registration("MH");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Invalid registration length");
    }

    #[test]
    fn test_unknown_state_code() {
        let result = validate_registration("XX12AB1234");
        assert!(result.unwrap_err().contains("Unknown state code"));
    }

    // --- #[ignore] — expensive tests run on demand ---
    #[test]
    #[ignore = "Expensive crash simulation"]
    fn test_full_crash_simulation() {
        let mut total = 0.0;
        for i in 1..=1_000_000 {
            total += calculate_emi(500_000.0 + i as f64, 9.0, 48);
        }
        assert!(total > 0.0);
    }

    // --- Shared setup data ---
    fn sample_car_data() -> Vec<(&'static str, f64, f64)> {
        vec![
            ("Swift", 600_000.0, 40_000.0),
            ("Baleno", 700_000.0, 45_000.0),
            ("Brezza", 850_000.0, 55_000.0),
        ]
    }

    #[test]
    fn test_on_road_always_more_than_ex_showroom() {
        for (model, ex_showroom, registration) in sample_car_data() {
            let on_road = calculate_on_road_price(ex_showroom, registration);
            assert!(on_road > ex_showroom, "{}: on-road {} <= ex-showroom {}", model, on_road, ex_showroom);
        }
    }
}

// ============================================================
// SECTION 3: CARGO TEST COMMANDS (Reference)
// ============================================================
// cargo test                        Run all tests
// cargo test test_emi               Run tests matching pattern
// cargo test -- --ignored           Run ONLY ignored tests
// cargo test -- --show-output       Show println! from passing tests
// cargo test -- --test-threads=1    Single-threaded execution
// cargo test -- --list              List all tests

// ============================================================
// SECTION 4: INTEGRATION TESTS (Reference)
// ============================================================
// Live in tests/ directory, test PUBLIC API only:
//   my_project/
//   +-- src/lib.rs
//   +-- tests/
//       +-- integration_test.rs   (each file = separate crate)
//       +-- common/mod.rs         (shared utilities)

fn main() {
    println!("=== Rust Testing Demo ===\n");
    println!("This file is tested with `cargo test`.\n");

    println!("--- On-Road Price ---");
    println!("Swift: Rs. {:.0}", calculate_on_road_price(600_000.0, 40_000.0));

    println!("\n--- Availability ---");
    println!("Swift: {}, Creta: {}", is_available("Swift"), is_available("Creta"));

    println!("\n--- EMI ---");
    println!("Rs. 7L at 8.5% for 60mo: Rs. {:.2}", calculate_emi(700_000.0, 8.5, 60));

    println!("\n--- Grades ---");
    println!("8 kmpl -> {}, 23 kmpl -> {}", performance_grade(8.0), performance_grade(23.0));

    println!("\n--- Registration ---");
    println!("{:?}", validate_registration("MH12AB1234"));
    println!("{:?}", validate_registration("XX99ZZ0000"));

    println!("\n--- Commands ---");
    println!("cargo test                  Run all tests");
    println!("cargo test test_emi         Run specific test");
    println!("cargo test -- --ignored     Run ignored tests");
    println!("cargo test -- --show-output See println! output");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. #[test] marks test functions. #[cfg(test)] module is
//    only compiled during testing — zero production overhead.
// 2. assert!(cond), assert_eq!(a, b), assert_ne!(a, b).
//    All accept optional format strings for custom messages.
// 3. #[should_panic(expected = "msg")] tests correct panics.
// 4. #[ignore] skips expensive tests. Run with --ignored.
// 5. Tests can return Result<(), E> for cleaner ? usage.
// 6. Rust tests CAN access private functions (child module).
// 7. Unit tests: #[cfg(test)] in source files.
//    Integration tests: separate tests/ directory.
// 8. Naming: test_<function>_<scenario>_<expected_result>()
// ============================================================

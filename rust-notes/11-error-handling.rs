// ============================================================
// 11 - ERROR HANDLING IN RUST
// ============================================================
// Rust has no exceptions. Errors are values: Result<T,E> for
// recoverable failures, panic!() for unrecoverable bugs.
// The compiler FORCES you to handle them.
// ============================================================

// ============================================================
// STORY: The UPI Payment Flow
// ============================================================
// Paying Rs. 500 at a chai stall via Google Pay. Things can
// fail: insufficient balance, wrong PIN, server timeout. Some
// errors are recoverable (retry with correct PIN), some are
// unrecoverable (corrupted state — panic!). Rust models this
// with Result<T,E> and the ? operator for elegant propagation.
// ============================================================

use std::collections::HashMap;
use std::fmt;
use std::num::ParseIntError;

// ============================================================
// 1. PANIC! — UNRECOVERABLE ERRORS
// ============================================================
// panic! is for bugs that should NEVER happen in correct code.

fn demo_panic() {
    println!("=== 1. panic! (Unrecoverable Errors) ===\n");

    let balance = 1000;
    let withdrawal = 500;

    if withdrawal > balance {
        println!("This would panic if withdrawal > balance");
    } else {
        println!("Withdrawal of Rs. {} approved. Remaining: Rs. {}",
            withdrawal, balance - withdrawal);
    }

    // .get() returns Option — safe alternative to indexing
    let stations = vec!["Delhi", "Agra", "Jaipur"];
    match stations.get(5) {
        Some(station) => println!("Station: {}", station),
        None => println!("No station at index 5 (safe with .get())"),
    }
}

// ============================================================
// 2. RESULT<T, E> — THE CORE OF RUST ERROR HANDLING
// ============================================================
// Result is an enum: Ok(T) for success, Err(E) for failure.
// The compiler warns if you ignore a Result.

#[derive(Debug)]
enum UpiError {
    InsufficientBalance { available: f64, required: f64 },
    InvalidPin,
    ServerTimeout,
    InvalidVpa(String),
}

fn process_upi_payment(
    from: &str, to: &str, amount: f64, pin: &str, balance: f64,
) -> Result<String, UpiError> {
    if pin.len() != 4 || pin.parse::<u32>().is_err() {
        return Err(UpiError::InvalidPin);
    }
    if !to.contains('@') {
        return Err(UpiError::InvalidVpa(String::from(to)));
    }
    if amount > balance {
        return Err(UpiError::InsufficientBalance { available: balance, required: amount });
    }
    if amount > 50000.0 {
        return Err(UpiError::ServerTimeout);
    }
    Ok(format!("TXN-{}-{}", from.len() * 1000 + to.len(), amount as u64))
}

fn demo_result_basic() {
    println!("\n=== 2. Result<T, E> ===\n");

    match process_upi_payment("rahul@okicici", "chai@ybl", 40.0, "1234", 5000.0) {
        Ok(txn_id) => println!("Payment successful! TXN: {}", txn_id),
        Err(e) => println!("Payment failed: {:?}", e),
    }

    match process_upi_payment("rahul@okicici", "invalid_vpa", 100.0, "1234", 5000.0) {
        Ok(txn_id) => println!("Payment successful! TXN: {}", txn_id),
        Err(UpiError::InvalidVpa(vpa)) => println!("Invalid VPA: {}", vpa),
        Err(e) => println!("Other error: {:?}", e),
    }
}

// ============================================================
// 3. UNWRAP AND EXPECT
// ============================================================
// unwrap()/expect() extract Ok/Some but PANIC on Err/None.
// Use only when certain of success, or in tests.

fn demo_unwrap_expect() {
    println!("\n=== 3. unwrap() and expect() ===\n");

    let good: Result<i32, &str> = Ok(42);
    println!("Unwrapped: {}", good.unwrap());

    let parsed: Result<i32, _> = "2024".parse();
    println!("Parsed year: {}", parsed.expect("Failed to parse year"));

    // unwrap_or provides a default value
    let bad: Result<i32, &str> = Err("something went wrong");
    println!("With default: {}", bad.unwrap_or(0));

    // unwrap_or_else takes a closure for lazy evaluation
    let bad2: Result<i32, &str> = Err("error");
    let val = bad2.unwrap_or_else(|e| {
        println!("  Error occurred: {}. Using fallback.", e);
        -1
    });
    println!("Value: {}", val);

    let name: Option<&str> = None;
    println!("Name: {}", name.unwrap_or("Anonymous"));
}

// ============================================================
// 4. THE ? OPERATOR — ELEGANT ERROR PROPAGATION
// ============================================================
// ? unwraps Ok/Some and returns early with Err/None.
// Replaces verbose match blocks with a single character.

#[derive(Debug)]
struct BankAccount {
    holder: String,
    balance: f64,
    upi_id: String,
}

fn validate_amount(amount_str: &str) -> Result<f64, String> {
    let amount: f64 = amount_str.parse().map_err(|e: std::num::ParseFloatError| {
        format!("Invalid amount '{}': {}", amount_str, e)
    })?;
    if amount <= 0.0 {
        return Err(format!("Amount must be positive, got {}", amount));
    }
    if amount > 100000.0 {
        return Err(String::from("Amount exceeds per-transaction limit of Rs. 1,00,000"));
    }
    Ok(amount)
}

fn find_account(accounts: &HashMap<String, BankAccount>, upi_id: &str) -> Result<f64, String> {
    let account = accounts.get(upi_id)
        .ok_or(format!("UPI ID '{}' not found", upi_id))?;
    Ok(account.balance)
}

fn transfer(
    accounts: &HashMap<String, BankAccount>,
    from_upi: &str, to_upi: &str, amount_str: &str,
) -> Result<String, String> {
    let amount = validate_amount(amount_str)?;
    let from_balance = find_account(accounts, from_upi)?;
    let _to_balance = find_account(accounts, to_upi)?;

    if amount > from_balance {
        return Err(format!(
            "Insufficient balance. Have: Rs. {:.2}, Need: Rs. {:.2}",
            from_balance, amount
        ));
    }
    Ok(format!(
        "Transferred Rs. {:.2} from {} to {}. Remaining: Rs. {:.2}",
        amount, from_upi, to_upi, from_balance - amount
    ))
}

fn demo_question_mark() {
    println!("\n=== 4. The ? Operator ===\n");

    let mut accounts = HashMap::new();
    accounts.insert(String::from("rahul@okicici"), BankAccount {
        holder: String::from("Rahul"), balance: 15000.0,
        upi_id: String::from("rahul@okicici"),
    });
    accounts.insert(String::from("shop@ybl"), BankAccount {
        holder: String::from("Chai Shop"), balance: 50000.0,
        upi_id: String::from("shop@ybl"),
    });

    let test_cases = vec![
        ("rahul@okicici", "shop@ybl", "500"),
        ("rahul@okicici", "shop@ybl", "abc"),
        ("unknown@bank", "shop@ybl", "100"),
    ];

    for (from, to, amt) in test_cases {
        match transfer(&accounts, from, to, amt) {
            Ok(msg) => println!("SUCCESS: {}", msg),
            Err(e) => println!("FAILED: {}", e),
        }
    }
}

// ============================================================
// 5. CUSTOM ERROR TYPES WITH Display AND From
// ============================================================
// Custom error types let callers match on specific errors.
// Implementing From<T> enables automatic conversion with ?.

#[derive(Debug)]
enum PaymentError {
    ParseError(String),
    InsufficientFunds { available: f64, required: f64 },
    LimitExceeded(f64),
}

impl fmt::Display for PaymentError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PaymentError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            PaymentError::InsufficientFunds { available, required } => {
                write!(f, "Insufficient funds: have Rs. {:.2}, need Rs. {:.2}", available, required)
            }
            PaymentError::LimitExceeded(amount) => {
                write!(f, "Transaction limit exceeded: Rs. {:.2}", amount)
            }
        }
    }
}

impl From<ParseIntError> for PaymentError {
    fn from(e: ParseIntError) -> Self {
        PaymentError::ParseError(e.to_string())
    }
}

fn parse_and_validate_pin(pin: &str) -> Result<u32, PaymentError> {
    let parsed: u32 = pin.parse()?; // ? converts ParseIntError via From
    if parsed < 1000 || parsed > 9999 {
        return Err(PaymentError::ParseError(format!("PIN must be 4 digits, got {}", parsed)));
    }
    Ok(parsed)
}

fn secure_transfer(
    from_balance: f64, amount: f64, pin: &str,
) -> Result<String, PaymentError> {
    let _valid_pin = parse_and_validate_pin(pin)?;
    if amount > 100000.0 {
        return Err(PaymentError::LimitExceeded(amount));
    }
    if amount > from_balance {
        return Err(PaymentError::InsufficientFunds {
            available: from_balance, required: amount,
        });
    }
    Ok(format!("Payment of Rs. {:.2} authorized", amount))
}

fn demo_custom_errors() {
    println!("\n=== 5. Custom Error Types ===\n");

    let test_cases = vec![
        (5000.0, 200.0, "1234"),
        (5000.0, 200.0, "abcd"),
        (5000.0, 8000.0, "5678"),
        (5000.0, 200000.0, "5678"),
    ];

    for (balance, amount, pin) in test_cases {
        match secure_transfer(balance, amount, pin) {
            Ok(msg) => println!("OK: {}", msg),
            Err(e) => println!("ERR: {}", e),
        }
    }
}

// ============================================================
// 6. ERROR CHAINING AND CONTEXT
// ============================================================
// Build context around errors: "failed to load config"
// caused by "file not found."

#[derive(Debug)]
struct AppError {
    message: String,
    source: Option<Box<AppError>>,
}

impl AppError {
    fn new(message: &str) -> Self {
        Self { message: String::from(message), source: None }
    }

    fn with_context(mut self, context: &str) -> Self {
        let inner = AppError { message: self.message, source: self.source };
        self.message = String::from(context);
        self.source = Some(Box::new(inner));
        self
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)?;
        if let Some(ref src) = self.source {
            write!(f, "\n  Caused by: {}", src)?;
        }
        Ok(())
    }
}

fn demo_error_chaining() {
    println!("\n=== 6. Error Chaining ===\n");

    let file_result: Result<String, AppError> = Err(AppError::new("file 'config.toml' not found"));
    let result: Result<String, AppError> = file_result
        .map_err(|e| e.with_context("failed to read configuration file"));

    match result {
        Ok(config) => println!("Config: {}", config),
        Err(e) => println!("Error: {}", e),
    }
}

// ============================================================
// 7. OPTION AND RESULT COMBINATORS
// ============================================================
// Combinators chain operations on Option/Result elegantly,
// replacing verbose match blocks.

fn demo_combinators() {
    println!("\n=== 7. Option/Result Combinators ===\n");

    // map — transform the inner value
    let price: Option<u32> = Some(1500);
    let with_gst = price.map(|p| (p as f64) * 1.18);
    println!("Price with GST: {:?}", with_gst);

    // and_then (flatMap) — chain operations returning Option/Result
    let input = "42";
    let result: Option<u32> = input.parse::<u32>().ok().and_then(|n| {
        if n > 0 && n <= 100 { Some(n) } else { None }
    });
    println!("Parsed and validated: {:?}", result);

    // or_else — provide fallback on error
    let primary: Result<i32, &str> = Err("primary failed");
    let fallback = primary.or_else(|_| -> Result<i32, &str> { Ok(99) });
    println!("With fallback: {:?}", fallback);

    // filter on Option
    let age: Option<u32> = Some(25);
    println!("Adult: {:?}", age.filter(|&a| a >= 18));

    // zip combines two Options
    let name: Option<&str> = Some("Rahul");
    let score: Option<u32> = Some(95);
    println!("Combined: {:?}", name.zip(score));

    // Chaining multiple operations fluently
    let final_amount = Some(2500.0_f64)
        .filter(|&t| t > 0.0)
        .map(|t| t * 1.05)
        .map(|t| t - 200.0)
        .filter(|&t| t > 0.0);
    println!("Final amount: {:?}", final_amount);
}

// ============================================================
// 8. PRACTICAL EXAMPLE — MINI PAYMENT PROCESSOR
// ============================================================
// Putting together custom errors, ?, From, Display, combinators.

#[derive(Debug)]
enum TransactionError {
    InvalidAmount(String),
    AccountNotFound(String),
    InsufficientBalance { account: String, available: f64, required: f64 },
    DailyLimitExceeded { limit: f64, attempted: f64 },
}

impl fmt::Display for TransactionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TransactionError::InvalidAmount(msg) => write!(f, "Invalid amount: {}", msg),
            TransactionError::AccountNotFound(id) => write!(f, "Account '{}' not found", id),
            TransactionError::InsufficientBalance { account, available, required } => {
                write!(f, "Insufficient balance in '{}': have {:.2}, need {:.2}", account, available, required)
            }
            TransactionError::DailyLimitExceeded { limit, attempted } => {
                write!(f, "Daily limit Rs. {:.2} exceeded (attempted Rs. {:.2})", limit, attempted)
            }
        }
    }
}

struct PaymentProcessor {
    accounts: HashMap<String, f64>,
    daily_limit: f64,
    today_total: f64,
}

impl PaymentProcessor {
    fn new(daily_limit: f64) -> Self {
        Self { accounts: HashMap::new(), daily_limit, today_total: 0.0 }
    }

    fn add_account(&mut self, id: &str, balance: f64) {
        self.accounts.insert(String::from(id), balance);
    }

    fn validate_amount(&self, amount: f64) -> Result<f64, TransactionError> {
        if amount <= 0.0 {
            return Err(TransactionError::InvalidAmount(format!("must be positive, got {:.2}", amount)));
        }
        if amount + self.today_total > self.daily_limit {
            return Err(TransactionError::DailyLimitExceeded {
                limit: self.daily_limit, attempted: amount + self.today_total,
            });
        }
        Ok(amount)
    }

    fn get_balance(&self, id: &str) -> Result<f64, TransactionError> {
        self.accounts.get(id).copied()
            .ok_or(TransactionError::AccountNotFound(String::from(id)))
    }

    fn process(&mut self, from: &str, to: &str, amount: f64) -> Result<String, TransactionError> {
        let amount = self.validate_amount(amount)?;
        let from_balance = self.get_balance(from)?;
        let _to_balance = self.get_balance(to)?;

        if amount > from_balance {
            return Err(TransactionError::InsufficientBalance {
                account: String::from(from), available: from_balance, required: amount,
            });
        }

        *self.accounts.get_mut(from).unwrap() -= amount;
        *self.accounts.get_mut(to).unwrap() += amount;
        self.today_total += amount;

        Ok(format!("Rs. {:.2}: {} -> {} | Today's total: Rs. {:.2}",
            amount, from, to, self.today_total))
    }
}

fn demo_practical_example() {
    println!("\n=== 8. Practical: Payment Processor ===\n");

    let mut processor = PaymentProcessor::new(50000.0);
    processor.add_account("rahul@upi", 25000.0);
    processor.add_account("shop@upi", 100000.0);
    processor.add_account("priya@upi", 8000.0);

    let transactions = vec![
        ("rahul@upi", "shop@upi", 500.0),
        ("priya@upi", "shop@upi", 2000.0),
        ("rahul@upi", "ghost@upi", 100.0),
        ("priya@upi", "rahul@upi", 10000.0),
        ("rahul@upi", "priya@upi", -50.0),
        ("rahul@upi", "priya@upi", 1000.0),
    ];

    for (from, to, amount) in transactions {
        let label = format!("Rs. {:.2}: {} -> {}", amount, from, to);
        match processor.process(from, to, amount) {
            Ok(msg) => println!("[OK]   {}", msg),
            Err(e) => println!("[FAIL] {} -- {}", label, e),
        }
    }

    println!("\nFinal balances:");
    let mut accounts: Vec<_> = processor.accounts.iter().collect();
    accounts.sort_by_key(|(k, _)| k.clone());
    for (id, balance) in accounts {
        println!("  {}: Rs. {:.2}", id, balance);
    }
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    demo_panic();
    demo_result_basic();
    demo_unwrap_expect();
    demo_question_mark();
    demo_custom_errors();
    demo_error_chaining();
    demo_combinators();
    demo_practical_example();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===\n");
    println!("1. Rust has no exceptions. Errors are values: Result<T,E> and Option<T>.");
    println!("2. panic! is for unrecoverable bugs. Result is for expected failures.");
    println!("3. The ? operator propagates errors elegantly (early return on Err/None).");
    println!("4. unwrap()/expect() panic on error — use only when certain or in tests.");
    println!("5. Custom error enums + Display give user-friendly messages.");
    println!("6. Implement From<OtherError> to enable automatic conversion with ?.");
    println!("7. map, and_then, unwrap_or, filter — combinators replace verbose matches.");
    println!("8. ok_or() converts Option to Result for ? propagation.");
}

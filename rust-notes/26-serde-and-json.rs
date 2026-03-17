// ============================================================
// 26. SERDE AND JSON IN RUST
// ============================================================
// Serde (SERialize/DEserialize) is Rust's framework for data
// conversion. Compile-time code generation via derive macros
// means zero runtime overhead.
// ============================================================

// CARGO.TOML:
// [dependencies]
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"

// ============================================================
// STORY: AADHAAR eKYC API
// ============================================================
// Bank sends JSON request with Aadhaar number -> your server
// DESERIALIZES to a Rust struct -> looks up citizen data ->
// SERIALIZES response back to JSON. This cycle runs billions
// of times daily across UPI, DigiLocker, CoWIN, IRCTC.
// ============================================================

use serde::{Serialize, Deserialize};
use serde_json::{self, Value, json};
use std::collections::HashMap;

// ============================================================
// SECTION 1: BASIC SERIALIZATION — Struct to JSON
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
struct Citizen {
    name: String,
    aadhaar_number: String,
    age: u32,
    is_verified: bool,
    address: Address,
}

#[derive(Debug, Serialize, Deserialize)]
struct Address {
    street: String,
    city: String,
    state: String,
    pin_code: String,
}

fn demo_basic_serialization() {
    println!("--- 1. Serialization (Struct -> JSON) ---\n");

    let citizen = Citizen {
        name: String::from("Rahul Sharma"),
        aadhaar_number: String::from("1234-5678-9012"),
        age: 32,
        is_verified: true,
        address: Address {
            street: String::from("42 MG Road"),
            city: String::from("Bangalore"),
            state: String::from("Karnataka"),
            pin_code: String::from("560001"),
        },
    };

    let json_compact = serde_json::to_string(&citizen).unwrap();
    println!("Compact: {}\n", json_compact);

    let json_pretty = serde_json::to_string_pretty(&citizen).unwrap();
    println!("Pretty:\n{}", json_pretty);
}

// ============================================================
// SECTION 2: BASIC DESERIALIZATION — JSON to Struct
// ============================================================

fn demo_basic_deserialization() {
    println!("\n--- 2. Deserialization (JSON -> Struct) ---\n");

    let json_data = r#"{
        "name": "Priya Patel",
        "aadhaar_number": "9876-5432-1098",
        "age": 28,
        "is_verified": false,
        "address": { "street": "15 Nehru Nagar", "city": "Ahmedabad", "state": "Gujarat", "pin_code": "380015" }
    }"#;

    let citizen: Citizen = serde_json::from_str(json_data).expect("Deserialization failed");
    println!("Name: {}, City: {}, Verified: {}", citizen.name, citizen.address.city, citizen.is_verified);

    let bad_json = r#"{"name": "incomplete"#;
    match serde_json::from_str::<Citizen>(bad_json) {
        Ok(_) => println!("Unexpected success"),
        Err(e) => println!("Error (expected): {}", e),
    }
}

// ============================================================
// SECTION 3: SERDE ATTRIBUTES
// ============================================================
// rename, default, skip_serializing, skip_serializing_if, alias

#[derive(Debug, Serialize, Deserialize)]
struct BankAccount {
    #[serde(rename = "account_holder")]
    holder_name: String,

    #[serde(rename = "acc_number")]
    account_number: String,

    #[serde(default)]
    balance: f64,

    #[serde(skip_serializing)]
    internal_risk_score: u32,

    #[serde(skip_serializing_if = "Option::is_none")]
    nominee: Option<String>,

    #[serde(alias = "acc_type", alias = "type")]
    account_type: String,
}

fn demo_serde_attributes() {
    println!("\n--- 3. Serde Attributes ---\n");

    let json_data = r#"{
        "account_holder": "Vikram Singh",
        "acc_number": "SBI-001234567890",
        "balance": 250000.50,
        "internal_risk_score": 15,
        "nominee": "Anita Singh",
        "account_type": "Savings"
    }"#;

    let account: BankAccount = serde_json::from_str(json_data).unwrap();
    let serialized = serde_json::to_string_pretty(&account).unwrap();
    println!("Serialized (risk_score hidden):\n{}", serialized);

    // Missing optional and default fields
    let minimal = r#"{ "account_holder": "Meena", "acc_number": "PNB-009", "acc_type": "Current" }"#;
    let acct2: BankAccount = serde_json::from_str(minimal).unwrap();
    println!("\nMinimal: balance={} (default), nominee={:?}", acct2.balance, acct2.nominee);
}

// ============================================================
// SECTION 4: Vec AND HashMap
// ============================================================

fn demo_collections() {
    println!("\n--- 4. Collections ---\n");

    #[derive(Debug, Serialize, Deserialize)]
    struct EkycResponse {
        request_id: String,
        citizens: Vec<Citizen>,
        metadata: HashMap<String, String>,
    }

    let mut metadata = HashMap::new();
    metadata.insert("api_version".into(), "2.1".into());

    let response = EkycResponse {
        request_id: String::from("REQ-2026-001"),
        citizens: vec![Citizen {
            name: "Arjun Reddy".into(), aadhaar_number: "1111-2222-3333".into(),
            age: 35, is_verified: true,
            address: Address { street: "7 Tank Bund".into(), city: "Hyderabad".into(),
                               state: "Telangana".into(), pin_code: "500001".into() },
        }],
        metadata,
    };

    let json = serde_json::to_string_pretty(&response).unwrap();
    println!("{}", json);

    let parsed: EkycResponse = serde_json::from_str(&json).unwrap();
    println!("\nParsed: {} citizens", parsed.citizens.len());
}

// ============================================================
// SECTION 5: DYNAMIC JSON WITH Value
// ============================================================
// Use when you don't know the structure at compile time.

fn demo_dynamic_json() {
    println!("\n--- 5. Dynamic JSON ---\n");

    let data = r#"{
        "service": "DigiLocker",
        "user_count": 150000000,
        "features": ["Aadhaar", "PAN", "Driving License"]
    }"#;

    let v: Value = serde_json::from_str(data).unwrap();
    println!("Service: {}", v["service"]);
    println!("Users: {}", v["user_count"]);
    println!("First feature: {}", v["features"][0]);
    println!("Missing field: {}", v["nonexistent"]); // returns null

    if let Some(count) = v["user_count"].as_u64() {
        println!("Users: {} crore", count / 10_000_000);
    }

    // json! macro builds Value inline
    let stats = json!({
        "platform": "UPI",
        "monthly_txns": 12_000_000_000u64,
        "top_apps": ["PhonePe", "GPay", "Paytm"]
    });
    println!("\n{}", serde_json::to_string_pretty(&stats).unwrap());
}

// ============================================================
// SECTION 6: ENUM SERIALIZATION
// ============================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TransactionStatus { Pending, Completed, Failed }

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
enum PaymentMethod {
    #[serde(rename = "upi")]
    Upi { vpa: String },
    #[serde(rename = "card")]
    Card { last_four: String, network: String },
}

#[derive(Debug, Serialize, Deserialize)]
struct Transaction {
    id: String,
    amount: f64,
    status: TransactionStatus,
    payment_method: PaymentMethod,
}

fn demo_enum_serialization() {
    println!("\n--- 6. Enum Serialization ---\n");

    let txn = Transaction {
        id: "TXN-789".into(), amount: 2499.0,
        status: TransactionStatus::Completed,
        payment_method: PaymentMethod::Upi { vpa: "rahul@okaxis".into() },
    };

    let json = serde_json::to_string_pretty(&txn).unwrap();
    println!("{}", json);

    let parsed: Transaction = serde_json::from_str(&json).unwrap();
    println!("\nParsed: {} - Rs. {:.2}", parsed.id, parsed.amount);
}

// ============================================================
// SECTION 7: ERROR HANDLING
// ============================================================

fn demo_error_handling() {
    println!("\n--- 7. Error Handling ---\n");

    let inputs = vec![
        (r#"{"name":"A","aadhaar_number":"1","age":25,"is_verified":true,"address":{"street":"s","city":"c","state":"st","pin_code":"p"}}"#, "valid"),
        (r#"{"broken": true}"#, "missing fields"),
        (r#"not json"#, "malformed"),
    ];

    for (input, desc) in inputs {
        match serde_json::from_str::<Citizen>(input) {
            Ok(c) => println!("  {}: OK - {}", desc, c.name),
            Err(e) => println!("  {}: FAILED - {}", desc, e),
        }
    }
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    println!("=== Serde and JSON in Rust ===\n");

    demo_basic_serialization();
    demo_basic_deserialization();
    demo_serde_attributes();
    demo_collections();
    demo_dynamic_json();
    demo_enum_serialization();
    demo_error_handling();

    println!("\n=== Serde and JSON Complete ===");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. #[derive(Serialize, Deserialize)] on structs — that's it
//    for basic usage. Compile-time, zero overhead.
// 2. to_string() serializes, from_str() deserializes. Both
//    return Result.
// 3. Attributes: rename, default, skip_serializing,
//    skip_serializing_if, alias — bridge Rust to external APIs.
// 4. serde_json::Value for unknown JSON. json!() macro for inline.
// 5. Vec -> JSON array, HashMap -> JSON object, automatically.
// 6. Enum tagging: #[serde(tag = "type", content = "data")].
// 7. Errors are descriptive (line, column, what went wrong).
//    Never unwrap() in production.
// 8. Round-trip (serialize then deserialize) should preserve data.
// ============================================================

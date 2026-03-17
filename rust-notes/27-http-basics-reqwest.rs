// ============================================================
// 27. HTTP BASICS WITH REQWEST IN RUST
// ============================================================
// Reqwest is Rust's most popular HTTP client — built on hyper/tokio.
// Handles TLS, cookies, redirects, timeouts out of the box.
// ============================================================

// CARGO.TOML:
// [dependencies]
// reqwest = { version = "0.12", features = ["json", "blocking"] }
// tokio = { version = "1", features = ["full"] }
// serde = { version = "1.0", features = ["derive"] }
// serde_json = "1.0"

// ============================================================
// STORY: PAYTM RECHARGE SYSTEM
// ============================================================
// 1. GET telecom API to check subscriber plan/balance
// 2. POST recharge request with JSON body
// 3. Parse JSON response, update transaction history
// 4. Handle timeouts and errors gracefully
// ============================================================

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
struct RechargeRequest {
    phone: String,
    plan_id: String,
    amount: f64,
    payment_method: String,
}

// ============================================================
// SECTION 1: BASIC GET REQUEST
// ============================================================

async fn demo_get_request() {
    println!("--- 1. Basic GET ---\n");

    // Create ONE client and reuse — manages connection pool
    let client = reqwest::Client::new();

    match client.get("https://httpbin.org/get").send().await {
        Ok(response) => {
            println!("Status: {}", response.status());
            if let Ok(body) = response.text().await {
                let preview = if body.len() > 200 { format!("{}...", &body[..200]) } else { body };
                println!("Body: {}", preview);
            }
        }
        Err(e) => eprintln!("Failed: {} (expected if offline)", e),
    }

    // GET with query parameters
    println!("\nGET with query params:");
    match client.get("https://httpbin.org/get")
        .query(&[("phone", "9876543210"), ("operator", "jio")])
        .send().await
    {
        Ok(resp) => println!("Status: {}", resp.status()),
        Err(e) => eprintln!("Failed: {}", e),
    }
}

// ============================================================
// SECTION 2: GET WITH HEADERS
// ============================================================

async fn demo_get_with_headers() {
    println!("\n--- 2. GET with Headers ---\n");

    let client = reqwest::Client::new();

    match client.get("https://httpbin.org/headers")
        .header("Authorization", "Bearer paytm-api-key-xyz789")
        .header("Accept", "application/json")
        .send().await
    {
        Ok(resp) => println!("Status: {}", resp.status()),
        Err(e) => eprintln!("Failed: {}", e),
    }

    // Client with default headers (sent on every request)
    use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_static("Bearer my-token"));
    headers.insert(USER_AGENT, HeaderValue::from_static("PaytmBot/2.1"));

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build().unwrap();

    match client.get("https://httpbin.org/headers").send().await {
        Ok(resp) => println!("With defaults: {}", resp.status()),
        Err(e) => eprintln!("Failed: {}", e),
    }
}

// ============================================================
// SECTION 3: POST WITH JSON BODY
// ============================================================

async fn demo_post_request() {
    println!("\n--- 3. POST with JSON ---\n");

    let client = reqwest::Client::new();

    // .json() auto-serializes and sets Content-Type
    let recharge = RechargeRequest {
        phone: "9876543210".into(), plan_id: "RC399".into(),
        amount: 399.0, payment_method: "paytm_wallet".into(),
    };

    match client.post("https://httpbin.org/post").json(&recharge).send().await {
        Ok(resp) => println!("Status: {}", resp.status()),
        Err(e) => eprintln!("Failed: {}", e),
    }

    // HashMap for dynamic JSON
    let mut body = HashMap::new();
    body.insert("action", "check_balance");
    body.insert("phone", "9876543210");

    match client.post("https://httpbin.org/post").json(&body).send().await {
        Ok(resp) => println!("HashMap POST: {}", resp.status()),
        Err(e) => eprintln!("Failed: {}", e),
    }
}

// ============================================================
// SECTION 4: PARSING JSON RESPONSES
// ============================================================

#[derive(Debug, Deserialize)]
struct HttpBinResponse {
    origin: String,
    url: String,
    #[serde(default)]
    args: HashMap<String, String>,
}

async fn demo_json_response() {
    println!("\n--- 4. JSON Responses ---\n");

    let client = reqwest::Client::new();

    // .json::<T>() deserializes response body into struct
    match client.get("https://httpbin.org/get")
        .query(&[("phone", "9876543210")])
        .send().await
    {
        Ok(resp) => match resp.json::<HttpBinResponse>().await {
            Ok(data) => println!("Origin: {}, Args: {:?}", data.origin, data.args),
            Err(e) => eprintln!("Parse error: {}", e),
        },
        Err(e) => eprintln!("Failed: {}", e),
    }

    // Parse as dynamic Value for unknown structures
    match client.get("https://httpbin.org/get").send().await {
        Ok(resp) => if let Ok(v) = resp.json::<serde_json::Value>().await {
            println!("Dynamic: origin={}", v["origin"]);
        },
        Err(e) => eprintln!("Failed: {}", e),
    }
}

// ============================================================
// SECTION 5: TIMEOUTS
// ============================================================
// Always set timeouts in production.

async fn demo_timeouts() {
    println!("\n--- 5. Timeouts ---\n");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .connect_timeout(Duration::from_secs(5))
        .build().unwrap();

    match client.get("https://httpbin.org/get").send().await {
        Ok(resp) => println!("Normal: {}", resp.status()),
        Err(e) if e.is_timeout() => println!("TIMEOUT!"),
        Err(e) => eprintln!("Error: {}", e),
    }

    // Strict timeout against slow endpoint
    let fast = reqwest::Client::builder().timeout(Duration::from_secs(2)).build().unwrap();
    match fast.get("https://httpbin.org/delay/3").send().await {
        Ok(resp) => println!("Status: {}", resp.status()),
        Err(e) if e.is_timeout() => println!("TIMEOUT (expected): server needs 3s, we wait 2s"),
        Err(e) => eprintln!("Error: {}", e),
    }
}

// ============================================================
// SECTION 6: ERROR HANDLING
// ============================================================

async fn demo_error_handling() {
    println!("\n--- 6. Error Handling ---\n");

    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().unwrap();

    // Check status codes
    for (url, desc) in [
        ("https://httpbin.org/status/200", "OK"),
        ("https://httpbin.org/status/404", "Not Found"),
        ("https://httpbin.org/status/500", "Server Error"),
    ] {
        match client.get(url).send().await {
            Ok(resp) => {
                let s = resp.status();
                if s.is_success() { println!("  {} -> Success", desc); }
                else if s.is_client_error() { println!("  {} -> Client Error", desc); }
                else if s.is_server_error() { println!("  {} -> Server Error", desc); }
            }
            Err(e) => eprintln!("  {} -> Network: {}", desc, e),
        }
    }

    // error_for_status() converts 4xx/5xx to Err
    match client.get("https://httpbin.org/status/404").send().await
        .and_then(|r| r.error_for_status())
    {
        Ok(_) => println!("Success"),
        Err(e) => println!("\nerror_for_status: {}", e),
    }
}

// ============================================================
// SECTION 7: OTHER HTTP METHODS
// ============================================================

async fn demo_other_methods() {
    println!("\n--- 7. PUT / PATCH / DELETE ---\n");

    let client = reqwest::Client::new();

    let data = serde_json::json!({"phone": "9876543210", "new_plan": "RC599"});
    match client.put("https://httpbin.org/put").json(&data).send().await {
        Ok(r) => println!("PUT: {}", r.status()),
        Err(e) => eprintln!("Error: {}", e),
    }

    match client.patch("https://httpbin.org/patch")
        .json(&serde_json::json!({"balance": 599.0})).send().await {
        Ok(r) => println!("PATCH: {}", r.status()),
        Err(e) => eprintln!("Error: {}", e),
    }

    match client.delete("https://httpbin.org/delete").send().await {
        Ok(r) => println!("DELETE: {}", r.status()),
        Err(e) => eprintln!("Error: {}", e),
    }
}

// ============================================================
// SECTION 8: REUSABLE API CLIENT
// ============================================================
// Wrap reqwest in a domain-specific client with base URL, auth, timeouts.

struct TelecomApiClient {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
}

impl TelecomApiClient {
    fn new(base_url: &str, api_key: &str) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build().unwrap();
        TelecomApiClient { client, base_url: base_url.into(), api_key: api_key.into() }
    }

    async fn get_subscriber(&self, phone: &str) -> Result<String, String> {
        self.client.get(&format!("{}/subscriber/{}", self.base_url, phone))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send().await.map_err(|e| format!("Request: {}", e))?
            .error_for_status().map_err(|e| format!("API: {}", e))?
            .text().await.map_err(|e| format!("Body: {}", e))
    }
}

async fn demo_api_client() {
    println!("\n--- 8. Reusable API Client ---\n");

    let api = TelecomApiClient::new("https://httpbin.org", "secret-key");
    match api.get_subscriber("9876543210").await {
        Ok(r) => { let p = if r.len() > 100 { format!("{}...", &r[..100]) } else { r }; println!("{}", p); }
        Err(e) => println!("Error (expected): {}", e),
    }
}

// ============================================================
// SECTION 9: BLOCKING REQUESTS (Reference)
// ============================================================
// reqwest::blocking::Client for non-async code (scripts, CLIs).
// Don't use inside async runtime — causes deadlocks.
//
//   let client = reqwest::blocking::Client::new();
//   let resp = client.get(url).send()?;
//   let data: MyStruct = resp.json()?;

// ============================================================
// MAIN
// ============================================================

#[tokio::main]
async fn main() {
    println!("=== HTTP Basics with Reqwest ===\n");

    demo_get_request().await;
    demo_get_with_headers().await;
    demo_post_request().await;
    demo_json_response().await;
    demo_timeouts().await;
    demo_error_handling().await;
    demo_other_methods().await;
    demo_api_client().await;

    println!("\n=== HTTP Basics Complete ===");
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Create ONE Client and reuse — manages connection pools.
// 2. GET: client.get(url).query(&[...]).send().await
// 3. POST: client.post(url).json(&data).send().await
// 4. Headers: .header() per-request, or default_headers() on client.
// 5. response.json::<T>() deserializes. Use Value for unknowns.
// 6. Always set timeouts. Check is_timeout() on errors.
// 7. error_for_status() turns 4xx/5xx into Rust Err values.
// 8. PUT/PATCH/DELETE follow the same builder pattern.
// 9. blocking::Client for non-async. Never mix with async runtime.
// ============================================================

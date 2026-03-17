// ============================================================
//  FILE 21: HTTP Client
// ============================================================
//  Topic: http.Get, http.Post, http.Client, http.NewRequest,
//         JSON responses, custom headers, query params,
//         timeouts, error handling.
//
//  WHY: Almost every Go program talks to other services over
//  HTTP. The stdlib client is production-ready with timeouts,
//  redirects, and connection pooling built in.
// ============================================================
//
//  STORY — "India Post Client"
//  Lakshmi sends dak OUT. Each parcel needs an address (URL),
//  contents (body), and stamps (headers). Every receipt
//  (response body) must be closed to avoid piling up.
// ============================================================

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"time"
)

func main() {
	// Setup: local test server
	mux := http.NewServeMux()

	mux.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Namaste from the remote post office!"))
	})

	mux.HandleFunc("/echo", func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		defer r.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"method": r.Method, "query": r.URL.RawQuery,
			"content_type": r.Header.Get("Content-Type"),
			"user_agent":   r.Header.Get("User-Agent"),
			"body":         string(bodyBytes),
		})
	})

	mux.HandleFunc("/parcels", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]map[string]any{
			{"id": 1, "destination": "Chennai", "weight_kg": 2.5},
			{"id": 2, "destination": "Kolkata", "weight_kg": 1.2},
		})
	})

	mux.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.Write([]byte("Finally!"))
	})

	mux.HandleFunc("/not-found", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		w.Write([]byte("Dak not found"))
	})

	ts := httptest.NewServer(mux)
	defer ts.Close()

	// ============================================================
	// BLOCK 1 — Basic GET/POST, Client, JSON
	// ============================================================

	fmt.Println("--- BLOCK 1: Basic GET/POST, http.Client ---")

	// SECTION: http.Get
	resp, _ := http.Get(ts.URL + "/hello")
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close() // ALWAYS close response body
	fmt.Println("GET /hello:", string(body))

	// SECTION: http.Post
	postBody := strings.NewReader(`{"from":"Lakshmi","message":"Priority delivery"}`)
	resp, _ = http.Post(ts.URL+"/echo", "application/json", postBody)
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	var echoResult map[string]any
	json.Unmarshal(body, &echoResult)
	fmt.Println("POST /echo method:", echoResult["method"])

	// SECTION: http.Client with timeout
	// Default client has NO timeout. Always create one for production.
	client := &http.Client{Timeout: 100 * time.Millisecond}

	fmt.Println("\n--- Client with timeout ---")
	resp, err := client.Get(ts.URL + "/hello")
	if err == nil {
		body, _ = io.ReadAll(resp.Body)
		resp.Body.Close()
		fmt.Println("Fast request:", string(body))
	}

	_, err = client.Get(ts.URL + "/slow")
	if err != nil {
		fmt.Println("Slow request timed out (expected)")
	}

	// SECTION: Parsing JSON responses
	fmt.Println("\n--- JSON responses ---")

	type Parcel struct {
		ID          int     `json:"id"`
		Destination string  `json:"destination"`
		WeightKg    float64 `json:"weight_kg"`
	}

	resp, _ = http.Get(ts.URL + "/parcels")
	var parcels []Parcel
	json.NewDecoder(resp.Body).Decode(&parcels)
	resp.Body.Close()

	for _, p := range parcels {
		fmt.Printf("  Parcel %d -> %s (%.1f kg)\n", p.ID, p.Destination, p.WeightKg)
	}

	// ============================================================
	// BLOCK 2 — Custom Requests, Headers, Error Handling
	// ============================================================

	fmt.Println("\n--- BLOCK 2: Custom Requests, Headers, Errors ---")

	// SECTION: http.NewRequest with headers
	goodClient := &http.Client{Timeout: 5 * time.Second}

	req, _ := http.NewRequest("GET", ts.URL+"/echo", nil)
	req.Header.Set("User-Agent", "IndiaPostClient/1.0")
	resp, _ = goodClient.Do(req)
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	var hResult map[string]any
	json.Unmarshal(body, &hResult)
	fmt.Println("User-Agent:", hResult["user_agent"])

	// SECTION: Query parameters with url.Values
	fmt.Println("\n--- Query parameters ---")

	baseURL, _ := url.Parse(ts.URL + "/echo")
	params := url.Values{}
	params.Add("q", "speed post & registered")
	params.Add("page", "2")
	baseURL.RawQuery = params.Encode()

	resp, _ = http.Get(baseURL.String())
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	var qResult map[string]any
	json.Unmarshal(body, &qResult)
	fmt.Println("Server query:", qResult["query"])

	// SECTION: POST with JSON body
	fmt.Println("\n--- POST JSON body ---")

	type DakRequest struct {
		From, To, Message string
	}
	dak := DakRequest{"Lakshmi", "Mehra", "Manuscript arrived!"}
	jsonBytes, _ := json.Marshal(dak)
	req, _ = http.NewRequest("POST", ts.URL+"/echo", strings.NewReader(string(jsonBytes)))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = goodClient.Do(req)
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	var pResult map[string]any
	json.Unmarshal(body, &pResult)
	fmt.Println("Posted body:", pResult["body"])

	// SECTION: Error handling — check BOTH err AND status code
	fmt.Println("\n--- Error handling ---")

	doRequest := func(urlStr string) {
		resp, err := goodClient.Get(urlStr)
		if err != nil {
			fmt.Printf("  Network error: %v\n", err)
			return
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode >= 400 {
			fmt.Printf("  HTTP %d: %s\n", resp.StatusCode, body)
			return
		}
		fmt.Printf("  Success (%d): %s\n", resp.StatusCode, body)
	}

	doRequest(ts.URL + "/hello")
	doRequest(ts.URL + "/not-found")
	doRequest("http://127.0.0.1:1/unreachable")

	// SECTION: Response headers
	fmt.Println("\n--- Response headers ---")
	resp, _ = http.Get(ts.URL + "/parcels")
	fmt.Println("Content-Type:", resp.Header.Get("Content-Type"))
	resp.Body.Close()
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. http.Get/Post: convenience functions. Default client has NO timeout.
// 2. ALWAYS close resp.Body with defer. Leaking bodies leaks connections.
// 3. Create http.Client{Timeout: ...} for production use.
// 4. http.NewRequest for custom method, headers, body. Then client.Do(req).
// 5. url.Values for query strings — handles encoding automatically.
// 6. json.NewDecoder(resp.Body).Decode() streams JSON from response.
// 7. Check BOTH err (network) AND resp.StatusCode (HTTP error).
// 8. httptest.NewServer for self-contained client testing.
// ============================================================

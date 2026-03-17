// ============================================================
//  FILE 20: HTTP Server
// ============================================================
//  Topic: http.HandleFunc, ServeMux, http.Handler, JSON
//         responses, middleware, graceful shutdown.
//
//  WHY: Go's standard library includes a production-grade HTTP
//  server. Understanding handlers, muxes, and middleware is the
//  foundation for any web service or API.
// ============================================================
//
//  STORY — "India Post Office"
//  Postmaster Lakshmi routes dak. Each clerk (handler) handles
//  a specific request type. The sorting room (ServeMux) routes
//  dak. Middleware is the security checkpoint. Graceful shutdown
//  finishes every parcel in progress.
// ============================================================

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"time"
)

type dakItem struct {
	ID      int    `json:"id"`
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
}

type footfallCounter struct {
	mu    sync.Mutex
	count int
}

func (fc *footfallCounter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fc.mu.Lock()
	fc.count++
	current := fc.count
	fc.mu.Unlock()
	fmt.Fprintf(w, "Footfall count: %d", current)
}

func main() {
	// ============================================================
	// BLOCK 1 — Basic Handlers, ServeMux, JSON
	// ============================================================

	fmt.Println("--- BLOCK 1: Handlers, ServeMux, JSON ---")

	mux := http.NewServeMux()

	// SECTION: Basic handler
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Welcome to India Post!"))
	})

	// SECTION: JSON response
	mux.HandleFunc("/dak", func(w http.ResponseWriter, r *http.Request) {
		items := []dakItem{
			{1, "Ramesh", "Suresh", "Speed Post"},
			{2, "Anita", "Kavita", "Money Order"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	})

	// SECTION: Custom http.Handler with state
	counter := &footfallCounter{}
	mux.Handle("/footfall", counter)

	server1 := httptest.NewServer(mux)
	defer server1.Close()

	resp, _ := http.Get(server1.URL + "/")
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Println("GET /:", string(body))

	resp, _ = http.Get(server1.URL + "/dak")
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Println("GET /dak:", strings.TrimSpace(string(body)))

	http.Get(server1.URL + "/footfall")
	http.Get(server1.URL + "/footfall")
	resp, _ = http.Get(server1.URL + "/footfall")
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Println("GET /footfall:", string(body))

	// ============================================================
	// BLOCK 2 — Request Parsing, Middleware
	// ============================================================

	fmt.Println("\n--- BLOCK 2: Request Parsing, Middleware ---")

	mux2 := http.NewServeMux()

	// SECTION: Query parameters and POST body
	mux2.HandleFunc("/track", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		fmt.Fprintf(w, "Tracking %q via %s", q.Get("id"), q.Get("type"))
	})

	mux2.HandleFunc("/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var item dakItem
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "dispatched", "from": item.From, "to": item.To,
		})
	})

	// SECTION: Middleware pattern
	// Middleware wraps a handler: takes http.Handler, returns http.Handler.

	loggingMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			fmt.Printf("  [LOG] %s %s — %v\n", r.Method, r.URL.Path, time.Since(start).Round(time.Microsecond))
		})
	}

	authMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-Postal-Seal") != "india-post-123" {
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte("Unauthorized"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}

	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Welcome to the sorting room!"))
	})
	mux2.Handle("/protected", loggingMiddleware(authMiddleware(protectedHandler)))

	server2 := httptest.NewServer(loggingMiddleware(mux2))
	defer server2.Close()

	resp, _ = http.Get(server2.URL + "/track?id=EM123&type=registered")
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Println("GET /track:", string(body))

	resp, _ = http.Get(server2.URL + "/protected")
	fmt.Printf("GET /protected (no seal): %d\n", resp.StatusCode)
	resp.Body.Close()

	req, _ := http.NewRequest("GET", server2.URL+"/protected", nil)
	req.Header.Set("X-Postal-Seal", "india-post-123")
	resp, _ = http.DefaultClient.Do(req)
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Printf("GET /protected (with seal): %d %s\n", resp.StatusCode, string(body))

	// ============================================================
	// BLOCK 3 — Graceful Shutdown
	// ============================================================

	fmt.Println("\n--- BLOCK 3: Graceful Shutdown ---")

	mux3 := http.NewServeMux()
	mux3.HandleFunc("/hello", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Namaste!"))
	})

	ts := httptest.NewUnstartedServer(mux3)
	ts.Start()

	resp, _ = http.Get(ts.URL + "/hello")
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	fmt.Println("GET /hello:", string(body))

	ts.Close()
	fmt.Println("Server shut down gracefully.")

	// Production pattern reference:
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = shutdownCtx // srv.Shutdown(shutdownCtx) in production
}

// ──────────────────────────────────────────────────────────────
// Production graceful shutdown pattern (reference, not called):
//
// func gracefulServerExample() {
//     srv := &http.Server{
//         Addr: ":8080", Handler: mux,
//         ReadTimeout: 5*time.Second, WriteTimeout: 10*time.Second,
//     }
//     go func() { srv.ListenAndServe() }()
//     ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
//     defer stop()
//     <-ctx.Done()
//     srv.Shutdown(context.WithTimeout(context.Background(), 10*time.Second))
// }

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Handler = func(w ResponseWriter, r *Request). Register on ServeMux.
// 2. Set w.Header() BEFORE w.Write(). Order: headers, status, body.
// 3. json.NewEncoder(w).Encode() streams JSON to the response.
// 4. http.Handler interface: implement ServeHTTP for stateful handlers.
// 5. Middleware: func(http.Handler) http.Handler. Chain for logging/auth.
// 6. httptest.NewServer: real server for testing, auto cleanup.
// 7. Graceful shutdown: http.Server.Shutdown(ctx) + signal.NotifyContext.
// 8. Always close r.Body and resp.Body.
// ============================================================

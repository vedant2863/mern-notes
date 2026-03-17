// ============================================================
//  FILE 15: CHANNELS
// ============================================================
//  Topic: Unbuffered/buffered channels, directional channels,
//         close/range, channel axioms, and common patterns.
//
//  WHY: Channels are Go's primary goroutine communication
//  mechanism. "Share memory by communicating."
// ============================================================
//
//  STORY — "The Dabbawala Network"
//  Dabbawala Ganesh works in Mumbai's tiffin delivery network.
//  Each relay point (channel) carries one tiffin at a time.
//  Unbuffered = sender waits for receiver. Buffered = holding
//  rack at the station. Closed relay = no more sends allowed.
// ============================================================

package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {
	// ============================================================
	//  EXAMPLE BLOCK 1 — Unbuffered Channels
	// ============================================================

	fmt.Println("============================================================")
	fmt.Println("  BLOCK 1: Unbuffered Channels — Synchronous Communication")
	fmt.Println("============================================================")

	// SECTION: Creating an unbuffered channel
	// make(chan T) creates an unbuffered channel. Send blocks
	// until a receiver is ready and vice versa.

	fmt.Println("\n--- Unbuffered channel basics ---")

	relay := make(chan string)

	go func() {
		relay <- "Urgent tiffin from Andheri"
		fmt.Println("  Ganesh: Tiffin picked up!")
	}()

	tiffin := <-relay
	fmt.Println("  Receiver got:", tiffin)
	// Output: Receiver got: Urgent tiffin from Andheri

	time.Sleep(10 * time.Millisecond)

	// SECTION: Channel for synchronization (done signal)
	fmt.Println("\n--- Done signal ---")

	done := make(chan bool)

	go func() {
		fmt.Println("  Dabbawala Mohan: sorting tiffins...")
		time.Sleep(30 * time.Millisecond)
		done <- true
	}()

	<-done
	fmt.Println("  Main: Mohan finished, proceeding.")

	// SECTION: Multiple values + close/range
	fmt.Println("\n--- Sending multiple tiffins ---")

	tiffins := make(chan int)

	go func() {
		for i := 1; i <= 5; i++ {
			tiffins <- i
		}
		close(tiffins) // no more tiffins
	}()

	for n := range tiffins {
		fmt.Printf("  Received tiffin: %d\n", n)
	}

	// SECTION: Directional channels
	// chan<- T = send-only, <-chan T = receive-only.
	fmt.Println("\n--- Directional channels ---")

	produce := func(out chan<- int) {
		for i := 10; i <= 12; i++ {
			out <- i
		}
		close(out)
	}

	consume := func(in <-chan int) {
		for v := range in {
			fmt.Printf("  Delivered tiffin: %d\n", v)
		}
	}

	pipe := make(chan int)
	go produce(pipe)
	consume(pipe)

	// ============================================================
	//  EXAMPLE BLOCK 2 — Buffered Channels, Range & Close
	// ============================================================

	fmt.Println("\n============================================================")
	fmt.Println("  BLOCK 2: Buffered Channels, Range & Close")
	fmt.Println("============================================================")

	// SECTION: Buffered channels
	// Send blocks ONLY when full. Receive blocks ONLY when empty.
	fmt.Println("\n--- Buffered channel basics ---")

	rack := make(chan string, 3)

	rack <- "Tiffin A"
	rack <- "Tiffin B"
	rack <- "Tiffin C"

	fmt.Printf("  Rack length: %d, capacity: %d\n", len(rack), cap(rack))
	// Output: Rack length: 3, capacity: 3

	fmt.Println("  FIFO:", <-rack, <-rack, <-rack)

	// SECTION: Buffered channel as semaphore
	fmt.Println("\n--- Buffered channel as semaphore ---")

	sem := make(chan struct{}, 2) // max 2 concurrent
	var wg sync.WaitGroup

	for i := 1; i <= 5; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			sem <- struct{}{}
			fmt.Printf("  Dabbawala %d: delivering (limit=2)\n", id)
			time.Sleep(30 * time.Millisecond)
			<-sem
		}(i)
	}

	wg.Wait()

	// SECTION: close() and range
	fmt.Println("\n--- close() and range ---")

	ch := make(chan int, 5)
	for i := 1; i <= 5; i++ {
		ch <- i * 10
	}
	close(ch)

	fmt.Print("  Tiffin IDs: ")
	for v := range ch {
		fmt.Printf("%d ", v)
	}
	fmt.Println()
	// Output: Tiffin IDs: 10 20 30 40 50

	// SECTION: Comma-ok idiom
	fmt.Println("\n--- Comma-ok for closed channels ---")

	ch2 := make(chan int, 1)
	ch2 <- 42
	close(ch2)

	val, ok := <-ch2
	fmt.Printf("  val=%d, ok=%v\n", val, ok) // 42, true

	val, ok = <-ch2
	fmt.Printf("  val=%d, ok=%v (closed)\n", val, ok) // 0, false

	// ============================================================
	//  EXAMPLE BLOCK 3 — Channel Axioms & Patterns
	// ============================================================

	fmt.Println("\n============================================================")
	fmt.Println("  BLOCK 3: Channel Axioms, Patterns & Deadlock")
	fmt.Println("============================================================")

	// SECTION: The Three Channel Axioms
	fmt.Println("\n--- The Three Channel Axioms ---")

	// Axiom 1: Send to closed channel -> PANIC
	func() {
		defer func() {
			if r := recover(); r != nil {
				fmt.Println("  Axiom 1 — Send to closed:", r)
			}
		}()
		ch := make(chan int)
		close(ch)
		ch <- 1
	}()

	// Axiom 2: Receive from closed channel -> zero value
	func() {
		ch := make(chan int)
		close(ch)
		fmt.Printf("  Axiom 2 — Receive from closed: %d (zero)\n", <-ch)
	}()

	// Axiom 3: Send/receive on nil channel -> block forever
	fmt.Println("  Axiom 3 — nil channel blocks forever (useful in select to disable a case)")

	// Summary table
	fmt.Println("\n  Operation      | nil chan  | closed chan  | open chan")
	fmt.Println("  ───────────────┼──────────┼─────────────┼──────────")
	fmt.Println("  send (ch<-)    | block    | PANIC       | send/block")
	fmt.Println("  receive (<-ch) | block    | zero, false | recv/block")
	fmt.Println("  close(ch)      | PANIC    | PANIC       | close OK")

	// SECTION: Generator pattern
	fmt.Println("\n--- Pattern: Generator function ---")

	fibonacci := func(n int) <-chan int {
		ch := make(chan int)
		go func() {
			a, b := 0, 1
			for i := 0; i < n; i++ {
				ch <- a
				a, b = b, a+b
			}
			close(ch)
		}()
		return ch
	}

	fmt.Print("  Fibonacci(8): ")
	for v := range fibonacci(8) {
		fmt.Printf("%d ", v)
	}
	fmt.Println()
	// Output: Fibonacci(8): 0 1 1 2 3 5 8 13

	// SECTION: Pipeline pattern
	fmt.Println("\n--- Pattern: Pipeline ---")

	gen := func(nums ...int) <-chan int {
		out := make(chan int)
		go func() {
			for _, n := range nums {
				out <- n
			}
			close(out)
		}()
		return out
	}

	square := func(in <-chan int) <-chan int {
		out := make(chan int)
		go func() {
			for n := range in {
				out <- n * n
			}
			close(out)
		}()
		return out
	}

	fmt.Print("  gen -> square: ")
	for v := range square(gen(2, 3, 4, 5)) {
		fmt.Printf("%d ", v)
	}
	fmt.Println()
	// Output: gen -> square: 4 9 16 25

	// SECTION: Deadlock detection
	fmt.Println("\n--- Deadlock detection ---")
	fmt.Println("  Go detects when ALL goroutines are blocked:")
	fmt.Println("    fatal error: all goroutines are asleep - deadlock!")
	fmt.Println("  Common causes: no receiver, no sender, circular wait, forgot close")

	// ============================================================
	//  KEY TAKEAWAYS
	// ============================================================
	fmt.Println("\n============================================================")
	fmt.Println("  KEY TAKEAWAYS")
	fmt.Println("============================================================")
	fmt.Println(`
  1. Unbuffered channels synchronize sender and receiver (rendezvous).
  2. Buffered channels decouple timing. Blocks only when full/empty.
  3. Directional channels (chan<- T, <-chan T) enforce send/receive roles.
  4. close(ch) signals "no more values." Only the SENDER should close.
  5. Three axioms: send-to-closed=panic, recv-from-closed=zero, nil=block.
  6. Generator pattern: return <-chan T from a goroutine-spawning function.
  7. Pipeline pattern: chain generators stage by stage via channels.
  8. Go detects deadlocks only when ALL goroutines are stuck.`)
}

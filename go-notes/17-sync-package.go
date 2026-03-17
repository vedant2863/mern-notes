// ============================================================
//  FILE 17: THE SYNC PACKAGE
// ============================================================
//  Topic: Mutex, RWMutex, Once, sync.Map, sync.Pool,
//         sync/atomic — tools for safe concurrent access.
//
//  WHY: While channels are preferred, sometimes you need to
//  protect shared state directly. sync provides the building
//  blocks for mutual exclusion and atomic operations.
// ============================================================
//
//  STORY — "SBI Locker Room"
//  Guard Raju manages the SBI locker room. Mutex = locker key
//  (one customer at a time). RWMutex = notice board (many read,
//  one write). Once = vault combination (set once). sync.Map =
//  locker register. sync.Pool = reusable token counter.
// ============================================================

package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	// ============================================================
	//  EXAMPLE BLOCK 1 — Mutex, RWMutex, Once
	// ============================================================

	fmt.Println("============================================================")
	fmt.Println("  BLOCK 1: Mutex, RWMutex & Once")
	fmt.Println("============================================================")

	// SECTION: sync.Mutex — exclusive access
	fmt.Println("\n--- sync.Mutex ---")

	type SafeCounter struct {
		mu    sync.Mutex
		value int
	}

	counter := &SafeCounter{}
	var wg sync.WaitGroup

	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			counter.mu.Lock()
			counter.value++
			counter.mu.Unlock()
		}()
	}

	wg.Wait()
	fmt.Printf("  Counter (expected 1000): %d\n", counter.value)

	// Always use defer Unlock() for safety against panics.
	// Never copy a Mutex after first use — pass by pointer.

	// SECTION: sync.RWMutex — multiple readers, one writer
	fmt.Println("\n--- sync.RWMutex ---")

	type LockerRegister struct {
		mu      sync.RWMutex
		lockers map[string]string
	}

	register := &LockerRegister{
		lockers: map[string]string{"raju": "Guard", "meena": "Manager"},
	}

	readLocker := func(r *LockerRegister, name string) string {
		r.mu.RLock()
		defer r.mu.RUnlock()
		return r.lockers[name]
	}

	writeLocker := func(r *LockerRegister, name, role string) {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.lockers[name] = role
	}

	var wg2 sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg2.Add(1)
		go func(id int) {
			defer wg2.Done()
			fmt.Printf("  Reader %d: raju = %s\n", id, readLocker(register, "raju"))
		}(i)
	}
	wg2.Add(1)
	go func() {
		defer wg2.Done()
		writeLocker(register, "priya", "Clerk")
		fmt.Println("  Writer: added priya")
	}()
	wg2.Wait()

	// SECTION: sync.Once — exactly-once initialization
	fmt.Println("\n--- sync.Once ---")

	type BranchConfig struct {
		BranchCode, IFSCCode string
	}

	var (
		once     sync.Once
		instance *BranchConfig
	)

	getBranchConfig := func() *BranchConfig {
		once.Do(func() {
			fmt.Println("  [Once] Initializing (runs exactly once)...")
			instance = &BranchConfig{"SBI-MUM-001", "SBIN0001234"}
		})
		return instance
	}

	var wg3 sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg3.Add(1)
		go func(id int) {
			defer wg3.Done()
			cfg := getBranchConfig()
			fmt.Printf("  Goroutine %d: %s\n", id, cfg.BranchCode)
		}(i)
	}
	wg3.Wait()

	// ============================================================
	//  EXAMPLE BLOCK 2 — sync.Map, sync.Pool, Atomic
	// ============================================================

	fmt.Println("\n============================================================")
	fmt.Println("  BLOCK 2: sync.Map, sync.Pool & Atomic Operations")
	fmt.Println("============================================================")

	// SECTION: sync.Map
	fmt.Println("\n--- sync.Map ---")

	var lockerAllotment sync.Map

	lockerAllotment.Store("locker-101", "Gold ornaments")
	lockerAllotment.Store("locker-102", "Property documents")

	if val, ok := lockerAllotment.Load("locker-101"); ok {
		fmt.Println("  locker-101:", val)
	}

	actual, loaded := lockerAllotment.LoadOrStore("locker-103", "Insurance papers")
	fmt.Printf("  locker-103: %v (existed: %v)\n", actual, loaded)

	// sync.Map is best for write-once/read-many or disjoint key sets.
	// Use map+Mutex when you need type safety or complex atomic ops.

	// SECTION: sync.Pool — object reuse
	fmt.Println("\n--- sync.Pool ---")

	type Buffer struct {
		data []byte
	}

	bufferPool := &sync.Pool{
		New: func() any {
			return &Buffer{data: make([]byte, 0, 1024)}
		},
	}

	buf1 := bufferPool.Get().(*Buffer)
	buf1.data = append(buf1.data, "hello"...)
	fmt.Printf("  Got buffer: len=%d, cap=%d\n", len(buf1.data), cap(buf1.data))

	buf1.data = buf1.data[:0] // reset before returning
	bufferPool.Put(buf1)

	buf2 := bufferPool.Get().(*Buffer)
	fmt.Printf("  Reused: same=%v, cap=%d\n", buf1 == buf2, cap(buf2.data))
	bufferPool.Put(buf2)

	// Pool contents may be GC'd at any time. Not for persistent storage.

	// SECTION: sync/atomic
	fmt.Println("\n--- sync/atomic ---")

	var atomicCounter atomic.Int64

	var wg4 sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg4.Add(1)
		go func() {
			defer wg4.Done()
			atomicCounter.Add(1)
		}()
	}
	wg4.Wait()
	fmt.Printf("  Atomic counter (expected 1000): %d\n", atomicCounter.Load())

	// CompareAndSwap (CAS)
	swapped := atomicCounter.CompareAndSwap(1000, 0)
	fmt.Printf("  CAS(1000->0): swapped=%v, value=%d\n", swapped, atomicCounter.Load())

	// SECTION: Quick benchmark comparison
	fmt.Println("\n--- Mutex vs Atomic ---")
	const iterations = 100000

	start := time.Now()
	var muCounter int
	var benchMu sync.Mutex
	var benchWg sync.WaitGroup
	for i := 0; i < iterations; i++ {
		benchWg.Add(1)
		go func() {
			defer benchWg.Done()
			benchMu.Lock()
			muCounter++
			benchMu.Unlock()
		}()
	}
	benchWg.Wait()
	mutexTime := time.Since(start)

	start = time.Now()
	var atomCounter atomic.Int64
	for i := 0; i < iterations; i++ {
		benchWg.Add(1)
		go func() {
			defer benchWg.Done()
			atomCounter.Add(1)
		}()
	}
	benchWg.Wait()
	atomicTime := time.Since(start)

	fmt.Printf("  Mutex:  %v (result: %d)\n", mutexTime, muCounter)
	fmt.Printf("  Atomic: %v (result: %d)\n", atomicTime, atomCounter.Load())

	// SECTION: Decision guide
	fmt.Println("\n--- When to use what ---")
	fmt.Println("  Channels:  communication, pipelines")
	fmt.Println("  Mutex:     complex shared state (structs, maps)")
	fmt.Println("  RWMutex:   read-heavy with occasional writes")
	fmt.Println("  Once:      one-time init (singletons)")
	fmt.Println("  sync.Map:  concurrent map with stable keys")
	fmt.Println("  sync.Pool: reusable temp objects (reduce GC)")
	fmt.Println("  atomic:    simple counters, flags (fastest)")

	// ============================================================
	//  KEY TAKEAWAYS
	// ============================================================
	fmt.Println("\n============================================================")
	fmt.Println("  KEY TAKEAWAYS")
	fmt.Println("============================================================")
	fmt.Println(`
  1. Mutex: exclusive access. Always defer Unlock() for safety.
  2. RWMutex: multiple RLock() or one Lock(). Ideal for read-heavy.
  3. Once: function runs exactly once across all goroutines.
  4. sync.Map: concurrent-safe map for stable/disjoint keys.
  5. sync.Pool: reusable objects to reduce GC. Always reset before Put().
  6. atomic: lock-free ops for counters/bools/pointers. Fastest option.
  7. Never copy sync types after first use — always pass by pointer.
  8. Channels for communication, Mutex for shared state, atomic for counters.`)
}

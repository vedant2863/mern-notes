// ============================================================
//  FILE 28: Concurrency Patterns
// ============================================================
//  Topic: pipeline, fan-out/fan-in, worker pool, rate limiting,
//         semaphore, or-done, bounded parallelism.
//
//  WHY: Goroutines and channels are primitives. Real systems
//  need PATTERNS to control parallelism, manage backpressure,
//  and prevent resource exhaustion.
// ============================================================
//
//  STORY — "Maruti Suzuki Assembly Line"
//  Plant manager Ramesh designs assembly lines: chassis -> paint
//  -> QC -> dispatch. Worker pools, semaphores for robotic arms,
//  rate limiting for dispatch. Chaos becomes choreography.
// ============================================================

package main

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// ── Pipeline stages ──

func generate(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		for _, n := range nums {
			out <- n
		}
		close(out)
	}()
	return out
}

func paintShop(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		for n := range in {
			out <- n * n
		}
		close(out)
	}()
	return out
}

func qualityCheck(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		for n := range in {
			out <- n * 2
		}
		close(out)
	}()
	return out
}

// ── Fan-out / Fan-in ──

func heavyProcess(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		for n := range in {
			time.Sleep(time.Millisecond * time.Duration(rand.Intn(5)))
			out <- n * 10
		}
		close(out)
	}()
	return out
}

func fanOut(in <-chan int, workers int) []<-chan int {
	chs := make([]<-chan int, workers)
	for i := 0; i < workers; i++ {
		chs[i] = heavyProcess(in)
	}
	return chs
}

func fanIn(channels ...<-chan int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup
	wg.Add(len(channels))
	for _, ch := range channels {
		go func(c <-chan int) {
			defer wg.Done()
			for v := range c {
				out <- v
			}
		}(ch)
	}
	go func() { wg.Wait(); close(out) }()
	return out
}

// ── Worker Pool types ──

type Job struct{ ID, Input int }
type Result struct{ JobID, Output int }

func shiftWorker(id int, jobs <-chan Job, results chan<- Result, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs {
		time.Sleep(time.Millisecond * time.Duration(rand.Intn(10)))
		results <- Result{job.ID, job.Input * job.Input}
	}
}

// ── Or-Done ──

func orDone(done <-chan struct{}, in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for {
			select {
			case <-done:
				return
			case val, ok := <-in:
				if !ok {
					return
				}
				select {
				case out <- val:
				case <-done:
					return
				}
			}
		}
	}()
	return out
}

// ── Fetch simulation ──

type FetchResult struct {
	URL      string
	Status   int
	Duration time.Duration
}

func simulateFetch(url string) FetchResult {
	delay := time.Duration(rand.Intn(50)+10) * time.Millisecond
	time.Sleep(delay)
	statuses := []int{200, 200, 200, 404, 500}
	return FetchResult{url, statuses[rand.Intn(len(statuses))], delay}
}

func main() {
	fmt.Println("===== FILE 28: Concurrency Patterns =====\n")

	// ── Pipeline ──
	fmt.Println("--- Pipeline ---")

	var results []int
	for v := range paintShop(generate(1, 2, 3, 4, 5)) {
		results = append(results, v)
	}
	fmt.Println("  Paint:", results)

	results = nil
	for v := range qualityCheck(paintShop(generate(1, 2, 3, 4, 5))) {
		results = append(results, v)
	}
	fmt.Println("  Paint+QC:", results)

	// ── Fan-Out / Fan-In ──
	fmt.Println("\n--- Fan-Out / Fan-In ---")

	source := generate(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
	merged := fanIn(fanOut(source, 3)...)

	total := 0
	count := 0
	for v := range merged {
		total += v
		count++
	}
	fmt.Printf("  %d results, sum=%d\n", count, total)

	// ── Worker Pool ──
	fmt.Println("\n--- Worker Pool ---")

	const numJobs, numWorkers = 6, 3
	jobs := make(chan Job, numJobs)
	poolResults := make(chan Result, numJobs)

	var wg sync.WaitGroup
	wg.Add(numWorkers)
	for w := 1; w <= numWorkers; w++ {
		go shiftWorker(w, jobs, poolResults, &wg)
	}
	for j := 1; j <= numJobs; j++ {
		jobs <- Job{j, j}
	}
	close(jobs)
	go func() { wg.Wait(); close(poolResults) }()

	for r := range poolResults {
		fmt.Printf("  Job %d: %d^2 = %d\n", r.JobID, r.JobID, r.Output)
	}

	// ── Rate Limiting ──
	fmt.Println("\n--- Rate Limiting ---")

	limiter := time.NewTicker(50 * time.Millisecond)
	defer limiter.Stop()
	models := []string{"Alto", "Swift", "Baleno"}
	rateStart := time.Now()

	for i, m := range models {
		<-limiter.C
		fmt.Printf("  [%dms] %s dispatched\n", time.Since(rateStart).Milliseconds(), m)
		_ = i
	}

	// ── Semaphore ──
	fmt.Println("\n--- Semaphore ---")

	sem := make(chan struct{}, 2)
	var semWg sync.WaitGroup

	for i := 1; i <= 5; i++ {
		semWg.Add(1)
		go func(id int) {
			defer semWg.Done()
			sem <- struct{}{}
			fmt.Printf("  Task %d started\n", id)
			time.Sleep(30 * time.Millisecond)
			<-sem
		}(i)
	}
	semWg.Wait()

	// ── Or-Done ──
	fmt.Println("\n--- Or-Done ---")

	done := make(chan struct{})
	inf := make(chan int)
	go func() {
		defer close(inf)
		for i := 1; ; i++ {
			select {
			case inf <- i:
			case <-done:
				return
			}
		}
	}()

	n := 0
	for v := range orDone(done, inf) {
		fmt.Printf("  Received: %d\n", v)
		n++
		if n >= 3 {
			close(done)
			break
		}
	}
	time.Sleep(10 * time.Millisecond)

	// ── Parallel Fetcher ──
	fmt.Println("\n--- Parallel Fetcher ---")

	urls := []string{
		"https://dealer.maruti.in/delhi",
		"https://dealer.maruti.in/mumbai",
		"https://dealer.maruti.in/chennai",
		"https://dealer.maruti.in/kolkata",
	}

	fetchSem := make(chan struct{}, 2)
	fetchResults := make(chan FetchResult, len(urls))
	var fetchWg sync.WaitGroup

	for _, u := range urls {
		fetchWg.Add(1)
		go func(url string) {
			defer fetchWg.Done()
			fetchSem <- struct{}{}
			fetchResults <- simulateFetch(url)
			<-fetchSem
		}(u)
	}
	go func() { fetchWg.Wait(); close(fetchResults) }()

	ok, fail := 0, 0
	for r := range fetchResults {
		tag := "OK"
		if r.Status != 200 {
			tag = fmt.Sprintf("FAIL(%d)", r.Status)
			fail++
		} else {
			ok++
		}
		fmt.Printf("  [%s] %s (%dms)\n", tag, r.URL, r.Duration.Milliseconds())
	}
	fmt.Printf("  Summary: %d success, %d failed\n", ok, fail)

	// ── Pattern Summary ──
	fmt.Println("\n--- Pattern Summary ---")
	fmt.Println("  Pipeline:    stages connected by channels")
	fmt.Println("  Fan-Out:     one channel -> multiple workers")
	fmt.Println("  Fan-In:      multiple channels -> one output")
	fmt.Println("  Worker Pool: N workers reading shared job channel")
	fmt.Println("  Rate Limit:  time.Ticker gates throughput")
	fmt.Println("  Semaphore:   buffered channel limits concurrency")
	fmt.Println("  Or-Done:     wrap reads with cancellation check")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Pipeline: chain goroutines with channels. Close to signal done.
// 2. Fan-Out/Fan-In: distribute to N workers, merge back. Order is lost.
// 3. Worker Pool: fixed N workers on shared job channel. Load-balances.
// 4. Rate Limit: time.Ticker. Block on <-ticker.C before each event.
// 5. Semaphore: buffered channel of capacity N. Send=acquire, recv=release.
// 6. Or-Done: wrap channel reads with done check. Prevents goroutine leaks.
// 7. Bounded Parallelism: semaphore + WaitGroup for parallel batch jobs.
// ============================================================

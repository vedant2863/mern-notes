// ============================================================
//  FILE 31 : Project — Concurrent Pipeline ("DataYantra")
// ============================================================
//  Topic  : goroutines, channels, sync, context, fan-out/fan-in
//
//  WHY: Real-world Go shines in concurrent data processing.
//  The pipeline pattern (generate -> transform -> filter ->
//  aggregate) lets you process millions of records with bounded
//  memory and configurable parallelism.
// ============================================================

// ============================================================
// STORY: DataYantra — The Textile Mill Pipeline
// The Surat textile mill processes fabric: weaving (generate)
// -> dyeing (transform, fan-out to looms) -> quality check
// (filter defects) -> packaging (aggregate). A foreman
// (context) can halt the entire mill with one signal.
// ============================================================

package main

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"
)

// ============================================================
// SECTION 1 — Data Types
// ============================================================
// Clear types make pipeline stages composable — each stage
// receives and returns the same FabricBolt type.

type FabricBolt struct {
	ID          int
	RawValue    int
	Transformed float64
	Label       string
	ProcessedBy string
	Timestamp   time.Time
}

type PipelineConfig struct {
	ItemCount        int
	TransformWorkers int
	FilterThreshold  float64
}

type PipelineMetrics struct {
	mu           sync.Mutex
	Generated    int
	Transformed  int
	Passed       int
	Rejected     int
	Aggregated   int
	StartTime    time.Time
	StageTimings map[string]time.Duration
}

func (m *PipelineMetrics) RecordStage(name string, d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.StageTimings[name] = d
}

func (m *PipelineMetrics) IncrSafe(counter *int, n int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	*counter += n
}

func (m *PipelineMetrics) Print() {
	m.mu.Lock()
	defer m.mu.Unlock()
	dur := time.Since(m.StartTime)
	throughput := 0.0
	if dur.Seconds() > 0 {
		throughput = float64(m.Generated) / dur.Seconds()
	}
	fmt.Println("\n  ======================================")
	fmt.Println("       DataYantra Pipeline Metrics")
	fmt.Println("  ======================================")
	fmt.Printf("  Woven: %d | Dyed: %d | Passed: %d | Rejected: %d | Packaged: %d\n",
		m.Generated, m.Transformed, m.Passed, m.Rejected, m.Aggregated)
	fmt.Printf("  Duration: %s | Throughput: %.0f bolts/sec\n", dur.Round(time.Millisecond), throughput)
	for stage, d := range m.StageTimings {
		fmt.Printf("  %-20s : %s\n", stage, d.Round(time.Millisecond))
	}
	fmt.Println("  ======================================")
}

// ============================================================
// SECTION 2 — Stage 1: Weaving (Generate)
// ============================================================
// The producer creates bolts and sends them on a channel,
// closing it when done.

func weave(ctx context.Context, cfg PipelineConfig, metrics *PipelineMetrics) <-chan FabricBolt {
	out := make(chan FabricBolt)
	go func() {
		defer close(out)
		start := time.Now()
		for i := 1; i <= cfg.ItemCount; i++ {
			bolt := FabricBolt{ID: i, RawValue: rand.Intn(100) + 1, Timestamp: time.Now()}
			select {
			case out <- bolt:
				metrics.IncrSafe(&metrics.Generated, 1)
			case <-ctx.Done():
				metrics.RecordStage("weaving", time.Since(start))
				return
			}
		}
		metrics.RecordStage("weaving", time.Since(start))
		fmt.Printf("    [Weaving] Produced %d bolts\n", cfg.ItemCount)
	}()
	return out
}

// ============================================================
// SECTION 3 — Stage 2: Dyeing (Fan-Out Transform)
// ============================================================
// N looms read from one channel (fan-out). A WaitGroup merges
// outputs into one channel (fan-in).

func dye(ctx context.Context, in <-chan FabricBolt, loomCount int, metrics *PipelineMetrics) <-chan FabricBolt {
	out := make(chan FabricBolt)
	var wg sync.WaitGroup
	start := time.Now()

	for w := 0; w < loomCount; w++ {
		wg.Add(1)
		loomID := fmt.Sprintf("loom-%d", w+1)
		go func(id string) {
			defer wg.Done()
			count := 0
			for bolt := range in {
				select {
				case <-ctx.Done():
					return
				default:
				}
				multiplier := float64(rand.Intn(5) + 1)
				bolt.Transformed = float64(bolt.RawValue) * multiplier / 10.0
				bolt.ProcessedBy = id
				switch {
				case bolt.Transformed >= 30:
					bolt.Label = "PREMIUM"
				case bolt.Transformed >= 15:
					bolt.Label = "STANDARD"
				default:
					bolt.Label = "ECONOMY"
				}
				time.Sleep(time.Duration(rand.Intn(2)) * time.Millisecond)
				count++
				metrics.IncrSafe(&metrics.Transformed, 1)
				select {
				case out <- bolt:
				case <-ctx.Done():
					return
				}
			}
			fmt.Printf("    [Dyeing] %s processed %d bolts\n", id, count)
		}(loomID)
	}

	go func() {
		wg.Wait()
		metrics.RecordStage("dyeing", time.Since(start))
		close(out)
	}()
	return out
}

// ============================================================
// SECTION 4 — Stage 3: Quality Check (Filter)
// ============================================================
// Bolts below threshold are rejected — the pipeline shrinks.

func qualityCheck(ctx context.Context, in <-chan FabricBolt, threshold float64, metrics *PipelineMetrics) <-chan FabricBolt {
	out := make(chan FabricBolt)
	go func() {
		defer close(out)
		start := time.Now()
		passed, rejected := 0, 0
		for bolt := range in {
			select {
			case <-ctx.Done():
				metrics.RecordStage("qualityCheck", time.Since(start))
				return
			default:
			}
			if bolt.Transformed >= threshold {
				passed++
				metrics.IncrSafe(&metrics.Passed, 1)
				select {
				case out <- bolt:
				case <-ctx.Done():
					metrics.RecordStage("qualityCheck", time.Since(start))
					return
				}
			} else {
				rejected++
				metrics.IncrSafe(&metrics.Rejected, 1)
			}
		}
		metrics.RecordStage("qualityCheck", time.Since(start))
		fmt.Printf("    [QualityCheck] Passed: %d, Rejected: %d (threshold: %.1f)\n", passed, rejected, threshold)
	}()
	return out
}

// ============================================================
// SECTION 5 — Stage 4: Packaging (Aggregate)
// ============================================================

type PackagingResult struct {
	TotalItems  int
	SumValues   float64
	AvgValue    float64
	MinValue    float64
	MaxValue    float64
	GradeCounts map[string]int
	LoomCounts  map[string]int
}

func packageBolts(ctx context.Context, in <-chan FabricBolt, metrics *PipelineMetrics) PackagingResult {
	start := time.Now()
	result := PackagingResult{
		MinValue: 1<<63 - 1, GradeCounts: make(map[string]int), LoomCounts: make(map[string]int),
	}
	for bolt := range in {
		select {
		case <-ctx.Done():
			break
		default:
		}
		result.TotalItems++
		result.SumValues += bolt.Transformed
		if bolt.Transformed < result.MinValue {
			result.MinValue = bolt.Transformed
		}
		if bolt.Transformed > result.MaxValue {
			result.MaxValue = bolt.Transformed
		}
		result.GradeCounts[bolt.Label]++
		result.LoomCounts[bolt.ProcessedBy]++
		metrics.IncrSafe(&metrics.Aggregated, 1)
	}
	if result.TotalItems > 0 {
		result.AvgValue = result.SumValues / float64(result.TotalItems)
	} else {
		result.MinValue = 0
	}
	metrics.RecordStage("packaging", time.Since(start))
	fmt.Printf("    [Packaging] Packaged %d bolts\n", result.TotalItems)
	return result
}

// ============================================================
// SECTION 6 — Pipeline Runner
// ============================================================

func RunPipeline(cfg PipelineConfig) (PackagingResult, *PipelineMetrics) {
	metrics := &PipelineMetrics{StartTime: time.Now(), StageTimings: make(map[string]time.Duration)}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	fmt.Printf("  Config: %d bolts, %d looms, QC threshold %.1f\n",
		cfg.ItemCount, cfg.TransformWorkers, cfg.FilterThreshold)

	stage1 := weave(ctx, cfg, metrics)
	stage2 := dye(ctx, stage1, cfg.TransformWorkers, metrics)
	stage3 := qualityCheck(ctx, stage2, cfg.FilterThreshold, metrics)
	result := packageBolts(ctx, stage3, metrics)
	return result, metrics
}

// ============================================================
// SECTION 7 — Pipeline with Cancellation
// ============================================================

func RunPipelineWithCancel(cfg PipelineConfig, cancelAfter time.Duration) *PipelineMetrics {
	metrics := &PipelineMetrics{StartTime: time.Now(), StageTimings: make(map[string]time.Duration)}
	ctx, cancel := context.WithTimeout(context.Background(), cancelAfter)
	defer cancel()

	fmt.Printf("  Config: %d bolts, cancel after %s\n", cfg.ItemCount, cancelAfter)
	stage1 := weave(ctx, cfg, metrics)
	stage2 := dye(ctx, stage1, cfg.TransformWorkers, metrics)
	stage3 := qualityCheck(ctx, stage2, cfg.FilterThreshold, metrics)

	count := 0
	for range stage3 {
		count++
		metrics.IncrSafe(&metrics.Aggregated, 1)
	}
	fmt.Printf("    [Cancelled] Packaged %d bolts before shutdown\n", count)
	return metrics
}

// ============================================================
// SECTION 8 — Result Printer
// ============================================================

func printResult(result PackagingResult) {
	fmt.Printf("\n  Bolts: %d | Sum: %.2f | Avg: %.2f | Min: %.2f | Max: %.2f\n",
		result.TotalItems, result.SumValues, result.AvgValue, result.MinValue, result.MaxValue)
	fmt.Print("  Grades: ")
	for grade, count := range result.GradeCounts {
		fmt.Printf("%s=%d ", grade, count)
	}
	fmt.Print("\n  Looms: ")
	for loom, count := range result.LoomCounts {
		fmt.Printf("%s=%d ", loom, count)
	}
	fmt.Println()
}

// ============================================================
// SECTION 9 — Main (Self-Test)
// ============================================================

func main() {
	fmt.Println("============================================================")
	fmt.Println("  DataYantra — Textile Mill Pipeline (Self-Test Demo)")
	fmt.Println("============================================================")

	// Run 1: Small batch
	fmt.Printf("\n%s\n  RUN 1: 50 bolts, 3 looms, QC 10.0\n%s\n",
		strings.Repeat("=", 60), strings.Repeat("=", 60))
	r1, m1 := RunPipeline(PipelineConfig{ItemCount: 50, TransformWorkers: 3, FilterThreshold: 10.0})
	printResult(r1)
	m1.Print()

	// Run 2: Larger batch, stricter QC
	fmt.Printf("\n%s\n  RUN 2: 200 bolts, 5 looms, QC 25.0\n%s\n",
		strings.Repeat("=", 60), strings.Repeat("=", 60))
	r2, m2 := RunPipeline(PipelineConfig{ItemCount: 200, TransformWorkers: 5, FilterThreshold: 25.0})
	printResult(r2)
	m2.Print()

	// Run 3: Cancellation
	fmt.Printf("\n%s\n  RUN 3: 1000 bolts, cancelled after 30ms\n%s\n",
		strings.Repeat("=", 60), strings.Repeat("=", 60))
	m3 := RunPipelineWithCancel(PipelineConfig{ItemCount: 1000, TransformWorkers: 4, FilterThreshold: 5.0}, 30*time.Millisecond)
	m3.Print()

	fmt.Println("\n============================================================")
	fmt.Println("  DataYantra self-test complete.")
	fmt.Println("============================================================")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Pipeline = chain of (chan T) -> goroutine -> (chan T).
//    Each stage owns and closes its output channel.
// 2. Fan-out: N looms read one channel. Fan-in: WaitGroup
//    merges N outputs into one.
// 3. context.Context is the kill switch — every stage checks
//    ctx.Done() for instant cancellation propagation.
// 4. Bounded parallelism via configurable worker counts,
//    not one goroutine per item.
// 5. Closing a channel is a broadcast — all readers see it,
//    cascading completion downstream.
// ============================================================

// ============================================================
//  FILE 29 : Project — CLI Tool ("KaamLog")
// ============================================================
//  Topic  : os.Args, fmt, encoding/json, os (file I/O),
//           strings, strconv, time, struct design, slices
//
//  WHY: A CLI task manager ties together file I/O, JSON
//  serialization, struct modeling, and slice manipulation —
//  all earlier skills converging into one useful tool.
// ============================================================

// ============================================================
// STORY: KaamLog — The Kirana Ledger
// Seth Govind ji's kirana store in Chandni Chowk needs a task
// ledger — a CLI tool that reads/writes a JSON file, turning
// chaos into a queryable list. Commands: add, list, done,
// delete, stats. The ledger lives in a temp file.
// ============================================================

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ============================================================
// SECTION 1 — Data Model
// ============================================================
// JSON tags control serialization. A *time.Time pointer lets
// "not yet done" become null/omitted in JSON output.

// Task represents a single to-do item in the kirana ledger.
type Task struct {
	ID          int        `json:"id"`
	Description string     `json:"description"`
	Done        bool       `json:"done"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

// TaskStore holds the collection and the backing file path.
type TaskStore struct {
	FilePath string
	Tasks    []Task
	NextID   int
}

// ============================================================
// SECTION 2 — Store Operations (CRUD)
// ============================================================
// Separating load/save from business logic keeps the code
// testable and mirrors real CLI architecture.

func NewTaskStore() *TaskStore {
	path := filepath.Join(os.TempDir(), "kaamlog_data.json")
	store := &TaskStore{FilePath: path, NextID: 1}
	store.load()
	return store
}

func (s *TaskStore) load() {
	data, err := os.ReadFile(s.FilePath)
	if err != nil {
		return // file doesn't exist yet — start fresh
	}
	var tasks []Task
	if err := json.Unmarshal(data, &tasks); err != nil {
		fmt.Printf("  [WARN] Corrupt data file, starting fresh: %v\n", err)
		return
	}
	s.Tasks = tasks
	for _, t := range s.Tasks {
		if t.ID >= s.NextID {
			s.NextID = t.ID + 1
		}
	}
}

func (s *TaskStore) save() error {
	data, err := json.MarshalIndent(s.Tasks, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return os.WriteFile(s.FilePath, data, 0644)
}

// ============================================================
// SECTION 3 — Commands
// ============================================================
// Each command is a method on TaskStore — the same pattern
// real CLI frameworks (cobra, urfave/cli) use.

func (s *TaskStore) Add(description string) {
	task := Task{
		ID: s.NextID, Description: description,
		Done: false, CreatedAt: time.Now(),
	}
	s.NextID++
	s.Tasks = append(s.Tasks, task)
	if err := s.save(); err != nil {
		fmt.Printf("  [ERROR] Failed to save: %v\n", err)
		return
	}
	fmt.Printf("  + Added task #%d: %q\n", task.ID, task.Description)
}

func (s *TaskStore) List(filter string) {
	var filtered []Task
	for _, t := range s.Tasks {
		switch filter {
		case "done":
			if t.Done {
				filtered = append(filtered, t)
			}
		case "pending":
			if !t.Done {
				filtered = append(filtered, t)
			}
		default:
			filtered = append(filtered, t)
		}
	}

	label := strings.ToUpper(filter)
	if label == "" {
		label = "ALL"
	}
	fmt.Printf("\n  %-4s %-6s %-30s %-20s %s\n",
		"ID", "STATUS", "DESCRIPTION", "CREATED", "COMPLETED")
	fmt.Printf("  %s\n", strings.Repeat("-", 90))

	if len(filtered) == 0 {
		fmt.Printf("  (no %s tasks)\n", strings.ToLower(label))
		return
	}

	for _, t := range filtered {
		status := "[ ]"
		if t.Done {
			status = "[x]"
		}
		completed := "—"
		if t.CompletedAt != nil {
			completed = t.CompletedAt.Format("2006-01-02 15:04:05")
		}
		fmt.Printf("  %-4d %-6s %-30s %-20s %s\n",
			t.ID, status, truncate(t.Description, 28),
			t.CreatedAt.Format("2006-01-02 15:04:05"), completed)
	}
	fmt.Printf("  Showing %d %s task(s)\n", len(filtered), strings.ToLower(label))
}

func (s *TaskStore) Done(id int) {
	for i := range s.Tasks {
		if s.Tasks[i].ID == id {
			if s.Tasks[i].Done {
				fmt.Printf("  ~ Task #%d is already done.\n", id)
				return
			}
			now := time.Now()
			s.Tasks[i].Done = true
			s.Tasks[i].CompletedAt = &now
			if err := s.save(); err != nil {
				fmt.Printf("  [ERROR] Failed to save: %v\n", err)
				return
			}
			fmt.Printf("  * Completed task #%d: %q\n", id, s.Tasks[i].Description)
			return
		}
	}
	fmt.Printf("  [WARN] Task #%d not found.\n", id)
}

func (s *TaskStore) Delete(id int) {
	for i, t := range s.Tasks {
		if t.ID == id {
			s.Tasks = append(s.Tasks[:i], s.Tasks[i+1:]...)
			if err := s.save(); err != nil {
				fmt.Printf("  [ERROR] Failed to save: %v\n", err)
				return
			}
			fmt.Printf("  - Deleted task #%d: %q\n", id, t.Description)
			return
		}
	}
	fmt.Printf("  [WARN] Task #%d not found.\n", id)
}

func (s *TaskStore) Stats() {
	total := len(s.Tasks)
	done := 0
	for _, t := range s.Tasks {
		if t.Done {
			done++
		}
	}
	pending := total - done
	rate := 0.0
	if total > 0 {
		rate = float64(done) / float64(total) * 100
	}
	fmt.Println("\n  ==============================")
	fmt.Println("       KaamLog Stats")
	fmt.Println("  ==============================")
	fmt.Printf("  Total: %d | Done: %d | Pending: %d | Rate: %.1f%%\n",
		total, done, pending, rate)
	fmt.Println("  ==============================")
}

// ============================================================
// SECTION 4 — Helpers
// ============================================================

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func printBanner(title string) {
	fmt.Printf("\n%s\n  COMMAND: %s\n%s\n",
		strings.Repeat("=", 60), title, strings.Repeat("=", 60))
}

// ============================================================
// SECTION 5 — File Inspection
// ============================================================
// Peeking at raw JSON proves data is persisted, not just in memory.

func (s *TaskStore) ShowRawFile() {
	data, err := os.ReadFile(s.FilePath)
	if err != nil {
		fmt.Printf("  [ERROR] Cannot read file: %v\n", err)
		return
	}
	fmt.Println("\n  --- Raw JSON on disk ---")
	for _, line := range strings.Split(string(data), "\n") {
		fmt.Printf("  %s\n", line)
	}
	fmt.Println("  --- End of file ---")
}

// ============================================================
// SECTION 6 — Cleanup
// ============================================================

func (s *TaskStore) Cleanup() {
	if err := os.Remove(s.FilePath); err != nil && !os.IsNotExist(err) {
		fmt.Printf("  [WARN] Could not remove temp file: %v\n", err)
	} else {
		fmt.Printf("  Cleaned up temp file: %s\n", s.FilePath)
	}
}

// ============================================================
// SECTION 7 — Main (Self-Test)
// ============================================================

func main() {
	fmt.Println("============================================================")
	fmt.Println("  KaamLog — Kirana Store Task Manager (Self-Test Demo)")
	fmt.Println("============================================================")

	store := NewTaskStore()
	defer store.Cleanup()
	fmt.Printf("  Data file: %s\n", store.FilePath)

	// ADD tasks
	printBanner("add (5 tasks)")
	store.Add("Order Toor Dal from wholesaler")
	store.Add("Restock Atta shelf")
	store.Add("Collect payment from Sharma ji")
	store.Add("Call distributor for oil supply")
	store.Add("Update price list for festival season")

	// LIST all
	printBanner("list all")
	store.List("all")

	// DONE: mark tasks 1 and 3
	printBanner("done 1, done 3")
	store.Done(1)
	store.Done(3)

	// DONE duplicate
	printBanner("done 1 (duplicate)")
	store.Done(1)

	// LIST done / pending
	printBanner("list done")
	store.List("done")
	printBanner("list pending")
	store.List("pending")

	// DELETE
	printBanner("delete 4")
	store.Delete(4)
	printBanner("delete 99 (not found)")
	store.Delete(99)

	// Final state
	printBanner("list all (after changes)")
	store.List("all")

	printBanner("stats")
	store.Stats()

	printBanner("show raw JSON file")
	store.ShowRawFile()

	// Round 2
	printBanner("add + done + stats (round 2)")
	store.Add("Check weighing scale calibration")
	store.Done(6)
	store.Stats()

	printBanner("final list (all)")
	store.List("all")

	fmt.Println("\n============================================================")
	fmt.Println("  KaamLog self-test complete.")
	fmt.Println("============================================================")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Struct + JSON tags give you free serialization — no ORM needed.
// 2. *time.Time pointer lets JSON encode null for missing values;
//    omitempty suppresses the field entirely.
// 3. os.TempDir() is the cross-platform safe spot for throwaway files.
// 4. Separating store ops (load/save) from commands (Add/Done/Delete)
//    mirrors real CLI architecture.
// 5. defer store.Cleanup() ensures temp files vanish even on panic.
// ============================================================

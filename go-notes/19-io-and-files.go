// ============================================================
//  FILE 19: I/O and Files
// ============================================================
//  Topic: os.ReadFile/WriteFile, os.Open/Create, bufio.Scanner,
//         bufio.Writer, io.Copy, io.TeeReader, io.MultiWriter,
//         os.Stat, os.MkdirAll, os.ReadDir, temp files.
//
//  WHY: Every real program reads or writes data. Go's I/O is
//  built on io.Reader and io.Writer — two tiny interfaces that
//  compose like LEGO bricks across files, network, compression.
// ============================================================
//
//  STORY — "The National Archives of India"
//  Archivist Mehra catalogs records, copies manuscripts, and
//  organises sections. His tools: read, write, copy, organise.
// ============================================================

package main

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	// ============================================================
	// EXAMPLE BLOCK 1 — Read/Write Files, Buffered I/O, io.Copy
	// ============================================================

	baseDir, err := os.MkdirTemp("", "mehra-archive-*")
	if err != nil {
		fmt.Println("Failed to create temp dir:", err)
		return
	}
	defer os.RemoveAll(baseDir)

	// SECTION 1 — os.WriteFile / os.ReadFile (simple all-at-once)
	manuscriptPath := filepath.Join(baseDir, "manuscript_001.txt")
	content := []byte("The ancient manuscript speaks of the Maurya dynasty.\nLine two of the record.\nLine three: the end.")

	os.WriteFile(manuscriptPath, content, 0644)
	fmt.Println("\n--- os.WriteFile / os.ReadFile ---")

	data, _ := os.ReadFile(manuscriptPath)
	fmt.Println("Read back:", string(data[:52]))

	// SECTION 2 — os.Create, os.Open, os.OpenFile
	fmt.Println("\n--- os.Create / os.Open / os.OpenFile ---")

	catalogPath := filepath.Join(baseDir, "catalog.txt")
	f, _ := os.Create(catalogPath)
	f.WriteString("=== National Archives Catalog ===\n")
	f.WriteString("Entry 1: Maurya Dynasty Manuscript\n")
	f.Close()

	f, _ = os.OpenFile(catalogPath, os.O_APPEND|os.O_WRONLY, 0644)
	f.WriteString("Entry 2: Mughal Era Revenue Records\n")
	f.Close()

	f, _ = os.Open(catalogPath)
	catalogData, _ := io.ReadAll(f)
	f.Close()
	fmt.Println(string(catalogData))

	// SECTION 3 — bufio.Scanner (line-by-line)
	fmt.Println("--- bufio.Scanner ---")

	f, _ = os.Open(manuscriptPath)
	defer f.Close()

	scanner := bufio.NewScanner(f)
	lineNum := 1
	for scanner.Scan() {
		fmt.Printf("  Line %d: %s\n", lineNum, scanner.Text())
		lineNum++
	}

	// SECTION 4 — bufio.Writer (buffered writing)
	fmt.Println("\n--- bufio.Writer ---")

	logPath := filepath.Join(baseDir, "archive_log.txt")
	logFile, _ := os.Create(logPath)
	writer := bufio.NewWriter(logFile)
	writer.WriteString("Log 1: cataloged 5 manuscripts\n")
	writer.WriteString("Log 2: restored 2 records\n")
	writer.Flush() // must flush to ensure data reaches file
	logFile.Close()

	logData, _ := os.ReadFile(logPath)
	fmt.Println("Written", strings.Count(string(logData), "\n"), "entries")

	// SECTION 5 — io.Copy, io.MultiWriter, io.TeeReader
	fmt.Println("\n--- io.Copy ---")

	copyPath := filepath.Join(baseDir, "manuscript_copy.txt")
	src, _ := os.Open(manuscriptPath)
	dst, _ := os.Create(copyPath)
	n, _ := io.Copy(dst, src)
	src.Close()
	dst.Close()
	fmt.Printf("Copied %d bytes\n", n)

	fmt.Println("\n--- io.MultiWriter ---")
	var buf1, buf2 bytes.Buffer
	multi := io.MultiWriter(&buf1, &buf2)
	multi.Write([]byte("Goes to TWO buffers"))
	fmt.Println("Buffer 1:", buf1.String())
	fmt.Println("Buffer 2:", buf2.String())

	fmt.Println("\n--- io.TeeReader ---")
	source := strings.NewReader("Read and log simultaneously")
	var logBuf bytes.Buffer
	tee := io.TeeReader(source, &logBuf)
	result, _ := io.ReadAll(tee)
	fmt.Println("Read:", string(result))
	fmt.Println("Log: ", logBuf.String())

	// ============================================================
	// EXAMPLE BLOCK 2 — Directories, Temp Files, File Info
	// ============================================================

	// SECTION 6 — os.Stat
	fmt.Println("\n--- os.Stat ---")

	info, err := os.Stat(manuscriptPath)
	if err == nil {
		fmt.Printf("File: %s, Size: %d bytes, IsDir: %v\n",
			info.Name(), info.Size(), info.IsDir())
	}

	_, err = os.Stat(filepath.Join(baseDir, "nonexistent.txt"))
	fmt.Printf("nonexistent exists? %v\n", !os.IsNotExist(err))

	// SECTION 7 — Directories
	fmt.Println("\n--- Directories ---")

	os.Mkdir(filepath.Join(baseDir, "section-Mughal"), 0755)
	nested := filepath.Join(baseDir, "section-British", "shelf-1", "drawer-top")
	os.MkdirAll(nested, 0755)
	os.WriteFile(filepath.Join(nested, "rare.txt"), []byte("Chola manuscript"), 0644)

	entries, _ := os.ReadDir(baseDir)
	fmt.Println("Archive root:")
	for _, entry := range entries {
		kind := "FILE"
		if entry.IsDir() {
			kind = "DIR "
		}
		fmt.Printf("  [%s] %s\n", kind, entry.Name())
	}

	// SECTION 8 — Temp files
	fmt.Println("\n--- Temp Files ---")

	tmpFile, _ := os.CreateTemp("", "mehra-temp-*.txt")
	tmpFile.WriteString("Temporary data")
	fmt.Println("Temp file:", filepath.Base(tmpFile.Name()))
	tmpFile.Close()
	os.Remove(tmpFile.Name())

	// SECTION 9 — Process large file line by line
	fmt.Println("\n--- Large File Processing ---")

	largePath := filepath.Join(baseDir, "large_register.txt")
	func() {
		lf, _ := os.Create(largePath)
		defer lf.Close()
		w := bufio.NewWriter(lf)
		for i := 1; i <= 1000; i++ {
			fmt.Fprintf(w, "Record %04d: data-entry\n", i)
		}
		w.Flush()
	}()

	func() {
		lf, _ := os.Open(largePath)
		defer lf.Close()
		sc := bufio.NewScanner(lf)
		total, matches := 0, 0
		for sc.Scan() {
			total++
			if strings.Contains(sc.Text(), "Record 0500") {
				matches++
				fmt.Println("  Found:", sc.Text())
			}
		}
		fmt.Printf("  Processed %d lines, %d matches\n", total, matches)
	}()

	// SECTION 10 — io.Reader / io.Writer interfaces
	fmt.Println("\n--- io.Reader / io.Writer ---")

	r := strings.NewReader("Mehra's universal reader")
	var output bytes.Buffer
	copied, _ := io.Copy(&output, r)
	fmt.Printf("Copied %d bytes via interfaces: %s\n", copied, output.String())
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. os.ReadFile/WriteFile: simplest for small files.
// 2. os.Open (read), os.Create (write), os.OpenFile (flags). Always close.
// 3. bufio.Scanner: line-by-line with constant memory.
// 4. bufio.Writer: batched writes. Always Flush().
// 5. io.Reader/Writer: composable building blocks for all I/O.
// 6. io.Copy streams data. MultiWriter fans out. TeeReader reads+copies.
// 7. os.Stat checks existence/metadata. os.IsNotExist for checks.
// 8. os.MkdirAll creates nested dirs. os.ReadDir lists contents.
// 9. os.CreateTemp/MkdirTemp for safe temp files. Always clean up.
// ============================================================

// ============================================================
//  FILE 32 : Project — Chat Server ("NukkadChat")
// ============================================================
//  Topic  : net, bufio, sync, strings, time, context,
//           goroutines, TCP networking
//
//  WHY: A TCP chat server combines networking, goroutines,
//  synchronization, and protocol design — the exact skills
//  needed for any networked Go service.
// ============================================================

// ============================================================
// STORY: NukkadChat — The Mohalla Intercom
// The mohalla installs a TCP messaging system. Each house
// connects as a client. Messages broadcast to all residents.
// Private messages (/msg) go point-to-point. When the pradhan
// (context) shuts down, everything closes gracefully.
// ============================================================

package main

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

// ============================================================
// SECTION 1 — Client Model
// ============================================================
// A send channel decouples "deciding what to send" from
// "writing bytes" — one slow resident won't block others.

type Client struct {
	Conn     net.Conn
	Nickname string
	Send     chan string
	JoinedAt time.Time
}

// ============================================================
// SECTION 2 — Chat Server
// ============================================================

type ChatServer struct {
	mu       sync.RWMutex
	clients  map[*Client]bool
	listener net.Listener
	nextID   int
}

func NewChatServer(addr string) (*ChatServer, error) {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen: %w", err)
	}
	return &ChatServer{clients: make(map[*Client]bool), listener: ln, nextID: 1}, nil
}

func (s *ChatServer) Addr() string { return s.listener.Addr().String() }

// Run accepts connections until context is cancelled.
func (s *ChatServer) Run(ctx context.Context) {
	// Closing the listener unblocks Accept() on shutdown.
	go func() {
		<-ctx.Done()
		s.listener.Close()
	}()

	fmt.Printf("  [Server] Listening on %s\n", s.Addr())
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			select {
			case <-ctx.Done():
				return
			default:
				fmt.Printf("  [Server] Accept error: %v\n", err)
				continue
			}
		}
		go s.handleClient(ctx, conn)
	}
}

func (s *ChatServer) handleClient(ctx context.Context, conn net.Conn) {
	s.mu.Lock()
	nickname := fmt.Sprintf("resident-%d", s.nextID)
	s.nextID++
	client := &Client{Conn: conn, Nickname: nickname, Send: make(chan string, 64), JoinedAt: time.Now()}
	s.clients[client] = true
	s.mu.Unlock()

	fmt.Printf("  [Server] %s joined\n", client.Nickname)
	s.broadcast(fmt.Sprintf("*** %s has joined ***", client.Nickname), client)
	client.Send <- fmt.Sprintf("[NukkadChat] Welcome, %s! Commands: /nick, /list, /msg, /quit", client.Nickname)

	// Writer goroutine: drains Send channel to TCP.
	var writerDone sync.WaitGroup
	writerDone.Add(1)
	go func() {
		defer writerDone.Done()
		for msg := range client.Send {
			ts := time.Now().Format("15:04:05")
			if _, err := fmt.Fprintf(conn, "[%s] %s\n", ts, msg); err != nil {
				return
			}
		}
	}()

	// Reader loop
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			goto cleanup
		default:
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "/") {
			s.handleCommand(client, line)
			if strings.HasPrefix(line, "/quit") {
				goto cleanup
			}
		} else {
			s.broadcast(fmt.Sprintf("%s: %s", client.Nickname, line), client)
		}
	}

cleanup:
	s.removeClient(client)
	close(client.Send)
	writerDone.Wait()
	conn.Close()
}

// ============================================================
// SECTION 3 — Commands
// ============================================================

func (s *ChatServer) handleCommand(client *Client, line string) {
	parts := strings.SplitN(line, " ", 3)
	cmd := strings.ToLower(parts[0])

	switch cmd {
	case "/nick":
		if len(parts) < 2 || strings.TrimSpace(parts[1]) == "" {
			client.Send <- "[NukkadChat] Usage: /nick <name>"
			return
		}
		newName := strings.TrimSpace(parts[1])
		s.mu.RLock()
		for c := range s.clients {
			if c != client && strings.EqualFold(c.Nickname, newName) {
				s.mu.RUnlock()
				client.Send <- fmt.Sprintf("[NukkadChat] %q is taken", newName)
				return
			}
		}
		s.mu.RUnlock()

		oldName := client.Nickname
		s.mu.Lock()
		client.Nickname = newName
		s.mu.Unlock()
		client.Send <- fmt.Sprintf("[NukkadChat] You are now %s", newName)
		s.broadcast(fmt.Sprintf("*** %s is now %s ***", oldName, newName), client)

	case "/list":
		s.mu.RLock()
		var names []string
		for c := range s.clients {
			tag := ""
			if c == client {
				tag = " (you)"
			}
			names = append(names, fmt.Sprintf("  - %s%s", c.Nickname, tag))
		}
		s.mu.RUnlock()
		client.Send <- fmt.Sprintf("[NukkadChat] Online (%d):\n%s", len(names), strings.Join(names, "\n"))

	case "/msg":
		if len(parts) < 3 {
			client.Send <- "[NukkadChat] Usage: /msg <nick> <message>"
			return
		}
		s.mu.RLock()
		var target *Client
		for c := range s.clients {
			if strings.EqualFold(c.Nickname, parts[1]) {
				target = c
				break
			}
		}
		s.mu.RUnlock()
		if target == nil {
			client.Send <- fmt.Sprintf("[NukkadChat] %q not found", parts[1])
			return
		}
		if target == client {
			client.Send <- "[NukkadChat] Can't message yourself"
			return
		}
		target.Send <- fmt.Sprintf("[PM from %s] %s", client.Nickname, parts[2])
		client.Send <- fmt.Sprintf("[PM to %s] %s", target.Nickname, parts[2])

	case "/quit":
		client.Send <- "[NukkadChat] Alvida!"

	default:
		client.Send <- fmt.Sprintf("[NukkadChat] Unknown command: %s", cmd)
	}
}

// ============================================================
// SECTION 4 — Broadcast & Cleanup
// ============================================================

func (s *ChatServer) broadcast(msg string, sender *Client) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for client := range s.clients {
		if client != sender {
			// Non-blocking: drop if buffer full (slow resident).
			select {
			case client.Send <- msg:
			default:
			}
		}
	}
}

func (s *ChatServer) removeClient(client *Client) {
	s.mu.Lock()
	delete(s.clients, client)
	s.mu.Unlock()
	s.broadcast(fmt.Sprintf("*** %s has left ***", client.Nickname), nil)
	fmt.Printf("  [Server] %s disconnected\n", client.Nickname)
}

func (s *ChatServer) Shutdown() {
	s.mu.Lock()
	for client := range s.clients {
		client.Send <- "[NukkadChat] Server shutting down!"
		client.Conn.Close()
	}
	s.mu.Unlock()
}

// ============================================================
// SECTION 5 — Simulated Client (for self-test)
// ============================================================

type SimClient struct {
	conn     net.Conn
	reader   *bufio.Scanner
	name     string
	received []string
	mu       sync.Mutex
}

func NewSimClient(addr, label string) (*SimClient, error) {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return nil, err
	}
	sc := &SimClient{conn: conn, reader: bufio.NewScanner(conn), name: label}
	go sc.readLoop()
	return sc, nil
}

func (sc *SimClient) readLoop() {
	for sc.reader.Scan() {
		sc.mu.Lock()
		sc.received = append(sc.received, sc.reader.Text())
		sc.mu.Unlock()
	}
}

func (sc *SimClient) Send(msg string) { fmt.Fprintf(sc.conn, "%s\n", msg) }

func (sc *SimClient) PrintReceived() {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	fmt.Printf("    [%s] %d messages:\n", sc.name, len(sc.received))
	for _, msg := range sc.received {
		fmt.Printf("      %s\n", msg)
	}
}

func (sc *SimClient) Close() { sc.conn.Close() }

// ============================================================
// SECTION 6 — Main (Self-Test)
// ============================================================

func main() {
	fmt.Println("============================================================")
	fmt.Println("  NukkadChat — TCP Chat Server (Self-Test Demo)")
	fmt.Println("============================================================")

	server, err := NewChatServer("127.0.0.1:0")
	if err != nil {
		fmt.Printf("  [FATAL] %v\n", err)
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var serverDone sync.WaitGroup
	serverDone.Add(1)
	go func() {
		defer serverDone.Done()
		server.Run(ctx)
	}()
	time.Sleep(50 * time.Millisecond)

	// Connect 3 residents
	amit, _ := NewSimClient(server.Addr(), "Amit-sim")
	defer amit.Close()
	priya, _ := NewSimClient(server.Addr(), "Priya-sim")
	defer priya.Close()
	rahul, _ := NewSimClient(server.Addr(), "Rahul-sim")
	defer rahul.Close()
	time.Sleep(100 * time.Millisecond)

	// Test /nick
	amit.Send("/nick Amit")
	time.Sleep(50 * time.Millisecond)
	priya.Send("/nick Priya")
	time.Sleep(50 * time.Millisecond)
	rahul.Send("/nick Rahul")
	time.Sleep(50 * time.Millisecond)

	// Broadcast
	amit.Send("Namaste sabko!")
	time.Sleep(50 * time.Millisecond)
	priya.Send("Haan Amit bhai!")
	time.Sleep(50 * time.Millisecond)

	// /list
	amit.Send("/list")
	time.Sleep(50 * time.Millisecond)

	// /msg (private)
	amit.Send("/msg Priya Samosa leke aana!")
	time.Sleep(50 * time.Millisecond)
	priya.Send("/msg Amit Zaroor!")
	time.Sleep(50 * time.Millisecond)

	// /msg unknown user
	rahul.Send("/msg Neha Hello?")
	time.Sleep(50 * time.Millisecond)

	// Duplicate nickname
	rahul.Send("/nick Amit")
	time.Sleep(50 * time.Millisecond)

	// /quit
	rahul.Send("/quit")
	time.Sleep(100 * time.Millisecond)

	// Post-quit
	amit.Send("Lagta hai Rahul ko jaana pada.")
	time.Sleep(100 * time.Millisecond)

	// Print logs
	fmt.Println("\n  ======================================")
	fmt.Println("       Resident Message Logs")
	fmt.Println("  ======================================")
	amit.PrintReceived()
	fmt.Println()
	priya.PrintReceived()
	fmt.Println()
	rahul.PrintReceived()

	// Shutdown
	server.Shutdown()
	cancel()
	serverDone.Wait()

	fmt.Println("\n============================================================")
	fmt.Println("  NukkadChat self-test complete.")
	fmt.Println("============================================================")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. net.Listen + Accept loop: each connection gets its own
//    goroutine — the foundation of all TCP servers in Go.
// 2. Buffered send channels decouple message production from
//    network writes; slow residents don't block the server.
// 3. Two-goroutine-per-client (reader + writer) is standard Go.
// 4. sync.RWMutex on the client map: broadcasts RLock,
//    joins/leaves Lock.
// 5. Non-blocking select on Send drops messages for slow
//    clients rather than blocking the broadcaster.
// 6. Closing the listener from ctx.Done() unblocks Accept().
// ============================================================

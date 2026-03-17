// ============================================================
//  FILE 36 : AI — Gemini API Basics
// ============================================================
//  Topic  : SDK client setup, text generation, streaming,
//           multi-turn chat, system instructions, JSON mode,
//           safety settings, token counting
//
//  WHY: LLMs are a core building block in modern software.
//  Understanding prompt design, streaming, chat history, and
//  structured output is now as fundamental as HTTP requests.
// ============================================================

// ============================================================
// STORY: JioSaathi — Jio's AI Customer Support
// Jio (450M+ subscribers) handles millions of queries daily.
// JioSaathi is an AI assistant backed by Gemini that streams
// responses, remembers context, follows persona rules, returns
// structured JSON for CRM, and tracks token costs at scale.
// ============================================================

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// ============================================================
// SIMULATED MODE
// ============================================================
// Set GEMINI_API_KEY to use real API. Without it, all responses
// are pre-written demo data for learning the patterns.

var geminiAPIKey = os.Getenv("GEMINI_API_KEY")
var simulatedMode = geminiAPIKey == ""

func init() {
	if simulatedMode {
		fmt.Println("  SIMULATED MODE — GEMINI_API_KEY not set. Demo data only.")
		fmt.Println()
	}
}

// ============================================================
// SECTION 1 — SDK Types & Client
// ============================================================
// Mirrors the real google.golang.org/genai SDK. When you switch
// to real SDK, only the import path changes.

type GeminiClient struct {
	apiKey string
}

type GenerativeModel struct {
	Name              string
	Client            *GeminiClient
	Temperature       float32
	TopP              float32
	TopK              int
	MaxOutputTokens   int
	SystemInstruction string
	ResponseMIMEType  string
}

type ChatSession struct {
	Model   *GenerativeModel
	History []ChatMessage
}

type ChatMessage struct {
	Role    string // "user" or "model"
	Content string
}

type GenerateResponse struct {
	Text         string
	TokenCount   int
	FinishReason string
}

func NewGeminiClient(ctx context.Context, apiKey string) (*GeminiClient, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}
	fmt.Printf("  [Client] Created (key: %s...%s)\n", apiKey[:4], apiKey[len(apiKey)-4:])
	return &GeminiClient{apiKey: apiKey}, nil
}

func (c *GeminiClient) GetModel(name string) *GenerativeModel {
	return &GenerativeModel{
		Name: name, Client: c, Temperature: 1.0,
		TopP: 0.95, TopK: 40, MaxOutputTokens: 2048,
	}
}

func (m *GenerativeModel) StartChat() *ChatSession {
	return &ChatSession{Model: m, History: make([]ChatMessage, 0)}
}

// ============================================================
// SECTION 2 — Basic Text Generation
// ============================================================
// Temperature controls creativity: 0=deterministic, 1+=creative.

func demoTextGeneration() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 1: Basic Text Generation")
	fmt.Println("============================================================")

	client := &GeminiClient{apiKey: "sim-key-demo"}
	model := client.GetModel("gemini-1.5-flash")
	model.Temperature = 0.3
	model.MaxOutputTokens = 256

	prompt := "What are the current Jio prepaid plans under 500 rupees?"
	fmt.Printf("\n  PROMPT: %s\n", prompt)

	if simulatedMode {
		resp := GenerateResponse{
			Text: `Popular Jio plans under Rs 500:
1. Rs 149 — 2GB/day, 24 days, unlimited calls
2. Rs 299 — 2GB/day, 28 days + JioCinema
3. Rs 349 — 3GB/day, 28 days
4. Rs 449 — 2GB/day, 56 days
All include 100 SMS/day and JioTV.`,
			TokenCount: 65, FinishReason: "STOP",
		}
		fmt.Printf("\n  RESPONSE:\n")
		for _, line := range strings.Split(resp.Text, "\n") {
			fmt.Printf("    %s\n", line)
		}
		fmt.Printf("  Tokens: %d | Finish: %s\n", resp.TokenCount, resp.FinishReason)
	}
	fmt.Println()
}

// ============================================================
// SECTION 3 — Streaming Responses
// ============================================================
// Streaming sends tokens as generated — user sees text appear
// word by word, reducing perceived latency.

func demoStreaming() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 2: Streaming Responses")
	fmt.Println("============================================================")

	prompt := "Explain how to port my number to Jio in simple steps."
	fmt.Printf("  PROMPT: %s\n\n  STREAMING: ", prompt)

	if simulatedMode {
		chunks := []string{
			"To port your number to Jio: ",
			"1. SMS 'PORT <number>' to 1900 for UPC code. ",
			"2. Visit Jio Store with Aadhaar + UPC. ",
			"3. Choose a plan. ",
			"4. SIM activates in 3-5 days. Welcome to Jio!",
		}
		for i, chunk := range chunks {
			fmt.Print(chunk)
			time.Sleep(time.Duration(50+(i%3)*25) * time.Millisecond)
		}
		fmt.Println()
	}
	// Real SDK: model.GenerateContentStream(ctx, genai.Text(prompt))
	fmt.Println()
}

// ============================================================
// SECTION 4 — Multi-turn Chat
// ============================================================
// Chat sessions maintain history so the model understands
// context from previous turns.

func (cs *ChatSession) SendMessage(ctx context.Context, userMsg string) (*GenerateResponse, error) {
	cs.History = append(cs.History, ChatMessage{Role: "user", Content: userMsg})
	if simulatedMode {
		resp := simulateChatResponse(cs.History)
		cs.History = append(cs.History, ChatMessage{Role: "model", Content: resp.Text})
		return resp, nil
	}
	return &GenerateResponse{Text: "[real API response]"}, nil
}

func simulateChatResponse(history []ChatMessage) *GenerateResponse {
	last := strings.ToLower(history[len(history)-1].Content)
	turn := len(history)
	var response string
	switch {
	case turn == 1 && strings.Contains(last, "plan"):
		response = "Namaste! Tell me your monthly budget and daily data usage — I'll recommend the best Jio plan."
	case turn <= 3 && strings.Contains(last, "300"):
		response = "For ~Rs 300, try the Jio Rs 299 plan: 2GB/day, 28 days, unlimited calls + JioCinema. Want to recharge?"
	case strings.Contains(last, "recharge") || strings.Contains(last, "yes"):
		response = "Recharge via: MyJio App (UPI/cards), jio.com, Jio Store, or authorized retailers."
	case strings.Contains(last, "thank"):
		response = "You're welcome! Reach JioSaathi 24/7 for future queries. Have a great day!"
	default:
		response = "Could you provide more details so I can help you better?"
	}
	return &GenerateResponse{Text: response, TokenCount: len(strings.Fields(response)) * 2, FinishReason: "STOP"}
}

func demoChat() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 3: Multi-turn Chat")
	fmt.Println("============================================================")

	client := &GeminiClient{apiKey: "sim-key-demo"}
	chat := client.GetModel("gemini-1.5-flash").StartChat()

	turns := []string{
		"I want to know about Jio plans",
		"My budget is around 300 rupees",
		"Okay, recharge me with 299 plan",
		"Thank you JioSaathi!",
	}
	for i, msg := range turns {
		fmt.Printf("\n  [Turn %d] USER: %s\n", i+1, msg)
		resp, _ := chat.SendMessage(context.Background(), msg)
		fmt.Printf("  [Turn %d] BOT:  %s\n", i+1, resp.Text)
	}
	fmt.Printf("\n  Chat history: %d messages\n\n", len(chat.History))
}

// ============================================================
// SECTION 5 — System Instructions
// ============================================================
// Set persona and rules BEFORE any user interaction.

func demoSystemInstruction() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 4: System Instructions (Persona)")
	fmt.Println("============================================================")

	sysPrompt := `You are JioSaathi, Jio's AI support assistant.
RULES: Greet with Namaste. Be polite. Never discuss competitors.
For billing disputes, escalate to human agent.`

	fmt.Printf("  System instruction:\n    %s\n", strings.ReplaceAll(sysPrompt, "\n", "\n    "))
	fmt.Println("\n  Effect: 'Compare Jio and Airtel' -> redirects to Jio plans only.")
	// In production: model.SystemInstruction = &genai.Content{Parts: []genai.Part{genai.Text(sysPrompt)}}
	fmt.Println()
}

// ============================================================
// SECTION 6 — JSON Mode
// ============================================================
// ResponseMIMEType = "application/json" forces structured output.

type SupportTicket struct {
	CustomerName string `json:"customer_name"`
	PhoneNumber  string `json:"phone_number"`
	IssueType    string `json:"issue_type"`
	Priority     string `json:"priority"`
	Summary      string `json:"summary"`
	Resolution   string `json:"suggested_resolution"`
}

func demoJSONMode() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 5: JSON Mode — Structured Output")
	fmt.Println("============================================================")

	if simulatedMode {
		jsonResp := `{"customer_name":"Rajesh Kumar","phone_number":"9876543210","issue_type":"network","priority":"high","summary":"4G not working in Noida Sector 62","suggested_resolution":"Check tower status, escalate to network ops"}`
		var ticket SupportTicket
		json.Unmarshal([]byte(jsonResp), &ticket)
		fmt.Printf("  Parsed: Name=%s, Issue=%s, Priority=%s\n",
			ticket.CustomerName, ticket.IssueType, ticket.Priority)
	}
	// model.ResponseMIMEType = "application/json"
	fmt.Println()
}

// ============================================================
// SECTION 7 — Safety Settings
// ============================================================
// Configurable filters for harassment, hate speech, explicit,
// and dangerous content. Customer-facing bots need strict settings.

func demoSafetySettings() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 6: Safety Settings")
	fmt.Println("============================================================")
	fmt.Println("  JioSaathi config: All harm categories -> BLOCK_LOW_AND_ABOVE")
	fmt.Println("  Blocked prompt: 'How to hack a Jio SIM?'")
	fmt.Println("  Fallback: 'I can't help with that. Call Jio Security at 198.'")
	fmt.Println()
}

// ============================================================
// SECTION 8 — Token Counting
// ============================================================
// At Jio scale (10M queries/day), model selection is millions
// in cost difference.

func estimateTokens(text string) int {
	return int(float64(len(strings.Fields(text))) * 1.3)
}

func demoTokenCounting() {
	fmt.Println("============================================================")
	fmt.Println("DEMO 7: Token Counting & Cost")
	fmt.Println("============================================================")

	dailyQueries := 10_000_000
	avgTokens := 150
	dailyTokens := dailyQueries * avgTokens
	flashCost := float64(dailyTokens) * 0.000000075
	proCost := float64(dailyTokens) * 0.00000125

	fmt.Printf("  10M queries/day x 150 tokens = %dM daily tokens\n", dailyTokens/1_000_000)
	fmt.Printf("  Flash: $%.2f/day ($%.0f/month) | Pro: $%.2f/day ($%.0f/month)\n",
		flashCost, flashCost*30, proCost, proCost*30)
	fmt.Println("  Flash is 16x cheaper — model selection matters at scale.")
	fmt.Println()
}

// ============================================================
// SECTION 9 — Key Takeaways
// ============================================================

func printKeyTakeaways() {
	fmt.Println("============================================================")
	fmt.Println("KEY TAKEAWAYS — Gemini API Basics")
	fmt.Println("============================================================")
	fmt.Println("  1. Client + Model handle: Flash (fast/cheap) vs Pro (smart)")
	fmt.Println("  2. Temperature: 0=deterministic, 1+=creative")
	fmt.Println("  3. Streaming: GenerateContentStream for real-time output")
	fmt.Println("  4. Chat sessions maintain history — watch token limits")
	fmt.Println("  5. System instructions set persona before interaction")
	fmt.Println("  6. JSON mode: ResponseMIMEType='application/json'")
	fmt.Println("  7. Safety settings: configure per harm category")
	fmt.Println("  8. CountTokens before sending to estimate cost")
	fmt.Println()
}

// ============================================================
// MAIN
// ============================================================

func main() {
	fmt.Println()
	fmt.Println("============================================================")
	fmt.Println("  FILE 36 : AI — Gemini API Basics (JioSaathi)")
	fmt.Println("============================================================")
	fmt.Println()

	demoTextGeneration()
	demoStreaming()
	demoChat()
	demoSystemInstruction()
	demoJSONMode()
	demoSafetySettings()
	demoTokenCounting()
	printKeyTakeaways()
}

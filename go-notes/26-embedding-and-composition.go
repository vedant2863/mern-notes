// ============================================================
//  FILE 26: Embedding & Composition
// ============================================================
//  Topic: struct embedding, method promotion, shadowing,
//         interface embedding, decorator pattern.
//
//  WHY: Go has no inheritance. Instead, embed one struct inside
//  another — its fields and methods are "promoted." This is
//  simpler and avoids the fragile base class problem.
// ============================================================
//
//  STORY — "ISRO Modular Rocket"
//  ISRO builds the PSLV by snapping interchangeable stages
//  together — booster, heat shield, payload. If one needs an
//  upgrade, swap it without touching the rest.
// ============================================================

package main

import (
	"fmt"
	"strings"
)

// ============================================================
// BLOCK 1 — Struct Embedding Basics
// ============================================================

// SECTION: Basic struct embedding

type BoosterStage struct {
	Thrust   int
	FuelType string
}

func (b BoosterStage) Ignite() string {
	return fmt.Sprintf("Booster ignited: %d kN on %s", b.Thrust, b.FuelType)
}

func (b BoosterStage) Status() string {
	return fmt.Sprintf("Booster [%d kN, %s]", b.Thrust, b.FuelType)
}

type HeatShield struct {
	Strength int
	Active   bool
}

func (h *HeatShield) Activate()   { h.Active = true }
func (h *HeatShield) Deactivate() { h.Active = false }

func (h HeatShield) Status() string {
	state := "inactive"
	if h.Active {
		state = "active"
	}
	return fmt.Sprintf("HeatShield [%d, %s]", h.Strength, state)
}

// SECTION: Composing a rocket from stages
// Promoted fields: rocket.Thrust = rocket.BoosterStage.Thrust

type PSLV struct {
	Name         string
	BoosterStage // embedded
	HeatShield   // embedded
}

// SECTION: Shadowing — outer method wins over promoted
func (p PSLV) Status() string {
	return fmt.Sprintf("Rocket %q — %s | %s", p.Name, p.BoosterStage.Status(), p.HeatShield.Status())
}

// SECTION: Pointer embedding — shared instance
type MissionLog struct {
	Entries []string
}

func (l *MissionLog) Log(msg string) { l.Entries = append(l.Entries, msg) }
func (l *MissionLog) Dump() string   { return strings.Join(l.Entries, "; ") }

type MissionService struct {
	Name        string
	*MissionLog // pointer embedding — shared logger
}

// ============================================================
// BLOCK 2 — Interface Embedding & Advanced Patterns
// ============================================================

// SECTION: Interface embedding (composing interfaces)

type Launcher interface{ Launch(trajectory string) string }
type Deployer interface{ Deploy() string }

type MissionVehicle interface {
	Launcher
	Deployer
}

type SatelliteCarrier struct{ Callsign string }

func (s SatelliteCarrier) Launch(traj string) string {
	return fmt.Sprintf("%s launches on %s trajectory", s.Callsign, traj)
}
func (s SatelliteCarrier) Deploy() string {
	return fmt.Sprintf("%s deploys satellite!", s.Callsign)
}

// SECTION: Decorator via interface embedding

type LoudLauncher struct{ Launcher }

func (l LoudLauncher) Launch(traj string) string {
	return strings.ToUpper(l.Launcher.Launch(traj))
}

// SECTION: Composed interface satisfaction

type Stringer interface{ String() string }
type Validator interface{ Validate() error }
type Printable interface {
	Stringer
	Validator
}

type Scientist struct{ Name, Email string }

func (s Scientist) String() string { return fmt.Sprintf("Scientist(%s, %s)", s.Name, s.Email) }
func (s Scientist) Validate() error {
	if s.Name == "" {
		return fmt.Errorf("name required")
	}
	if !strings.Contains(s.Email, "@") {
		return fmt.Errorf("invalid email")
	}
	return nil
}

// SECTION: Practical decorator — LoggingNotifier

type Notifier interface{ Notify(msg string) string }

type EmailNotifier struct{ Address string }

func (e EmailNotifier) Notify(msg string) string {
	return fmt.Sprintf("Email to %s: %s", e.Address, msg)
}

type LoggingNotifier struct {
	Notifier
	Logs []string
}

func (ln *LoggingNotifier) Notify(msg string) string {
	result := ln.Notifier.Notify(msg)
	ln.Logs = append(ln.Logs, result)
	return result
}

func main() {
	fmt.Println("===== FILE 26: Embedding & Composition =====\n")

	// ── Struct embedding ──
	fmt.Println("--- Struct Embedding ---")

	rocket := PSLV{
		Name:         "PSLV-C56",
		BoosterStage: BoosterStage{Thrust: 4800, FuelType: "solid HTPB"},
		HeatShield:   HeatShield{Strength: 500},
	}

	fmt.Println("Thrust (promoted):", rocket.Thrust)
	fmt.Println(rocket.Ignite())

	rocket.Activate()
	fmt.Println("Shield active:", rocket.Active)

	// Shadowing: PSLV.Status() wins
	fmt.Println(rocket.Status())
	fmt.Println("Inner:", rocket.BoosterStage.Status())

	// ── Pointer embedding ──
	fmt.Println("\n--- Pointer Embedding ---")

	sharedLog := &MissionLog{}
	svc1 := MissionService{Name: "Telemetry", MissionLog: sharedLog}
	svc2 := MissionService{Name: "Navigation", MissionLog: sharedLog}

	svc1.Log("booster separation")
	svc2.Log("orbit insertion")
	fmt.Println("Shared log:", sharedLog.Dump())

	// ── Interface embedding ──
	fmt.Println("\n--- Interface Embedding ---")

	carrier := SatelliteCarrier{Callsign: "PSLV-C51"}
	var mv MissionVehicle = carrier
	fmt.Println(mv.Launch("polar"))
	fmt.Println(mv.Deploy())

	// ── Decorator ──
	loud := LoudLauncher{Launcher: carrier}
	fmt.Println(loud.Launch("geostationary"))

	// ── Printable interface ──
	var p Printable = Scientist{Name: "Dr. Sivan", Email: "sivan@isro.gov.in"}
	fmt.Println(p.String(), "| Validate:", p.Validate())

	// ── LoggingNotifier ──
	fmt.Println("\n--- Decorator: LoggingNotifier ---")

	logged := &LoggingNotifier{Notifier: EmailNotifier{Address: "somnath@isro.gov.in"}}
	fmt.Println(logged.Notify("Launch successful"))
	fmt.Println(logged.Notify("Satellite deployed"))
	fmt.Println("Logs:", logged.Logs)

	fmt.Println("\n--- Composition vs Inheritance ---")
	fmt.Println("Embed structs for reuse. Embed interfaces for decorators.")
	fmt.Println("Shadow methods for custom logic. No diamond of death.")
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Embedding promotes inner fields/methods. rocket.Thrust = shorthand.
// 2. Method promotion: rocket.Ignite() even though Ignite is on BoosterStage.
// 3. Shadowing: outer method takes priority. Inner still accessible explicitly.
// 4. Pointer embedding (*MissionLog) shares one instance across structs.
// 5. Interface embedding composes small interfaces: MissionVehicle = Launcher + Deployer.
// 6. Embedding interface in struct = decorator pattern. Override what you need, delegate rest.
// 7. Ambiguous methods from multiple embeds must be called explicitly.
// ============================================================

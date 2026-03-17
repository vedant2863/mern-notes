/**
 * ========================================================
 *  FILE 32: ERROR HANDLING
 * ========================================================
 *  Topic: try/catch/finally, Error objects, custom errors,
 *         guard clauses, rethrowing, and error wrapping.
 * ========================================================
 *
 *  STORY — ISRO Chandrayaan Lander Vikram
 *  Every subsystem has failsafe routines. When something
 *  breaks, Vikram catches the error, logs telemetry, and
 *  activates a backup instead of crashing the mission.
 * ========================================================
 */

// ========================================================
//  BLOCK 1 — try / catch / finally
// ========================================================

function bootNavigation(terrainMapLoaded) {
  try {
    if (!terrainMapLoaded) throw new Error("Terrain map missing!");
    console.log("Navigation online.");
    return "NAV_OK";
  } catch (error) {
    console.log(`NAV FAILED: ${error.message}`);
    return "NAV_BACKUP";
  } finally {
    console.log("Boot sequence complete.\n");
  }
}

console.log("--- Navigation Boot ---");
console.log("Result:", bootNavigation(true));
console.log("Result:", bootNavigation(false));

// Every Error has .message, .name, .stack
try {
  throw new Error("Thruster anomaly");
} catch (e) {
  console.log(`${e.name}: ${e.message}`);
}


// ========================================================
//  SECTION — Built-in Error Types
// ========================================================

console.log("\n--- Built-in Errors ---");

try { null.ignite(); }
catch (e) { console.log(`${e.name}: ${e.message}`); } // TypeError

try { new Array(-1); }
catch (e) { console.log(`${e.name}: ${e.message}`); } // RangeError

try { console.log(altimeterReading); }
catch (e) { console.log(`${e.name}: ${e.message}`); } // ReferenceError


// ========================================================
//  BLOCK 2 — Custom Errors, Guards, Rethrowing
// ========================================================

class LanderError extends Error {
  constructor(message, subsystem) {
    super(message);
    this.name = "LanderError";
    this.subsystem = subsystem;
  }
}

class ThrusterError extends LanderError {
  constructor(message, thrusterId) {
    super(message, "THRUSTER");
    this.name = "ThrusterError";
    this.thrusterId = thrusterId;
  }
}

class AltitudeError extends LanderError {
  constructor(message) {
    super(message, "ALTIMETER");
    this.name = "AltitudeError";
  }
}

function checkSubsystem(name) {
  if (name === "altimeter") throw new AltitudeError("Sensor erratic");
  if (name === "thruster")  throw new ThrusterError("Fuel blockage", 3);
  console.log(`${name} is nominal.`);
}

// --- instanceof dispatch ---
console.log("\n--- Custom Errors ---");
try {
  checkSubsystem("thruster");
} catch (e) {
  if (e instanceof ThrusterError) {
    console.log(`THRUSTER #${e.thrusterId}: ${e.message}`);
  } else {
    throw e; // rethrow unknown errors
  }
}

// --- Guard clauses ---
function initiateDescent(crew, fuel) {
  if (!Array.isArray(crew) || crew.length === 0) {
    throw new LanderError("Empty crew manifest", "COMMAND");
  }
  if (typeof fuel !== "number" || fuel < 20) {
    throw new LanderError(`Insufficient fuel: ${fuel}%`, "THRUSTER");
  }
  console.log(`Descent initiated with ${fuel}% fuel.`);
}

console.log("\n--- Guard Clauses ---");
try { initiateDescent(["Somnath"], 85); }
catch (e) { console.log(`Aborted: ${e.message}`); }

try { initiateDescent([], 50); }
catch (e) { console.log(`Aborted: ${e.message}`); }

// --- Rethrowing ---
function repair(subsystemName) {
  try {
    checkSubsystem(subsystemName);
  } catch (e) {
    if (e instanceof AltitudeError) {
      console.log("AUTO-FIX: Recalibrating altimeter...\n");
    } else {
      throw e; // can't fix — escalate
    }
  }
}

console.log("\n--- Rethrowing ---");
repair("altimeter");

try { repair("thruster"); }
catch (e) { console.log(`MISSION CONTROL: ${e.name} — ${e.message}`); }

// --- Error wrapping (ES2022 cause) ---
class MissionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "MissionError";
    this.cause = cause;
  }
}

try {
  try { checkSubsystem("thruster"); }
  catch (orig) { throw new MissionError("Pre-descent failed", orig); }
} catch (e) {
  console.log(`\n${e.name}: ${e.message}`);
  console.log(`Caused by: ${e.cause.name} — ${e.cause.message}`);
}


/**
 * ========================================================
 *  KEY TAKEAWAYS
 * ========================================================
 *  1. try/catch/finally: try wraps risky code, catch handles
 *     failures, finally always runs.
 *  2. Every Error has .message, .name, .stack. Use the right
 *     built-in type (TypeError, RangeError, etc.).
 *  3. Custom error classes (extending Error) let you model
 *     domain failures and dispatch with instanceof.
 *  4. Guard clauses validate inputs early, keep happy path clean.
 *  5. Rethrow errors you can't handle — never swallow silently.
 *  6. Error wrapping (.cause) preserves original context.
 * ========================================================
 */

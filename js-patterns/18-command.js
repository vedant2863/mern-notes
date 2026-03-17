/**
 * ============================================================
 *  FILE 18 : The Command Pattern
 *  Topic   : Command, Undo/Redo
 *  Impact  : Text editor Ctrl+Z, Redux actions, task queues,
 *            game replay systems, CLI undo operations
 * ============================================================
 */

// STORY: Umpire Dharmasena oversees the cricket match. Every
// decision is a Command object — so he can execute, queue,
// and undo (DRS review) any match decision.

// ────────────────────────────────────────────────────────────
// BLOCK 1 — Classic Command (execute / undo via DRS)
// ────────────────────────────────────────────────────────────

console.log("=== BLOCK 1: Classic Command ===");

class MatchScoreboard {
  constructor(name) {
    this.name = name;
    this.runs = 0;
    this.wickets = 0;
    this.extras = 0;
  }

  addRuns(n) { this.runs = this.runs + n; }
  removeRuns(n) { this.runs = Math.max(0, this.runs - n); }
  addWicket() { this.wickets = this.wickets + 1; }
  removeWicket() { this.wickets = Math.max(0, this.wickets - 1); }

  addExtra(n) {
    this.extras = this.extras + n;
    this.runs = this.runs + n;
  }

  removeExtra(n) {
    this.extras = Math.max(0, this.extras - n);
    this.runs = Math.max(0, this.runs - n);
  }

  status() {
    return this.name + ": " + this.runs + "/" + this.wickets + " (extras: " + this.extras + ")";
  }
}

class OutCmd {
  constructor(board) { this.board = board; }
  execute() { this.board.addWicket(); }
  undo() { this.board.removeWicket(); }
  describe() { return "Out decision on " + this.board.name; }
}

class WideCmd {
  constructor(board, runs) {
    this.board = board;
    this.runs = runs;
  }
  execute() { this.board.addExtra(this.runs); }
  undo() { this.board.removeExtra(this.runs); }
  describe() { return "Wide (" + this.runs + " extra) on " + this.board.name; }
}

class UmpireControl {
  constructor() {
    this.history = [];
  }

  signal(cmd) {
    console.log("  Dharmasena signals: " + cmd.describe());
    cmd.execute();
    this.history.push(cmd);
  }

  drsReview() {
    let cmd = this.history.pop();
    if (cmd) {
      console.log("  DRS overturns: " + cmd.describe());
      cmd.undo();
    }
  }
}

let india = new MatchScoreboard("India");
let umpire = new UmpireControl();

umpire.signal(new WideCmd(india, 1));
umpire.signal(new OutCmd(india));
console.log("  " + india.status());
umpire.drsReview();
console.log("  " + india.status());

// ────────────────────────────────────────────────────────────
// BLOCK 2 — Macro Command (Powerplay Rules)
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 2: Macro Command ===");

class MacroCommand {
  constructor(name, commands) {
    this.name = name;
    this.commands = commands;
  }

  execute() {
    for (let i = 0; i < this.commands.length; i++) {
      this.commands[i].execute();
    }
  }

  // Undo in reverse order to properly unwind state
  undo() {
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  describe() { return "MACRO[" + this.name + "]"; }
}

let australia = new MatchScoreboard("Australia");
let powerplay = new MacroCommand("Powerplay Burst", [
  new WideCmd(australia, 1),
  new OutCmd(australia),
  new WideCmd(australia, 1),
]);

powerplay.execute();
console.log("  After macro:  " + australia.status());
powerplay.undo();
console.log("  After undo:   " + australia.status());

// ────────────────────────────────────────────────────────────
// BLOCK 3 — Undo/Redo Stack (Scorecard Editor)
// ────────────────────────────────────────────────────────────

console.log("\n=== BLOCK 3: Undo/Redo Stack ===");

class InsertCmd {
  constructor(editor, text, pos) {
    this.editor = editor;
    this.text = text;
    this.pos = pos;
  }

  execute() {
    let before = this.editor.content.substring(0, this.pos);
    let after = this.editor.content.substring(this.pos);
    this.editor.content = before + this.text + after;
  }

  undo() {
    let before = this.editor.content.substring(0, this.pos);
    let after = this.editor.content.substring(this.pos + this.text.length);
    this.editor.content = before + after;
  }

  describe() { return 'Insert "' + this.text + '" at ' + this.pos; }
}

class ScorecardEditor {
  constructor() {
    this.content = "";
    this.undoStack = [];
    this.redoStack = [];
  }

  run(cmd) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];
    console.log('  [exec] ' + cmd.describe() + ' -> "' + this.content + '"');
  }

  undo() {
    let cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    console.log('  [undo] ' + cmd.describe() + ' -> "' + this.content + '"');
  }

  redo() {
    let cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
    console.log('  [redo] ' + cmd.describe() + ' -> "' + this.content + '"');
  }
}

let editor = new ScorecardEditor();
editor.run(new InsertCmd(editor, "Kohli", 0));
editor.run(new InsertCmd(editor, " OUT", 5));
editor.undo();
editor.redo();
editor.run(new InsertCmd(editor, " NOT", 5));

// ────────────────────────────────────────────────────────────
// KEY TAKEAWAYS
// ────────────────────────────────────────────────────────────
// 1. Command encapsulates a request as an object with execute() and undo().
// 2. Decouples the invoker (umpire) from the receiver (scoreboard).
// 3. Macro commands group multiple commands into one atomic operation.
// 4. Undo/Redo uses two stacks — new commands clear the redo stack.

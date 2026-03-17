// ============================================================
// FILE 02: PARSING AND ABSTRACT SYNTAX TREES (AST)
// Topic: How the JS engine transforms source code text into a structured tree
// WHY: Before any JS runs, the engine must parse every byte. On mobile,
//   parsing 1MB of JS takes ~100ms. Understanding parsing helps you
//   optimize load times and understand tooling like Babel and ESLint.
// ============================================================

// ============================================================
// SECTION 1 — The Parsing Pipeline
// STORY: Your source code goes through two phases before execution:
//   tokenization (text -> tokens) then parsing (tokens -> AST tree).
// ============================================================

console.log("=== SECTION 1: The Parsing Pipeline ===");
console.log("  Phase 1: Lexical Analysis (Tokenization)  ->  Tokens");
console.log("  Phase 2: Syntactic Analysis (Parsing)     ->  AST");
console.log("");

// --- The Flow ---
//  "const x = 5 + 3;"  (source text)
//        |
//  Lexer/Tokenizer
//        |
//  [const] [x] [=] [5] [+] [3] [;]  (tokens)
//        |
//  Parser
//        |
//  Abstract Syntax Tree (AST)

// ============================================================
// SECTION 2 — Tokenization
// STORY: The tokenizer reads raw characters one by one, grouping them
//   into meaningful tokens -- like reading letters into words.
// ============================================================

console.log("=== SECTION 2: Tokenization ===");

const tokenExample = [
    { type: "Keyword",     value: "const" },
    { type: "Identifier",  value: "totalPrice" },
    { type: "Punctuator",  value: "=" },
    { type: "Identifier",  value: "basePrice" },
    { type: "Punctuator",  value: "+" },
    { type: "Identifier",  value: "gst" },
    { type: "Punctuator",  value: ";" },
];

console.log("  Source: const totalPrice = basePrice + gst;");
console.log("  Tokens:");
tokenExample.forEach(t => console.log(`    ${t.type.padEnd(12)} : ${t.value}`));
console.log("");

// Token categories: Keywords (const, let, function), Identifiers (myVar),
// Literals (42, "hello"), Operators (+, ===), Punctuators ({, }, ;)

// ============================================================
// SECTION 3 — Abstract Syntax Tree (AST)
// STORY: Tokens are flat. The parser gives them structure by building
//   a tree. This AST is what the rest of the engine works with.
// ============================================================

console.log("=== SECTION 3: AST Structure ===");

// Source: const x = 5 + 3;
// AST (simplified):
const simpleAST = {
    type: "Program",
    body: [{
        type: "VariableDeclaration",
        kind: "const",
        declarations: [{
            type: "VariableDeclarator",
            id: { type: "Identifier", name: "x" },
            init: {
                type: "BinaryExpression",
                operator: "+",
                left:  { type: "NumericLiteral", value: 5 },
                right: { type: "NumericLiteral", value: 3 },
            },
        }],
    }],
};

console.log("  Source: const x = 5 + 3;");
console.log("  AST tree:");
console.log("         Program");
console.log("            |");
console.log("    VariableDeclaration (const)");
console.log("            |");
console.log("    VariableDeclarator");
console.log("       /          \\");
console.log("  Identifier: x   BinaryExpression (+)");
console.log("                    /            \\");
console.log("            Literal: 5       Literal: 3");
console.log("");

// ============================================================
// SECTION 4 — Eager vs Lazy Parsing
// STORY: V8 does NOT fully parse every function upfront. It "lazy parses"
//   (pre-parses) functions that haven't been called yet -- only checking
//   syntax errors, skipping full AST generation. This saves startup time.
// ============================================================

// WHY: If V8 fully parsed every function before running, large apps
// would have terrible startup times.

console.log("=== SECTION 4: Eager vs Lazy Parsing ===");

function immediatelyUsed() {
    return 42;
    // V8 lazy-parses this initially, fully parses when called below
}

function definedButNotCalledYet() {
    return "I might never be called";
    // V8 pre-parses only (syntax check). Full parse never happens!
}

const result = immediatelyUsed();
console.log("  immediatelyUsed() result:", result);
console.log("  definedButNotCalledYet: never called -> never fully parsed");
console.log("");

// IIFEs force eager parsing (parser sees "(" and knows it runs immediately):
const iifResult = (function() { return "eagerly parsed!"; })();
console.log("  IIFE result:", iifResult, "(eagerly parsed)");
console.log("");

// Decision flow:
//   Function defined -> Called immediately? -> YES: EAGER PARSE (full AST)
//                                          -> NO:  LAZY PARSE (syntax only)
//                                                  -> Called later? -> FULL PARSE
//                                                  -> Never called? -> NEVER PARSED

// ============================================================
// SECTION 5 — Syntax Errors vs Runtime Errors
// STORY: SyntaxErrors are caught during PARSING, before any code runs.
//   RuntimeErrors (TypeError, ReferenceError) happen during execution.
// ============================================================

console.log("=== SECTION 5: Parse-Time vs Runtime Errors ===");

// SyntaxError -> parse time (NOTHING in the file runs):
//   function broken( { return 1; }    // Missing ) -> entire file fails

// RuntimeError -> execution time (code before it still runs):
try {
    const val = undefined;
    // val.property;  // TypeError at runtime
    console.log("  This line runs because there's no syntax error.");
} catch (e) {
    console.log("  Runtime error:", e.message);
}

console.log("  SyntaxError = parse time (nothing runs)");
console.log("  TypeError/ReferenceError = runtime (code before runs)");
console.log("");

// ============================================================
// SECTION 6 — Parse Cost and JSON.parse()
// STORY: Parse time is proportional to code size: ~100ms per 1MB on mobile.
//   JSON.parse() is faster than object literals for large static data
//   because JSON grammar is simpler than JS.
// ============================================================

console.log("=== SECTION 6: Parse Cost ===");
console.log("  Rule of thumb: 1MB JS ~ 100ms parse time on mobile");
console.log("  Optimizations: code splitting, tree shaking, lazy loading");
console.log("");

// JSON.parse benchmark:
function generateLargeObject(size) {
    const obj = {};
    for (let i = 0; i < size; i++) obj[`key_${i}`] = `value_${i}`;
    return obj;
}

const largeObj = generateLargeObject(10000);
const jsonString = JSON.stringify(largeObj);

const start1 = process.hrtime.bigint();
const fromLiteral = generateLargeObject(10000);
const end1 = process.hrtime.bigint();

const start2 = process.hrtime.bigint();
const fromJSON = JSON.parse(jsonString);
const end2 = process.hrtime.bigint();

console.log(`  Object creation (10K keys): ${Number(end1 - start1) / 1_000_000}ms`);
console.log(`  JSON.parse (10K keys):      ${Number(end2 - start2) / 1_000_000}ms`);
console.log("  JSON.parse is faster -- simpler grammar, dedicated fast parser in V8.");
console.log("");

// ============================================================
// SECTION 7 — AST in Dev Tools + Mini Tokenizer
// STORY: Babel, ESLint, Prettier, and TypeScript all work by parsing
//   code into an AST, transforming/analyzing it, then generating output.
// ============================================================

console.log("=== SECTION 7: AST in Dev Tools ===");
console.log("  Babel:      Parse -> Transform AST -> Generate code");
console.log("  ESLint:     Parse -> Traverse AST -> Report violations");
console.log("  Prettier:   Parse -> Reformat AST -> Generate formatted code");
console.log("  TypeScript: Parse -> Type-check AST -> Generate JS");
console.log("  Explore: https://astexplorer.net/");
console.log("");

// Mini tokenizer to show how engines scan character by character:
function simpleTokenizer(code) {
    const tokens = [];
    let i = 0;
    while (i < code.length) {
        const char = code[i];
        if (/\s/.test(char)) { i++; continue; }
        if (/\d/.test(char)) {
            let num = '';
            while (i < code.length && /[\d.]/.test(code[i])) { num += code[i]; i++; }
            tokens.push({ type: 'Number', value: num }); continue;
        }
        if (/[a-zA-Z_$]/.test(char)) {
            let word = '';
            while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) { word += code[i]; i++; }
            const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else'];
            tokens.push({ type: keywords.includes(word) ? 'Keyword' : 'Identifier', value: word });
            continue;
        }
        if (char === '"' || char === "'") {
            const quote = char; let str = ''; i++;
            while (i < code.length && code[i] !== quote) { str += code[i]; i++; }
            i++; tokens.push({ type: 'String', value: str }); continue;
        }
        if ('+-*/=<>!&|;,(){}[]'.includes(char)) {
            tokens.push({ type: 'Punctuator', value: char }); i++; continue;
        }
        tokens.push({ type: 'Unknown', value: char }); i++;
    }
    return tokens;
}

const testCode = "const price = 499 + 100;";
const tokens = simpleTokenizer(testCode);
console.log(`  Tokenizing: "${testCode}"`);
tokens.forEach(t => console.log(`    ${t.type.padEnd(12)}: ${t.value}`));
console.log("");

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. Two parsing phases: Tokenization (source -> tokens) and
//    Syntactic Analysis (tokens -> AST). Both happen before execution.
//
// 2. AST = tree of nodes representing code structure. Every tool
//    (Babel, ESLint, Prettier) works on this tree.
//
// 3. V8 uses LAZY PARSING: functions pre-parsed, fully parsed only
//    when called. IIFEs force eager parsing.
//
// 4. SyntaxErrors = parse time (nothing runs).
//    TypeError/ReferenceError = runtime.
//
// 5. Parse cost ~ code size: ~100ms per 1MB on mobile.
//    Code splitting and tree shaking reduce this.
//
// 6. JSON.parse() is faster than object literals for large static data.
// ============================================================

console.log("=== KEY TAKEAWAYS ===");
console.log("1. Two phases: Tokenization (source -> tokens) + Parsing (tokens -> AST)");
console.log("2. AST = tree of nodes. Babel, ESLint, Prettier all work on it.");
console.log("3. V8 lazy-parses: only fully parses functions when called");
console.log("4. SyntaxError = parse time; TypeError = runtime");
console.log("5. Parse cost ~ code size: 1MB JS ~ 100ms on mobile");
console.log("6. JSON.parse() > object literals for large static data");

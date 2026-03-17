/** ============================================================
    FILE 32: Mohalla Chat Server — TCP Multi-Client Chat
    ============================================================
    Topic: TCP networking with the net module
    Combines: net, events, crypto

    USAGE:
      node 32-project-tcp-chat.js server [port]
      node 32-project-tcp-chat.js client [host:port]
    DEMO MODE (no arguments):
      node 32-project-tcp-chat.js
    ============================================================ */

'use strict';

const net = require('net');
const { EventEmitter } = require('events');
const crypto = require('crypto');

// ============================================================
// SECTION 1: Configuration & Helpers
// ============================================================
const DEMO_MODE = process.argv.length <= 2 || process.argv[2] === '--demo';

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const MAGENTA = '\x1b[35m';

const USER_COLORS = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[32m',
  '\x1b[34m', '\x1b[91m', '\x1b[96m', '\x1b[93m'];

function banner(text) {
  const rule = '='.repeat(60);
  console.log(`\n${CYAN}${rule}${RESET}`);
  console.log(`${BOLD}  ${text}${RESET}`);
  console.log(`${CYAN}${rule}${RESET}`);
}
function thinRule() { console.log(DIM + '\u2500'.repeat(60) + RESET); }
function shortId() { return crypto.randomBytes(2).toString('hex').toUpperCase(); }

// ============================================================
// SECTION 2: Message Protocol
// ============================================================
// TCP is a byte stream, not a message stream. We use
// newline-delimited JSON for framing.

function encodeMessage(type, data) {
  return JSON.stringify({ type, ...data }) + '\n';
}

function createMessageParser(callback) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const part of parts) {
      if (!part.trim()) continue;
      try { callback(JSON.parse(part)); } catch { /* skip malformed */ }
    }
  };
}

// ============================================================
// SECTION 3: Chat Server
// ============================================================
// Tracks residents by socket. Broadcasts messages to all
// others. Handles /nick, /list, /quit commands.

class MohallaChatServer extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
    this.colorIndex = 0;
    this.server = null;
  }

  start(port) {
    return new Promise((resolve) => {
      this.server = net.createServer((socket) => this._onConnection(socket));
      this.server.listen(port, '127.0.0.1', () => {
        const addr = this.server.address();
        this.emit('listening', addr);
        resolve(addr);
      });
    });
  }

  _onConnection(socket) {
    const id = shortId();
    const nick = `Resident_${id}`;
    const color = USER_COLORS[this.colorIndex++ % USER_COLORS.length];
    this.clients.set(socket, { nick, color, id });
    this.emit('join', nick);

    this._broadcast(socket, encodeMessage('system', { text: `${nick} joined the mohalla` }));
    socket.write(encodeMessage('system', { text: `Welcome! You are ${nick}. Use /nick, /list, /quit` }));

    const parse = createMessageParser((msg) => this._handleMessage(socket, msg));
    socket.on('data', parse);
    socket.on('close', () => {
      const client = this.clients.get(socket);
      if (client) {
        this.emit('leave', client.nick);
        this._broadcast(socket, encodeMessage('system', { text: `${client.nick} left` }));
        this.clients.delete(socket);
      }
    });
    socket.on('error', () => this.clients.delete(socket));
  }

  _handleMessage(socket, msg) {
    const client = this.clients.get(socket);
    if (!client || msg.type !== 'chat') return;
    const text = msg.text || '';

    if (text.startsWith('/nick ')) {
      const oldNick = client.nick;
      client.nick = text.slice(6).trim() || client.nick;
      socket.write(encodeMessage('system', { text: `You are now ${client.nick}` }));
      this._broadcast(socket, encodeMessage('system', { text: `${oldNick} is now ${client.nick}` }));
      this.emit('nick', oldNick, client.nick);
      return;
    }
    if (text.trim() === '/list') {
      const names = [...this.clients.values()].map(c => c.nick);
      socket.write(encodeMessage('system', { text: `Online (${names.length}): ${names.join(', ')}` }));
      this.emit('list', names);
      return;
    }
    if (text.trim() === '/quit') {
      socket.write(encodeMessage('system', { text: 'Alvida!' }));
      socket.end();
      return;
    }

    this._broadcast(socket, encodeMessage('chat', { nick: client.nick, color: client.color, text }));
    this.emit('message', client.nick, text);
  }

  _broadcast(senderSocket, data) {
    for (const [sock] of this.clients) {
      if (sock !== senderSocket && !sock.destroyed) sock.write(data);
    }
  }

  getClientCount() { return this.clients.size; }

  shutdown() {
    return new Promise((resolve) => {
      for (const [sock] of this.clients) sock.destroy();
      this.clients.clear();
      this.server ? this.server.close(resolve) : resolve();
    });
  }
}

// ============================================================
// SECTION 4: Simulated Client (for Demo)
// ============================================================

class SimulatedResident extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.socket = null;
    this.messages = [];
  }

  connect(port) {
    return new Promise((resolve) => {
      this.socket = net.createConnection({ port, host: '127.0.0.1' }, resolve);
      const parse = createMessageParser((msg) => { this.messages.push(msg); this.emit('message', msg); });
      this.socket.on('data', parse);
      this.socket.on('error', () => {});
    });
  }

  send(text) { if (this.socket && !this.socket.destroyed) this.socket.write(encodeMessage('chat', { text })); }

  disconnect() {
    return new Promise((resolve) => {
      if (!this.socket || this.socket.destroyed) return resolve();
      this.socket.on('close', resolve);
      this.socket.end();
    });
  }

  getLastMessages(n) { return this.messages.slice(-n); }
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// SECTION 5: Demo Mode
// ============================================================

async function runDemo() {
  banner('Mohalla Chat Server (DEMO)');

  const server = new MohallaChatServer();

  server.on('listening', (a) => console.log(`${GREEN}  [SERVER] Listening on ${a.address}:${a.port}${RESET}`));
  server.on('join', (n) => console.log(`${GREEN}  [SERVER] ${n} joined (${server.getClientCount()} online)${RESET}`));
  server.on('leave', (n) => console.log(`${YELLOW}  [SERVER] ${n} left${RESET}`));
  server.on('message', (n, t) => console.log(`${DIM}  [SERVER] <${n}> ${t}${RESET}`));
  server.on('nick', (o, n) => console.log(`${MAGENTA}  [SERVER] ${o} -> ${n}${RESET}`));

  thinRule();
  console.log(`${BOLD}  Step 1: Start server${RESET}`);
  thinRule();
  const addr = await server.start(0);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 2: Two residents connect${RESET}`);
  thinRule();
  const amit = new SimulatedResident('Amit');
  const priya = new SimulatedResident('Priya');
  await amit.connect(addr.port); await wait(100);
  await priya.connect(addr.port); await wait(100);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 3: Set nicknames${RESET}`);
  thinRule();
  amit.send('/nick Amit'); await wait(100);
  priya.send('/nick Priya'); await wait(100);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 4: Exchange messages${RESET}`);
  thinRule();
  amit.send('Priya ji, chai pe milte hain?'); await wait(100);
  const priyaGot = priya.getLastMessages(1)[0];
  if (priyaGot?.type === 'chat') console.log(`  Priya got: ${CYAN}<${priyaGot.nick}>${RESET} ${priyaGot.text}`);

  priya.send('Haan bhai, shaam ko pakode bhi!'); await wait(100);
  const amitGot = amit.getLastMessages(1)[0];
  if (amitGot?.type === 'chat') console.log(`  Amit got: ${CYAN}<${amitGot.nick}>${RESET} ${amitGot.text}`);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 5: /list command${RESET}`);
  thinRule();
  amit.send('/list'); await wait(100);
  const listMsg = amit.getLastMessages(1)[0];
  if (listMsg) console.log(`  Amit sees: ${DIM}${listMsg.text}${RESET}`);

  console.log('');
  thinRule();
  console.log(`${BOLD}  Step 6: Disconnect & shutdown${RESET}`);
  thinRule();
  await priya.disconnect(); await wait(150);
  await amit.disconnect(); await wait(100);
  await server.shutdown();
  console.log(`  ${GREEN}Server shut down cleanly.${RESET}`);

  banner('KEY TAKEAWAYS');
  console.log(`
  1. TCP is a byte stream — frame messages yourself (newline-JSON)
  2. net.createServer handles concurrent connections via callbacks
  3. Map of socket->metadata tracks and broadcasts to clients
  4. Broadcast = iterate all sockets except the sender
  5. socket.on('close') fires even on abrupt disconnections
  6. EventEmitter decouples logging from server logic
  7. Port 0 lets the OS pick an available port for testing
  8. Graceful shutdown: close all sockets, then server
`);
}

// ============================================================
// SECTION 6: Interactive Server
// ============================================================

async function runServer(port) {
  const server = new MohallaChatServer();
  server.on('listening', (a) => {
    console.log(`${GREEN}[SERVER] Listening on ${a.address}:${a.port}${RESET}`);
    console.log('Waiting for residents... (Ctrl+C to stop)\n');
  });
  server.on('join', (n) => console.log(`${GREEN}[+] ${n} (${server.getClientCount()} online)${RESET}`));
  server.on('leave', (n) => console.log(`${YELLOW}[-] ${n} (${server.getClientCount()} online)${RESET}`));
  server.on('message', (n, t) => console.log(`<${n}> ${t}`));
  server.on('nick', (o, n) => console.log(`${MAGENTA}[~] ${o} -> ${n}${RESET}`));
  await server.start(port);
  process.on('SIGINT', async () => { await server.shutdown(); process.exit(0); });
}

// ============================================================
// SECTION 7: Interactive Client
// ============================================================

async function runClient(hostPort) {
  const [host, portStr] = hostPort.includes(':') ? hostPort.split(':') : ['127.0.0.1', hostPort];
  const port = parseInt(portStr, 10) || 4000;
  const readline = require('readline');

  const socket = net.createConnection({ host, port }, () => {
    console.log(`${GREEN}Connected to mohalla at ${host}:${port}${RESET}`);
    console.log('Type messages, or /nick /list /quit\n');
  });

  const parse = createMessageParser((msg) => {
    if (msg.type === 'system') console.log(`${DIM}[mohalla] ${msg.text}${RESET}`);
    else if (msg.type === 'chat') console.log(`${msg.color || ''}<${msg.nick}>${RESET} ${msg.text}`);
  });
  socket.on('data', parse);
  socket.on('close', () => { console.log(`${YELLOW}Disconnected.${RESET}`); process.exit(0); });
  socket.on('error', (err) => { console.error(`${RED}Error: ${err.message}${RESET}`); process.exit(1); });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => { if (line.trim()) socket.write(encodeMessage('chat', { text: line })); });
  rl.on('close', () => socket.end());
}

// ============================================================
// SECTION 8: Entry Point
// ============================================================

async function main() {
  if (DEMO_MODE) return runDemo();
  switch (process.argv[2]) {
    case 'server': return runServer(parseInt(process.argv[3], 10) || 4000);
    case 'client': return runClient(process.argv[3] || '127.0.0.1:4000');
    default:
      console.log('Usage:');
      console.log('  node 32-project-tcp-chat.js               # demo');
      console.log('  node 32-project-tcp-chat.js server [port]');
      console.log('  node 32-project-tcp-chat.js client [host:port]');
  }
}

main().catch(err => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});

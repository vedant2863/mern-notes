/** ============================================================
 *  FILE 27: DESIGN A CHAT SYSTEM
 *  ============================================================
 *  Topic: WebSocket management, message ordering, delivery receipts,
 *         presence detection, fan-out for group chats
 *
 *  WHY THIS MATTERS:
 *  Chat systems handle 100+ billion messages daily. Reliable delivery,
 *  correct ordering, and real-time presence are critical. Large group
 *  chats stress every part from fan-out to notification delivery.
 *  ============================================================ */

// STORY: WhatsApp-style Indian Family Group
// The "Sharma Parivar" group has 47 members. The system must show
// single tick (sent), double tick (delivered), blue tick (read).
// When Grandpa's phone drops 2G, messages queue until he reconnects.

console.log("=".repeat(70));
console.log("  FILE 27: DESIGN A CHAT SYSTEM");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Requirements
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1 — Requirements");
console.log("-".repeat(50));

console.log("Functional: 1:1 messaging, groups (256 members), delivery receipts,");
console.log("  presence/last seen, offline queuing, message ordering");
console.log("Non-Functional: <100ms delivery, at-least-once guarantee,");
console.log("  500M concurrent connections, per-conversation ordering");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Connection Management (WebSocket)
// ════════════════════════════════════════════════════════════════

// WHY: WebSockets provide full-duplex communication needed for real-time chat.

console.log("SECTION 2 — Connection Management");
console.log("-".repeat(50));

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.servers = ["chat-srv-1", "chat-srv-2", "chat-srv-3"];
  }
  _hash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return h; }
  connect(userId, deviceInfo = {}) {
    const serverId = this.servers[Math.abs(this._hash(userId)) % this.servers.length];
    const conn = { userId, serverId, connectedAt: Date.now(), lastHeartbeat: Date.now(), deviceInfo, status: "connected" };
    this.connections.set(userId, conn);
    return conn;
  }
  disconnect(userId) { const conn = this.connections.get(userId); if (conn) { conn.status = "disconnected"; } return conn; }
  isConnected(userId) { const conn = this.connections.get(userId); return conn && conn.status === "connected"; }
  getStats() {
    let connected = 0, disconnected = 0;
    for (const conn of this.connections.values()) { if (conn.status === "connected") connected++; else disconnected++; }
    return { connected, disconnected };
  }
}

const connManager = new ConnectionManager();
const familyMembers = [
  { id: "grandpa_sharma", device: "JioPhone" }, { id: "papa_sharma", device: "Samsung M31" },
  { id: "mummy_sharma", device: "Redmi Note 10" }, { id: "rahul_sharma", device: "iPhone 14" },
  { id: "priya_sharma", device: "OnePlus Nord" }
];

console.log("Family members connecting:");
familyMembers.forEach(m => {
  const conn = connManager.connect(m.id, { device: m.device });
  console.log(`  ${m.id.padEnd(18)} -> ${conn.serverId} (${m.device})`);
});
connManager.disconnect("grandpa_sharma");
console.log("\n  grandpa_sharma disconnected (2G dropped)");
const connStats = connManager.getStats();
console.log(`  Stats: ${connStats.connected} online, ${connStats.disconnected} offline`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Message Sending with Sequence Numbers
// ════════════════════════════════════════════════════════════════

// WHY: Core message flow must handle online delivery, offline queuing,
// and correct ordering despite network reordering.

console.log("SECTION 3 — Message Sending with Sequence Numbers");
console.log("-".repeat(50));

class Message {
  constructor(senderId, recipientId, content) {
    this.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.senderId = senderId; this.recipientId = recipientId;
    this.content = content; this.timestamp = Date.now(); this.sequenceNum = 0;
  }
}

class MessageStore {
  constructor() { this.messages = new Map(); this.conversationMessages = new Map(); this.sequenceCounters = new Map(); }
  _convKey(user1, user2) { return [user1, user2].sort().join(":"); }
  store(message) {
    const convKey = this._convKey(message.senderId, message.recipientId);
    if (!this.sequenceCounters.has(convKey)) this.sequenceCounters.set(convKey, 0);
    const seq = this.sequenceCounters.get(convKey) + 1;
    this.sequenceCounters.set(convKey, seq);
    message.sequenceNum = seq;
    this.messages.set(message.id, message);
    if (!this.conversationMessages.has(convKey)) this.conversationMessages.set(convKey, []);
    this.conversationMessages.get(convKey).push(message.id);
    return message;
  }
  getConversation(user1, user2, limit = 20) {
    const convKey = this._convKey(user1, user2);
    const msgIds = this.conversationMessages.get(convKey) || [];
    return msgIds.slice(-limit).map(id => this.messages.get(id));
  }
}

const messageStore = new MessageStore();
const msgs = [
  new Message("mummy_sharma", "papa_sharma", "Aaj dinner kya banana hai?"),
  new Message("papa_sharma", "mummy_sharma", "Dal chawal bana do"),
  new Message("mummy_sharma", "papa_sharma", "Theek hai, sabzi bhi banaungi"),
];

console.log("1:1 Conversation (Mummy <-> Papa):");
msgs.forEach(msg => {
  const stored = messageStore.store(msg);
  console.log(`  [Seq ${stored.sequenceNum}] ${stored.senderId.split("_")[0]}: ${stored.content}`);
});

// Out-of-order simulation
console.log("\nOut-of-order arrival simulation:");
class MessageOrderer {
  constructor() { this.buffers = new Map(); }
  _getBuffer(convKey) {
    if (!this.buffers.has(convKey)) this.buffers.set(convKey, { expectedSeq: 1, buffer: new Map(), delivered: [] });
    return this.buffers.get(convKey);
  }
  receiveMessage(convKey, message) {
    const state = this._getBuffer(convKey);
    const seq = message.sequenceNum;
    if (seq === state.expectedSeq) {
      state.delivered.push(message); state.expectedSeq++;
      while (state.buffer.has(state.expectedSeq)) {
        state.delivered.push(state.buffer.get(state.expectedSeq));
        state.buffer.delete(state.expectedSeq); state.expectedSeq++;
      }
      return { action: "delivered", seq };
    } else if (seq > state.expectedSeq) { state.buffer.set(seq, message); return { action: "buffered", seq, waiting: state.expectedSeq }; }
    return { action: "duplicate", seq };
  }
  getDelivered(convKey) { return (this.buffers.get(convKey) || {}).delivered || []; }
}

const orderer = new MessageOrderer();
[{ sequenceNum: 1, content: "Hey!" }, { sequenceNum: 3, content: "How's the weather?" },
 { sequenceNum: 2, content: "What's up?" }, { sequenceNum: 5, content: "Ok bye!" },
 { sequenceNum: 4, content: "Let's meet tomorrow" }
].forEach(msg => {
  const result = orderer.receiveMessage("test_conv", msg);
  console.log(`  Received seq=${msg.sequenceNum} "${msg.content}" -> ${result.action}${result.waiting ? ` (waiting for ${result.waiting})` : ""}`);
});
console.log("  Final order:");
orderer.getDelivered("test_conv").forEach(msg => console.log(`    Seq ${msg.sequenceNum}: "${msg.content}"`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Delivery Receipts (Tick System)
// ════════════════════════════════════════════════════════════════

// WHY: WhatsApp's tick system is the gold standard for delivery feedback.

console.log("SECTION 4 — Delivery Receipts (Tick System)");
console.log("-".repeat(50));

class DeliveryTracker {
  constructor(connectionManager) { this.receipts = new Map(); this.connManager = connectionManager; }
  markSent(messageId) { this.receipts.set(messageId, { status: "sent", sentAt: Date.now() }); return "\u2713  Single tick (sent to server)"; }
  markDelivered(messageId) { const r = this.receipts.get(messageId); if (r) { r.status = "delivered"; r.deliveredAt = Date.now(); } return "\u2713\u2713  Double tick (delivered to device)"; }
  markRead(messageId) { const r = this.receipts.get(messageId); if (r) { r.status = "read"; r.readAt = Date.now(); } return "\u2713\u2713 (blue) Read"; }
}

const deliveryTracker = new DeliveryTracker(connManager);
const testMsg = new Message("rahul_sharma", "priya_sharma", "Movie chalein kya?");
testMsg.id = "msg_test_001";

console.log(`  Rahul sends: "${testMsg.content}"`);
console.log(`    ${deliveryTracker.markSent(testMsg.id)}`);
console.log(`    ${deliveryTracker.markDelivered(testMsg.id)}`);
console.log(`    ${deliveryTracker.markRead(testMsg.id)}`);

console.log("\n  Offline: Grandpa gets single tick only. When reconnects -> double -> blue.");
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Presence System
// ════════════════════════════════════════════════════════════════

// WHY: "Last seen" is how families track who is awake.

console.log("SECTION 5 — Presence System");
console.log("-".repeat(50));

class PresenceService {
  constructor() { this.presence = new Map(); this.heartbeatTimeout = 35000; }
  goOnline(userId) { this.presence.set(userId, { status: "online", lastSeen: Date.now(), lastHeartbeat: Date.now() }); }
  goOffline(userId) { this.presence.set(userId, { status: "offline", lastSeen: Date.now() }); }
  getPresence(userId) {
    const p = this.presence.get(userId);
    if (!p) return { status: "unknown" };
    if (p.status === "online" && p.lastHeartbeat && Date.now() - p.lastHeartbeat > this.heartbeatTimeout) { p.status = "offline"; p.lastSeen = p.lastHeartbeat; }
    return { status: p.status, lastSeen: p.lastSeen };
  }
}

const presence = new PresenceService();
[{ id: "grandpa_sharma", action: "offline" }, { id: "papa_sharma", action: "online" },
 { id: "mummy_sharma", action: "online" }, { id: "rahul_sharma", action: "online" },
].forEach(p => p.action === "online" ? presence.goOnline(p.id) : presence.goOffline(p.id));

console.log("Family Presence:");
["grandpa_sharma", "papa_sharma", "mummy_sharma", "rahul_sharma"].forEach(id => {
  const s = presence.getPresence(id);
  console.log(`  ${(s.status === "online" ? "[ONLINE]" : "[OFFLINE]").padEnd(10)} ${id}`);
});
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Group Chat Fan-Out and Offline Queue
// ════════════════════════════════════════════════════════════════

// WHY: Sending one group message to 47 members requires fan-out.
// Offline members need queued delivery.

console.log("SECTION 6 — Group Chat Fan-Out and Offline Queue");
console.log("-".repeat(50));

class GroupChatService {
  constructor(presenceService) { this.groups = new Map(); this.presenceService = presenceService; }
  createGroup(groupId, name, members) {
    this.groups.set(groupId, { name, members: new Set(members) });
  }
  sendGroupMessage(groupId, senderId, content) {
    const group = this.groups.get(groupId);
    if (!group) return null;
    const online = [], offline = [];
    for (const memberId of group.members) {
      if (memberId === senderId) continue;
      const p = this.presenceService.getPresence(memberId);
      (p.status === "online" ? online : offline).push(memberId);
    }
    return { total: online.length + offline.length, online: online.length, offline: offline.length };
  }
}

const groupService = new GroupChatService(presence);
groupService.createGroup("sharma_family", "Sharma Parivar", ["papa_sharma", "mummy_sharma", "grandpa_sharma", "rahul_sharma", "priya_sharma"]);

console.log('Group "Sharma Parivar" (5 members):');
const fanOut = groupService.sendGroupMessage("sharma_family", "mummy_sharma", "Kal Diwali ki shopping chalein?");
console.log(`  Fan-out: ${fanOut.total} members | ${fanOut.online} online (instant) | ${fanOut.offline} offline (queued)`);

// Offline Queue
class OfflineQueue {
  constructor() { this.queues = new Map(); }
  enqueue(userId, message) {
    if (!this.queues.has(userId)) this.queues.set(userId, []);
    this.queues.get(userId).push({ ...message, queuedAt: Date.now() });
  }
  drain(userId) {
    const queue = this.queues.get(userId) || [];
    this.queues.set(userId, []);
    return { messages: queue, count: queue.length };
  }
}

const offlineQueue = new OfflineQueue();
[{ senderId: "mummy_sharma", content: "Dadaji, aapne dawai li?" },
 { senderId: "rahul_sharma", content: "Dadaji pranam!" },
 { senderId: "papa_sharma", content: "Papa, main aaj aaunga" },
].forEach(m => offlineQueue.enqueue("grandpa_sharma", m));

console.log("\nGrandpa offline. Messages queued:");
console.log(`  Queue size: ${offlineQueue.drain("grandpa_sharma").count} messages`);

offlineQueue.enqueue("grandpa_sharma", { senderId: "mummy_sharma", content: "Dinner ready" });
const drained = offlineQueue.drain("grandpa_sharma");
console.log(`\nGrandpa reconnects: ${drained.count} message(s) delivered`);
drained.messages.forEach(m => console.log(`  From ${m.senderId.split("_")[0]}: "${m.content}"`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 7 — Full Chat System Simulation
// ════════════════════════════════════════════════════════════════

console.log("SECTION 7 — Full Chat System Simulation");
console.log("-".repeat(50));

class ChatServer {
  constructor() {
    this.connManager = new ConnectionManager();
    this.presence = new PresenceService();
    this.messageStore = new MessageStore();
    this.deliveryTracker = new DeliveryTracker(this.connManager);
    this.offlineQueue = new OfflineQueue();
    this.eventLog = [];
  }
  userConnect(userId, device) {
    this.connManager.connect(userId, { device }); this.presence.goOnline(userId);
    const queued = this.offlineQueue.drain(userId);
    this.eventLog.push({ type: "connect", userId, queuedMessages: queued.count });
    return queued;
  }
  sendMessage(senderId, recipientId, content) {
    const msg = new Message(senderId, recipientId, content);
    this.messageStore.store(msg);
    this.deliveryTracker.markSent(msg.id);
    const rp = this.presence.getPresence(recipientId);
    if (rp.status === "online") { this.deliveryTracker.markDelivered(msg.id); return { status: "delivered" }; }
    this.offlineQueue.enqueue(recipientId, { messageId: msg.id, senderId, content, timestamp: msg.timestamp });
    return { status: "queued" };
  }
}

const server = new ChatServer();
console.log("=== Sharma Family Evening Chat ===\n");
["papa_sharma", "mummy_sharma", "rahul_sharma", "priya_sharma"].forEach(id => {
  server.userConnect(id, "Android");
  console.log(`  ${id.split("_")[0]} connected`);
});
console.log("  grandpa stays OFFLINE\n");

[["mummy_sharma", "papa_sharma", "Doodh le aana"],
 ["rahul_sharma", "priya_sharma", "IPL ka score dekha?"],
 ["mummy_sharma", "grandpa_sharma", "Dadaji dinner ready hai"],
].forEach(([from, to, content]) => {
  const result = server.sendMessage(from, to, content);
  const tick = result.status === "delivered" ? "\u2713\u2713" : "\u2713";
  console.log(`  ${tick} ${from.split("_")[0]} -> ${to.split("_")[0]}: "${content}" [${result.status}]`);
});

console.log("\nGrandpa comes online:");
const gpQueued = server.userConnect("grandpa_sharma", "JioPhone");
console.log(`  ${gpQueued.count} message(s) delivered`);
gpQueued.messages.forEach(m => console.log(`    From ${m.senderId.split("_")[0]}: "${m.content}"`));
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. WebSocket connections need heartbeat to detect stale connections.");
console.log("  2. Sequence numbers guarantee ordering despite network reordering.");
console.log("  3. Delivery receipts (sent/delivered/read) need per-message state tracking.");
console.log("  4. Presence uses heartbeat with timeout — no heartbeat = offline.");
console.log("  5. Group fan-out: one message to N members is O(N) per message.");
console.log("  6. Offline queues hold messages until user reconnects and drains.");
console.log("  7. Cursor-based pagination loads chat history efficiently.");
console.log();
console.log('  "In an Indian family group, the real scaling challenge is not');
console.log('   messages per second — it is good morning images per sunrise."');
console.log();

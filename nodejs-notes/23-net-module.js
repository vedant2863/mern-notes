/** ============================================================
    FILE 23: Net Module — TCP Servers and Clients
    ============================================================
    Topic: The `net` module for low-level TCP networking
    WHY THIS MATTERS:
    HTTP is built on TCP. The net module exposes Node's lowest
    networking layer — sockets, streams, and raw bytes.
    ============================================================ */

// ============================================================
// STORY: BSNL Telephone Exchange
// Operator Sharma manages trunk calls at the BSNL exchange.
// Each phone line is a TCP socket — raw and direct. The
// exchange (server) connects subscribers (clients) to relay
// messages over reliable connections.
// ============================================================

const net = require('net');

// ============================================================
// EXAMPLE BLOCK 1 — TCP Echo Server and Client
// ============================================================

function runTCPDemo() {
  return new Promise((resolve) => {
    let callsCompleted = 0;
    const totalCalls = 2;
    let server;

    // ──────────────────────────────────────────────────────────
    // Creating the TCP server — the telephone exchange
    // ──────────────────────────────────────────────────────────
    // net.createServer() creates a raw TCP server — no HTTP
    // headers, methods, or status codes. Just raw data over sockets.

    server = net.createServer((socket) => {
      // `socket` is a Duplex stream — readable AND writable.
      const callerAddr = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`[Exchange] New trunk call from ${callerAddr}`);

      socket.setEncoding('utf8');
      // Without setEncoding, 'data' events deliver Buffers.

      // Socket events: 'data', 'end', 'close', 'error'
      socket.on('data', (data) => {
        console.log(`[Exchange] Received: ${data.trim()}`);
        socket.write(`RELAY: ${data.trim()}\n`);
        // socket.write() sends data without disconnecting.
      });

      socket.on('end', () => {
        // 'end' fires when the caller calls socket.end() — "done talking."
        console.log(`[Exchange] Caller ${callerAddr} hung up`);
      });

      socket.on('close', (hadError) => {
        console.log(`[Exchange] Line disconnected (error: ${hadError})`);
      });

      socket.on('error', (err) => {
        console.log(`[Exchange] Line error: ${err.message}`);
      });
    });

    server.on('error', (err) => {
      console.log(`[Exchange] Error: ${err.message}`);
    });

    // Port 0 = OS picks an available port (great for tests)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      console.log(`[Exchange] BSNL exchange open on port ${port}`);
      connectSubscribers(port);
    });

    // ──────────────────────────────────────────────────────────
    // TCP Client — net.createConnection()
    // ──────────────────────────────────────────────────────────

    function connectSubscribers(port) {
      for (let i = 1; i <= totalCalls; i++) createSubscriber(i, port);
    }

    function createSubscriber(id, port) {
      const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
        // Callback fires once the connection is established ('connect' event).
        console.log(`[Subscriber ${id}] Connected to exchange`);
        client.write(`Namaste from subscriber ${id}\n`);
      });

      client.setEncoding('utf8');

      client.on('data', (data) => {
        console.log(`[Subscriber ${id}] Exchange relayed: ${data.trim()}`);
        client.end();
        // socket.end() sends a FIN packet — "I'm done talking."
      });

      client.on('end', () => console.log(`[Subscriber ${id}] Call ended`));

      client.on('close', () => {
        console.log(`[Subscriber ${id}] Line disconnected`);
        callsCompleted++;
        if (callsCompleted === totalCalls) {
          console.log('\n[Shutdown] All calls done, closing exchange...');
          server.close(() => {
            console.log('[Shutdown] Exchange closed.');
            resolve();
          });
        }
      });

      client.on('error', (err) => {
        console.log(`[Subscriber ${id}] Error: ${err.message}`);
      });
    }
  });
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. net.createServer() creates a raw TCP server — no HTTP framing.
// 2. Each connection yields a socket (Duplex stream) with
//    events: 'data', 'end', 'close', 'error'.
// 3. socket.write() sends data; socket.end() signals half-close.
// 4. socket.setEncoding('utf8') converts Buffers to strings.
// 5. net.createConnection() creates a TCP client socket.
// 6. Always handle 'error' on both server and socket.
// 7. Port 0 lets the OS pick an available port.
// 8. Clean shutdown: wait for clients, then server.close().
// ============================================================

runTCPDemo().then(() => {
  console.log('\nAll done. Sharma sahab clocks out of the BSNL exchange.');
});

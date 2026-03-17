/** ============================================================
    FILE 24: DNS Module — Name Resolution in Node.js
    ============================================================
    Topic: The `dns` module for hostname lookups and resolution
    WHY THIS MATTERS:
    Every HTTP request starts with a DNS lookup. Node offers two
    very different methods — understanding them helps you debug
    connection issues and optimize network performance.
    ============================================================ */

// ============================================================
// STORY: India Post Pincode Directory
// Postmaster Verma has TWO directories:
//   1. Local register (OS resolver — dns.lookup)
//   2. Central pincode database (DNS protocol — dns.resolve)
// They can give DIFFERENT answers for the same address!
// ============================================================

const dns = require('dns');
const dnsPromises = dns.promises;

// ============================================================
// EXAMPLE BLOCK 1 — DNS Lookups and Resolution
// ============================================================

async function runDNSDemo() {
  console.log('=== Postmaster Verma opens the sorting office ===\n');

  // ──────────────────────────────────────────────────────────
  // dns.getServers() — which DNS servers is Node using?
  // ──────────────────────────────────────────────────────────
  console.log('DNS servers:', dns.getServers());
  // Output: [ '8.8.8.8', '8.8.4.4' ] (varies by system)

  // ──────────────────────────────────────────────────────────
  // dns.lookup() — OS resolver (getaddrinfo, reads /etc/hosts)
  // Runs on the libuv thread pool, NOT the network.
  // ──────────────────────────────────────────────────────────
  console.log('\n--- dns.lookup (OS resolver) ---');

  try {
    const result = await dnsPromises.lookup('localhost');
    console.log(`dns.lookup('localhost'): ${result.address} (IPv${result.family})`);
    // Output: 127.0.0.1 (IPv4)
  } catch (err) {
    console.log(`  lookup failed: ${err.message}`);
  }

  try {
    const all = await dnsPromises.lookup('localhost', { all: true });
    console.log(`dns.lookup({ all: true }):`, all);
    // Output: [ { address: '127.0.0.1', family: 4 }, ... ]
    // { all: true } returns ALL matching addresses.
  } catch (err) {
    console.log(`  lookup all failed: ${err.message}`);
  }

  // ──────────────────────────────────────────────────────────
  // dns.resolve4() — DNS protocol directly (c-ares, non-blocking)
  // Does NOT read /etc/hosts. Queries configured DNS servers.
  // ──────────────────────────────────────────────────────────
  console.log('\n--- dns.resolve4 (DNS protocol) ---');

  try {
    const addresses = await dnsPromises.resolve4('localhost');
    console.log(`dns.resolve4('localhost'):`, addresses);
  } catch (err) {
    console.log(`dns.resolve4('localhost') failed: ${err.code}`);
    console.log('  (Normal — localhost is in /etc/hosts, not DNS)');
  }

  // ──────────────────────────────────────────────────────────
  // dns.reverse() — IP to hostname
  // ──────────────────────────────────────────────────────────
  console.log('\n--- dns.reverse ---');

  try {
    const hostnames = await dnsPromises.reverse('127.0.0.1');
    console.log(`dns.reverse('127.0.0.1'):`, hostnames);
  } catch (err) {
    console.log(`dns.reverse failed: ${err.code || err.message}`);
  }

  // ──────────────────────────────────────────────────────────
  // External hostname (may fail offline)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- External DNS (may fail offline) ---');

  try {
    const result = await dnsPromises.lookup('example.com');
    console.log(`dns.lookup('example.com'): ${result.address}`);
  } catch (err) {
    console.log(`dns.lookup('example.com') failed (expected offline)`);
  }

  try {
    const mx = await dnsPromises.resolve('example.com', 'MX');
    console.log(`dns.resolve('example.com', 'MX'):`, mx);
    // resolve() supports: A, AAAA, MX, TXT, SRV, NS, CNAME, SOA, PTR
  } catch (err) {
    console.log(`dns.resolve MX failed (expected offline)`);
  }

  // ──────────────────────────────────────────────────────────
  // lookup vs resolve summary
  // ──────────────────────────────────────────────────────────
  console.log('\n--- lookup vs resolve ---');
  console.log('dns.lookup():  OS resolver, /etc/hosts, libuv thread pool');
  console.log('dns.resolve(): DNS protocol (c-ares), no /etc/hosts, non-blocking');
  console.log('http.get() uses dns.lookup() by default');

  console.log('\n=== Postmaster Verma closes the sorting office ===');
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. dns.lookup() uses the OS resolver (/etc/hosts + system DNS),
//    runs on the libuv thread pool.
// 2. dns.resolve4() uses DNS protocol via c-ares, does NOT
//    read /etc/hosts. These two can return different results.
// 3. dns.promises provides async/await versions of all methods.
// 4. Always wrap DNS calls in try/catch — network may be down.
// 5. http.get() uses dns.lookup() by default, so /etc/hosts
//    entries are respected.
// 6. dns.resolve() supports record types: A, AAAA, MX, TXT,
//    SRV, NS, CNAME, SOA, PTR, NAPTR.
// ============================================================

runDNSDemo().then(() => console.log('\nAll done.'));

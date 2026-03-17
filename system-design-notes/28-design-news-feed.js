/** ============================================================
 *  FILE 28: DESIGN A NEWS FEED SYSTEM
 *  ============================================================
 *  Topic: Fan-out on write vs read, ranking algorithms, cursor
 *         pagination, celebrity problem, hybrid fan-out
 *
 *  WHY THIS MATTERS:
 *  News feeds power Instagram, Twitter, and LinkedIn. The core
 *  challenge is delivering personalized content to millions in
 *  real-time. When Virat Kohli posts with 270M followers, the
 *  fan-out strategy determines system survival.
 *  ============================================================ */

// STORY: Instagram India / Virat Kohli
// Virat's 270M followers cannot get fan-out-on-write (would take 4.5
// minutes per post). Instagram uses pull for celebrities, push for
// normal users. This hybrid keeps feeds fresh without melting servers.

console.log("=".repeat(70));
console.log("  FILE 28: DESIGN A NEWS FEED SYSTEM");
console.log("=".repeat(70));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 1 — Requirements and Data Model
// ════════════════════════════════════════════════════════════════

console.log("SECTION 1 — Requirements and Data Model");
console.log("-".repeat(50));

console.log("Scale: 500M DAU, 250M new posts/day, 5B feed reads/day");
console.log("Feed generation <200ms, new posts visible within 5s for normal users\n");

class User {
  constructor(id, name, followerCount = 0) {
    this.id = id; this.name = name; this.followerCount = followerCount;
    this.isCelebrity = followerCount > 100000;
    this.following = new Set(); this.followers = new Set(); this.posts = [];
  }
}

class Post {
  constructor(authorId, content, type = "text") {
    this.id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.authorId = authorId; this.content = content; this.type = type;
    this.timestamp = Date.now(); this.likes = 0; this.comments = 0; this.shares = 0;
  }
}

class SocialGraph {
  constructor() { this.users = new Map(); }
  addUser(id, name, followerCount = 0) { const u = new User(id, name, followerCount); this.users.set(id, u); return u; }
  follow(followerId, followeeId) {
    const follower = this.users.get(followerId), followee = this.users.get(followeeId);
    if (follower && followee) { follower.following.add(followeeId); followee.followers.add(followerId); followee.followerCount = followee.followers.size; }
  }
  getUser(id) { return this.users.get(id); }
  getFollowees(userId) { const u = this.users.get(userId); return u ? Array.from(u.following) : []; }
  getFollowers(userId) { const u = this.users.get(userId); return u ? Array.from(u.followers) : []; }
}

const graph = new SocialGraph();
graph.addUser("virat", "Virat Kohli", 270000000);
graph.addUser("anushka", "Anushka Sharma", 65000000);
graph.addUser("rahul", "Rahul from Delhi", 150);
graph.addUser("priya", "Priya from Mumbai", 300);
graph.addUser("amit", "Amit from Pune", 80);

graph.follow("rahul", "virat"); graph.follow("rahul", "anushka");
graph.follow("rahul", "priya"); graph.follow("rahul", "amit");
graph.follow("priya", "virat"); graph.follow("priya", "rahul");
graph.follow("amit", "rahul"); graph.follow("amit", "priya");

console.log("Users:");
for (const u of graph.users.values()) {
  const tag = u.isCelebrity ? " [CELEBRITY]" : "";
  console.log(`  ${u.name.padEnd(25)} Followers: ${u.followerCount.toLocaleString().padStart(15)}${tag}`);
}
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 2 — Fan-Out on Write (Push Model)
// ════════════════════════════════════════════════════════════════

// WHY: Pre-computes feeds — fast reads but expensive writes for celebrities.

console.log("SECTION 2 — Fan-Out on Write (Push Model)");
console.log("-".repeat(50));

class FanOutOnWrite {
  constructor(socialGraph) { this.graph = socialGraph; this.feeds = new Map(); }
  publish(post) {
    const followers = this.graph.getFollowers(post.authorId);
    followers.forEach(followerId => {
      if (!this.feeds.has(followerId)) this.feeds.set(followerId, []);
      this.feeds.get(followerId).unshift({ postId: post.id, authorId: post.authorId, content: post.content, timestamp: post.timestamp });
    });
    return { fanOutCount: followers.length };
  }
  getFeed(userId, limit = 10) { return (this.feeds.get(userId) || []).slice(0, limit); }
}

const pushModel = new FanOutOnWrite(graph);
const rahulPost = new Post("rahul", "Amazing chole bhature at Connaught Place!");
const r1 = pushModel.publish(rahulPost);
console.log(`Normal user (Rahul, ${graph.getFollowers("rahul").length} followers): ${r1.fanOutCount} writes`);
console.log(`\nCelebrity (Virat, 270M followers): fan-out = 270M writes`);
console.log(`  At 1us/write = 270 seconds = 4.5 MINUTES! THIS IS THE CELEBRITY PROBLEM`);
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 3 — Fan-Out on Read (Pull Model)
// ════════════════════════════════════════════════════════════════

// WHY: Fetches posts at read time — perfect for celebrities.

console.log("SECTION 3 — Fan-Out on Read (Pull Model)");
console.log("-".repeat(50));

class FanOutOnRead {
  constructor(socialGraph) { this.graph = socialGraph; this.postStore = new Map(); }
  publish(post) {
    if (!this.postStore.has(post.authorId)) this.postStore.set(post.authorId, []);
    this.postStore.get(post.authorId).unshift(post);
    return { writeOps: 1 };
  }
  getFeed(userId, limit = 10) {
    const followees = this.graph.getFollowees(userId);
    const allPosts = [];
    followees.forEach(fId => { allPosts.push(...(this.postStore.get(fId) || []).slice(0, 20)); });
    allPosts.sort((a, b) => b.timestamp - a.timestamp);
    return { posts: allPosts.slice(0, limit), readOps: followees.length };
  }
}

const pullModel = new FanOutOnRead(graph);
[new Post("virat", "Century number 80!"), new Post("priya", "Weekend coding session"),
 new Post("amit", "New cafe in Koregaon Park!")].forEach(p => pullModel.publish(p));

const pullFeed = pullModel.getFeed("rahul", 5);
console.log(`Rahul's feed (pull): ${pullFeed.readOps} reads, ${pullFeed.posts.length} posts`);
console.log("Problem: If Rahul follows 500 accounts, feed generation = 2500ms\n");

// ════════════════════════════════════════════════════════════════
// SECTION 4 — Hybrid Fan-Out (Instagram's Approach)
// ════════════════════════════════════════════════════════════════

// WHY: Push for normal users, pull for celebrities at read time.

console.log("SECTION 4 — Hybrid Fan-Out (Instagram's Approach)");
console.log("-".repeat(50));

class HybridFeedService {
  constructor(socialGraph) {
    this.graph = socialGraph;
    this.precomputedFeeds = new Map();
    this.celebrityPosts = new Map();
  }
  publish(post) {
    const author = this.graph.getUser(post.authorId);
    if (!author) return null;
    if (author.isCelebrity) {
      if (!this.celebrityPosts.has(post.authorId)) this.celebrityPosts.set(post.authorId, []);
      this.celebrityPosts.get(post.authorId).unshift(post);
      return { strategy: "pull", reason: `${author.name} has ${author.followerCount.toLocaleString()} followers`, writeOps: 1 };
    }
    const followers = this.graph.getFollowers(post.authorId);
    followers.forEach(followerId => {
      if (!this.precomputedFeeds.has(followerId)) this.precomputedFeeds.set(followerId, []);
      this.precomputedFeeds.get(followerId).unshift({ postId: post.id, authorId: post.authorId, authorName: author.name, content: post.content, timestamp: post.timestamp, source: "push" });
    });
    return { strategy: "push", reason: `${author.name} has ${author.followerCount.toLocaleString()} followers`, writeOps: followers.length };
  }
  getFeed(userId, limit = 10) {
    const pushFeed = (this.precomputedFeeds.get(userId) || []).slice(0, limit * 2);
    const celebrityEntries = [];
    this.graph.getFollowees(userId).forEach(fId => {
      const f = this.graph.getUser(fId);
      if (f && f.isCelebrity) {
        (this.celebrityPosts.get(fId) || []).slice(0, 10).forEach(p => {
          celebrityEntries.push({ postId: p.id, authorId: p.authorId, authorName: f.name, content: p.content, timestamp: p.timestamp, source: "pull" });
        });
      }
    });
    const merged = [...pushFeed, ...celebrityEntries].sort((a, b) => b.timestamp - a.timestamp);
    return { entries: merged.slice(0, limit), pushCount: pushFeed.length, pullCount: celebrityEntries.length };
  }
}

const hybridFeed = new HybridFeedService(graph);
const hybridPosts = [
  new Post("virat", "New record! 50 Test centuries!"),
  new Post("anushka", "Loved shooting in Rajasthan today"),
  new Post("rahul", "Monday motivation: Keep coding!"),
  new Post("priya", "New blog post on system design"),
];
hybridPosts.forEach((p, i) => { p.timestamp = Date.now() - (hybridPosts.length - i) * 1000; });

console.log("Publishing with hybrid strategy:\n");
hybridPosts.forEach(p => {
  const result = hybridFeed.publish(p);
  console.log(`  [${result.strategy.toUpperCase()}] ${p.authorId.padEnd(10)} (${result.writeOps} writes) - ${result.reason}`);
});

console.log("\nRahul's hybrid feed:");
const hResult = hybridFeed.getFeed("rahul", 5);
console.log(`  ${hResult.pushCount} push + ${hResult.pullCount} pull entries`);
hResult.entries.forEach((e, i) => console.log(`  ${i + 1}. [${e.source.toUpperCase()}] ${e.authorName}: "${e.content.substring(0, 40)}..."`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 5 — Feed Ranking Algorithm
// ════════════════════════════════════════════════════════════════

// WHY: Chronological feeds are dead — ranking shows what matters most.

console.log("SECTION 5 — Feed Ranking Algorithm");
console.log("-".repeat(50));

class FeedRanker {
  constructor() { this.weights = { recency: 0.3, engagement: 0.25, relationship: 0.25, contentType: 0.1, diversity: 0.1 }; }
  rankFeed(entries, viewerContext) {
    const authorAppearances = {};
    const scored = entries.map(entry => {
      const ageHours = (Date.now() - entry.timestamp) / 3600000;
      const recency = Math.exp(-ageHours / 24);
      const engagement = Math.min(1, ((entry.likes || 0) + (entry.comments || 0) * 2) / 10000);
      const relationship = Math.min(1, (viewerContext.interactions[entry.authorId] || 0) / 50);
      const typeScores = { video: 1.0, image: 0.8, text: 0.5 };
      const contentType = typeScores[entry.type] || 0.5;
      const appearances = authorAppearances[entry.authorId] || 0;
      const diversity = Math.max(0, 1 - appearances * 0.3);
      authorAppearances[entry.authorId] = appearances + 1;

      const finalScore = recency * this.weights.recency + engagement * this.weights.engagement +
        relationship * this.weights.relationship + contentType * this.weights.contentType + diversity * this.weights.diversity;
      return { ...entry, rankScore: parseFloat(finalScore.toFixed(4)) };
    });
    scored.sort((a, b) => b.rankScore - a.rankScore);
    return scored;
  }
}

const ranker = new FeedRanker();
const feedEntries = [
  { authorId: "virat", authorName: "Virat Kohli", content: "World Cup trophy!", type: "image", timestamp: Date.now() - 1800000, likes: 5000000, comments: 200000 },
  { authorId: "priya", authorName: "Priya", content: "My new React project", type: "link", timestamp: Date.now() - 600000, likes: 15, comments: 3 },
  { authorId: "amit", authorName: "Amit", content: "Morning run in Pune!", type: "image", timestamp: Date.now() - 300000, likes: 50, comments: 8 },
];
const ranked = ranker.rankFeed(feedEntries, { userId: "rahul", interactions: { priya: 45, amit: 30, virat: 10 } });
console.log(`Weights: ${JSON.stringify(ranker.weights)}\n`);
ranked.forEach((e, i) => console.log(`  ${i + 1}. [Score: ${e.rankScore}] ${e.authorName}: "${e.content}"`));
console.log();

// ════════════════════════════════════════════════════════════════
// SECTION 6 — Cursor-Based Pagination
// ════════════════════════════════════════════════════════════════

// WHY: Offset pagination breaks with real-time feeds; cursor is stable.

console.log("SECTION 6 — Cursor-Based Pagination");
console.log("-".repeat(50));

class PaginatedFeed {
  constructor() { this.allPosts = []; }
  addPosts(posts) { this.allPosts.push(...posts); this.allPosts.sort((a, b) => b.timestamp - a.timestamp); }
  getPageCursor(cursor, limit) {
    let startIdx = 0;
    if (cursor) { startIdx = this.allPosts.findIndex(p => p.timestamp < cursor); if (startIdx === -1) startIdx = this.allPosts.length; }
    const items = this.allPosts.slice(startIdx, startIdx + limit);
    return { items, nextCursor: items.length > 0 ? items[items.length - 1].timestamp : null, hasMore: startIdx + limit < this.allPosts.length };
  }
}

const paginatedFeed = new PaginatedFeed();
for (let i = 0; i < 15; i++) paginatedFeed.addPosts([{ id: `p${i}`, content: `Post ${i + 1}`, timestamp: Date.now() - i * 60000 }]);

let cursor = null;
for (let page = 0; page < 3; page++) {
  const result = paginatedFeed.getPageCursor(cursor, 5);
  console.log(`  Page ${page}: ${result.items.map(p => p.id).join(", ")} | hasMore: ${result.hasMore}`);
  cursor = result.nextCursor;
}
console.log("\n  Why cursor wins: new posts don't shift position, no duplicates, efficient with DB indexes.");
console.log();

// ════════════════════════════════════════════════════════════════
// KEY TAKEAWAYS
// ════════════════════════════════════════════════════════════════

console.log("=".repeat(70));
console.log("  KEY TAKEAWAYS");
console.log("=".repeat(70));
console.log();
console.log("  1. Fan-out on WRITE: pre-computes feeds, fast reads, expensive writes.");
console.log("  2. Fan-out on READ: no write cost, expensive reads, good for celebrities.");
console.log("  3. HYBRID: push for <100K followers, pull for celebrities.");
console.log("  4. Virat (270M followers) cannot fan-out on write — 4.5 min per post.");
console.log("  5. Ranking uses recency, engagement, relationship, and diversity signals.");
console.log("  6. Cursor pagination prevents duplicates in infinite scroll.");
console.log("  7. Feed caches reduce re-computation; celebrity posts invalidate zero caches.");
console.log();
console.log('  "When Virat posts after a century, 270 million fans want to');
console.log('   double-tap, not see a loading spinner."');
console.log();

// ============================================================
// 12 - COLLECTIONS: Vec<T>
// ============================================================
// Vec<T> is Rust's most used collection — a growable,
// heap-allocated array. Understanding its API and memory
// model (capacity vs length) makes you effective in Rust.
// ============================================================

// ============================================================
// STORY: The Jio Cinema Watchlist
// ============================================================
// You open Jio Cinema and build your watchlist: ADD movies
// (push), REMOVE the last one (pop), REORDER by rating (sort),
// FILTER out watched ones (retain), MOVE some to a "watched"
// list (drain). A Vec is exactly this — dynamic, ordered, and
// packed with methods to manipulate data efficiently.
// ============================================================

// ============================================================
// 1. CREATING VECTORS
// ============================================================

fn demo_creating_vecs() {
    println!("=== 1. Creating Vectors ===\n");

    let mut watchlist: Vec<String> = Vec::new();
    watchlist.push(String::from("RRR"));
    println!("From new: {:?}", watchlist);

    let movies = vec!["Bahubali", "KGF", "Pushpa", "Jawan", "Pathaan"];
    println!("From macro: {:?}", movies);

    let ratings = vec![0u8; 5];
    println!("Repeated: {:?}", ratings);

    // with_capacity pre-allocates to avoid reallocation
    let mut upcoming = Vec::with_capacity(10);
    upcoming.push("Pushpa 2");
    upcoming.push("KGF 3");
    println!("With capacity: {:?} (len={}, cap={})",
        upcoming, upcoming.len(), upcoming.capacity());

    let numbers: Vec<i32> = (1..=5).collect();
    println!("From range: {:?}", numbers);
}

// ============================================================
// 2. PUSH, POP, INSERT, REMOVE
// ============================================================
// push/pop are O(1), insert/remove at arbitrary positions are O(n).

fn demo_push_pop() {
    println!("\n=== 2. Push, Pop, Insert, Remove ===\n");

    let mut watchlist = vec![
        String::from("RRR"), String::from("KGF"), String::from("Bahubali"),
    ];

    watchlist.push(String::from("Jawan"));
    println!("After push: {:?}", watchlist);

    let removed = watchlist.pop();
    println!("Popped: {:?}", removed);

    watchlist.insert(1, String::from("Dangal"));
    println!("After insert at 1: {:?}", watchlist);

    let removed = watchlist.remove(2);
    println!("Removed index 2: {}", removed);

    // swap_remove is O(1) but doesn't preserve order
    let removed = watchlist.swap_remove(0);
    println!("swap_remove(0): {} -> {:?}", removed, watchlist);
}

// ============================================================
// 3. INDEXING AND GET
// ============================================================
// Direct indexing panics on out-of-bounds. get() returns Option.

fn demo_indexing() {
    println!("\n=== 3. Indexing and get() ===\n");

    let movies = vec!["Lagaan", "3 Idiots", "PK", "Dangal", "Chhichhore"];

    println!("First: {}", movies[0]);

    match movies.get(10) {
        Some(movie) => println!("Found: {}", movie),
        None => println!("Index 10: Not found (safe!)"),
    }

    println!("First: {:?}", movies.first());
    println!("Last: {:?}", movies.last());

    let top_three = &movies[0..3];
    println!("Top 3: {:?}", top_three);

    println!("Has PK: {}", movies.contains(&"PK"));

    let pos = movies.iter().position(|&m| m == "Dangal");
    println!("Dangal at index: {:?}", pos);
}

// ============================================================
// 4. ITERATION
// ============================================================
// iter() borrows, iter_mut() borrows mutably, into_iter() owns.

fn demo_iteration() {
    println!("\n=== 4. Iteration ===\n");

    let movies = vec!["RRR", "KGF", "Bahubali", "Pushpa", "Jawan"];

    for (i, movie) in movies.iter().enumerate() {
        println!("  {}. {}", i + 1, movie);
    }

    let mut ratings = vec![7.5, 8.0, 9.0, 7.0, 8.5];
    for rating in ratings.iter_mut() {
        *rating += 0.5;
    }
    println!("\nBoosted ratings: {:?}", ratings);

    // Functional-style: filter + map + collect
    let prices = vec![199, 299, 499, 149, 599];
    let discounted: Vec<f64> = prices.iter()
        .filter(|&&p| p >= 200)
        .map(|&p| p as f64 * 0.8)
        .collect();
    println!("Discounted prices (>= 200): {:?}", discounted);
}

// ============================================================
// 5. SORT AND SORT_BY
// ============================================================

fn demo_sorting() {
    println!("\n=== 5. Sorting ===\n");

    let mut ratings = vec![7.5_f64, 9.2, 6.8, 8.5, 7.0, 9.5];
    ratings.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("Sorted ratings: {:?}", ratings);

    ratings.sort_by(|a, b| b.partial_cmp(a).unwrap());
    println!("Top ratings first: {:?}", ratings);

    // sort_by_key extracts a key for comparison
    let mut movies = vec![
        ("RRR", 2022), ("Bahubali", 2015), ("KGF", 2018),
        ("Pushpa", 2021), ("Jawan", 2023),
    ];
    movies.sort_by_key(|&(_, year)| year);
    println!("\nBy year:");
    for (name, year) in &movies {
        println!("  {} ({})", name, year);
    }

    let mut names = vec!["Pushpa", "Arjun", "Bahubali", "KGF", "Dangal"];
    names.sort_by_key(|name| name.len());
    println!("By length: {:?}", names);
}

// ============================================================
// 6. RETAIN, DRAIN, DEDUP
// ============================================================

fn demo_retain_drain_dedup() {
    println!("\n=== 6. Retain, Drain, Dedup ===\n");

    // retain keeps elements where the closure returns true
    let mut scores = vec![3, 7, 2, 9, 5, 8, 1, 6, 10, 4];
    scores.retain(|&s| s >= 7);
    println!("High scores (>= 7): {:?}", scores);

    // drain removes a range and returns them as an iterator
    let mut queue = vec!["Ticket #1", "Ticket #2", "Ticket #3", "Ticket #4", "Ticket #5"];
    let processed: Vec<&str> = queue.drain(0..3).collect();
    println!("Processed: {:?}", processed);
    println!("Remaining: {:?}", queue);

    // dedup removes consecutive duplicates; sort first for full dedup
    let mut all_items = vec![3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    all_items.sort();
    all_items.dedup();
    println!("Sort + dedup: {:?}", all_items);
}

// ============================================================
// 7. CAPACITY AND MEMORY
// ============================================================

fn demo_capacity() {
    println!("\n=== 7. Capacity and Memory ===\n");

    let mut v: Vec<i32> = Vec::new();
    println!("Empty: len={}, capacity={}", v.len(), v.capacity());

    for i in 1..=20 { v.push(i); }
    println!("After 20 pushes: len={}, capacity={}", v.len(), v.capacity());

    v.shrink_to_fit();
    println!("After shrink: len={}, capacity={}", v.len(), v.capacity());

    v.truncate(5);
    println!("After truncate(5): {:?}", v);

    let cap_before = v.capacity();
    v.clear();
    println!("After clear: len={}, capacity={} (was {})", v.len(), v.capacity(), cap_before);
}

// ============================================================
// 8. EXTEND, APPEND, SPLIT_OFF
// ============================================================

fn demo_extend_and_split() {
    println!("\n=== 8. Extend, Append, Split_off ===\n");

    let mut hindi = vec!["Jawan", "Pathaan"];
    let south = vec!["RRR", "KGF", "Pushpa"];
    hindi.extend(south.iter());
    println!("Extended: {:?}", hindi);

    let mut all_movies: Vec<String> = vec![String::from("Lagaan")];
    let mut new_movies = vec![String::from("Dunki"), String::from("Animal")];
    all_movies.append(&mut new_movies);
    println!("After append: {:?}", all_movies);
    println!("Source after append: {:?}", new_movies);

    let mut playlist = vec![1, 2, 3, 4, 5, 6, 7, 8];
    let second_half = playlist.split_off(4);
    println!("First half: {:?}", playlist);
    println!("Second half: {:?}", second_half);
}

// ============================================================
// 9. PRACTICAL EXAMPLE — MOVIE WATCHLIST MANAGER
// ============================================================

#[derive(Debug, Clone)]
struct Movie {
    title: String,
    year: u16,
    rating: f64,
    watched: bool,
}

impl Movie {
    fn new(title: &str, year: u16, rating: f64) -> Self {
        Self { title: String::from(title), year, rating, watched: false }
    }
}

struct Watchlist { movies: Vec<Movie> }

impl Watchlist {
    fn new() -> Self { Self { movies: Vec::new() } }

    fn add(&mut self, movie: Movie) {
        if !self.movies.iter().any(|m| m.title == movie.title) {
            println!("  Added: {}", movie.title);
            self.movies.push(movie);
        } else {
            println!("  Already in list: {}", movie.title);
        }
    }

    fn mark_watched(&mut self, title: &str) {
        if let Some(movie) = self.movies.iter_mut().find(|m| m.title == title) {
            movie.watched = true;
            println!("  Marked '{}' as watched", title);
        }
    }

    fn remove_watched(&mut self) -> Vec<Movie> {
        let watched: Vec<Movie> = self.movies.iter().filter(|m| m.watched).cloned().collect();
        self.movies.retain(|m| !m.watched);
        watched
    }

    fn top_rated(&self, n: usize) -> Vec<&Movie> {
        let mut sorted: Vec<&Movie> = self.movies.iter().collect();
        sorted.sort_by(|a, b| b.rating.partial_cmp(&a.rating).unwrap());
        sorted.truncate(n);
        sorted
    }

    fn display(&self) {
        println!("\n  --- Watchlist ({} movies) ---", self.movies.len());
        for (i, movie) in self.movies.iter().enumerate() {
            let status = if movie.watched { "done" } else { "pending" };
            println!("  {}. {} ({}) - {:.1}/10 [{}]", i + 1, movie.title, movie.year, movie.rating, status);
        }
    }
}

fn demo_practical_watchlist() {
    println!("\n=== 9. Practical: Movie Watchlist ===\n");

    let mut list = Watchlist::new();

    println!("Adding movies:");
    list.add(Movie::new("RRR", 2022, 8.0));
    list.add(Movie::new("KGF Chapter 2", 2022, 7.4));
    list.add(Movie::new("Tumbbad", 2018, 8.3));
    list.add(Movie::new("Jawan", 2023, 6.9));
    list.add(Movie::new("RRR", 2022, 8.0)); // Duplicate
    list.display();

    println!("\nWatching movies:");
    list.mark_watched("RRR");

    let history = list.remove_watched();
    println!("\nMoved to history: {:?}",
        history.iter().map(|m| &m.title).collect::<Vec<_>>());
    list.display();

    println!("\n  Top 3 rated:");
    for movie in list.top_rated(3) {
        println!("    {} - {:.1}/10", movie.title, movie.rating);
    }
}

// ============================================================
// MAIN
// ============================================================

fn main() {
    demo_creating_vecs();
    demo_push_pop();
    demo_indexing();
    demo_iteration();
    demo_sorting();
    demo_retain_drain_dedup();
    demo_capacity();
    demo_extend_and_split();
    demo_practical_watchlist();

    // ============================================================
    // KEY TAKEAWAYS
    // ============================================================
    println!("\n=== KEY TAKEAWAYS ===\n");
    println!("1. Vec<T> is a growable, heap-allocated array — Rust's most used collection.");
    println!("2. vec! macro is the easiest way to create: vec![1, 2, 3].");
    println!("3. push/pop are O(1). insert/remove at index are O(n).");
    println!("4. get() returns Option (safe). Direct indexing panics on out-of-bounds.");
    println!("5. iter() borrows, iter_mut() borrows mutably, into_iter() takes ownership.");
    println!("6. sort_by and sort_by_key for custom ordering.");
    println!("7. retain filters in-place. drain removes and returns a range.");
    println!("8. dedup removes consecutive duplicates. Sort first for full dedup.");
}

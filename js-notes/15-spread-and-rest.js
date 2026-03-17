// ============================================================
// FILE 15: SPREAD & REST OPERATORS
// Topic: The ... syntax — spreading values apart and gathering them together
// WHY: Spread and rest eliminate boilerplate for copying, merging,
//      and handling variable-length data.
// ============================================================

// ============================================================
// EXAMPLE 1 — DJ Bunty: Spreading & Merging
// Story: DJ Bunty builds playlists by spreading and merging tracks.
// ============================================================

// --- Spread in Arrays ---

const baraatPlaylist = ["London Thumakda", "Gallan Goodiyan", "Balam Pichkari"];
const sangeetPlaylist = ["Nachde Ne Saare", "Cutiepie"];

// Copy (shallow)
const backup = [...baraatPlaylist];

// Merge arrays
const fullSetlist = [...baraatPlaylist, "--- Break ---", ...sangeetPlaylist];
console.log(fullSetlist);

// Remove duplicates via Set
const requests = ["Cutiepie", "London Thumakda", "Cutiepie"];
const unique = [...new Set(requests)];
console.log(unique); // [ 'Cutiepie', 'London Thumakda' ]

// --- Spread in Objects ---

const defaults = { volume: 50, bass: "medium", echo: false };
const prefs = { bass: "heavy", echo: true, dhol: "extra" };

// Merge — later keys override earlier ones
const liveSettings = { ...defaults, ...prefs };
console.log(liveSettings); // { volume: 50, bass: 'heavy', echo: true, dhol: 'extra' }

// --- Spread in Function Calls ---

const bpmReadings = [120, 128, 135, 110, 140];
console.log("Peak BPM:", Math.max(...bpmReadings)); // 140


// ============================================================
// EXAMPLE 2 — DJ Bunty: Collecting with Rest
// Story: Bunty collects song requests and separates
// the headliner from the rest.
// ============================================================

// --- Rest in Function Parameters ---

function buildSetlist(headliner, ...openingTracks) {
  console.log(`Headliner: ${headliner}`);
  console.log(`Opening: ${openingTracks.join(", ")}`);
}
buildSetlist("Chaiyya Chaiyya", "Dola Re Dola", "Munni Badnaam");

// --- Rest in Destructuring ---

const [intro, ...middleTracks] = ["Welcome Song", "Mehndi Hai Rachne Wali", "Morni Banke"];
console.log(intro);        // Welcome Song
console.log(middleTracks); // remaining tracks

const { title, artist, ...albumMeta } = {
  title: "Yeh Jawaani Hai Deewani",
  artist: "Pritam",
  year: 2013,
  genre: "Bollywood",
};
console.log(albumMeta); // { year: 2013, genre: 'Bollywood' }

// --- Rest vs arguments ---
// Rest produces a real Array; `arguments` does not.
const newStyleMix = (...tracks) => {
  console.log(Array.isArray(tracks)); // true
};


// ============================================================
// EXAMPLE 3 — Shallow Copy vs Deep Copy
// Story: Bunty copies a config, tweaks the copy,
// and accidentally corrupts the original.
// ============================================================

const originalConfig = {
  djName: "DJ Bunty",
  effects: { reverb: "hall", delay: 300 },
};

// Spread = shallow copy
const shallowCopy = { ...originalConfig };

// Top-level change — safe
shallowCopy.djName = "DJ Sonu";
console.log(originalConfig.djName); // DJ Bunty

// Nested change — DANGER! Shared reference
shallowCopy.effects.reverb = "plate";
console.log(originalConfig.effects.reverb); // plate <-- BUG!

// --- structuredClone() — proper deep clone ---
const deepCopy = structuredClone({
  djName: "DJ Bunty",
  effects: { reverb: "hall", delay: 300 },
  createdAt: new Date("2025-01-01"),
});
deepCopy.effects.reverb = "spring";
console.log(deepCopy.createdAt instanceof Date); // true
// Handles circular refs, Dates, Maps, Sets. Cannot clone functions.


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. SPREAD expands/unpacks — copy, merge, pass into functions.
// 2. REST collects/gathers — function params and destructuring.
// 3. Rest params produce a real Array; `arguments` does not.
// 4. Spread creates SHALLOW copies — nested refs are shared.
// 5. JSON.parse(JSON.stringify()) deep copies but loses
//    functions, undefined, Dates, Maps, Sets.
// 6. structuredClone() is the modern deep clone — handles
//    circular refs, Dates, Maps, Sets, but NOT functions.
// ============================================================

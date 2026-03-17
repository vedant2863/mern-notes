// ============================================================
// FILE 14: Destructuring — Unboxing Values
// Topic: Extracting values from arrays and objects into variables
// Why: Destructuring eliminates repetitive access patterns and
//      is used everywhere in modern JavaScript and React.
// ============================================================

// =============================================
// STORY: Flipkart Delivery Day
// Parcels arrive at the colony — destructuring
// is the art of unpacking those boxes efficiently.
// =============================================


// =============================================
// SECTION 1: Array Destructuring
// =============================================

// Assigns by POSITION
const [phone, screenGuard, backCover] = ["Smartphone", "Screen Guard", "Back Cover"];
console.log(phone); // Smartphone

// Skipping elements
const deliveryItems = ["Wrap", "Wrap", "Earbuds", "Wrap", "Laptop Stand"];
const [, , earbuds, , laptopStand] = deliveryItems;
console.log(earbuds); // Earbuds

// Rest pattern — collect remaining items
const [firstItem, ...remainingItems] = ["Charger", "USB Cable", "Earphones", "Manual"];
console.log(remainingItems); // [ 'USB Cable', 'Earphones', 'Manual' ]

// Default values (only for undefined, NOT null)
const [primary, secondary = "No Extra Item"] = ["Power Bank"];
console.log(secondary); // No Extra Item

const [a = 10, b = 20] = [null, undefined];
console.log(a); // null  (not undefined, so default skipped)
console.log(b); // 20

// Swapping variables
let sender = "Flipkart";
let receiver = "Raju";
[sender, receiver] = [receiver, sender];
console.log(sender, receiver); // Raju Flipkart


// =============================================
// SECTION 2: Object Destructuring
// =============================================

// Assigns by PROPERTY NAME
const orderDetails = {
  name: "Raju",
  category: "Electronics",
  pincode: 110001,
  totalAmount: 15999,
};

const { name, pincode, totalAmount } = orderDetails;
console.log(name, pincode); // Raju 110001

// Renaming with :
const { name: customerName, category: itemCategory } = orderDetails;
console.log(customerName); // Raju

// Default values + rename combined
const { couponCode: appliedCoupon = "No Coupon" } = orderDetails;
console.log(appliedCoupon); // No Coupon

// Rest pattern in objects
const { name: buyerName, ...otherDetails } = orderDetails;
console.log(otherDetails); // { category, pincode, totalAmount }

// Nested destructuring
const shipment = {
  contents: {
    phoneBox: { name: "Samsung Galaxy M34", price: 14999 },
    accessoryBox: { name: "Boult Earbuds", price: 1299 },
  },
  deliveryCharge: 40,
};

const {
  contents: {
    phoneBox: { name: phoneName, price },
    accessoryBox: { price: accessoryPrice },
  },
  deliveryCharge,
} = shipment;
console.log(phoneName, price, accessoryPrice); // Samsung Galaxy M34 14999 1299
// NOTE: "contents" is NOT a variable — only leaf names become variables.


// =============================================
// SECTION 3: Function Parameter Destructuring
// =============================================

// Object parameter destructuring
function displayOrder({ name, pincode, category: cat = "General" }) {
  console.log(`${name} | Pincode ${pincode} | Category: ${cat}`);
}
displayOrder({ name: "Raju", pincode: 110001, category: "Electronics" });

// Destructuring return values (common pattern, like React useState)
function useDelivery(trackingId) {
  let status = "dispatched";
  const updateStatus = () => (status = "delivered");
  return [trackingId, status, updateStatus];
}
const [trackingId, status] = useDelivery("FLK-78923");
console.log(trackingId, status); // FLK-78923 dispatched


// =============================================
// SECTION 4: Mixed Destructuring
// =============================================

const deliveryData = {
  routeName: "South Delhi Morning Route",
  parcels: [
    { name: "Raju", area: "Saket" },
    { name: "Meena", area: "Hauz Khas" },
  ],
};

const {
  routeName,
  parcels: [firstDelivery, ...otherParcels],
} = deliveryData;

console.log(routeName);          // South Delhi Morning Route
console.log(firstDelivery.name); // Raju

// Destructuring in loops
const orderList = [
  { name: "Wireless Mouse", type: "electronics", value: 599 },
  { name: "Cotton Kurta", type: "clothing", value: 899 },
];

for (const { name: itemName, type, value } of orderList) {
  console.log(`${itemName} [${type}] — ${value}`);
}


// ============================================================
// KEY TAKEAWAYS
// ------------------------------------------------------------
// 1. Array destructuring assigns by POSITION.
// 2. Object destructuring assigns by PROPERTY NAME.
// 3. Use : to rename, = for defaults. Combine: { x: y = 0 }
// 4. ... (rest) collects remaining items into an array/object.
// 5. Skipping: [, , third]. Swapping: [a, b] = [b, a].
// 6. Function param destructuring makes APIs self-documenting.
// 7. Nested destructuring follows data shape — only leaf
//    names become variables.
// 8. Defaults activate for undefined only, NOT for null.
// ============================================================

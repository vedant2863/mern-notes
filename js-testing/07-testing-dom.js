// ============================================================
// FILE 07: TESTING DOM INTERACTIONS
// Topic: Testing DOM elements, user events, and UI behavior using Testing Library
// ============================================================

// ============================================================
// STORY: When a Myntra user clicks "Add to Bag", cart count must
//   increment, a toast appears, and the button changes to "Go to
//   Bag". If ANY DOM update fails, the customer abandons the purchase.
// ============================================================

// BLOCK 1 — The DOM Testing Problem
// Node.js has NO DOM. jsdom simulates it for testing.
// Configure: environment: 'jsdom' in vitest.config.js or jest.config.js

console.log("--- The DOM Testing Problem ---");
console.log("Node.js has no DOM. jsdom simulates it for testing.");
console.log("");


// ============================================================
// SECTION 1 — Testing Library Query Priority
// ============================================================

// "The more your tests resemble the way your software is used,
//  the more confidence they give you." -- Kent C. Dodds

// Priority 1: getByRole('button', { name: 'Add to Bag' })  -- BEST
// Priority 2: getByLabelText('Email Address')               -- form inputs
// Priority 3: getByPlaceholderText('Search...')              -- when no label
// Priority 4: getByText('Free delivery above Rs. 499')      -- visible text
// Priority 5: getByTestId('product-card-123')               -- LAST RESORT

console.log("--- Query Priority ---");
console.log("1. getByRole  2. getByLabelText  3. getByText  4. getByTestId (last resort)");
console.log("");


// ============================================================
// SECTION 2 — getBy vs queryBy vs findBy
// ============================================================

// getBy:   element MUST exist (throws if absent)
// queryBy: element MIGHT not exist (returns null) -- assert ABSENCE
// findBy:  element appears ASYNC (returns Promise, waits up to 1s)
// Each has an "All" variant: getAllByRole, queryAllByText, findAllByRole

console.log("--- getBy vs queryBy vs findBy ---");
console.log("getBy: must exist | queryBy: might not | findBy: async appearance");
console.log("");


// ============================================================
// SECTION 3 — User Events
// ============================================================

// @testing-library/user-event simulates realistic event sequences.
// const user = userEvent.setup();
// await user.click(button)        -- full click sequence + focus
// await user.type(input, 'hello') -- one character at a time
// await user.clear(input)         -- select all + delete
// await user.tab()                -- moves focus (triggers blur)
// await user.keyboard('{Enter}')  -- presses Enter

// userEvent vs fireEvent:
//   fireEvent.click: ONLY click event, no focus
//   userEvent.click: FULL sequence (pointerdown -> mousedown -> click + focus)
//   PREFER userEvent for all new tests.

console.log("--- User Events ---");
console.log("PREFER userEvent over fireEvent for realistic testing.");
console.log("");


// ============================================================
// SECTION 4 — jest-dom Matchers
// ============================================================

// import '@testing-library/jest-dom';
// expect(el).toBeInTheDocument()     expect(el).toBeVisible()
// expect(btn).toBeDisabled()         expect(el).toHaveTextContent('text')
// expect(input).toHaveValue('val')   expect(el).toHaveClass('active')
// expect(link).toHaveAttribute('href', '/cart')
// expect(input).toBeRequired()       expect(checkbox).toBeChecked()

console.log("--- jest-dom Matchers ---");
console.log("toBeInTheDocument, toBeVisible, toBeDisabled, toHaveTextContent, toHaveValue");
console.log("");


// ============================================================
// SECTION 5 — Vanilla JS Components (Code Under Test)
// ============================================================

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <img src="${product.image}" alt="${product.name}" />
    <h3>${product.name}</h3>
    <p class="brand">${product.brand}</p>
    <p class="price">Rs. ${product.price.toLocaleString("en-IN")}</p>
    <span class="cart-count" aria-label="Cart count">0</span>
    <button aria-label="Add ${product.name} to bag">Add to Bag</button>
  `;
  let cartCount = 0;
  const button = card.querySelector("button");
  const countSpan = card.querySelector(".cart-count");

  button.addEventListener("click", () => {
    cartCount++;
    countSpan.textContent = String(cartCount);
    if (cartCount === 1) {
      button.textContent = "Go to Bag";
      button.setAttribute("aria-label", "Go to shopping bag");
      const toast = document.createElement("div");
      toast.setAttribute("role", "alert");
      toast.textContent = "Item added to bag!";
      card.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  });
  return card;
}

function createSizeSelector(sizes) {
  const container = document.createElement("div");
  container.setAttribute("role", "radiogroup");
  container.setAttribute("aria-label", "Select size");
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden"; hiddenInput.name = "selectedSize";
  container.appendChild(hiddenInput);

  sizes.forEach((size) => {
    const chip = document.createElement("button");
    chip.setAttribute("role", "radio"); chip.setAttribute("aria-checked", "false");
    chip.setAttribute("aria-label", `Size ${size}`); chip.textContent = size;
    chip.addEventListener("click", () => {
      container.querySelectorAll("[role=radio]").forEach((c) => {
        c.classList.remove("selected"); c.setAttribute("aria-checked", "false");
      });
      chip.classList.add("selected"); chip.setAttribute("aria-checked", "true");
      hiddenInput.value = size;
    });
    container.appendChild(chip);
  });
  return container;
}


// ============================================================
// SECTION 6 — Writing DOM Tests (Product Card)
// ============================================================

// describe('Product Card', () => {
//   let container;
//   const product = { id: 'MYN001', name: 'Roadster Slim Fit Jeans',
//                     brand: 'Roadster', price: 1299, image: '/jeans.jpg' };
//   beforeEach(() => { container = createProductCard(product); document.body.appendChild(container); });
//   afterEach(() => { document.body.innerHTML = ''; });
//
//   test('renders product details', () => {
//     expect(within(container).getByText('Roadster Slim Fit Jeans')).toBeInTheDocument();
//     expect(within(container).getByText(/Rs\. 1,299/)).toBeInTheDocument();
//   });
//
//   test('increments count and changes button on click', async () => {
//     const user = userEvent.setup();
//     await user.click(within(container).getByRole('button', { name: /add.*to bag/i }));
//     expect(within(container).getByLabelText('Cart count')).toHaveTextContent('1');
//     expect(within(container).getByRole('button')).toHaveTextContent('Go to Bag');
//   });
//
//   test('shows toast that disappears after 3s', async () => {
//     vi.useFakeTimers();
//     const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
//     await user.click(within(container).getByRole('button', { name: /add.*to bag/i }));
//     expect(within(container).getByRole('alert')).toHaveTextContent('Item added to bag!');
//     vi.advanceTimersByTime(3000);
//     expect(within(container).queryByRole('alert')).not.toBeInTheDocument();
//     vi.useRealTimers();
//   });
// });

console.log("--- Product Card Tests ---");
console.log("Pattern: create element, append, query, simulate, assert, clean up.");
console.log("");


// ============================================================
// SECTION 7 — Testing the Size Selector
// ============================================================

// describe('Size Selector', () => {
//   let container;
//   beforeEach(() => { container = createSizeSelector(['S','M','L','XL']); document.body.appendChild(container); });
//   afterEach(() => { document.body.innerHTML = ''; });
//
//   test('renders all sizes with none selected', () => {
//     const sizes = within(container).getAllByRole('radio');
//     expect(sizes).toHaveLength(4);
//     sizes.forEach(s => expect(s).toHaveAttribute('aria-checked', 'false'));
//   });
//
//   test('clicking selects size and deselects previous', async () => {
//     const user = userEvent.setup();
//     const medium = within(container).getByRole('radio', { name: 'Size M' });
//     const large = within(container).getByRole('radio', { name: 'Size L' });
//     await user.click(medium);
//     expect(medium).toHaveAttribute('aria-checked', 'true');
//     await user.click(large);
//     expect(medium).toHaveAttribute('aria-checked', 'false');
//     expect(large).toHaveAttribute('aria-checked', 'true');
//   });
// });

console.log("--- Size Selector Tests ---");
console.log("Verify BOTH visual state (class) and programmatic state (aria).");
console.log("");


// ============================================================
// SECTION 8 — Testing Forms and Async DOM Updates
// ============================================================

function createCheckoutForm() {
  const form = document.createElement("form");
  form.setAttribute("aria-label", "Checkout form");
  form.innerHTML = `
    <label for="ck-email">Email</label>
    <input id="ck-email" type="email" required placeholder="Enter your email" />
    <span class="error" role="alert" aria-live="polite"></span>
    <label for="ck-pin">Pincode</label>
    <input id="ck-pin" type="text" required placeholder="6-digit pincode" maxlength="6" />
    <span class="city-display"></span>
    <button type="submit">Place Order</button>
  `;
  const emailInput = form.querySelector("#ck-email");
  const emailError = form.querySelector(".error");
  const pincodeInput = form.querySelector("#ck-pin");
  const cityDisplay = form.querySelector(".city-display");
  const cities = { 560001: "Bangalore, Karnataka", 400001: "Mumbai, Maharashtra" };

  emailInput.addEventListener("blur", () => {
    emailError.textContent = (emailInput.value && !emailInput.value.includes("@"))
      ? "Please enter a valid email address" : "";
  });
  pincodeInput.addEventListener("input", () => {
    cityDisplay.textContent = pincodeInput.value.length === 6 && cities[pincodeInput.value] ? cities[pincodeInput.value] : "";
  });
  return form;
}

// test('shows error for invalid email on blur', async () => {
//   document.body.appendChild(createCheckoutForm());
//   const user = userEvent.setup();
//   await user.type(screen.getByLabelText('Email'), 'invalid-email');
//   await user.tab();
//   expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address');
// });

// --- Async DOM: findBy waits for elements to appear ---
function renderWishlist(container, fetchItems) {
  container.innerHTML = '<p role="status">Loading your wishlist...</p>';
  fetchItems()
    .then((items) => {
      if (items.length === 0) { container.innerHTML = "<p>Your wishlist is empty.</p>"; return; }
      container.innerHTML = `<h2>Wishlist (${items.length})</h2><ul role="list">${items.map(i => `<li>${i.name} -- Rs. ${i.price}</li>`).join("")}</ul>`;
    })
    .catch((err) => { container.innerHTML = `<p role="alert">Error: ${err.message}</p>`; });
}

// test('shows loading then items', async () => {
//   const container = document.createElement('div'); document.body.appendChild(container);
//   renderWishlist(container, () => Promise.resolve([{ name: 'Jeans', price: 1299 }]));
//   expect(await within(container).findByText('Wishlist (1)')).toBeInTheDocument();
// });

console.log("--- Form & Async DOM Testing ---");
console.log("findByText/findByRole -- wait for element to appear.");
console.log("");


// ============================================================
// KEY TAKEAWAYS
// ============================================================
// 1. DOM testing requires jsdom since Node.js has no DOM.
//
// 2. Query by ROLE first, then label, text, test-id (last resort).
//
// 3. getBy (must exist), queryBy (might not), findBy (async).
//
// 4. Use @testing-library/user-event over fireEvent.
//
// 5. jest-dom matchers: toBeInTheDocument, toBeVisible, toBeDisabled,
//    toHaveTextContent, toHaveValue, toHaveClass, toHaveAttribute.
//
// 6. Pattern: create -> append -> query -> simulate -> assert -> clean up.
//
// 7. Test BOTH visual (classes, text) and programmatic (aria, form values).
//
// 8. Use within(container) to scope queries. findBy for async DOM.
// ============================================================

console.log("=== File 07 Complete: Testing DOM Interactions ===");

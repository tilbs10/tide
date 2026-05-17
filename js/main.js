// Loads products from data/products.json and renders them on the page

async function loadProducts() {
  const res = await fetch('data/products.json');
  return res.json();
}

function productCardHTML(product) {
  return `
    <div class="product-card">
      <a href="product.html?id=${product.id}">
        <img src="${product.image}" alt="${product.name}" />
        <div class="card-body">
          <h3>${product.name}</h3>
          <p class="price">$${product.price.toFixed(2)}</p>
        </div>
      </a>
      <div class="card-body">
        <button class="btn" onclick='addToCart(${JSON.stringify(product)})'>Add to Cart</button>
      </div>
    </div>
  `;
}

// Homepage — featured products
const featuredGrid = document.getElementById('featured-products');
if (featuredGrid) {
  loadProducts().then(products => {
    const featured = products.filter(p => p.featured);
    featuredGrid.innerHTML = featured.map(productCardHTML).join('');
  });
}

// Shop page — all products
const allGrid = document.getElementById('all-products');
if (allGrid) {
  loadProducts().then(products => {
    allGrid.innerHTML = products.map(productCardHTML).join('');
  });
}

// Product detail page
const productName = document.getElementById('product-name');
if (productName) {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id'));
  loadProducts().then(products => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    document.title = `${product.name} — Tidepop`;
    document.getElementById('product-image').src = product.image;
    document.getElementById('product-image').alt = product.name;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('product-description').textContent = product.description;
    document.getElementById('add-to-cart').addEventListener('click', () => addToCart(product));
  });
}

// Cart page
const cartItems = document.getElementById('cart-items');
if (cartItems) {
  const cart = getCart();
  if (cart.length === 0) {
    cartItems.innerHTML = '<p>Your cart is empty. <a href="shop.html">Keep shopping</a></p>';
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span>${item.name}</span>
        <span>Qty: ${item.qty}</span>
        <span>$${(item.price * item.qty).toFixed(2)}</span>
        <button onclick="removeFromCart(${item.id}); location.reload();">Remove</button>
      </div>
    `).join('');
  }
  const totalEl = document.getElementById('cart-total');
  if (totalEl) totalEl.textContent = `$${getCartTotal().toFixed(2)}`;
}

// Checkout page — show order summary
const checkoutItems = document.getElementById('checkout-items');
if (checkoutItems) {
  const cart = getCart();
  checkoutItems.innerHTML = cart.map(item =>
    `<p>${item.name} x${item.qty} — $${(item.price * item.qty).toFixed(2)}</p>`
  ).join('');
  const totalEl = document.getElementById('checkout-total');
  if (totalEl) totalEl.textContent = `$${getCartTotal().toFixed(2)}`;
}

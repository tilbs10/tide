// Cart stored in localStorage so it persists between pages

function getCart() {
  return JSON.parse(localStorage.getItem('tidepop-cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('tidepop-cart', JSON.stringify(cart));
  updateCartCount();
}

function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  const el = document.getElementById('cart-count');
  if (el) el.textContent = count;
}

// Run on every page load
updateCartCount();

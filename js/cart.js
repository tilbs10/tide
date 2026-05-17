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
    existing.qty += (product.qty || 1);
  } else {
    cart.push({ ...product, qty: product.qty || 1 });
  }
  saveCart(cart);
  showToast(`${product.variation || product.name} added to cart`);
}

function removeFromCart(id) {
  saveCart(getCart().filter(item => item.id !== id));
}

function updateItemQty(id, qty) {
  if (qty < 1) return removeFromCart(id);
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (item) { item.qty = qty; saveCart(cart); }
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('#cart-count').forEach(el => el.textContent = count);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
    badge.classList.toggle('flex', count > 0);
  }
}

function showToast(message) {
  let toast = document.getElementById('tp-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tp-toast';
    toast.style.cssText = [
      'position:fixed','bottom:24px','left:50%',
      'transform:translateX(-50%) translateY(120px)',
      'background:#1a1a2e','color:#fff',
      'padding:14px 28px','border-radius:9999px',
      "font-family:'Hanken Grotesk',sans-serif",'font-size:14px','font-weight:600',
      'z-index:9999','transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      'white-space:nowrap','box-shadow:0 16px 40px rgba(0,0,0,0.25)',
      'display:flex','align-items:center','gap:10px','pointer-events:none'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span style="color:#00E0C6;font-size:16px;">✓</span> ${message}`;
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(120px)'; }, 3000);
}

updateCartCount();

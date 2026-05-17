/**
 * Tidepop Tracking Module
 * Handles session management, newsletter capture, cart tracking, and page views.
 * Include on every page: <script src="/js/tidepop-tracking.js"></script>
 *
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values.
 * These are safe to embed publicly — access is controlled by RLS policies.
 */

(function () {
  'use strict';

  // ── Config — replace with your Supabase project values ──────────────────
  const SUPABASE_URL     = 'https://cxuglnxsjafycmgnwpmm.supabase.co';       // e.g. https://xxxx.supabase.co
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4dWdsbnhzamFmeWNtZ253cG1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDY5MDEsImV4cCI6MjA5NDU4MjkwMX0.edDSBZp1pLuNYL4201NQtx6vfGlYq9KWhIK_rtNAhBQ'; // starts with eyJ...
  // ─────────────────────────────────────────────────────────────────────────

  const EDGE = `${SUPABASE_URL}/functions/v1`;

  // ── Session management ────────────────────────────────────────────────────

  function getSessionId() {
    let id = sessionStorage.getItem('tp_session');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('tp_session', id);
    }
    return id;
  }

  const SESSION_ID = getSessionId();

  // ── Edge function caller ─────────────────────────────────────────────────

  async function callEdge(fn, data) {
    try {
      const res = await fetch(`${EDGE}/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err) {
      console.warn(`[Tidepop] ${fn} call failed`, err);
      return null;
    }
  }

  // ── Get visitor IP (for consent logging) ─────────────────────────────────

  async function getConsentIp() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const { ip } = await res.json();
      return ip;
    } catch {
      return null;
    }
  }

  // ── Cart management ───────────────────────────────────────────────────────

  function getStoredCart() {
    try { return JSON.parse(localStorage.getItem('tp_cart') || '[]'); }
    catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem('tp_cart', JSON.stringify(cart));
    updateNavBadge();
  }

  function updateNavBadge() {
    const cart  = getStoredCart();
    const count = cart.reduce((sum, i) => sum + (i.quantity || 1), 0);
    // Support both badge styles used across site pages
    const badge = document.getElementById('cart-badge');
    const span  = document.getElementById('cart-count');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      badge.classList.toggle('flex', count > 0);
    }
    if (span) span.textContent = count;
  }

  // ── Abandon cart timer (30 min) ───────────────────────────────────────────

  let abandonTimer = null;

  function scheduleAbandon() {
    clearTimeout(abandonTimer);
    abandonTimer = setTimeout(async () => {
      const cart  = getStoredCart();
      const email = localStorage.getItem('tp_email');
      if (cart.length === 0) return;

      for (const item of cart) {
        await callEdge('track-cart', {
          session_id:   SESSION_ID,
          email:        email || null,
          product_slug: item.product_slug,
          colour:       item.colour,
          quantity:     item.quantity,
          event_type:   'abandon',
        });
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  function clearAbandon() {
    clearTimeout(abandonTimer);
    abandonTimer = null;
  }

  // ── Public cart API ───────────────────────────────────────────────────────

  window.TidepopCart = {
    add: async function (product_slug, colour, quantity) {
      // Update localStorage
      const cart     = getStoredCart();
      const existing = cart.find(i => i.product_slug === product_slug && i.colour === colour);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.push({ product_slug, colour, quantity });
      }
      saveCart(cart);

      // Track event
      await callEdge('track-cart', {
        session_id: SESSION_ID,
        email:      localStorage.getItem('tp_email') || null,
        product_slug,
        colour,
        quantity,
        event_type: 'add',
      });

      // Schedule abandon
      scheduleAbandon();
    },

    remove: async function (product_slug, colour) {
      const cart = getStoredCart().filter(
        i => !(i.product_slug === product_slug && i.colour === colour)
      );
      saveCart(cart);

      await callEdge('track-cart', {
        session_id:   SESSION_ID,
        email:        localStorage.getItem('tp_email') || null,
        product_slug,
        colour,
        quantity:     0,
        event_type:   'remove',
      });

      if (cart.length === 0) clearAbandon();
    },

    checkout: async function (email) {
      clearAbandon();
      if (email) localStorage.setItem('tp_email', email.toLowerCase().trim());

      await callEdge('track-cart', {
        session_id: SESSION_ID,
        email:      email || localStorage.getItem('tp_email'),
        event_type: 'checkout',
      });

      // Clear cart
      saveCart([]);
    },
  };

  // ── Page view tracking ────────────────────────────────────────────────────

  function detectProduct() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('hybrid')) return 'hybrid';
    if (path.includes('mask'))   return 'mask';
    if (path.includes('mini'))   return 'mini';
    // Check data attribute on body or ATC buttons
    const atc = document.querySelector('[data-product]');
    return atc ? atc.dataset.product : null;
  }

  callEdge('track-pageview', {
    session_id:     SESSION_ID,
    page:           window.location.pathname,
    product_viewed: detectProduct(),
    referrer:       document.referrer || null,
  });

  // ── Newsletter form ───────────────────────────────────────────────────────

  function wireNewsletterForm() {
    const form = document.querySelector('[data-form="newsletter"]');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const emailInput = form.querySelector('input[type="email"]');
      const email      = emailInput?.value?.trim();

      if (!email) return;

      // Show loading state
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn?.textContent;
      if (btn) btn.textContent = 'Sending...';

      // Get consent IP
      const consent_ip = await getConsentIp();

      // Collect optional fields
      const first_name      = form.querySelector('[name="first_name"]')?.value?.trim()     || null;
      const date_of_birth   = form.querySelector('[name="date_of_birth"]')?.value          || null;
      const goggle_interest = form.querySelector('[name="goggle_interest"]')?.value        || localStorage.getItem('tp_goggle_interest') || null;
      const child_age       = form.querySelector('[name="child_age"]')?.value              || null;

      const result = await callEdge('subscribe', {
        email,
        first_name,
        date_of_birth,
        goggle_interest,
        child_age: child_age ? parseInt(child_age) : null,
        source: 'newsletter_footer',
        consent_ip,
      });

      // Store email for later tracking
      if (result?.success) {
        localStorage.setItem('tp_email', email.toLowerCase());
        if (goggle_interest) localStorage.setItem('tp_goggle_interest', goggle_interest);
      }

      // Show inline feedback
      let msgEl = form.querySelector('.tp-msg');
      if (!msgEl) {
        msgEl = document.createElement('p');
        msgEl.className = 'tp-msg';
        msgEl.style.cssText = 'margin-top:12px;font-size:14px;font-weight:600;';
        form.appendChild(msgEl);
      }

      if (result?.success) {
        msgEl.style.color = '#006b5e';
        msgEl.textContent = "You're in — check your inbox for your 10% off code.";
        form.reset();
      } else {
        msgEl.style.color = '#ba1a1a';
        msgEl.textContent = result?.error || 'Something went wrong. Please try again.';
      }

      if (btn) btn.textContent = originalText;
    });
  }

  // ── Checkout form capture ─────────────────────────────────────────────────

  function wireCheckoutForm() {
    const form = document.querySelector('[data-form="checkout"]');
    if (!form) return;

    form.addEventListener('submit', async function () {
      const emailInput = form.querySelector('input[type="email"]');
      const nameInput  = form.querySelector('input[name="name"]');
      const email      = emailInput?.value?.trim();
      const first_name = nameInput?.value?.trim() || null;

      if (email) {
        localStorage.setItem('tp_email', email.toLowerCase());

        const consent_ip = await getConsentIp();

        // Subscribe with checkout source
        callEdge('subscribe', {
          email,
          first_name,
          source: 'checkout',
          consent_ip,
        });

        // Track checkout cart event
        TidepopCart.checkout(email);
      }
    });
  }

  // ── Add to Cart button wiring ─────────────────────────────────────────────
  // Product pages expose handleAddToCart() and selectedColour/qty from their
  // own scripts. This adds the TidepopCart.add call as an overlay.

  function wireAtcButtons() {
    document.querySelectorAll('[data-product]').forEach(btn => {
      const product_slug = btn.dataset.product;
      btn.addEventListener('click', function () {
        // Get selected colour and qty from page-level state if available
        const colour = (window.selectedColour?.name) || btn.dataset.colour || 'Default';
        const qty    = (window.qty) || 1;
        TidepopCart.add(product_slug, colour, qty);
      });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    updateNavBadge();
    wireNewsletterForm();
    wireCheckoutForm();
    wireAtcButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

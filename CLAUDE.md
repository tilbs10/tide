# CLAUDE.md — Tidepop Project

## The Product

Tidepop makes swimming goggles — vibrant, colourful, built for kids and families who love the water.
Three product lines: Hybrid Goggle ($34.99), Mask Goggle ($29.99), Mini Goggle ($17.99).
15 SKUs across colours. Sold online and through physical retail locations in Queensland, Australia.

---

## The Brand Owner

The founder is highly design-conscious. They care deeply about:

- **How a space feels**, not just how it looks
- **Subtle, considered details** — nothing loud or clumsy
- **The premium end of the spectrum**, even for a product aimed at families
- **Restraint** — less is more, whitespace is intentional, not empty

Think: a boutique surf shop that also sells specialty coffee. Bright product, calm environment.
The goggles are the colour. The site is the breath between them.

---

## Design Principles

### Feel first
Every page should feel like stepping into a well-designed space.
Clean, calm, unhurried. The product is the hero — the layout steps back.

### Colour used with purpose
Brand palette: lavender `#EAE6F8`, green `#3A9A5C`, coral `#F07860`.
Use colour as an accent, not wallpaper. White and near-white carry most of the page.

### Typography
- Clean, modern sans-serif (system font is fine for now)
- Generous line height and letter spacing
- Headings are calm, not shouty — sentence case preferred over ALL CAPS

### Spacing
Generous. Padding and margins should feel like breathing room, not waste.
When in doubt, add more space rather than less.

### Interactions
Subtle hover states. No sudden jumps or loud transitions.
A gentle fade or lift is right. Bouncing or sliding is not.

### Images
Product photos should have room to breathe — never crammed into a grid.
The `kids_wearing.jpeg` hero image sets the emotional tone of the brand.

---

## Tech Stack

- Plain HTML, CSS, JavaScript — no frameworks
- Products loaded from `data/products.json`
- Cart stored in browser localStorage (no backend)
- Square Web Payments SDK for checkout
- No database, no auth, no build tools

---

## File Structure

```
tidepop/
├── index.html          Homepage
├── shop.html           All products
├── product.html        Single product detail
├── cart.html           Shopping cart
├── checkout.html       Checkout (Square)
├── about.html          Brand story
├── contact.html        Contact
├── css/
│   ├── reset.css       Browser normalisation
│   └── style.css       All site styles
├── js/
│   ├── cart.js         Cart logic
│   └── main.js         Product rendering
├── images/
│   ├── brand/          Logo and brand assets
│   └── products/       Product and lifestyle photography
└── data/
    └── products.json   Product catalogue (source of truth)
```

---

## Scope Rules

- No new libraries without asking first
- No database — JSON file is enough
- No authentication
- Do not restructure working code without a clear reason
- One thing at a time, verified before moving on

---

## What Good Looks Like

Imagine the site sitting alongside brands like **Alo Yoga**, **Allbirds**, or **frank body** —
premium feel, clear product focus, calm and confident layout.
The colours make it playful. The design makes it trustworthy.

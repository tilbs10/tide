# Tidepop

Ecommerce website for Tidepop.

## Structure

```
tidepop/
├── index.html        Homepage
├── shop.html         All products
├── product.html      Single product detail
├── cart.html         Shopping cart
├── checkout.html     Checkout form
├── about.html        About page
├── contact.html      Contact page
├── css/
│   ├── reset.css     Browser normalisation
│   └── style.css     All site styles
├── js/
│   ├── cart.js       Cart logic (stored in browser)
│   └── main.js       Product loading and page rendering
├── images/
│   ├── products/     Product photos
│   └── brand/        Logo and brand assets
└── data/
    └── products.json Product catalogue
```

## Adding Products

Edit `data/products.json` to add, remove, or update products.
Each product needs: `id`, `name`, `price`, `description`, `image`, `featured` (true/false).

## Adding Images

- Product photos go in `images/products/`
- Logo and banners go in `images/brand/`

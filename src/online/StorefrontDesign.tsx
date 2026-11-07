"use client";
import React, { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Grid2X2, Headphones, Laptop, MapPin, Menu, Package, Search, ShoppingBag, Smartphone, Tablet, UserRound, Watch, X } from "lucide-react";
import { money, type Catalogue } from "./api";
import { type ShopProduct, variantLabel } from "./catalogue";
import { type ShopView } from "./customer";
import { Modal } from "./ui";

type Navigation = { href: (view: ShopView, product?: string) => string; onNavigate: (view: ShopView, product?: string) => void };
type Browse = (category?: string, query?: string, sort?: string, stock?: boolean) => void;
export const referenceProducts = [
  { name: "HONOR Magic V5", category: "Phones", image: "https://www-file.honor.com/content/dam/honor/common/product-list/product-series/honor-magic-v5/honor-magic-v5-id-gold.png", source: "https://www.honor.com/uk/phones/honor-magic-v5/" },
  { name: "HONOR 400 Pro", category: "Phones", image: "https://www-file.honor.com/content/dam/honor/common/product-list/product-series/honor-400-pro/honor-400-pro-id-black-front.png", source: "https://www.honor.com/uk/phones/honor-400-pro/" },
  { name: "HONOR MagicBook 16 2026", category: "Laptops", image: "https://www-file.honor.com/content/dam/honor/common/product-list/laptops/product-series/honor-magicbook-16-2026/global/honor-magicbook-16-2026.png", source: "https://www.honor.com/uk/laptops/" },
  { name: "HONOR Pad 10", category: "Tablets", image: "https://www-file.honor.com/content/dam/honor/common/product-list/tablets/product-series/honor-pad-10/honor-pad-10.png", source: "https://www.honor.com/uk/tablets/honor-pad-10/" },
];

export function ProductImage({ src, name, eager = false, className = "" }: { src?: string; name: string; eager?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={name} className={className} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="store-photo-unavailable"><Package size={32} aria-hidden="true" /><span>Photo unavailable</span></span>;
}

function categoryIcon(category: string) {
  if (/phone/i.test(category)) return Smartphone;
  if (/laptop|computer/i.test(category)) return Laptop;
  if (/tablet|pad/i.test(category)) return Tablet;
  if (/wear|watch/i.test(category)) return Watch;
  if (/audio|ear|headphone/i.test(category)) return Headphones;
  return Grid2X2;
}

export function StoreHeader({ products, view, category, query, count, signedIn, href, onNavigate, onBrowse, onQuery }: Navigation & {
  products: ShopProduct[]; view: ShopView; category: string; query: string; count: number; signedIn: boolean; onBrowse: Browse; onQuery: (value: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const categories = [...new Set(products.map(p => p.category))].sort();
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); }, [view, category]);
  function link(event: React.MouseEvent, target: ShopView) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); setMenuOpen(false); setSearchOpen(false); onNavigate(target);
  }
  return <header className="store-header">
    <div className="store-utility"><div className="store-shell"><span>HONOR Nigeria</span><nav aria-label="Store information"><a href={href("locations")} onClick={e => link(e, "locations")}>Collection locations</a><a href={href("account")} onClick={e => link(e, "account")}>My orders</a>{!signedIn && <a href={href("login")} onClick={e => link(e, "login")}>Sign in / Register</a>}</nav></div></div>
    <div className="store-shell store-nav-row">
      <a href={href("shop")} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onBrowse("All", "", "featured", false); } }} aria-label="Honor shop" className="store-logo"><img src="https://www-file.honor.com/content/dam/honor/common/logo/honor-logo-black.svg" alt="HONOR" width="119" height="30" /></a>
      <nav aria-label="Product navigation" className="store-desktop-nav">
        <a href={href("shop")} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onBrowse("All", "", "featured", false); } }} aria-current={view === "shop" && category === "All" ? "page" : undefined}>All products</a>
        {categories.slice(0, 5).map(c => <a key={c} href={`?category=${encodeURIComponent(c)}#catalogue`} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onBrowse(c, ""); } }} aria-current={view === "shop" && category === c ? "page" : undefined}>{c}</a>)}
        {!categories.length && <a href={href("locations")} onClick={e => link(e, "locations")}>Collection</a>}
      </nav>
      <div className="store-header-actions">
        {products.length > 0 && <button aria-label={searchOpen ? "Close product search" : "Open product search"} aria-expanded={searchOpen} aria-controls="store-search" onClick={() => setSearchOpen(!searchOpen)}><Search size={21} /></button>}
        <a href={href(signedIn ? "account" : "login")} onClick={e => link(e, signedIn ? "account" : "login")} aria-label={signedIn ? "Your account" : "Customer sign in"}><UserRound size={21} /></a>
        <a href={href("cart")} onClick={e => link(e, "cart")} aria-label={`View cart, ${count} ${count === 1 ? "item" : "items"}`} className="store-bag"><ShoppingBag size={21} /><span>{count}</span></a>
        <button className="store-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="store-mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </div>
    {searchOpen && <form id="store-search" role="search" className="store-shell store-search" onSubmit={e => { e.preventDefault(); onBrowse(category, query); setSearchOpen(false); }}><label htmlFor="store-search-query">Search products</label><div><input id="store-search-query" autoFocus value={query} onChange={e => onQuery(e.target.value)} placeholder="Search by device, colour or memory" type="search" /><button className="honor-button" type="submit">Search <Search size={16} /></button></div></form>}
    {menuOpen && <nav id="store-mobile-menu" aria-label="Mobile store navigation" className="store-mobile-menu"><button onClick={() => { onBrowse("All", "", "featured", false); setMenuOpen(false); }}>All products</button>{categories.map(c => <button key={c} onClick={() => { onBrowse(c, ""); setMenuOpen(false); }}>{c}</button>)}<a href={href("locations")} onClick={e => link(e, "locations")}>Collection locations</a><a href={href("account")} onClick={e => link(e, "account")}>Your orders</a>{!signedIn && <a href={href("signup")} onClick={e => link(e, "signup")}>Create account</a>}</nav>}
  </header>;
}

export function StoreHero({ products, currency, heading, introduction, href, onNavigate }: Navigation & { products: ShopProduct[]; currency: string; heading?: string; introduction?: string }) {
  const [index, setIndex] = useState(0);
  const available = products.filter(p => p.available > 0);
  const slides = available.filter((p, i) => available.findIndex(x => (x.model_name || x.id) === (p.model_name || p.id)) === i).slice(0, 5);
  const current = slides[index % Math.max(slides.length, 1)];
  const preview = referenceProducts[0];
  return <section className={`store-hero ${!current ? "store-hero-preview" : ""}`} aria-label={current ? "Featured products" : "Explore HONOR devices"} aria-roledescription={slides.length > 1 ? "carousel" : undefined}>
    <div className="store-shell store-hero-inner"><div className="store-hero-copy"><p className="store-kicker">{current ? "Discover HONOR" : "Explore HONOR"}</p><h1>{current?.model_name || current?.name || heading || "Discover your next HONOR"}</h1><p className="store-hero-description">{current ? current.description || introduction || "" : introduction || "Made for the way you work, create and connect."}</p>{current ? <><p className="store-hero-price">{money(current.price_minor, currency)}</p><a className="honor-button" href={href("product", current.id)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate("product", current.id); } }}>View product <ArrowRight size={17} /></a></> : <><p className="store-preview-note">Local prices and availability will appear as products are added.</p><a className="honor-button" href="#reference-products">Explore devices <ArrowRight size={17} /></a></>}</div><div className="store-hero-image"><ProductImage src={current?.image_url || (!current ? preview.image : undefined)} name={current?.name || preview.name} eager /></div></div>
    {slides.length > 1 && <div className="store-carousel-controls"><button aria-label="Previous featured product" onClick={() => setIndex((index + slides.length - 1) % slides.length)}><ChevronLeft size={18} /></button><div aria-label="Choose featured product">{slides.map((p, i) => <button key={p.id} className="store-carousel-dot" aria-label={`Show ${p.name}`} aria-pressed={i === index % slides.length} onClick={() => setIndex(i)} />)}</div><button aria-label="Next featured product" onClick={() => setIndex((index + 1) % slides.length)}><ChevronRight size={18} /></button></div>}
  </section>;
}

export function CategoryShortcuts({ products, onBrowse, onLocations }: { products: ShopProduct[]; onBrowse: Browse; onLocations: () => void }) {
  const categories = [...new Set(products.map(p => p.category))].sort();
  return <nav className="store-shortcuts" aria-label="Shop shortcuts">{categories.map(category => { const Icon = categoryIcon(category); const picture = products.find(p => p.category === category && p.image_url); return <button key={category} onClick={() => onBrowse(category, "")}><span className="store-shortcut-image">{picture ? <ProductImage src={picture.image_url} name="" /> : <Icon size={32} aria-hidden="true" />}</span><span>{category}</span></button>; })}<button onClick={onLocations}><span className="store-shortcut-image"><MapPin size={30} aria-hidden="true" /></span><span>Collection locations</span></button></nav>;
}

export function StoreProductCard({ product: p, currency, trending, popular, href, onNavigate }: Navigation & { product: ShopProduct; currency: string; trending?: boolean; popular?: boolean }) {
  return <article className="store-product-card"><div className="store-product-copy"><p className="store-kicker">{p.category}</p><h3><a href={href("product", p.id)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate("product", p.id); } }}>{p.name}</a></h3>{(p.colour || p.memory || p.market) && <p className="store-variant">{variantLabel(p)}</p>}<p className="store-card-description">{p.description}</p><div className="store-product-flags">{p.available > 0 ? <span className="store-availability">Available for collection</span> : <span>Out of stock</span>}{p.available > 0 && trending && <span className="store-sale-badge">Selling fast</span>}{p.available > 0 && !trending && popular && <span className="store-sale-badge">Popular this week</span>}</div></div><a className="store-card-image" href={href("product", p.id)} aria-label={`View ${p.name}`} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate("product", p.id); } }}><ProductImage src={p.image_url} name={p.name} /></a><div className="store-card-bottom"><strong>{money(p.price_minor, currency)}</strong><a className="honor-button" href={href("product", p.id)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate("product", p.id); } }}>View product <ArrowRight size={15} /></a></div></article>;
}

export function ReferenceCollection() {
  const [selected, setSelected] = useState<(typeof referenceProducts)[number] | null>(null);
  return <section id="reference-products" className="store-reference-collection" aria-labelledby="reference-title"><div className="store-section-heading"><div><p className="store-kicker">Explore devices</p><h2 id="reference-title">Explore the HONOR range</h2></div></div><p className="store-reference-explainer">Explore HONOR devices. Local prices and availability will appear as products are added.</p><div className="store-product-grid">{referenceProducts.map(p => <article key={p.name} className="store-reference-card"><div><p className="store-kicker">{p.category}</p><h3>{p.name}</h3><p>Price and availability coming soon</p><button className="online-secondary" onClick={() => setSelected(p)}>View device <ArrowRight size={15} /></button></div><ProductImage src={p.image} name={p.name} /></article>)}</div>{selected && <Modal title={selected.name} onClose={() => setSelected(null)}><div className="store-reference-dialog"><ProductImage src={selected.image} name={selected.name} /><p>The store will publish local prices, available variants and collection stock before this device can be purchased here.</p><a className="honor-text-button" href={selected.source} target="_blank" rel="noopener noreferrer">Official HONOR product information (UK) <ArrowRight size={16} /></a></div></Modal>}</section>;
}

export function CollectionBanner({ href, onNavigate }: Navigation) {
  return <section className="store-collection-banner"><MapPin size={29} aria-hidden="true" /><div><h2>Find your collection location</h2><p>Check collection details before reserving your device.</p></div><a href={href("locations")} className="online-secondary" onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate("locations"); } }}>View locations <ArrowRight size={16} /></a></section>;
}

export function StoreFooter({ companyName, staffUrl, href, onNavigate }: Navigation & { companyName?: string; staffUrl: string }) {
  return <footer className="store-footer"><div className="store-shell"><div className="store-footer-top"><div><strong className="store-wordmark">HONOR</strong><p>{companyName && !["honor", "honor nigeria"].includes(companyName.trim().toLowerCase()) ? companyName : "Nigeria"}</p></div><nav aria-label="Footer navigation">{([["shop", "Products"], ["locations", "Collection locations"], ["account", "Your orders"]] as const).map(([view, text]) => <a key={view} href={href(view)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate(view); } }}>{text}</a>)}<a href={staffUrl}>Staff sign-in</a></nav></div><p className="store-footer-bottom">Prices and availability are confirmed when your order is reserved.</p></div></footer>;
}

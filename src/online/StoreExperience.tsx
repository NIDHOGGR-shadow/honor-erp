"use client";
import React from "react";
import { ArrowRight, Heart, MessageCircle, PackageCheck, MapPin, SlidersHorizontal, X } from "lucide-react";
import { money } from "./api";
import { productVariants, type ShopProduct } from "./catalogue";
import type { ShopView } from "./customer";
import { ProductImage, referenceProducts } from "./StorefrontDesign";
import { categoryHref, storeCategories } from "./storefrontPaths";

type Navigate = (view: ShopView, product?: string) => void;
type Navigation = { navigate: Navigate; href: (view: ShopView, product?: string) => string };
type ShoppingState = { ids: string[]; toggle: (id: string) => void; products: ShopProduct[]; currency: string };
export function StoreBrandIntro({ browse }: { browse: (category?: string, query?: string) => void }) {
  return <section className="store-hero" aria-label="Discover HONOR"><div className="store-shell store-hero-inner"><div className="store-hero-copy"><p className="store-hero-brandline">HONOR <span>GO BEYOND</span></p><h1>A world of possibility.</h1><p className="store-hero-story">Made for your next chapter.</p><p className="store-hero-description">Explore HONOR phones, laptops and more. Check the catalogue for published local availability.</p><a className="honor-button" href="#catalogue" onClick={event => { event.preventDefault(); browse("All", ""); }}>Explore the collection <ArrowRight size={17} /></a></div><div className="store-hero-image"><ProductImage src={referenceProducts[0].image} name="HONOR Magic V5 — brand imagery" eager /></div></div></section>;
}
const Shopping = React.createContext<ShoppingState>({ ids: [], toggle: () => {}, products: [], currency: "NGN" });
export function parseFavourites(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200))].slice(0, 100) : [];
  } catch { return []; }
}
export function ShoppingProvider({ products, currency, slug, children }: { products: ShopProduct[]; currency: string; slug: string; children: React.ReactNode }) {
  const key = `honor:favourites:${slug}:v1`;
  const [ids, setIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    const read = () => { try { setIds(parseFavourites(localStorage.getItem(key))); } catch { setIds([]); } };
    read();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  function toggle(id: string) {
    const next = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id].slice(-100);
    setIds(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Saving still works for this visit. */ }
  }
  return <Shopping.Provider value={{ ids, toggle, products, currency }}>{children}</Shopping.Provider>;
}
function Favourite({ product }: { product: ShopProduct }) {
  const { ids, toggle } = React.useContext(Shopping);
  return <button className="experience-heart" aria-label={`${ids.includes(product.id) ? "Remove" : "Save"} ${product.name} ${product.memory || ""}`.trim()} aria-pressed={ids.includes(product.id)} onClick={() => toggle(product.id)}><Heart size={21} fill={ids.includes(product.id) ? "currentColor" : "none"} /></button>;
}
export function ExperienceCard({ product, navigate, href }: { product: ShopProduct } & Navigation) {
  const { products, currency } = React.useContext(Shopping);
  const [selectedId, setSelectedId] = React.useState(product.id);
  const variants = productVariants(products, product);
  const selected = variants.find(p => p.id === selectedId) || product;
  return <article className="experience-card">
    <Favourite product={selected} />
    <a href={href("product", selected.id)} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); navigate("product", selected.id); }}>
      <ProductImage src={selected.image_url} name={selected.name} />
      <span className="experience-category">{selected.category}</span><h3>{selected.name}</h3>
    </a>
    <p className="experience-description">{selected.description}</p>
    {selected.colour && <p className="experience-colour">{selected.colour}</p>}
    {variants.length > 1 && <div className="experience-options" aria-label={`${product.name} configuration`}>{variants.map(v => <button key={v.id} aria-pressed={selected.id === v.id} onClick={() => setSelectedId(v.id)}>{[v.colour, v.memory].filter(Boolean).join(" · ") || v.sku}</button>)}</div>}
    <div className="experience-card-bottom"><strong>{selected.price_minor > 0 ? money(selected.price_minor, currency) : "Price on request"}</strong><small>{selected.available > 0 ? "Available for collection" : "Currently unavailable"}</small><button className="honor-button" onClick={() => navigate("product", selected.id)}>Explore device <ArrowRight size={15} /></button></div>
  </article>;
}
export function ExperienceVariants({ product, navigate }: { product: ShopProduct; navigate: Navigate }) {
  const { products } = React.useContext(Shopping);
  return <div className="experience-variant-detail"><Favourite product={product} /><p>Colour and memory</p><div className="experience-options">{productVariants(products, product).map(v => <button key={v.id} value={v.id} aria-pressed={product.id === v.id} onClick={() => navigate("product", v.id)}>{[v.colour, v.memory].filter(Boolean).join(" · ") || "Standard configuration"}{v.available <= 0 ? " · Out of stock" : ""}</button>)}</div></div>;
}
function Sheet({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="experience-dialog" onCancel={close} aria-labelledby={titleId}><header><h2 id={titleId}>{title}</h2><button aria-label="Close panel" onClick={close}><X /></button></header>{children}</dialog>;
}
export function ExperienceTools({ navigate, href }: Navigation) {
  const { ids, toggle, products } = React.useContext(Shopping);
  const [open, setOpen] = React.useState(false);
  return <><button aria-label={`Saved products, ${ids.length}`} onClick={() => setOpen(true)}><Heart size={21} /><span>{ids.length || ""}</span></button>{open && <Sheet title="Your favourites" close={() => setOpen(false)}><p>Keep the devices you love together. Saved on this browser.</p>{!ids.length && <div className="experience-empty"><Heart size={48} /><h3>A little inspiration, saved.</h3><p>Tap a heart on any device to find it here later.</p><button className="honor-button" onClick={() => setOpen(false)}>Explore the collection</button></div>}{ids.map(id => {
    const p = products.find(p => p.id === id);
    return <article className="experience-saved" key={id}>{p && <ProductImage src={p.image_url} name={p.name} />}<div>{p ? <><a href={href("product", id)} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); setOpen(false); navigate("product", id); }}>{p.name}</a><p>{[p.colour, p.memory].filter(Boolean).join(" · ")}</p></> : <p>This saved device is not currently in the catalogue.</p>}<button onClick={() => toggle(id)}>Remove</button></div></article>;
  })}</Sheet>}</>;
}
export function ExperienceReasons() {
  return <section className="experience-reasons"><p className="store-kicker">A little more confidence</p><h2>Find the right HONOR for you.</h2><div>{[{ Icon: SlidersHorizontal, title: "The details that matter", copy: "Explore product details and choose a configuration that fits your day." }, { Icon: PackageCheck, title: "A connected collection", copy: "Discover phones, laptops, tablets, wearables and audio in one place." }, { Icon: MapPin, title: "Plan your collection", copy: "Check the store’s published locations and availability before placing your order." }].map(({ Icon, title, copy }) => <article key={title}><Icon size={29} /><h3>{title}</h3><p>{copy}</p></article>)}</div></section>;
}
export function ExperienceFooter({ navigate, href, browse, currency }: Navigation & { browse: (category?: string, query?: string) => void; currency: string }) {
  const [panel, setPanel] = React.useState("");
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => { const media = window.matchMedia("(max-width: 700px)"); const change = () => setCompact(media.matches); change(); media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  const pathname = href("shop").split("?")[0];
  function action(event: React.MouseEvent, view: ShopView) { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); navigate(view); }
  return <><footer className="experience-footer"><div className="store-shell"><section className="experience-newsletter"><div><p className="store-kicker">Go beyond the everyday</p><h2>A little more possibility.<br />A little more HONOR.</h2><p>Find the device that fits the way you work, create and connect.</p></div><div className="experience-footer-discover"><a href={href("shop")} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); browse("All", ""); }}>Explore the collection <ArrowRight size={18} /></a><a href={href("account")} onClick={event => action(event, "account")}>Your HONOR account <ArrowRight size={18} /></a></div></section><div className="experience-footer-links"><details open={!compact}><summary>Explore HONOR</summary><nav aria-label="Explore HONOR">{storeCategories.map(category => <a key={category} href={categoryHref(pathname, category)} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); browse(category, ""); }}>{category}</a>)}</nav></details><details open={!compact}><summary>Your HONOR</summary><nav aria-label="Your HONOR">{([["account", "Your account"], ["cart", "Your cart"], ["locations", "Collection locations"]] as const).map(([view, label]) => <a key={view} href={href(view)} onClick={event => action(event, view)}>{label}</a>)}</nav></details><details open={!compact}><summary>Help & information</summary><nav aria-label="Help & information"><a href="#shopping-help" onClick={event => { event.preventDefault(); setPanel("Shopping help"); }}>Product advice</a><a href="#browser-storage" onClick={event => { event.preventDefault(); setPanel("Browser storage"); }}>Browser storage</a><a href="https://www.honor.com/ng/support/" target="_blank" rel="noopener noreferrer">Official HONOR support ↗</a></nav></details></div><div className="experience-footer-end"><strong>HONOR <span>GO BEYOND</span></strong><p>Nigeria / {currency}</p><a href="#shop-content">Back to top ↑</a></div></div></footer><button className="experience-help-button" aria-label="Shopping help" onClick={() => setPanel("Shopping help")}><MessageCircle size={23} /><span>Need a hand?</span></button>{panel && <Sheet title={panel} close={() => setPanel("")}>{panel === "Browser storage" ? <><p>Favourites and recent searches are saved on this browser. Cart and sign-in state support your shopping session.</p><p>Use the search panel’s Clear recent searches control to remove search history. Remove individual favourites from the heart menu.</p></> : <><p>A little guidance for your next HONOR.</p>{[["Choosing a device", "Explore product details, colour and memory choices. Save favourites to revisit your shortlist."], ["Prices and availability", "The store’s current catalogue supplies prices and availability. Your final order is confirmed by the shop’s checkout service."], ["Collection and support", "Check the store’s collection locations before ordering. For manufacturer support, visit the official HONOR Nigeria support website."]].map(([q, a]) => <details className="experience-faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}<a href={href("locations")} onClick={event => { action(event, "locations"); if (!event.metaKey && !event.ctrlKey) setPanel(""); }}>View collection locations</a><small className="experience-help-note">Self-service guidance. For order-specific questions, use the contact details published by the store.</small></>}</Sheet>}</>;
}

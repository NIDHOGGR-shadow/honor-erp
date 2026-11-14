import React from "react";
import { ArrowRight } from "lucide-react";
import { ProductImage } from "./StorefrontDesign";
import type { ShopProduct } from "./catalogue";
import type { ShopView } from "./customer";

export function StoreStories({ products, onNavigate }: {
  products: ShopProduct[];
  onNavigate: (view: ShopView, product?: string) => void;
}) {
  const stories = [
    { category: "Laptops", title: "Room for your next big idea.", label: "Explore laptops", tone: "silver" },
    { category: "Tablets", title: "A little more possibility.", label: "Explore tablets", tone: "blue" },
  ];
  return <section className="store-stories" aria-label="Discover more from HONOR">
    {stories.map(story => {
      const product = products.find(p => p.category === story.category && p.available > 0 && p.image_url);
      if (!product) return null;
      return <article key={story.category} className={`store-story store-story-${story.tone}`}>
        <div><p>{product.name}</p><h2>{story.title}</h2><a href={`?view=product&product=${encodeURIComponent(product.id)}`} onClick={event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault(); onNavigate("product", product.id);
        }}>{story.label} <ArrowRight size={17} /></a></div>
        <ProductImage src={product.image_url} name={product.name} />
      </article>;
    })}
  </section>;
}

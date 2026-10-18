/* Load artwork only when a homepage card approaches the viewport.
   All assets are local and already optimized as small WebP/JPEG files. */
(() => {
  const cards = [...document.querySelectorAll(".product-card[data-artwork]")];
  const paint = (card) => {
    const asset = card.dataset.artwork || "";
    if (!/^assets\/[a-z0-9-]+\.(?:webp|jpe?g|png)$/i.test(asset)) return;
    card.style.backgroundImage = `url("${asset}")`;
  };
  if (!("IntersectionObserver" in window)) {
    cards.forEach(paint);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      paint(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "450px 0px" });
  cards.forEach((card) => observer.observe(card));
})();

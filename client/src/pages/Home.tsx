import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowRight, Check, ChevronLeft, Flame, Minus, Package, Plus, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const LOGO_URL = "/manus-storage/async-images/TOmmWrqrjzFOxfte8Ok2d3/image-1.webp";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

type Cart = Record<number, number>;
type Customer = { customerName: string; email: string; phone: string; address1: string; address2: string; city: string; state: string; postalCode: string; notes: string };
const emptyCustomer: Customer = { customerName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", postalCode: "", notes: "" };

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark--compact" : ""}`} aria-hidden="true">
      <span className="brand-mark__gear" />
      <span className="brand-mark__star">✦</span>
    </span>
  );
}

export default function Home() {
  const utils = trpc.useUtils();
  const catalog = trpc.catalog.snapshot.useQuery(undefined, { staleTime: 20_000 });
  const submitOrder = trpc.orders.submit.useMutation({
    onSuccess: result => {
      setConfirmation(result);
      setCart({});
      setStep("confirmed");
      void utils.catalog.snapshot.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [cart, setCart] = useState<Cart>({});
  const [step, setStep] = useState<"catalog" | "details" | "confirmed">("catalog");
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [confirmation, setConfirmation] = useState<{ orderNumber: string; totalCents: number } | null>(null);
  const products = catalog.data?.products ?? [];
  const shippingCents = catalog.data?.settings?.shippingCents ?? 2000;
  const items = useMemo(() => products.flatMap(product => {
    const quantity = cart[product.id] ?? 0;
    const unitPriceCents = product.salePriceCents ?? product.priceCents;
    return quantity ? [{ product, quantity, unitPriceCents, lineTotalCents: quantity * unitPriceCents }] : [];
  }), [cart, products]);
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const totalCents = subtotalCents + (items.length ? shippingCents : 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const setQuantity = (id: number, next: number) => {
    setCart(previous => {
      const copy = { ...previous };
      if (next <= 0) delete copy[id]; else copy[id] = Math.min(25, next);
      return copy;
    });
  };

  const openDetails = () => {
    if (!items.length) return toast.error("Add at least one available item to your request.");
    setStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitDetails = (event: FormEvent) => {
    event.preventDefault();
    submitOrder.mutate({
      customer,
      items: items.map(item => ({ productId: item.product.id, quantity: item.quantity })),
    });
  };

  if (step === "confirmed" && confirmation) {
    return <main className="confirmation-page"><section className="confirmation-card"><div className="confirmation-icon"><Check /></div><p className="eyebrow">Request recorded</p><h1>We have your gear list.</h1><p>Your request <strong>{confirmation.orderNumber}</strong> is ready for the Stellar Gear team to review. Nothing has been charged.</p><div className="confirmation-total"><span>Request total</span><strong>{money(confirmation.totalCents)}</strong></div><button className="button button--red" onClick={() => { setCustomer(emptyCustomer); setConfirmation(null); setStep("catalog"); }}>Start a new request <ArrowRight size={16} /></button></section></main>;
  }

  return (
    <div className="app-shell">
      <header className="site-header"><Link href="/" className="brand"><span className="brand-icon-wrap"><img src={LOGO_URL} alt="" className="generated-icon" onError={event => { event.currentTarget.style.display = "none"; }} /><Mark compact /></span><span><b>STELLAR</b><em>GEAR</em></span></Link><nav><a href="#catalog">Catalog</a><a href="#how-it-works">How it works</a><Link href="/admin" className="nav-admin">Admin <ArrowRight size={14} /></Link></nav></header>
      <main>
        <section className="hero"><div className="hero-copy"><div className="hero-kicker"><span /> PERFORMANCE ORDER DESK</div><h1>Built for the<br /><i>next set.</i></h1><p>Browse the current gear collection, build your request, and send delivery details in one clean flow.</p><div className="hero-actions"><a href="#catalog" className="button button--red">Browse gear <ArrowRight size={17} /></a><span className="hero-note"><ShieldCheck size={16} /> No payment collected</span></div></div><div className="hero-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-product"><span className="hero-product__label">SG // CORE SERIES</span><Mark /><strong>TRAIN<br />WITH<br /><i>INTENT</i></strong><span className="hero-product__footer">EST. 2026&nbsp;&nbsp;•&nbsp;&nbsp;STELLAR GEAR</span></div><div className="hero-stat"><span>Live order</span><strong>{itemCount.toString().padStart(2, "0")}</strong><small>items selected</small></div></div></section>
        <section className="confidence-strip"><span><Sparkles size={17} /> Curated performance essentials</span><span><Package size={17} /> Simple request flow</span><span><Flame size={17} /> Flat shipping, set by admin</span></section>
        <section className="catalog-section" id="catalog"><div className="section-heading"><div><p className="eyebrow">01 / THE CATALOG</p><h2>Choose your<br />everyday <i>uniform.</i></h2></div><p>Each item is managed in real time. In-stock gear is ready to add; unavailable pieces stay visible but cannot be selected.</p></div>
          {catalog.isLoading ? <div className="loading-grid">Loading current collection…</div> : <div className="catalog-layout"><div className="product-grid">{products.map((product, index) => { const activePrice = product.salePriceCents ?? product.priceCents; const quantity = cart[product.id] ?? 0; return <article key={product.id} className={`product-card ${!product.inStock ? "product-card--out" : ""}`}><div className="product-art"><span>SG<br />{String(index + 1).padStart(2, "0")}</span><div className={`product-art__shape shape-${index % 4}`} /><span className="product-category">{product.category}</span>{product.badge && <span className="product-badge">{product.badge}</span>}</div><div className="product-body"><div><h3>{product.name}</h3><p>{product.description}</p></div><div className="product-bottom"><div className="price">{product.salePriceCents && <s>{money(product.priceCents)}</s>}<strong>{money(activePrice)}</strong></div>{product.inStock ? quantity ? <div className="quantity"><button aria-label={`Remove ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={15} /></button><span>{quantity}</span><button aria-label={`Add ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={15} /></button></div> : <button className="add-button" onClick={() => setQuantity(product.id, 1)}>Add <Plus size={15} /></button> : <span className="out-of-stock">Unavailable</span>}</div></div></article>})}</div><aside className="order-panel"><div className="order-panel__top"><div><p className="eyebrow">YOUR REQUEST</p><h3>{itemCount ? `${itemCount} ${itemCount === 1 ? "item" : "items"}` : "No items yet"}</h3></div><ShoppingBag size={19} /></div><div className="order-items">{items.length ? items.map(item => <div className="order-item" key={item.product.id}><div><strong>{item.product.name}</strong><span>{item.quantity} × {money(item.unitPriceCents)}</span></div><b>{money(item.lineTotalCents)}</b></div>) : <p className="order-empty">Add gear from the catalog to build your order request.</p>}</div><div className="order-totals"><div><span>Subtotal</span><b>{money(subtotalCents)}</b></div><div><span>Shipping</span><b>{items.length ? money(shippingCents) : "—"}</b></div><div className="grand-total"><span>Total</span><strong>{money(totalCents)}</strong></div></div><button className="button button--red button--full" onClick={openDetails}>Continue <ArrowRight size={17} /></button><p className="panel-note">Total is an order estimate. The team will review each request before follow-up.</p></aside></div>}</section>
        <section id="how-it-works" className="steps"><div className="steps-intro"><p className="eyebrow">02 / SIMPLE BY DESIGN</p><h2>Three steps.<br /><i>Zero friction.</i></h2></div>{[["01", "Pick your pieces", "Select quantities from the live catalog."], ["02", "Review the total", "Shipping and line totals update instantly."], ["03", "Send request", "Share delivery details. No payment is collected."]].map(([number, title, copy]) => <div className="step" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</section>
      </main>
      {step === "details" && <div className="checkout-overlay"><section className="checkout-card"><button className="back-button" onClick={() => setStep("catalog")}><ChevronLeft size={17} /> Back to catalog</button><div className="checkout-head"><p className="eyebrow">03 / DELIVERY DETAILS</p><h2>Where should we<br />send the <i>request?</i></h2><p>We’ll record your details and send the full request to the admin dashboard. No payment is requested here.</p></div><form onSubmit={submitDetails}><div className="form-grid"><label>Full name<input required value={customer.customerName} onChange={e => setCustomer({ ...customer, customerName: e.target.value })} /></label><label>Email<input required type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></label><label>Phone<input required value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} /></label><label>Address<input required value={customer.address1} onChange={e => setCustomer({ ...customer, address1: e.target.value })} /></label><label>Apartment, suite, etc.<input value={customer.address2} onChange={e => setCustomer({ ...customer, address2: e.target.value })} /></label><label>City<input required value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })} /></label><label>State / region<input required value={customer.state} onChange={e => setCustomer({ ...customer, state: e.target.value })} /></label><label>Postal code<input required value={customer.postalCode} onChange={e => setCustomer({ ...customer, postalCode: e.target.value })} /></label><label className="form-full">Delivery notes<textarea value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} placeholder="Optional access or delivery notes" /></label></div><div className="checkout-submit"><div><span>Request total</span><strong>{money(totalCents)}</strong></div><button className="button button--red" disabled={submitOrder.isPending}>{submitOrder.isPending ? "Sending…" : "Send request"} <ArrowRight size={17} /></button></div></form></section></div>}
      <footer className="site-footer"><span>© 2026 STELLAR GEAR</span><span>TRAIN WITH INTENT</span><Link href="/admin">Order desk admin</Link></footer>
    </div>
  );
}

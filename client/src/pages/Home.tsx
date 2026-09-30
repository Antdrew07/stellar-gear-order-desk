import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Minus, Plus, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Cart = Record<number, number>;
type CheckoutForm = {
  customerName: string; email: string; phone: string; address1: string; address2: string;
  city: string; state: string; postalCode: string; notes: string;
};

const emptyCheckoutForm: CheckoutForm = {
  customerName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", postalCode: "", notes: "",
};

export default function Home() {
  const [, setLocation] = useLocation();
  const catalog = trpc.catalog.snapshot.useQuery(undefined, { staleTime: 20_000 });
  const [cart, setCart] = useState<Cart>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState<CheckoutForm>(emptyCheckoutForm);
  const products = catalog.data?.products ?? [];
  const rows = useMemo(() => products.map(product => {
    const quantity = cart[product.id] ?? 0;
    const priceCents = product.salePriceCents ?? product.priceCents;
    return { product, quantity, priceCents, lineTotal: priceCents * quantity };
  }), [products, cart]);
  const checkoutItems = rows.filter(row => row.quantity > 0);
  const total = rows.reduce((sum, row) => sum + row.lineTotal, 0);
  const shippingCents = checkoutItems.length ? 2_000 : 0;
  const checkoutTotal = total + shippingCents;

  const setQuantity = (id: number, value: number) => {
    setCart(current => {
      const next = { ...current };
      if (value <= 0) delete next[id]; else next[id] = Math.min(25, value);
      return next;
    });
  };

  const checkout = trpc.orders.startBitcoinCheckout.useMutation({
    onSuccess: payment => {
      setCheckoutOpen(false);
      setLocation(`/checkout/${payment.paymentToken}`);
    },
    onError: error => toast.error(error.message),
  });

  const submitCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkoutItems.length) return;
    checkout.mutate({
      customer: {
        ...customer,
        customerName: customer.customerName.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
        address1: customer.address1.trim(),
        address2: customer.address2.trim() || undefined,
        city: customer.city.trim(),
        state: customer.state.trim(),
        postalCode: customer.postalCode.trim(),
        notes: customer.notes.trim() || undefined,
      },
      items: checkoutItems.map(row => ({ productId: row.product.id, quantity: row.quantity })),
    });
  };

  const updateCustomer = (field: keyof CheckoutForm, value: string) => setCustomer(current => ({ ...current, [field]: value }));

  return (
    <div className="sheet-shell">
      <header className="sheet-header">
        <Link href="/" className="sheet-brand"><span>STELLAR GEAR</span></Link>
        <Link href="/admin" className="sheet-manage">Manage items</Link>
      </header>
      <main className="price-sheet">
        <section className="sheet-identity" aria-label="Stellar Gear logo and price sheet">
          <div className="sheet-logo-wrap"><img src="/stellar-gear-logo.png" alt="Stellar Gear bodybuilding logo" /></div>
          <div className="sheet-title"><p>STELLAR GEAR</p><h1>Price Sheet</h1><span>Choose quantities. The total updates automatically.</span></div>
        </section>
        <section className="sheet-table" aria-label="Product price sheet">
          <div className="sheet-row sheet-row--head"><span>Item</span><span>Price</span><span>Qty</span><span>Total</span></div>
          {catalog.isLoading ? <div className="sheet-loading">Loading items…</div> : rows.length ? rows.map(({ product, quantity, priceCents, lineTotal }) => (
            product.kind === "section" ? (
            <div className="sheet-section" key={product.id}>{product.name}</div>
            ) : (
            <div className={`sheet-row ${!product.inStock ? "sheet-row--unavailable" : ""}`} key={product.id}>
              <div className="sheet-item"><strong>{product.name}</strong>{product.description ? <small className="sheet-desc">{product.description}</small> : null}{!product.inStock && <small>Out of stock</small>}</div>
              <div className="sheet-price">{product.salePriceCents ? <><s>{money(product.priceCents)}</s><b>{money(priceCents)}</b></> : <b>{money(priceCents)}</b>}</div>
              <div className="sheet-qty">{product.inStock ? <><button aria-label={`Remove ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)} disabled={!quantity}><Minus size={15} /></button><span>{quantity}</span><button aria-label={`Add ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={15} /></button></> : <span>—</span>}</div>
              <strong className="sheet-line-total">{quantity ? money(lineTotal) : "—"}</strong>
            </div>
            )
          )) : <div className="sheet-loading">No items have been added yet. Open <Link href="/admin">Manage items</Link> to add your first item.</div>}
        </section>
        <section className="sheet-total"><span>Items total</span><strong>{money(total)}</strong></section>
        <section className="sheet-checkout"><div><strong>Bitcoin checkout</strong><span>$20 shipping is added at checkout.</span></div><button className="sheet-checkout-button" disabled={!checkoutItems.length} onClick={() => setCheckoutOpen(true)}>Checkout with Bitcoin</button></section>
      </main>

      {checkoutOpen && <div className="checkout-overlay" role="dialog" aria-modal="true" aria-label="Shipping and Bitcoin checkout"><form className="checkout-card" onSubmit={submitCheckout}><button type="button" className="checkout-close" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X size={20} /></button><div className="checkout-head"><p className="eyebrow">STELLAR GEAR</p><h2>Shipping details</h2><p>Enter the details needed to send your order. You will see the Bitcoin payment screen next.</p></div><div className="form-grid"><label>Name<input required autoComplete="name" value={customer.customerName} onChange={event => updateCustomer("customerName", event.target.value)} /></label><label>Email<input required type="email" autoComplete="email" value={customer.email} onChange={event => updateCustomer("email", event.target.value)} /></label><label>Phone<input required type="tel" autoComplete="tel" value={customer.phone} onChange={event => updateCustomer("phone", event.target.value)} /></label><label>Street address<input required autoComplete="address-line1" value={customer.address1} onChange={event => updateCustomer("address1", event.target.value)} /></label><label className="form-full">Apartment, suite, etc. <small>Optional</small><input autoComplete="address-line2" value={customer.address2} onChange={event => updateCustomer("address2", event.target.value)} /></label><label>City<input required autoComplete="address-level2" value={customer.city} onChange={event => updateCustomer("city", event.target.value)} /></label><label>State / province<input required autoComplete="address-level1" value={customer.state} onChange={event => updateCustomer("state", event.target.value)} /></label><label>Postal code<input required autoComplete="postal-code" value={customer.postalCode} onChange={event => updateCustomer("postalCode", event.target.value)} /></label><label className="form-full">Order notes <small>Optional</small><textarea value={customer.notes} onChange={event => updateCustomer("notes", event.target.value)} /></label></div><section className="checkout-summary"><div><span>Items</span><b>{money(total)}</b></div><div><span>Shipping</span><b>{money(shippingCents)}</b></div><div className="checkout-summary-total"><span>Order total</span><strong>{money(checkoutTotal)}</strong></div></section><div className="checkout-submit"><div><span>Next step</span><strong>Pay with Bitcoin</strong></div><button className="button button--red" disabled={checkout.isPending}>{checkout.isPending ? "Preparing payment…" : "Continue to payment"}</button></div></form></div>}
    </div>
  );
}

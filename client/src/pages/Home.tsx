import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Cart = Record<number, number>;

export default function Home() {
  const catalog = trpc.catalog.snapshot.useQuery(undefined, { staleTime: 20_000 });
  const [cart, setCart] = useState<Cart>({});
  const products = catalog.data?.products ?? [];
  const rows = useMemo(() => products.map(product => {
    const quantity = cart[product.id] ?? 0;
    const priceCents = product.salePriceCents ?? product.priceCents;
    return { product, quantity, priceCents, lineTotal: priceCents * quantity };
  }), [products, cart]);
  const total = rows.reduce((sum, row) => sum + row.lineTotal, 0);

  const setQuantity = (id: number, value: number) => {
    setCart(current => {
      const next = { ...current };
      if (value <= 0) delete next[id]; else next[id] = Math.min(99, value);
      return next;
    });
  };

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
            <div className={`sheet-row ${!product.inStock ? "sheet-row--unavailable" : ""}`} key={product.id}>
              <div className="sheet-item"><strong>{product.name}</strong>{!product.inStock && <small>Unavailable</small>}</div>
              <div className="sheet-price">{product.salePriceCents ? <><s>{money(product.priceCents)}</s><b>{money(priceCents)}</b></> : <b>{money(priceCents)}</b>}</div>
              <div className="sheet-qty">{product.inStock ? <><button aria-label={`Remove ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)} disabled={!quantity}><Minus size={15} /></button><span>{quantity}</span><button aria-label={`Add ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)}><Plus size={15} /></button></> : <span>—</span>}</div>
              <strong className="sheet-line-total">{quantity ? money(lineTotal) : "—"}</strong>
            </div>
          )) : <div className="sheet-loading">No items have been added yet. Open <Link href="/admin">Manage items</Link> to add your first item.</div>}
        </section>
        <section className="sheet-total"><span>Total</span><strong>{money(total)}</strong></section>
      </main>
    </div>
  );
}

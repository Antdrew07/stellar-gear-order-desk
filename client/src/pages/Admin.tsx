import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ChevronLeft, ClipboardList, Edit3, PackagePlus, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Draft = { id?: number; name: string; description: string; category: string; price: string; salePrice: string; badge: string; inStock: boolean; featured: boolean; sortOrder: string };
const blankDraft: Draft = { name: "", description: "", category: "Apparel", price: "", salePrice: "", badge: "", inStock: true, featured: false, sortOrder: "100" };

export default function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const catalog = trpc.catalog.snapshot.useQuery();
  const orders = trpc.orders.list.useQuery(undefined, { enabled: isAdmin });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [shipping, setShipping] = useState("");

  const refresh = async () => { await Promise.all([utils.catalog.snapshot.invalidate(), utils.orders.list.invalidate()]); };
  const create = trpc.catalog.create.useMutation({ onSuccess: async () => { toast.success("Product added to catalog"); setDraft(null); await refresh(); }, onError: e => toast.error(e.message) });
  const update = trpc.catalog.update.useMutation({ onSuccess: async () => { toast.success("Product updated"); setDraft(null); await refresh(); }, onError: e => toast.error(e.message) });
  const remove = trpc.catalog.remove.useMutation({ onSuccess: async () => { toast.success("Product removed"); await refresh(); }, onError: e => toast.error(e.message) });
  const shippingUpdate = trpc.catalog.updateShipping.useMutation({ onSuccess: async () => { toast.success("Shipping rate updated"); await refresh(); }, onError: e => toast.error(e.message) });
  const statusUpdate = trpc.orders.updateStatus.useMutation({ onSuccess: async () => { toast.success("Order status saved"); await refresh(); }, onError: e => toast.error(e.message) });

  const productCount = catalog.data?.products.length ?? 0;
  const requestCount = orders.data?.length ?? 0;
  const draftTitle = draft?.id ? "Edit item" : "Add an item";
  const defaultShipping = useMemo(() => catalog.data?.settings?.shippingCents ?? 2000, [catalog.data]);
  useEffect(() => {
    if (catalog.data && !shipping) setShipping(String(defaultShipping / 100));
  }, [catalog.data, defaultShipping, shipping]);

  const saveProduct = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const input = {
      name: draft.name, description: draft.description || null, category: draft.category,
      priceCents: Math.round(Number(draft.price) * 100), salePriceCents: draft.salePrice ? Math.round(Number(draft.salePrice) * 100) : null,
      badge: draft.badge || null, inStock: draft.inStock, featured: draft.featured, sortOrder: Number(draft.sortOrder || 100),
    };
    if (!input.name || !input.category || !Number.isFinite(input.priceCents) || input.priceCents < 0) return toast.error("Name, category, and a valid price are required.");
    if (draft.id) update.mutate({ id: draft.id, ...input }); else create.mutate(input);
  };

  if (loading) return <div className="admin-gate"><p className="eyebrow">STELLAR GEAR / ADMIN</p><h1>Loading workspace…</h1></div>;
  if (!isAdmin) return <div className="admin-gate"><div className="gate-mark">✦</div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>Catalog control<br /><i>requires admin access.</i></h1><p>Sign in with the account that owns this Stellar Gear project to edit products, set shipping, and review order requests.</p><div className="gate-actions"><button className="button button--red" onClick={startLogin}>Sign in to admin <ChevronLeft size={16} className="rotate-180" /></button><Link href="/" className="text-link">Back to order desk</Link></div></div>;

  return <div className="admin-shell"><header className="admin-header"><Link href="/" className="admin-brand"><span>✦</span><b>STELLAR GEAR</b><em>ADMIN</em></Link><div><span className="admin-user">{user?.name || "Admin"}</span><Link href="/" className="admin-exit">View order desk <ChevronLeft size={15} /></Link></div></header><main className="admin-main"><section className="admin-hero"><div><p className="eyebrow">OPERATIONS / CONTROL ROOM</p><h1>Keep the catalog<br /><i>in motion.</i></h1><p>Manage the public gear list, shipping rate, and incoming order requests from a single operational view.</p></div><button className="button button--red" onClick={() => setDraft(blankDraft)}><Plus size={17} /> Add product</button></section>
    <section className="stat-grid"><div><span>Catalog items</span><strong>{String(productCount).padStart(2, "0")}</strong><small>currently listed</small></div><div><span>Open requests</span><strong>{String(requestCount).padStart(2, "0")}</strong><small>all recorded requests</small></div><div><span>Shipping rate</span><strong>{money(defaultShipping)}</strong><small>flat rate per request</small></div></section>
    <section className="admin-section"><div className="admin-section__title"><div><p className="eyebrow">CATALOG</p><h2>Products</h2></div><button className="icon-button" title="Add product" onClick={() => setDraft(blankDraft)}><PackagePlus size={18} /></button></div><div className="admin-product-list">{catalog.isLoading ? <p>Loading products…</p> : catalog.data?.products.map(product => <article key={product.id} className="admin-product-row"><div className="admin-product-glyph">{product.name.slice(0, 2).toUpperCase()}</div><div className="admin-product-info"><div><h3>{product.name}</h3>{product.badge && <span className="mini-badge">{product.badge}</span>}{product.featured && <span className="mini-badge mini-badge--outline">featured</span>}</div><p>{product.category} · {product.inStock ? "in stock" : "unavailable"}</p></div><div className="admin-price"><strong>{money(product.salePriceCents ?? product.priceCents)}</strong>{product.salePriceCents && <s>{money(product.priceCents)}</s>}</div><div className="row-actions"><button title={`Edit ${product.name}`} onClick={() => setDraft({ id: product.id, name: product.name, description: product.description || "", category: product.category, price: String(product.priceCents / 100), salePrice: product.salePriceCents ? String(product.salePriceCents / 100) : "", badge: product.badge || "", inStock: product.inStock, featured: product.featured, sortOrder: String(product.sortOrder) })}><Edit3 size={16} /></button><button className="danger" title={`Remove ${product.name}`} onClick={() => { if (window.confirm(`Remove “${product.name}” from the catalog?`)) remove.mutate({ id: product.id }); }}><Trash2 size={16} /></button></div></article>)}</div></section>
    <section className="admin-section admin-split"><div className="shipping-card"><div><p className="eyebrow">CATALOG SETTINGS</p><h2>Shipping</h2><p>Applied automatically to any request with at least one product.</p></div><form onSubmit={event => { event.preventDefault(); const cents = Math.round(Number(shipping) * 100); if (!Number.isFinite(cents) || cents < 0) return toast.error("Enter a valid shipping amount."); shippingUpdate.mutate({ shippingCents: cents }); }}><label>Flat rate<input type="number" min="0" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} /></label><button className="button button--dark" disabled={shippingUpdate.isPending}><Settings2 size={16} /> Save rate</button></form></div><div className="request-card"><div className="admin-section__title"><div><p className="eyebrow">ORDER REQUESTS</p><h2>Incoming</h2></div><ClipboardList size={19} /></div><div className="request-list">{orders.isLoading ? <p>Loading requests…</p> : orders.data?.length ? orders.data.map(order => <article key={order.id} className="request-row"><div className="request-row__head"><div><span className="request-number">{order.orderNumber}</span><h3>{order.customerName}</h3><p>{order.email} · {order.phone}</p></div><div><strong>{money(order.totalCents)}</strong><select aria-label={`Set status for ${order.orderNumber}`} value={order.status} onChange={e => statusUpdate.mutate({ id: order.id, status: e.target.value as "new" | "reviewing" | "confirmed" | "closed" })}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="confirmed">Confirmed</option><option value="closed">Closed</option></select></div></div><div className="request-details"><p><b>Ship to:</b> {order.address1}{order.address2 ? `, ${order.address2}` : ""}, {order.city}, {order.state} {order.postalCode}</p><p><b>Items:</b> {order.items.map(item => `${item.quantity} × ${item.productName}`).join(", ")}</p>{order.notes && <p><b>Notes:</b> {order.notes}</p>}</div></article>) : <div className="empty-requests">No order requests have been submitted yet.</div>}</div></div></section>
  </main>
  {draft && <div className="drawer-overlay"><aside className="product-drawer"><button className="drawer-close" onClick={() => setDraft(null)} aria-label="Close product editor"><X size={20} /></button><p className="eyebrow">CATALOG EDITOR</p><h2>{draftTitle}</h2><p className="drawer-copy">Set the product details customers see in the order desk.</p><form onSubmit={saveProduct} className="product-form"><label>Product name<input required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label>Description<textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label><div className="two-col"><label>Category<input required value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></label><label>Display order<input type="number" min="0" value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: e.target.value })} /></label></div><div className="two-col"><label>Regular price<input required type="number" min="0" step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} /></label><label>Sale price<input type="number" min="0" step="0.01" value={draft.salePrice} onChange={e => setDraft({ ...draft, salePrice: e.target.value })} placeholder="Optional" /></label></div><label>Badge<input value={draft.badge} onChange={e => setDraft({ ...draft, badge: e.target.value.toUpperCase().slice(0, 24) })} placeholder="e.g. SALE" /></label><div className="toggle-row"><label><input type="checkbox" checked={draft.inStock} onChange={e => setDraft({ ...draft, inStock: e.target.checked })} /> In stock</label><label><input type="checkbox" checked={draft.featured} onChange={e => setDraft({ ...draft, featured: e.target.checked })} /> Featured</label></div><button className="button button--red button--full" disabled={create.isPending || update.isPending}>{draft.id ? "Save product" : "Add product"} <Save size={16} /></button></form></aside></div>}</div>;
}

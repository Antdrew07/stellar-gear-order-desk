import { trpc } from "@/lib/trpc";
import { ArrowLeft, Boxes, LogOut, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Draft = { id?: number; name: string; price: string; salePrice: string; inventory: string; inStock: boolean };
type Filter = "all" | "available" | "out";
type ProductRow = {
  id: number; name: string; priceCents: number; salePriceCents: number | null; inventoryQuantity: number | null;
  inStock: boolean;
};
const emptyDraft: Draft = { name: "", price: "", salePrice: "", inventory: "0", inStock: true };

function isAvailable(product: ProductRow) {
  return product.inStock && (product.inventoryQuantity === null || product.inventoryQuantity > 0);
}

function statusLabel(product: ProductRow) {
  if (!product.inStock) return "Hidden";
  if (product.inventoryQuantity === null) return "Available";
  return product.inventoryQuantity > 0 ? "Available" : "Out of stock";
}

export default function Admin() {
  const utils = trpc.useUtils();
  const session = trpc.admin.session.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const catalog = trpc.catalog.adminSnapshot.useQuery(undefined, { enabled: session.data?.signedIn === true });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const refresh = () => Promise.all([utils.catalog.adminSnapshot.invalidate(), utils.catalog.snapshot.invalidate()]);
  const login = trpc.admin.login.useMutation({
    onSuccess: () => { setPassword(""); toast.success("Admin dashboard unlocked"); void utils.admin.session.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const logout = trpc.admin.logout.useMutation({
    onSuccess: () => { toast.success("Signed out"); void utils.admin.session.invalidate(); void utils.catalog.adminSnapshot.invalidate(); },
  });
  const create = trpc.catalog.create.useMutation({ onSuccess: () => { toast.success("Item added"); setDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const update = trpc.catalog.update.useMutation({ onSuccess: () => { toast.success("Item updated"); setDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.catalog.remove.useMutation({ onSuccess: () => { toast.success("Item removed"); void refresh(); }, onError: error => toast.error(error.message) });

  const products = (catalog.data?.products ?? []) as ProductRow[];
  const visibleProducts = useMemo(() => products.filter(product => {
    if (filter === "available") return isAvailable(product);
    if (filter === "out") return !isAvailable(product);
    return true;
  }), [filter, products]);
  const trackedUnits = products.reduce((sum, product) => sum + (product.inventoryQuantity ?? 0), 0);
  const availableCount = products.filter(isAvailable).length;
  const outCount = products.filter(product => !isAvailable(product)).length;
  const untrackedCount = products.filter(product => product.inventoryQuantity === null).length;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const priceCents = Math.round(Number(draft.price) * 100);
    const salePriceCents = draft.salePrice ? Math.round(Number(draft.salePrice) * 100) : null;
    const inventoryQuantity = Number(draft.inventory);
    if (!draft.name.trim() || !Number.isFinite(priceCents) || priceCents < 0) return toast.error("Enter an item name and a valid price.");
    if (salePriceCents !== null && (!Number.isFinite(salePriceCents) || salePriceCents < 0)) return toast.error("Enter a valid sale price.");
    if (draft.inventory.trim() === "" || !Number.isInteger(inventoryQuantity) || inventoryQuantity < 0) return toast.error("Inventory must be a whole number.");
    const input = { name: draft.name.trim(), description: null, category: "General", priceCents, salePriceCents, badge: null, inStock: draft.inStock, inventoryQuantity, featured: false, sortOrder: 100 };
    if (draft.id) update.mutate({ id: draft.id, ...input }); else create.mutate(input);
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username: username.trim(), password });
  };

  if (session.isLoading) return <div className="simple-admin-gate">Loading…</div>;
  if (!session.data?.signedIn) return <main className="simple-admin-gate admin-login-gate"><div className="admin-logo-mini"><img src="/stellar-gear-logo.png" alt="Stellar Gear" /></div><p>STELLAR GEAR</p><h1>Admin login</h1><span>Sign in to add items, update prices, and manage inventory.</span><form className="admin-login-form" onSubmit={submitLogin}><label>Username<input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="simple-primary" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button></form><Link href="/">Back to price sheet</Link></main>;

  return <div className="simple-admin inventory-admin"><header><Link href="/"><ArrowLeft size={16} /> Price sheet</Link><strong>STELLAR GEAR · ADMIN</strong><div className="admin-header-actions"><button className="simple-signout" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={14} /> Sign out</button><button className="simple-primary" onClick={() => setDraft(emptyDraft)}><Plus size={15} /> Add item</button></div></header><main><div className="simple-admin-title"><p>STELLAR GEAR</p><h1>Inventory</h1><span>Add items, change prices, and control what appears on the price sheet.</span></div><section className="inventory-summary" aria-label="Inventory summary"><div><span>Tracked units</span><strong>{trackedUnits}</strong></div><div><span>In stock</span><strong>{availableCount}</strong></div><div><span>Out of stock</span><strong>{outCount}</strong></div><div><span>Not tracked</span><strong>{untrackedCount}</strong></div></section><section className="admin-list-heading"><div><h2>Items</h2><span>{products.length} total</span></div><div className="inventory-filters"><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "available" ? "is-active" : ""} onClick={() => setFilter("available")}>In stock</button><button className={filter === "out" ? "is-active" : ""} onClick={() => setFilter("out")}>Out of stock</button></div></section><section className="simple-item-table inventory-table"><div className="simple-item-row simple-item-row--head"><span>Item</span><span>Price</span><span>Inventory</span><span>Status</span><span /></div>{catalog.isLoading ? <div className="simple-empty">Loading items…</div> : visibleProducts.length ? visibleProducts.map(product => <div className="simple-item-row" key={product.id}><strong>{product.name}</strong><span>{money(product.salePriceCents ?? product.priceCents)}</span><span className={product.inventoryQuantity === 0 ? "inventory-zero" : ""}>{product.inventoryQuantity === null ? "Not tracked" : product.inventoryQuantity}</span><span><b className={`stock-status ${isAvailable(product) ? "stock-status--available" : "stock-status--out"}`}>{statusLabel(product)}</b></span><div><button title={`Edit ${product.name}`} onClick={() => setDraft({ id: product.id, name: product.name, price: String(product.priceCents / 100), salePrice: product.salePriceCents ? String(product.salePriceCents / 100) : "", inventory: product.inventoryQuantity === null ? "" : String(product.inventoryQuantity), inStock: product.inStock })}><Pencil size={15} /></button><button className="simple-delete" title={`Remove ${product.name}`} onClick={() => { if (window.confirm(`Remove “${product.name}”?`)) remove.mutate({ id: product.id }); }}><Trash2 size={15} /></button></div></div>) : <div className="simple-empty">No items in this view.</div>}</section></main>{draft && <div className="simple-editor-backdrop"><form className="simple-editor" onSubmit={save}><button type="button" className="simple-close" onClick={() => setDraft(null)} aria-label="Close editor"><X size={19} /></button><p>STELLAR GEAR</p><h2>{draft.id ? "Edit item" : "Add item"}</h2><label>Item name<input required autoFocus value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>Price<input required type="number" min="0" step="0.01" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></label><label>Sale price <small>Optional</small><input type="number" min="0" step="0.01" value={draft.salePrice} onChange={event => setDraft({ ...draft, salePrice: event.target.value })} /></label><label>Inventory <small>Enter a whole number. Set 0 for out of stock.</small><input required type="number" min="0" step="1" value={draft.inventory} onChange={event => setDraft({ ...draft, inventory: event.target.value })} /></label><label className="simple-check"><input type="checkbox" checked={draft.inStock} onChange={event => setDraft({ ...draft, inStock: event.target.checked })} /> Show as available on price sheet</label><button className="simple-primary" disabled={create.isPending || update.isPending}><Save size={15} /> Save item</button></form></div>}</div>;
}

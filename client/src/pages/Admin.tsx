import { trpc } from "@/lib/trpc";
import { ADMIN_DASHBOARD_SESSION_STORAGE_KEY } from "@shared/const";
import { ArrowLeft, ChevronDown, ChevronUp, LogOut, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Draft = { id?: number; name: string; description: string; price: string; salePrice: string; inventory: string; inStock: boolean };
type SectionDraft = { id?: number; title: string };
type Filter = "all" | "available" | "out";
type ProductRow = {
  id: number; kind: "product" | "section"; name: string; description: string | null; priceCents: number;
  salePriceCents: number | null; inventoryQuantity: number | null; inStock: boolean;
};
const emptyDraft: Draft = { name: "", description: "", price: "", salePrice: "", inventory: "0", inStock: true };

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
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const refresh = () => Promise.all([utils.catalog.adminSnapshot.invalidate(), utils.catalog.snapshot.invalidate()]);
  const login = trpc.admin.login.useMutation({
    onSuccess: result => { try { sessionStorage.setItem(ADMIN_DASHBOARD_SESSION_STORAGE_KEY, result.sessionToken); } catch {} setPassword(""); toast.success("Admin dashboard unlocked"); void utils.admin.session.invalidate(); },
    onError: error => toast.error(error.data?.code === "UNAUTHORIZED" ? "Invalid username or password." : "Unable to sign in right now. Refresh this page and try again."),
  });
  const logout = trpc.admin.logout.useMutation({
    onSuccess: () => { try { sessionStorage.removeItem(ADMIN_DASHBOARD_SESSION_STORAGE_KEY); } catch {} toast.success("Signed out"); void utils.admin.session.invalidate(); void utils.catalog.adminSnapshot.invalidate(); },
  });
  const create = trpc.catalog.create.useMutation({ onSuccess: () => { toast.success("Item added"); setDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const update = trpc.catalog.update.useMutation({ onSuccess: () => { toast.success("Item updated"); setDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.catalog.remove.useMutation({ onSuccess: () => { toast.success("Removed"); void refresh(); }, onError: error => toast.error(error.message) });
  const addSection = trpc.catalog.addSection.useMutation({ onSuccess: () => { toast.success("Section added"); setSectionDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const updateSection = trpc.catalog.updateSection.useMutation({ onSuccess: () => { toast.success("Section updated"); setSectionDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const reorder = trpc.catalog.reorder.useMutation({ onSuccess: () => void refresh(), onError: error => toast.error(error.message) });

  const products = (catalog.data?.products ?? []) as ProductRow[];
  const realProducts = products.filter(product => product.kind === "product");
  const visibleProducts = useMemo(() => products.filter(product => {
    if (product.kind === "section") return true;
    if (filter === "available") return isAvailable(product);
    if (filter === "out") return !isAvailable(product);
    return true;
  }), [filter, products]);
  const trackedUnits = realProducts.reduce((sum, product) => sum + (product.inventoryQuantity ?? 0), 0);
  const availableCount = realProducts.filter(isAvailable).length;
  const outCount = realProducts.filter(product => !isAvailable(product)).length;
  const untrackedCount = realProducts.filter(product => product.inventoryQuantity === null).length;

  const move = (id: number, direction: -1 | 1) => {
    const order = products.map(product => product.id);
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    reorder.mutate({ ids: order });
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const priceCents = Math.round(Number(draft.price) * 100);
    const salePriceCents = draft.salePrice ? Math.round(Number(draft.salePrice) * 100) : null;
    const inventoryQuantity = Number(draft.inventory);
    if (!draft.name.trim() || !Number.isFinite(priceCents) || priceCents < 0) return toast.error("Enter an item name and a valid price.");
    if (salePriceCents !== null && (!Number.isFinite(salePriceCents) || salePriceCents < 0)) return toast.error("Enter a valid sale price.");
    if (draft.inventory.trim() === "" || !Number.isInteger(inventoryQuantity) || inventoryQuantity < 0) return toast.error("Inventory must be a whole number.");
    const input = { name: draft.name.trim(), description: draft.description.trim() || null, category: "General", priceCents, salePriceCents, badge: null, inStock: draft.inStock, inventoryQuantity, featured: false };
    if (draft.id) update.mutate({ id: draft.id, ...input }); else create.mutate(input);
  };

  const saveSection = (event: FormEvent) => {
    event.preventDefault();
    if (!sectionDraft) return;
    const title = sectionDraft.title.trim();
    if (!title) return toast.error("Enter a section title.");
    if (sectionDraft.id) updateSection.mutate({ id: sectionDraft.id, title }); else addSection.mutate({ title });
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username: username.trim(), password });
  };

  if (session.isLoading) return <div className="simple-admin-gate">Loading…</div>;
  if (!session.data?.signedIn) return <main className="simple-admin-gate admin-login-gate"><section className="admin-login-hero" aria-label="Stellar Gear"><div className="admin-logo-mini"><img src="/stellar-gear-logo.png" alt="Stellar Gear" /></div></section><section className="admin-login-content"><p>STELLAR GEAR</p><h1>Admin login</h1><span>Sign in to add items, update prices, and manage inventory.</span><form className="admin-login-form" onSubmit={submitLogin}><label>Username<input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label><label>Password<span className="password-input"><input required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></span></label><button className="simple-primary" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button></form><Link href="/">Back to price sheet</Link></section></main>;

  return (
    <div className="simple-admin inventory-admin">
      <header>
        <Link href="/"><ArrowLeft size={16} /> Price sheet</Link>
        <strong>STELLAR GEAR · ADMIN</strong>
        <div className="admin-header-actions">
          <button className="simple-signout" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={14} /> Sign out</button>
          <button className="simple-ghost" onClick={() => setSectionDraft({ title: "" })}><Plus size={15} /> Add section</button>
          <button className="simple-primary" onClick={() => setDraft(emptyDraft)}><Plus size={15} /> Add item</button>
        </div>
      </header>
      <main>
        <div className="simple-admin-title"><p>STELLAR GEAR</p><h1>Inventory</h1><span>Add items, add section dividers, drag order with the arrows, and control what appears on the price sheet.</span></div>
        <section className="inventory-summary" aria-label="Inventory summary">
          <div><span>Tracked units</span><strong>{trackedUnits}</strong></div>
          <div><span>In stock</span><strong>{availableCount}</strong></div>
          <div><span>Out of stock</span><strong>{outCount}</strong></div>
          <div><span>Not tracked</span><strong>{untrackedCount}</strong></div>
        </section>
        <section className="admin-list-heading">
          <div><h2>Items</h2><span>{realProducts.length} total</span></div>
          <div className="inventory-filters">
            <button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button>
            <button className={filter === "available" ? "is-active" : ""} onClick={() => setFilter("available")}>In stock</button>
            <button className={filter === "out" ? "is-active" : ""} onClick={() => setFilter("out")}>Out of stock</button>
          </div>
        </section>
        {filter !== "all" && <p className="reorder-hint">Switch to “All” to add section dividers between items and reorder them.</p>}
        <section className="simple-item-table inventory-table">
          <div className="simple-item-row simple-item-row--head"><span>Item</span><span>Price</span><span>Inventory</span><span>Status</span><span /></div>
          {catalog.isLoading ? <div className="simple-empty">Loading items…</div> : visibleProducts.length ? visibleProducts.map(product => (
            product.kind === "section" ? (
              <div className="simple-section-row" key={product.id}>
                <span className="section-label">{product.name}</span>
                <div className="section-actions">
                  {filter === "all" && <><button title="Move up" onClick={() => move(product.id, -1)}><ChevronUp size={15} /></button><button title="Move down" onClick={() => move(product.id, 1)}><ChevronDown size={15} /></button></>}
                  <button title="Edit section" onClick={() => setSectionDraft({ id: product.id, title: product.name })}><Pencil size={15} /></button>
                  <button className="simple-delete" title="Remove section" onClick={() => { if (window.confirm(`Remove section “${product.name}”?`)) remove.mutate({ id: product.id }); }}><Trash2 size={15} /></button>
                </div>
              </div>
            ) : (
              <div className="simple-item-row" key={product.id}>
                <span className="item-name-cell"><strong>{product.name}</strong>{product.description ? <small className="item-desc">{product.description}</small> : null}</span>
                <span>{money(product.salePriceCents ?? product.priceCents)}</span>
                <span className={product.inventoryQuantity === 0 ? "inventory-zero" : ""}>{product.inventoryQuantity === null ? "Not tracked" : product.inventoryQuantity}</span>
                <span><b className={`stock-status ${isAvailable(product) ? "stock-status--available" : "stock-status--out"}`}>{statusLabel(product)}</b></span>
                <div>
                  {filter === "all" && <><button title="Move up" onClick={() => move(product.id, -1)}><ChevronUp size={15} /></button><button title="Move down" onClick={() => move(product.id, 1)}><ChevronDown size={15} /></button></>}
                  <button title={`Edit ${product.name}`} onClick={() => setDraft({ id: product.id, name: product.name, description: product.description ?? "", price: String(product.priceCents / 100), salePrice: product.salePriceCents ? String(product.salePriceCents / 100) : "", inventory: product.inventoryQuantity === null ? "" : String(product.inventoryQuantity), inStock: product.inStock })}><Pencil size={15} /></button>
                  <button className="simple-delete" title={`Remove ${product.name}`} onClick={() => { if (window.confirm(`Remove “${product.name}”?`)) remove.mutate({ id: product.id }); }}><Trash2 size={15} /></button>
                </div>
              </div>
            )
          )) : <div className="simple-empty">No items in this view.</div>}
        </section>
      </main>
      {draft && <div className="simple-editor-backdrop"><form className="simple-editor" onSubmit={save}><button type="button" className="simple-close" onClick={() => setDraft(null)} aria-label="Close editor"><X size={19} /></button><p>STELLAR GEAR</p><h2>{draft.id ? "Edit item" : "Add item"}</h2><label>Item name<input required autoFocus value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>Description <small>Optional — shown under the item name</small><textarea className="simple-textarea" rows={2} maxLength={1000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Brief description of this item" /></label><label>Price<input required type="number" min="0" step="0.01" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></label><label>Sale price <small>Optional</small><input type="number" min="0" step="0.01" value={draft.salePrice} onChange={event => setDraft({ ...draft, salePrice: event.target.value })} /></label><label>Inventory <small>Enter a whole number. Set 0 for out of stock.</small><input required type="number" min="0" step="1" value={draft.inventory} onChange={event => setDraft({ ...draft, inventory: event.target.value })} /></label><label className="simple-check"><input type="checkbox" checked={draft.inStock} onChange={event => setDraft({ ...draft, inStock: event.target.checked })} /> Show as available on price sheet</label><button className="simple-primary" disabled={create.isPending || update.isPending}><Save size={15} /> Save item</button></form></div>}
      {sectionDraft && <div className="simple-editor-backdrop"><form className="simple-editor" onSubmit={saveSection}><button type="button" className="simple-close" onClick={() => setSectionDraft(null)} aria-label="Close editor"><X size={19} /></button><p>STELLAR GEAR</p><h2>{sectionDraft.id ? "Edit section" : "Add section"}</h2><label>Section title <small>Shows as a red divider above the items that follow it</small><input required autoFocus value={sectionDraft.title} onChange={event => setSectionDraft({ ...sectionDraft, title: event.target.value })} placeholder="e.g. APPAREL" /></label><button className="simple-primary" disabled={addSection.isPending || updateSection.isPending}><Save size={15} /> Save section</button></form></div>}
    </div>
  );
}

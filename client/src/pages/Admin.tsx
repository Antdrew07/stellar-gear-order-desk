import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
type Draft = { id?: number; name: string; price: string; salePrice: string; inStock: boolean };
const emptyDraft: Draft = { name: "", price: "", salePrice: "", inStock: true };

export default function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const catalog = trpc.catalog.snapshot.useQuery();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = () => utils.catalog.snapshot.invalidate();
  const create = trpc.catalog.create.useMutation({ onSuccess: () => { toast.success("Item added"); setDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const update = trpc.catalog.update.useMutation({ onSuccess: () => { toast.success("Item updated"); setDraft(null); void refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.catalog.remove.useMutation({ onSuccess: () => { toast.success("Item removed"); void refresh(); }, onError: error => toast.error(error.message) });

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const priceCents = Math.round(Number(draft.price) * 100);
    const salePriceCents = draft.salePrice ? Math.round(Number(draft.salePrice) * 100) : null;
    if (!draft.name.trim() || !Number.isFinite(priceCents) || priceCents < 0) return toast.error("Enter an item name and a valid price.");
    const input = { name: draft.name.trim(), description: null, category: "General", priceCents, salePriceCents, badge: null, inStock: draft.inStock, featured: false, sortOrder: 100 };
    if (draft.id) update.mutate({ id: draft.id, ...input }); else create.mutate(input);
  };

  if (loading) return <div className="simple-admin-gate">Loading…</div>;
  if (!isAdmin) return <main className="simple-admin-gate"><p>STELLAR GEAR</p><h1>Manage items</h1><span>Sign in with the project owner account to add, edit, or remove items.</span><button className="simple-primary" onClick={startLogin}>Sign in</button><Link href="/">Back to price sheet</Link></main>;

  return <div className="simple-admin"><header><Link href="/"><ArrowLeft size={16} /> Price sheet</Link><strong>STELLAR GEAR</strong><button className="simple-primary" onClick={() => setDraft(emptyDraft)}><Plus size={15} /> Add item</button></header><main><div className="simple-admin-title"><p>STELLAR GEAR</p><h1>Manage items</h1><span>These are the items and prices shown on the price sheet.</span></div><section className="simple-item-table"><div className="simple-item-row simple-item-row--head"><span>Item</span><span>Price</span><span>Available</span><span /></div>{catalog.isLoading ? <div className="simple-empty">Loading items…</div> : catalog.data?.products.map(product => <div className="simple-item-row" key={product.id}><strong>{product.name}</strong><span>{money(product.salePriceCents ?? product.priceCents)}</span><span>{product.inStock ? "Yes" : "No"}</span><div><button title={`Edit ${product.name}`} onClick={() => setDraft({ id: product.id, name: product.name, price: String(product.priceCents / 100), salePrice: product.salePriceCents ? String(product.salePriceCents / 100) : "", inStock: product.inStock })}><Pencil size={15} /></button><button className="simple-delete" title={`Remove ${product.name}`} onClick={() => { if (window.confirm(`Remove “${product.name}”?`)) remove.mutate({ id: product.id }); }}><Trash2 size={15} /></button></div></div>)}</section></main>{draft && <div className="simple-editor-backdrop"><form className="simple-editor" onSubmit={save}><button type="button" className="simple-close" onClick={() => setDraft(null)} aria-label="Close editor"><X size={19} /></button><p>STELLAR GEAR</p><h2>{draft.id ? "Edit item" : "Add item"}</h2><label>Item name<input required autoFocus value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>Price<input required type="number" min="0" step="0.01" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></label><label>Sale price <small>Optional</small><input type="number" min="0" step="0.01" value={draft.salePrice} onChange={event => setDraft({ ...draft, salePrice: event.target.value })} /></label><label className="simple-check"><input type="checkbox" checked={draft.inStock} onChange={event => setDraft({ ...draft, inStock: event.target.checked })} /> Available</label><button className="simple-primary" disabled={create.isPending || update.isPending}><Save size={15} /> Save item</button></form></div>}</div>;
}

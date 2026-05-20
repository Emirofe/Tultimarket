import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, EyeOff, Search, Loader2, Tag, X } from "lucide-react";
import {
  getProductosVendedorApi,
  createProductoVendedorApi,
  updateProductoVendedorApi,
  deleteProductoVendedorApi,
  getCategoriasApi,
  createDescuentoProductoApi,
  updateDescuentoProductoApi,
  removeDescuentoProductoApi,
  updateProductoCategoriasVendedorApi,
  type DescuentoPayload,
} from "../../api/api-client";
import { useStore } from "../../context/store-context";
import { toast } from "sonner";
import { toImageUrl } from "../../api/mappers";
import { CategoryPicker, type CategoryOption } from "../../components/category-picker";

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  sku: string;
}

interface SellerProduct {
  id: number;
  id_negocio: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock_total: number;
  sku: string | null;
  esta_activo?: boolean;
  fecha_registro: string;
  id_categoria?: number | null;
  imagen_principal?: string | null;
  id_descuento?: number | null;
  porcentaje_descuento?: number | null;
  codigo_cupon?: string | null;
  fecha_inicio_descuento?: string | null;
  fecha_fin_descuento?: string | null;
}

export function SellerProductsPage() {
  const { negocioId } = useStore();
  const [sellerProducts, setSellerProducts] = useState<SellerProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<ProductFormData>({ name: "", description: "", price: "", stock: "", category: "", sku: "" });
  const [imageUrl, setImageUrl] = useState("");
  const [dbCategories, setDbCategories] = useState<CategoryOption[]>([]);

  // ─── Descuento Modal ───
  const [discountProduct, setDiscountProduct] = useState<SellerProduct | null>(null);
  const [discountForm, setDiscountForm] = useState({ porcentaje: "", cupon: "", inicio: "", fin: "" });
  const [savingDiscount, setSavingDiscount] = useState(false);

  useEffect(() => {
    getCategoriasApi("producto")
      .then((cats) => setDbCategories(cats))
      .catch(() => setDbCategories([]));
  }, []);

  const loadProducts = async () => {
    if (!negocioId) return;
    setIsLoading(true);
    try { setSellerProducts(await getProductosVendedorApi(negocioId)); }
    catch { toast.error("Error al cargar productos"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (!negocioId) { setIsLoading(false); return; } loadProducts(); }, [negocioId]);

  const filtered = sellerProducts.filter((p) => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocioId) { toast.error("No tienes un negocio asociado."); return; }
    const imagenesUrls = imageUrl.trim() ? [imageUrl.trim()] : [];
    const catId = Number(formData.category);
    const categoriasIds = !isNaN(catId) && catId > 0 ? [catId] : [];
    if (categoriasIds.length === 0) { toast.error("Selecciona una categoria para el producto"); return; }
    try {
      if (editingId) {
        await updateProductoVendedorApi(editingId, { nombre: formData.name, descripcion: formData.description || undefined, precio: parseFloat(formData.price), sku: formData.sku.trim() || undefined, stock_total: formData.stock ? parseInt(formData.stock) : undefined, imagenes: imagenesUrls.length > 0 ? imagenesUrls : undefined });
        if (categoriasIds.length > 0) await updateProductoCategoriasVendedorApi(editingId, categoriasIds);
        toast.success("Producto actualizado");
      } else {
        const result: any = await createProductoVendedorApi({ nombre: formData.name, descripcion: formData.description || undefined, precio: parseFloat(formData.price), id_negocio: negocioId, sku: formData.sku.trim() || undefined, stock_total: formData.stock ? parseInt(formData.stock) : 0, imagenes: imagenesUrls });
        if (categoriasIds.length > 0 && result?.id) await updateProductoCategoriasVendedorApi(result.id, categoriasIds);
        toast.success("Producto creado");
      }
      closeForm();
      await loadProducts();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Error al guardar producto"); }
  };

  const handleEdit = (p: SellerProduct) => { setEditingId(p.id); setFormData({ name: p.nombre, description: p.descripcion ?? "", price: String(p.precio), stock: String(p.stock_total), category: p.id_categoria ? String(p.id_categoria) : "", sku: p.sku ?? "" }); setImageUrl(p.imagen_principal || ""); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); setFormData({ name: "", description: "", price: "", stock: "", category: "", sku: "" }); setImageUrl(""); };

  const toggleActive = async (p: SellerProduct) => {
    if (!negocioId) return;
    try { await updateProductoVendedorApi(p.id, { nombre: p.nombre, descripcion: p.descripcion ?? undefined, precio: p.precio, esta_activo: !p.esta_activo }); toast.success(`Producto ${p.esta_activo ? "desactivado" : "activado"}`); await loadProducts(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Error al cambiar estado"); }
  };

  const handleDelete = async (p: SellerProduct) => {
    if (!negocioId) return;
    try { await deleteProductoVendedorApi(p.id); toast.success("Producto eliminado"); await loadProducts(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Error al eliminar"); }
  };

  // ─── Descuentos ───
  const openDiscountModal = (p: SellerProduct) => {
    setDiscountProduct(p);
    setDiscountForm({
      porcentaje: p.porcentaje_descuento ? String(p.porcentaje_descuento) : "",
      cupon: p.codigo_cupon || "",
      inicio: p.fecha_inicio_descuento ? new Date(p.fecha_inicio_descuento).toISOString().split("T")[0] : "",
      fin: p.fecha_fin_descuento ? new Date(p.fecha_fin_descuento).toISOString().split("T")[0] : "",
    });
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountProduct) return;
    const pct = Number(discountForm.porcentaje);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) { toast.error("Porcentaje debe ser entre 1 y 100"); return; }
    if (!discountForm.inicio || !discountForm.fin) { toast.error("Fechas obligatorias"); return; }
    if (discountForm.inicio >= discountForm.fin) { toast.error("La fecha inicio debe ser anterior a la fecha fin"); return; }
    setSavingDiscount(true);
    const payload: DescuentoPayload = { porcentaje_descuento: pct, fecha_inicio: discountForm.inicio, fecha_fin: discountForm.fin, codigo_cupon: discountForm.cupon.trim() || null };
    try {
      if (discountProduct.id_descuento) {
        await updateDescuentoProductoApi(discountProduct.id, discountProduct.id_descuento, payload);
        toast.success("Descuento actualizado");
      } else {
        await createDescuentoProductoApi(discountProduct.id, payload);
        toast.success("Descuento creado y asignado");
      }
      setDiscountProduct(null);
      await loadProducts();
    } catch (error: any) { toast.error(error.message || "Error al guardar descuento"); }
    finally { setSavingDiscount(false); }
  };

  const handleRemoveDiscount = async () => {
    if (!discountProduct?.id_descuento) return;
    setSavingDiscount(true);
    try {
      await removeDescuentoProductoApi(discountProduct.id, discountProduct.id_descuento);
      toast.success("Descuento removido");
      setDiscountProduct(null);
      await loadProducts();
    } catch (error: any) { toast.error(error.message || "Error al remover descuento"); }
    finally { setSavingDiscount(false); }
  };

  if (!negocioId) return (<div className="text-center py-20"><p className="text-muted-foreground" style={{ fontSize: 18 }}>No tienes un negocio vinculado a tu cuenta.</p><p className="text-muted-foreground mt-2" style={{ fontSize: 14 }}>Contacta al administrador para crear tu negocio.</p></div>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Mis Productos</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: "", description: "", price: "", stock: "", category: "", sku: "" }); setImageUrl(""); }} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors" style={{ fontSize: 14 }}><Plus size={18} /> Nuevo Producto</button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar mis productos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-white focus:border-primary outline-none" style={{ fontSize: 14 }} />
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>{editingId ? "Editar Producto" : "Nuevo Producto"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Nombre del producto</label><input value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} required /></div>
            <div className="sm:col-span-2"><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Descripcion</label><textarea value={formData.description} onChange={(e) => setFormData(p => ({...p, description: e.target.value}))} rows={3} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} /></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>SKU</label><input value={formData.sku} onChange={(e) => setFormData(p => ({...p, sku: e.target.value}))} placeholder="Ej: PROD-001" className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} /></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Precio (MXN)</label><input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(p => ({...p, price: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} required /></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Stock</label><input type="number" value={formData.stock} onChange={(e) => setFormData(p => ({...p, stock: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} required /></div>
            <CategoryPicker categories={dbCategories} value={formData.category} onChange={(category) => setFormData(p => ({...p, category}))} allowedType="producto" label="Categoria" required className="sm:col-span-2" />
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>URL de Imagen (opcional)</label><input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.jpg o /images/products/foto.jpg" className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} /></div>
            {imageUrl && (<div className="sm:col-span-2"><p className="text-muted-foreground mb-1" style={{ fontSize: 12 }}>Vista previa:</p><img src={toImageUrl(imageUrl)} alt="preview" className="h-24 rounded-lg object-cover border border-border" /></div>)}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="px-6 py-2.5 bg-primary text-white rounded-lg" style={{ fontSize: 14 }}>{editingId ? "Actualizar" : "Crear Producto"}</button>
              <button type="button" onClick={closeForm} className="px-6 py-2.5 border border-border rounded-lg" style={{ fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Producto</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Precio</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Stock</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Descuento</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Estado</th>
                  <th className="text-right px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground" style={{ fontSize: 14 }}>{searchQuery ? "No se encontraron productos" : "No tienes productos registrados"}</td></tr>
                ) : (
                  filtered.map((product) => (
                    <tr key={product.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <img src={toImageUrl(product.imagen_principal)} alt={product.nombre} className="h-11 w-11 rounded-lg object-cover border border-border bg-gray-50" />
                          <div className="min-w-0">
                            <span className="truncate max-w-[250px] block" style={{ fontSize: 14 }}>{product.nombre}</span>
                            <span className="truncate max-w-[250px] block text-muted-foreground" style={{ fontSize: 12 }}>{product.sku || "Sin SKU"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4" style={{ fontSize: 14 }}>${Number(product.precio).toFixed(2)}</td>
                      <td className="px-4 py-4"><span className={`px-2 py-1 rounded ${product.stock_total === 0 ? "bg-red-100 text-red-700" : product.stock_total < 10 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`} style={{ fontSize: 13 }}>{product.stock_total}</span></td>
                      <td className="px-4 py-4">
                        {product.id_descuento ? (
                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700" style={{ fontSize: 13 }}>
                            {product.porcentaje_descuento}%{product.codigo_cupon ? ` (${product.codigo_cupon})` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground" style={{ fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-4"><span className={`px-2 py-1 rounded ${product.esta_activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`} style={{ fontSize: 13 }}>{product.esta_activo ? "Activo" : "Inactivo"}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDiscountModal(product)} className="p-2 text-muted-foreground hover:text-emerald-600 rounded-lg hover:bg-emerald-50" title="Descuento"><Tag size={16} /></button>
                          <button onClick={() => handleEdit(product)} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5"><Edit size={16} /></button>
                          <button onClick={() => toggleActive(product)} className="p-2 text-muted-foreground hover:text-amber-600 rounded-lg hover:bg-amber-50">{product.esta_activo ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                          <button onClick={() => handleDelete(product)} className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modal Descuento ─── */}
      {discountProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDiscountProduct(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}><Tag size={20} className="text-emerald-600" /> Gestionar Descuento</h3>
              <button onClick={() => setDiscountProduct(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <p className="text-muted-foreground mb-4" style={{ fontSize: 13 }}>Producto: <span style={{ fontWeight: 600 }}>{discountProduct.nombre}</span></p>
            <p className="text-muted-foreground mb-4" style={{ fontSize: 12 }}>
              Si dejas el codigo vacio, el descuento se aplica automaticamente. Si escribes un codigo, el cliente debe usarlo en checkout.
            </p>
            <form onSubmit={handleSaveDiscount} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Porcentaje de descuento</label>
                <div className="relative"><input type="number" min="1" max="100" step="1" value={discountForm.porcentaje} onChange={(e) => setDiscountForm(p => ({...p, porcentaje: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none pr-10" style={{ fontSize: 14 }} required /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">%</span></div>
              </div>
              <div>
                <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Código de cupón <span className="text-xs">(opcional)</span></label>
                <input type="text" value={discountForm.cupon} onChange={(e) => setDiscountForm(p => ({...p, cupon: e.target.value.toUpperCase()}))} placeholder="Ej: PROMO20" className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none uppercase" style={{ fontSize: 14 }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Fecha inicio</label><input type="date" value={discountForm.inicio} onChange={(e) => setDiscountForm(p => ({...p, inicio: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none" style={{ fontSize: 14 }} required /></div>
                <div><label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Fecha fin</label><input type="date" value={discountForm.fin} onChange={(e) => setDiscountForm(p => ({...p, fin: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none" style={{ fontSize: 14 }} required /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingDiscount} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50" style={{ fontSize: 14, fontWeight: 600 }}>
                  {savingDiscount && <Loader2 size={16} className="animate-spin" />}
                  {discountProduct.id_descuento ? "Actualizar" : "Crear Descuento"}
                </button>
                {discountProduct.id_descuento && (
                  <button type="button" onClick={handleRemoveDiscount} disabled={savingDiscount} className="px-5 py-3 border-2 border-red-300 text-red-600 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50" style={{ fontSize: 14, fontWeight: 600 }}>Quitar</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

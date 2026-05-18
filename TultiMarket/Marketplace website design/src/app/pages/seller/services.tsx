import { useState, useEffect } from "react";
import { Link } from "react-router";
import { CalendarDays, Plus, Edit, Trash2, Eye, EyeOff, Search, Loader2, Tag, X } from "lucide-react";
import {
  getServiciosVendedorApi,
  createServicioVendedorApi,
  updateServicioVendedorApi,
  deleteServicioVendedorApi,
  getCategoriasApi,
  createDescuentoServicioApi,
  updateDescuentoServicioApi,
  removeDescuentoServicioApi,
  updateServicioCategoriasVendedorApi,
  type DescuentoPayload,
} from "../../api/api-client";
import { useStore } from "../../context/store-context";
import { toast } from "sonner";
import { toImageUrl } from "../../api/mappers";

interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration: string;
  category: string;
}

interface SellerService {
  id: number;
  id_negocio: number;
  nombre: string;
  descripcion: string | null;
  precio_base: number;
  duracion_minutos: number | null;
  calificacion: number | null;
  esta_activo: boolean;
  fecha_registro: string;
  id_categoria?: number | null;
  imagen_principal?: string | null;
  id_categoria?: number | null;
  id_descuento?: number | null;
  porcentaje_descuento?: number | null;
  codigo_cupon?: string | null;
  fecha_inicio_descuento?: string | null;
  fecha_fin_descuento?: string | null;
  horarios_disponibles?: number;
  proximo_horario?: string | null;
}

export function SellerServicesPage() {
  const { negocioId } = useStore();
  const [sellerServices, setSellerServices] = useState<SellerService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<ServiceFormData>({ name: "", description: "", price: "", duration: "", category: "" });
  const [imageUrl, setImageUrl] = useState("");
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; tipo?: string }[]>([]);

  // ─── Descuento Modal ───
  const [discountService, setDiscountService] = useState<SellerService | null>(null);
  const [discountForm, setDiscountForm] = useState({ porcentaje: "", cupon: "", inicio: "", fin: "" });
  const [savingDiscount, setSavingDiscount] = useState(false);

  useEffect(() => {
    getCategoriasApi()
      .then((cats) => { setDbCategories(cats); if (cats.length > 0 && !formData.category) setFormData((p) => ({ ...p, category: cats[0].id })); })
      .catch(() => setDbCategories([]));
  }, []);

  const loadServices = async () => {
    if (!negocioId) return;
    setIsLoading(true);
    try { setSellerServices(await getServiciosVendedorApi(negocioId)); }
    catch { toast.error("Error al cargar servicios"); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (!negocioId) { setIsLoading(false); return; } loadServices(); }, [negocioId]);

  const filtered = sellerServices.filter((s) => s.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

  const formatNextSchedule = (value?: string | null) => {
    if (!value) return null;
    return new Date(value).toLocaleString("es-MX", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocioId) { toast.error("No tienes un negocio asociado."); return; }
    const imagenesUrls = imageUrl.trim() ? [imageUrl.trim()] : [];
    const catId = Number(formData.category);
    const categoriasIds = !isNaN(catId) && catId > 0 ? [catId] : [];
    try {
      if (editingId) {
        await updateServicioVendedorApi(editingId, { nombre: formData.name, descripcion: formData.description || undefined, precio_base: parseFloat(formData.price), duracion_minutos: formData.duration ? parseInt(formData.duration) : undefined, imagenes: imagenesUrls.length > 0 ? imagenesUrls : undefined });
        if (categoriasIds.length > 0) await updateServicioCategoriasVendedorApi(editingId, categoriasIds);
        toast.success("Servicio actualizado");
      } else {
        const result: any = await createServicioVendedorApi({ nombre: formData.name, descripcion: formData.description || undefined, precio_base: parseFloat(formData.price), duracion_minutos: formData.duration ? parseInt(formData.duration) : undefined, id_negocio: negocioId, imagenes: imagenesUrls });
        if (categoriasIds.length > 0 && result?.id) await updateServicioCategoriasVendedorApi(result.id, categoriasIds);
        toast.success("Servicio creado");
      }
      closeForm();
      await loadServices();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Error al guardar servicio"); }
  };

  const handleEdit = (s: SellerService) => { setEditingId(s.id); setFormData({ name: s.nombre, description: s.descripcion ?? "", price: String(s.precio_base), duration: s.duracion_minutos ? String(s.duracion_minutos) : "", category: s.id_categoria ? String(s.id_categoria) : (dbCategories[0]?.id || "") }); setImageUrl(s.imagen_principal || ""); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); setFormData({ name: "", description: "", price: "", duration: "", category: dbCategories[0]?.id || "" }); setImageUrl(""); };

  const toggleActive = async (s: SellerService) => {
    if (!negocioId) return;
    try { await updateServicioVendedorApi(s.id, { nombre: s.nombre, descripcion: s.descripcion ?? undefined, precio_base: s.precio_base, duracion_minutos: s.duracion_minutos ?? undefined, esta_activo: !s.esta_activo }); toast.success(`Servicio ${s.esta_activo ? "desactivado" : "activado"}`); await loadServices(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Error al cambiar estado"); }
  };

  const handleDelete = async (s: SellerService) => {
    if (!negocioId) return;
    try { await deleteServicioVendedorApi(s.id); toast.success("Servicio eliminado"); await loadServices(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Error al eliminar"); }
  };

  // ─── Descuentos ───
  const openDiscountModal = (s: SellerService) => {
    setDiscountService(s);
    setDiscountForm({
      porcentaje: s.porcentaje_descuento ? String(s.porcentaje_descuento) : "",
      cupon: s.codigo_cupon || "",
      inicio: s.fecha_inicio_descuento ? new Date(s.fecha_inicio_descuento).toISOString().split("T")[0] : "",
      fin: s.fecha_fin_descuento ? new Date(s.fecha_fin_descuento).toISOString().split("T")[0] : "",
    });
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountService) return;
    const pct = Number(discountForm.porcentaje);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) { toast.error("Porcentaje debe ser entre 1 y 100"); return; }
    if (!discountForm.inicio || !discountForm.fin) { toast.error("Fechas obligatorias"); return; }
    if (discountForm.inicio >= discountForm.fin) { toast.error("La fecha inicio debe ser anterior a la fecha fin"); return; }
    setSavingDiscount(true);
    const payload: DescuentoPayload = { porcentaje_descuento: pct, fecha_inicio: discountForm.inicio, fecha_fin: discountForm.fin, codigo_cupon: discountForm.cupon.trim() || null };
    try {
      if (discountService.id_descuento) {
        await updateDescuentoServicioApi(discountService.id, discountService.id_descuento, payload);
        toast.success("Descuento actualizado");
      } else {
        await createDescuentoServicioApi(discountService.id, payload);
        toast.success("Descuento creado y asignado");
      }
      setDiscountService(null);
      await loadServices();
    } catch (error: any) { toast.error(error.message || "Error al guardar descuento"); }
    finally { setSavingDiscount(false); }
  };

  const handleRemoveDiscount = async () => {
    if (!discountService?.id_descuento) return;
    setSavingDiscount(true);
    try {
      await removeDescuentoServicioApi(discountService.id, discountService.id_descuento);
      toast.success("Descuento removido");
      setDiscountService(null);
      await loadServices();
    } catch (error: any) { toast.error(error.message || "Error al remover descuento"); }
    finally { setSavingDiscount(false); }
  };

  if (!negocioId) return (<div className="text-center py-20"><p className="text-muted-foreground" style={{ fontSize: 18 }}>No tienes un negocio vinculado a tu cuenta.</p></div>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Mis Servicios</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: "", description: "", price: "", duration: "", category: dbCategories[0]?.id || "" }); setImageUrl(""); }} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors" style={{ fontSize: 14 }}><Plus size={18} /> Nuevo Servicio</button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar mis servicios..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-white focus:border-primary outline-none" style={{ fontSize: 14 }} />
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>{editingId ? "Editar Servicio" : "Nuevo Servicio"}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Nombre del servicio</label><input value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} required /></div>
            <div className="sm:col-span-2"><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Descripcion</label><textarea value={formData.description} onChange={(e) => setFormData(p => ({...p, description: e.target.value}))} rows={3} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} /></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Precio Base (MXN)</label><input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData(p => ({...p, price: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} required /></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Duración (minutos)</label><input type="number" value={formData.duration} onChange={(e) => setFormData(p => ({...p, duration: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} placeholder="Ej: 60" /></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Categoría</label><select value={formData.category} onChange={(e) => setFormData(p => ({...p, category: e.target.value}))} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }}>{dbCategories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
            <div><label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>URL de Imagen (opcional)</label><input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://ejemplo.com/imagen.jpg o /images/products/foto.jpg" className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" style={{ fontSize: 14 }} /></div>
            {imageUrl && (<div className="sm:col-span-2"><p className="text-muted-foreground mb-1" style={{ fontSize: 12 }}>Vista previa:</p><img src={toImageUrl(imageUrl)} alt="preview" className="h-24 rounded-lg object-cover border border-border" /></div>)}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="px-6 py-2.5 bg-primary text-white rounded-lg" style={{ fontSize: 14 }}>{editingId ? "Actualizar" : "Crear Servicio"}</button>
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
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Servicio</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Precio Base</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Duración</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Agenda</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Descuento</th>
                  <th className="text-left px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Estado</th>
                  <th className="text-right px-4 py-3 text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground" style={{ fontSize: 14 }}>{searchQuery ? "No se encontraron servicios" : "No tienes servicios registrados"}</td></tr>
                ) : (
                  filtered.map((service) => (
                    <tr key={service.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <img src={toImageUrl(service.imagen_principal)} alt={service.nombre} className="h-11 w-11 rounded-lg object-cover border border-border bg-gray-50" />
                          <span className="truncate max-w-[250px] block" style={{ fontSize: 14 }}>{service.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4" style={{ fontSize: 14 }}>${Number(service.precio_base).toFixed(2)}</td>
                      <td className="px-4 py-4 text-muted-foreground" style={{ fontSize: 14 }}>{service.duracion_minutos ? `${service.duracion_minutos} min` : "—"}</td>
                      <td className="px-4 py-4">
                        <Link to={`/vendedor/agenda?servicio=${service.id}`} className="inline-flex flex-col gap-1 hover:text-primary">
                          <span className={`px-2 py-1 rounded w-fit ${(service.horarios_disponibles ?? 0) > 0 ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`} style={{ fontSize: 13 }}>
                            {(service.horarios_disponibles ?? 0) > 0 ? `${service.horarios_disponibles} horarios` : "Sin horarios"}
                          </span>
                          {formatNextSchedule(service.proximo_horario) && (
                            <span className="text-muted-foreground" style={{ fontSize: 12 }}>
                              Prox. {formatNextSchedule(service.proximo_horario)}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        {service.id_descuento ? (
                          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700" style={{ fontSize: 13 }}>
                            {service.porcentaje_descuento}%{service.codigo_cupon ? ` (${service.codigo_cupon})` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground" style={{ fontSize: 13 }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-4"><span className={`px-2 py-1 rounded ${service.esta_activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`} style={{ fontSize: 13 }}>{service.esta_activo ? "Activo" : "Inactivo"}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/vendedor/agenda?servicio=${service.id}`} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5" title="Agenda"><CalendarDays size={16} /></Link>
                          <button onClick={() => openDiscountModal(service)} className="p-2 text-muted-foreground hover:text-emerald-600 rounded-lg hover:bg-emerald-50" title="Descuento"><Tag size={16} /></button>
                          <button onClick={() => handleEdit(service)} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5"><Edit size={16} /></button>
                          <button onClick={() => toggleActive(service)} className="p-2 text-muted-foreground hover:text-amber-600 rounded-lg hover:bg-amber-50">{service.esta_activo ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                          <button onClick={() => handleDelete(service)} className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
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
      {discountService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDiscountService(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}><Tag size={20} className="text-emerald-600" /> Gestionar Descuento</h3>
              <button onClick={() => setDiscountService(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <p className="text-muted-foreground mb-4" style={{ fontSize: 13 }}>Servicio: <span style={{ fontWeight: 600 }}>{discountService.nombre}</span></p>
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
                  {discountService.id_descuento ? "Actualizar" : "Crear Descuento"}
                </button>
                {discountService.id_descuento && (
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

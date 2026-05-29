import { useState, useEffect, useMemo } from "react";
import {
  Plus, Edit, Trash2, AlertCircle, XCircle, Loader2, Tag, Search, X,
  ChevronRight, FolderTree, Check,
} from "lucide-react";
import {
  getCategoriasAdminApi, createCategoriaAdminApi, updateCategoriaAdminApi,
  deleteCategoriaAdminApi, getImpactoCategoriaAdminApi,
} from "../../api/api-client";
import {
  CategoryPicker, buildCategoryPath, type CategoryOption,
} from "../../components/category-picker";

/* ── tipos ── */
interface Categoria {
  id: number;
  nombre_categoria: string;
  tipo: "producto" | "servicio" | "ambos";
  id_padre: number | null;
}

type CatOption = CategoryOption;

function toCatOption(c: Categoria): CatOption {
  return { id: String(c.id), name: c.nombre_categoria, tipo: c.tipo, id_padre: c.id_padre != null ? String(c.id_padre) : null };
}

/* ── helpers visuales ── */
const tipoLabel = (t: string) => t === "producto" ? "Producto" : t === "servicio" ? "Servicio" : t === "ambos" ? "Ambos" : t;
const tipoBg = (t: string) => t === "producto" ? "#dbeafe" : t === "servicio" ? "#ede9fe" : "#fef3c7";
const tipoFg = (t: string) => t === "producto" ? "#1d4ed8" : t === "servicio" ? "#6d28d9" : "#b45309";

/* ── componente principal ── */
export function AdminCategoriesPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({ nombre_categoria: "", tipo: "producto" as "producto" | "servicio" | "ambos", id_padre: "" });
  const [saving, setSaving] = useState(false);
  const [valErrors, setValErrors] = useState<Record<string, string>>({});

  // búsqueda
  const [search, setSearch] = useState("");

  // selección de niveles (para la vista de árbol)
  const [selectedL1, setSelectedL1] = useState("");
  const [selectedL2, setSelectedL2] = useState("");

  // diálogo de eliminación
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<{ subcategorias: number; productos_afectados: number; servicios_afectados: number } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --- datos derivados ---
  const catOptions = useMemo(() => categorias.map(toCatOption), [categorias]);

  const byId = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, Categoria[]>();
    for (const c of categorias) {
      const key = c.id_padre != null ? String(c.id_padre) : "root";
      const arr = m.get(key) || [];
      arr.push(c);
      m.set(key, arr);
    }
    return m;
  }, [categorias]);

  const level1 = childrenByParent.get("root") || [];
  const level2 = selectedL1 ? (childrenByParent.get(selectedL1) || []) : [];
  const level3 = selectedL2 ? (childrenByParent.get(selectedL2) || []) : [];

  const countDescendants = useMemo(() => {
    const cache = new Map<number, number>();
    function count(id: number): number {
      if (cache.has(id)) return cache.get(id)!;
      const children = childrenByParent.get(String(id)) || [];
      let total = children.length;
      for (const ch of children) total += count(ch.id);
      cache.set(id, total);
      return total;
    }
    return count;
  }, [childrenByParent]);

  // búsqueda
  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return categorias
      .filter(c => {
        const path = buildCategoryPath(String(c.id), catOptions).toLowerCase();
        return path.includes(normalizedSearch) || c.tipo.includes(normalizedSearch);
      })
      .slice(0, 20);
  }, [categorias, catOptions, normalizedSearch]);

  // --- carga ---
  useEffect(() => { loadCategorias(); }, []);

  const loadCategorias = async () => {
    try {
      setLoading(true);
      const r = await getCategoriasAdminApi();
      setCategorias(r.categorias as Categoria[]);
      setError(null);
    } catch { setError("Error al cargar categorías"); }
    finally { setLoading(false); }
  };

  // --- form ---
  const validateForm = () => {
    const e: Record<string, string> = {};
    const n = formData.nombre_categoria.trim();
    if (!n) e.nombre_categoria = "El nombre es requerido";
    else if (n.length < 2) e.nombre_categoria = "Mínimo 2 caracteres";
    else if (n.length > 120) e.nombre_categoria = "Máximo 120 caracteres";
    const dup = categorias.find(c => c.nombre_categoria.toLowerCase() === n.toLowerCase() && c.tipo === formData.tipo && c.id !== editingCat?.id);
    if (dup) e.nombre_categoria = "Ya existe una categoría con este nombre y tipo";
    setValErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateForm()) return;
    try {
      setSaving(true);
      const parentId = formData.id_padre ? Number(formData.id_padre) : null;
      if (editingCat) {
        await updateCategoriaAdminApi(editingCat.id, { nombre_categoria: formData.nombre_categoria.trim(), tipo: formData.tipo });
      } else {
        await createCategoriaAdminApi({ nombre_categoria: formData.nombre_categoria.trim(), tipo: formData.tipo, id_padre: parentId });
      }
      resetForm();
      await loadCategorias();
    } catch (err: any) { setError(err.message || "Error al guardar"); }
    finally { setSaving(false); }
  };

  const startEdit = (cat: Categoria) => {
    setEditingCat(cat);
    setFormData({ nombre_categoria: cat.nombre_categoria, tipo: cat.tipo, id_padre: cat.id_padre != null ? String(cat.id_padre) : "" });
    setShowForm(true);
    setValErrors({});
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCat(null);
    setFormData({ nombre_categoria: "", tipo: "producto", id_padre: "" });
    setValErrors({});
  };

  // --- eliminar con impacto ---
  const startDelete = async (cat: Categoria) => {
    setDeleteTarget(cat);
    setDeleteImpact(null);
    setLoadingImpact(true);
    try {
      const impact = await getImpactoCategoriaAdminApi(cat.id);
      setDeleteImpact(impact);
    } catch { setDeleteImpact({ subcategorias: 0, productos_afectados: 0, servicios_afectados: 0 }); }
    finally { setLoadingImpact(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteCategoriaAdminApi(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteImpact(null);
      // limpiar selecciones si se eliminó la categoría seleccionada
      if (selectedL1 === String(deleteTarget.id)) { setSelectedL1(""); setSelectedL2(""); }
      if (selectedL2 === String(deleteTarget.id)) setSelectedL2("");
      await loadCategorias();
    } catch (err: any) { setError(err.message || "Error al eliminar"); }
    finally { setDeleting(false); }
  };

  const cancelDelete = () => { setDeleteTarget(null); setDeleteImpact(null); };

  // --- render helpers ---
  const TipoBadge = ({ tipo }: { tipo: string }) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: tipoBg(tipo), color: tipoFg(tipo), whiteSpace: "nowrap" }}>
      {tipoLabel(tipo)}
    </span>
  );

  const ActionBtns = ({ cat }: { cat: Categoria }) => (
    <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
      <button onClick={(e) => { e.stopPropagation(); startEdit(cat); }} title="Editar" style={{ padding: 5, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#2563eb", e.currentTarget.style.background = "#f1f5f9")}
        onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8", e.currentTarget.style.background = "transparent")}>
        <Edit size={14} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); startDelete(cat); }} title="Eliminar" style={{ padding: 5, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#ef4444", e.currentTarget.style.background = "#fef2f2")}
        onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8", e.currentTarget.style.background = "transparent")}>
        <Trash2 size={14} />
      </button>
    </span>
  );

  const CatRow = ({ cat, selected, onSelect }: { cat: Categoria; selected?: boolean; onSelect?: () => void }) => {
    const desc = countDescendants(cat.id);
    return (
      <div
        onClick={onSelect}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          padding: "8px 10px", borderRadius: 10, cursor: onSelect ? "pointer" : "default",
          background: selected ? "rgba(37,99,235,0.08)" : "transparent",
          border: selected ? "1.5px solid #2563eb" : "1.5px solid transparent",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#f8fafc"; }}
        onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: selected ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.nombre_categoria}</span>
            <TipoBadge tipo={cat.tipo} />
          </div>
          {desc > 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>{desc} subcategoría{desc !== 1 ? "s" : ""}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <ActionBtns cat={cat} />
          {onSelect && <ChevronRight size={14} style={{ color: "#cbd5e1", flexShrink: 0 }} />}
        </div>
      </div>
    );
  };

  // --- loading ---
  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-primary" size={36} /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Gestión de Categorías</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>Administra las categorías de productos y servicios del marketplace.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} /> Nueva Categoría
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200" style={{ fontSize: 14 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><XCircle size={16} /></button>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{editingCat ? "Editar Categoría" : "Nueva Categoría"}</h3>
          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>Nombre de la categoría</label>
            <input type="text" value={formData.nombre_categoria} onChange={e => setFormData({ ...formData, nombre_categoria: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary" placeholder="Ej: Decoración para bodas" style={{ fontSize: 14 }} />
            {valErrors.nombre_categoria && <p className="text-red-500 mt-1" style={{ fontSize: 12 }}>{valErrors.nombre_categoria}</p>}
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>Tipo</label>
            <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary" style={{ fontSize: 14 }}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          {/* Selector de padre solo al crear */}
          {!editingCat && (
            <CategoryPicker categories={catOptions} value={formData.id_padre} onChange={v => setFormData({ ...formData, id_padre: v })}
              allowedType={formData.tipo} label="Categoría padre (opcional)" allowClear clearLabel="Crear como categoría raíz" />
          )}
          {editingCat && editingCat.id_padre != null && (
            <div style={{ fontSize: 13, color: "#64748b" }}>
              <span style={{ fontWeight: 500 }}>Ubicación: </span>{buildCategoryPath(String(editingCat.id), catOptions)}
            </div>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg disabled:opacity-50" style={{ fontSize: 14, fontWeight: 600 }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando..." : editingCat ? "Actualizar" : "Crear"}
            </button>
            <button type="button" onClick={resetForm} className="px-6 py-2.5 border border-border rounded-lg" style={{ fontSize: 14 }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Buscador */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoría por nombre, tipo o ruta..."
              className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary" style={{ fontSize: 14 }} />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"><X size={15} /></button>
            )}
          </div>
        </div>

        {/* Resultados de búsqueda */}
        {normalizedSearch ? (
          <div>
            <div className="px-4 py-2 border-b border-border" style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
              {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
            </div>
            {searchResults.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground" style={{ fontSize: 14 }}>No se encontraron categorías</p>
            ) : (
              <div className="divide-y divide-border">
                {searchResults.map(cat => (
                  <div key={cat.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.nombre_categoria}</span>
                        <TipoBadge tipo={cat.tipo} />
                      </div>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{buildCategoryPath(String(cat.id), catOptions)}</span>
                    </div>
                    <ActionBtns cat={cat} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Vista jerárquica de 3 columnas */
          <>
            <div className="p-4 border-b border-border flex items-center gap-2">
              <FolderTree size={16} className="text-primary" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{categorias.length} categoría{categorias.length !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>· {level1.length} raíz</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", minHeight: 340 }}>
              {/* Nivel 1 */}
              <div style={{ borderRight: "1px solid #e5e7eb", padding: 12, display: "flex", flexDirection: "column" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Nivel 1</p>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 420, display: "flex", flexDirection: "column", gap: 2 }}>
                  {level1.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingTop: 32 }}>Sin categorías raíz</p>
                  ) : level1.map(cat => (
                    <CatRow key={cat.id} cat={cat} selected={selectedL1 === String(cat.id)}
                      onSelect={() => { setSelectedL1(prev => prev === String(cat.id) ? "" : String(cat.id)); setSelectedL2(""); }} />
                  ))}
                </div>
              </div>

              {/* Nivel 2 */}
              <div style={{ borderRight: "1px solid #e5e7eb", padding: 12, display: "flex", flexDirection: "column" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Nivel 2</p>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 420, display: "flex", flexDirection: "column", gap: 2 }}>
                  {!selectedL1 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingTop: 32 }}>Selecciona un nivel 1</p>
                  ) : level2.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingTop: 32 }}>Sin subcategorías</p>
                  ) : level2.map(cat => (
                    <CatRow key={cat.id} cat={cat} selected={selectedL2 === String(cat.id)}
                      onSelect={() => setSelectedL2(prev => prev === String(cat.id) ? "" : String(cat.id))} />
                  ))}
                </div>
              </div>

              {/* Nivel 3 */}
              <div style={{ padding: 12, display: "flex", flexDirection: "column" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#b45309", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Nivel 3</p>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 420, display: "flex", flexDirection: "column", gap: 2 }}>
                  {!selectedL2 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingTop: 32 }}>Selecciona un nivel 2</p>
                  ) : level3.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", paddingTop: 32 }}>Sin subcategorías</p>
                  ) : level3.map(cat => (
                    <CatRow key={cat.id} cat={cat} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} onClick={cancelDelete} />
          <div style={{ position: "relative", background: "white", borderRadius: 16, padding: 24, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={20} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Eliminar categoría</h3>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{deleteTarget.nombre_categoria}</p>
              </div>
            </div>

            {loadingImpact ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 20 }}><Loader2 size={24} className="animate-spin text-primary" /></div>
            ) : deleteImpact && (
              <div style={{ background: "#fef2f2", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13 }}>
                {deleteImpact.subcategorias > 0 && (
                  <p style={{ margin: "0 0 4px", color: "#b91c1c" }}>
                    <strong>{deleteImpact.subcategorias}</strong> subcategoría{deleteImpact.subcategorias !== 1 ? "s" : ""} también {deleteImpact.subcategorias !== 1 ? "serán eliminadas" : "será eliminada"}.
                  </p>
                )}
                {deleteImpact.productos_afectados > 0 && (
                  <p style={{ margin: "0 0 4px", color: "#b91c1c" }}>
                    <strong>{deleteImpact.productos_afectados}</strong> producto{deleteImpact.productos_afectados !== 1 ? "s" : ""} perderá{deleteImpact.productos_afectados !== 1 ? "n" : ""} esta categoría.
                  </p>
                )}
                {deleteImpact.servicios_afectados > 0 && (
                  <p style={{ margin: 0, color: "#b91c1c" }}>
                    <strong>{deleteImpact.servicios_afectados}</strong> servicio{deleteImpact.servicios_afectados !== 1 ? "s" : ""} perderá{deleteImpact.servicios_afectados !== 1 ? "n" : ""} esta categoría.
                  </p>
                )}
                {deleteImpact.subcategorias === 0 && deleteImpact.productos_afectados === 0 && deleteImpact.servicios_afectados === 0 && (
                  <p style={{ margin: 0, color: "#64748b" }}>Esta categoría no tiene subcategorías ni productos/servicios asociados.</p>
                )}
              </div>
            )}

            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Esta acción no se puede deshacer. ¿Deseas continuar?
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={cancelDelete} disabled={deleting}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting || loadingImpact}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#ef4444", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle, Loader2, Tag } from "lucide-react";
import { getCategoriasAdminApi, createCategoriaAdminApi, updateCategoriaAdminApi, deleteCategoriaAdminApi } from "../../api/api-client";

interface Categoria {
  id: number;
  nombre_categoria: string;
  tipo: "producto" | "servicio" | "ambos";
}

export function AdminCategoriesPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({
    nombre_categoria: "",
    tipo: "producto" as "producto" | "servicio" | "ambos",
  });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      setLoading(true);
      const response = await getCategoriasAdminApi();
      setCategorias(response.categorias as Categoria[]);
      setError(null);
    } catch (err) {
      setError("Error al cargar categorías");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.nombre_categoria.trim()) {
      errors.nombre_categoria = "El nombre de la categoría es requerido";
    } else if (formData.nombre_categoria.trim().length < 2) {
      errors.nombre_categoria = "El nombre debe tener al menos 2 caracteres";
    } else if (formData.nombre_categoria.trim().length > 120) {
      errors.nombre_categoria = "El nombre no puede exceder 120 caracteres";
    }

    // Verificar unicidad
    const existing = categorias.find(
      (cat) =>
        cat.nombre_categoria.toLowerCase() === formData.nombre_categoria.trim().toLowerCase() &&
        cat.tipo === formData.tipo &&
        cat.id !== editingCategoria?.id
    );
    if (existing) {
      errors.nombre_categoria = "Ya existe una categoría con este nombre y tipo";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);
      const data = {
        nombre_categoria: formData.nombre_categoria.trim(),
        tipo: formData.tipo,
      };

      if (editingCategoria) {
        await updateCategoriaAdminApi(editingCategoria.id, data);
      } else {
        await createCategoriaAdminApi(data);
      }

      resetForm();
      await loadCategorias();
    } catch (err: any) {
      setError(err.message || "Error al guardar la categoría");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estas seguro de eliminar esta categoría?")) return;

    try {
      await deleteCategoriaAdminApi(id);
      await loadCategorias();
    } catch (err: any) {
      setError(err.message || "Error al eliminar la categoría");
    }
  };

  const startEdit = (cat: Categoria) => {
    setEditingCategoria(cat);
    setFormData({
      nombre_categoria: cat.nombre_categoria,
      tipo: cat.tipo,
    });
    setShowForm(true);
    setValidationErrors({});
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCategoria(null);
    setFormData({ nombre_categoria: "", tipo: "producto" });
    setValidationErrors({});
  };

  const tipoLabel = (tipo: string) => {
    switch (tipo) {
      case "producto": return "Producto";
      case "servicio": return "Servicio";
      case "ambos": return "Ambos";
      default: return tipo;
    }
  };

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case "producto": return "bg-blue-100 text-blue-700";
      case "servicio": return "bg-purple-100 text-purple-700";
      case "ambos": return "bg-amber-100 text-amber-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Gestión de Categorías</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>
            Administra las categorías de productos y servicios del marketplace.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          <Plus size={16} /> Nueva Categoría
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200" style={{ fontSize: 14 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>
            {editingCategoria ? "Editar Categoría" : "Nueva Categoría"}
          </h3>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>
              Nombre de la categoria
            </label>
            <input
              type="text"
              value={formData.nombre_categoria}
              onChange={(e) => setFormData({ ...formData, nombre_categoria: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
              placeholder="Ej: Decoracion para bodas"
              style={{ fontSize: 14 }}
            />
            {validationErrors.nombre_categoria && (
              <p className="text-red-500 mt-1" style={{ fontSize: 12 }}>{validationErrors.nombre_categoria}</p>
            )}
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>Tipo</label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
              style={{ fontSize: 14 }}
            >
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando..." : editingCategoria ? "Actualizar" : "Crear"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2.5 border border-border rounded-lg"
              style={{ fontSize: 14 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Tag size={16} className="text-primary" />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{categorias.length} categoria{categorias.length !== 1 ? "s" : ""}</span>
        </div>

        {categorias.length === 0 ? (
          <div className="text-center py-12">
            <Tag size={36} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground" style={{ fontSize: 14 }}>No hay categorias registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {categorias.map((cat) => (
              <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.nombre_categoria}</span>
                  <span className={`px-2 py-0.5 rounded-full ${tipoColor(cat.tipo)}`} style={{ fontSize: 11, fontWeight: 600 }}>
                    {tipoLabel(cat.tipo)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-muted-foreground hover:text-primary transition-colors"
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

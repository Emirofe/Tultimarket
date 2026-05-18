import { useState } from "react";
import { Plus, AlertCircle, Loader2, Tag, CheckCircle } from "lucide-react";
import { createCategoriaVendedorApi } from "../../api/api-client";

export function SellerCategoriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombre_categoria: "",
    descripcion: "",
    tipo: "producto" as "producto" | "servicio" | "ambos",
    id_padre: "" as string,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.nombre_categoria.trim()) {
      errors.nombre_categoria = "El nombre de la categoría es requerido";
    } else if (formData.nombre_categoria.trim().length < 2) {
      errors.nombre_categoria = "El nombre debe tener al menos 2 caracteres";
    } else if (formData.nombre_categoria.trim().length > 100) {
      errors.nombre_categoria = "El nombre no puede exceder 100 caracteres";
    }

    if (formData.descripcion && formData.descripcion.length > 500) {
      errors.descripcion = "La descripción no puede exceder 500 caracteres";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);
      const data: {
        nombre_categoria: string;
        tipo: string;
        descripcion?: string;
        id_padre?: number;
      } = {
        nombre_categoria: formData.nombre_categoria.trim(),
        tipo: formData.tipo,
      };

      if (formData.descripcion.trim()) {
        data.descripcion = formData.descripcion.trim();
      }

      if (formData.id_padre && Number(formData.id_padre) > 0) {
        data.id_padre = Number(formData.id_padre);
      }

      await createCategoriaVendedorApi(data);

      setSuccess(`Categoría "${formData.nombre_categoria.trim()}" creada exitosamente`);
      resetForm();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      if (err.message?.includes("ya existe")) {
        setValidationErrors({ nombre_categoria: "Ya existe una categoría con este nombre y tipo" });
      } else {
        setError(err.message || "Error al guardar la categoría");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setFormData({ nombre_categoria: "", descripcion: "", tipo: "producto", id_padre: "" });
    setValidationErrors({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Crear Categorias</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>
            Crea categorias nuevas para organizar tus productos o servicios.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <Plus size={16} /> Nueva Categoria
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200" style={{ fontSize: 14 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 text-green-700 border border-green-200" style={{ fontSize: 14 }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Nueva Categoria</h3>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>
              Nombre de la categoria *
            </label>
            <input
              type="text"
              value={formData.nombre_categoria}
              onChange={(e) => setFormData({ ...formData, nombre_categoria: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
              placeholder="Ej: Globos personalizados"
              style={{ fontSize: 14 }}
            />
            {validationErrors.nombre_categoria && (
              <p className="text-red-500 mt-1" style={{ fontSize: 12 }}>{validationErrors.nombre_categoria}</p>
            )}
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>Tipo *</label>
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

          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>
              Descripción (opcional)
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
              placeholder="Describe brevemente la categoría..."
              rows={3}
              style={{ fontSize: 14 }}
            />
            {validationErrors.descripcion && (
              <p className="text-red-500 mt-1" style={{ fontSize: 12 }}>{validationErrors.descripcion}</p>
            )}
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 500 }}>
              ID Categoría Padre (opcional)
            </label>
            <input
              type="number"
              value={formData.id_padre}
              onChange={(e) => setFormData({ ...formData, id_padre: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
              placeholder="Deja vacio si es categoria raiz"
              min={1}
              style={{ fontSize: 14 }}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Enviando..." : "Crear Categoria"}
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
      ) : (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <Tag size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="mb-2" style={{ fontSize: 18, fontWeight: 600 }}>Crea nuevas categorias</h3>
          <p className="text-muted-foreground mb-4" style={{ fontSize: 14 }}>
            Si no encuentras la categoria adecuada para tus productos o servicios, puedes crear una nueva.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <Plus size={16} /> Crear Categoria
          </button>
        </div>
      )}
    </div>
  );
}

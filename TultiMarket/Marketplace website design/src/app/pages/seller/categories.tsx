import { useEffect, useMemo, useState } from "react";
import { Plus, AlertCircle, Loader2, Tag, CheckCircle, Search } from "lucide-react";
import { createCategoriaVendedorApi, getCategoriasApi } from "../../api/api-client";
import {
  CategoryPicker,
  buildCategoryPath,
  categorySupportsType,
  getCategoryDepth,
  type CategoryOption,
} from "../../components/category-picker";

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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categorySearch, setCategorySearch] = useState("");

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      setCategories(await getCategoriasApi());
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (!formData.id_padre) return;
    const parent = categories.find((category) => category.id === formData.id_padre);
    if (!categorySupportsType(parent, formData.tipo)) {
      setFormData((current) => ({ ...current, id_padre: "" }));
    }
  }, [categories, formData.id_padre, formData.tipo]);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return [];
    return categories
      .filter((category) => {
        const path = buildCategoryPath(category.id, categories).toLowerCase();
        return path.includes(query) || String(category.tipo || "").toLowerCase().includes(query);
      })
      .slice(0, 40);
  }, [categories, categorySearch]);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.nombre_categoria.trim()) {
      errors.nombre_categoria = "El nombre de la categoria es requerido";
    } else if (formData.nombre_categoria.trim().length < 2) {
      errors.nombre_categoria = "El nombre debe tener al menos 2 caracteres";
    } else if (formData.nombre_categoria.trim().length > 100) {
      errors.nombre_categoria = "El nombre no puede exceder 100 caracteres";
    }

    if (formData.descripcion && formData.descripcion.length > 500) {
      errors.descripcion = "La descripcion no puede exceder 500 caracteres";
    }

    if (formData.id_padre) {
      const parent = categories.find((category) => category.id === formData.id_padre);
      if (!parent) {
        errors.id_padre = "Selecciona una categoria padre valida";
      } else if (!categorySupportsType(parent, formData.tipo)) {
        errors.id_padre = "La categoria padre no aplica para este tipo";
      } else if (getCategoryDepth(parent.id, categories) >= 3) {
        errors.id_padre = "Esta categoria ya esta en el nivel 3. Elige un nivel 1 o 2.";
      }
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

      const result = await createCategoriaVendedorApi(data);
      const created = result.categoria;

      if (created?.id) {
        const createdCategory: CategoryOption = {
          id: String(created.id),
          name: created.nombre_categoria,
          tipo: created.tipo,
          id_padre: created.id_padre != null ? String(created.id_padre) : null,
        };
        setCategories((current) =>
          [...current.filter((category) => category.id !== createdCategory.id), createdCategory].sort((a, b) =>
            a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          )
        );
      } else {
        await loadCategories();
      }

      setSuccess(`Categoria "${formData.nombre_categoria.trim()}" creada exitosamente`);
      resetForm();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      if (err.message?.includes("ya existe")) {
        setValidationErrors({ nombre_categoria: "Ya existe una categoria con este nombre y tipo" });
      } else {
        setError(err.message || "Error al guardar la categoria");
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

      <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}>
              <Search size={18} /> Buscar categoria
            </h2>
            <p className="text-muted-foreground" style={{ fontSize: 13 }}>
              Encuentra una categoria por nombre, tipo o ruta.
            </p>
          </div>
          <span className="text-muted-foreground" style={{ fontSize: 12 }}>
            {categories.length} categorias
          </span>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar categoria..."
            value={categorySearch}
            onChange={(event) => setCategorySearch(event.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-white focus:border-primary outline-none"
            style={{ fontSize: 14 }}
          />
        </div>

        {loadingCategories ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : categorySearch.trim() ? (
          <div className="border border-border rounded-xl overflow-hidden">
            {filteredCategories.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground" style={{ fontSize: 14 }}>
                No se encontraron categorias
              </p>
            ) : (
              filteredCategories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                      {category.name}
                    </p>
                    <p className="text-muted-foreground truncate" style={{ fontSize: 12 }}>
                      {buildCategoryPath(category.id, categories)}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded bg-gray-100 text-muted-foreground capitalize shrink-0" style={{ fontSize: 12 }}>
                    {category.tipo}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-8 px-4 text-center text-muted-foreground" style={{ fontSize: 14 }}>
            Escribe en el buscador para encontrar rapidamente una categoria.
          </div>
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
              Descripcion (opcional)
            </label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
              placeholder="Describe brevemente la categoria..."
              rows={3}
              style={{ fontSize: 14 }}
            />
            {validationErrors.descripcion && (
              <p className="text-red-500 mt-1" style={{ fontSize: 12 }}>{validationErrors.descripcion}</p>
            )}
          </div>

          <div>
            <CategoryPicker
              categories={categories}
              value={formData.id_padre}
              onChange={(id_padre) => setFormData({ ...formData, id_padre })}
              allowedType={formData.tipo}
              label="Categoria padre (opcional)"
              allowClear
              clearLabel="Crear como categoria raiz"
            />
            {validationErrors.id_padre && (
              <p className="text-red-500 mt-1" style={{ fontSize: 12 }}>{validationErrors.id_padre}</p>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
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

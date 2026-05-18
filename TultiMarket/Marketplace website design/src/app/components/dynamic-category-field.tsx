import { useMemo, useState } from "react";
import { Plus, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createCategoriaVendedorApi } from "../api/api-client";

interface CategoryOption {
  id: string;
  name: string;
  tipo?: string;
}

interface DynamicCategoryFieldProps {
  allowedType: "producto" | "servicio";
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  onCreated: (category: CategoryOption) => void;
}

export function DynamicCategoryField({
  allowedType,
  categories,
  value,
  onChange,
  onCreated,
}: DynamicCategoryFieldProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const normalizedName = name.trim().toLowerCase();
  const duplicated = useMemo(
    () => categories.some((category) => category.name.trim().toLowerCase() === normalizedName),
    [categories, normalizedName]
  );

  const hasMinLength = name.trim().length >= 3;
  const isNameValid = hasMinLength && !duplicated;

  const resetCreator = () => {
    setShowCreator(false);
    setName("");
    setDescription("");
    setIsSubmitting(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isNameValid) {
      toast.error(duplicated ? "La categoria ya existe" : "Usa al menos 3 caracteres");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCategoriaVendedorApi({
        nombre_categoria: name.trim(),
        descripcion: description.trim() || undefined,
        tipo: allowedType,
      });

      const created = {
        id: String(result.categoria.id),
        name: result.categoria.nombre_categoria,
        tipo: result.categoria.tipo,
      };

      onCreated(created);
      onChange(created.id);
      toast.success("Categoria creada correctamente");
      resetCreator();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la categoria";
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-gray-50 outline-none focus:border-primary"
          style={{ fontSize: 14 }}
        >
          <option value="">Selecciona una categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {!showCreator && (
          <button
            type="button"
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed border-primary text-primary hover:bg-primary/5 transition-colors"
            style={{ fontSize: 13, fontWeight: 500 }}
          >
            <Plus size={14} /> Crear
          </button>
        )}
      </div>

      {showCreator && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-xl border border-border p-4 space-y-3">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la nueva categoria"
              className="w-full px-3 py-2 rounded-lg border border-border bg-white outline-none focus:border-primary"
              style={{ fontSize: 14 }}
              autoFocus
            />
            {name.trim().length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {isNameValid ? (
                  <span className="text-green-600 flex items-center gap-1" style={{ fontSize: 12 }}>
                    <Check size={12} /> Nombre disponible
                  </span>
                ) : duplicated ? (
                  <span className="text-red-500 flex items-center gap-1" style={{ fontSize: 12 }}>
                    <AlertCircle size={12} /> Ya existe
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1" style={{ fontSize: 12 }}>
                    <AlertCircle size={12} /> Minimo 3 caracteres
                  </span>
                )}
              </div>
            )}
          </div>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-border bg-white outline-none focus:border-primary"
            style={{ fontSize: 14 }}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!isNameValid || isSubmitting}
              className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {isSubmitting ? "Creando..." : "Crear Categoria"}
            </button>
            <button
              type="button"
              onClick={resetCreator}
              className="px-4 py-2 border border-border rounded-lg"
              style={{ fontSize: 13 }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

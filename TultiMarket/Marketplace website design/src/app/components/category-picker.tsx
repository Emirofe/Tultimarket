import { useMemo, useState } from "react";
import { Check, ChevronRight, Search, X } from "lucide-react";

export type CategoryType = "producto" | "servicio" | "ambos";

export interface CategoryOption {
  id: string;
  name: string;
  tipo?: string;
  id_padre?: string | null;
}

export function categorySupportsType(category: CategoryOption | undefined, allowedType?: CategoryType) {
  if (!category || !allowedType) return true;
  const tipo = String(category.tipo || "").toLowerCase();
  if (allowedType === "ambos") return tipo === "ambos";
  return tipo === allowedType || tipo === "ambos";
}

export function buildCategoryPath(categoryId: string, categories: CategoryOption[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const trail: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    trail.unshift(current.name);
    current = current.id_padre ? byId.get(current.id_padre) : undefined;
  }

  return trail.join(" > ");
}

export function getCategoryDepth(categoryId: string, categories: CategoryOption[]) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const visited = new Set<string>();
  let depth = 0;
  let current = byId.get(categoryId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = current.id_padre ? byId.get(current.id_padre) : undefined;
  }

  return depth;
}

interface CategoryPickerProps {
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  allowedType?: CategoryType;
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  allowedType,
  label = "Categoria",
  placeholder = "Buscar categoria...",
  emptyLabel = "No hay categorias disponibles",
  required = false,
  allowClear = false,
  clearLabel = "Sin categoria padre",
  className = "",
}: CategoryPickerProps) {
  const [search, setSearch] = useState("");

  const availableCategories = useMemo(
    () =>
      categories
        .filter((category) => categorySupportsType(category, allowedType))
        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
    [categories, allowedType]
  );

  const availableIds = useMemo(
    () => new Set(availableCategories.map((category) => category.id)),
    [availableCategories]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    for (const category of availableCategories) {
      const parentId = category.id_padre && availableIds.has(category.id_padre) ? category.id_padre : "root";
      const children = map.get(parentId) || [];
      children.push(category);
      map.set(parentId, children);
    }
    return map;
  }, [availableCategories, availableIds]);

  const selectedTrail = useMemo(() => {
    const byId = new Map(availableCategories.map((category) => [category.id, category]));
    const trail: CategoryOption[] = [];
    const visited = new Set<string>();
    let current = value ? byId.get(value) : undefined;

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      trail.unshift(current);
      current = current.id_padre ? byId.get(current.id_padre) : undefined;
    }

    return trail;
  }, [availableCategories, value]);

  const selectedPath = value ? buildCategoryPath(value, categories) : "";
  const selectedRootId = selectedTrail[0]?.id || "";
  const selectedSecondId = selectedTrail[1]?.id || "";
  const firstLevel = childrenByParent.get("root") || [];
  const secondLevel = selectedRootId ? childrenByParent.get(selectedRootId) || [] : [];
  const thirdLevel = selectedSecondId ? childrenByParent.get(selectedSecondId) || [] : [];

  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return availableCategories
      .filter((category) => {
        const path = buildCategoryPath(category.id, categories).toLowerCase();
        const tipo = String(category.tipo || "").toLowerCase();
        return path.includes(normalizedSearch) || tipo.includes(normalizedSearch);
      })
      .slice(0, 12);
  }, [availableCategories, categories, normalizedSearch]);

  const renderCategoryButton = (category: CategoryOption) => {
    const selected = value === category.id;
    return (
      <button
        key={category.id}
        type="button"
        onClick={() => onChange(category.id)}
        className={`w-full min-h-[40px] px-3 py-2 rounded-lg border text-left transition-colors ${
          selected ? "border-primary bg-primary/10 text-primary" : "border-transparent hover:border-border hover:bg-white"
        }`}
        style={{ fontSize: 13 }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate" style={{ fontWeight: selected ? 700 : 600 }}>
              {category.name}
            </span>
            {category.tipo && (
              <span className="block text-muted-foreground capitalize" style={{ fontSize: 11 }}>
                {category.tipo}
              </span>
            )}
          </span>
          {selected ? <Check size={15} /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </span>
      </button>
    );
  };

  return (
    <div className={className}>
      {label && (
        <label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>
          {label}{required ? " *" : ""}
        </label>
      )}
      <div className="rounded-lg border border-border bg-gray-50 p-3 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-border bg-white outline-none focus:border-primary"
            style={{ fontSize: 14 }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar busqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {(value || allowClear) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white border border-border px-2.5 py-1 text-muted-foreground" style={{ fontSize: 12 }}>
              {selectedPath || clearLabel}
            </span>
            {allowClear && value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-primary hover:underline"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {clearLabel}
              </button>
            )}
          </div>
        )}

        {availableCategories.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center" style={{ fontSize: 13 }}>
            {emptyLabel}
          </p>
        ) : normalizedSearch ? (
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {searchResults.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center" style={{ fontSize: 13 }}>
                No se encontraron categorias
              </p>
            ) : (
              searchResults.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    onChange(category.id);
                    setSearch("");
                  }}
                  className={`w-full px-3 py-2 rounded-lg border text-left transition-colors ${
                    value === category.id ? "border-primary bg-primary/10" : "border-border bg-white hover:border-primary/40"
                  }`}
                  style={{ fontSize: 13 }}
                >
                  <span className="block" style={{ fontWeight: 600 }}>
                    {category.name}
                  </span>
                  <span className="block text-muted-foreground truncate" style={{ fontSize: 12 }}>
                    {buildCategoryPath(category.id, categories)}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <p className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 600 }}>Nivel 1</p>
              <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                {firstLevel.map(renderCategoryButton)}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 600 }}>Nivel 2</p>
              <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                {selectedRootId ? (
                  secondLevel.length > 0 ? secondLevel.map(renderCategoryButton) : (
                    <p className="text-muted-foreground py-3" style={{ fontSize: 12 }}>Sin subcategorias</p>
                  )
                ) : (
                  <p className="text-muted-foreground py-3" style={{ fontSize: 12 }}>Elige un nivel 1</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground" style={{ fontSize: 12, fontWeight: 600 }}>Nivel 3</p>
              <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                {selectedSecondId ? (
                  thirdLevel.length > 0 ? thirdLevel.map(renderCategoryButton) : (
                    <p className="text-muted-foreground py-3" style={{ fontSize: 12 }}>Sin subcategorias</p>
                  )
                ) : (
                  <p className="text-muted-foreground py-3" style={{ fontSize: 12 }}>Elige un nivel 2</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

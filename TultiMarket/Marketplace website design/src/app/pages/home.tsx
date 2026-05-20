import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X, Loader2, Sparkles } from "lucide-react";
import { type Product } from "../data/mock-data";
import {
  getCategoriasApi,
  getAllProductosApi,
  getProductosPorCategoriaApi,
  getServiciosPorCategoriaApi,
  getServiciosGlobalApi,
  getProductosConDescuentoApi,
  getServiciosConDescuentoApi,
} from "../api/api-client";
import { ProductCard } from "../components/product-card";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { iaService, type IAHomeCarousel } from "../services/ia-service";
import { useStore } from "../context/store-context";

const bannerImages = [
  {
    image: "https://images.pexels.com/photos/6207736/pexels-photo-6207736.jpeg",
    title: "Tu tienda en linea de confianza",
    subtitle: "Te daremos recomendaciones con base a tus necesidades",
  },
  {
    image: "https://images.pexels.com/photos/5804888/pexels-photo-5804888.jpeg",
    title: "Fiestas Inolvidables",
    subtitle: "Todo para tu celebracion en un solo lugar",
  },
  {
    image: "https://images.pexels.com/photos/6296918/pexels-photo-6296918.jpeg",
    title: "Nuevos productos para tu hogar",
    subtitle: "Descubre las ultimas tendencias en accesorios",
  },
];

type CatItem = { id: string; name: string; tipo: string; id_padre: string | null };
const DEFAULT_PRICE_RANGE: [number, number] = [0, 100000];

function mapSortToApi(sortBy: string, hasSearch: boolean) {
  if (sortBy === "precio-asc") return "precio_asc";
  if (sortBy === "precio-desc") return "precio_desc";
  if (sortBy === "nombre") return "nombre";
  if (sortBy === "rating") return "mejor_calificados";
  return hasSearch ? "relevancia" : "mejor_calificados";
}

function sortCatalogItems(items: Product[], sortBy: string) {
  const sorted = [...items];
  switch (sortBy) {
    case "precio-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "precio-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    case "nombre":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      sorted.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);
  }
  return sorted;
}

function uniqueCatalogItems(items: Product[]) {
  return Array.from(new Map(items.map((p) => [`${p.type}-${p.id}`, p])).values());
}

export function HomePage() {
  const [searchParams] = useSearchParams();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [sortBy, setSortBy] = useState("relevancia");
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // ─── IA Recomendador Home ───────────────────────────────────────────────────
  const { currentUser, isLoggedIn } = useStore();
  const [iaCarousels, setIaCarousels] = useState<IAHomeCarousel[]>([]);
  const [isLoadingIA, setIsLoadingIA] = useState(false);

  // ─── Estado de datos ──────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [discountedItems, setDiscountedItems] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<CatItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // ─── Selección de categoría jerárquica ─────────────────────────────────────
  const [selectedLevel1, setSelectedLevel1] = useState<string | null>(null);
  const [selectedLevel2, setSelectedLevel2] = useState<string | null>(null);
  const [selectedLevel3, setSelectedLevel3] = useState<string | null>(null);

  const searchFilter = searchParams.get("buscar");
  const catFromUrl = searchParams.get("cat");

  // ─── Sincronizar ?cat de la URL con la selección de nivel 1 ────────────────
  useEffect(() => {
    if (catFromUrl && catFromUrl !== selectedLevel1) {
      setSelectedLevel1(catFromUrl);
      setSelectedLevel2(null);
      setSelectedLevel3(null);
    } else if (!catFromUrl && selectedLevel1) {
      // URL limpia → limpiar selección
      setSelectedLevel1(null);
      setSelectedLevel2(null);
      setSelectedLevel3(null);
    }
  }, [catFromUrl]);

  // ─── Cargar TODAS las categorías del backend ──────────────────────────────
  useEffect(() => {
    setIsLoadingCategories(true);
    getCategoriasApi()
      .then((cats) => {
        const withIcons = cats.map((c) => ({
          ...c,
        }));
        setAllCategories(withIcons);
      })
      .catch(() => setAllCategories([]))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  useEffect(() => {
    Promise.all([
      getProductosConDescuentoApi().catch(() => []),
      getServiciosConDescuentoApi().catch(() => []),
    ])
      .then(([prods, servs]) => {
        const unique = uniqueCatalogItems([...prods, ...servs]);
        setDiscountedItems(sortCatalogItems(unique, "rating").slice(0, 4));
      })
      .catch(() => setDiscountedItems([]));
  }, []);

  // ─── Cargar recomendaciones IA del home cuando hay usuario logueado ────────
  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      setIaCarousels([]);
      return;
    }
    setIsLoadingIA(true);
    iaService
      .getHomeRecommendations(Number(currentUser.id), 5)
      .then((carousels) => setIaCarousels(carousels))
      .catch(() => setIaCarousels([]))
      .finally(() => setIsLoadingIA(false));
  }, [isLoggedIn, currentUser]);

  const iaRecommendations = useMemo(() => {
    const allProducts = iaCarousels.flatMap((c) => c.products);
    const uniqueProducts: Product[] = [];
    const seen = new Set<string>();
    for (const product of allProducts) {
      const key = `${product.type}-${product.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProducts.push(product);
      }
    }
    return uniqueProducts;
  }, [iaCarousels]);

  // ─── Derivar los 3 niveles de la jerarquía ─────────────────────────────────
  const rootCategories = useMemo(
    () => allCategories.filter((c) => c.id_padre === null),
    [allCategories]
  );
  const level2Categories = useMemo(
    () => (selectedLevel1 ? allCategories.filter((c) => c.id_padre === selectedLevel1) : []),
    [allCategories, selectedLevel1]
  );
  const level3Categories = useMemo(
    () => (selectedLevel2 ? allCategories.filter((c) => c.id_padre === selectedLevel2) : []),
    [allCategories, selectedLevel2]
  );

  // ─── Cargar productos según la categoría seleccionada ──────────────────────
  useEffect(() => {
    if (isLoadingCategories) return;

    setIsLoadingProducts(true);

    // Determinar qué categoría usar: la más específica seleccionada
    const activeCatId = selectedLevel3 ?? selectedLevel2 ?? selectedLevel1;
    const q = searchFilter?.trim() || undefined;
    const filtros = {
      q,
      precio_min: priceRange[0] > DEFAULT_PRICE_RANGE[0] ? priceRange[0] : undefined,
      precio_max: priceRange[1] < DEFAULT_PRICE_RANGE[1] ? priceRange[1] : undefined,
      calificacion_min: minRating > 0 ? minRating : undefined,
      ordenar: mapSortToApi(sortBy, Boolean(q)),
    };

    if (activeCatId) {
      const catId = Number(activeCatId);
      Promise.all([
        getProductosPorCategoriaApi(catId, filtros).catch(() => []),
        getServiciosPorCategoriaApi(catId, filtros).catch(() => []),
      ])
        .then(([prods, servs]) => {
          const unique = uniqueCatalogItems([...prods, ...servs]);
          setProducts(sortCatalogItems(unique, sortBy));
        })
        .finally(() => setIsLoadingProducts(false));
    } else {
      // Sin categoría seleccionada: cargar todos los productos
      Promise.all([
        getAllProductosApi(filtros).catch(() => []),
        getServiciosGlobalApi(filtros).catch(() => []),
      ])
        .then(([prods, servs]) => {
          const unique = uniqueCatalogItems([...prods, ...servs]);
          setProducts(sortCatalogItems(unique, sortBy));
        })
        .catch(() => setProducts([]))
        .finally(() => setIsLoadingProducts(false));
    }
  }, [selectedLevel1, selectedLevel2, selectedLevel3, isLoadingCategories, searchFilter, sortBy, priceRange, minRating]);

  // ─── Resultados ya filtrados por backend ──────────────────────────────────
  const filteredProducts = products;

  const topRated = useMemo(
    () => [...products].sort((a, b) => b.rating - a.rating).slice(0, 4),
    [products]
  );

  // ─── Nombre activo para el título ──────────────────────────────────────────
  const activeCatName = useMemo(() => {
    const id = selectedLevel3 ?? selectedLevel2 ?? selectedLevel1;
    if (!id) return null;
    return allCategories.find((c) => c.id === id)?.name ?? null;
  }, [selectedLevel1, selectedLevel2, selectedLevel3, allCategories]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Hero Banner */}
      {!selectedLevel1 && !searchFilter && (
        <section className="relative w-full h-[320px] md:h-[400px] overflow-hidden">
          {bannerImages.map((banner, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-700 ${idx === currentBanner ? "opacity-100" : "opacity-0"
                }`}
            >
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-7xl mx-auto px-4 w-full">
                  <h2
                    className="text-white max-w-lg"
                    style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {banner.title}
                  </h2>
                  <p className="text-white/80 mt-3 max-w-md" style={{ fontSize: 18 }}>
                    {banner.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => setCurrentBanner((prev) => (prev === 0 ? bannerImages.length - 1 : prev - 1))}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-800" />
          </button>
          <button
            onClick={() => setCurrentBanner((prev) => (prev === bannerImages.length - 1 ? 0 : prev + 1))}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md transition-colors"
          >
            <ChevronRight size={24} className="text-gray-800" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {bannerImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBanner(idx)}
                className={`w-3 h-3 rounded-full transition-colors ${idx === currentBanner ? "bg-amber-400" : "bg-white/50"
                  }`}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ CATEGORÍAS JERÁRQUICAS (3 barras cascadeantes) ═══════════ */}
      <section className="max-w-7xl mx-auto px-4 py-8 w-full">
        <h2 className="mb-4" style={{ fontSize: 22, fontWeight: 600 }}>
          Buscar por Categoría
        </h2>

        {isLoadingCategories ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : rootCategories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground" style={{ fontSize: 14 }}>
              No hay categorias registradas en la base de datos
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ── Barra Nivel 1: Categorías Raíz ─────────────────────────────── */}
            <CategoryBar
              items={rootCategories}
              selectedId={selectedLevel1}
              onSelect={(id) => {
                if (id === selectedLevel1) {
                  // Deseleccionar todo
                  setSelectedLevel1(null);
                  setSelectedLevel2(null);
                  setSelectedLevel3(null);
                } else {
                  setSelectedLevel1(id);
                  setSelectedLevel2(null);
                  setSelectedLevel3(null);
                }
              }}
              label={null}
            />

            {/* ── Barra Nivel 2: Subcategorías ───────────────────────────────── */}
            {selectedLevel1 && level2Categories.length > 0 && (
              <CategoryBar
                items={level2Categories}
                selectedId={selectedLevel2}
                onSelect={(id) => {
                  if (id === selectedLevel2) {
                    setSelectedLevel2(null);
                    setSelectedLevel3(null);
                  } else {
                    setSelectedLevel2(id);
                    setSelectedLevel3(null);
                  }
                }}
                label={rootCategories.find((c) => c.id === selectedLevel1)?.name ?? ""}
                onClear={() => { setSelectedLevel1(null); setSelectedLevel2(null); setSelectedLevel3(null); }}
              />
            )}

            {/* ── Barra Nivel 3: Sub-subcategorías ───────────────────────────── */}
            {selectedLevel2 && level3Categories.length > 0 && (
              <CategoryBar
                items={level3Categories}
                selectedId={selectedLevel3}
                onSelect={(id) => {
                  if (id === selectedLevel3) {
                    setSelectedLevel3(null);
                  } else {
                    setSelectedLevel3(id);
                  }
                }}
                label={level2Categories.find((c) => c.id === selectedLevel2)?.name ?? ""}
                onClear={() => { setSelectedLevel2(null); setSelectedLevel3(null); }}
              />
            )}
          </div>
        )}
      </section>

      {/* Ofertas y mejor calificados */}
      {!selectedLevel1 && !searchFilter && discountedItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-8 w-full">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600 }}>Ofertas</h2>
              <p className="text-muted-foreground" style={{ fontSize: 14 }}>
                Productos y servicios con descuentos activos
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {discountedItems.map((product) => (
              <ProductCard key={`${product.type}-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ RECOMENDACIONES IA PERSONALIZADAS (usuario logueado) ═══════════ */}
      {!selectedLevel1 && !searchFilter && isLoggedIn && iaRecommendations.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-8 w-full">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={20} className="text-amber-500" />
            <h2 style={{ fontSize: 22, fontWeight: 600 }}>
              Recomendado para ti
            </h2>
            <span
              className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: "#fef3c7", color: "#92400e" }}
            >
              IA
            </span>
          </div>
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>
          <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory no-scrollbar">
            {iaRecommendations.map((product) => (
              <div key={`${product.type}-${product.id}`} className="w-[280px] shrink-0 snap-start">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mejor Calificados (fallback cuando no hay IA o no está logueado) */}
      {!selectedLevel1 && !searchFilter && (!isLoggedIn || iaRecommendations.length === 0) && topRated.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-8 w-full">
          <h2 className="mb-6" style={{ fontSize: 22, fontWeight: 600 }}>
            Mejor Calificados
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topRated.map((product) => (
              <ProductCard key={`${product.type}-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Product Catalog */}
      <section className="max-w-7xl mx-auto px-4 pb-12 w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600 }}>
              {activeCatName
                ? activeCatName
                : searchFilter
                  ? `Resultados para "${searchFilter}"`
                  : "Productos y Servicios"}
            </h2>
            <p className="text-muted-foreground" style={{ fontSize: 14 }}>
              {filteredProducts.length} articulo{filteredProducts.length !== 1 ? "s" : ""} encontrado{filteredProducts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-white transition-colors"
              style={{ fontSize: 14 }}
            >
              <SlidersHorizontal size={16} />
              Filtros
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg bg-white outline-none"
              style={{ fontSize: 14 }}
            >
              <option value="relevancia">Relevancia</option>
              <option value="precio-asc">Precio: Menor a Mayor</option>
              <option value="precio-desc">Precio: Mayor a Menor</option>
              <option value="rating">Mejor Calificados</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border border-border rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Filtros</h3>
              <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block mb-2 text-muted-foreground" style={{ fontSize: 13 }}>
                  Rango de Precio
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    className="w-24 px-3 py-2 border border-border rounded-lg bg-input-background"
                    style={{ fontSize: 14 }}
                    placeholder="Min"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-24 px-3 py-2 border border-border rounded-lg bg-input-background"
                    style={{ fontSize: 14 }}
                    placeholder="Max"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-muted-foreground" style={{ fontSize: 13 }}>
                  Calificacion minima
                </label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background"
                  style={{ fontSize: 14 }}
                >
                  <option value={0}>Todas</option>
                  <option value={4}>4+ estrellas</option>
                  <option value={4.5}>4.5+ estrellas</option>
                  <option value={3}>3+ estrellas</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setPriceRange(DEFAULT_PRICE_RANGE);
                    setMinRating(0);
                    setSortBy("relevancia");
                  }}
                  className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                  style={{ fontSize: 14 }}
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoadingProducts ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground" style={{ fontSize: 18 }}>
              No hay productos o servicios en esta categoria
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={`${product.type}-${product.id}`} product={product} />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Componente auxiliar: Barra deslizante de categorías
// ═══════════════════════════════════════════════════════════════════════════════
function CategoryBar({
  items,
  selectedId,
  onSelect,
  label,
  onClear,
}: {
  items: CatItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  label: string | null;
  onClear?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      {/* Label + clear button */}
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-muted-foreground" style={{ fontSize: 13 }}>▸ {label}</span>
          {onClear && (
            <button
              onClick={onClear}
              className="text-red-500 hover:text-red-600 transition-colors"
              style={{ fontSize: 12 }}
              title="Limpiar selección"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Scroll left */}
        <button
          onClick={() => scroll("left")}
          className="flex-shrink-0 p-1.5 rounded-full bg-white border border-border hover:bg-gray-100 transition-colors shadow-sm"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </button>

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all flex-shrink-0 ${selectedId === cat.id
                ? "bg-primary text-white border-primary shadow-md scale-[1.02]"
                : "bg-white border-border text-gray-700 hover:border-primary/40 hover:shadow-sm"
                }`}
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Scroll right */}
        <button
          onClick={() => scroll("right")}
          className="flex-shrink-0 p-1.5 rounded-full bg-white border border-border hover:bg-gray-100 transition-colors shadow-sm"
        >
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      </div>
    </div>
  );
}

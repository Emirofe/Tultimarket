import { useEffect, useState } from "react";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { ContextualSearch } from "../components/contextual-search";
import { ProductCard } from "../components/product-card";
import { SlidersHorizontal, X } from "lucide-react";
import { type Product } from "../data/mock-data";
import { getAllProductosApi, getServiciosGlobalApi } from "../api/api-client";

interface ContextAnalysis {
  eventType: string;
  numberOfPeople: number | null;
  theme: string;
  relevantCategories: string[];
  budget: { min: number; max: number } | null;
}

const DEFAULT_PRICE_RANGE: [number, number] = [0, 100000];

export function SearchPage() {
  const [catalogItems, setCatalogItems] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [contextAnalysis, setContextAnalysis] = useState<ContextAnalysis | null>(null);
  const [sortBy, setSortBy] = useState("relevancia");
  const [priceRange, setPriceRange] = useState<[number, number]>(DEFAULT_PRICE_RANGE);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    Promise.all([
      getAllProductosApi().catch(() => []),
      getServiciosGlobalApi().catch(() => []),
    ])
      .then(([prods, servs]) => setCatalogItems([...prods, ...servs]))
      .catch(() => setCatalogItems([]));
  }, []);

  const handleResultsFound = (results: Product[], analysis: ContextAnalysis) => {
    setSearchResults(results);
    setContextAnalysis(analysis);
    setShowFilters(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Aplicar filtros adicionales a los resultados
  const filteredResults = searchResults
    .filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    )
    .filter((p) => (minRating > 0 ? p.rating >= minRating : true))
    .sort((a, b) => {
      switch (sortBy) {
        case "precio-asc":
          return a.price - b.price;
        case "precio-desc":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating;
        case "nombre":
          return a.name.localeCompare(b.name);
        default:
          return b.reviewCount - a.reviewCount;
      }
    });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Buscador Contextual */}
      <ContextualSearch onResultsFound={handleResultsFound} />

      {/* Resultados */}
      {searchResults.length > 0 && contextAnalysis && (
        <section className="py-8 px-4 max-w-7xl mx-auto w-full">
          {/* Resumen de análisis */}
          <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              Búsqueda Inteligente - Análisis Completado
            </h2>
            <p className="text-gray-700">
              Basado en tu búsqueda, detectamos: <strong>{contextAnalysis.eventType}</strong>
              {contextAnalysis.numberOfPeople && ` para ${contextAnalysis.numberOfPeople} personas`}
              {contextAnalysis.theme && ` con tema de ${contextAnalysis.theme}`}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Mostrando {filteredResults.length} productos y servicios recomendados de las categorías:{" "}
              <strong>{contextAnalysis.relevantCategories.join(", ")}</strong>
            </p>
          </div>

          {/* Controles de filtrado - Desktop y Mobile */}
          <div className="mb-6 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            {/* Botón toggle para mobile */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden w-full flex items-center justify-between px-4 py-2 mb-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                <span className="font-semibold text-gray-700">Filtros y Ordenamiento</span>
              </div>
              <span className="text-gray-500">
                {showFilters ? "▼" : "▶"}
              </span>
            </button>

            {/* Contenedor de filtros - visible en desktop, condicional en mobile */}
            <div className={`${showFilters ? "block" : "hidden"} md:block space-y-4`}>
              {/* Fila 1: Ordenamiento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ordenar por:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg outline-none focus:border-amber-400 transition-colors"
                >
                  <option value="relevancia">Relevancia</option>
                  <option value="precio-asc">Precio: Menor a Mayor</option>
                  <option value="precio-desc">Precio: Mayor a Menor</option>
                  <option value="rating">Mejor Calificación</option>
                  <option value="nombre">Nombre A-Z</option>
                </select>
              </div>

              {/* Fila 2: Rango de Precio */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rango de Precio
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="font-semibold text-gray-700">${priceRange[0]}</span>
                    <span className="text-gray-500">-</span>
                    <span className="font-semibold text-amber-600">${priceRange[1]}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={DEFAULT_PRICE_RANGE[1]}
                    step="500"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>$0</span>
                    <span className="flex-1"></span>
                    <span>${DEFAULT_PRICE_RANGE[1]}</span>
                  </div>
                </div>
              </div>

              {/* Fila 3: Calificación Mínima */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Calificación Mínima
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-600 text-lg">{minRating.toFixed(1)}</span>
                    <span className="text-yellow-400">★</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>0</span>
                    <span className="flex-1"></span>
                    <span>5</span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setMinRating(0);
                    setPriceRange(DEFAULT_PRICE_RANGE);
                    setSortBy("relevancia");
                  }}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Resetear Filtros
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 md:hidden px-3 py-2 bg-amber-400 hover:bg-amber-300 text-[#121E2B] rounded-lg font-semibold transition-colors"
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Indicador de filtros activos */}
          {(sortBy !== "relevancia" || minRating > 0 || priceRange[1] < DEFAULT_PRICE_RANGE[1]) && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  <strong>Filtros activos:</strong>{" "}
                  {sortBy !== "relevancia" && `Ordenado por ${sortBy}`}
                  {minRating > 0 && ` • Mín. ${minRating}⭐`}
                  {priceRange[1] < DEFAULT_PRICE_RANGE[1] && ` • Precio: hasta $${priceRange[1]}`}
                </span>
                <button
                  onClick={() => {
                    setMinRating(0);
                    setPriceRange(DEFAULT_PRICE_RANGE);
                    setSortBy("relevancia");
                  }}
                  className="text-xs px-2 py-1 bg-amber-200 hover:bg-amber-300 rounded transition-colors font-semibold"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {/* Grid de productos */}
          {filteredResults.length > 0 ? (
            <div>
              <div className="mb-4 text-sm text-gray-600">
                <strong>{filteredResults.length}</strong> de <strong>{searchResults.length}</strong> articulos encontrados
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredResults.map((product) => (
                  <ProductCard key={`${product.type}-${product.id}`} product={product} />
                ))}
              </div>
            </div>
          ) : (
            <div className="col-span-full text-center py-12 bg-gray-100 rounded-lg">
              <p className="text-gray-600 text-lg mb-3">
                No hay productos o servicios que coincidan con tus filtros
              </p>
              <p className="text-gray-500 text-sm mb-4">
                Intenta ajustar los filtros de precio, calificación u ordenamiento
              </p>
              <button
                onClick={() => {
                  setMinRating(0);
                  setPriceRange(DEFAULT_PRICE_RANGE);
                  setSortBy("relevancia");
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-[#121E2B] rounded-lg font-semibold transition-colors"
              >
                Resetear Filtros
              </button>
            </div>
          )}

          {/* Info de resultados */}
          {filteredResults.length > 0 && (
            <div className="mt-8 text-center text-gray-600">
              <p className="text-sm">
                Mostrando {filteredResults.length} de {searchResults.length} articulos encontrados
              </p>
            </div>
          )}
        </section>
      )}

      {/* Vista vacía */}
      {searchResults.length === 0 && (
        <section className="flex-1 flex flex-col items-center justify-center py-12 px-4">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Comienza una búsqueda inteligente
            </h2>
            <p className="text-gray-600 mb-4">
              Describe tu evento en lenguaje natural y nuestro sistema IA analizara tu solicitud para recomendarte productos y servicios.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

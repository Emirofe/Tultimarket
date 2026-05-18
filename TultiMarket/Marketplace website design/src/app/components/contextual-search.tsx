import { useState } from "react";
import { Search, Loader, Brain } from "lucide-react";
import { type Product } from "../data/mock-data";

interface ContextAnalysis {
  eventType: string;
  numberOfPeople: number | null;
  theme: string;
  relevantCategories: string[];
  budget: { min: number; max: number } | null;
}

export function ContextualSearch({
  catalog,
  onResultsFound,
}: {
  catalog: Product[];
  onResultsFound: (results: Product[], analysis: ContextAnalysis) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [analysis, setAnalysis] = useState<ContextAnalysis | null>(null);

  // Simular análisis de contexto en el frontend
  // En producción, esto sería un endpoint del backend
  const analyzeContext = (text: string): ContextAnalysis => {
    const textLower = text.toLowerCase();
    
    // Detectar tipo de evento - mejorado
    const eventKeywords = {
      fiesta: ["fiesta", "party", "celebración", "reunión"],
      boda: ["boda", "wedding", "matrimonio", "casamiento"],
      cumpleaños: ["cumpleaños", "birthday", "años", "edad"],
      navidad: ["navidad", "christmas", "año nuevo", "posada"],
      infantil: ["infantil", "niños", "kids", "bebés", "niño"],
      corporativo: ["corporativo", "empresa", "trabajo", "negocios", "conference"],
      graduacion: ["graduación", "graduacion", "graduation", "egreso"],
      halloween: ["halloween", "día de muertos"],
      "baby shower": ["baby shower", "baby", "embarazo"],
      "quince años": ["quince años", "quinceaño", "xv", "xv años"],
    };

    let eventType = "evento";
    let maxMatches = 0;
    
    Object.entries(eventKeywords).forEach(([key, keywords]) => {
      const matches = keywords.filter(kw => textLower.includes(kw)).length;
      if (matches > maxMatches) {
        eventType = key;
        maxMatches = matches;
      }
    });

    // Extraer número de personas con regex
    const peopleMatch = text.match(/(\d+)\s*(personas|niños|invitados|gente|people|guests)/i);
    const numberOfPeople = peopleMatch ? parseInt(peopleMatch[1]) : null;

    // Detectar tema/temática - mejorado
    let theme = "";
    
    // Patrón 1: "tema de X"
    const themeMatch1 = text.match(/tema\s+de\s+([^,.!]+)/i);
    if (themeMatch1) {
      theme = themeMatch1[1].trim();
    }
    
    // Patrón 2: "de X tema"
    const themeMatch2 = text.match(/de\s+([a-záéíóúñ\s]+)\s*tema/i);
    if (!theme && themeMatch2) {
      theme = themeMatch2[1].trim();
    }
    
    // Patrón 3: "estilo X"
    const styleMatch = text.match(/estilo\s+([^,.!]+)/i);
    if (!theme && styleMatch) {
      theme = styleMatch[1].trim();
    }
    
    // Patrón 4: Palabras temáticas directas
    const themeKeywords = ["superhéroes", "dinosaurios", "princesas", "piratas", "astronautas",
                          "animales", "flores", "tropical", "vintage", "elegant", "elegante",
                          "moderno", "futurista", "western", "mexican", "mexicano", "halloween"];
    
    if (!theme) {
      for (let keyword of themeKeywords) {
        if (textLower.includes(keyword)) {
          theme = keyword;
          break;
        }
      }
    }

    // Detectar presupuesto - mejorado
    let budget = null;
    
    // Patrón 1: "$500-$1000" o "$500 a $1000"
    const budgetRange = text.match(/\$?(\d+)\s*[-a]\s*\$?(\d+)/);
    if (budgetRange) {
      budget = {
        min: parseInt(budgetRange[1]),
        max: parseInt(budgetRange[2]),
      };
    }
    
    // Patrón 2: "presupuesto de $500"
    if (!budget) {
      const budgetMatch = text.match(/presupuesto\s+(?:de|máximo|max)?\s*\$?(\d+)/i);
      if (budgetMatch) {
        budget = {
          min: 0,
          max: parseInt(budgetMatch[1]),
        };
      }
    }
    
    // Patrón 3: "máximo $2000"
    if (!budget) {
      const maxMatch = text.match(/máximo\s+\$?(\d+)/i);
      if (maxMatch) {
        budget = {
          min: 0,
          max: parseInt(maxMatch[1]),
        };
      }
    }

    // Mapear a categorías de productos disponibles
    const categoryMapping: { [key: string]: string[] } = {
      fiesta: ["decoración", "globos", "dulces", "platos y vasos", "piñatas", "servilletas"],
      boda: ["decoración", "velas", "flores", "manteles", "servilletas", "globos"],
      infantil: ["decoración", "globos", "dulces", "piñatas", "juguetes", "platos y vasos"],
      navidad: ["decoración", "luces", "adornos", "velas", "globos"],
      corporativo: ["decoración", "manteles", "servilletas", "vasos", "platos"],
      graduacion: ["decoración", "sombreros", "globos", "diplomas", "piñatas"],
      cumpleaños: ["decoración", "globos", "dulces", "piñatas", "pastel", "velas"],
      halloween: ["decoración", "disfraces", "calabazas", "dulces", "velas"],
      "baby shower": ["decoración", "globos", "pañales", "ropa bebé", "velas"],
      evento: ["decoración", "globos", "dulces", "platos", "vasos", "servilletas"],
    };

    const relevantCategories = categoryMapping[eventType] || categoryMapping["evento"];

    return {
      eventType,
      numberOfPeople,
      theme,
      relevantCategories,
      budget,
    };
  };

  // Simular búsqueda en backend con análisis mejorado
  const getRecommendations = (analysis: ContextAnalysis): Product[] => {
    let results = [...catalog];

    console.log("Analizando contexto:", analysis);
    console.log("Categorías relevantes:", analysis.relevantCategories);

    // Filtrar por categorías relevantes - búsqueda más flexible
    results = results.filter((p) => {
      const productCategory = p.category.toLowerCase();
      return analysis.relevantCategories.some((cat) => {
        const catLower = cat.toLowerCase();
        // Búsqueda parcial: "decoración" coincide con "decoración temática"
        return (
          productCategory.includes(catLower) ||
          catLower.includes(productCategory) ||
          p.name.toLowerCase().includes(catLower) ||
          p.description.toLowerCase().includes(catLower)
        );
      });
    });

    console.log("Productos después de filtro de categoría:", results.length);

    // Filtrar por presupuesto si existe
    if (analysis.budget && analysis.budget.max > 0) {
      results = results.filter(
        (p) => p.price >= analysis.budget!.min && p.price <= analysis.budget!.max
      );
      console.log("Productos dentro del presupuesto:", results.length);
    }

    // Si hay tema, dar preferencia a productos que coincidan
    if (analysis.theme) {
      results.sort((a, b) => {
        const themeLower = analysis.theme.toLowerCase();
        const aMatch = a.name.toLowerCase().includes(themeLower) ||
                      a.description.toLowerCase().includes(themeLower) ? 1 : 0;
        const bMatch = b.name.toLowerCase().includes(themeLower) ||
                      b.description.toLowerCase().includes(themeLower) ? 1 : 0;
        return bMatch - aMatch;
      });
    }

    // Ordenar por rating
    results.sort((a, b) => b.rating - a.rating);

    // Si no hay resultados en categorías, retornar los más relevantes de todas formas
    if (results.length === 0) {
      results = [...catalog].sort((a, b) => b.rating - a.rating);
    }

    return results.slice(0, 12);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);

    // Simular latencia de backend
    setTimeout(() => {
      const contextAnalysis = analyzeContext(prompt);
      const recommendations = getRecommendations(contextAnalysis);

      setAnalysis(contextAnalysis);
      onResultsFound(recommendations, contextAnalysis);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="w-full bg-gradient-to-r from-[#1E2C3E] to-[#121E2B] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="text-amber-400" size={24} />
          <h2 className="text-white text-xl font-bold">Búsqueda Inteligente con IA</h2>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <textarea
              placeholder='Describe tu evento.'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-4 py-3 rounded-lg outline-none text-white bg-gray-800 placeholder-gray-400 resize-none h-24 focus:ring-2 focus:ring-amber-400 focus:bg-gray-700 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="absolute bottom-3 right-3 bg-amber-400 hover:bg-amber-300 disabled:bg-gray-400 text-[#121E2B] px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}
              {loading ? "Analizando..." : "Buscar"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors"
          >
            {showAdvanced ? "- Ocultar filtros avanzados" : "+ Filtros avanzados"}
          </button>
        </form>

        {/* Análisis mostrado */}
        {analysis && (
          <div className="mt-6 p-4 bg-white/10 backdrop-blur rounded-lg border border-amber-400/30">
            <h3 className="text-white font-semibold mb-3">Análisis detectado:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-white">
              <div className="bg-black/30 p-3 rounded">
                <span className="text-gray-300">Tipo de evento:</span>
                <p className="font-semibold text-amber-400 capitalize">{analysis.eventType}</p>
              </div>
              {analysis.numberOfPeople && (
                <div className="bg-black/30 p-3 rounded">
                  <span className="text-gray-300">Personas:</span>
                  <p className="font-semibold text-amber-400">{analysis.numberOfPeople}</p>
                </div>
              )}
              {analysis.theme && (
                <div className="bg-black/30 p-3 rounded">
                  <span className="text-gray-300">Tema:</span>
                  <p className="font-semibold text-amber-400 capitalize">{analysis.theme}</p>
                </div>
              )}
              {analysis.budget && (
                <div className="bg-black/30 p-3 rounded">
                  <span className="text-gray-300">Presupuesto:</span>
                  <p className="font-semibold text-amber-400">
                    ${analysis.budget.min} - ${analysis.budget.max}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

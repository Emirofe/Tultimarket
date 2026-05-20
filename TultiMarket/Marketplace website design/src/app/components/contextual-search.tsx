import { useState } from "react";
import { Search, Loader, Brain, AlertCircle } from "lucide-react";
import { iaService, type ContextAnalysis } from "../services/ia-service";
import type { Product } from "../data/mock-data";

export function ContextualSearch({
  onResultsFound,
}: {
  onResultsFound: (results: Product[], analysis: ContextAnalysis) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await iaService.getContextualRecommendations({
        prompt: prompt.trim(),
      });

      onResultsFound(response.recommendations, response.analysis);
    } catch (err) {
      console.error("Error buscando recomendaciones con IA:", err);
      setError(
        "No pudimos conectar con la IA. Revisa que el backend y el servicio Python esten encendidos."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-[#1E2C3E] to-[#121E2B] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="text-amber-400" size={24} />
          <h2 className="text-white text-xl font-bold">Busqueda Inteligente con IA</h2>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <textarea
              placeholder="Describe tu evento."
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
        </form>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

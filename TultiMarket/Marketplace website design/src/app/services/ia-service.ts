import type { Product } from "../data/mock-data";
import { toImageUrl } from "../api/mappers";

export interface ContextAnalysis {
  eventType: string;
  numberOfPeople: number | null;
  theme: string;
  relevantCategories: string[];
  budget: { min: number; max: number } | null;
}

interface RecommendationRequest {
  prompt: string;
}

interface RecommendationResponse {
  analysis: ContextAnalysis;
  recommendations: Product[];
  explanation: string;
  latencyMs: number;
}

interface IAApiItem {
  id?: string;
  item_id?: string;
  nombre: string;
  negocio?: string;
  nombre_negocio?: string;
  tipo: "producto" | "servicio";
  cantidad?: number;
  cantidad_sugerida?: number;
  razon?: string;
  razon_cantidad?: string;
  categoria_principal?: string;
  etiqueta?: string;
  precio_unitario: number;
  precio_final?: number;
  precio_total: number;
  calificacion: number;
  descuento_porcentaje?: number | null;
  imagen_principal: string | null;
  stock?: number | null;
}

interface IAApiSubcatalogo {
  nombre: string;
  presupuesto: number;
  items: IAApiItem[];
}

interface IAApiResponse {
  prompt_original: string;
  evento: string;
  personas: number;
  presupuesto_total: number;
  latencia_ms: number;
  subcatalogos: IAApiSubcatalogo[];
}

function mapIAResponseToRecommendations(data: IAApiResponse): RecommendationResponse {
  const recommendations = data.subcatalogos.flatMap((subcatalogo) =>
    subcatalogosItemsMap(subcatalogo, data.evento)
  );

  return {
    analysis: {
      eventType: data.evento || "evento",
      numberOfPeople: data.personas || null,
      theme: "",
      relevantCategories: data.subcatalogos.map((subcatalogo) => subcatalogo.nombre),
      budget: data.presupuesto_total
        ? { min: 0, max: Number(data.presupuesto_total) }
        : null,
    },
    recommendations,
    explanation: `La IA encontro ${recommendations.length} recomendaciones para tu evento.`,
    latencyMs: data.latencia_ms,
  };
}

function subcatalogosItemsMap(subcatalogo: IAApiSubcatalogo, evento: string): Product[] {
  return subcatalogo.items.map((item): Product => {
    const imageUrl = item.imagen_principal
      ? (item.imagen_principal.startsWith("http") ? item.imagen_principal : toImageUrl(item.imagen_principal))
      : toImageUrl(null);
    
    // ID limpio sin prefijo P- o S-
    const cleanId = (item.id || item.item_id || "").replace(/^[PS]-/, "");

    // Si es servicio, el stock es 99 para que no se muestre. Si es producto, usa stock real.
    const cleanStock = item.tipo === "servicio"
      ? 99
      : (item.stock !== undefined && item.stock !== null ? Number(item.stock) : Math.max(1, Number(item.cantidad || item.cantidad_sugerida) || 1));

    return {
      id: cleanId,
      name: item.nombre,
      description: item.razon || item.razon_cantidad || `Recomendado para ${evento || "tu evento"}.`,
      price: Number(item.precio_unitario) || 0,
      image: imageUrl,
      images: [imageUrl],
      category: subcatalogo.nombre || evento || "evento",
      rating: Number(item.calificacion) || 0,
      reviewCount: 0,
      stock: cleanStock,
      sellerId: item.negocio || item.nombre_negocio || "ia",
      sellerName: item.nombre_negocio || item.negocio || "Proveedor recomendado",
      reviews: [],
      type: item.tipo,
      status: "Aprobado",
    };
  });
}

export interface IAHomeCarousel {
  title: string;
  products: Product[];
}

class IAService {
  private apiBaseUrl = (
    import.meta.env.VITE_API_URL ||
    `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3000`
  ).replace(/\/$/, "");

  async getContextualRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/ia/sugerir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ prompt: request.prompt }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`);
      }

      const data = (await response.json()) as IAApiResponse;
      return mapIAResponseToRecommendations(data);
    } catch (error) {
      console.error("Error calling IA backend:", error);
      throw error;
    }
  }

  async getHomeRecommendations(userId: number, limite = 5): Promise<IAHomeCarousel[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/comprador/home/recomendaciones/${userId}?limite=${limite}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`);
      }

      const data = await response.json();
      const carruseles: IAHomeCarousel[] = (data.carruseles || []).map(
        (c: { nombre: string; items: IAApiItem[]; presupuesto_seccion: number }) => ({
          title: c.nombre,
          products: c.items.map((item: IAApiItem): Product => {
            const imageUrl = item.imagen_principal
              ? (item.imagen_principal.startsWith("http") ? item.imagen_principal : toImageUrl(item.imagen_principal))
              : toImageUrl(null);

            const cleanId = (item.item_id || item.id || "").replace(/^[PS]-/, "");
            const cleanStock = item.tipo === "servicio"
              ? 99
              : (item.stock !== undefined && item.stock !== null ? Number(item.stock) : 99);

            return {
              id: cleanId,
              name: item.nombre,
              description: item.razon_cantidad || item.razon || "",
              price: Number(item.precio_final ?? item.precio_unitario) || 0,
              originalPrice: Number(item.precio_unitario) || undefined,
              discountPercent: item.descuento_porcentaje !== undefined && item.descuento_porcentaje !== null ? Number(item.descuento_porcentaje) : undefined,
              image: imageUrl,
              images: [imageUrl],
              category: item.categoria_principal || "general",
              rating: Number(item.calificacion) || 0,
              reviewCount: 0,
              stock: cleanStock,
              sellerId: item.nombre_negocio || item.negocio || "ia",
              sellerName: item.nombre_negocio || item.negocio || "Proveedor",
              reviews: [],
              type: item.tipo,
              status: "Aprobado",
            };
          }),
        })
      );

      return carruseles;
    } catch (error) {
      console.error("Error fetching IA home recommendations:", error);
      return [];
    }
  }
}

export const iaService = new IAService();

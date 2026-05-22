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
  id?: string | number;
  item_id?: string | number;
  nombre?: string;
  name?: string;
  negocio?: string;
  nombre_negocio?: string;
  sellerName?: string;
  tipo?: "producto" | "servicio" | string;
  cantidad?: number | string;
  cantidad_sugerida?: number | string;
  razon?: string;
  razon_cantidad?: string;
  categoria_principal?: string;
  etiqueta?: string;
  precio?: number | string;
  price?: number | string;
  precio_unitario?: number | string;
  precio_final?: number | string;
  precio_total?: number | string;
  precio_original?: number | string;
  calificacion?: number | string;
  rating?: number | string;
  descuento_porcentaje?: number | string | null;
  imagen?: string | null;
  imagen_principal?: string | null;
  image?: string | null;
  stock?: number | string | null;
  duracion_minutos?: number | string | null;
}

interface IAApiSubcatalogo {
  nombre?: string;
  title?: string;
  categoria?: string;
  presupuesto?: number | string;
  presupuesto_seccion?: number | string;
  items?: IAApiItem[];
  productos?: IAApiItem[];
  servicios?: IAApiItem[];
  recommendations?: IAApiItem[];
}

interface IAApiResponse {
  prompt_original?: string;
  evento?: string;
  tipo_evento?: string;
  personas?: number | string;
  cantidad_personas?: number | string;
  presupuesto_total?: number | string;
  latencia_ms?: number | string;
  subcatalogos?: IAApiSubcatalogo[];
  carruseles?: IAApiSubcatalogo[];
  items?: IAApiItem[];
  productos?: IAApiItem[];
  servicios?: IAApiItem[];
  recomendaciones?: IAApiItem[];
  recommendations?: IAApiItem[];
  fallback?: boolean;
  analysis?: Partial<ContextAnalysis>;
}

function mapIAResponseToRecommendations(data: IAApiResponse): RecommendationResponse {
  const subcatalogos = extractSubcatalogos(data);
  const recommendations = subcatalogos.flatMap((subcatalogo, subcatalogoIndex) =>
    subcatalogosItemsMap(subcatalogo, data.evento || data.tipo_evento || "", subcatalogoIndex)
  );
  const relevantCategories = subcatalogos
    .map((subcatalogo) => getSubcatalogoName(subcatalogo))
    .filter(Boolean);
  const budgetMax = toNumber(data.presupuesto_total, 0);
  const people = toNumber(data.personas ?? data.cantidad_personas, 0);

  return {
    analysis: {
      eventType: data.analysis?.eventType || data.evento || data.tipo_evento || "evento",
      numberOfPeople: data.analysis?.numberOfPeople ?? (people > 0 ? people : null),
      theme: data.analysis?.theme || "",
      relevantCategories: data.analysis?.relevantCategories || relevantCategories,
      budget: data.analysis?.budget || (budgetMax > 0 ? { min: 0, max: budgetMax } : null),
    },
    recommendations,
    explanation: data.fallback
      ? `Mostrando ${recommendations.length} resultados relacionados mientras la IA no esta disponible.`
      : `La IA encontro ${recommendations.length} recomendaciones para tu evento.`,
    latencyMs: toNumber(data.latencia_ms, 0),
  };
}

function extractSubcatalogos(data: IAApiResponse): IAApiSubcatalogo[] {
  const sectionSource = data.subcatalogos ?? data.carruseles;
  if (Array.isArray(sectionSource)) return sectionSource;

  const flatItems =
    data.items ??
    data.recomendaciones ??
    data.recommendations ??
    data.productos ??
    data.servicios;

  return Array.isArray(flatItems)
    ? [{ nombre: "Recomendaciones", items: flatItems }]
    : [];
}

function getSubcatalogoName(subcatalogo: IAApiSubcatalogo): string {
  return subcatalogo.nombre || subcatalogo.title || subcatalogo.categoria || "Recomendaciones";
}

function getSubcatalogoItems(subcatalogo: IAApiSubcatalogo): IAApiItem[] {
  return (
    subcatalogo.items ??
    subcatalogo.productos ??
    subcatalogo.servicios ??
    subcatalogo.recommendations ??
    []
  );
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeItemType(value: unknown): "producto" | "servicio" {
  return String(value || "").toLowerCase() === "servicio" ? "servicio" : "producto";
}

function getImageUrl(item: IAApiItem): string {
  const image = item.imagen_principal ?? item.imagen ?? item.image;
  return image
    ? (String(image).startsWith("http") ? String(image) : toImageUrl(String(image)))
    : toImageUrl(null);
}

function getCleanItemId(item: IAApiItem, fallbackKey: string): string {
  const rawId = item.item_id ?? item.id ?? "";
  const cleanId = String(rawId).replace(/^[PS]-/i, "").trim();
  return cleanId || `ia-${fallbackKey}`;
}

function normalizeIAResponse(payload: unknown): IAApiResponse {
  const data = payload as { data?: unknown; resultado?: unknown; result?: unknown };
  const nested = data?.data ?? data?.resultado ?? data?.result;

  if (nested && typeof nested === "object") {
    return nested as IAApiResponse;
  }

  return (payload || {}) as IAApiResponse;
}

function subcatalogosItemsMap(
  subcatalogo: IAApiSubcatalogo,
  evento: string,
  subcatalogoIndex: number
): Product[] {
  return getSubcatalogoItems(subcatalogo).map((item, itemIndex): Product => {
    const imageUrl = getImageUrl(item);
    const itemType = normalizeItemType(item.tipo);
    const quantity = toNumber(item.cantidad ?? item.cantidad_sugerida, 1);
    const price = toNumber(
      item.precio_final ??
        item.precio_unitario ??
        item.precio ??
        item.price ??
        item.precio_total,
      0
    );
    const originalPrice = toNumber(item.precio_original ?? item.precio_unitario, 0);
    const discountPercent = toNumber(item.descuento_porcentaje, 0);
    const reason =
      item.razon ||
      item.razon_cantidad ||
      `Recomendado para ${evento || "tu evento"}.`;
    const description = quantity > 1
      ? `${reason} Cantidad sugerida: ${quantity}.`
      : reason;
    const sellerName = String(
      item.nombre_negocio || item.negocio || item.sellerName || "Proveedor recomendado"
    );

    return {
      id: getCleanItemId(item, `${subcatalogoIndex}-${itemIndex}`),
      name: item.nombre || item.name || "Producto recomendado",
      description,
      price,
      originalPrice: originalPrice > price ? originalPrice : undefined,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      image: imageUrl,
      images: [imageUrl],
      category: item.categoria_principal || getSubcatalogoName(subcatalogo) || evento || "evento",
      rating: toNumber(item.calificacion ?? item.rating, 0),
      reviewCount: 0,
      stock: itemType === "servicio"
        ? 99
        : (item.stock !== undefined && item.stock !== null ? toNumber(item.stock, 1) : Math.max(1, quantity)),
      sellerId: sellerName,
      sellerName,
      reviews: [],
      type: itemType,
      durationMin: itemType === "servicio" ? toOptionalNumber(item.duracion_minutos) : undefined,
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
        const errorPayload = await response.json().catch(() => null);
        const message =
          (errorPayload as { error?: string; mensaje?: string } | null)?.error ||
          (errorPayload as { error?: string; mensaje?: string } | null)?.mensaje ||
          `Backend error: ${response.statusText}`;
        throw new Error(message);
      }

      const data = normalizeIAResponse(await response.json());
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

      const data = normalizeIAResponse(await response.json());
      return extractSubcatalogos(data).map((subcatalogo, index) => ({
        title: getSubcatalogoName(subcatalogo),
        products: subcatalogosItemsMap(subcatalogo, data.evento || data.tipo_evento || "", index),
      }));
    } catch (error) {
      console.error("Error fetching IA home recommendations:", error);
      return [];
    }
  }
}

export const iaService = new IAService();

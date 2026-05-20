/**
 * mappers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Traducen las respuestas del Backend (campos en español, tal como los devuelve
 * la base de datos PostgreSQL) a los tipos TypeScript que ya usa el Frontend.
 *
 * REGLA: Nunca importes datos del backend directamente en los componentes.
 *        Siempre pásalos por un mapper primero.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  Product,
  Review,
  User,
  Address,
  PaymentMethod,
  Order,
  OrderCoupon,
} from "../data/mock-data";

// ─── URL base del servidor de backend ────────────────────────────────────────
// Usa el mismo hostname del frontend para que las URLs de imagen sean consistentes.
const API_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";
const API_BASE = (import.meta.env.VITE_API_URL || `http://${API_HOST}:3000`).replace(/\/$/, "");

/** Convierte la imagen_principal relativa del back en una URL completa. */
export function toImageUrl(path: string | null | undefined): string {
  if (!path) return "https://placehold.co/400x400?text=Sin+imagen";
  if (path.startsWith("http")) return path;
  const normalized = path.replace(/\\/g, "/").replace(/^static\//, "");
  return `${API_BASE}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS RAW: lo que devuelve el Backend exactamente
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que devuelve GET /comprador/productos/:id → .producto.resenas[] */
export interface RawResena {
  id: number;
  calificacion: number;
  comentario: string | null;
  compra_verificada: boolean;
  fecha_creacion: string;
  usuario: {
    id: number;
    nombre: string;
  };
}

/** Lo que devuelve GET /comprador/productos/:id → .producto */
export interface RawProductoDetalle {
  id: number;
  nombre: string;
  descripcion: string | null;
  calificacion: number | null;
  precio: number;
  precio_original: number;
  porcentaje_descuento: number | null;
  sku: string | null;
  fecha_registro: string;
  imagen_principal: string | null;
  galeria_imagenes: Array<{ id: number; url_imagen: string; es_principal: boolean; orden_visual: number }> | null;
  empresa: string;
  id_negocio: number | null;
  sucursal?: {
    nombre: string;
    calle: string | null;
    ciudad: string | null;
    estado: string | null;
    codigo_postal: string | null;
    pais: string | null;
  };
  stock_total: number;
  numero_resenas: number;
  categorias: string[];
  resenas: RawResena[];
}

/** Lo que devuelve GET /comprador/productos/categoria/:id → .productos[] */
export interface RawProductoLista {
  id: number;
  nombre: string;
  calificacion: number | null;
  precio: number;
  precio_original?: number | null;
  porcentaje_descuento?: number | null;
  imagen_principal: string | null;
  empresa: string;
  id_negocio?: number | null;
  numero_resenas: number;
  horarios_disponibles?: number | null;
  proximo_horario_inicio?: string | null;
  proximo_horario_fin?: string | null;
}

/** Lo que devuelve GET /comprador/servicios/:id → .servicio */
export interface RawServicioDetalle {
  id: number;
  nombre: string;
  descripcion: string | null;
  calificacion: number | null;
  precio: number;              // ya mapeado como precio_base en el back
  precio_original?: number | null;
  porcentaje_descuento?: number | null;
  duracion_minutos: number | null;
  fecha_registro: string;
  imagen_principal: string | null;
  galeria_imagenes: Array<{ id: number; url_imagen: string; es_principal: boolean; orden_visual: number }> | null;
  empresa: string;
  id_negocio: number | null;
  numero_resenas: number;
  categorias: string[];
  resenas: RawResena[];
  agenda_disponible: RawAgendaSlot[];
}

/** Slot de agenda de servicio */
export interface RawAgendaSlot {
  id: number;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  estado: string;
  sucursal?: {
    nombre?: string | null;
    direccion?: {
      calle?: string | null;
      ciudad?: string | null;
      estado?: string | null;
      codigo_postal?: string | null;
      pais?: string | null;
    };
  };
}

/** Lo que devuelve GET /comprador/categorias → [] */
export interface RawCategoria {
  id: number;
  nombre?: string;
  nombre_categoria?: string;
  tipo: "producto" | "servicio" | "ambos";
  id_padre?: number | null;
}

/** Lo que devuelve POST /login y GET /comprador/cuenta */
export interface RawUsuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: "comprador" | "vendedor" | "admin";
}

/** Lo que devuelve GET /comprador/cuenta/direcciones → [] */
export interface RawDireccion {
  id: number;
  calle: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais: string;
  es_principal: boolean;
  tipo_direccion: string;
}

/** Lo que devuelve GET /comprador/cuenta/metodos-pago → [] */
export interface RawMetodoPago {
  id: number;
  proveedor_pago: string;
  ultimos_cuatro: string;
  fecha_expiracion: string;
}

/** Lo que devuelve GET /api/vendedor/pedidos → .pedidos[].items[] */
export interface RawPedidoItem {
  id: number;
  type: "producto" | "servicio";
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

/** Lo que devuelve GET /api/vendedor/pedidos → .pedidos[] */
export interface RawPedido {
  id: number;
  folio: string;
  date: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  total: number;
  status: string;
  address: Record<string, unknown>;
  cupon?: OrderCoupon | OrderCoupon[] | null;
  items: RawPedidoItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPERS: funciones que convierten Raw → Tipo del Frontend
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte una reseña del back al tipo Review del frontend */
export function mapResena(raw: RawResena): Review {
  return {
    id: String(raw.id),
    userId: String(raw.usuario.id),
    userName: raw.usuario.nombre,
    rating: raw.calificacion,
    comment: raw.comentario ?? "",
    date: new Date(raw.fecha_creacion).toISOString().split("T")[0],
    verifiedPurchase: raw.compra_verificada ?? false,
  };
}

/** Construye un array de URLs de imagen a partir de la galería del backend */
function mapImageGallery(
  imagenPrincipal: string | null | undefined,
  galeria: Array<{ url_imagen: string; orden_visual: number }> | null
): string[] {
  const ordered = (galeria ?? [])
    .sort((a, b) => a.orden_visual - b.orden_visual)
    .map((item) => toImageUrl(item.url_imagen));
  const fallback = toImageUrl(imagenPrincipal);
  return ordered.length > 0 ? ordered : [fallback];
}

/** Formatea la dirección de la sucursal como string legible */
function formatBranchAddress(sucursal?: RawProductoDetalle["sucursal"]): string {
  if (!sucursal) return "Ubicación no disponible";
  const parts = [sucursal.calle, sucursal.ciudad, sucursal.estado, sucursal.codigo_postal, sucursal.pais].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Ubicación no disponible";
}

function formatAgendaAddress(slot: RawAgendaSlot): string | undefined {
  const direccion = slot.sucursal?.direccion;
  if (!direccion) return undefined;
  const parts = [direccion.calle, direccion.ciudad, direccion.estado, direccion.codigo_postal, direccion.pais].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Convierte el detalle completo de un PRODUCTO del back al tipo Product del front */
export function mapProductoDetalle(raw: RawProductoDetalle): Product {
  const images = mapImageGallery(raw.imagen_principal, raw.galeria_imagenes ?? null);
  return {
    id: String(raw.id),
    name: raw.nombre,
    description: raw.descripcion ?? "",
    price: Number(raw.precio),
    originalPrice:
      raw.precio_original != null && Number(raw.precio_original) !== Number(raw.precio)
        ? Number(raw.precio_original)
        : undefined,
    discountPercent:
      raw.porcentaje_descuento != null && Number(raw.porcentaje_descuento) > 0
        ? Number(raw.porcentaje_descuento)
        : undefined,
    image: images[0],
    images,
    category: raw.categorias[0] ?? "general",
    rating: raw.calificacion ?? 0,
    reviewCount: raw.numero_resenas,
    stock: raw.stock_total,
    sellerId: raw.id_negocio ? String(raw.id_negocio) : "0",
    sellerName: raw.empresa,
    reviews: raw.resenas.map(mapResena),
    type: "producto",
    status: "Aprobado",
    sku: raw.sku ?? undefined,
    publicationDate: raw.fecha_registro
      ? new Date(raw.fecha_registro).toISOString().split("T")[0]
      : undefined,
    branchName: raw.sucursal?.nombre ?? raw.empresa,
    branchAddress: formatBranchAddress(raw.sucursal),
    businessId: raw.id_negocio ? String(raw.id_negocio) : undefined,
  };
}

/** Convierte un producto de la LISTA (catálogo) del back al tipo Product del front */
export function mapProductoLista(raw: RawProductoLista): Product {
  const price = Number(raw.precio);
  const originalPrice =
    raw.precio_original != null && Number(raw.precio_original) > price
      ? Number(raw.precio_original)
      : undefined;
  const discountPercent =
    raw.porcentaje_descuento != null && Number(raw.porcentaje_descuento) > 0
      ? Number(raw.porcentaje_descuento)
      : undefined;
  const horariosDisponibles =
    raw.horarios_disponibles != null ? Number(raw.horarios_disponibles) : undefined;

  return {
    id: String(raw.id),
    name: raw.nombre,
    description: "",           // la lista no trae descripción
    price,
    originalPrice,
    discountPercent,
    image: toImageUrl(raw.imagen_principal),
    images: [toImageUrl(raw.imagen_principal)],
    category: "general",       // la lista no trae categoría individual
    rating: raw.calificacion ?? 0,
    reviewCount: raw.numero_resenas,
    stock: 0,                  // la lista no trae stock
    sellerId: raw.id_negocio ? String(raw.id_negocio) : "0",
    sellerName: raw.empresa,
    reviews: [],
    type: "producto",
    businessId: raw.id_negocio ? String(raw.id_negocio) : undefined,
    availability:
      horariosDisponibles !== undefined
        ? horariosDisponibles > 0
          ? `${horariosDisponibles} horario${horariosDisponibles !== 1 ? "s" : ""} disponible${horariosDisponibles !== 1 ? "s" : ""}`
          : "Sin horarios disponibles"
        : undefined,
    status: "Aprobado",
  };
}

/** Convierte el detalle completo de un SERVICIO del back al tipo Product del front */
export function mapServicioDetalle(raw: RawServicioDetalle): Product {
  const images = mapImageGallery(raw.imagen_principal, raw.galeria_imagenes ?? null);
  return {
    id: String(raw.id),
    name: raw.nombre,
    description: raw.descripcion ?? "",
    price: Number(raw.precio),
    originalPrice:
      raw.precio_original != null && Number(raw.precio_original) > Number(raw.precio)
        ? Number(raw.precio_original)
        : undefined,
    discountPercent:
      raw.porcentaje_descuento != null && Number(raw.porcentaje_descuento) > 0
        ? Number(raw.porcentaje_descuento)
        : undefined,
    image: images[0],
    images,
    category: raw.categorias[0] ?? "general",
    rating: raw.calificacion ?? 0,
    reviewCount: raw.numero_resenas,
    stock: 99,                 // los servicios no tienen stock tradicional
    sellerId: raw.id_negocio ? String(raw.id_negocio) : "0",
    sellerName: raw.empresa,
    reviews: raw.resenas.map(mapResena),
    type: "servicio",
    durationMin: raw.duracion_minutos ?? undefined,
    availability: raw.agenda_disponible.length > 0
      ? `${raw.agenda_disponible.length} horarios disponibles`
      : "Sin horarios disponibles",
    agendaSlots: raw.agenda_disponible.map((slot) => ({
      id: String(slot.id),
      start: slot.fecha_hora_inicio,
      end: slot.fecha_hora_fin,
      status: slot.estado,
      branchName: slot.sucursal?.nombre ?? raw.empresa,
      branchAddress: formatAgendaAddress(slot),
    })),
    status: "Aprobado",
    publicationDate: raw.fecha_registro
      ? new Date(raw.fecha_registro).toISOString().split("T")[0]
      : undefined,
    businessId: raw.id_negocio ? String(raw.id_negocio) : undefined,
  };
}

/** Convierte un usuario del back al tipo User del frontend */
export function mapUsuario(raw: RawUsuario): User {
  const rol = String(raw.rol || "").toLowerCase();
  const role = rol === "cliente" ? "comprador" : rol;

  return {
    id: String(raw.id),
    name: raw.nombre,
    email: raw.email,
    role: role as User["role"],
    registrationDate: new Date().toISOString().split("T")[0], // el back no retorna esto en /login
    status: "Activo",
    phone: raw.telefono ?? undefined,
  };
}

/** Convierte una dirección del back al tipo Address del frontend */
export function mapDireccion(raw: RawDireccion): Address {
  return {
    id: String(raw.id),
    label: raw.tipo_direccion || "Sin etiqueta",
    street: raw.calle,
    city: raw.ciudad,
    state: raw.estado,
    zip: raw.codigo_postal,
    country: raw.pais,
    isDefault: raw.es_principal,
  };
}

/** Convierte una dirección del FRONT al formato que espera el BACK (para POST) */
export function mapDireccionToBack(addr: Omit<Address, "id"> & { latitud?: number; longitud?: number }): object {
  return {
    calle: addr.street,
    ciudad: addr.city,
    estado: addr.state,
    codigo_postal: addr.zip,
    pais: addr.country,
    es_principal: addr.isDefault,
    tipo_direccion: addr.label || "hogar",
    latitud: addr.latitud ?? 19.4326,
    longitud: addr.longitud ?? -99.1332,
  };
}

/** Convierte un método de pago del back al tipo PaymentMethod del frontend */
export function mapMetodoPago(raw: RawMetodoPago): PaymentMethod {
  return {
    id: String(raw.id),
    userId: "0",               // el back no retorna el id_usuario en este endpoint
    provider: raw.proveedor_pago,
    lastFour: raw.ultimos_cuatro,
    expiry: raw.fecha_expiracion,
    isDefault: false,          // el back no indica cuál es el default en la lista
  };
}

/** Convierte un pedido del VENDEDOR (back) al tipo Order del frontend */
export function mapPedidoVendedor(raw: RawPedido): Order {
  // Creamos CartItems ficticios a partir de los items del pedido
  const items = raw.items.map((item) => ({
    product: {
      id: String(item.id),
      name: item.name,
      description: "",
      price: item.price,
      image: "",
      images: [],
      category: "general",
      rating: 0,
      reviewCount: 0,
      stock: 0,
      sellerId: "0",
      sellerName: "",
      reviews: [],
      type: item.type,
      status: "Aprobado" as const,
    },
    quantity: item.quantity,
  }));

  // Normalizar el estado del pedido al formato del frontend
  const statusMap: Record<string, Order["status"]> = {
    "PENDIENTE": "Pendiente",
    "EN PREPARACION": "En preparacion",
    "ENVIADO": "Enviado",
    "ENTREGADO": "Entregado",
    "CANCELADO": "Cancelado",
  };

  return {
    id: String(raw.id),
    folio: raw.folio,
    date: typeof raw.date === "string" ? raw.date.split("T")[0] : String(raw.date),
    items,
    total: raw.total,
    status: statusMap[raw.status?.toUpperCase()] ?? "En preparacion",
    buyerName: raw.buyerName,
    buyerId: "0",
    address: typeof raw.address === "object"
      ? Object.values(raw.address).filter(Boolean).join(", ")
      : String(raw.address),
    cupon: raw.cupon ?? null,
  };
}

/** Convierte una categoría del back al formato del front */
export function mapCategoria(raw: RawCategoria): { id: string; name: string; tipo: string; id_padre: string | null } {
  return {
    id: String(raw.id),
    name: raw.nombre ?? raw.nombre_categoria ?? "",
    tipo: raw.tipo,
    id_padre: raw.id_padre != null ? String(raw.id_padre) : null,
  };
}

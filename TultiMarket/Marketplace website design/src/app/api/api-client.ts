/**
 * api-client.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cliente centralizado para TODAS las peticiones HTTP al backend.
 * Usa 'credentials: include' para enviar las cookies de sesión automáticamente.
 *
 * ESTADO DE INVOCACIÓN:
 *   Listo e invocado en    = Ya se llama desde algún archivo del frontend
 *   Falta por invocar = Existe pero ningún archivo la usa todavía
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  mapProductoDetalle,
  mapProductoLista,
  mapServicioDetalle,
  mapUsuario,
  mapDireccion,
  mapDireccionToBack,
  mapMetodoPago,
  mapPedidoVendedor,
  mapCategoria,
  type RawProductoDetalle,
  type RawServicioDetalle,
  type RawProductoLista,
  type RawUsuario,
  type RawDireccion,
  type RawMetodoPago,
  type RawPedido,
  type RawCategoria,
} from "./mappers";

import type { Product, User, Address, PaymentMethod, Order } from "../data/mock-data";

// URL base del backend. Usa el mismo hostname del frontend para que la cookie
// de sesion no se pierda entre localhost y 127.0.0.1.
const API_HOST = typeof window !== "undefined" ? window.location.hostname : "localhost";
const BASE_URL = `http://${API_HOST}:3000`;

// ─── Helper: fetch con credentials incluidas ─────────────────────────────────
async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  // Si es FormData (subida de archivos) no ponemos Content-Type
  // para que el browser genere el boundary automáticamente
  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    ...options,
    credentials: "include", // CRÍTICO: envía las cookies de sesión
    headers: isFormData
      ? { ...options.headers }
      : {
        "Content-Type": "application/json",
        ...options.headers,
      },
  });

  // Si la respuesta está vacía (204 No Content) devolver un objeto vacío
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    // El backend usa "mensaje" para errors, pero algunos endpoints de vendedor usan "error"
    const mensaje = data.mensaje ?? data.error ?? `Error HTTP ${response.status}`;
    throw new Error(mensaje);
  }

  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listo e invocado en — en store-context.tsx → login()
 *
 * POST /login
 * Body: { correo, contrasena }
 * Response: { mensaje, usuario: { id, nombre, email, rol, id_negocio } }
 *
 * BUG CORREGIDO: El backend devuelve "rol" como nombre_rol (ej. "Comprador"),
 * no minúscula. mapUsuario normaliza esto.
 *
 * BUG CORREGIDO: El backend también devuelve id_negocio para vendedores,
 * ahora lo retornamos en el mapeo.
 */
export async function loginApi(
  email: string,
  password: string
): Promise<User & { id_negocio?: number | null }> {
  const data = await api<{
    usuario: RawUsuario & { id_negocio?: number | null };
  }>("/login", {
    method: "POST",
    body: JSON.stringify({ correo: email, contrasena: password }),
  });
  const user = mapUsuario(data.usuario);
  return { ...user, id_negocio: data.usuario.id_negocio ?? null };
}

/**
 * Listo e invocado en — en store-context.tsx → register()
 *
 * POST /registrar
 * Body: { nombre, correo, contrasena, id_rol }
 * Response: { mensaje, usuario: { id, nombre, email } }
 *
 * NOTA: El backend NO retorna "rol" ni "telefono" en el registro,
 * solo id/nombre/email. El mapper debe manejar campos faltantes.
 *
 * id_rol: 1=cliente, 2=vendedor, 3=admin  (tabla roles)
 */
export async function registerApi(
  nombre: string,
  email: string,
  password: string,
  rol: "comprador" | "vendedor" = "comprador"
): Promise<User> {
  const id_rol = rol === "vendedor" ? 2 : 1;
  const data = await api<{
    usuario: { id: number; nombre: string; email: string };
  }>("/registrar", {
    method: "POST",
    body: JSON.stringify({ nombre, correo: email, contrasena: password, id_rol }),
  });

  // El backend NO devuelve rol ni telefono en /registrar, construimos un User parcial
  return {
    id: String(data.usuario.id),
    name: data.usuario.nombre,
    email: data.usuario.email,
    role: rol,
    registrationDate: new Date().toISOString().split("T")[0],
    status: "Activo",
  };
}

/**
 * Listo e invocado en — en store-context.tsx → logout()
 *
 * POST /logout
 *
 * BUG CORREGIDO: El backend hace res.redirect("/login") que causa un
 * error de CORS/parsing. Usamos mode: "no-cors" como fallback y
 * atrapamos todo error silenciosamente.
 */
export async function logoutApi(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // El back redirige, es esperado que falle
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO (Comprador)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Falta por invocar — Falta conectar en home.tsx y search.tsx
 *
 * GET /comprador/categorias
 * Response: [{ id, nombre, tipo }]  (array directo, NO envuelto en objeto)
 *
 * No requiere sesión.
 */
export async function getCategoriasApi(tipo?: "producto" | "servicio" | "ambos") {
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  const endpoint = tipo ? `/api/vendedor/categorias${query}` : "/comprador/categorias";
  const data = await api<RawCategoria[]>(endpoint);
  return data.map(mapCategoria);
}

/**
 * GET /comprador/productos
 * Devuelve TODOS los productos activos (sin filtro de categoría).
 */
export async function getAllProductosApi(filtros?: {
  q?: string;
  precio_min?: number;
  precio_max?: number;
  calificacion_min?: number;
  ordenar?: string;
}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.precio_min !== undefined) params.set("precio_min", String(filtros.precio_min));
  if (filtros?.precio_max !== undefined) params.set("precio_max", String(filtros.precio_max));
  if (filtros?.calificacion_min !== undefined)
    params.set("calificacion_min", String(filtros.calificacion_min));
  if (filtros?.ordenar) params.set("ordenar", filtros.ordenar);

  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await api<{ productos: RawProductoLista[] }>(
    `/comprador/productos${query}`
  );
  return data.productos.map(mapProductoLista);
}

/**
 * GET /comprador/categorias/top
 * Top 10 categorías raíz por cantidad de productos.
 * Usado por el navbar para navegación rápida.
 */
export async function getTopCategoriasApi(): Promise<{ id: string; name: string; total: number }[]> {
  const data = await api<{ id: number; nombre: string; total: number }[]>("/comprador/categorias/top");
  return data.map((c) => ({ id: String(c.id), name: c.nombre, total: c.total }));
}

/**
 * Falta por invocar — Falta conectar en home.tsx, search.tsx, category.tsx
 *
 * GET /comprador/productos/categoria/:idCategoria?q=...&precio_min=...
 * Response: { id_categoria, filtros, total, productos: [...] }
 *
 * No requiere sesión.
 *
 * BUG CORREGIDO: numero_resenas viene como string "0" del SQL COUNT().
 * El mapper ya maneja esto con Number().
 */
export async function getProductosPorCategoriaApi(
  idCategoria: number,
  filtros?: {
    q?: string;
    precio_min?: number;
    precio_max?: number;
    calificacion_min?: number;
    ordenar?: string;
  }
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.precio_min !== undefined) params.set("precio_min", String(filtros.precio_min));
  if (filtros?.precio_max !== undefined) params.set("precio_max", String(filtros.precio_max));
  if (filtros?.calificacion_min !== undefined)
    params.set("calificacion_min", String(filtros.calificacion_min));
  if (filtros?.ordenar) params.set("ordenar", filtros.ordenar);

  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await api<{ productos: RawProductoLista[] }>(
    `/comprador/productos/categoria/${idCategoria}${query}`
  );
  return data.productos.map(mapProductoLista);
}

/**
 * Falta por invocar — Falta conectar en search.tsx para buscar servicios
 *
 * GET /comprador/servicios/categoria/:idCategoria?q=...
 * Response: { id_categoria, filtros, total, servicios: [...] }
 *
 * NOTA: La respuesta usa "servicios" (NO "productos").
 * El mapper mapProductoLista sirve porque la estructura del row es idéntica.
 */
export async function getServiciosPorCategoriaApi(
  idCategoria: number,
  filtros?: {
    q?: string;
    precio_min?: number;
    precio_max?: number;
    calificacion_min?: number;
    ordenar?: string;
  }
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.precio_min !== undefined) params.set("precio_min", String(filtros.precio_min));
  if (filtros?.precio_max !== undefined) params.set("precio_max", String(filtros.precio_max));
  if (filtros?.calificacion_min !== undefined)
    params.set("calificacion_min", String(filtros.calificacion_min));
  if (filtros?.ordenar) params.set("ordenar", filtros.ordenar);

  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await api<{ servicios: RawProductoLista[] }>(
    `/comprador/servicios/categoria/${idCategoria}${query}`
  );
  // Usamos mapProductoLista pero cambiamos el type a "servicio"
  return data.servicios.map((raw) => {
    const p = mapProductoLista(raw);
    return { ...p, type: "servicio" as const };
  });
}

/**
 * Falta por invocar — Falta conectar en product-detail.tsx
 *
 * GET /comprador/productos/:id
 * Response: { producto: { id, nombre, ..., resenas: [...] } }
 *
 * No requiere sesión.
 */
export async function getProductoDetalleApi(id: number): Promise<Product> {
  const data = await api<{ producto: RawProductoDetalle }>(`/comprador/productos/${id}`);
  return mapProductoDetalle(data.producto);
}

/**
 * Falta por invocar — Falta conectar en product-detail.tsx (para servicios)
 *
 * GET /comprador/servicios/:id
 * Response: { servicio: { id, nombre, ..., agenda_disponible: [...], resenas: [...] } }
 *
 * No requiere sesión.
 */
export async function getServicioDetalleApi(id: number): Promise<Product> {
  const data = await api<{ servicio: RawServicioDetalle }>(`/comprador/servicios/${id}`);
  return mapServicioDetalle(data.servicio);
}

/**
 * POST /comprador/resenas
 * Crea una reseña para un producto o servicio.
 * Requiere sesión activa.
 */
export async function createReviewApi(
  tipo: "producto" | "servicio",
  idItem: number,
  calificacion: number,
  comentario: string
) {
  return api<{ mensaje: string; resena: any }>("/comprador/resenas", {
    method: "POST",
    body: JSON.stringify({
      tipo,
      id_item: idItem,
      calificacion,
      comentario,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CUENTA (requiere sesión activa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listo e invocado en — en store-context.tsx → useEffect (restaurar sesión al cargar)
 *
 * GET /comprador/cuenta
 * Response: { id, nombre, email, telefono, rol }  (objeto directo, NO envuelto)
 *
 * Requiere sesión activa. Si no hay sesión devuelve 401.
 */
export async function getMiCuentaApi(): Promise<User & { id_negocio?: number | null }> {
  const data = await api<RawUsuario & { id_negocio?: number | null }>("/comprador/cuenta");
  const user = mapUsuario(data);
  return { ...user, id_negocio: data.id_negocio ?? null };
}

/**
 * Falta por invocar — Falta conectar en profile.tsx
 *
 * PUT /comprador/cuenta
 * Body: { nombre, email, telefono }
 * Response: { mensaje, usuario: { id, nombre, email, telefono } }
 *
 * BUG POTENCIAL: El back retorna { usuario: { ... } } pero SIN el campo "rol".
 * mapUsuario fallará si no recibe "rol". Corrección: asignar rol por defecto.
 */
export async function updateMiCuentaApi(datos: {
  nombre: string;
  email: string;
  telefono?: string;
}): Promise<User> {
  const data = await api<{
    usuario: { id: number; nombre: string; email: string; telefono?: string | null };
  }>("/comprador/cuenta", {
    method: "PUT",
    body: JSON.stringify(datos),
  });

  // El back NO retorna "rol" en el PUT, construimos el User manualmente
  return {
    id: String(data.usuario.id),
    name: data.usuario.nombre,
    email: data.usuario.email,
    role: "comprador", // el PUT no retorna el rol, asumimos comprador
    registrationDate: new Date().toISOString().split("T")[0],
    status: "Activo",
    phone: data.usuario.telefono ?? undefined,
  };
}

/**
 * Listo e invocado en — en store-context.tsx → reloadAddresses()
 *
 * GET /comprador/cuenta/direcciones
 * Response: [{ id, calle, ciudad, estado, codigo_postal, pais, es_principal, tipo_direccion }]
 *
 * Devuelve array directo. Requiere sesión.
 */
export async function getMisDireccionesApi(): Promise<Address[]> {
  const data = await api<RawDireccion[]>("/comprador/cuenta/direcciones");
  return data.map(mapDireccion);
}

/**
 * Listo e invocado en — en store-context.tsx → addAddress()
 *
 * POST /comprador/cuenta/direcciones
 * Body: { calle, ciudad, estado, codigo_postal, pais, es_principal, tipo_direccion }
 * Response: { mensaje, id_direccion: number }
 *
 * BUG CORREGIDO ANTERIORMENTE: Quitamos geo_location/PostGIS del INSERT del back.
 */
export async function addDireccionApi(addr: Omit<Address, "id"> & { latitud?: number; longitud?: number }): Promise<number> {
  const body = mapDireccionToBack(addr);
  const data = await api<{ id_direccion: number }>("/comprador/cuenta/direcciones", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.id_direccion;
}

/**
 * Listo e invocado en — en store-context.tsx → removeAddress()
 *
 * DELETE /comprador/cuenta/direcciones/:id
 * Response: { mensaje: "Direccion eliminada" }
 */
export async function deleteDireccionApi(id: number): Promise<void> {
  await api(`/comprador/cuenta/direcciones/${id}`, { method: "DELETE" });
}

/**
 * Listo e invocado en — en store-context.tsx → reloadPaymentMethods()
 *
 * GET /comprador/cuenta/metodos-pago
 * Response: [{ id, proveedor_pago, ultimos_cuatro, fecha_expiracion }]
 *
 * Devuelve array directo. Requiere sesión.
 */
export async function getMisMetodosPagoApi(): Promise<PaymentMethod[]> {
  const data = await api<RawMetodoPago[]>("/comprador/cuenta/metodos-pago");
  return data.map(mapMetodoPago);
}

/**
 * Falta por invocar — Falta conectar en profile.tsx (sección métodos de pago)
 *
 * POST /comprador/cuenta/metodos-pago
 * Body: { proveedor_pago, token_pasarela, ultimos_cuatro, fecha_expiracion }
 * Response: { mensaje, id_metodo_pago: number }
 *
 * NOTA: El backend requiere TODOS los campos incluyendo token_pasarela (string).
 * El formulario del front deberá enviar un token ficticio como "tok_sim_xxxx"
 * para simular una pasarela de pago.
 *
 * VALIDACIÓN DEL BACK:
 *   - ultimos_cuatro: exactamente 4 dígitos (regex: /^\d{4}$/)
 *   - fecha_expiracion: formato MM/YY (regex: /^(0[1-9]|1[0-2])\/\d{2}$/)
 */
export async function addMetodoPagoApi(metodoPago: {
  proveedor_pago: string;
  token_pasarela: string;
  ultimos_cuatro: string;
  fecha_expiracion: string;
}): Promise<number> {
  const data = await api<{ id_metodo_pago: number }>("/comprador/cuenta/metodos-pago", {
    method: "POST",
    body: JSON.stringify(metodoPago),
  });
  return data.id_metodo_pago;
}

/**
 * Falta por invocar — Falta conectar en profile.tsx
 *
 * DELETE /comprador/cuenta/metodos-pago/:id
 * Response: { mensaje: "Metodo de pago eliminado" }
 */
export async function deleteMetodoPagoApi(id: number): Promise<void> {
  await api(`/comprador/cuenta/metodos-pago/${id}`, { method: "DELETE" });
}

/**
 * Falta por invocar — Falta conectar en profile.tsx (sección seguridad)
 *
 * PUT /comprador/cuenta/contrasena
 * Body: { password_actual, password_nueva }
 * Response: { mensaje: "Password actualizada" }
 *
 * VALIDACIONES DEL BACK:
 *   - password_nueva mínimo 8 caracteres
 *   - No puede ser igual a la actual
 *   - password_actual se verifica contra SHA-256 en la BD
 */
export async function cambiarPasswordApi(
  passwordActual: string,
  passwordNueva: string
): Promise<void> {
  await api("/comprador/cuenta/contrasena", {
    method: "PUT",
    body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
  });
}

/**
 * Falta por invocar — Falta conectar en profile.tsx (botón "Eliminar cuenta")
 *
 * DELETE /comprador/cuenta
 * Body: { password_actual }
 * Response: { mensaje: "Cuenta eliminada" }
 *
 * ADVERTENCIA: Hace soft-delete (activo=false, fecha_eliminacion=NOW()).
 * Destruye la sesión. El frontend debe redirigir a /login.
 */
export async function eliminarCuentaApi(passwordActual: string): Promise<void> {
  await api("/comprador/cuenta", {
    method: "DELETE",
    body: JSON.stringify({ password_actual: passwordActual }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CARRITO (requiere sesión activa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Listo e invocado en — en store-context.tsx → reloadCart()
 *
 * GET /comprador/carrito
 * Response: { total_items, total, items: [...] }
 *
 * Cada item contiene:
 *   id_item         ← id del registro en carrito_items (para PUT/DELETE)
 *   tipo_item       ← "producto" | "servicio"
 *   id_producto     ← number | null
 *   id_servicio     ← number | null
 *   nombre          ← nombre del producto/servicio
 *   empresa         ← nombre comercial del negocio
 *   cantidad        ← number
 *   precio_unitario ← number
 *   subtotal        ← number
 *   agenda          ← null | { fecha_hora_inicio, fecha_hora_fin, estado }
 */
export async function getCarritoApi() {
  return api<{
    total_items: number;
    total: number;
    items: Array<{
      id_item: number;
      tipo_item: "producto" | "servicio";
      id_producto: number | null;
      id_servicio: number | null;
      nombre: string;
      imagen: string | null;
      stock_maximo: number;
      precio_unitario_original: number;
      empresa: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      agenda: null | { fecha_hora_inicio: string; fecha_hora_fin: string; estado: string };
    }>;
  }>("/comprador/carrito");
}

/**
 * Listo e invocado en — en store-context.tsx → addToCart() (cuando type !== "servicio")
 *
 * POST /comprador/carrito/items
 * Body: { id_producto: number, cantidad: number }
 * Response: { mensaje, carrito: { total_items, total, items: [...] } }
 *
 * VALIDACIONES DEL BACK:
 *   - Solo se puede enviar id_producto O id_servicio (no ambos)
 *   - Verifica stock antes de agregar. Si excede → 400 "Stock insuficiente"
 *   - Si ya existe un item con ese id_producto en el carrito, SUMA la cantidad
 */
export async function addProductoAlCarritoApi(idProducto: number, cantidad: number) {
  return api("/comprador/carrito/items", {
    method: "POST",
    body: JSON.stringify({ id_producto: idProducto, cantidad }),
  });
}

/**
 * Listo e invocado en — en store-context.tsx → addToCart() (cuando type === "servicio")
 *
 * POST /comprador/carrito/items
 * Body: { id_servicio: number, cantidad: number, id_agenda_seleccionada?: number | null }
 * Response: { mensaje, carrito: { total_items, total, items: [...] } }
 */
export async function addServicioAlCarritoApi(
  idServicio: number,
  cantidad: number,
  idAgenda?: number
) {
  return api("/comprador/carrito/items", {
    method: "POST",
    body: JSON.stringify({
      id_servicio: idServicio,
      cantidad,
      id_agenda_seleccionada: idAgenda ?? null,
    }),
  });
}

/**
 * Listo e invocado en — en store-context.tsx → updateCartQuantity()
 *
 * PUT /comprador/carrito/items/:idItem
 * Body: { cantidad: number }
 * Response: { mensaje, carrito: { total_items, total, items: [...] } }
 *
 * NOTA: :idItem es el id_item del registro en carrito_items,
 * NO el id del producto. El store-context ya maneja esta diferencia
 * guardando idItem en CartItemConId.
 */
export async function updateItemCarritoApi(idItem: number, cantidad: number) {
  return api(`/comprador/carrito/items/${idItem}`, {
    method: "PUT",
    body: JSON.stringify({ cantidad }),
  });
}

/**
 * Listo e invocado en — en store-context.tsx → removeFromCart()
 *
 * DELETE /comprador/carrito/items/:idItem
 * Response: { mensaje, carrito: { total_items, total, items: [...] } }
 */
export async function deleteItemCarritoApi(idItem: number) {
  return api(`/comprador/carrito/items/${idItem}`, { method: "DELETE" });
}

/**
 * Listo e invocado en — en store-context.tsx → clearCart()
 *
 * DELETE /comprador/carrito
 * Response: { mensaje: "Carrito vaciado" }
 */
export async function vaciarCarritoApi() {
  return api("/comprador/carrito", { method: "DELETE" });
}

/**
 * Listo e invocado en — en store-context.tsx → placeOrder()
 *
 * POST /comprador/carrito/checkout
 * Body: { id_direccion?: number | null, id_metodo_pago?: number | null }
 * Response: { mensaje, pedido: { id, total, estado_pedido, fecha_creacion } }
 *
 * BUG CORREGIDO: Quitamos PostGIS (ST_X/ST_Y) de obtenerDireccionCheckout en el back.
 *
 * REQUISITOS:
 *   - El usuario DEBE tener al menos 1 dirección en la BD
 *   - El usuario DEBE tener al menos 1 método de pago en la BD
 *   - El carrito NO puede estar vacío
 *   - Llama a la función SQL procesar_checkout() que es una transacción atómica
 */
export async function checkoutApi(idDireccion?: number, idMetodoPago?: number) {
  return api<{
    mensaje: string;
    pedido: { id: number; total: number; estado_pedido: string; fecha_pedido: string };
  }>("/comprador/carrito/checkout", {
    method: "POST",
    body: JSON.stringify({
      id_direccion: idDireccion ?? null,
      id_metodo_pago: idMetodoPago ?? null,
    }),
  });
}

/**
 * GET /comprador/mis-pedidos
 * Historial de pedidos del comprador autenticado.
 * Devuelve pedidos con items, total, estado, snapshots de dirección y método de pago.
 */
export async function getPedidosCompradorApi(): Promise<Order[]> {
  const data = await api<{
    status: string;
    pedidos: Array<{
      id: number;
      folio: string;
      fecha: string;
      total: number;
      estado: string;
      direccion: any;
      metodo_pago: any;
      items: Array<{
        id: number;
        tipo: string;
        nombre: string;
        cantidad: number;
        precio: number;
        subtotal: number;
        imagen: string | null;
      }>;
    }>;
  }>("/comprador/mis-pedidos");

  return data.pedidos.map((p) => ({
    id: String(p.id),
    folio: p.folio,
    date: p.fecha
      ? new Date(p.fecha).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    total: Number(p.total) || 0,
    status: p.estado ?? "Pendiente",
    buyerName: "",
    buyerId: "",
    address: p.direccion
      ? `${p.direccion.calle ?? ""}, ${p.direccion.ciudad ?? ""}, ${p.direccion.estado ?? ""} ${p.direccion.codigo_postal ?? ""}, ${p.direccion.pais ?? ""}`
      : "",
    paymentMethod: p.metodo_pago
      ? `${p.metodo_pago.proveedor_pago ?? "Tarjeta"} ****${p.metodo_pago.ultimos_cuatro ?? ""}`
      : undefined,
    items: p.items.map((item) => ({
      product: {
        id: String(item.id),
        name: item.nombre,
        description: "",
        price: Number(item.precio) || 0,
        image: item.imagen ?? "https://placehold.co/400x400?text=Producto",
        images: [],
        category: "general",
        rating: 0,
        reviewCount: 0,
        stock: 0,
        sellerId: "0",
        sellerName: "",
        reviews: [],
        type: item.tipo as "producto" | "servicio",
        status: "Aprobado" as const,
      },
      quantity: Number(item.cantidad) || 1,
    })),
  }));
}

export interface ResumenCompras {
  total_pedidos: number;
  total_gastado: number;
  promedio_compra: number;
  pedidos_entregados: number;
  pedidos_cancelados: number;
  productos_mas_comprados: Array<{ nombre: string; veces_comprado: number; total_unidades: number }>;
  compras_por_mes: Array<{ mes: string; cantidad_pedidos: number; total: number }>;
}

/**
 * GET /comprador/mi-resumen-compras
 * Devuelve estadísticas de compras del usuario activo.
 */
export async function getResumenComprasApi(): Promise<ResumenCompras> {
  const data = await api<{ status: string; resumen: ResumenCompras }>("/comprador/mi-resumen-compras");
  return data.resumen;
}

/**
 * PUT /comprador/mis-pedidos/:pedidoId/cancelar
 * Cancela un pedido que está en estado PENDIENTE o EN PREPARACION, devolviendo el stock.
 */
export async function cancelarPedidoApi(pedidoId: string | number): Promise<{ status: string; mensaje: string }> {
  return api(`/comprador/mis-pedidos/${pedidoId}/cancelar`, {
    method: "PUT",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL VENDEDOR (requiere sesión de vendedor)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/vendedor/pedidos
 * Response: { status: "success", pedidos: [...] }
 * Versión mapeada → devuelve Order[] (para reuso en otros componentes).
 */
export async function getPedidosVendedorApi(): Promise<Order[]> {
  const data = await api<{ pedidos: RawPedido[] }>("/api/vendedor/pedidos");
  return data.pedidos.map(mapPedidoVendedor);
}

/** Interfaz raw de un pedido del vendedor (sin mapear, con todos los campos del backend) */
export interface RawVendorOrder {
  id: number;
  folio: string;
  date: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  total: number;
  status: string;
  address: any;
  items: Array<{ id: number; type: string; name: string; quantity: number; price: number; subtotal: number }>;
}

/**
 * GET /api/vendedor/pedidos — versión RAW
 * Devuelve los datos tal cual del backend, sin mapear a Order[].
 * Usado por seller/orders.tsx que necesita campos como buyerEmail.
 */
export async function getPedidosVendedorRawApi(): Promise<RawVendorOrder[]> {
  const data = await api<{ pedidos: RawVendorOrder[] }>("/api/vendedor/pedidos");
  return data.pedidos || [];
}

/**
 * PUT /api/vendedor/pedidos/:pedidoId/estado
 * Body: { estado: "PENDIENTE" | "EN PREPARACION" | "ENVIADO" | "ENTREGADO" | "CANCELADO" }
 * Usado por seller/orders.tsx para cambiar el estado de un pedido.
 */
export async function updateEstadoPedidoApi(
  pedidoId: number,
  estado: "PENDIENTE" | "EN PREPARACION" | "ENVIADO" | "ENTREGADO" | "CANCELADO"
): Promise<void> {
  await api(`/api/vendedor/pedidos/${pedidoId}/estado`, {
    method: "PUT",
    body: JSON.stringify({ estado }),
  });
}

/**
 * GET /api/vendedor/pedidos/estadisticas
 * Devuelve resumen de ventas del vendedor autenticado.
 * Usado por seller/sales.tsx para KPIs y gráficas.
 */
export async function getEstadisticasVendedorApi() {
  return api<{
    estadisticas: {
      por_estado: Array<{ estado_pedido: string; cantidad: string; total_ventas: string }>;
      ventas_mensuales: Array<{ mes: string; cantidad_pedidos: string; total_ventas: string }>;
      total_pedidos: number;
      total_ventas: number;
    };
  }>("/api/vendedor/pedidos/estadisticas");
}

/**
 * Falta por invocar — Falta conectar en vendedor/products.tsx
 *
 * GET /api/vendedor/productos/:id_negocio
 * Response: [{ id, id_negocio, nombre, descripcion, precio, stock_total, sku, esta_activo, fecha_registro }]
 *
 * Devuelve array directo (NO envuelto en objeto).
 */
export async function getProductosVendedorApi(idNegocio: number) {
  return api<
    Array<{
      id: number;
      id_negocio: number;
      nombre: string;
      descripcion: string | null;
      precio: number;
      stock_total: number;
      sku: string | null;
      esta_activo: boolean;
      fecha_registro: string;
      id_categoria?: number | null;
      imagen_principal?: string | null;
    }>
  >(`/api/vendedor/productos/${idNegocio}`);
}

/**
 * Falta por invocar — Falta conectar en vendedor/products.tsx
 *
 * POST /api/vendedor/productos
 * Body: { nombre, descripcion?, precio, id_negocio, sku? }
 * Response: { id, id_negocio, nombre, descripcion, precio, stock_total, sku, esta_activo, fecha_registro }
 *
 * El backend verifica que el negocio existe antes de crear.
 * Si el SKU ya existe → 409 "SKU duplicado".
 */
export async function createProductoVendedorApi(datos: {
  nombre: string;
  descripcion?: string;
  precio: number;
  id_negocio: number;
  sku?: string;
  stock_total?: number;
  imagenes?: string[];
  id_descuento?: number;
}) {
  return api("/api/vendedor/productos", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/**
 * Falta por invocar — Falta conectar en vendedor/products.tsx
 *
 * PUT /api/vendedor/productos/:id
 * Body: { nombre, descripcion?, precio, sku?, esta_activo? }
 * Response: { id, id_negocio, nombre, descripcion, precio, stock_total, sku, esta_activo, fecha_registro }
 *
 * NOTA: El backend también acepta "sku" en el PUT, lo añadimos al tipo.
 */
export async function updateProductoVendedorApi(
  id: number,
  datos: {
    nombre: string;
    descripcion?: string;
    precio: number;
    sku?: string;
    esta_activo?: boolean;
    stock_total?: number;
    imagenes?: string[];
  }
) {
  return api(`/api/vendedor/productos/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

/**
 * Falta por invocar — Falta conectar en vendedor/products.tsx
 *
 * DELETE /api/vendedor/productos/:id
 * Response: { message: "Producto eliminado" }
 *
 * Es un soft-delete: marca esta_activo = FALSE.
 */
export async function deleteProductoVendedorApi(id: number) {
  return api(`/api/vendedor/productos/${id}`, { method: "DELETE" });
}

export async function updateProductoCategoriasVendedorApi(id: number, idCategorias: number[]) {
  return api(`/api/vendedor/productos/${id}/categorias`, {
    method: "PUT",
    body: JSON.stringify({ id_categorias: idCategorias }),
  });
}

/**
 * Falta por invocar — Falta conectar en vendedor/services.tsx
 *
 * GET /api/vendedor/servicios/:id_negocio
 * Response: [{ id, id_negocio, nombre, descripcion, precio_base, duracion_minutos, calificacion, esta_activo, fecha_registro }]
 */
export async function getServiciosVendedorApi(idNegocio: number) {
  return api<
    Array<{
      id: number;
      id_negocio: number;
      nombre: string;
      descripcion: string | null;
      precio_base: number;
      duracion_minutos: number | null;
      calificacion: number | null;
      esta_activo: boolean;
      fecha_registro: string;
      id_categoria?: number | null;
      imagen_principal?: string | null;
    }>
  >(`/api/vendedor/servicios/${idNegocio}`);
}

/**
 * Falta por invocar — Falta conectar en vendedor/services.tsx
 *
 * POST /api/vendedor/servicios
 * Body: { nombre, descripcion?, precio_base, duracion_minutos?, id_negocio }
 */
export async function createServicioVendedorApi(datos: {
  nombre: string;
  descripcion?: string;
  precio_base: number;
  duracion_minutos?: number;
  id_negocio: number;
  imagenes?: string[];
  id_descuento?: number;
}) {
  return api("/api/vendedor/servicios", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/**
 * Falta por invocar — Falta conectar en vendedor/services.tsx
 *
 * PUT /api/vendedor/servicios/:id
 * Body: { nombre, descripcion?, precio_base, duracion_minutos?, esta_activo? }
 */
export async function updateServicioVendedorApi(
  id: number,
  datos: {
    nombre: string;
    descripcion?: string;
    precio_base: number;
    duracion_minutos?: number;
    esta_activo?: boolean;
    imagenes?: string[];
  }
) {
  return api(`/api/vendedor/servicios/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

/**
 * Falta por invocar — Falta conectar en vendedor/services.tsx
 *
 * DELETE /api/vendedor/servicios/:id
 * Response: { message: "Servicio eliminado" }
 *
 * Soft-delete: marca esta_activo = FALSE.
 */
export async function deleteServicioVendedorApi(id: number) {
  return api(`/api/vendedor/servicios/${id}`, { method: "DELETE" });
}

export async function updateServicioCategoriasVendedorApi(id: number, idCategorias: number[]) {
  return api(`/api/vendedor/servicios/${id}/categorias`, {
    method: "PUT",
    body: JSON.stringify({ id_categorias: idCategorias }),
  });
}



/**
 * GET /api/vendedor/negocio
 */
export async function getNegocioVendedorApi() {
  return api<{
    status: string;
    negocio: {
      id: number;
      id_usuario: number;
      nombre_comercial: string;
      rfc_tax_id: string | null;
      logo_url: string | null;
      direccion: {
        id: number;
        calle: string;
        ciudad: string;
        estado: string;
        codigo_postal: string;
        pais: string;
        latitud: number;
        longitud: number;
      }
    }
  }>("/api/vendedor/negocio");
}

/**
 * POST /api/vendedor/negocio
 */
export async function createNegocioVendedorApi(datos: {
  nombre_comercial: string;
  rfc_tax_id?: string;
  logo_url?: string;
  calle: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais: string;
  latitud: number;
  longitud: number;
}) {
  return api<{ status: string; mensaje: string; negocio: any }>("/api/vendedor/negocio", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/**
 * PUT /api/vendedor/negocio
 * Actualiza los datos del negocio existente.
 */
export async function updateNegocioVendedorApi(datos: {
  nombre_comercial: string;
  rfc_tax_id?: string;
  logo_url?: string;
  calle: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais: string;
  latitud: number;
  longitud: number;
}) {
  return api<{ status: string; mensaje: string; negocio: any }>("/api/vendedor/negocio", {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO COMPRADOR: Listados globales y ofertas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /comprador/productos
 * Listado global de productos (sin filtrar por categoría).
 */
export async function getProductosGlobalApi(
  filtros?: {
    q?: string;
    precio_min?: number;
    precio_max?: number;
    calificacion_min?: number;
    ordenar?: string;
  }
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.precio_min !== undefined) params.set("precio_min", String(filtros.precio_min));
  if (filtros?.precio_max !== undefined) params.set("precio_max", String(filtros.precio_max));
  if (filtros?.calificacion_min !== undefined) params.set("calificacion_min", String(filtros.calificacion_min));
  if (filtros?.ordenar) params.set("ordenar", filtros.ordenar);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await api<{ productos: RawProductoLista[] }>(`/comprador/productos${query}`);
  return data.productos.map(mapProductoLista);
}

/**
 * GET /comprador/servicios
 * Listado global de servicios (sin filtrar por categoría).
 */
export async function getServiciosGlobalApi(
  filtros?: {
    q?: string;
    precio_min?: number;
    precio_max?: number;
    calificacion_min?: number;
    ordenar?: string;
  }
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.precio_min !== undefined) params.set("precio_min", String(filtros.precio_min));
  if (filtros?.precio_max !== undefined) params.set("precio_max", String(filtros.precio_max));
  if (filtros?.calificacion_min !== undefined) params.set("calificacion_min", String(filtros.calificacion_min));
  if (filtros?.ordenar) params.set("ordenar", filtros.ordenar);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await api<{ servicios: RawProductoLista[] }>(`/comprador/servicios${query}`);
  return data.servicios.map((raw) => {
    const p = mapProductoLista(raw);
    return { ...p, type: "servicio" as const };
  });
}

/**
 * GET /comprador/productos/descuentos
 * Productos con descuento activo.
 */
export async function getProductosConDescuentoApi(): Promise<Product[]> {
  const data = await api<{ total: number; productos: RawProductoLista[] }>("/comprador/productos/descuentos");
  return data.productos.map(mapProductoLista);
}

/**
 * GET /comprador/servicios/descuentos
 * Servicios con descuento activo.
 */
export async function getServiciosConDescuentoApi(): Promise<Product[]> {
  const data = await api<{ total: number; servicios: RawProductoLista[] }>("/comprador/servicios/descuentos");
  return data.servicios.map((raw) => {
    const p = mapProductoLista(raw);
    return { ...p, type: "servicio" as const };
  });
}

/**
 * GET /:perfil/mis-pedidos/:pedidoId
 * Detalle de un pedido individual del comprador.
 */
export async function getPedidoDetalleCompradorApi(pedidoId: string | number) {
  return api<{ status: string; pedido: any }>(`/comprador/mis-pedidos/${pedidoId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: CATÁLOGO (moderación de productos y servicios)
// ─────────────────────────────────────────────────────────────────────────────

export type AdminCatalogItem = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  precio?: number;
  precio_base?: number;
  precio_con_descuento?: number | null;
  id_descuento?: number | null;
  stock_total?: number;
  esta_activo: boolean;
  estado_catalogo: "Aprobado" | "Rechazado" | string;
  fecha_registro: string;
  negocio: string;
};

export async function getAdminCatalogoProductosApi(): Promise<AdminCatalogItem[]> {
  const data = await api<{
    status: string;
    total: number;
    productos: AdminCatalogItem[];
  }>("/admin/catalogo/productos");
  return data.productos;
}

export async function getAdminCatalogoServiciosApi(): Promise<AdminCatalogItem[]> {
  const data = await api<{
    status: string;
    total: number;
    servicios: AdminCatalogItem[];
  }>("/admin/catalogo/servicios");
  return data.servicios;
}

export async function updateAdminEstadoProductoApi(
  id: number,
  estado: "APROBADO" | "RECHAZADO"
) {
  return api<{ status: string; mensaje: string; data: AdminCatalogItem }>(
    `/admin/catalogo/productos/${id}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    }
  );
}

export async function updateAdminEstadoServicioApi(
  id: number,
  estado: "APROBADO" | "RECHAZADO"
) {
  return api<{ status: string; mensaje: string; data: AdminCatalogItem }>(
    `/admin/catalogo/servicios/${id}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: REPORTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapper: traduce el estado de la BD (UPPERCASE) al texto legible del frontend.
 * Ej: "ADVERTENCIA_FORMAL" → "Advertencia formal"
 */
const ESTADO_REPORTE_MAP: Record<string, string> = {
  PENDIENTE: "Pendiente",
  REVISADO: "Revisado",
  RESUELTO: "Resuelto",
  ADVERTENCIA_FORMAL: "Advertencia formal",
  SUSPENSION_TEMPORAL: "Suspensión temporal",
  BLOQUEO_PERMANENTE: "Bloqueo permanente",
  DESESTIMADO: "Desestimado",
  CONTENIDO_ELIMINADO: "Contenido eliminado",
};

/** Convierte un estado UPPERCASE de la BD a texto legible para el frontend */
export function mapEstadoReporte(estadoBd: string): string {
  return ESTADO_REPORTE_MAP[estadoBd] ?? estadoBd;
}

/** Convierte texto legible del frontend al formato UPPERCASE de la BD */
const ESTADO_REPORTE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(ESTADO_REPORTE_MAP).map(([k, v]) => [v, k])
);
export function mapEstadoReporteToBack(estadoFront: string): string {
  return ESTADO_REPORTE_REVERSE[estadoFront] ?? estadoFront.toUpperCase().replace(/ /g, "_");
}

/** Reporte crudo del backend */
export interface RawReporteAdmin {
  id: number;
  id_usuario: number;
  id_negocio: number;
  negocio: string;
  id_producto: number | null;
  id_servicio: number | null;
  tipo_objetivo: "producto" | "servicio";
  id_objetivo: number;
  nombre_objetivo: string;
  motivo: string;
  descripcion: string;
  estado_reporte: string;
  fecha_creacion: string;
  fecha_resolucion: string | null;
}

/** GET /admin/reportes — Lista todos los reportes */
export async function getReportesAdminApi() {
  const data = await api<{
    status: string;
    total: number;
    reportes: RawReporteAdmin[];
  }>("/admin/reportes");
  return data.reportes.map((r) => ({ ...r, estado_reporte: mapEstadoReporte(r.estado_reporte) }));
}

/** PATCH /admin/reportes/:id/estado — Cambio libre de estado */
export async function updateEstadoReporteApi(id: number, estado: string) {
  return api<{ status: string; mensaje: string; reporte: any }>(`/admin/reportes/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado: mapEstadoReporteToBack(estado) }),
  });
}

/** POST /admin/reportes/:id/desestimar */
export async function desestimarReporteApi(id: number, razon: string) {
  return api<{ status: string; mensaje: string }>(`/admin/reportes/${id}/desestimar`, {
    method: "POST",
    body: JSON.stringify({ razon }),
  });
}

/** POST /admin/reportes/:id/advertencia */
export async function advertenciaReporteApi(id: number) {
  return api<{ status: string; mensaje: string }>(`/admin/reportes/${id}/advertencia`, {
    method: "POST",
  });
}

/** POST /admin/reportes/:id/suspension */
export async function suspensionReporteApi(id: number, dias: number) {
  return api<{ status: string; mensaje: string }>(`/admin/reportes/${id}/suspension`, {
    method: "POST",
    body: JSON.stringify({ dias }),
  });
}

/** POST /admin/reportes/:id/bloqueo */
export async function bloqueoReporteApi(id: number, razon: string) {
  return api<{ status: string; mensaje: string }>(`/admin/reportes/${id}/bloqueo`, {
    method: "POST",
    body: JSON.stringify({ razon }),
  });
}

/** POST /admin/reportes/:id/eliminar-contenido */
export async function eliminarContenidoReporteApi(id: number, razon: string) {
  return api<{ status: string; mensaje: string }>(`/admin/reportes/${id}/eliminar-contenido`, {
    method: "POST",
    body: JSON.stringify({ razon }),
  });
}

/** DELETE /admin/reportes/:id */
export async function deleteReporteApi(id: number) {
  return api<{ status: string; mensaje: string }>(`/admin/reportes/${id}`, { method: "DELETE" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: USUARIOS
// ─────────────────────────────────────────────────────────────────────────────

/** Usuario crudo del backend admin */
export interface RawAdminUsuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  id_rol: number;
  rol: string;
  activo: boolean;
  fecha_registro: string;
  fecha_eliminacion: string | null;
}

/** GET /admin/usuarios */
export async function getUsuariosAdminApi(filtros?: { q?: string; rol?: string; activo?: string }) {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.rol) params.set("rol", filtros.rol);
  if (filtros?.activo !== undefined) params.set("activo", filtros.activo);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api<{
    status: string;
    total: number;
    usuarios: RawAdminUsuario[];
  }>(`/admin/usuarios${query}`);
}

/** PATCH /admin/usuarios/:id/estado — Activar / Desactivar */
export async function updateEstadoUsuarioApi(id: number, estado: "ACTIVO" | "INACTIVO") {
  return api<{ status: string; mensaje: string; data: any }>(`/admin/usuarios/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

/** PATCH /admin/usuarios/:id/rol — Reasignar rol */
export async function updateRolUsuarioApi(id: number, idRol: number) {
  return api<{ status: string; mensaje: string; data: any }>(`/admin/usuarios/${id}/rol`, {
    method: "PATCH",
    body: JSON.stringify({ id_rol: idRol }),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: CATEGORÍAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/categorias
 * Lista todas las categorías del sistema.
 */
export async function getCategoriasAdminApi() {
  return api<{
    status: string;
    total: number;
    categorias: Array<{ id: number; nombre_categoria: string; tipo: string }>;
  }>("/admin/categorias");
}

/**
 * POST /admin/categorias
 * Crea una nueva categoría.
 */
export async function createCategoriaAdminApi(datos: {
  nombre_categoria: string;
  tipo: string;
}) {
  return api<{ status: string; mensaje: string; data: any }>("/admin/categorias", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/**
 * PUT /admin/categorias/:id
 * Actualiza una categoría existente.
 */
export async function updateCategoriaAdminApi(
  id: number,
  datos: { nombre_categoria: string; tipo: string }
) {
  return api<{ status: string; mensaje: string; data: any }>(`/admin/categorias/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

/**
 * DELETE /admin/categorias/:id
 * Elimina una categoría.
 */
export async function deleteCategoriaAdminApi(id: number) {
  return api<{ status: string; mensaje: string; data: any }>(`/admin/categorias/${id}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDEDOR: CATEGORÍAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/vendedor/categorias
 * Crea una categoría nueva desde el panel vendedor.
 */
export async function createCategoriaVendedorApi(datos: {
  nombre_categoria: string;
  tipo: string;
  descripcion?: string;
  id_padre?: number;
}) {
  return api<{ mensaje: string; categoria: any }>("/api/vendedor/categorias", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/**
 * GET /api/vendedor/categorias/check
 * Verifica si ya existe una categoría con ese nombre y tipo.
 */
export async function checkCategoriaUniquenessApi(nombre: string, tipo: string) {
  return api<{ exists: boolean }>(
    `/api/vendedor/categorias/check?nombre=${encodeURIComponent(nombre)}&tipo=${encodeURIComponent(tipo)}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WISHLIST (requiere sesión activa)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /comprador/wishlist
 * Obtiene (o crea automáticamente) la wishlist única del usuario.
 * Response: { wishlist: { id, id_usuario, nombre, es_publica, fecha_creacion }, total_items }
 */
export async function getWishlistApi() {
  return api<{
    wishlist: {
      id: number;
      id_usuario: number;
      nombre: string;
      es_publica: boolean;
      fecha_creacion: string;
    };
    total_items: number;
  }>("/comprador/wishlist");
}

/**
 * GET /comprador/wishlist/items
 * Obtiene los ítems de la wishlist con información del producto/servicio.
 */
export async function getWishlistItemsApi() {
  return api<{
    lista: {
      id: number;
      id_usuario: number;
      nombre: string;
      es_publica: boolean;
      fecha_creacion: string;
    };
    total_items: number;
    items: Array<{
      id: number;
      id_producto: number | null;
      id_servicio: number | null;
      fecha_agregado: string;
      producto_nombre: string | null;
      producto_precio: number | null;
      producto_activo: boolean | null;
      servicio_nombre: string | null;
      servicio_precio: number | null;
      servicio_activo: boolean | null;
    }>;
  }>("/comprador/wishlist/items");
}

/**
 * POST /comprador/wishlist/items
 * Agrega un producto o servicio a la wishlist.
 * Body: { id_producto: number } | { id_servicio: number }
 */
export async function addToWishlistApi(
  idProducto?: number,
  idServicio?: number
) {
  return api<{
    mensaje: string;
    item: {
      id: number;
      id_lista: number;
      id_producto: number | null;
      id_servicio: number | null;
      fecha_agregado: string;
    };
  }>("/comprador/wishlist/items", {
    method: "POST",
    body: JSON.stringify({
      id_producto: idProducto ?? null,
      id_servicio: idServicio ?? null,
    }),
  });
}

/**
 * DELETE /comprador/wishlist/items/:idItem
 * Elimina un ítem específico de la wishlist.
 */
export async function removeFromWishlistApi(idItem: number) {
  return api<{ mensaje: string }>(
    `/comprador/wishlist/items/${idItem}`,
    { method: "DELETE" }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPRADOR: REPORTES
// ─────────────────────────────────────────────────────────────────────────────

/** Reporte del comprador (respuesta del backend) */
export interface RawReporteComprador {
  id: number;
  id_usuario: number;
  id_negocio: number;
  negocio: string;
  motivo: string;
  descripcion: string;
  estado_reporte: string;
  fecha_creacion: string;
  fecha_resolucion: string | null;
  tipo_objetivo: "producto" | "servicio";
  id_objetivo: number;
  nombre_objetivo: string;
}

/**
 * POST /comprador/reportes
 * Crea un reporte nuevo. Envía solo id_producto O id_servicio, no ambos.
 */
export async function createReporteCompradorApi(datos: {
  id_producto?: number;
  id_servicio?: number;
  motivo: string;
  descripcion: string;
}) {
  return api<{ mensaje: string; reporte: RawReporteComprador }>("/comprador/reportes", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/**
 * GET /comprador/reportes
 * Lista todos los reportes creados por el comprador autenticado.
 */
export async function getReportesCompradorApi() {
  const data = await api<RawReporteComprador[]>("/comprador/reportes");
  return data.map((r) => ({ ...r, estado_reporte: mapEstadoReporte(r.estado_reporte) }));
}

/**
 * GET /comprador/reportes/:id
 * Detalle de un reporte específico del comprador autenticado.
 */
export async function getReporteDetalleCompradorApi(idReporte: number) {
  const data = await api<RawReporteComprador>(`/comprador/reportes/${idReporte}`);
  return { ...data, estado_reporte: mapEstadoReporte(data.estado_reporte) };
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDEDOR: DESCUENTOS
// ─────────────────────────────────────────────────────────────────────────────

/** Datos para crear o editar un descuento */
export interface DescuentoPayload {
  codigo_cupon?: string | null;
  porcentaje_descuento: number;
  fecha_inicio: string;
  fecha_fin: string;
}

/** Descuento devuelto por el backend */
export interface RawDescuento {
  id: number;
  codigo_cupon: string | null;
  porcentaje_descuento: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado_descuento?: string;
}

/** POST /api/vendedor/productos/:id/descuentos — Crear y asignar descuento a un producto */
export async function createDescuentoProductoApi(idProducto: number, datos: DescuentoPayload) {
  return api<{ mensaje: string; producto: any; descuento: RawDescuento }>(
    `/api/vendedor/productos/${idProducto}/descuentos`,
    { method: "POST", body: JSON.stringify(datos) }
  );
}

/** POST /api/vendedor/servicios/:id/descuentos — Crear y asignar descuento a un servicio */
export async function createDescuentoServicioApi(idServicio: number, datos: DescuentoPayload) {
  return api<{ mensaje: string; servicio: any; descuento: RawDescuento }>(
    `/api/vendedor/servicios/${idServicio}/descuentos`,
    { method: "POST", body: JSON.stringify(datos) }
  );
}

/** PUT /api/vendedor/productos/:id/descuentos/:id_desc — Actualizar descuento de producto */
export async function updateDescuentoProductoApi(idProducto: number, idDescuento: number, datos: Partial<DescuentoPayload>) {
  return api<{ mensaje: string; descuento: RawDescuento }>(
    `/api/vendedor/productos/${idProducto}/descuentos/${idDescuento}`,
    { method: "PUT", body: JSON.stringify(datos) }
  );
}

/** PUT /api/vendedor/servicios/:id/descuentos/:id_desc — Actualizar descuento de servicio */
export async function updateDescuentoServicioApi(idServicio: number, idDescuento: number, datos: Partial<DescuentoPayload>) {
  return api<{ mensaje: string; descuento: RawDescuento }>(
    `/api/vendedor/servicios/${idServicio}/descuentos/${idDescuento}`,
    { method: "PUT", body: JSON.stringify(datos) }
  );
}

/** DELETE /api/vendedor/productos/:id/descuentos/:id_desc — Quitar descuento de un producto */
export async function removeDescuentoProductoApi(idProducto: number, idDescuento: number) {
  return api<{ mensaje: string; producto_id: number; descuento_removido: number }>(
    `/api/vendedor/productos/${idProducto}/descuentos/${idDescuento}`,
    { method: "DELETE" }
  );
}

/** DELETE /api/vendedor/servicios/:id/descuentos/:id_desc — Quitar descuento de un servicio */
export async function removeDescuentoServicioApi(idServicio: number, idDescuento: number) {
  return api<{ mensaje: string; servicio_id: number; descuento_removido: number }>(
    `/api/vendedor/servicios/${idServicio}/descuentos/${idDescuento}`,
    { method: "DELETE" }
  );
}

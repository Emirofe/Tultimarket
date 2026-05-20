import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  Product,
  CartItem,
  Order,
  User,
  Address,
  PaymentMethod,
} from "../data/mock-data";
import {
  loginApi,
  registerApi,
  logoutApi,
  getMiCuentaApi,
  getMisDireccionesApi,
  addDireccionApi,
  deleteDireccionApi,
  getMisMetodosPagoApi,
  getCarritoApi,
  addProductoAlCarritoApi,
  addServicioAlCarritoApi,
  updateItemCarritoApi,
  deleteItemCarritoApi,
  vaciarCarritoApi,
  checkoutApi,
  getNegocioVendedorApi,
  getWishlistItemsApi,
  addToWishlistApi,
  removeFromWishlistApi,
} from "../api/api-client";
import { toImageUrl } from "../api/mappers";

// ─── Tipo extendido del CarritoItem para guardar el id_item del backend ───────
interface CartItemConId extends CartItem {
  idItem?: number; // id del registro en carrito_items de la BD
  cartKey?: string;
}

interface WishlistItemBackend {
  id: number; // id del wishlist_item en la BD
  id_producto: number | null;
  id_servicio: number | null;
  fecha_agregado: string;
  producto_nombre: string | null;
  producto_descripcion: string | null;
  producto_precio: number | null;
  producto_stock: number | null;
  producto_calificacion: number | null;
  producto_activo: boolean | null;
  producto_imagen: string | null;
  producto_id_negocio: number | null;
  producto_vendedor: string | null;
  producto_categoria: string | null;
  servicio_nombre: string | null;
  servicio_descripcion: string | null;
  servicio_precio: number | null;
  servicio_calificacion: number | null;
  servicio_activo: boolean | null;
  servicio_imagen: string | null;
  servicio_id_negocio: number | null;
  servicio_vendedor: string | null;
  servicio_categoria: string | null;
  servicio_horarios_disponibles: number | null;
}

type WishlistProductType = NonNullable<Product["type"]>;

const getWishlistKey = (productId: string, type: WishlistProductType = "producto") => `${type}:${productId}`;

interface StoreState {
  currentUser: User | null;
  cart: CartItemConId[];
  wishlist: Product[];
  wishlistItemsMap: Map<string, number>; // type:id -> wishlist_item.id
  orders: Order[];
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  negocioId: number | null; // Para vendedores: id del negocio vinculado
  isLoggedIn: boolean;
  isLoading: boolean;
  // Auth
  login: (email: string, password: string) => Promise<User | null>;
  register: (name: string, email: string, password: string, role: string) => Promise<boolean>;
  logout: () => Promise<void>;
  // Cart
  addToCart: (product: Product, quantity?: number, agendaSlotId?: string) => Promise<void>;
  removeFromCart: (cartKey: string) => Promise<void>;
  updateCartQuantity: (cartKey: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartTotal: () => number;
  getCartCount: () => number;
  // Wishlist (conectada al backend)
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string, type?: WishlistProductType) => Promise<void>;
  isInWishlist: (productId: string, type?: WishlistProductType) => boolean;
  // Orders
  placeOrder: (address: string, idDireccion?: number, idMetodoPago?: number, codigoCupon?: string | null) => Promise<Order>;
  // Addresses
  addAddress: (address: Omit<Address, "id"> & { latitud?: number; longitud?: number }) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  reloadAddresses: () => Promise<void>;
  reloadPaymentMethods: () => Promise<void>;
  updateNegocioId: (id: number) => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItemConId[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [wishlistItemsMap, setWishlistItemsMap] = useState<Map<string, number>>(new Map());
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [negocioId, setNegocioId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const formatAgendaDate = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("es-MX", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : undefined;

  const formatAgendaTime = (value?: string) =>
    value
      ? new Date(value).toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined;

  // ─── Carga el carrito desde el backend ───────────────────────────────────
  const reloadCart = useCallback(async () => {
    try {
      const carritoData = await getCarritoApi();
      const newCart: CartItemConId[] = carritoData.items.map((item) => ({
        idItem: item.id_item,
        cartKey: String(item.id_item),
        product: {
          id: String(item.id_producto ?? item.id_servicio ?? 0),
          name: item.nombre,
          description: "",
          price: Number(item.precio_unitario) || 0,
          image: toImageUrl(item.imagen ?? null),
          images: [],
          category: "general",
          rating: 0,
          reviewCount: 0,
          stock: item.tipo_item === "servicio" ? 99 : (Number(item.stock_maximo) > 0 ? Number(item.stock_maximo) : 99),
          sellerId: "0",
          sellerName: item.empresa,
          reviews: [],
          type: item.tipo_item,
          status: "Aprobado" as const,
        },
        quantity: Number(item.cantidad) || 1,
        agendaSlotId: item.agenda?.id_agenda ? String(item.agenda.id_agenda) : undefined,
        selectedDate: formatAgendaDate(item.agenda?.fecha_hora_inicio),
        selectedTime: formatAgendaTime(item.agenda?.fecha_hora_inicio),
        selectedEndTime: formatAgendaTime(item.agenda?.fecha_hora_fin),
      }));
      setCart(newCart);
    } catch {
      // Si falla (no logueado o carrito vacío) no hacemos nada
    }
  }, []);

  // ─── Carga las direcciones del backend ───────────────────────────────────
  const reloadAddresses = useCallback(async () => {
    try {
      const dirs = await getMisDireccionesApi();
      setAddresses(dirs);
    } catch {
      setAddresses([]);
    }
  }, []);

  // ─── Carga los métodos de pago del backend ───────────────────────────────
  const reloadPaymentMethods = useCallback(async () => {
    try {
      const metodos = await getMisMetodosPagoApi();
      setPaymentMethods(metodos);
    } catch {
      setPaymentMethods([]);
    }
  }, []);

  // ─── Carga la wishlist desde el backend ───────────────────────────────────
  const reloadWishlist = useCallback(async () => {
    try {
      const data = await getWishlistItemsApi();
      const newMap = new Map<string, number>();
      const products: Product[] = data.items.map((item) => {
        const isProduct = item.id_producto !== null;
        const itemType: WishlistProductType = isProduct ? "producto" : "servicio";
        const productId = String(item.id_producto ?? item.id_servicio ?? 0);
        const image = isProduct ? item.producto_imagen : item.servicio_imagen;
        const rating = Number((isProduct ? item.producto_calificacion : item.servicio_calificacion) ?? 0);
        const isActive = Boolean(isProduct ? item.producto_activo : item.servicio_activo);
        const serviceSlots = Number(item.servicio_horarios_disponibles ?? 0);
        newMap.set(getWishlistKey(productId, itemType), item.id);
        return {
          id: productId,
          name: (isProduct ? item.producto_nombre : item.servicio_nombre) ?? "Sin nombre",
          description: (isProduct ? item.producto_descripcion : item.servicio_descripcion) ?? "",
          price: Number((isProduct ? item.producto_precio : item.servicio_precio) ?? 0),
          image: toImageUrl(image),
          images: [toImageUrl(image)],
          category: (isProduct ? item.producto_categoria : item.servicio_categoria) ?? "general",
          rating,
          reviewCount: 0,
          stock: isActive ? (isProduct ? Number(item.producto_stock ?? 0) : serviceSlots) : 0,
          sellerId: String((isProduct ? item.producto_id_negocio : item.servicio_id_negocio) ?? 0),
          sellerName: (isProduct ? item.producto_vendedor : item.servicio_vendedor) ?? "",
          reviews: [],
          type: itemType,
          availability: isProduct
            ? undefined
            : !isActive
              ? "No disponible"
              : serviceSlots > 0
              ? `${serviceSlots} horario${serviceSlots !== 1 ? "s" : ""} disponible${serviceSlots !== 1 ? "s" : ""}`
              : "Sin horarios disponibles",
          status: "Aprobado" as const,
        };
      });
      setWishlist(products);
      setWishlistItemsMap(newMap);
    } catch {
      // Si falla (no logueado) no hacemos nada
    }
  }, []);

  // ─── AUTH ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string): Promise<User | null> => {
    setIsLoading(true);
    try {
      const userWithNegocio = await loginApi(email, password);
      setCurrentUser(userWithNegocio);
      // Si es vendedor, obtener negocioId desde el endpoint del vendedor
      if (userWithNegocio.role === "vendedor") {
        try {
          const negocioData = await getNegocioVendedorApi();
          setNegocioId(negocioData.negocio.id);
        } catch {
          // El vendedor aún no tiene negocio creado, es normal
        }
      }
      // Cargar datos del usuario al loguearse
      await reloadCart();
      await reloadAddresses();
      await reloadPaymentMethods();
      await reloadWishlist();
      return userWithNegocio;
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [reloadCart, reloadAddresses, reloadPaymentMethods, reloadWishlist]);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    role: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      await registerApi(name, email, password, role as "comprador" | "vendedor");
      // Después del registro, hacer login automático
      const user = await loginApi(email, password);
      setCurrentUser(user);
      return true;
    } catch (error) {
      console.error("Error al registrar:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch {
      // Ignoramos errores de logout (el back puede redirigir)
    } finally {
      setCurrentUser(null);
      setCart([]);
      setWishlist([]);
      setWishlistItemsMap(new Map());
      setOrders([]);
      setAddresses([]);
      setPaymentMethods([]);
      setNegocioId(null);
      setIsLoading(false);
    }
  }, []);

  // ─── CARRITO ──────────────────────────────────────────────────────────────

  const addToCart = useCallback(async (
    product: Product,
    quantity = 1,
    agendaSlotId?: string
  ) => {
    if (product.type === "servicio" && !agendaSlotId) {
      throw new Error("Selecciona un horario disponible para agendar este servicio");
    }

    if (
      currentUser?.role === "vendedor" &&
      negocioId &&
      (product.businessId === String(negocioId) || product.sellerId === String(negocioId))
    ) {
      throw new Error("No puedes comprar tus propios productos o servicios");
    }

    if (!currentUser) {
      if (product.type === "servicio") {
        throw new Error("Inicia sesion para agendar servicios");
      }

      // Si no está logueado, mostrar en local temporalmente
      setCart((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id
              ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock || 99) }
              : i
          );
        }
        return [...prev, { product, quantity }];
      });
      return;
    }

    try {
      if (product.type === "servicio") {
        await addServicioAlCarritoApi(Number(product.id), 1, Number(agendaSlotId));
      } else {
        await addProductoAlCarritoApi(Number(product.id), quantity);
      }
      await reloadCart();
    } catch (error) {
      console.error("Error al agregar al carrito:", error);
      throw error; // Propaga para que la página pueda mostrar el error
    }
  }, [currentUser, negocioId, reloadCart]);

  const removeFromCart = useCallback(async (cartKey: string) => {
    const item = cart.find((i) => (i.cartKey ?? i.product.id) === cartKey || i.product.id === cartKey);
    if (!item?.idItem || !currentUser) {
      // Local (no logueado)
      setCart((prev) => prev.filter((i) => (i.cartKey ?? i.product.id) !== cartKey && i.product.id !== cartKey));
      return;
    }
    try {
      await deleteItemCarritoApi(item.idItem);
      await reloadCart();
    } catch (error) {
      console.error("Error al eliminar del carrito:", error);
    }
  }, [cart, currentUser, reloadCart]);

  const updateCartQuantity = useCallback(async (cartKey: string, quantity: number) => {
    const item = cart.find((i) => (i.cartKey ?? i.product.id) === cartKey || i.product.id === cartKey);
    if (quantity <= 0) {
      await removeFromCart(cartKey);
      return;
    }
    if (!item?.idItem || !currentUser) {
      // Local
      setCart((prev) =>
        prev.map((i) => (i.cartKey ?? i.product.id) === cartKey ? { ...i, quantity } : i)
      );
      return;
    }
    try {
      await updateItemCarritoApi(item.idItem, quantity);
      await reloadCart();
    } catch (error) {
      console.error("Error al actualizar carrito:", error);
    }
  }, [cart, currentUser, removeFromCart, reloadCart]);

  const clearCart = useCallback(async () => {
    if (!currentUser) {
      setCart([]);
      return;
    }
    try {
      await vaciarCarritoApi();
      setCart([]);
    } catch (error) {
      console.error("Error al vaciar carrito:", error);
    }
  }, [currentUser]);

  const getCartTotal = useCallback(() => {
    return cart.reduce((sum, item) => sum + (Number(item.product.price) || 0) * (Number(item.quantity) || 0), 0);
  }, [cart]);

  const getCartCount = useCallback(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // ─── WISHLIST (conectada al backend) ───────────────────────────────────────

  const addToWishlist = useCallback(async (product: Product) => {
    if (!currentUser) {
      // Fallback local si no hay sesión
      setWishlist((prev) => {
        if (prev.find((p) => p.id === product.id)) return prev;
        return [...prev, product];
      });
      return;
    }
    try {
      const isService = product.type === "servicio";
      await addToWishlistApi(
        isService ? undefined : Number(product.id),
        isService ? Number(product.id) : undefined
      );
      await reloadWishlist();
    } catch (error: any) {
      if (error?.message?.includes("ya existe")) {
        return;
      }
      console.error("Error al agregar a wishlist:", error);
      throw error;
    }
  }, [currentUser, reloadWishlist]);

  const removeFromWishlist = useCallback(async (productId: string, type?: WishlistProductType) => {
    if (!currentUser) {
      setWishlist((prev) => prev.filter((p) => p.id !== productId || (type ? p.type !== type : false)));
      return;
    }
    const wishlistItemId =
      wishlistItemsMap.get(getWishlistKey(productId, type ?? "producto")) ??
      wishlistItemsMap.get(getWishlistKey(productId, "servicio"));
    if (!wishlistItemId) {
      setWishlist((prev) => prev.filter((p) => p.id !== productId || (type ? p.type !== type : false)));
      return;
    }
    try {
      await removeFromWishlistApi(wishlistItemId);
      await reloadWishlist();
    } catch (error) {
      console.error("Error al eliminar de wishlist:", error);
    }
  }, [currentUser, wishlistItemsMap, reloadWishlist]);

  const isInWishlist = useCallback(
    (productId: string, type?: WishlistProductType) => wishlist.some((p) => p.id === productId && (!type || p.type === type)),
    [wishlist]
  );

  // ─── PEDIDOS ──────────────────────────────────────────────────────────────

  const placeOrder = useCallback(async (
    _address: string,
    idDireccion?: number,
    idMetodoPago?: number,
    codigoCupon?: string | null
  ): Promise<Order> => {
    setIsLoading(true);
    try {
      const result = await checkoutApi(idDireccion, idMetodoPago, codigoCupon);
      const newOrder: Order = {
        id: String(result.pedido.id),
        folio: `ORD-${result.pedido.id}`,
        date: result.pedido.fecha_pedido
          ? new Date(result.pedido.fecha_pedido).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        items: [...cart],
        total: result.pedido.total,
        status: "En preparacion",
        buyerName: currentUser?.name ?? "Usuario",
        buyerId: currentUser?.id ?? "0",
        address: _address,
        cupon: result.cupon ?? null,
      };
      setOrders((prev) => [newOrder, ...prev]);
      setCart([]);
      return newOrder;
    } finally {
      setIsLoading(false);
    }
  }, [cart, currentUser]);

  // ─── DIRECCIONES ──────────────────────────────────────────────────────────

  const addAddress = useCallback(async (address: Omit<Address, "id"> & { latitud?: number; longitud?: number }) => {
    if (!currentUser) {
      setAddresses((prev) => [...prev, { ...address, id: `a${Date.now()}` }]);
      return;
    }
    try {
      await addDireccionApi(address);
      await reloadAddresses();
    } catch (error) {
      console.error("Error al agregar dirección:", error);
      throw error;
    }
  }, [currentUser, reloadAddresses]);

  const removeAddress = useCallback(async (id: string) => {
    if (!currentUser) {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      return;
    }
    try {
      await deleteDireccionApi(Number(id));
      await reloadAddresses();
    } catch (error) {
      console.error("Error al eliminar dirección:", error);
      throw error;
    }
  }, [currentUser, reloadAddresses]);

  // ─── Verifica si hay sesión activa al cargar la app ───────────────────────
  useEffect(() => {
    getMiCuentaApi()
      .then(async (user) => {
        setCurrentUser(user);
        // Restaurar id_negocio si es vendedor
        if (user.role === "vendedor") {
          try {
            const negocioData = await getNegocioVendedorApi();
            setNegocioId(negocioData.negocio.id);
          } catch {
            // El vendedor aún no tiene negocio creado
          }
        }
        await reloadCart();
        await reloadAddresses();
        await reloadPaymentMethods();
        await reloadWishlist();
      })
      .catch(() => {
        // No hay sesión activa, es normal
      });
  }, [reloadCart, reloadAddresses, reloadPaymentMethods, reloadWishlist]);

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        cart,
        wishlist,
        wishlistItemsMap,
        orders,
        addresses,
        paymentMethods,
        negocioId,
        isLoggedIn: !!currentUser,
        isLoading,
        login,
        register,
        logout,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        placeOrder,
        addAddress,
        removeAddress,
        reloadAddresses,
        reloadPaymentMethods,
        updateNegocioId: setNegocioId,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}

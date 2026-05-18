import { useEffect, useState } from "react";
import { Link } from "react-router";
import { 
  Package, ChevronDown, ChevronUp, Calendar, Loader2, 
  CreditCard, MapPin, AlertCircle, ShoppingBag, DollarSign, Ban, Clock, Tag, ReceiptText
} from "lucide-react";
import { useStore } from "../context/store-context";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { getPedidosCompradorApi, getResumenComprasApi, cancelarPedidoApi, type ResumenCompras } from "../api/api-client";
import type { Order } from "../data/mock-data";

/**
 * Mis Compras — Muestra las compras personales y el resumen de gastos.
 */
export function OrderHistoryPage() {
  const { currentUser } = useStore();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<ResumenCompras | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState<string | null>(null); // Guarda el ID del pedido que se está cancelando

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      // Cargamos en paralelo ambas llamadas
      const [ordersData, summaryData] = await Promise.all([
        getPedidosCompradorApi(),
        getResumenComprasApi().catch((err) => {
          console.warn("Fallo al cargar resumen, pero continuamos con pedidos:", err);
          return null; // El resumen no debe bloquear los pedidos
        })
      ]);
      setMyOrders(ordersData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Error al cargar datos de compras:", err);
      setLoadError("No se pudieron cargar tus compras. Intenta de nuevo.");
      setMyOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleCancelarPedido = async (pedidoId: string) => {
    // Confirmación nativa simple
    const seguro = window.confirm("¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.");
    if (!seguro) return;

    setIsCanceling(pedidoId);
    try {
      await cancelarPedidoApi(pedidoId);
      // Recargar datos para actualizar estado y resumen
      await loadData();
      alert("Tu pedido ha sido cancelado exitosamente.");
    } catch (err: any) {
      alert(`Error al cancelar: ${err.message}`);
    } finally {
      setIsCanceling(null);
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case "ENTREGADO": return "bg-green-100 text-green-700";
      case "ENVIADO": return "bg-blue-100 text-blue-700";
      case "EN PREPARACION": return "bg-amber-100 text-amber-700";
      case "CANCELADO": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getCoupons = (cupon: Order["cupon"]) => {
    if (!cupon) return [];
    return Array.isArray(cupon) ? cupon : [cupon];
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="mb-6">
          <h1 style={{ fontSize: 28, fontWeight: 600 }}>Mis Compras</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>
            Consulta tus compras, estatus y detalle de cada orden.
          </p>
        </div>

        {/* Dashboard Resumen Superior */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <DollarSign size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Total Gastado</p>
                <p style={{ fontSize: 20, fontWeight: 700 }}>${summary.total_gastado.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <ShoppingBag size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Total de Pedidos</p>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{summary.total_pedidos}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Ban size={24} className="text-red-500" />
              </div>
              <div>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Pedidos Cancelados</p>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{summary.pedidos_cancelados}</p>
              </div>
            </div>
          </div>
        )}

        {/* Estado: Cargando */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-border py-16 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={36} />
          </div>

        /* Estado: Error de red */
        ) : loadError ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-border">
            <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
            <h2 className="mb-2" style={{ fontSize: 20, fontWeight: 600 }}>{loadError}</h2>
            <button
              onClick={loadData}
              className="text-primary hover:underline"
              style={{ fontSize: 14 }}
            >
              Reintentar
            </button>
          </div>

        /* Estado: Sin pedidos */
        ) : myOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-border">
            <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="mb-2" style={{ fontSize: 20, fontWeight: 600 }}>No tienes compras aún</h2>
            <Link to="/" className="text-primary hover:underline" style={{ fontSize: 14 }}>
              Ir a comprar
            </Link>
          </div>

        /* Estado: Lista de pedidos */
        ) : (
          <div className="space-y-4">
            {myOrders.map((order) => {
              const isCancelable = order.status.toUpperCase() === "PENDIENTE" || order.status.toUpperCase() === "EN PREPARACION";
              const cancelingThis = isCanceling === order.id;

              return (
                <div key={order.id} className="bg-white rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex -space-x-2">
                        {order.items.slice(0, 3).map((item, index) => (
                          <img
                            key={index}
                            src={item.product.image || "https://placehold.co/80x80?text=Item"}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border-2 border-white"
                          />
                        ))}
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600 }}>{order.folio}</p>
                        <p className="text-muted-foreground flex items-center gap-1" style={{ fontSize: 13 }}>
                          <Calendar size={12} /> {order.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className={`px-3 py-1 rounded-full ${getStatusColor(order.status)}`} style={{ fontSize: 13, fontWeight: 500 }}>
                        {order.status}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>${(Number(order.total) || 0).toFixed(2)}</span>
                      {expandedOrder === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>

                  {expandedOrder === order.id && (
                    <div className="border-t border-border p-5 bg-gray-50/50">
                      
                      {/* Botón de cancelar si aplica */}
                      <div className="mb-4 flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/mis-compras/${order.id}`}
                          className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-primary hover:bg-primary/5"
                          style={{ fontSize: 14, fontWeight: 500 }}
                        >
                          <ReceiptText size={16} /> Ver detalle
                        </Link>
                        {isCancelable && (
                          <button
                            onClick={() => handleCancelarPedido(order.id)}
                            disabled={cancelingThis}
                            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
                              cancelingThis 
                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                                : "bg-white border-red-200 text-red-600 hover:bg-red-50"
                            }`}
                            style={{ fontSize: 14, fontWeight: 500 }}
                          >
                            {cancelingThis ? (
                              <><Loader2 size={16} className="animate-spin" /> Cancelando...</>
                            ) : (
                              <><Ban size={16} /> Cancelar Pedido</>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Items del pedido */}
                      <div className="space-y-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <img
                              src={item.product.image || "https://placehold.co/80x80?text=Item"}
                              alt={item.product.name}
                              className="w-14 h-14 rounded-lg object-cover"
                            />
                            <div className="flex-1">
                              <Link to={`/producto/${item.product.id}`} className="hover:text-primary transition-colors" style={{ fontSize: 14, fontWeight: 500 }}>
                                {item.product.name}
                              </Link>
                              <p className="text-muted-foreground" style={{ fontSize: 13 }}>Cantidad: {item.quantity}</p>
                              {item.product.type === "servicio" && item.selectedDate && item.selectedTime && (
                                <p className="text-primary flex items-center gap-1 mt-1" style={{ fontSize: 12 }}>
                                  <Calendar size={13} /> {item.selectedDate}
                                  <Clock size={13} className="ml-1" /> {item.selectedTime}{item.selectedEndTime ? ` - ${item.selectedEndTime}` : ""}
                                </p>
                              )}
                            </div>
                            <p style={{ fontSize: 14, fontWeight: 600 }}>${((Number(item.product.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>

                      {/* Info de dirección y método de pago */}
                      {getCoupons(order.cupon).length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {getCoupons(order.cupon).map((cupon) => (
                            <div
                              key={cupon.codigo_cupon}
                              className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-700"
                              style={{ fontSize: 13, fontWeight: 500 }}
                            >
                              <Tag size={14} />
                              <span>{cupon.codigo_cupon}</span>
                              <span>-${Number(cupon.descuento_aplicado || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.address && (
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-muted-foreground" style={{ fontSize: 13 }}>{order.address}</p>
                          </div>
                        )}
                        {order.paymentMethod && (
                          <div className="flex items-start gap-2">
                            <CreditCard size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-muted-foreground" style={{ fontSize: 13 }}>{order.paymentMethod}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

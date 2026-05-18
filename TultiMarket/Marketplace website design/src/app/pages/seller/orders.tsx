import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Calendar, Clock, Filter, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  getPedidosVendedorRawApi,
  updateEstadoPedidoApi,
  type RawVendorOrder,
} from "../../api/api-client";

export function SellerOrdersPage() {
  const [orders, setOrders] = useState<RawVendorOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ─── Cargar pedidos via api-client ─────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    getPedidosVendedorRawApi()
      .then((data) => setOrders(data))
      .catch((err) => {
        console.error("Error al cargar pedidos:", err);
        toast.error("Error al cargar pedidos");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = statusFilter === "all"
    ? orders
    : orders.filter((o) => o.status.toUpperCase() === statusFilter.toUpperCase());

  const updateStatus = async (orderId: number, newStatus: string) => {
    try {
      await updateEstadoPedidoApi(orderId, newStatus as any);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus.toUpperCase() } : o))
      );
      toast.success(`Pedido actualizado a: ${newStatus}`);
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar estado");
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

  const formatAgendaDate = (value: string) =>
    new Date(value).toLocaleDateString("es-MX", { month: "short", day: "numeric" });

  const formatAgendaTime = (value: string) =>
    new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  const getCoupons = (cupon: RawVendorOrder["cupon"]) => {
    if (!cupon) return [];
    return Array.isArray(cupon) ? cupon : [cupon];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6" style={{ fontSize: 24, fontWeight: 600 }}>Pedidos Recibidos</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Filter size={18} className="text-muted-foreground" />
        {["all", "PENDIENTE", "EN PREPARACION", "ENVIADO", "ENTREGADO", "CANCELADO"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              statusFilter === status
                ? "bg-primary text-white"
                : "bg-white border border-border text-muted-foreground hover:bg-gray-50"
            }`}
            style={{ fontSize: 14 }}
          >
            {status === "all" ? "Todos" : status}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((order) => (
          <div key={order.id} className="bg-white rounded-xl border border-border overflow-hidden">
            <div
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/50"
              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
            >
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600 }}>{order.folio}</p>
                  <p className="text-muted-foreground flex items-center gap-1" style={{ fontSize: 13 }}>
                    <Calendar size={12} /> {new Date(order.date).toLocaleDateString("es-MX")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: 13 }}>Comprador</p>
                  <p style={{ fontSize: 14 }}>{order.buyerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: 13 }}>Total</p>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>${(Number(order.total) || 0).toFixed(2)}</p>
                  {getCoupons(order.cupon).length > 0 && (
                    <p className="mt-1 inline-flex items-center gap-1 text-green-700" style={{ fontSize: 12, fontWeight: 500 }}>
                      <Tag size={12} />
                      {getCoupons(order.cupon).map((cupon) => cupon.codigo_cupon).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full ${getStatusColor(order.status)}`} style={{ fontSize: 13, fontWeight: 500 }}>
                  {order.status}
                </span>
                {expandedOrder === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            {expandedOrder === order.id && (
              <div className="border-t border-border p-5 bg-gray-50/50">
                <div className="space-y-3 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary" style={{ fontSize: 20, fontWeight: 700 }}>
                        {item.type === "producto" ? "📦" : "🛠️"}
                      </div>
                      <div className="flex-1">
                        <p style={{ fontSize: 14 }}>{item.name}</p>
                        <p className="text-muted-foreground" style={{ fontSize: 13 }}>Cant: {item.quantity} x ${(Number(item.price) || 0).toFixed(2)}</p>
                        {item.type === "servicio" && item.agenda && (
                          <p className="text-primary flex items-center gap-1 mt-1" style={{ fontSize: 12 }}>
                            <Calendar size={13} /> {formatAgendaDate(item.agenda.fecha_inicio)}
                            <Clock size={13} className="ml-1" /> {formatAgendaTime(item.agenda.fecha_inicio)} - {formatAgendaTime(item.agenda.fecha_fin)}
                          </p>
                        )}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>${(Number(item.subtotal) || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {getCoupons(order.cupon).length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
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
                {order.buyerEmail && (
                  <p className="text-muted-foreground mb-2" style={{ fontSize: 14 }}>
                    Email: {order.buyerEmail}
                  </p>
                )}
                {(() => {
                  const currentStatus = order.status.toUpperCase();
                  const validTransitions: Record<string, string[]> = {
                    "PENDIENTE": ["PENDIENTE", "EN PREPARACION", "CANCELADO"],
                    "EN PREPARACION": ["EN PREPARACION", "ENVIADO", "CANCELADO"],
                    "ENVIADO": ["ENVIADO", "ENTREGADO"],
                    "ENTREGADO": ["ENTREGADO"],
                    "CANCELADO": ["CANCELADO"],
                  };
                  const options = validTransitions[currentStatus] || [currentStatus];
                  const isTerminal = options.length <= 1;

                  return isTerminal ? (
                    <p className="text-muted-foreground" style={{ fontSize: 14 }}>
                      Estado final: <span className="font-semibold">{currentStatus}</span>
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground" style={{ fontSize: 14 }}>Actualizar estado:</span>
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className="px-3 py-2 border border-border rounded-lg bg-white"
                        style={{ fontSize: 14 }}
                      >
                        {options.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-border">
          <p className="text-muted-foreground" style={{ fontSize: 16 }}>
            {orders.length === 0 ? "Aún no tienes pedidos" : "No hay pedidos con este filtro"}
          </p>
        </div>
      )}
    </div>
  );
}

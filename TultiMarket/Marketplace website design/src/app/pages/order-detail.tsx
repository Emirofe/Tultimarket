import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Calendar,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ReceiptText,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { cancelarPedidoApi, getPedidoDetalleCompradorApi } from "../api/api-client";
import type { Order } from "../data/mock-data";

export function OrderDetailPage() {
  const { pedidoId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  const coupons = useMemo(() => {
    if (!order?.cupon) return [];
    return Array.isArray(order.cupon) ? order.cupon : [order.cupon];
  }, [order?.cupon]);

  const subtotal = useMemo(
    () => order?.items.reduce((sum, item) => sum + (Number(item.product.price) || 0) * (Number(item.quantity) || 0), 0) ?? 0,
    [order?.items]
  );

  const couponDiscount = coupons.reduce((sum, cupon) => sum + (Number(cupon.descuento_aplicado) || 0), 0);

  const loadOrder = async () => {
    if (!pedidoId) {
      setLoadError("Pedido invalido.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getPedidoDetalleCompradorApi(pedidoId);
      setOrder(data);
    } catch (error: any) {
      setLoadError(error?.message || "No se pudo cargar el pedido.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

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

  const handleCancel = async () => {
    if (!order) return;
    const seguro = window.confirm("Seguro que deseas cancelar este pedido?");
    if (!seguro) return;

    setIsCanceling(true);
    try {
      await cancelarPedidoApi(order.id);
      toast.success("Pedido cancelado");
      await loadOrder();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cancelar el pedido");
    } finally {
      setIsCanceling(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="bg-white rounded-xl border border-border py-20 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      );
    }

    if (loadError || !order) {
      return (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <AlertCircle size={44} className="mx-auto text-red-500 mb-3" />
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>No se pudo cargar el pedido</h1>
          <p className="text-muted-foreground mt-2 mb-5" style={{ fontSize: 14 }}>{loadError || "Pedido no encontrado."}</p>
          <button
            onClick={() => navigate("/mis-compras")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            <ArrowLeft size={16} /> Volver a mis compras
          </button>
        </div>
      );
    }

    const isCancelable = order.status.toUpperCase() === "PENDIENTE" || order.status.toUpperCase() === "EN PREPARACION";

    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-muted-foreground" style={{ fontSize: 13 }}>Folio</p>
                <h1 className="mt-1" style={{ fontSize: 26, fontWeight: 700 }}>{order.folio}</h1>
                <p className="mt-2 flex items-center gap-1 text-muted-foreground" style={{ fontSize: 14 }}>
                  <Calendar size={14} /> {order.date}
                </p>
              </div>
              <span className={`inline-flex w-fit rounded-full px-3 py-1 ${getStatusColor(order.status)}`} style={{ fontSize: 13, fontWeight: 600 }}>
                {order.status}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="mb-4 flex items-center gap-2">
              <Package size={19} className="text-primary" />
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Items del pedido</h2>
            </div>

            <div className="space-y-3">
              {order.items.map((item, index) => {
                const productPath = `/producto/${item.product.id}${item.product.type === "servicio" ? "?type=servicio" : ""}`;
                return (
                  <div key={`${item.product.type}:${item.product.id}:${index}`} className="flex gap-4 rounded-lg border border-border bg-gray-50/70 p-3">
                    <Link to={productPath} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                      <img src={item.product.image || "https://placehold.co/80x80?text=Item"} alt={item.product.name} className="h-full w-full object-cover" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to={productPath} className="line-clamp-2 hover:text-primary" style={{ fontSize: 14, fontWeight: 600 }}>
                        {item.product.name}
                      </Link>
                      <p className="mt-1 text-muted-foreground" style={{ fontSize: 13 }}>
                        Cantidad: {item.quantity} x ${(Number(item.product.price) || 0).toFixed(2)}
                      </p>
                      {item.product.type === "servicio" && item.selectedDate && item.selectedTime && (
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-primary" style={{ fontSize: 12 }}>
                          <Calendar size={13} /> {item.selectedDate}
                          <Clock size={13} className="ml-1" /> {item.selectedTime}{item.selectedEndTime ? ` - ${item.selectedEndTime}` : ""}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0" style={{ fontSize: 14, fontWeight: 700 }}>
                      ${((Number(item.product.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
                  <MapPin size={15} /> Direccion de envio
                </div>
                <p style={{ fontSize: 14 }}>{order.address || "Sin direccion registrada"}</p>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-muted-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
                  <CreditCard size={15} /> Metodo de pago
                </div>
                <p style={{ fontSize: 14 }}>{order.paymentMethod || "Sin metodo registrado"}</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="h-fit bg-white rounded-xl border border-border p-5">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText size={19} className="text-primary" />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Resumen</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-muted-foreground" style={{ fontSize: 14 }}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {coupons.map((cupon) => (
              <div key={cupon.codigo_cupon} className="flex items-start justify-between gap-3 text-green-700" style={{ fontSize: 14 }}>
                <span className="inline-flex items-center gap-1">
                  <Tag size={14} /> {cupon.codigo_cupon}
                </span>
                <span>-${(Number(cupon.descuento_aplicado) || 0).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between" style={{ fontSize: 18, fontWeight: 700 }}>
              <span>Total</span>
              <span>${(Number(order.total) || 0).toFixed(2)}</span>
            </div>
          </div>

          {couponDiscount > 0 && (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-green-700" style={{ fontSize: 13 }}>
              Ahorro aplicado: ${couponDiscount.toFixed(2)}
            </p>
          )}

          {isCancelable && (
            <button
              onClick={handleCancel}
              disabled={isCanceling}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              {isCanceling ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
              Cancelar pedido
            </button>
          )}
        </aside>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        <Link to="/mis-compras" className="mb-5 inline-flex items-center gap-2 text-primary hover:underline" style={{ fontSize: 14, fontWeight: 500 }}>
          <ArrowLeft size={16} /> Volver a mis compras
        </Link>
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
}

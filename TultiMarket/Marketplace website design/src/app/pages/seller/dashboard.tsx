import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, DollarSign, Loader2, Package, Wrench } from "lucide-react";
import {
  getEstadisticasVendedorApi,
  getPedidosVendedorRawApi,
  getProductosVendedorApi,
  getServiciosVendedorApi,
  type RawVendorOrder,
} from "../../api/api-client";
import { useStore } from "../../context/store-context";
import { toast } from "sonner";

type SellerProduct = Awaited<ReturnType<typeof getProductosVendedorApi>>[number];
type SellerService = Awaited<ReturnType<typeof getServiciosVendedorApi>>[number];

export function SellerDashboardPage() {
  const { negocioId, currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [services, setServices] = useState<SellerService[]>([]);
  const [orders, setOrders] = useState<RawVendorOrder[]>([]);
  const [sales, setSales] = useState({ totalOrders: 0, totalRevenue: 0 });

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      getProductosVendedorApi(negocioId),
      getServiciosVendedorApi(negocioId),
      getPedidosVendedorRawApi().catch(() => []),
      getEstadisticasVendedorApi().catch(() => null),
    ])
      .then(([productos, servicios, pedidos, estadisticas]) => {
        setProducts(productos);
        setServices(servicios);
        setOrders(pedidos);
        setSales({
          totalOrders: estadisticas?.estadisticas.total_pedidos ?? pedidos.length,
          totalRevenue: Number(estadisticas?.estadisticas?.total_ventas ?? 0),
        });
      })
      .catch(() => toast.error("No se pudo cargar el resumen del vendedor"))
      .finally(() => setLoading(false));
  }, [negocioId]);

  const lowStock = useMemo(
    () => products.filter((product) => Number(product.stock_total) <= 10),
    [products]
  );

  const activeProducts = products.filter((product) => product.esta_activo).length;
  const activeServices = services.filter((service) => service.esta_activo).length;
  const pendingOrders = orders.filter((order) =>
    ["PENDIENTE", "EN PREPARACION"].includes(String(order.status).toUpperCase())
  ).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  const cards = [
    { label: "Productos activos", value: activeProducts, icon: Package, color: "text-emerald-700 bg-emerald-50", to: "/vendedor/productos" },
    { label: "Servicios activos", value: activeServices, icon: Wrench, color: "text-blue-700 bg-blue-50", to: "/vendedor/servicios" },
    { label: "Pedidos abiertos", value: pendingOrders, icon: ClipboardList, color: "text-amber-700 bg-amber-50", to: "/vendedor/pedidos" },
    { label: "Ingresos", value: `$${sales.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-700 bg-green-50", to: "/vendedor/ventas" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Inicio del Vendedor</h1>
        <p className="text-muted-foreground" style={{ fontSize: 14 }}>
          Hola, {currentUser?.name ?? "vendedor"}. Aqui tienes el estado operativo de tu negocio.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.to} className="bg-white border border-border rounded-xl p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon size={20} />
                </span>
                <ArrowRight size={16} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mt-4" style={{ fontSize: 13 }}>{card.label}</p>
              <p style={{ fontSize: 26, fontWeight: 700 }}>{card.value}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Ultimos pedidos</h2>
            <Link to="/vendedor/pedidos" className="text-primary" style={{ fontSize: 14 }}>Ver todos</Link>
          </div>
          <div className="divide-y divide-border">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{order.folio}</p>
                  <p className="text-muted-foreground" style={{ fontSize: 13 }}>{order.buyerName}</p>
                </div>
                <div className="text-right">
                  <p style={{ fontSize: 14, fontWeight: 600 }}>${Number(order.total || 0).toFixed(2)}</p>
                  <p className="text-muted-foreground" style={{ fontSize: 12 }}>{order.status}</p>
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="p-8 text-center text-muted-foreground" style={{ fontSize: 14 }}>Todavia no hay pedidos.</p>}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Alertas de inventario</h2>
            <Link to="/vendedor/inventario" className="text-primary" style={{ fontSize: 14 }}>Ajustar stock</Link>
          </div>
          <div className="divide-y divide-border">
            {lowStock.slice(0, 6).map((product) => (
              <div key={product.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    {Number(product.stock_total) === 0 ? <AlertTriangle size={17} /> : <Boxes size={17} />}
                  </span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{product.nombre}</p>
                    <p className="text-muted-foreground" style={{ fontSize: 13 }}>{product.sku || "Sin SKU"}</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-amber-50 text-amber-700" style={{ fontSize: 13 }}>{product.stock_total} uds.</span>
              </div>
            ))}
            {lowStock.length === 0 && <p className="p-8 text-center text-muted-foreground" style={{ fontSize: 14 }}>Tu inventario no tiene alertas.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

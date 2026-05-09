import { useState, useEffect } from "react";
import { Search, Filter, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminCatalogoProductosApi,
  getAdminCatalogoServiciosApi,
  updateAdminEstadoProductoApi,
  updateAdminEstadoServicioApi,
} from "../../api/api-client";

interface CatalogoItem {
  id: number;
  nombre: string;
  precio: number;
  precio_con_descuento: number;
  negocio: string;
  estado_catalogo: string;
  esta_activo: boolean;
  tipo: "producto" | "servicio";
}

export function AdminCatalogPage() {
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getAdminCatalogoProductosApi(), getAdminCatalogoServiciosApi()])
      .then(([prodItems, servItems]) => {
        if (cancelled) return;
        const prods: CatalogoItem[] = prodItems.map((p) => ({
          id: p.id, nombre: p.nombre, precio: p.precio ?? p.precio_base ?? 0,
          precio_con_descuento: p.precio_con_descuento ?? p.precio ?? 0, negocio: p.negocio,
          estado_catalogo: p.estado_catalogo, esta_activo: p.esta_activo, tipo: "producto",
        }));
        const servs: CatalogoItem[] = servItems.map((s) => ({
          id: s.id, nombre: s.nombre, precio: s.precio_base ?? s.precio ?? 0,
          precio_con_descuento: s.precio_con_descuento ?? s.precio_base ?? 0, negocio: s.negocio,
          estado_catalogo: s.estado_catalogo, esta_activo: s.esta_activo, tipo: "servicio",
        }));
        setItems([...prods, ...servs]);
      })
      .catch((err) => { if (!cancelled) toast.error(err.message || "Error al cargar catálogo"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleStatusChange = async (item: CatalogoItem, newStatus: "Aprobado" | "Rechazado") => {
    const apiEstado = newStatus === "Aprobado" ? "APROBADO" as const : "RECHAZADO" as const;
    try {
      if (item.tipo === "producto") await updateAdminEstadoProductoApi(item.id, apiEstado);
      else await updateAdminEstadoServicioApi(item.id, apiEstado);
      setItems((prev) => prev.map((p) =>
        p.id === item.id && p.tipo === item.tipo
          ? { ...p, estado_catalogo: newStatus, esta_activo: newStatus === "Aprobado" } : p
      ));
      toast.success(`${item.nombre} — ${newStatus.toLowerCase()}`);
    } catch (err: any) { toast.error(err.message || "Error al actualizar estado"); }
  };

  const filtered = items.filter((p) => {
    const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.negocio.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterStatus === "todos" || p.estado_catalogo === filterStatus;
    return matchSearch && matchFilter;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={32} className="animate-spin text-primary" />
      <span className="ml-3 text-muted-foreground">Cargando catálogo...</span>
    </div>
  );

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Gestión de Catálogo</h1>
          <p className="text-muted-foreground mt-1" style={{ fontSize: 14 }}>
            Revisa y aprueba productos o servicios subidos por los vendedores (RF-44, RF-46)
          </p>
        </div>
      </div>
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input type="text" placeholder="Buscar por nombre o vendedor..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-border rounded-lg outline-none focus:border-primary transition-colors"
              style={{ fontSize: 14 }} />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={18} className="text-muted-foreground" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="flex-1 md:flex-none bg-white border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
              style={{ fontSize: 14 }}>
              <option value="todos">Todos los estados</option>
              <option value="Aprobado">Aprobados</option>
              <option value="Rechazado">Rechazados</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="px-6 py-4" style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>PRODUCTO / SERVICIO</th>
                <th className="px-6 py-4" style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>VENDEDOR</th>
                <th className="px-6 py-4" style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>PRECIO</th>
                <th className="px-6 py-4" style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>ESTADO</th>
                <th className="px-6 py-4 text-right" style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={`${p.tipo}-${p.id}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"
                        style={{ fontSize: 14, fontWeight: 600 }}>{p.nombre[0]}</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500 }}>{p.nombre}</p>
                        <span className="text-xs text-muted-foreground capitalize">{p.tipo}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4" style={{ fontSize: 14 }}>{p.negocio}</td>
                  <td className="px-6 py-4">
                    <p style={{ fontSize: 14, fontWeight: 500 }}>${p.precio_con_descuento.toFixed(2)}</p>
                    {p.precio_con_descuento < p.precio && (
                      <p className="text-muted-foreground line-through" style={{ fontSize: 12 }}>${p.precio.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      p.estado_catalogo === "Aprobado" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>{p.estado_catalogo}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleStatusChange(p, "Aprobado")} title="Aprobar"
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <CheckCircle size={18} />
                      </button>
                      <button onClick={() => handleStatusChange(p, "Rechazado")} title="Rechazar"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <XCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground" style={{ fontSize: 14 }}>No se encontraron elementos para moderar.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

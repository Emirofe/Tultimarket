import { useState, useEffect } from "react";
import { Flag, AlertTriangle, CheckCircle, Clock, Filter, ChevronDown, ChevronUp, ShieldOff, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getReportesAdminApi,
  advertenciaReporteApi,
  suspensionReporteApi,
  bloqueoReporteApi,
  desestimarReporteApi,
  eliminarContenidoReporteApi,
  updateEstadoReporteApi,
  deleteReporteApi,
  type RawReporteAdmin,
} from "../../api/api-client";

// Tipo local para el reporte mapeado (estado ya en texto legible)
interface ReporteFront extends RawReporteAdmin {
  estado_reporte: string;
}

// ─── Configuración centralizada de estados de reporte ────────────────────────
// Tener esto aquí evita los "magic strings" dispersos por el componente.
const REPORT_STATUSES = [
  "Pendiente",
  "Revisado",
  "Advertencia formal",
  "Suspensión temporal",
  "Bloqueo permanente",
  "Desestimado",
  "Contenido eliminado",
  "Resuelto",
];

export function AdminReportsPage() {
  const [reports, setReports] = useState<ReporteFront[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  // ── Carga real desde el backend ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getReportesAdminApi()
      .then((data) => {
        if (!cancelled) setReports(data as ReporteFront[]);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || "Error al cargar reportes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const reportStatuses = [
    "all",
    "Pendiente",
    "Revisado",
    "Advertencia formal",
    "Suspensión temporal",
    "Bloqueo permanente",
    "Desestimado",
    "Contenido eliminado",
    "Resuelto",
  ];

  const filtered = statusFilter === "all"
    ? reports
    : reports.filter((r) => r.estado_reporte === statusFilter);

  // ── Íconos semánticos por estado ──────────────────────────────────────────
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Resuelto":
        return <CheckCircle size={16} className="text-green-600" />;
      case "Revisado":
        return <AlertTriangle size={16} className="text-amber-600" />;
      case "Advertencia formal":
        return <AlertTriangle size={16} className="text-orange-600" />;
      case "Suspensión temporal":
        return <ShieldOff size={16} className="text-yellow-600" />;
      case "Bloqueo permanente":
        return <X size={16} className="text-red-600" />;
      case "Desestimado":
        return <X size={16} className="text-slate-600" />;
      case "Contenido eliminado":
        return <Trash2 size={16} className="text-slate-600" />;
      default:
        return <Clock size={16} className="text-red-600" />;
    }
  };

  // ── Colores semánticos por estado ─────────────────────────────────────────
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resuelto":          return "bg-green-100 text-green-700";
      case "Revisado":          return "bg-amber-100 text-amber-700";
      case "Advertencia formal":return "bg-orange-100 text-orange-700";
      case "Suspensión temporal": return "bg-yellow-100 text-yellow-700";
      case "Bloqueo permanente":  return "bg-red-100 text-red-700";
      case "Desestimado":       return "bg-slate-100 text-slate-700";
      case "Contenido eliminado": return "bg-slate-100 text-slate-700";
      default:                  return "bg-red-100 text-red-700";
    }
  };

  // ── Acción con API real → actualiza estado en BD ──────────────────────────
  const handleAction = async (report: ReporteFront, newStatus: string) => {
    try {
      const id = report.id;
      switch (newStatus) {
        case "Advertencia formal":
          await advertenciaReporteApi(id);
          break;
        case "Suspensión temporal": {
          const diasInput = window.prompt("\u00bfCu\u00e1ntos d\u00edas de suspensi\u00f3n?", "7");
          if (!diasInput) return;
          const dias = parseInt(diasInput, 10);
          if (isNaN(dias) || dias <= 0) { toast.error("N\u00famero de d\u00edas inv\u00e1lido"); return; }
          await suspensionReporteApi(id, dias);
          break;
        }
        case "Bloqueo permanente":
          if (!window.confirm("\u00bfConfirmas el bloqueo PERMANENTE de esta cuenta? Esta acci\u00f3n no se puede deshacer.")) return;
          await bloqueoReporteApi(id, report.motivo);
          break;
        case "Desestimado": {
          const razon = window.prompt("Raz\u00f3n para desestimar el reporte:", "Sin fundamento suficiente");
          if (!razon) return;
          await desestimarReporteApi(id, razon);
          break;
        }
        case "Contenido eliminado":
          if (!window.confirm("\u00bfConfirmas la eliminaci\u00f3n del contenido reportado?")) return;
          await eliminarContenidoReporteApi(id, report.motivo);
          break;
        default:
          await updateEstadoReporteApi(id, newStatus);
          break;
      }

      // Actualizar UI local
      setReports((prev) =>
        prev.map((r) => r.id === id ? { ...r, estado_reporte: newStatus } : r)
      );

      // Mensajes de notificación contextuales
      const messages: Record<string, string> = {
        "Resuelto": `Reporte #${id} resuelto.`,
        "Advertencia formal": `Advertencia formal registrada para usuario #${report.id_usuario}.`,
        "Suspensión temporal": `Suspensión temporal de 7 días aplicada al usuario #${report.id_usuario}.`,
        "Bloqueo permanente": `Bloqueo permanente aplicado al usuario #${report.id_usuario}.`,
        "Desestimado": `Reporte #${id} desestimado.`,
        "Contenido eliminado": `Contenido del reporte #${id} eliminado.`,
      };
      toast.success(messages[newStatus] || `Estado actualizado a ${newStatus}.`);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar reporte");
    }
  };

  // Eliminar reporte permanentemente de la BD
  const handleDelete = async (report: ReporteFront) => {
    if (!window.confirm(`¿Eliminar permanentemente el reporte #${report.id}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteReporteApi(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      toast.success(`Reporte #${report.id} eliminado permanentemente.`);
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar reporte");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando reportes...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Reportes y Denuncias</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>
            {reports.filter((r) => r.estado_reporte === "Pendiente").length} pendientes de revision
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Filter size={18} className="text-muted-foreground" />
        <button
          key="all"
          onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            statusFilter === "all"
              ? "bg-primary text-white"
              : "bg-white border border-border text-muted-foreground hover:bg-gray-50"
          }`}
          style={{ fontSize: 14 }}
        >
          Todos
        </button>
        {REPORT_STATUSES.map((status) => (
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
            {status}
          </button>
        ))}
      </div>

      {/* Lista de reportes */}
      <div className="space-y-4">
        {filtered.map((report) => (
          <div key={report.id} className="bg-white rounded-xl border border-border overflow-hidden">
            <div
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/50"
              onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  {getStatusIcon(report.estado_reporte)}
                  <span style={{ fontSize: 15, fontWeight: 600 }}>#{report.id}</span>
                </div>
                <div>
                  <p className="text-muted-foreground" style={{ fontSize: 13 }}>Negocio: {report.negocio}</p>
                  <p style={{ fontSize: 14 }}>{report.tipo_objetivo}: {report.nombre_objetivo}</p>
                </div>
                <span className={`px-2 py-1 rounded ${
                  report.tipo_objetivo === "producto" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                }`} style={{ fontSize: 12 }}>
                  {report.tipo_objetivo}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground" style={{ fontSize: 13 }}>
                  {report.fecha_creacion ? new Date(report.fecha_creacion).toLocaleDateString() : ""}
                </span>
                <span className={`px-3 py-1 rounded-full ${getStatusColor(report.estado_reporte)}`} style={{ fontSize: 13, fontWeight: 500 }}>
                  {report.estado_reporte}
                </span>
                {expandedReport === report.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            {expandedReport === report.id && (
              <div className="border-t border-border p-5 bg-gray-50/50">
                <div className="mb-4">
                  <p className="text-muted-foreground mb-1" style={{ fontSize: 13 }}>Razon del reporte</p>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{report.motivo}</p>
                </div>
                <div className="mb-6">
                  <p className="text-muted-foreground mb-1" style={{ fontSize: 13 }}>Descripcion detallada</p>
                  <p className="text-muted-foreground" style={{ fontSize: 14 }}>{report.descripcion}</p>
                </div>
                {["Resuelto", "Bloqueo permanente", "Desestimado", "Contenido eliminado", "Suspensión temporal"].includes(report.estado_reporte) ? (
                  <div>
                    <p className="text-muted-foreground italic mb-3" style={{ fontSize: 14 }}>
                      Este reporte ya fue procesado con resultado: <span className="font-semibold">{report.estado_reporte}</span>
                    </p>
                    <button
                      onClick={() => handleDelete(report)}
                      className="flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      style={{ fontSize: 13 }}
                    >
                      <Trash2 size={14} /> Eliminar reporte de la base de datos
                    </button>
                  </div>
                ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAction(report, "Resuelto")}
                    className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    style={{ fontSize: 14 }}
                  >
                    <CheckCircle size={16} /> Resolver
                  </button>
                  <button
                    onClick={() => handleAction(report, "Advertencia formal")}
                    className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    style={{ fontSize: 14 }}
                  >
                    <AlertTriangle size={16} /> Advertencia formal
                  </button>
                  <button
                    onClick={() => handleAction(report, "Suspensi\u00f3n temporal")}
                    className="flex items-center gap-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    style={{ fontSize: 14 }}
                  >
                    <ShieldOff size={16} /> Suspensi\u00f3n temporal
                  </button>
                  <button
                    onClick={() => handleAction(report, "Bloqueo permanente")}
                    className="flex items-center gap-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    style={{ fontSize: 14 }}
                  >
                    <X size={16} /> Bloqueo permanente
                  </button>
                  <button
                    onClick={() => handleAction(report, "Contenido eliminado")}
                    className="flex items-center gap-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
                    style={{ fontSize: 14 }}
                  >
                    <Trash2 size={16} /> Eliminar contenido
                  </button>
                  <button
                    onClick={() => handleAction(report, "Desestimado")}
                    className="flex items-center gap-1 px-4 py-2 border border-border rounded-lg hover:bg-gray-50"
                    style={{ fontSize: 14 }}
                  >
                    <X size={16} /> Desestimar
                  </button>
                </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-border">
          <Flag size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground" style={{ fontSize: 16 }}>No hay reportes con este filtro</p>
        </div>
      )}
    </div>
  );
}
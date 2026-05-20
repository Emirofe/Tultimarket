import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Bell, Check, CheckCheck, Trash2, Package, Star, ShieldAlert, Info, X } from "lucide-react";
import { useNotifications } from "../../context/notification-context";
import type { Notificacion } from "../../api/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

function tiempoRelativo(fechaISO: string): string {
  const diff = Date.now() - new Date(fechaISO).getTime();
  const MIN = 60_000, HR = 3_600_000, DIA = 86_400_000;

  if (diff < MIN) return "Justo ahora";
  if (diff < HR) return `Hace ${Math.floor(diff / MIN)} min`;
  if (diff < DIA) return `Hace ${Math.floor(diff / HR)}h`;
  if (diff < DIA * 2) {
    const d = new Date(fechaISO);
    return `Ayer, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const d = new Date(fechaISO);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getNotifIcon(tipo: string) {
  if (tipo.includes("pedido")) return <Package size={15} className="text-blue-500" />;
  if (tipo.includes("resena") || tipo.includes("reseña")) return <Star size={15} className="text-amber-500" />;
  if (tipo.includes("reporte")) return <ShieldAlert size={15} className="text-red-500" />;
  return <Info size={15} className="text-slate-400" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const { notificaciones, noLeidas, marcarLeida, marcarTodasLeidas, eliminar } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleClickNotif = async (n: Notificacion) => {
    if (!n.leida) await marcarLeida(n.id);
    if (n.datos_extra?.url) { navigate(n.datos_extra.url); setOpen(false); }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Botón Campanita ── */}
      <button
        id="notification-bell"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        title="Notificaciones"
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ""}`}
      >
        <Bell size={22} />
        {noLeidas > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 18, height: 18, padding: "0 5px",
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            background: "#EF4444", color: "#fff",
            boxShadow: "0 0 0 2px #121E2B",
            animation: "notifPulse .35s ease-out",
          }}>
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {/* ── Panel Dropdown ── */}
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "100%", marginTop: 8, zIndex: 50,
            width: 340, maxHeight: 420,
            display: "flex", flexDirection: "column",
            borderRadius: 14, background: "#fff",
            boxShadow: "0 12px 48px rgba(0,0,0,.16), 0 2px 12px rgba(0,0,0,.06)",
            border: "1px solid #e5e7eb",
            animation: "notifSlideIn .15s ease-out",
            overflow: "hidden",
          }}
        >
          {/* ─ Header: Todo en una sola fila ─ */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid #f0f0f0",
            background: "#FAFBFC",
          }}>
            <Bell size={15} style={{ color: "#374151", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#121E2B" }}>
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: "#FEF3C7", color: "#92400E",
                padding: "2px 7px", borderRadius: 8, lineHeight: 1.4,
              }}>
                {noLeidas}
              </span>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Leer todas */}
            {noLeidas > 0 && (
              <button
                onClick={marcarTodasLeidas}
                title="Marcar todas como leídas"
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  fontSize: 11, fontWeight: 600,
                  color: "#065F46", background: "#ECFDF5",
                  border: "none", borderRadius: 6, padding: "4px 8px",
                  cursor: "pointer", transition: "background .15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => ((e.currentTarget).style.background = "#D1FAE5")}
                onMouseLeave={(e) => ((e.currentTarget).style.background = "#ECFDF5")}
              >
                <CheckCheck size={12} /> Leer todas
              </button>
            )}

            {/* Cerrar */}
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: 6,
                border: "none", background: "transparent",
                cursor: "pointer", color: "#9CA3AF", transition: "background .15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F4F6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X size={14} />
            </button>
          </div>

          {/* ─ Cuerpo: Lista de notificaciones ─ */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {notificaciones.length === 0 ? (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "36px 20px", color: "#9CA3AF",
              }}>
                <Bell size={32} style={{ marginBottom: 10, opacity: 0.35 }} />
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>No tienes notificaciones</p>
                <p style={{ fontSize: 11, margin: "4px 0 0", opacity: 0.6 }}>
                  Apareceran aqui cuando haya novedades
                </p>
              </div>
            ) : (
              notificaciones.map((n) => (
                <NotifItem
                  key={n.id}
                  notif={n}
                  onClick={() => handleClickNotif(n)}
                  onMarkRead={() => marcarLeida(n.id)}
                  onDelete={() => eliminar(n.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Animaciones CSS ── */}
      <style>{`
        @keyframes notifPulse {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item de Notificación
// ─────────────────────────────────────────────────────────────────────────────

function NotifItem({
  notif, onClick, onMarkRead, onDelete,
}: {
  notif: Notificacion;
  onClick: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const unread = !notif.leida;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px 10px 18px",
        cursor: "pointer",
        borderBottom: "1px solid #f5f5f5",
        transition: "background .12s",
        background: unread
          ? (hovered ? "#EBF5FF" : "#F0F7FF")
          : (hovered ? "#FAFAFA" : "transparent"),
        position: "relative",
      }}
    >
      {/* Punto de no leída */}
      {unread && (
        <div style={{
          position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)",
          width: 5, height: 5, borderRadius: "50%", background: "#3B82F6",
        }} />
      )}

      {/* Ícono */}
      <div style={{
        marginTop: 1, width: 30, height: 30, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: unread ? "#DBEAFE" : "#F3F4F6", flexShrink: 0,
      }}>
        {getNotifIcon(notif.tipo)}
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 12.5, fontWeight: unread ? 600 : 400, color: "#1F2937",
          margin: 0, lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {notif.titulo}
        </p>
        <p style={{
          fontSize: 11.5, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {notif.mensaje}
        </p>
        <p style={{
          fontSize: 10.5, color: "#9CA3AF", margin: "3px 0 0", fontWeight: 500,
        }}>
          {tiempoRelativo(notif.fecha_creacion)}
        </p>
      </div>

      {/* Acciones al hover */}
      {hovered && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 2,
          flexShrink: 0, marginTop: 2,
        }}>
          {unread && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
              title="Marcar como leída"
              style={{
                width: 24, height: 24, borderRadius: 5,
                border: "none", background: "#ECFDF5", color: "#065F46",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Check size={12} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Eliminar"
            style={{
              width: 24, height: 24, borderRadius: 5,
              border: "none", background: "#FEF2F2", color: "#DC2626",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

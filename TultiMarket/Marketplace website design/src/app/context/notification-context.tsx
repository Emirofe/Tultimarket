import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  getNotificacionesApi,
  marcarNotificacionLeidaApi,
  marcarTodasLeidasApi,
  eliminarNotificacionApi,
  type Notificacion,
} from "../api/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationContextValue {
  notificaciones: Notificacion[];
  noLeidas: number;
  isLoading: boolean;
  marcarLeida: (id: number) => Promise<void>;
  marcarTodasLeidas: () => Promise<void>;
  eliminar: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue>({
  notificaciones: [],
  noLeidas: 0,
  isLoading: false,
  marcarLeida: async () => {},
  marcarTodasLeidas: async () => {},
  eliminar: async () => {},
  refetch: async () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 30_000; // 30 segundos

interface NotificationProviderProps {
  children: ReactNode;
  /** ID del usuario autenticado. Si es null/undefined, el polling no corre. */
  userId: string | number | null | undefined;
}

export function NotificationProvider({ children, userId }: NotificationProviderProps) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch notifications from API ──
  const fetchNotificaciones = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getNotificacionesApi();
      if (data?.notificaciones) {
        setNotificaciones(data.notificaciones);
        setNoLeidas(data.no_leidas ?? 0);
      }
    } catch {
      // Silently ignore — user might not be logged in or session expired
    }
  }, [userId]);

  // ── Initial fetch + polling setup ──
  useEffect(() => {
    if (!userId) {
      setNotificaciones([]);
      setNoLeidas(0);
      return;
    }

    setIsLoading(true);
    fetchNotificaciones().finally(() => setIsLoading(false));

    intervalRef.current = setInterval(fetchNotificaciones, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, fetchNotificaciones]);

  // ── Actions ──
  const marcarLeida = useCallback(async (id: number) => {
    try {
      await marcarNotificacionLeidaApi(id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      );
      setNoLeidas((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[NotificationContext] Error al marcar leída:", err);
    }
  }, []);

  const marcarTodasLeidasCtx = useCallback(async () => {
    try {
      await marcarTodasLeidasApi();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
    } catch (err) {
      console.error("[NotificationContext] Error al marcar todas:", err);
    }
  }, []);

  const eliminar = useCallback(async (id: number) => {
    try {
      const notif = notificaciones.find((n) => n.id === id);
      await eliminarNotificacionApi(id);
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
      if (notif && !notif.leida) {
        setNoLeidas((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("[NotificationContext] Error al eliminar:", err);
    }
  }, [notificaciones]);

  return (
    <NotificationContext.Provider
      value={{
        notificaciones,
        noLeidas,
        isLoading,
        marcarLeida,
        marcarTodasLeidas: marcarTodasLeidasCtx,
        eliminar,
        refetch: fetchNotificaciones,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useNotifications() {
  return useContext(NotificationContext);
}

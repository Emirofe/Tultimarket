import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Calendar as CalendarIcon, Clock, Edit, Loader2, Plus, Trash2, User } from "lucide-react";
import {
  createAgendaServicioVendedorApi,
  deleteAgendaVendedorApi,
  getAgendaServicioVendedorApi,
  getServiciosVendedorApi,
  type SellerAgendaSlot,
  updateAgendaVendedorApi,
} from "../../api/api-client";
import { useStore } from "../../context/store-context";
import { toast } from "sonner";

type SellerService = Awaited<ReturnType<typeof getServiciosVendedorApi>>[number];

const emptyForm = {
  date: "",
  startTime: "",
  endTime: "",
};

function toInputDate(value: string) {
  return new Date(value).toISOString().split("T")[0];
}

function toInputTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-MX", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function composeDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function addMinutesToTime(date: string, time: string, minutes?: number | null) {
  if (!date || !time || !minutes) return "";
  const next = new Date(composeDateTime(date, time));
  next.setMinutes(next.getMinutes() + minutes);
  return next.toTimeString().slice(0, 5);
}

export function SellerAgendaPage() {
  const { negocioId } = useStore();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<SellerService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [slots, setSlots] = useState<SellerAgendaSlot[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const selectedService = useMemo(
    () => services.find((service) => String(service.id) === selectedServiceId),
    [services, selectedServiceId]
  );

  const visibleSlots = useMemo(
    () => [...slots].sort((a, b) => new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime()),
    [slots]
  );

  const availableCount = visibleSlots.filter((slot) => slot.estado === "disponible").length;
  const reservedCount = visibleSlots.filter((slot) => slot.estado !== "disponible").length;

  const loadAgenda = async (serviceId: string) => {
    if (!serviceId) {
      setSlots([]);
      return;
    }

    setLoadingAgenda(true);
    try {
      setSlots(await getAgendaServicioVendedorApi(Number(serviceId)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar agenda");
      setSlots([]);
    } finally {
      setLoadingAgenda(false);
    }
  };

  useEffect(() => {
    if (!negocioId) {
      setLoadingServices(false);
      return;
    }

    setLoadingServices(true);
    getServiciosVendedorApi(negocioId)
      .then((data) => {
        const activeServices = data.filter((service) => service.esta_activo);
        setServices(activeServices);
        const serviceFromUrl = searchParams.get("servicio");
        const initialService =
          activeServices.find((service) => String(service.id) === serviceFromUrl) ?? activeServices[0];
        setSelectedServiceId(initialService ? String(initialService.id) : "");
      })
      .catch(() => toast.error("Error al cargar servicios"))
      .finally(() => setLoadingServices(false));
  }, [negocioId, searchParams]);

  useEffect(() => {
    loadAgenda(selectedServiceId);
  }, [selectedServiceId]);

  const resetForm = () => {
    setEditingSlotId(null);
    setFormData(emptyForm);
  };

  const handleStartTimeChange = (startTime: string) => {
    setFormData((prev) => ({
      ...prev,
      startTime,
      endTime: addMinutesToTime(prev.date, startTime, selectedService?.duracion_minutos) || prev.endTime,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) {
      toast.error("Selecciona un servicio");
      return;
    }

    if (!formData.date || !formData.startTime || !formData.endTime) {
      toast.error("Completa fecha, hora inicio y hora fin");
      return;
    }

    const payload = {
      fecha_hora_inicio: composeDateTime(formData.date, formData.startTime),
      fecha_hora_fin: composeDateTime(formData.date, formData.endTime),
    };

    setSaving(true);
    try {
      if (editingSlotId) {
        await updateAgendaVendedorApi(editingSlotId, payload);
        toast.success("Horario actualizado");
      } else {
        await createAgendaServicioVendedorApi(Number(selectedServiceId), payload);
        toast.success("Horario disponible creado");
      }
      resetForm();
      await loadAgenda(selectedServiceId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el horario");
    } finally {
      setSaving(false);
    }
  };

  const editSlot = (slot: SellerAgendaSlot) => {
    if (slot.estado !== "disponible") {
      toast.error("Solo puedes editar horarios disponibles");
      return;
    }

    setEditingSlotId(slot.id);
    setFormData({
      date: toInputDate(slot.fecha_hora_inicio),
      startTime: toInputTime(slot.fecha_hora_inicio),
      endTime: toInputTime(slot.fecha_hora_fin),
    });
  };

  const deleteSlot = async (slot: SellerAgendaSlot) => {
    if (slot.estado !== "disponible") {
      toast.error("No puedes eliminar un horario reservado");
      return;
    }

    setSaving(true);
    try {
      await deleteAgendaVendedorApi(slot.id);
      toast.success("Horario eliminado");
      await loadAgenda(selectedServiceId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el horario");
    } finally {
      setSaving(false);
    }
  };

  if (!negocioId) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground" style={{ fontSize: 18 }}>No tienes un negocio vinculado a tu cuenta.</p>
      </div>
    );
  }

  if (loadingServices) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Mi Agenda</h1>
          <p className="text-muted-foreground mt-1" style={{ fontSize: 14 }}>
            Publica horarios reales para que tus clientes puedan agendar servicios.
          </p>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-8 text-center">
          <CalendarIcon size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>Crea un servicio activo antes de configurar horarios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-4">
            <div className="border border-border bg-white rounded-xl p-6">
              <h2 className="mb-4 flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}>
                <CalendarIcon size={20} className="text-primary" /> Servicio
              </h2>
              <select
                value={selectedServiceId}
                onChange={(e) => {
                  setSelectedServiceId(e.target.value);
                  resetForm();
                }}
                className="w-full px-4 py-3 rounded-lg border border-border bg-white"
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.nombre}</option>
                ))}
              </select>

              {selectedService && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-muted-foreground" style={{ fontSize: 12 }}>Disponibles</p>
                    <p className="text-primary" style={{ fontSize: 22, fontWeight: 700 }}>{availableCount}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-muted-foreground" style={{ fontSize: 12 }}>Reservados</p>
                    <p className="text-amber-700" style={{ fontSize: 22, fontWeight: 700 }}>{reservedCount}</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-6">
              <h2 className="mb-4 flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}>
                {editingSlotId ? <Edit size={18} className="text-primary" /> : <Plus size={18} className="text-primary" />}
                {editingSlotId ? "Editar horario" : "Nuevo horario"}
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Fecha</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border border-border"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Inicio</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border"
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Fin</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-border"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg disabled:opacity-50"
                  style={{ fontSize: 14, fontWeight: 600 }}
                >
                  {saving ? "Guardando..." : editingSlotId ? "Actualizar" : "Crear horario"}
                </button>
                {editingSlotId && (
                  <button type="button" onClick={resetForm} className="px-4 py-2.5 border border-border rounded-lg" style={{ fontSize: 14 }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="xl:col-span-2 bg-white border border-border rounded-xl p-6">
            <h2 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>Horarios del servicio</h2>
            {loadingAgenda ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : visibleSlots.length === 0 ? (
              <p className="text-muted-foreground text-center py-10" style={{ fontSize: 14 }}>
                Aun no hay horarios publicados para este servicio.
              </p>
            ) : (
              <div className="space-y-3">
                {visibleSlots.map((slot) => {
                  const reserved = slot.estado !== "disponible";
                  return (
                    <div key={slot.id} className="border border-border rounded-xl p-4 flex flex-col lg:flex-row gap-4 justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded" style={{ fontSize: 12 }}>
                            <CalendarIcon size={14} /> {formatDate(slot.fecha_hora_inicio)}
                          </span>
                          <span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded" style={{ fontSize: 12 }}>
                            <Clock size={14} /> {formatTime(slot.fecha_hora_inicio)} - {formatTime(slot.fecha_hora_fin)}
                          </span>
                          <span className={`px-2 py-0.5 rounded ${reserved ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`} style={{ fontSize: 12 }}>
                            {reserved ? "Reservado" : "Disponible"}
                          </span>
                        </div>
                        {slot.cliente && (
                          <p className="flex items-center gap-1 text-muted-foreground mt-2" style={{ fontSize: 13 }}>
                            <User size={14} /> {slot.cliente.nombre} ({slot.cliente.email})
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editSlot(slot)}
                          disabled={reserved || saving}
                          className="px-3 py-2 border border-border rounded-lg text-muted-foreground hover:text-primary disabled:opacity-40"
                          title="Editar horario"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSlot(slot)}
                          disabled={reserved || saving}
                          className="px-3 py-2 border border-border rounded-lg text-muted-foreground hover:text-red-600 disabled:opacity-40"
                          title="Eliminar horario"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

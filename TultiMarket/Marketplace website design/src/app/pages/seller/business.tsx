import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, MapPin, RotateCcw, Save, Store } from "lucide-react";
import { toast } from "sonner";
import {
  getNegocioVendedorApi,
  updateNegocioVendedorApi,
  type VendedorNegocio,
  type VendedorNegocioPayload,
} from "../../api/api-client";

type BusinessForm = {
  nombre_comercial: string;
  rfc_tax_id: string;
  calle: string;
  ciudad: string;
  estado: string;
  codigo_postal: string;
  pais: string;
  latitud: string;
  longitud: string;
};

const emptyForm: BusinessForm = {
  nombre_comercial: "",
  rfc_tax_id: "",
  calle: "",
  ciudad: "",
  estado: "",
  codigo_postal: "",
  pais: "Mexico",
  latitud: "19.4326",
  longitud: "-99.1332",
};

function toForm(negocio: VendedorNegocio): BusinessForm {
  return {
    nombre_comercial: negocio.nombre_comercial ?? "",
    rfc_tax_id: negocio.rfc_tax_id ?? "",
    calle: negocio.direccion?.calle ?? "",
    ciudad: negocio.direccion?.ciudad ?? "",
    estado: negocio.direccion?.estado ?? "",
    codigo_postal: negocio.direccion?.codigo_postal ?? "",
    pais: negocio.direccion?.pais ?? "Mexico",
    latitud: String(negocio.direccion?.latitud ?? "19.4326"),
    longitud: String(negocio.direccion?.longitud ?? "-99.1332"),
  };
}

export function SellerBusinessPage() {
  const [form, setForm] = useState<BusinessForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<BusinessForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  const loadBusiness = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getNegocioVendedorApi();
      const nextForm = toForm(data.negocio);
      setForm(nextForm);
      setInitialForm(nextForm);
    } catch (error: any) {
      setLoadError(error?.message || "No se pudo cargar el negocio.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBusiness();
  }, []);

  const updateField = (field: keyof BusinessForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = (): VendedorNegocioPayload | null => {
    const latitud = Number(form.latitud);
    const longitud = Number(form.longitud);

    if (!form.nombre_comercial.trim() || !form.calle.trim() || !form.ciudad.trim() || !form.estado.trim() || !form.codigo_postal.trim() || !form.pais.trim()) {
      toast.error("Completa los campos obligatorios.");
      return null;
    }

    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
      toast.error("Latitud y longitud deben ser numeros validos.");
      return null;
    }

    return {
      nombre_comercial: form.nombre_comercial.trim(),
      rfc_tax_id: form.rfc_tax_id.trim() || undefined,
      calle: form.calle.trim(),
      ciudad: form.ciudad.trim(),
      estado: form.estado.trim(),
      codigo_postal: form.codigo_postal.trim(),
      pais: form.pais.trim(),
      latitud,
      longitud,
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;

    setIsSaving(true);
    try {
      const result = await updateNegocioVendedorApi(payload);
      const nextForm = toForm(result.negocio);
      setForm(nextForm);
      setInitialForm(nextForm);
      toast.success(result.mensaje || "Negocio actualizado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar el negocio");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-xl border border-border p-8 text-center">
        <AlertCircle size={42} className="mx-auto text-red-500 mb-3" />
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>No se pudo cargar tu negocio</h1>
        <p className="text-muted-foreground mt-2 mb-5" style={{ fontSize: 14 }}>{loadError}</p>
        <button
          onClick={loadBusiness}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          style={{ fontSize: 14, fontWeight: 500 }}
        >
          <RotateCcw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Mi negocio</h1>
          <p className="text-muted-foreground" style={{ fontSize: 14 }}>
            Mantén actualizados los datos comerciales y la direccion principal.
          </p>
        </div>
        {isDirty && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700" style={{ fontSize: 13, fontWeight: 500 }}>
            Cambios sin guardar
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white rounded-xl border border-border p-5">
          <div className="mb-5 flex items-center gap-2">
            <Store size={19} className="text-primary" />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Datos comerciales</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Nombre comercial *</span>
              <input
                value={form.nombre_comercial}
                onChange={(e) => updateField("nombre_comercial", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                placeholder="Ej. Eventos La Palma"
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>RFC</span>
              <input
                value={form.rfc_tax_id}
                onChange={(e) => updateField("rfc_tax_id", e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 uppercase outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                placeholder="Opcional"
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-border p-5">
          <div className="mb-5 flex items-center gap-2">
            <MapPin size={19} className="text-primary" />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Direccion principal</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Calle y numero *</span>
              <input
                value={form.calle}
                onChange={(e) => updateField("calle", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Ciudad *</span>
              <input
                value={form.ciudad}
                onChange={(e) => updateField("ciudad", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Estado *</span>
              <input
                value={form.estado}
                onChange={(e) => updateField("estado", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Codigo postal *</span>
              <input
                value={form.codigo_postal}
                onChange={(e) => updateField("codigo_postal", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Pais *</span>
              <input
                value={form.pais}
                onChange={(e) => updateField("pais", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Latitud *</span>
              <input
                value={form.latitud}
                onChange={(e) => updateField("latitud", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                inputMode="decimal"
                required
              />
            </label>

            <label>
              <span className="mb-1 block text-muted-foreground" style={{ fontSize: 13 }}>Longitud *</span>
              <input
                value={form.longitud}
                onChange={(e) => updateField("longitud", e.target.value)}
                className="w-full rounded-lg border border-border bg-input-background px-4 py-3 outline-none focus:border-primary"
                style={{ fontSize: 14 }}
                inputMode="decimal"
                required
              />
            </label>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setForm(initialForm)}
            disabled={!isDirty || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 py-3 text-muted-foreground hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            <RotateCcw size={16} /> Deshacer
          </button>
          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}

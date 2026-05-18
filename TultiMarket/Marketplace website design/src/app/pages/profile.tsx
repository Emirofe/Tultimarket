import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  User, MapPin, Plus, Trash2, LogOut, Package, Heart,
  CreditCard, ShieldCheck, AlertTriangle, Loader2, Flag
} from "lucide-react";
import { useStore } from "../context/store-context";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { toast } from "sonner";
import {
  updateMiCuentaApi,
  cambiarPasswordApi,
  eliminarCuentaApi,
  addMetodoPagoApi,
  deleteMetodoPagoApi,
  getReportesCompradorApi,
  type RawReporteComprador,
} from "../api/api-client";
import type { PaymentMethod } from "../data/mock-data";

export function ProfilePage() {
  const {
    currentUser,
    addresses,
    paymentMethods,
    addAddress,
    removeAddress,
    reloadAddresses,
    reloadPaymentMethods,
    logout,
  } = useStore();
  const navigate = useNavigate();

  // ─── Info Personal ──────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ─── Direcciones ────────────────────────────────────────────────
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", street: "", city: "", state: "", zip: "", country: "", latitud: "", longitud: "" });
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // ─── Métodos de Pago ────────────────────────────────────────────
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ provider: "Visa", lastFour: "", expiry: "" });
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // ─── Tabs y Seguridad ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"info" | "addresses" | "payments" | "security" | "reports">("info");
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  // ─── Mis Reportes ─────────────────────────────────────────────────────
  const [myReports, setMyReports] = useState<RawReporteComprador[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // ─── Eliminar Cuenta ───────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ─── Cargar datos iniciales ────────────────────────────────────
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setEmail(currentUser.email || "");
      setPhone(currentUser.phone || "");
    }
  }, [currentUser]);

  useEffect(() => {
    reloadAddresses();
    reloadPaymentMethods();
  }, []);

  // Cargar reportes cuando se activa la pestaña
  useEffect(() => {
    if (activeTab !== "reports") return;
    setLoadingReports(true);
    getReportesCompradorApi()
      .then((data) => setMyReports(data))
      .catch(() => setMyReports([]))
      .finally(() => setLoadingReports(false));
  }, [activeTab]);

  // ────────────────────────────────────────────────────────────────
  // Si no hay sesión, redirigir a login
  // ────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4" style={{ fontSize: 22, fontWeight: 600 }}>Inicia sesion para ver tu perfil</h2>
            <Link to="/login" className="text-primary hover:underline">Iniciar Sesion</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // INFO PERSONAL → updateMiCuentaApi
  // ────────────────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setSavingProfile(true);
    try {
      await updateMiCuentaApi({
        nombre: name.trim(),
        email: email.trim(),
        telefono: phone.trim() || undefined,
      });
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al actualizar perfil";
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // DIRECCIONES → addDireccionApi / deleteDireccionApi (via store)
  // ────────────────────────────────────────────────────────────────
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddr.latitud || !newAddr.longitud) {
      toast.error("Debes proporcionar las coordenadas (Latitud y Longitud)");
      return;
    }
    if (isFetchingLocation) {
      toast.info("Por favor espera, obteniendo ubicación...");
      return;
    }
    try {
      await addAddress({
        ...newAddr,
        latitud: Number(newAddr.latitud),
        longitud: Number(newAddr.longitud),
        isDefault: addresses.length === 0
      } as any);
      setNewAddr({ label: "", street: "", city: "", state: "", zip: "", country: "", latitud: "", longitud: "" });
      setShowAddAddress(false);
      toast.success("Direccion agregada");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al agregar dirección";
      toast.error(msg);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setIsFetchingLocation(true);
    let done = false;

    // watchPosition sigue intentando hasta obtener la ubicación
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(watchId);
        setNewAddr((prev) => ({
          ...prev,
          latitud: position.coords.latitude.toString(),
          longitud: position.coords.longitude.toString(),
        }));
        toast.success("Ubicación obtenida correctamente");
        setIsFetchingLocation(false);
      },
      () => {
        // No hacemos nada aquí — watchPosition reintenta automáticamente
      },
      { enableHighAccuracy: false, maximumAge: 60000 }
    );

    // Timeout de seguridad: si en 20s no hay ubicación, cancelamos
    setTimeout(() => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      toast.error("No se pudo obtener la ubicación. Ingresa las coordenadas manualmente.");
      setIsFetchingLocation(false);
    }, 20000);
  };

  // ────────────────────────────────────────────────────────────────
  // MÉTODOS DE PAGO → addMetodoPagoApi / deleteMetodoPagoApi
  // ────────────────────────────────────────────────────────────────
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{4}$/.test(newPayment.lastFour)) {
      toast.error("Los últimos 4 dígitos deben ser exactamente 4 números");
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(newPayment.expiry)) {
      toast.error("La fecha de expiración debe tener formato MM/YY");
      return;
    }

    try {
      await addMetodoPagoApi({
        proveedor_pago: newPayment.provider,
        token_pasarela: `tok_sim_${Date.now()}`,
        ultimos_cuatro: newPayment.lastFour,
        fecha_expiracion: newPayment.expiry,
      });
      setNewPayment({ provider: "Visa", lastFour: "", expiry: "" });
      setShowAddPayment(false);
      await reloadPaymentMethods();
      toast.success("Metodo de pago agregado");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al agregar metodo de pago";
      toast.error(msg);
    }
  };

  const handleRemovePayment = async (pm: PaymentMethod) => {
    setDeletingPaymentId(pm.id);
    try {
      await deleteMetodoPagoApi(Number(pm.id));
      await reloadPaymentMethods();
      toast.success("Metodo de pago eliminado");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al eliminar metodo de pago";
      toast.error(msg);
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // CAMBIAR CONTRASEÑA → cambiarPasswordApi
  // ────────────────────────────────────────────────────────────────
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwords.new.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    setChangingPassword(true);
    try {
      await cambiarPasswordApi(passwords.current, passwords.new);
      toast.success("Contraseña actualizada correctamente");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al cambiar contraseña";
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // ELIMINAR CUENTA → eliminarCuentaApi
  // ────────────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error("Ingresa tu contraseña para confirmar");
      return;
    }
    setDeletingAccount(true);
    try {
      await eliminarCuentaApi(deletePassword);
      toast.success("Cuenta eliminada. Serás redirigido...");
      setTimeout(async () => {
        await logout();
        navigate("/");
      }, 1500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al eliminar cuenta";
      toast.error(msg);
    } finally {
      setDeletingAccount(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        <h1 className="mb-6" style={{ fontSize: 28, fontWeight: 600 }}>Mi Cuenta</h1>

        {/* Quick nav */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link to="/mis-compras" className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Package size={24} className="text-primary" />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>Mis Pedidos</p>
              <p className="text-muted-foreground" style={{ fontSize: 13 }}>Ver historial</p>
            </div>
          </Link>
          <Link to="/wishlist" className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
              <Heart size={24} className="text-red-500" />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>Lista de Deseos</p>
              <p className="text-muted-foreground" style={{ fontSize: 13 }}>Productos guardados</p>
            </div>
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            className="bg-white rounded-xl border border-border p-5 hover:shadow-md transition-all flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <LogOut size={24} className="text-muted-foreground" />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 500 }}>Cerrar Sesion</p>
              <p className="text-muted-foreground" style={{ fontSize: 13 }}>Salir de tu cuenta</p>
            </div>
          </button>
        </div>

        {/* Tabs Desktop */}
        <div className="flex border-b border-border mb-6 overflow-x-auto bg-white rounded-t-xl px-2">
          {[
            { id: "info", label: "Informacion", icon: <User size={18} /> },
            { id: "addresses", label: "Direcciones", icon: <MapPin size={18} /> },
            { id: "payments", label: "Métodos de Pago", icon: <CreditCard size={18} /> },
            { id: "reports", label: "Mis Reportes", icon: <Flag size={18} /> },
            { id: "security", label: "Seguridad", icon: <ShieldCheck size={18} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-900"
                }`}
              style={{ fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 500 }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/*  TAB: INFORMACIÓN PERSONAL                               */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="space-y-6">
          {activeTab === "info" && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary" style={{ fontSize: 24, fontWeight: 700 }}>
                  {currentUser.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600 }}>{currentUser.name}</h2>
                  <p className="text-muted-foreground capitalize" style={{ fontSize: 14 }}>{currentUser.role}</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Nombre</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none"
                    style={{ fontSize: 14 }}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none"
                    style={{ fontSize: 14 }}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Telefono</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none"
                    style={{ fontSize: 14 }}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full sm:w-auto px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {savingProfile && <Loader2 size={16} className="animate-spin" />}
                    {savingProfile ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/*  TAB: DIRECCIONES                                        */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === "addresses" && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}>
                  <MapPin size={20} /> Mis Direcciones
                </h3>
                <button
                  onClick={() => setShowAddAddress(!showAddAddress)}
                  className="flex items-center gap-1 text-primary hover:underline"
                  style={{ fontSize: 14, fontWeight: 500 }}
                >
                  <Plus size={16} /> Agregar Nueva
                </button>
              </div>

              {showAddAddress && (
                <form onSubmit={handleAddAddress} className="bg-gray-50 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-dashed border-primary/30">
                  <input
                    placeholder="Etiqueta (Ej. Casa, Depa)"
                    value={newAddr.label}
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white" style={{ fontSize: 14 }}
                    required
                  />
                  <input
                    placeholder="Calle y numero"
                    value={newAddr.street}
                    onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-border bg-white" style={{ fontSize: 14 }}
                    required
                  />
                  <input
                    placeholder="Ciudad"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-border bg-white" style={{ fontSize: 14 }}
                    required
                  />
                  <input
                    placeholder="Estado"
                    value={newAddr.state}
                    onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-border bg-white" style={{ fontSize: 14 }}
                    required
                  />
                  <input
                    placeholder="Codigo postal"
                    value={newAddr.zip}
                    onChange={(e) => setNewAddr({ ...newAddr, zip: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-border bg-white" style={{ fontSize: 14 }}
                    required
                  />
                  <input
                    placeholder="País"
                    value={newAddr.country}
                    onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-border bg-white" style={{ fontSize: 14 }}
                    required
                  />

                  {/* Coordenadas */}
                  <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 items-end bg-white p-3 border border-border rounded-lg mt-2">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Latitud *</label>
                      <input
                        type="number" step="any"
                        value={newAddr.latitud}
                        onChange={(e) => setNewAddr({ ...newAddr, latitud: e.target.value })}
                        placeholder="Ej. 19.432608"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-gray-50 focus:bg-white" style={{ fontSize: 14 }}
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Longitud *</label>
                      <input
                        type="number" step="any"
                        value={newAddr.longitud}
                        onChange={(e) => setNewAddr({ ...newAddr, longitud: e.target.value })}
                        placeholder="Ej. -99.133209"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-gray-50 focus:bg-white" style={{ fontSize: 14 }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleGetLocation(); }}
                      disabled={isFetchingLocation}
                      className="w-full sm:w-auto px-6 py-2 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 disabled:opacity-50 transition-colors whitespace-nowrap flex items-center justify-center gap-2"
                      style={{ fontSize: 14 }}
                    >
                      {isFetchingLocation && <Loader2 size={14} className="animate-spin" />}
                      {isFetchingLocation ? "Obteniendo..." : newAddr.latitud ? "Actualizar GPS" : "Obtener GPS"}
                    </button>
                  </div>

                  <div className="sm:col-span-2 flex gap-2 mt-2">
                    <button type="submit" disabled={isFetchingLocation} className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors" style={{ fontSize: 14 }}>Guardar Dirección</button>
                    <button type="button" onClick={() => setShowAddAddress(false)} className="px-6 py-2 border border-border rounded-lg font-medium hover:bg-gray-50 transition-colors" style={{ fontSize: 14 }}>Cancelar</button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {addresses.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No tienes direcciones registradas.</p>
                ) : (
                  addresses.map((addr) => (
                    <div key={addr.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-border transition-colors hover:bg-gray-100/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <p style={{ fontSize: 14, fontWeight: 600 }}>{addr.label}</p>
                          {addr.isDefault && (
                            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20" style={{ fontSize: 11, fontWeight: 500 }}>Envío predeterminado</span>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1" style={{ fontSize: 14 }}>
                          {addr.street}, {addr.city}, {addr.state} {addr.zip}, {addr.country}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await removeAddress(addr.id);
                          toast.success("Direccion eliminada");
                        }}
                        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/*  TAB: MÉTODOS DE PAGO (CONECTADO AL BACKEND)             */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === "payments" && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600 }}>
                  <CreditCard size={20} /> Metodos de Pago
                </h3>
                <button
                  className="flex items-center gap-1 text-primary hover:underline"
                  style={{ fontSize: 14, fontWeight: 500 }}
                  onClick={() => setShowAddPayment(!showAddPayment)}
                >
                  <Plus size={16} /> Agregar Método de Pago
                </button>
              </div>

              {/* Formulario para agregar método de pago */}
              {showAddPayment && (
                <form onSubmit={handleAddPayment} className="bg-gray-50 rounded-lg p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-dashed border-primary/30">
                  <div>
                    <label className="block mb-1 text-muted-foreground" style={{ fontSize: 12 }}>Método de Pago</label>
                    <select
                      value={newPayment.provider}
                      onChange={(e) => setNewPayment({ ...newPayment, provider: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                      style={{ fontSize: 14 }}
                    >
                      <option value="Visa">Visa</option>
                      <option value="MasterCard">MasterCard</option>
                      <option value="American Express">American Express</option>
                      <option value="PayPal">PayPal</option>
                      <option value="OXXO Pay">OXXO Pay</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="Carnet">Carnet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-muted-foreground" style={{ fontSize: 12 }}>Últimos 4 dígitos</label>
                    <input
                      placeholder="1234"
                      maxLength={4}
                      value={newPayment.lastFour}
                      onChange={(e) => setNewPayment({ ...newPayment, lastFour: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                      style={{ fontSize: 14 }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-muted-foreground" style={{ fontSize: 12 }}>Expira (MM/YY)</label>
                    <input
                      placeholder="12/28"
                      maxLength={5}
                      value={newPayment.expiry}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^\d/]/g, "");
                        if (val.length === 2 && !val.includes("/") && newPayment.expiry.length < val.length) {
                          val += "/";
                        }
                        setNewPayment({ ...newPayment, expiry: val.slice(0, 5) });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-white"
                      style={{ fontSize: 14 }}
                      required
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg" style={{ fontSize: 14 }}>Guardar</button>
                    <button type="button" onClick={() => setShowAddPayment(false)} className="px-4 py-2 border border-border rounded-lg" style={{ fontSize: 14 }}>Cancelar</button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {paymentMethods.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No tienes metodos de pago registrados.</p>
                ) : (
                  paymentMethods.map((pm) => (
                    <div key={pm.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center border border-border">
                          <span style={{ fontSize: 10, fontWeight: 700 }}>{pm.provider.toUpperCase()}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600 }}>**** **** **** {pm.lastFour}</p>
                          <p className="text-muted-foreground" style={{ fontSize: 13 }}>Expira {pm.expiry}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePayment(pm)}
                        disabled={deletingPaymentId === pm.id}
                        className="text-gray-400 hover:text-red-500 p-2 transition-colors disabled:opacity-40"
                      >
                        {deletingPaymentId === pm.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/*  TAB: MIS REPORTES                                       */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === "reports" && (
            <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
              <h3 className="flex items-center gap-2 mb-6" style={{ fontSize: 18, fontWeight: 600 }}>
                <Flag size={20} /> Mis Reportes Enviados
              </h3>
              {loadingReports ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Cargando reportes...</span>
                </div>
              ) : myReports.length === 0 ? (
                <div className="text-center py-12">
                  <Flag size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground" style={{ fontSize: 14 }}>No has enviado ningún reporte aún.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myReports.map((r) => {
                    const statusColor =
                      r.estado_reporte === "Pendiente" ? "bg-amber-100 text-amber-700" :
                        r.estado_reporte === "Resuelto" ? "bg-green-100 text-green-700" :
                          r.estado_reporte === "Desestimado" ? "bg-slate-100 text-slate-700" :
                            r.estado_reporte === "Advertencia formal" ? "bg-orange-100 text-orange-700" :
                              "bg-blue-100 text-blue-700";
                    return (
                      <div key={r.id} className="border border-border rounded-xl p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.tipo_objetivo === "producto" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                {r.tipo_objetivo}
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{r.nombre_objetivo}</span>
                            </div>
                            <p className="text-muted-foreground" style={{ fontSize: 13 }}>
                              <span style={{ fontWeight: 500 }}>Motivo:</span> {r.motivo}
                            </p>
                            <p className="text-muted-foreground truncate" style={{ fontSize: 12 }}>{r.descripcion}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                              {r.estado_reporte}
                            </span>
                            <p className="text-muted-foreground mt-1" style={{ fontSize: 11 }}>
                              {r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleDateString("es-MX") : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/*  TAB: SEGURIDAD (cambiar contraseña + eliminar cuenta)   */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Cambiar Contraseña */}
              <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
                <h3 className="flex items-center gap-2 mb-6" style={{ fontSize: 18, fontWeight: 600 }}>
                  <ShieldCheck size={20} /> Cambiar Contraseña
                </h3>

                <form onSubmit={handleUpdatePassword} className="max-w-md space-y-4">
                  <div>
                    <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Contraseña Actual</label>
                    <input
                      type="password"
                      required
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none"
                      style={{ fontSize: 14 }}
                    />
                  </div>
                  <hr className="border-border my-4" />
                  <div>
                    <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Nueva Contraseña</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none"
                      style={{ fontSize: 14 }}
                    />
                    <p className="text-muted-foreground mt-1" style={{ fontSize: 12 }}>Mínimo 8 caracteres</p>
                  </div>
                  <div>
                    <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 13 }}>Confirmar Nueva Contraseña</label>
                    <input
                      type="password"
                      required
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-gray-50 focus:border-primary outline-none"
                      style={{ fontSize: 14 }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {changingPassword && <Loader2 size={16} className="animate-spin" />}
                    {changingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                  </button>
                </form>
              </div>

              {/* Eliminar Cuenta */}
              <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
                <h3 className="flex items-center gap-2 mb-2 text-red-600" style={{ fontSize: 18, fontWeight: 600 }}>
                  <AlertTriangle size={20} /> Gestión de Cuenta
                </h3>
                <p className="text-muted-foreground mb-4" style={{ fontSize: 13 }}>
                  Al desactivar tu cuenta, tu perfil dejará de ser visible y no podrás iniciar sesión. Tu historial de compras se conservará por seguridad.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-5 py-2.5 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    Desactivar mi cuenta
                  </button>
                ) : (
                  <div className="bg-red-50 rounded-lg p-4 space-y-3 border border-red-200">
                    <p className="text-red-700" style={{ fontSize: 13, fontWeight: 500 }}>
                      ⚠️ Ingresa tu contraseña para confirmar la desactivación de tu cuenta:
                    </p>
                    <input
                      type="password"
                      placeholder="Tu contraseña actual"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full max-w-sm px-4 py-2 rounded-lg border border-red-300 bg-white outline-none focus:border-red-500"
                      style={{ fontSize: 14 }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount || !deletePassword}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                        style={{ fontSize: 13, fontWeight: 600 }}
                      >
                        {deletingAccount && <Loader2 size={14} className="animate-spin" />}
                        Confirmar Desactivación
                      </button>
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); }}
                        className="px-4 py-2 border border-border rounded-lg"
                        style={{ fontSize: 13 }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

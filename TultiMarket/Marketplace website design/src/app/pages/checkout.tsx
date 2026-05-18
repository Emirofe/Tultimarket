import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Calendar, CheckCircle, ShoppingCart, CreditCard, Check, Clock } from "lucide-react";
import { useStore } from "../context/store-context";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { Order } from "../data/mock-data";
import { Tag, X } from "lucide-react";
import { validarCuponCarritoApi, type CuponCarritoPreview } from "../api/api-client";

export function CheckoutPage() {
  const { cart, getCartTotal, addresses, paymentMethods, placeOrder } = useStore();
  const [selectedAddress, setSelectedAddress] = useState(addresses[0]?.id || "");
  const [selectedPayment, setSelectedPayment] = useState(paymentMethods[0]?.id || "");
  const [step, setStep] = useState<"confirm" | "success">("confirm");
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CuponCarritoPreview | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cartSubtotal = Number(getCartTotal()) || 0;
  const subtotal = appliedCoupon?.subtotal ?? cartSubtotal;
  const discountAmount = appliedCoupon?.descuento_aplicado ?? 0;
  const total = appliedCoupon?.total ?? subtotal;
  const hasServiceWithoutAgenda = cart.some((item) => item.product.type === "servicio" && !item.agendaSlotId);
  const hasMissingCheckoutData = !selectedAddress || !selectedPayment || addresses.length === 0 || paymentMethods.length === 0;

  useEffect(() => {
    if (addresses.length === 0) {
      setSelectedAddress("");
      return;
    }

    if (!selectedAddress || !addresses.some((addr) => addr.id === selectedAddress)) {
      setSelectedAddress(addresses[0].id);
    }
  }, [addresses, selectedAddress]);

  useEffect(() => {
    if (paymentMethods.length === 0) {
      setSelectedPayment("");
      return;
    }

    if (!selectedPayment || !paymentMethods.some((pm) => pm.id === selectedPayment)) {
      setSelectedPayment(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPayment]);

  if (cart.length === 0 && step !== "success") {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4" style={{ fontSize: 22, fontWeight: 600 }}>Tu carrito esta vacio</h2>
            <Link to="/" className="text-primary hover:underline" style={{ fontSize: 14 }}>Ir a comprar</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handleApplyCoupon = async () => {
    const codigo = couponCode.trim().toUpperCase();
    if (!codigo) {
      alert("Escribe un codigo de cupon");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const preview = await validarCuponCarritoApi(codigo);
      setAppliedCoupon(preview);
      setCouponCode("");
    } catch (error: any) {
      setAppliedCoupon(null);
      alert(error?.message || "Codigo de cupon invalido");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (isProcessing) return;
    if (hasServiceWithoutAgenda) {
      alert("Hay servicios sin horario seleccionado. Elige un horario antes de confirmar.");
      return;
    }
    if (hasMissingCheckoutData) {
      alert("Selecciona una direccion de envio y un metodo de pago antes de confirmar.");
      return;
    }
    setIsProcessing(true);
    try {
      const addr = addresses.find((a) => a.id === selectedAddress);
      const addressStr = addr
        ? `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}, ${addr.country}`
        : "";
      const addrNumId = selectedAddress ? Number(selectedAddress) : undefined;
      const payNumId = selectedPayment ? Number(selectedPayment) : undefined;
      const order = await placeOrder(addressStr, addrNumId, payNumId, appliedCoupon?.cupon.codigo_cupon ?? null);
      // Enrich order with payment method info for receipt
      const pm = paymentMethods.find((m) => m.id === selectedPayment);
      if (pm) {
        order.paymentMethod = `${pm.provider ?? pm.type ?? "Tarjeta"} ****${pm.lastFour ?? ""}`;
      }
      setCompletedOrder(order);
      setStep("success");
    } catch (error: any) {
      console.error("Error al confirmar pedido:", error);
      const msg = error?.message || "Error desconocido";
      alert(`Error al procesar tu pedido: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const stepper = [
    { label: "Carrito", icon: ShoppingCart, done: true },
    { label: "Confirmacion", icon: CreditCard, done: step === "success" },
    { label: "Completado", icon: Check, done: step === "success" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-10">
          {stepper.map((s, idx) => (
            <div key={s.label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    s.done ? "bg-primary text-white" : idx === 1 && step === "confirm" ? "bg-primary text-white" : "bg-gray-200 text-muted-foreground"
                  }`}
                >
                  <s.icon size={20} />
                </div>
                <span className="mt-2" style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</span>
              </div>
              {idx < stepper.length - 1 && (
                <div className={`w-20 h-0.5 mx-2 mt-[-20px] ${s.done ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {step === "confirm" ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Order details */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border border-border p-6">
                <h2 className="mb-4" style={{ fontSize: 20, fontWeight: 600 }}>Resumen del Pedido</h2>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.cartKey ?? item.product.id} className="flex items-center gap-4 pb-4 border-b border-border last:border-0">
                      <img src={item.product.image} alt={item.product.name} className="w-16 h-16 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{item.product.name}</p>
                        <p className="text-muted-foreground" style={{ fontSize: 13 }}>Cant: {item.quantity}</p>
                        {item.product.type === "servicio" && item.selectedDate && item.selectedTime && (
                          <p className="text-primary flex items-center gap-1 mt-1" style={{ fontSize: 12 }}>
                            <Calendar size={13} /> {item.selectedDate}
                            <Clock size={13} className="ml-1" /> {item.selectedTime}{item.selectedEndTime ? ` - ${item.selectedEndTime}` : ""}
                          </p>
                        )}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 600 }}>${((Number(item.product.price) || 0) * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address selection */}
              <div className="bg-white rounded-xl border border-border p-6 mt-4">
                <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>Direccion de Envio</h3>
                {addresses.length === 0 ? (
                  <p className="text-muted-foreground" style={{ fontSize: 14 }}>
                    No tienes direcciones guardadas.{" "}
                    <Link to="/perfil" className="text-primary hover:underline">Agregar una</Link>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedAddress === addr.id ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          value={addr.id}
                          checked={selectedAddress === addr.id}
                          onChange={() => setSelectedAddress(addr.id)}
                          className="mt-1 accent-[#065F46]"
                        />
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500 }}>{addr.label}</p>
                          <p className="text-muted-foreground" style={{ fontSize: 14 }}>
                            {addr.street}, {addr.city}, {addr.state} {addr.zip}, {addr.country}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment method selection */}
              <div className="bg-white rounded-xl border border-border p-6 mt-4">
                <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>Método de Pago</h3>
                {paymentMethods.length === 0 ? (
                  <p className="text-muted-foreground" style={{ fontSize: 14 }}>
                    No tienes métodos de pago guardados.{" "}
                    <Link to="/perfil" className="text-primary hover:underline">Agregar uno</Link>
                  </p>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((pm) => (
                      <label
                        key={pm.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedPayment === pm.id ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={pm.id}
                          checked={selectedPayment === pm.id}
                          onChange={() => setSelectedPayment(pm.id)}
                          className="mt-1 accent-[#065F46]"
                        />
                        <div className="flex items-center gap-2">
                          <CreditCard size={20} className="text-muted-foreground" />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 500 }}>
                              {pm.provider ?? pm.type ?? "Tarjeta"} ****{pm.lastFour ?? ""}
                            </p>
                            {pm.expiry && (
                              <p className="text-muted-foreground" style={{ fontSize: 12 }}>
                                Vence: {pm.expiry}
                              </p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total & confirm */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-border p-6 sticky top-24">
                <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>Total del Pedido</h3>
                <div className="space-y-2 mb-4" style={{ fontSize: 14 }}>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Tag size={14} /> Cupon ({appliedCoupon.cupon.codigo_cupon})
                      </span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envio</span>
                    <span className="text-green-600">Gratis</span>
                  </div>
                </div>

                {/* Coupon Input */}
                {!appliedCoupon ? (
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Codigo de cupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 border border-border rounded-lg outline-none focus:border-primary uppercase"
                        style={{ fontSize: 13 }}
                      />
                      <button 
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon}
                        className="px-4 py-2 bg-gray-100 border border-border rounded-lg hover:bg-gray-200 disabled:opacity-50"
                        style={{ fontSize: 13, fontWeight: 600 }}
                      >
                        {isApplyingCoupon ? "..." : "Aplicar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-green-700" style={{ fontSize: 12, fontWeight: 600 }}>
                      {appliedCoupon.cupon.codigo_cupon} aplicado a {appliedCoupon.items_afectados.length} item(s)
                    </span>
                    <button onClick={() => setAppliedCoupon(null)} className="text-green-700">
                        <X size={14} />
                    </button>
                  </div>
                )}
                <hr className="border-border mb-4" />
                <div className="flex justify-between mb-6">
                  <span style={{ fontSize: 18, fontWeight: 600 }}>Total</span>
                  <span className="text-primary" style={{ fontSize: 24, fontWeight: 700 }}>${total.toFixed(2)}</span>
                </div>
                <p className="text-muted-foreground mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3" style={{ fontSize: 12 }}>
                  Este es un pedido simulado. No se procesara ningun pago real.
                </p>
                {hasServiceWithoutAgenda && (
                  <p className="text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg p-3" style={{ fontSize: 12 }}>
                    Hay servicios sin horario seleccionado.
                  </p>
                )}
                {hasMissingCheckoutData && (
                  <p className="text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg p-3" style={{ fontSize: 12 }}>
                    Agrega y selecciona una direccion de envio y un metodo de pago.
                  </p>
                )}
                <button
                  onClick={handleConfirmOrder}
                  disabled={isProcessing || hasServiceWithoutAgenda || hasMissingCheckoutData}
                  className={`w-full text-white py-3.5 rounded-xl transition-colors ${
                    isProcessing || hasServiceWithoutAgenda || hasMissingCheckoutData ? "bg-gray-400 cursor-not-allowed" : "bg-primary hover:bg-primary/90"
                  }`}
                  style={{ fontSize: 16, fontWeight: 600 }}
                >
                  {isProcessing ? "Procesando..." : "Confirmar Pedido"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Success state — Recibo completo */
          <div className="py-8 bg-white rounded-2xl border border-border max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={48} className="text-green-600" />
              </div>
              <h2 className="mb-2" style={{ fontSize: 28, fontWeight: 700 }}>¡Pedido Confirmado!</h2>
              <p className="text-muted-foreground" style={{ fontSize: 16 }}>
                Gracias por tu compra
              </p>
            </div>
            {completedOrder && (
              <div className="px-6 md:px-10">
                {/* Datos generales del pedido */}
                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ fontSize: 14 }}>
                    <div>
                      <p className="text-muted-foreground">Folio</p>
                      <p style={{ fontWeight: 600 }}>{completedOrder.folio}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fecha</p>
                      <p style={{ fontWeight: 600 }}>{completedOrder.date}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado</p>
                      <p className="text-amber-600" style={{ fontWeight: 600 }}>{completedOrder.status}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-primary" style={{ fontWeight: 700, fontSize: 18 }}>
                        ${(Number(completedOrder.total) || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Items comprados */}
                {completedOrder.items.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Productos Comprados</h3>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full" style={{ fontSize: 14 }}>
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Producto</th>
                            <th className="text-center px-4 py-3 text-muted-foreground font-medium">Cant.</th>
                            <th className="text-right px-4 py-3 text-muted-foreground font-medium">P. Unit.</th>
                            <th className="text-right px-4 py-3 text-muted-foreground font-medium">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedOrder.items.map((item, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img src={item.product.image} alt={item.product.name} className="w-10 h-10 rounded object-cover" />
                                  <div className="min-w-0">
                                    <span className="truncate max-w-[200px] block">{item.product.name}</span>
                                    {item.product.type === "servicio" && item.selectedDate && item.selectedTime && (
                                      <span className="text-primary block mt-1" style={{ fontSize: 12 }}>
                                        {item.selectedDate}, {item.selectedTime}{item.selectedEndTime ? ` - ${item.selectedEndTime}` : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="text-center px-4 py-3">{item.quantity}</td>
                              <td className="text-right px-4 py-3">${(Number(item.product.price) || 0).toFixed(2)}</td>
                              <td className="text-right px-4 py-3" style={{ fontWeight: 600 }}>
                                ${((Number(item.product.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Método de pago y dirección */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {completedOrder.paymentMethod && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-muted-foreground mb-1" style={{ fontSize: 13 }}>Método de Pago</p>
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-muted-foreground" />
                        <p style={{ fontSize: 14, fontWeight: 500 }}>{completedOrder.paymentMethod}</p>
                      </div>
                    </div>
                  )}
                  {completedOrder.address && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-muted-foreground mb-1" style={{ fontSize: 13 }}>Dirección de Envío</p>
                      <p style={{ fontSize: 14 }}>{completedOrder.address}</p>
                    </div>
                  )}
                </div>

                {/* Total final */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center mb-6">
                  <span style={{ fontSize: 18, fontWeight: 600 }}>Total Pagado</span>
                  <span className="text-primary" style={{ fontSize: 28, fontWeight: 700 }}>
                    ${(Number(completedOrder.total) || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-center px-6">
              <Link
                to="/mis-compras"
                className="px-6 py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary/5 transition-colors"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                Ver Mis Compras
              </Link>
              <Link
                to="/"
                className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                Seguir Comprando
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

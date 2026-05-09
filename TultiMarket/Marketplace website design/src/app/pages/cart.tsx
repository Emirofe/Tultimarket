import { Link } from "react-router";
import { Minus, Plus, Trash2, ShoppingBag, Tag } from "lucide-react";
import { useStore } from "../context/store-context";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { toast } from "sonner";

export function CartPage() {
  const { cart, updateCartQuantity, removeFromCart, getCartTotal } = useStore();
  const total = Number(getCartTotal()) || 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="flex items-center gap-3 mb-6">
          <h1 style={{ fontSize: 28, fontWeight: 600 }}>Carrito de Compras</h1>

        </div>

        {cart.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-border">
            <ShoppingBag size={64} className="mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="mb-2" style={{ fontSize: 22, fontWeight: 600 }}>Tu carrito esta vacio</h2>
            <p className="text-muted-foreground mb-6" style={{ fontSize: 14 }}>
              Descubre productos increibles para tu proxima fiesta
            </p>
            <Link
              to="/"
              className="inline-block bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors"
              style={{ fontSize: 16, fontWeight: 600 }}
            >
              Explorar Productos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-white rounded-xl border border-border p-4 md:p-6 flex gap-4"
                >
                  <Link to={`/producto/${item.product.id}`} className="shrink-0">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/producto/${item.product.id}`} className="hover:text-primary transition-colors">
                      <h3 className="line-clamp-2" style={{ fontSize: 16, fontWeight: 500 }}>{item.product.name}</h3>
                    </Link>
                    <p className="text-muted-foreground mt-1" style={{ fontSize: 13 }}>
                      Vendedor: {item.product.sellerName}
                    </p>
                    {item.product.type === "servicio" && item.selectedDate && item.selectedTime && (
                      <div className="mt-2 text-primary bg-primary/5 px-2 py-1 rounded inline-block" style={{ fontSize: 12, fontWeight: 500 }}>
                        Agendado para: {item.selectedDate} a las {item.selectedTime}
                      </div>
                    )}
                    <p className="text-primary mt-2" style={{ fontSize: 18, fontWeight: 700 }}>
                      ${(Number(item.product.price) || 0).toFixed(2)}
                    </p>

                    <div className="flex items-center justify-between mt-4">
                      {item.product.type !== "servicio" ? (
                        <div className="flex items-center border border-border rounded-lg">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="p-2 hover:bg-gray-50 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="px-4 min-w-[40px] text-center" style={{ fontSize: 14, fontWeight: 600 }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              const maxStock = item.product.stock;
                              if (maxStock > 0 && item.quantity >= maxStock) {
                                toast.error(`Solo hay ${maxStock} unidades disponibles`);
                                return;
                              }
                              updateCartQuantity(item.product.id, item.quantity + 1);
                            }}
                            className="p-2 hover:bg-gray-50 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center text-muted-foreground" style={{ fontSize: 14 }}>
                          Servicio (1)
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <span style={{ fontSize: 16, fontWeight: 600 }}>
                          ${((Number(item.product.price) || 0) * (Number(item.quantity) || 0)).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-red-500 hover:text-red-700 p-1 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-border p-6 sticky top-24">
                <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>Resumen del Pedido</h3>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between" style={{ fontSize: 14 }}>
                    <span className="text-muted-foreground">Subtotal ({cart.length} producto{cart.length !== 1 ? "s" : ""})</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between" style={{ fontSize: 14 }}>
                    <span className="text-muted-foreground">Envio estimado</span>
                    <span className="text-green-600">Gratis</span>
                  </div>
                </div>
                <hr className="border-border mb-4" />
                <div className="flex justify-between mb-6">
                  <span style={{ fontSize: 18, fontWeight: 600 }}>Total</span>
                  <span className="text-primary" style={{ fontSize: 22, fontWeight: 700 }}>
                    ${total.toFixed(2)}
                  </span>
                </div>
                <Link
                  to="/checkout"
                  className="block w-full text-center bg-primary text-white py-3.5 rounded-xl hover:bg-primary/90 transition-colors"
                  style={{ fontSize: 16, fontWeight: 600 }}
                >
                  Proceder al Pago
                </Link>
                <Link
                  to="/"
                  className="block w-full text-center text-primary py-2 mt-3 hover:underline"
                  style={{ fontSize: 14 }}
                >
                  Seguir Comprando
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

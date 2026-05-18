import { Link } from "react-router";
import { CalendarDays, Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useStore } from "../context/store-context";
import { Navbar } from "../components/layout/navbar";
import { Footer } from "../components/layout/footer";
import { StarRating } from "../components/star-rating";
import { toast } from "sonner";

export function WishlistPage() {
  const { wishlist, removeFromWishlist, addToCart } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        <h1 className="mb-6" style={{ fontSize: 28, fontWeight: 600 }}>
          Lista de Deseos ({wishlist.length})
        </h1>

        {wishlist.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-border">
            <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="mb-2" style={{ fontSize: 20, fontWeight: 600 }}>Tu lista de deseos esta vacia</h2>
            <p className="text-muted-foreground mb-4" style={{ fontSize: 14 }}>
              Guarda los productos que te gusten para comprarlos despues
            </p>
            <Link to="/" className="inline-block bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors" style={{ fontSize: 14 }}>
              Explorar Productos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {wishlist.map((product) => (
              <div key={`${product.type ?? "producto"}:${product.id}`} className="bg-white rounded-xl border border-border overflow-hidden">
                <Link to={`/producto/${product.id}${product.type === "servicio" ? "?type=servicio" : ""}`} className="block">
                  <div className="aspect-square bg-gray-50">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                </Link>
                <div className="p-4">
                  <Link to={`/producto/${product.id}${product.type === "servicio" ? "?type=servicio" : ""}`} className="hover:text-primary transition-colors">
                    <h3 className="line-clamp-2 mb-2" style={{ fontSize: 14 }}>{product.name}</h3>
                  </Link>
                  <StarRating rating={product.rating} size={14} />
                  <p className="text-primary mt-2 mb-4" style={{ fontSize: 18, fontWeight: 700 }}>
                    ${(Number(product.price) || 0).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2">
                    {product.type === "servicio" ? (
                      <Link
                        to={`/producto/${product.id}?type=servicio`}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
                        style={{ fontSize: 14 }}
                      >
                        <CalendarDays size={16} /> Ver agenda
                      </Link>
                    ) : product.stock > 0 ? (
                      <button
                        onClick={async () => {
                          try {
                            await addToCart(product);
                            toast.success("Agregado al carrito");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "No se pudo agregar al carrito");
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
                        style={{ fontSize: 14 }}
                      >
                        <ShoppingCart size={16} /> Agregar
                      </button>
                    ) : (
                      <span className="flex-1 text-center text-red-500 py-2.5" style={{ fontSize: 14 }}>Agotado</span>
                    )}
                    <button
                      onClick={() => {
                        removeFromWishlist(product.id, product.type ?? "producto");
                        toast("Eliminado de la lista");
                      }}
                      className="p-2.5 border border-border rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

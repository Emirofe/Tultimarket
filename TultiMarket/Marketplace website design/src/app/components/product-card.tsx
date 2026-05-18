import { CalendarDays, Heart, ShoppingCart } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Product } from "../data/mock-data";
import { StarRating } from "./star-rating";
import { useStore } from "../context/store-context";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useStore();
  const inWishlist = isInWishlist(product.id, product.type ?? "producto");
  const navigate = useNavigate();
  const hasDiscount =
    product.originalPrice != null && product.originalPrice > product.price;
  const discountPercent = hasDiscount
    ? product.discountPercent ?? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)
    : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.type === "servicio") {
      navigate(`/producto/${product.id}?type=servicio`);
      return;
    }

    try {
      await addToCart(product);
      toast.success(`${product.name} agregado al carrito`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar al carrito");
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWishlist) {
      removeFromWishlist(product.id, product.type ?? "producto");
      toast("Eliminado de lista de deseos");
    } else {
      addToWishlist(product);
      toast.success("Agregado a lista de deseos");
    }
  };

  return (
    <Link
      to={`/producto/${product.id}${product.type === "servicio" ? "?type=servicio" : ""}`}
      className="group bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
    >
      <div className="relative overflow-hidden aspect-square bg-gray-50">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <button
          onClick={handleToggleWishlist}
          className={`absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white transition-colors ${
            inWishlist ? "text-red-500" : "text-gray-400 hover:text-red-500"
          }`}
        >
          <Heart size={18} className={inWishlist ? "fill-current" : ""} />
        </button>
        {hasDiscount && (
          <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-0.5 rounded-md" style={{ fontSize: 12 }}>
            -{Math.round(discountPercent)}%
          </div>
        )}
        {product.stock < 10 && product.stock > 0 && (
          <div className="absolute bottom-3 left-3 bg-amber-500 text-white px-2 py-0.5 rounded-md" style={{ fontSize: 12 }}>
            Quedan {product.stock}
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-muted-foreground mb-1" style={{ fontSize: 12 }}>
          {product.sellerName}
        </p>
        <h3 className="mb-2 line-clamp-2 group-hover:text-primary transition-colors" style={{ fontSize: 14 }}>
          {product.name}
        </h3>
        <div className="mb-2">
          <StarRating rating={product.rating} size={14} showCount count={product.reviewCount} />
        </div>
        <div className="flex items-baseline gap-2 mb-3 mt-auto">
          <span className="text-primary" style={{ fontSize: 20, fontWeight: 700 }}>
            ${product.price.toFixed(2)}
          </span>
          {hasDiscount && (
            <span className="text-muted-foreground line-through" style={{ fontSize: 13 }}>
              ${product.originalPrice!.toFixed(2)}
            </span>
          )}
        </div>
        {product.type === "servicio" && (
          <div className="flex items-center gap-1.5 text-muted-foreground mb-3" style={{ fontSize: 12 }}>
            <CalendarDays size={14} />
            <span className="line-clamp-1">{product.availability ?? "Consulta horarios disponibles"}</span>
          </div>
        )}
        <button
          onClick={handleAddToCart}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          style={{ fontSize: 14 }}
        >
          <ShoppingCart size={16} />
          {product.type === "servicio" ? "Ver horarios" : "Agregar al carrito"}
        </button>
      </div>
    </Link>
  );
}

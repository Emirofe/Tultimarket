import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Store } from "lucide-react";
import { getCategoriasApi } from "../../api/api-client";

export function Footer() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getCategoriasApi()
      .then((cats) => setCategories(cats))
      .catch(() => setCategories([]));
  }, []);

  return (
    <footer className="bg-[#121E2B] text-white/80">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Store size={24} className="text-amber-400" />
              <span style={{ fontSize: 20, fontWeight: 700 }} className="text-white">TultiMarket</span>
            </div>
            <p style={{ fontSize: 14 }}>
              Tu marketplace de confianza para todo lo que necesites.
            </p>
          </div>
          <div>
            <h4 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Categorias</h4>
            <div className="space-y-2">
              {categories.slice(0, 5).map((cat) => (
                <Link key={cat.id} to={`/?categoria=${cat.id}`} className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>
                  {cat.name}
                </Link>
              ))}
              {categories.length > 5 && (
                <Link to="/" className="block text-amber-400 hover:text-amber-300 transition-colors mt-2" style={{ fontSize: 14, fontWeight: 500 }}>
                  Ver todas las categorías &rarr;
                </Link>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Mi Cuenta</h4>
            <div className="space-y-2">
              <Link to="/perfil" className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>Mi Perfil</Link>
              <Link to="/mis-compras" className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>Mis Compras</Link>
              <Link to="/wishlist" className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>Lista de Deseos</Link>
              <Link to="/carrito" className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>Carrito</Link>
            </div>
          </div>
          <div>
            <h4 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 600 }}>Vendedores</h4>
            <div className="space-y-2">
              <Link to="/registro" className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>Vende con nosotros</Link>
              <Link to="/wireframes" className="block hover:text-amber-400 transition-colors" style={{ fontSize: 14 }}>Wireframes iniciales / Docs</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/20 mt-8 pt-6 text-center" style={{ fontSize: 13 }}>
          <p>&copy; 2026 TultiMarket. Todos los derechos reservados pa los integrantes chambeadores del equipo de "Unicornios Diabeticos"</p>
        </div>
      </div>
    </footer>
  );
}
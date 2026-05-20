import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  LogOut,
  Package,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Store,
  Brain,
} from "lucide-react";
import { useStore } from "../../context/store-context";
import { type Product } from "../../data/mock-data";
import { getAllProductosApi, getServiciosGlobalApi, getTopCategoriasApi } from "../../api/api-client";
import { NotificationBell } from "./notification-bell";

export function Navbar() {
  const { currentUser, isLoggedIn, logout, getCartCount, wishlist } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [topCategories, setTopCategories] = useState<{ id: string; name: string; total: number }[]>([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState<Product[]>([]);
  const navScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTopCategoriasApi()
      .then((cats) => setTopCategories(cats))
      .catch(() => setTopCategories([]));
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length <= 1) {
      setCatalogSuggestions([]);
      return;
    }

    let isActive = true;
    const timer = window.setTimeout(() => {
      Promise.all([
        getAllProductosApi({ q, ordenar: "relevancia" }).catch(() => []),
        getServiciosGlobalApi({ q, ordenar: "relevancia" }).catch(() => []),
      ])
        .then(([prods, servs]) => {
          if (!isActive) return;
          const unique = Array.from(new Map([...prods, ...servs].map((p) => [`${p.type}-${p.id}`, p])).values());
          setCatalogSuggestions(unique.slice(0, 5));
        })
        .catch(() => {
          if (isActive) setCatalogSuggestions([]);
        });
    }, 250);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const navigate = useNavigate();
  const cartCount = getCartCount();
  const suggestions = catalogSuggestions;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setShowSuggestions(false);
    navigate(`/?buscar=${encodeURIComponent(query)}`);
  };

  const getDashboardLink = () => {
    if (!currentUser) return "/login";
    if (currentUser.role === "vendedor") return "/vendedor/productos";
    if (currentUser.role === "admin") return "/admin/usuarios";
    return "/perfil";
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#121E2B] to-[#1E2C3E] text-white shadow-lg">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto pl-15 pr-4">
        <div className="flex items-center gap-6 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Store size={28} className="text-amber-400" />
            <span className="hidden sm:block" style={{ fontSize: 22, fontWeight: 700 }}>
              TultiMarket
            </span>
          </Link>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-2xl relative"
          >
            <div className="flex rounded-lg overflow-hidden">
              <input
                type="text"
                placeholder="Buscar productos o servicios..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="flex-1 px-4 py-2.5 text-foreground bg-white rounded-l-lg outline-none"
                style={{ fontSize: 14 }}
              />
              <button
                type="submit"
                className="bg-amber-400 hover:bg-amber-300 px-4 text-[#121E2B] transition-colors"
                aria-label="Buscar"
              >
                <Search size={20} />
              </button>
            </div>

            {/* Search suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-border overflow-hidden z-50">
                {suggestions.map((product) => (
                  <Link
                    key={`${product.type}-${product.id}`}
                    to={`/producto/${product.id}${product.type === "servicio" ? "?type=servicio" : ""}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-foreground transition-colors"
                    onClick={() => setShowSuggestions(false)}
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 14 }}>{product.name}</p>
                      <p className="text-primary" style={{ fontSize: 13, fontWeight: 600 }}>
                        ${product.price.toFixed(2)} · {product.type === "servicio" ? "Servicio" : "Producto"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </form>

          {/* Desktop nav icons */}
          <div className="hidden md:flex items-center gap-1">
            {isLoggedIn ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ fontSize: 14 }}
                    aria-label="Menu de usuario"
                  >
                    <User size={20} />
                    <ChevronDown size={14} />
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-border py-2 z-50">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-foreground font-semibold" style={{ fontSize: 13 }}>
                          {currentUser?.name}
                        </p>
                        <p className="text-muted-foreground" style={{ fontSize: 11 }}>
                          {currentUser?.email}
                        </p>
                      </div>
                      <Link
                        to="/perfil"
                        className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-gray-50"
                        style={{ fontSize: 14 }}
                        onClick={() => setShowUserMenu(false)}
                      >
                        <User size={16} /> Mi Cuenta
                      </Link>
                      <Link
                        to="/mis-compras"
                        className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-gray-50"
                        style={{ fontSize: 14 }}
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Package size={16} /> Mis Compras
                      </Link>
                      {currentUser?.role === "vendedor" && (
                        <Link
                          to="/vendedor/productos"
                          className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-gray-50"
                          style={{ fontSize: 14 }}
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings size={16} /> Panel Vendedor
                        </Link>
                      )}
                      {currentUser?.role === "admin" && (
                        <Link
                          to="/admin/usuarios"
                          className="flex items-center gap-2 px-4 py-2 text-foreground hover:bg-gray-50"
                          style={{ fontSize: 14 }}
                          onClick={() => setShowUserMenu(false)}
                        >
                          <Settings size={16} /> Panel Admin
                        </Link>
                      )}
                      <hr className="my-2 border-border" />
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                          navigate("/");
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-gray-50 w-full"
                        style={{ fontSize: 14 }}
                      >
                        <LogOut size={16} /> Cerrar Sesion
                      </button>
                    </div>
                  )}
                </div>

                {/* 🔔 Notification Bell */}
                <NotificationBell />
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                style={{ fontSize: 14 }}
              >
                <User size={20} />
                <span>Inicia Sesion</span>
              </Link>
            )}

            <Link
              to="/buscar"
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors hidden lg:inline-block"
              title="Búsqueda Inteligente con IA"
            >
              <Brain size={22} className="text-amber-400" />
            </Link>

            <Link
              to="/wishlist"
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Heart size={22} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-[#121E2B] w-5 h-5 rounded-full flex items-center justify-center" style={{ fontSize: 11, fontWeight: 700 }}>
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link
              to="/carrito"
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-[#121E2B] w-5 h-5 rounded-full flex items-center justify-center" style={{ fontSize: 11, fontWeight: 700 }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Category quick-nav bar — top 10 por popularidad */}
      {topCategories.length > 0 && (
        <div className="bg-[#0D1820] border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-2">
            <button
              onClick={() => navScrollRef.current?.scrollBy({ left: -250, behavior: "smooth" })}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
            >
              <ChevronLeft size={16} />
            </button>
            <div
              ref={navScrollRef}
              className="flex items-center gap-1 overflow-x-auto py-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {topCategories.map((cat, idx) => (
                <span key={cat.id} className="flex items-center">
                  <Link
                    to={`/?cat=${cat.id}`}
                    className="px-3 py-1.5 whitespace-nowrap hover:text-amber-300 rounded transition-colors text-white/80 hover:bg-white/5"
                    style={{ fontSize: 13 }}
                  >
                    {cat.name}
                  </Link>
                  {idx < topCategories.length - 1 && (
                    <span className="text-white/20">·</span>
                  )}
                </span>
              ))}
            </div>
            <button
              onClick={() => navScrollRef.current?.scrollBy({ left: 250, behavior: "smooth" })}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gradient-to-r from-[#121E2B] to-[#1E2C3E] border-t border-white/20 px-4 py-4 space-y-2">
          {isLoggedIn ? (
            <>
              <Link to="/perfil" className="block py-2 hover:bg-white/10 px-3 rounded" style={{ fontSize: 14 }} onClick={() => setMobileMenuOpen(false)}>
                Mi Cuenta
              </Link>
              <Link to="/mis-compras" className="block py-2 hover:bg-white/10 px-3 rounded" style={{ fontSize: 14 }} onClick={() => setMobileMenuOpen(false)}>
                Mis Compras
              </Link>
              <Link to={getDashboardLink()} className="block py-2 hover:bg-white/10 px-3 rounded" style={{ fontSize: 14 }} onClick={() => setMobileMenuOpen(false)}>
                Mi Panel
              </Link>
            </>
          ) : (
            <Link to="/login" className="block py-2 hover:bg-white/10 px-3 rounded" style={{ fontSize: 14 }} onClick={() => setMobileMenuOpen(false)}>
              Inicia Sesion
            </Link>
          )}
          <Link to="/wishlist" className="flex items-center gap-2 py-2 hover:bg-white/10 px-3 rounded" style={{ fontSize: 14 }} onClick={() => setMobileMenuOpen(false)}>
            <Heart size={18} /> Lista de Deseos ({wishlist.length})
          </Link>
          <Link to="/carrito" className="flex items-center gap-2 py-2 hover:bg-white/10 px-3 rounded" style={{ fontSize: 14 }} onClick={() => setMobileMenuOpen(false)}>
            <ShoppingCart size={18} /> Carrito ({cartCount})
          </Link>
          {isLoggedIn && (
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
                navigate("/");
              }}
              className="flex items-center gap-2 py-2 text-red-300 hover:bg-white/10 px-3 rounded w-full"
              style={{ fontSize: 14 }}
            >
              <LogOut size={18} /> Cerrar Sesion
            </button>
          )}
        </div>
      )}
    </header>
  );
}

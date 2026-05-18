import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { getProductosVendedorApi } from "../../api/api-client";
import { useStore } from "../../context/store-context";
import { toast } from "sonner";

type SellerProduct = Awaited<ReturnType<typeof getProductosVendedorApi>>[number];

interface SellerBundle {
  id: string;
  name: string;
  productIds: number[];
  bundlePrice: number;
  createdAt: string;
}

export function SellerBundlesPage() {
  const { negocioId } = useStore();
  const storageKey = `seller-bundles-${negocioId ?? "none"}`;
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [bundles, setBundles] = useState<SellerBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);

  useEffect(() => {
    if (!negocioId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getProductosVendedorApi(negocioId)
      .then((data) => setProducts(data.filter((product) => product.esta_activo)))
      .catch(() => toast.error("Error al cargar productos para paquetes"))
      .finally(() => setLoading(false));
  }, [negocioId]);

  useEffect(() => {
    if (!negocioId) return;
    const saved = window.localStorage.getItem(storageKey);
    setBundles(saved ? JSON.parse(saved) : []);
  }, [negocioId, storageKey]);

  const saveBundles = (nextBundles: SellerBundle[]) => {
    setBundles(nextBundles);
    window.localStorage.setItem(storageKey, JSON.stringify(nextBundles));
  };

  const selectedItems = useMemo(
    () => products.filter((product) => selectedProducts.includes(product.id)),
    [products, selectedProducts]
  );
  const originalTotal = selectedItems.reduce((sum, product) => sum + Number(product.precio || 0), 0);

  const toggleProduct = (id: number) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((productId) => productId !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setShowForm(false);
    setBundleName("");
    setBundlePrice("");
    setSelectedProducts([]);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(bundlePrice);

    if (selectedProducts.length < 2) {
      toast.error("Selecciona al menos 2 productos");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Captura un precio valido para el paquete");
      return;
    }

    const nextBundle: SellerBundle = {
      id: `bundle-${Date.now()}`,
      name: bundleName.trim(),
      productIds: selectedProducts,
      bundlePrice: price,
      createdAt: new Date().toISOString(),
    };

    saveBundles([nextBundle, ...bundles]);
    resetForm();
    toast.success("Paquete promocional creado");
  };

  const deleteBundle = (id: string) => {
    saveBundles(bundles.filter((bundle) => bundle.id !== id));
    toast.success("Paquete eliminado");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Paquetes Promocionales</h1>
          <p className="text-muted-foreground mt-1" style={{ fontSize: 14 }}>
            Combina productos reales de tu catálogo en ofertas para vender más fácil.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-primary/90"
          style={{ fontSize: 14 }}
        >
          <Plus size={18} /> Crear Paquete
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h3 className="mb-4" style={{ fontSize: 18, fontWeight: 600 }}>Nuevo Paquete</h3>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Nombre</label>
                <input value={bundleName} onChange={(e) => setBundleName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" required />
              </div>
              <div>
                <label className="block mb-1 text-muted-foreground" style={{ fontSize: 13 }}>Precio del paquete</label>
                <input type="number" step="0.01" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-input-background" required />
              </div>
            </div>

            <p className="text-muted-foreground mb-2" style={{ fontSize: 13 }}>
              Productos seleccionados: {selectedProducts.length}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 max-h-72 overflow-y-auto">
              {products.map((product) => (
                <label key={product.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${selectedProducts.includes(product.id) ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="checkbox" checked={selectedProducts.includes(product.id)} onChange={() => toggleProduct(product.id)} className="accent-[#065F46]" />
                  {product.imagen_principal ? (
                    <img src={product.imagen_principal} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <span className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center"><Package size={17} /></span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 14 }}>{product.nombre}</p>
                    <p className="text-muted-foreground" style={{ fontSize: 13 }}>${Number(product.precio).toFixed(2)}</p>
                  </div>
                </label>
              ))}
            </div>

            {products.length === 0 && (
              <p className="text-muted-foreground bg-gray-50 rounded-lg p-4 mb-4" style={{ fontSize: 14 }}>
                Necesitas productos activos para crear paquetes.
              </p>
            )}

            {selectedProducts.length >= 2 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 flex items-baseline gap-3 flex-wrap">
                <span className="text-muted-foreground" style={{ fontSize: 13 }}>Total original</span>
                <span className="line-through text-muted-foreground">${originalTotal.toFixed(2)}</span>
                <span className="text-primary" style={{ fontSize: 20, fontWeight: 700 }}>${Number(bundlePrice || 0).toFixed(2)}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={products.length < 2} className="px-6 py-2.5 bg-primary text-white rounded-lg disabled:opacity-50" style={{ fontSize: 14 }}>Crear</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 border border-border rounded-lg" style={{ fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bundles.map((bundle) => {
          const items = products.filter((product) => bundle.productIds.includes(product.id));
          const total = items.reduce((sum, product) => sum + Number(product.precio || 0), 0);
          return (
            <div key={bundle.id} className="bg-white rounded-xl border border-border p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Package size={20} className="text-primary" />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>{bundle.name}</h3>
                </div>
                <button onClick={() => deleteBundle(bundle.id)} className="text-red-500 hover:text-red-700 p-1" title="Eliminar paquete">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                {items.map((product) => (
                  <div key={product.id} className="flex justify-between gap-3" style={{ fontSize: 14 }}>
                    <span className="truncate">{product.nombre}</span>
                    <span className="text-muted-foreground">${Number(product.precio).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-primary" style={{ fontSize: 20, fontWeight: 700 }}>${bundle.bundlePrice.toFixed(2)}</span>
                <span className="text-muted-foreground line-through" style={{ fontSize: 14 }}>${total.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {bundles.length === 0 && !showForm && (
        <div className="text-center py-16 bg-white rounded-xl border border-border">
          <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground" style={{ fontSize: 16 }}>No tienes paquetes promocionales</p>
        </div>
      )}
    </div>
  );
}

import { Package, Boxes, ClipboardList, BarChart3, User, Calendar, Wrench, Tag, LayoutDashboard } from "lucide-react";
import { DashboardLayout } from "../../components/layout/dashboard-layout";
import { useStore } from "../../context/store-context";
import { SetupBusiness } from "./setup-business";
import { Navigate } from "react-router";

export function SellerLayout() {
  const { currentUser, negocioId, updateNegocioId } = useStore();

  const items = [
    { label: "Inicio", path: "/vendedor", icon: <LayoutDashboard size={18} /> },
    { label: "Mis Productos", path: "/vendedor/productos", icon: <Package size={18} /> },
    { label: "Mis Servicios", path: "/vendedor/servicios", icon: <Wrench size={18} /> },
    { label: "Inventario", path: "/vendedor/inventario", icon: <Boxes size={18} /> },
    { label: "Pedidos", path: "/vendedor/pedidos", icon: <ClipboardList size={18} /> },
    { label: "Ventas", path: "/vendedor/ventas", icon: <BarChart3 size={18} /> },
    { label: "Mi Agenda", path: "/vendedor/agenda", icon: <Calendar size={18} /> },
    { label: "Categorias", path: "/vendedor/categorias", icon: <Tag size={18} /> },
    { label: "Mi Perfil", path: "/perfil", icon: <User size={18} /> },
  ];

  // Si no está logueado, redirigir
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== "vendedor") {
    return <Navigate to="/" replace />;
  }

  // Si no tiene negocio, mostrar onboarding
  if (!negocioId) {
    return <SetupBusiness onComplete={(id) => updateNegocioId(id)} />;
  }

  return <DashboardLayout title="Panel de Vendedor" items={items} />;
}

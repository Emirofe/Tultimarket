import { Users, AlertTriangle, LayoutDashboard, User, ShoppingBag, Tag } from "lucide-react";
import { DashboardLayout } from "../../components/layout/dashboard-layout";

export function AdminLayout() {
  const items = [
    { label: "Usuarios", path: "/admin/usuarios", icon: <Users size={18} /> },
    { label: "Categorías", path: "/admin/categorias", icon: <Tag size={18} /> },
    { label: "Reportes", path: "/admin/reportes", icon: <AlertTriangle size={18} /> },
    { label: "Catálogo", path: "/admin/catalogo", icon: <ShoppingBag size={18} /> },
    { label: "Mi Perfil", path: "/perfil", icon: <User size={18} /> },
  ];

  return <DashboardLayout title="Panel de Administrador" items={items} />;
}

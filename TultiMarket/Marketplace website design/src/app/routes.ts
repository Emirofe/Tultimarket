import { createBrowserRouter } from "react-router";
import { RootLayout } from "./pages/root-layout";
import { HomePage } from "./pages/home";
import { LoginPage } from "./pages/login";
import { RegisterPage } from "./pages/register";
import { ProductDetailPage } from "./pages/product-detail";
import { CartPage } from "./pages/cart";
import { CheckoutPage } from "./pages/checkout";
import { ProfilePage } from "./pages/profile";
import { OrderHistoryPage } from "./pages/order-history";
import { OrderDetailPage } from "./pages/order-detail";
import { WishlistPage } from "./pages/wishlist";
import { SellerLayout } from "./pages/seller/seller-layout";
import { SellerDashboardPage } from "./pages/seller/dashboard";
import { SellerProductsPage } from "./pages/seller/products";
import { SellerInventoryPage } from "./pages/seller/inventory";
import { SellerOrdersPage } from "./pages/seller/orders";
import { SellerServicesPage } from "./pages/seller/services";
import { SellerSalesPage } from "./pages/seller/sales";
import { SellerAgendaPage } from "./pages/seller/agenda";
import { SellerCategoriesPage } from "./pages/seller/categories";
import { SellerBusinessPage } from "./pages/seller/business";
import { AdminLayout } from "./pages/admin/admin-layout";
import { AdminUsersPage } from "./pages/admin/users";
import { AdminCategoriesPage } from "./pages/admin/categories";
import { AdminReportsPage } from "./pages/admin/reports";
import { AdminCatalogPage } from "./pages/admin/catalog";
import { NotFoundPage } from "./pages/not-found";
import { WireframesPage } from "./pages/wireframes";
import { SearchPage } from "./pages/search";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "login", Component: LoginPage },
      { path: "registro", Component: RegisterPage },
      { path: "producto/:id", Component: ProductDetailPage },
      { path: "carrito", Component: CartPage },
      { path: "checkout", Component: CheckoutPage },
      { path: "perfil", Component: ProfilePage },
      { path: "mis-compras", Component: OrderHistoryPage },
      { path: "mis-compras/:pedidoId", Component: OrderDetailPage },
      { path: "wishlist", Component: WishlistPage },
      { path: "buscar", Component: SearchPage },
      {
        path: "vendedor",
        Component: SellerLayout,
        children: [
          { index: true, Component: SellerDashboardPage },
          { path: "productos", Component: SellerProductsPage },
          { path: "inventario", Component: SellerInventoryPage },
          { path: "negocio", Component: SellerBusinessPage },
          { path: "pedidos", Component: SellerOrdersPage },
          { path: "ventas", Component: SellerSalesPage },
          { path: "servicios", Component: SellerServicesPage },
          { path: "agenda", Component: SellerAgendaPage },
          { path: "categorias", Component: SellerCategoriesPage },
        ],
      },
      {
        path: "admin",
        Component: AdminLayout,
        children: [
          { path: "usuarios", Component: AdminUsersPage },
          { path: "categorias", Component: AdminCategoriesPage },
          { path: "reportes", Component: AdminReportsPage },
          { path: "catalogo", Component: AdminCatalogPage },
        ],
      },
      { path: "wireframes", Component: WireframesPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);

import { NavLink, Outlet, useLocation } from "react-router";
import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

interface SidebarItem {
  label: string;
  path: string;
  icon: ReactNode;
}

interface DashboardLayoutProps {
  title: string;
  items: SidebarItem[];
}

export function DashboardLayout({ title, items }: DashboardLayoutProps) {
  const location = useLocation();

  const isActiveItem = (itemPath: string) => {
    if (itemPath === "/") {
      return location.pathname === "/";
    }
    if (itemPath === "/vendedor") {
      return location.pathname === "/vendedor";
    }
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar - desktop */}
        <aside className="w-64 bg-white border-r border-border shrink-0 hidden lg:block">
          <div className="p-6">
            <h2 className="text-primary" style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          </div>
          <nav className="px-3 space-y-1">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={() =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActiveItem(item.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-gray-50"
                  }`
                }
                style={{ fontSize: 14 }}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="lg:hidden overflow-x-auto border-b border-border bg-white px-4">
          <div className="flex gap-1 py-2">
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={() =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    isActiveItem(item.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-gray-50"
                  }`
                }
                style={{ fontSize: 13 }}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

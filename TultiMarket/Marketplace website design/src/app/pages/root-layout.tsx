import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { useStore } from "../context/store-context";
import { NotificationProvider } from "../context/notification-context";

export function RootLayout() {
  const { currentUser } = useStore();

  return (
    <NotificationProvider userId={currentUser?.id ?? null}>
      <Outlet />
      <Toaster position="top-right" richColors />
    </NotificationProvider>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  X,
  Users,
  Calendar,
  Dumbbell,
  BarChart2,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import LogoutBottomSheet from "@/components/LogoutBottomSheet";

const navigation: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Alumnos", href: "/inicio", icon: Users },
  { name: "Planificador", href: "/planificador", icon: Calendar },
  { name: "Biblioteca", href: "/biblioteca", icon: Dumbbell },
  { name: "Vencimientos", href: "/asignaciones", icon: Calendar },
  { name: "Estadísticas", href: "/dashboard", icon: BarChart2 },
];

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ className, isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const professor = useAuthStore((s) => s.professor);
  const logout = useAuthStore((s) => s.logout);
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const prefetchRoute = (href: string) => {
    const map: Record<string, () => Promise<unknown>> = {
      "/inicio": () => import("@/features/students/StudentsList"),
      "/planificador": () => import("@/features/plans/NewPlan"),
      "/biblioteca": () => import("@/features/library/Library"),
      "/asignaciones": () => import("@/features/students/PlanExpirations"),
      "/dashboard": () => import("@/features/metrics/BusinessMetrics"),
    };
    map[href]?.().catch(() => {});
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutSheet(false);
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className={cn(
          "flex h-16 items-center px-6 border-b border-gray-100 dark:border-slate-800 shrink-0",
          isCollapsed ? "justify-center px-2" : "justify-between",
        )}
      >
        <Link
          to="/inicio"
          onClick={onClose}
          className="flex items-center gap-2 lg:focus-visible:outline-none lg:focus-visible:ring-2 lg:focus-visible:ring-primary lg:focus-visible:ring-offset-1 rounded transition-colors"
          title={isCollapsed ? "Ir a Alumnos" : undefined}
        >
          {!isCollapsed ? (
            <span className="text-xl font-black text-primary tracking-wider">
              STABILITY
            </span>
          ) : (
            <img
              src="/logo-nuevo-sinfondo.svg"
              alt="Logo Stability"
              className="h-8 w-auto object-contain"
            />
          )}
        </Link>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              onMouseEnter={() => prefetchRoute(item.href)}
              title={isCollapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-primary",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-primary"
                  : "text-gray-500 dark:text-slate-400",
                isCollapsed && "justify-center",
              )}
            >
              <Icon size={20} className="shrink-0" />
              {!isCollapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user info + logout */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 space-y-2 shrink-0">
        {/* Desktop Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "hidden lg:flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group",
            isCollapsed && "justify-center px-0",
          )}
          title={isCollapsed ? "Expandir" : undefined}
        >
          {isCollapsed ? (
            <ChevronRight size={20} className="group-hover:text-primary transition-colors" />
          ) : (
            <ChevronLeft size={20} className="group-hover:text-primary transition-colors" />
          )}
          {!isCollapsed && (
            <span className="group-hover:text-primary">Colapsar</span>
          )}
        </button>

        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 overflow-hidden">
                {professor?.profileImage ? (
                  <img
                    src={professor.profileImage}
                    alt={`${professor.firstName} ${professor.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
                  {professor
                    ? `${professor.firstName} ${professor.lastName}`
                    : "Usuario"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {professor?.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowLogoutSheet(true)}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={18} />
              Cerrar Sesión
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowLogoutSheet(true)}
            title="Cerrar Sesión"
            className="flex items-center justify-center w-full px-3 py-2.5 text-sm font-medium rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside
        className={cn(
          "hidden lg:flex h-screen flex-col border-r bg-white dark:bg-slate-900 shrink-0 transition-all duration-300",
          isCollapsed ? "w-[72px]" : "w-64",
          className,
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — slide-in drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-72 flex flex-col border-r bg-white dark:bg-slate-900",
          "transform transition-transform duration-300 ease-in-out",
          "lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Logout Bottom Sheet */}
      <LogoutBottomSheet
        isOpen={showLogoutSheet}
        onClose={() => setShowLogoutSheet(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
}

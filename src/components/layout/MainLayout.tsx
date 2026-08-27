import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useTrainingStore } from "@/features/training/store/trainingStore";
import { InstallPWABanner } from "@/components/InstallPWABanner";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { fetchGlobalExercises } = useTrainingStore();

  useEffect(() => {
    // Pre-load exercises into Zustand global store when app mounts
    fetchGlobalExercises();
  }, [fetchGlobalExercises]);

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground antialiased">
      {/* Skip Link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:font-semibold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-transform"
      >
        Saltar al contenido principal
      </a>

      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content column */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden min-w-0 focus:outline-none">
        {/* Mobile top header — hidden on desktop */}
        <header className="flex items-center gap-3 px-4 min-h-[4rem] py-2 pt-[max(env(safe-area-inset-top),1rem)] border-b bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm lg:hidden shrink-0 z-30 relative">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Abrir menú de navegación"
            aria-expanded={sidebarOpen}
          >
            <Menu size={20} />
          </button>
          <img
            src="/logo-nuevo-sinfondo.svg"
            alt="Logo"
            className="h-8 w-auto object-contain mx-auto pr-8"
          />
        </header>

        {/* Scrollable page content */}
        <div className="flex-1 overflow-y-auto ios-scroll">
          <InstallPWABanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

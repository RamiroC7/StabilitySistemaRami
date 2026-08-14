import type { PlannerTabData } from "../hooks/usePlannerTabs";

interface PlannerTabBarProps {
  tabs: PlannerTabData[];
  activeTabId: string;
  onSwitchTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCreateTab: () => void;
  canCreateMoreTabs: boolean;
}

export default function PlannerTabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onCreateTab,
  canCreateMoreTabs,
}: PlannerTabBarProps) {
  return (
    <div className="flex items-end bg-[#f1f5f9] dark:bg-[#0f172a] px-2 pt-2 border-b border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto hide-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            className={`group flex items-center gap-2 h-9 px-4 rounded-t-lg border-t border-x cursor-pointer transition-colors text-sm max-w-[200px] shrink-0
              ${
                isActive
                  ? "bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 text-primary font-bold shadow-[0_2px_0_0_#fff] dark:shadow-[0_2px_0_0_#0f172a] relative z-10"
                  : "bg-gray-100 dark:bg-slate-800 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
              }
            `}
          >
            <span className="truncate flex-1" title={tab.planTitle}>
              {tab.planTitle || "Nuevo Plan"}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className={`flex items-center justify-center w-5 h-5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors
                ${
                  isActive
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }
              `}
              title="Cerrar pestaña"
            >
              <span className="material-symbols-outlined text-[14px]">
                close
              </span>
            </button>
          </div>
        );
      })}

      <button
        onClick={onCreateTab}
        disabled={!canCreateMoreTabs}
        className={`flex items-center justify-center w-9 h-9 rounded-t-lg transition-colors ml-1 shrink-0
          ${
            canCreateMoreTabs
              ? "text-gray-500 hover:text-primary hover:bg-gray-200 dark:hover:bg-slate-700"
              : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
          }
        `}
        title={canCreateMoreTabs ? "Nueva pestaña" : "Límite de pestañas alcanzado"}
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
      </button>
    </div>
  );
}

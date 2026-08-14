import { useState, useCallback, useEffect } from "react";
import type { PlanExercise } from "../lib/types";

// Define the interface for the Day structure within a plan
interface Day {
  id: string;
  number: number;
  name: string;
}

// Define the structure of a single planner tab's data
export interface PlannerTabData {
  id: string;
  exercises: PlanExercise[];
  days: Day[];
  activeDay: string;
  startDate: Date | null;
  endDate: Date | null;
  planTitle: string;
  savedPlanId: string | null;
}

const STORAGE_KEY = "planner_tabs";
const LEGACY_STORAGE_KEY = "newPlan_draft";
const MAX_TABS = 5;

interface SavedTabData {
  id: string;
  exercises: PlanExercise[];
  days: Day[];
  activeDay: string | null;
  startDate: string | null;
  endDate: string | null;
  planName: string;
  planDescription: string;
  totalDays: number;
  folderId: string | null;
}

// Helper functions for localStorage
const loadTabsFromStorage = (): { tabs: PlannerTabData[], activeTabId: string } | null => {
  try {
    // 1. First, check for new tabs structure
    const savedTabsData = localStorage.getItem(STORAGE_KEY);
    if (savedTabsData) {
      const parsed = JSON.parse(savedTabsData);
      
      // Revive dates
      const revivedTabs = parsed.tabs.map((tab: SavedTabData) => ({
        ...tab,
        startDate: tab.startDate ? new Date(tab.startDate) : null,
        endDate: tab.endDate ? new Date(tab.endDate) : null,
      }));

      return { tabs: revivedTabs, activeTabId: parsed.activeTabId };
    }

    // 2. If no new structure, check for legacy draft
    const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacySaved) {
      const parsedLegacy = JSON.parse(legacySaved);
      
      const newTabId = "tab_" + Date.now().toString();
      const legacyTab: PlannerTabData = {
        id: newTabId,
        exercises: parsedLegacy.exercises || [],
        days: parsedLegacy.days || [],
        activeDay: parsedLegacy.activeDay || "",
        startDate: parsedLegacy.startDate ? new Date(parsedLegacy.startDate) : null,
        endDate: parsedLegacy.endDate ? new Date(parsedLegacy.endDate) : null,
        planTitle: parsedLegacy.planTitle || "Nuevo Plan: [Sin título]",
        savedPlanId: parsedLegacy.savedPlanId || null,
      };

      // We should eventually clean up the legacy key, but let's do it 
      // when we actually save the new structure to avoid data loss if 
      // something goes wrong during hydration.

      return { tabs: [legacyTab], activeTabId: newTabId };
    }
  } catch (error) {
    console.error("Error loading tabs from storage:", error);
  }
  return null;
};

const saveTabsToStorage = (tabs: PlannerTabData[], activeTabId: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
    // Clean up legacy key if it exists now that we've successfully saved the new structure
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Error saving tabs to storage:", error);
  }
};

export const createEmptyTabContent = (id: string = "tab_" + Date.now().toString()): PlannerTabData => {
    const today = new Date();
    const newDayId = Date.now().toString();
    return {
      id,
      exercises: [
        {
          id: Date.now().toString() + "_ex",
          day_id: newDayId,
          stage_id: "",
          stage_name: "",
          exercise_name: "",
          series: "",
          reps: "",
          carga: "",
          pause: "",
          notes: "",
          order: 0,
          write_weight: false,
        },
      ],
      days: [{ id: newDayId, number: 1, name: "Día 1" }],
      activeDay: newDayId,
      startDate: today,
      endDate: today,
      planTitle: "Nuevo Plan: [Sin título]",
      savedPlanId: null,
    };
};

export function usePlannerTabs() {
  const [tabs, setTabs] = useState<PlannerTabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from storage on mount
  useEffect(() => {
    const loadedData = loadTabsFromStorage();
    if (loadedData && loadedData.tabs.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTabs(loadedData.tabs);
      // Ensure the active tab actually exists, otherwise select the first one
      const validActiveId = loadedData.tabs.some(t => t.id === loadedData.activeTabId) 
        ? loadedData.activeTabId 
        : loadedData.tabs[0].id;
      setActiveTabId(validActiveId);
    } else {
      // Create initial empty tab if nothing in storage
      const initialTab = createEmptyTabContent();
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
    setIsInitialized(true);
  }, []);

  // Save to storage whenever tabs or activeTabId change
  useEffect(() => {
    if (isInitialized && tabs.length > 0) {
      saveTabsToStorage(tabs, activeTabId);
    }
  }, [tabs, activeTabId, isInitialized]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const createTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) {
      // You could throw an error or return false here, 
      // but the UI should disable the button anyway.
      return;
    }
    const newTab = createEmptyTabContent();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);

  const closeTab = useCallback((idToClose: string) => {
    setTabs((prev) => {
      const filteredTabs = prev.filter((t) => t.id !== idToClose);
      
      // If we closed the last tab, create a new empty one
      if (filteredTabs.length === 0) {
        const newEmptyTab = createEmptyTabContent();
        setActiveTabId(newEmptyTab.id);
        return [newEmptyTab];
      }

      // If we closed the active tab, switch to the last available tab
      if (activeTabId === idToClose) {
        setActiveTabId(filteredTabs[filteredTabs.length - 1].id);
      }
      
      return filteredTabs;
    });
  }, [activeTabId]);

  const switchTab = useCallback((id: string) => {
    if (tabs.some(t => t.id === id)) {
        setActiveTabId(id);
    }
  }, [tabs]);

  const updateActiveTab = useCallback((updates: Partial<PlannerTabData>) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, ...updates } : tab
      )
    );
  }, [activeTabId]);

  // A full overwrite, perhaps useful if we need to set the whole active tab state at once
  const updateTab = useCallback((id: string, updates: Partial<PlannerTabData>) => {
     setTabs((prev) =>
      prev.map((tab) =>
        tab.id === id ? { ...tab, ...updates } : tab
      )
    );
  }, []);


  return {
    tabs,
    activeTabId,
    activeTab,
    isInitialized,
    createTab,
    closeTab,
    switchTab,
    updateActiveTab,
    updateTab,
    canCreateMoreTabs: tabs.length < MAX_TABS,
    MAX_TABS
  };
}

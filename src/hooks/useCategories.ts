import { useEffect } from "react";
import { useDataCacheStore } from "@/store/dataCacheStore";
import type { ExerciseCategory } from "@/store/dataCacheStore";

export type { ExerciseCategory };

export function useCategories() {
    const categories = useDataCacheStore((s) => s.categories);
    const isLoaded = useDataCacheStore((s) => s.isCategoriesLoaded);
    const isLoading = useDataCacheStore((s) => s.isCategoriesLoading);
    const fetchCategories = useDataCacheStore((s) => s.fetchCategories);
    const reloadCategories = useDataCacheStore((s) => s.reloadCategories);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories, isLoaded]);

    return {
        categories,
        isLoading: isLoading && !isLoaded,
        isLoaded,
        /** Fuerza recarga (usar tras crear/editar/eliminar una categoría). */
        reload: () => {
            reloadCategories();
            fetchCategories();
        },
    };
}

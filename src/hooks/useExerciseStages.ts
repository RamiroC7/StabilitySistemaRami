import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ExerciseStage } from '../lib/types';

export function useExerciseStages() {
    const [stages, setStages] = useState<ExerciseStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStages();
    }, []);

    const loadStages = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('exercise_stages')
                .select('*')
                .order('display_order', { ascending: true });

            if (fetchError) throw fetchError;

            setStages(data || []);
        } catch (err) {
            console.error('Error loading exercise stages:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const addStage = async (name: string, color: string = '#3B82F6') => {
        try {
            // Get the max display_order
            const maxOrder = stages.length > 0
                ? Math.max(...stages.map(s => s.display_order))
                : 0;

            const { data, error: insertError } = await supabase
                .from('exercise_stages')
                .insert([{
                    name,
                    color,
                    display_order: maxOrder + 1
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            if (data) {
                setStages(prev => [...prev, data].sort((a, b) => a.display_order - b.display_order));
            }

            return { success: true, data };
        } catch (err) {
            console.error('Error adding stage:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Error desconocido'
            };
        }
    };

    return { stages, loading, error, addStage, reload: loadStages };
}

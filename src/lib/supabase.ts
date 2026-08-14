import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: "student" | "coach";
          profile_image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: "student" | "coach";
          profile_image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          role?: "student" | "coach";
          profile_image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      exercise_stages: {
        Row: {
          id: string;
          name: string;
          color: string;
          display_order: number;
          coach_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          display_order?: number;
          coach_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          display_order?: number;
          coach_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      training_plans: {
        Row: {
          id: string;
          coach_id: string;
          title: string;
          description: string | null;
          start_date: string;
          end_date: string;
          total_days: number;
          days_per_week: number;
          total_weeks: number;
          plan_type: string | null;
          difficulty_level: string | null;
          is_template: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          title: string;
          description?: string | null;
          start_date: string;
          end_date: string;
          total_days: number;
          days_per_week: number;
          plan_type?: string | null;
          difficulty_level?: string | null;
          is_template?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          title?: string;
          description?: string | null;
          start_date?: string;
          end_date?: string;
          total_days?: number;
          days_per_week?: number;
          plan_type?: string | null;
          difficulty_level?: string | null;
          is_template?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      training_plan_days: {
        Row: {
          id: string;
          plan_id: string;
          day_number: number;
          day_name: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          day_number: number;
          day_name: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          day_number?: number;
          day_name?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      training_plan_exercises: {
        Row: {
          id: string;
          day_id: string;
          stage_id: string | null;
          stage_name: string | null;
          exercise_name: string;
          video_url: string | null;
          series: number;
          reps: string;
          carga: string;
          pause: string;
          notes: string | null;
          coach_instructions: string | null;
          display_order: number;
          write_weight: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day_id: string;
          stage_id?: string | null;
          stage_name?: string | null;
          exercise_name: string;
          video_url?: string | null;
          series?: number;
          reps?: string;
          carga?: string;
          pause?: string;
          notes?: string | null;
          coach_instructions?: string | null;
          display_order?: number;
          write_weight?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          day_id?: string;
          stage_id?: string | null;
          stage_name?: string | null;
          exercise_name?: string;
          video_url?: string | null;
          series?: number;
          reps?: string;
          carga?: string;
          pause?: string;
          notes?: string | null;
          coach_instructions?: string | null;
          display_order?: number;
          write_weight?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      training_plan_assignments: {
        Row: {
          id: string;
          plan_id: string;
          student_id: string;
          coach_id: string;
          assigned_at: string;
          start_date: string;
          end_date: string;
          status: "active" | "completed" | "paused" | "cancelled";
          current_day_number: number;
          completed_days: number;
          personalization_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          student_id: string;
          coach_id: string;
          assigned_at?: string;
          start_date: string;
          end_date: string;
          status?: "active" | "completed" | "paused" | "cancelled";
          current_day_number?: number;
          completed_days?: number;
          personalization_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          student_id?: string;
          coach_id?: string;
          assigned_at?: string;
          start_date?: string;
          end_date?: string;
          status?: "active" | "completed" | "paused" | "cancelled";
          current_day_number?: number;
          completed_days?: number;
          personalization_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_completions: {
        Row: {
          id: string;
          student_id: string;
          assignment_id: string;
          day_number: number;
          completed_at: string;
          rpe: number | null;
          mood: string | null;
          mood_comment: string | null;
          total_sets_done: number | null;
          series_log: Record<string, unknown> | null;
          notes: string | null;
          created_at: string;
          duration_minutes: number | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          assignment_id: string;
          day_number: number;
          completed_at?: string;
          rpe?: number | null;
          mood?: string | null;
          mood_comment?: string | null;
          total_sets_done?: number | null;
          series_log?: Record<string, unknown> | null;
          notes?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          assignment_id?: string;
          day_number?: number;
          completed_at?: string;
          rpe?: number | null;
          mood?: string | null;
          mood_comment?: string | null;
          total_sets_done?: number | null;
          series_log?: Record<string, unknown> | null;
          notes?: string | null;
          created_at?: string;
          duration_minutes?: number | null;
        };
      };
      exercise_weight_logs: {
        Row: {
          id: string;
          student_id: string;
          assignment_id: string;
          exercise_id: string;
          exercise_name: string;
          plan_day_number: number;
          plan_day_name: string;
          series: number;
          sets_detail: Array<{
            set_number: number;
            target_reps: string;
            actual_reps: string | null;
            kg: number | null;
          }>;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          assignment_id: string;
          exercise_id: string;
          exercise_name: string;
          plan_day_number: number;
          plan_day_name: string;
          series: number;
          sets_detail: Array<{
            set_number: number;
            target_reps: string;
            actual_reps: string | null;
            kg: number | null;
          }>;
          logged_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          assignment_id?: string;
          exercise_id?: string;
          exercise_name?: string;
          plan_day_number?: number;
          plan_day_name?: string;
          series?: number;
          sets_detail?: Array<{
            set_number: number;
            target_reps: string;
            actual_reps: string | null;
            kg: number | null;
          }>;
          logged_at?: string;
          created_at?: string;
        };
      };
    };
  };
}

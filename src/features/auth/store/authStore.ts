import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import { uploadProfileImage } from "@/lib/supabase-storage";
import type { User } from "@supabase/supabase-js";

export interface Professor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "student" | "coach";
  createdAt: string;
  profileImage?: string;
  hasCompletedProfile?: boolean;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "student" | "coach";
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface StudentProfileData {
  phone: string;
  instagram?: string;
  profileImage?: File;
  birthDate: string;
  gender: "male" | "female" | "other";
  height: number;
  weight: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  primaryGoal: "aesthetic" | "sports" | "health" | "readaptation";
  trainingExperience: "none" | "beginner" | "intermediate" | "advanced";
  sports: string;
  previousInjuries?: string;
  medicalConditions?: string;
}

interface AuthState {
  professor: Professor | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  lastActivity: number | null;
  tokenExpiry: number | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  refreshToken: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  updateActivity: () => void;
  initializeAuth: () => Promise<void>;
  completeStudentProfile: (data: StudentProfileData) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

// Inactivity timeout (disabled - session persists until manual logout)
// const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes in ms
// Token expiry: Handled by Supabase
const TOKEN_EXPIRY_TIME = 60 * 60 * 1000; // 60 minutes in ms

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

// Helper function to convert Supabase user to Professor
const userToProfessor = async (user: User): Promise<Professor | null> => {
  try {
    const profilePromise = supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const studentProfilePromise = supabase
      .from("student_profiles")
      .select("id, profile_image_url")
      .eq("id", user.id)
      .single();

    const [{ data: profile, error }, { data: studentProfile }] =
      await Promise.all([profilePromise, studentProfilePromise]);

    // If profile doesn't exist yet (first login after email confirmation), create it
    if (!profile) {
      const meta = user.user_metadata || {};
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email ?? "",
        first_name: meta.first_name ?? "",
        last_name: meta.last_name ?? "",
        role: meta.role ?? "student",
      });

      if (upsertError) {
        console.error("Error creating profile on first login:", upsertError);
        return null;
      }

      // Fetch it again after creation
      const { data: newProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError || !newProfile) {
        console.error("Error fetching newly created profile:", fetchError);
        return null;
      }

      return {
        id: newProfile.id,
        email: newProfile.email,
        firstName: newProfile.first_name,
        lastName: newProfile.last_name,
        role: newProfile.role as "student" | "coach",
        createdAt: newProfile.created_at,
        profileImage: undefined,
        hasCompletedProfile: newProfile.role === "coach" ? true : false,
      };
    }

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    const hasCompletedProfile =
      profile.role === "coach" ? true : !!studentProfile;

    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      role: profile.role as "student" | "coach",
      createdAt: profile.created_at,
      profileImage:
        studentProfile?.profile_image_url || profile.profile_image || undefined,
      hasCompletedProfile,
    };
  } catch (error) {
    console.error("Error converting user to professor:", error);
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Setup activity listeners
      const setupActivityListeners = () => {
        const events = ["mousedown", "keypress", "scroll", "touchstart"];

        const handleActivity = () => {
          const state = get();
          if (state.isAuthenticated) {
            state.updateActivity();
          }
        };

        events.forEach((event) => {
          window.addEventListener(event, handleActivity, { passive: true });
        });
      };

      // Initialize activity listeners when store is created
      if (typeof window !== "undefined") {
        setupActivityListeners();
      }

      return {
        professor: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: true,
        error: null,
        lastActivity: null,
        tokenExpiry: null,

        initializeAuth: async () => {
          // Guardia: si ya inicializó, no repetir
          const currentState = get();
          if (!currentState.isInitializing && currentState.isAuthenticated) {
            return;
          }

          set({ isInitializing: true });

          // Timeout de seguridad: si getSession() o userToProfessor() cuelgan,
          // finalizamos la inicialización igualmente para evitar pantalla blanca
          const safetyTimeout = setTimeout(() => {
            const state = get();
            if (state.isInitializing) {
              console.warn("Auth initialization timed out");
              set({ isInitializing: false });
            }
          }, 8000);

          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session?.user) {
              // No hay sesión activa → limpiar estado por si había datos stale
              set({
                professor: null,
                isAuthenticated: false,
                lastActivity: null,
                tokenExpiry: null,
              });
            } else {
              // Hay sesión activa
              const hydrated = get();

              if (hydrated.professor && hydrated.isAuthenticated) {
                // Zustand ya tiene datos hidratados desde localStorage → no hacer fetch
                // Solo actualizar timestamps
                const now = Date.now();
                set({
                  lastActivity: now,
                  tokenExpiry: now + TOKEN_EXPIRY_TIME,
                });
              } else {
                // No hay datos en store → hacer fetch normal
                const professor = await userToProfessor(session.user);
                if (professor) {
                  const now = Date.now();
                  set({
                    professor,
                    isAuthenticated: true,
                    lastActivity: now,
                    tokenExpiry: now + TOKEN_EXPIRY_TIME,
                  });
                }
              }

              get().updateActivity();
            }

            clearTimeout(safetyTimeout);
            set({ isInitializing: false });

            // Listen for auth changes (e.g., token expiration, sign out from another tab)
            supabase.auth.onAuthStateChange(async (event, session) => {

              if (event === "SIGNED_OUT" || !session) {
                set({
                  professor: null,
                  isAuthenticated: false,
                  error: null,
                  lastActivity: null,
                  tokenExpiry: null,
                });
              } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
                if (session?.user) {
                  const currentState = get();
                  // Solo re-fetch si el usuario cambió o no hay datos
                  if (
                    !currentState.professor ||
                    currentState.professor.id !== session.user.id
                  ) {
                    const professor = await userToProfessor(session.user);
                    if (professor) {
                      const now = Date.now();
                      set({
                        professor,
                        isAuthenticated: true,
                        lastActivity: now,
                        tokenExpiry: now + TOKEN_EXPIRY_TIME,
                      });
                    }
                  }
                }
              }
            });
          } catch (error) {
            clearTimeout(safetyTimeout);
            console.error("Error initializing auth:", error);
            // En caso de error, limpiar estado para evitar pantalla blanca
            set({
              professor: null,
              isAuthenticated: false,
              isInitializing: false,
              lastActivity: null,
              tokenExpiry: null,
            });
          }
        },

        updateActivity: () => {
          const now = Date.now();
          set({ lastActivity: now });

          // Session persists until manual logout
          // Auto-logout by inactivity is disabled
          // Clear any existing timer
          if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
          }
        },

        login: async (email, password) => {
          set({ isLoading: true, error: null });

          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (error) {
              console.error("[Login Error]", {
                message: error.message,
                status: error.status,
                code: error.code,
              });

              // Detectar tipo de error específico
              let errorMessage = "Credenciales inválidas";

              if (
                error.message
                  .toLowerCase()
                  .includes("invalid login credentials") ||
                error.message
                  .toLowerCase()
                  .includes("invalid email or password")
              ) {
                // Supabase retorna este mensaje genérico para ambos casos
                // Por ahora lo dejamos así, pero técnicamente no distingue entre email no existe vs contraseña incorrecta
                errorMessage = "Email o contraseña incorrectos";
              } else if (
                error.message.toLowerCase().includes("user not found")
              ) {
                errorMessage =
                  "Este email no está registrado en nuestro sistema";
              } else if (
                error.message.toLowerCase().includes("email not confirmed") ||
                error.message.toLowerCase().includes("email_not_confirmed")
              ) {
                errorMessage =
                  "Debes confirmar tu email antes de iniciar sesión. Revisá tu bandeja de entrada.";
              } else if (
                error.message.toLowerCase().includes("too many login attempts")
              ) {
                errorMessage =
                  "Has intentado login demasiadas veces. Intenta más tarde";
              }

              throw new Error(errorMessage);
            }

            if (data.user) {
              const professor = await userToProfessor(data.user);

              if (!professor) {
                throw new Error("No se pudo cargar el perfil del usuario");
              }

              const now = Date.now();
              set({
                professor,
                isAuthenticated: true,
                isLoading: false,
                lastActivity: now,
                tokenExpiry: now + TOKEN_EXPIRY_TIME,
              });

              // Start activity tracking
              get().updateActivity();
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Error de autenticación";
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw error;
          }
        },

        register: async (data) => {
          set({ isLoading: true, error: null });

          try {
            // 1. Create auth user in Supabase (email confirmation required)
            const { data: authData, error: authError } =
              await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                  data: {
                    first_name: data.firstName,
                    last_name: data.lastName,
                    role: data.role,
                  },
                },
              });

            if (authError) {
              console.error("Auth error:", authError);
              throw authError;
            }

            if (!authData.user) {
              throw new Error("No se pudo crear el usuario");
            }

            // Detect if Supabase returned a fake user (email already registered)
            // When email confirmation is ON and email already exists, Supabase
            // returns a user with identities = [] instead of throwing an error
            if (
              authData.user.identities &&
              authData.user.identities.length === 0
            ) {
              throw new Error(
                "Este email ya está registrado. Intentá iniciar sesión.",
              );
            }

            // NOTE: Do NOT set isAuthenticated or professor here.
            // The user must confirm their email first.
            // The profile row will be created by the DB trigger on email confirmation,
            // or manually created when the user first logs in (via userToProfessor).
            set({ isLoading: false });

            // Caller (RegisterPage) will show a "Check your email" screen.
          } catch (error) {
            console.error("Registration error:", error);
            const errorMessage =
              error instanceof Error ? error.message : "Error en el registro";
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw error;
          }
        },

        refreshToken: async () => {
          try {
            const { error } = await supabase.auth.refreshSession();

            if (error) throw error;

            const now = Date.now();
            set({
              tokenExpiry: now + TOKEN_EXPIRY_TIME,
              lastActivity: now,
            });
          } catch (error) {
            console.error("Error refreshing token", error);
            // If refresh fails, logout user
            get().logout();
          }
        },

        loginWithGoogle: async () => {
          try {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/`,
              },
            });

            if (error) throw error;

            // OAuth redirect will handle the rest
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Error con Google OAuth";
            set({ error: errorMessage });
            throw error;
          }
        },

        logout: async () => {
          // 1. Limpiar timer de inactividad
          if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
          }

          // 2. Limpiar estado local INMEDIATAMENTE (el usuario ve el logout al instante)
          set({
            professor: null,
            isAuthenticated: false,
            error: null,
            lastActivity: null,
            tokenExpiry: null,
          });

          // 3. Llamar a Supabase en segundo plano (fire-and-forget, no bloquea)
          supabase.auth.signOut().catch((error) => {
            console.error(
              "Error signing out from Supabase (non-blocking):",
              error,
            );
          });
        },

        completeStudentProfile: async (data: StudentProfileData) => {
          set({ isLoading: true, error: null });

          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
              throw new Error("Usuario no autenticado");
            }

            const professor = get().professor;
            if (!professor || professor.role !== "student") {
              throw new Error("Solo los alumnos pueden completar este perfil");
            }

            // Upload profile image if provided
            let profileImageUrl: string | null = null;
            if (data.profileImage) {
              try {
                profileImageUrl = await uploadProfileImage(
                  user.id,
                  data.profileImage,
                );
              } catch (uploadError) {
                console.error("Error uploading profile image:", uploadError);
                // Continuar sin imagen en lugar de fallar completamente
                profileImageUrl = null;
              }
            }

            // Prepare data for insertion
            const insertData = {
              id: user.id,
              phone: data.phone,
              instagram: data.instagram || null,
              profile_image_url: profileImageUrl,
              birth_date: data.birthDate,
              gender: data.gender,
              height_cm: data.height,
              weight_kg: data.weight,
              activity_level: data.activityLevel,
              primary_goal: data.primaryGoal,
              training_experience: data.trainingExperience,
              sports: data.sports,
              previous_injuries: data.previousInjuries || null,
              medical_conditions: data.medicalConditions || null,
            };

            // Insert student profile data
            const { error: profileError } = await supabase
              .from("student_profiles")
              .insert(insertData)
              .select();

            if (profileError) {
              throw new Error(
                `Error al guardar perfil: ${profileError.message}`,
              );
            }

            // Update professor state with new data
            set({
              professor: {
                ...professor,
                profileImage: profileImageUrl || undefined,
                hasCompletedProfile: true,
              },
            });
          } catch (error) {
            console.error("Error completing student profile:", error);

            const errorMessage =
              error instanceof Error
                ? error.message
                : "Error al completar el perfil";
            set({ error: errorMessage });
            throw error;
          } finally {
            // Siempre resetear isLoading, incluso si hay error
            set({ isLoading: false });
          }
        },

        resetPassword: async (email: string) => {
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin + "/actualizar-password",
            });
            if (error) return { error: error.message };
            return { error: null };
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Error al enviar el correo";
            return { error: msg };
          }
        },

        updatePassword: async (newPassword: string) => {
          try {
            const { error } = await supabase.auth.updateUser({
              password: newPassword,
            });
            if (error) return { error: error.message };
            return { error: null };
          } catch (err) {
            const msg =
              err instanceof Error
                ? err.message
                : "Error al actualizar la contraseña";
            return { error: msg };
          }
        },

        clearError: () => set({ error: null }),

        setLoading: (loading) => set({ isLoading: loading }),
      };
    },
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Always persist authentication state
      partialize: (state) => ({
        professor: state.professor,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
        tokenExpiry: state.tokenExpiry,
      }),
    },
  ),
);

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, Crosshair, Edit, Target, Trophy, Zap } from "lucide-react";
import {
  EditActions,
  FIELD_LABEL,
  FIELD_SELECT,
  ProfileCard,
} from "./ProfileCard";
import {
  isSectionComplete,
  translateActivityLevel,
  translateExperience,
  translateGoal,
  type SectionProps,
  type StudentProfileData,
} from "./profileData";

interface Props extends SectionProps {
  isExpanded: boolean;
  disabled: boolean;
  onToggle: () => void;
}

const TEXT_INPUT =
  "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none";

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            {label}
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TrainingSection({
  profileData,
  formData,
  setFormData,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isExpanded,
  disabled,
  onToggle,
}: Props) {
  return (
    <ProfileCard
      icon={Target}
      title="Entrenamiento y Objetivos"
      subtitle="Experiencia y metas deportivas"
      isComplete={isSectionComplete(profileData, "training")}
      isExpanded={isExpanded}
      disabled={disabled}
      onToggle={onToggle}
    >
      {isEditing ? (
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={FIELD_LABEL}>Nivel de Actividad</label>
              <select
                value={formData.activity_level || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activity_level: e.target
                      .value as StudentProfileData["activity_level"],
                  })
                }
                className={FIELD_SELECT}
              >
                <option value="sedentary">Sedentario</option>
                <option value="light">Ligero</option>
                <option value="moderate">Moderado</option>
                <option value="active">Activo</option>
                <option value="very_active">Muy Activo</option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Objetivo Principal</label>
              <select
                value={formData.primary_goal || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    primary_goal: e.target
                      .value as StudentProfileData["primary_goal"],
                  })
                }
                className={FIELD_SELECT}
              >
                <option value="aesthetic">Estética</option>
                <option value="sports">Deportivo</option>
                <option value="health">Salud</option>
                <option value="readaptation">Readaptación</option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Experiencia en Entrenamiento</label>
              <select
                value={formData.training_experience || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    training_experience: e.target
                      .value as StudentProfileData["training_experience"],
                  })
                }
                className={FIELD_SELECT}
              >
                <option value="none">Ninguna</option>
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Deportes Practicados</label>
              <input
                type="text"
                value={formData.sports || ""}
                onChange={(e) =>
                  setFormData({ ...formData, sports: e.target.value })
                }
                className={TEXT_INPUT}
                placeholder="Ej: Fútbol, natación..."
              />
            </div>
          </div>
          <EditActions onSave={onSave} onCancel={onCancel} />
        </div>
      ) : (
        <div className="pt-2">
          <div className="grid grid-cols-1 gap-4 pt-2">
            <StatRow
              icon={Zap}
              label="Nivel Actividad"
              value={
                profileData?.activity_level
                  ? translateActivityLevel(profileData.activity_level)
                  : "—"
              }
            />
            <StatRow
              icon={Crosshair}
              label="Objetivo"
              value={
                profileData?.primary_goal
                  ? translateGoal(profileData.primary_goal)
                  : "—"
              }
            />
            <StatRow
              icon={Award}
              label="Experiencia"
              value={
                profileData?.training_experience
                  ? translateExperience(profileData.training_experience)
                  : "—"
              }
            />

            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={18} className="text-primary" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Deportes Practicados
                </p>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {profileData?.sports || "No se especificaron deportes."}
              </p>
            </div>
          </div>

          <button
            onClick={onEdit}
            className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
          >
            <Edit size={18} />
            EDITAR ENTRENAMIENTO
          </button>
        </div>
      )}
    </ProfileCard>
  );
}

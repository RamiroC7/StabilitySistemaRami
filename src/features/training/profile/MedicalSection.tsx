import { AlertTriangle, Cross, Edit, HeartPulse } from "lucide-react";
import { EditActions, FIELD_LABEL, ProfileCard } from "./ProfileCard";
import { isSectionComplete, type SectionProps } from "./profileData";

interface Props extends SectionProps {
  isExpanded: boolean;
  disabled: boolean;
  onToggle: () => void;
}

const TEXTAREA =
  "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none";
const INFO_BOX =
  "p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800/30";

export default function MedicalSection({
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
      icon={Cross}
      title="Información Médica"
      subtitle="Lesiones y condiciones médicas"
      isComplete={isSectionComplete(profileData, "medical")}
      isExpanded={isExpanded}
      disabled={disabled}
      onToggle={onToggle}
    >
      {isEditing ? (
        <div className="space-y-4 pt-4">
          <div>
            <label className={FIELD_LABEL}>Lesiones Previas</label>
            <textarea
              value={formData.previous_injuries || ""}
              onChange={(e) =>
                setFormData({ ...formData, previous_injuries: e.target.value })
              }
              className={TEXTAREA}
              rows={3}
              placeholder="Describe lesiones previas..."
            />
          </div>
          <div>
            <label className={FIELD_LABEL}>Condiciones Médicas</label>
            <textarea
              value={formData.medical_conditions || ""}
              onChange={(e) =>
                setFormData({ ...formData, medical_conditions: e.target.value })
              }
              className={TEXTAREA}
              rows={3}
              placeholder="Condiciones médicas relevantes..."
            />
          </div>
          <EditActions onSave={onSave} onCancel={onCancel} />
        </div>
      ) : (
        <div className="pt-2 space-y-4">
          <div className={INFO_BOX}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-primary" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Lesiones Previas
              </p>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {profileData?.previous_injuries ||
                "No se han registrado lesiones."}
            </p>
          </div>

          <div className={INFO_BOX}>
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse size={18} className="text-primary" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Condiciones Médicas
              </p>
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {profileData?.medical_conditions ||
                "Sin condiciones médicas reportadas."}
            </p>
          </div>

          <button
            onClick={onEdit}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
          >
            <Edit size={18} />
            EDITAR INFORMACIÓN MÉDICA
          </button>
        </div>
      )}
    </ProfileCard>
  );
}

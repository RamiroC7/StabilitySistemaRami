import { AtSign, Cake, Edit, Phone, Ruler, User, Users, Weight } from "lucide-react";
import { formatDateLocal } from "@/lib/utils";
import {
  EditActions,
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_SELECT,
  InfoItem,
  ProfileCard,
} from "./ProfileCard";
import {
  isSectionComplete,
  translateGender,
  type SectionProps,
  type StudentProfileData,
} from "./profileData";

interface Props extends SectionProps {
  isExpanded: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export default function PersonalSection({
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
      icon={User}
      title="Información Personal"
      subtitle="Datos de contacto y personales"
      isComplete={isSectionComplete(profileData, "personal")}
      isExpanded={isExpanded}
      disabled={disabled}
      onToggle={onToggle}
    >
      {isEditing ? (
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={FIELD_LABEL}>Teléfono</label>
              <input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Instagram</label>
              <input
                type="text"
                value={formData.instagram || ""}
                onChange={(e) =>
                  setFormData({ ...formData, instagram: e.target.value })
                }
                className={FIELD_INPUT}
                placeholder="@usuario"
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Fecha de Nacimiento</label>
              <input
                type="date"
                value={formData.birth_date || ""}
                onChange={(e) =>
                  setFormData({ ...formData, birth_date: e.target.value })
                }
                className={`${FIELD_INPUT} min-w-full appearance-none`}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Género</label>
              <select
                value={formData.gender || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gender: e.target.value as StudentProfileData["gender"],
                  })
                }
                className={FIELD_SELECT}
              >
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Altura (cm)</label>
              <input
                type="number"
                value={formData.height_cm ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    height_cm: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className={FIELD_INPUT}
                placeholder="175"
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Peso (kg)</label>
              <input
                type="number"
                value={formData.weight_kg ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weight_kg: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className={FIELD_INPUT}
                placeholder="72"
              />
            </div>
          </div>
          <EditActions onSave={onSave} onCancel={onCancel} />
        </div>
      ) : (
        <div className="pt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-4">
            <InfoItem
              icon={Phone}
              label="Teléfono"
              value={profileData?.phone || "—"}
            />
            <InfoItem
              icon={AtSign}
              label="Instagram"
              value={profileData?.instagram || "—"}
            />
            <InfoItem
              icon={Cake}
              label="Nacimiento"
              value={formatDateLocal(profileData?.birth_date)}
            />
            <InfoItem
              icon={Users}
              label="Género"
              value={
                profileData?.gender ? translateGender(profileData.gender) : "—"
              }
            />
            <InfoItem
              icon={Ruler}
              label="Altura"
              value={
                profileData?.height_cm ? `${profileData.height_cm} cm` : "—"
              }
            />
            <InfoItem
              icon={Weight}
              label="Peso"
              value={
                profileData?.weight_kg ? `${profileData.weight_kg} kg` : "—"
              }
            />
          </div>

          <button
            onClick={onEdit}
            className="w-full mt-8 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-primary hover:bg-primary/5 active:scale-[0.98] transition-all"
          >
            <Edit size={18} />
            EDITAR INFORMACIÓN
          </button>
        </div>
      )}
    </ProfileCard>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Quote, Share2, Sparkles, Target, X } from "lucide-react";

// ─── WhatsApp icon (mismo path que CoachContactButton, para consistencia) ────
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Equipo ────────────────────────────────────────────────────────────────
// Mismos numeros que CoachContactButton.tsx, para que el contacto sea consistente
// en toda la app.
interface TeamMember {
  name: string;
  role: string;
  image: string;
  wa: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Agus",
    role: "Entrenador Stability",
    image: "/team-agus.webp",
    wa: "https://wa.me/5493515743833?text=Hola%20Agus!%20Te%20escribo%20desde%20la%20app%20de%20Stability",
  },
  {
    name: "Juan",
    role: "Entrenador Stability",
    image: "/team-juan.webp",
    wa: "https://wa.me/5493512240889?text=Hola%20Juan!%20Te%20escribo%20desde%20la%20app%20de%20Stability",
  },
];

// ─── Popup de contacto directo ───────────────────────────────────────────────
function ContactPopup({
  member,
  onClose,
}: {
  member: TeamMember;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Contactar a ${member.name}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-80 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Contacto directo
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <img
            src={member.image}
            alt={member.name}
            loading="eager"
            className="w-14 h-14 rounded-full object-cover object-top bg-slate-100 dark:bg-slate-700 shrink-0"
          />
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {member.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {member.role}
            </p>
          </div>
        </div>

        <a
          href={member.wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm active:scale-[0.98] transition-all"
        >
          <WhatsAppIcon className="w-5 h-5" />
          Escribir por WhatsApp
        </a>
      </div>
    </div>
  );
}

// ─── Tarjeta de miembro del equipo ────────────────────────────────────────────
function TeamCard({
  member,
  onSelect,
}: {
  member: TeamMember;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group relative flex-1 flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 pt-5 pb-4 px-3 shadow-sm hover:shadow-md hover:border-primary/30 active:scale-[0.98] transition-all"
    >
      <div className="relative w-24 h-24 mb-3">
        <img
          src={member.image}
          alt={member.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full rounded-full object-cover object-top bg-slate-100 dark:bg-slate-800"
        />
        {/* Badge de contacto */}
        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#25D366] border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm group-active:scale-90 transition-transform">
          <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
        </span>
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-white">
        {member.name}
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-0.5">
        {member.role}
      </p>
    </button>
  );
}

export default function NewsAboutUs() {
  const navigate = useNavigate();
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null);

  const handleShare = async () => {
    const shareData = {
      title: "Stability",
      text: "Estoy entrenando con Stability y me está yendo muy bien. ¡Sumate!",
      url: "https://stabilityar.com",
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // usuario cancelo el share sheet — no hacer nada
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.url);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#1F2937] dark:text-gray-100 flex flex-col min-h-screen">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] bg-background-light dark:bg-background-dark sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 [transform:translateZ(0)] [isolation:isolate]">
        <button
          onClick={() => navigate("/entrenamiento/comunidad")}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Nosotros
        </h2>
        <div className="w-8" />
      </header>

      <div className="flex-1 px-4 pt-6 pb-24 space-y-8 max-w-lg mx-auto w-full">
        {/* ── Nuestra filosofía ── */}
        <section className="text-center space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Nuestra filosofía
          </h3>
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <Quote className="w-6 h-6 text-primary/30 mx-auto mb-2" strokeWidth={2.5} />
            <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 italic">
              "Existen los objetivos plausibles de ser alcanzados con
              determinado nivel de trabajo"
            </p>
          </div>
        </section>

        {/* ── Equipo profesionales ── */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Equipo de profesionales
          </h3>
          <div className="flex gap-3">
            {TEAM.map((member) => (
              <TeamCard
                key={member.name}
                member={member}
                onSelect={() => setActiveMember(member)}
              />
            ))}
          </div>
        </section>

        {/* ── Hacia donde queremos llegar ── */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            ¿Hacia dónde queremos llegar?
          </h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-bold text-slate-900 dark:text-white">
                  100 alumnos a distancia
                </span>{" "}
                antes de que cierre el 2027
              </p>
            </div>
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-bold text-slate-900 dark:text-white">
                  Sede STABILITY
                </span>
                , Córdoba, Argentina
              </p>
            </div>
          </div>
        </section>

        {/* ── En síntesis ── */}
        <section className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            En síntesis
          </h3>
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 rounded-2xl border border-primary/15 p-5 space-y-2.5">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Más alumnos
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 pl-4">
              = hasta un <span className="font-bold text-primary">50% de descuento para vos</span>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 pl-4">
              = mejor servicio
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 pl-4">
              = acelerar los sueños de la comunidad
            </p>
          </div>

          <div className="text-center space-y-3 pt-1">
            <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
              ¿Qué estás esperando para contarle a tus amigos/as?
            </p>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold active:scale-[0.98] transition-all"
            >
              <Share2 className="w-4 h-4" />
              Compartir Stability
            </button>
          </div>
        </section>
      </div>

      {activeMember && (
        <ContactPopup
          member={activeMember}
          onClose={() => setActiveMember(null)}
        />
      )}
    </div>
  );
}

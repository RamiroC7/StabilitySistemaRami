import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Users,
  CalendarDays,
  CreditCard,
} from "lucide-react";

const tiers = [
  {
    icon: <User className="w-7 h-7 text-primary" />,
    label: "1 amigo registrado",
    discount: "10%",
    description: "El beneficio se activa cuando tu referido accede a su planificación.",
  },
  {
    icon: <Users className="w-7 h-7 text-white" />,
    label: "2 amigos registrados",
    discount: "20%",
    description: "Los descuentos se aplican sobre el valor actual del servicio.",
    featured: true,
  },
  {
    icon: <Users className="w-7 h-7 text-primary" />,
    label: "3 amigos registrados",
    discount: "50%",
    description: "Es el tope máximo de bonificación por sistema de registro único.",
  },
];

export default function NewsBonuses() {
  const navigate = useNavigate();

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#1F2937] dark:text-gray-100 flex flex-col min-h-full">
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
          Bonificaciones
        </h2>
        <div className="w-8" />
      </header>

      {/* ── Content ── */}
      <div className="px-4 pt-6 pb-24 space-y-6 max-w-lg mx-auto w-full">

        {/* ── Hero ── */}
        <div className="text-center space-y-2 pt-2">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest">
            Programa de referidos
          </p>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
            Invitá amigos y<br />obtené descuentos
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Traé a tus amigos y pagá menos hasta fin de año
          </p>
        </div>

        {/* ── Tiers ── */}
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier) => (
            <div
              key={tier.discount}
              className={`relative flex flex-col items-center text-center rounded-2xl p-3 border shadow-sm gap-2 transition-transform active:scale-95 ${
                tier.featured
                  ? "bg-primary border-primary"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Popular
                </span>
              )}

              {/* Icon circle */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  tier.featured ? "bg-white/20" : "bg-blue-50 dark:bg-blue-950"
                }`}
              >
                {tier.icon}
              </div>

              {/* Label */}
              <p
                className={`text-[11px] font-medium leading-tight ${
                  tier.featured ? "text-white/90" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {tier.label}
              </p>

              {/* Badge */}
              <div
                className={`rounded-xl px-2 py-1 w-full ${
                  tier.featured ? "bg-white" : "bg-primary"
                }`}
              >
                <span
                  className={`text-xl font-black tracking-tight ${
                    tier.featured ? "text-primary" : "text-white"
                  }`}
                >
                  {tier.discount}
                </span>
                <span
                  className={`text-xs font-bold ml-0.5 ${
                    tier.featured ? "text-primary/70" : "text-white/80"
                  }`}
                >
                  OFF
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Fine print under cards */}
        <div className="grid grid-cols-3 gap-3">
          {tiers.map((tier) => (
            <p
              key={tier.discount + "-desc"}
              className="text-[10px] text-center text-slate-400 dark:text-slate-500 leading-snug"
            >
              {tier.description}
            </p>
          ))}
        </div>

        {/* ── Info Cards ── */}
        <div className="space-y-3">
          <div className="flex items-start gap-4 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Se aplica el descuento hasta fin de 2026
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                El beneficio perdura aunque tus referidos no continúen con el entrenamiento.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Descuento aplicado en tu próximo pago
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                La bonificación corre desde que el usuario nuevo se registra en la app.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

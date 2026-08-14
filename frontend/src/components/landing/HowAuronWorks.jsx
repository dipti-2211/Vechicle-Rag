/**
 * HowAuronWorks — "How Auron Works" 3-step section
 * FeatureVelocity dark card style + CinematicSection scroll-reveal.
 */
import CinematicSection from './CinematicSection'
import { User, UploadCloud, MessageSquare } from 'lucide-react'

const STEPS = [
  {
    num: '01',
    icon: User,
    label: 'Setup',
    title: 'Add Your Vehicle',
    description: 'Tell Auron your make, model, variant, year, and fuel type. Every answer is tailored to your exact vehicle.',
    gradient: 'from-indigo-500/20',
  },
  {
    num: '02',
    icon: UploadCloud,
    label: 'Upload',
    title: 'Upload Documents',
    description: "Drop in your owner's manual or service guide. Auron reads and understands it so you don't have to.",
    gradient: 'from-violet-500/20',
  },
  {
    num: '03',
    icon: MessageSquare,
    label: 'Ask',
    title: 'Ask Auron',
    description: 'Ask anything in plain language — warning lights, tyre pressure, service intervals — and get instant answers.',
    gradient: 'from-cyan-500/20',
  },
]

export default function HowAuronWorks() {
  return (
    <CinematicSection id="how-auron-works" bgText="WORKS">
      <div className="max-w-6xl mx-auto px-6 md:px-16 py-24 md:py-32">

        {/* Header — FeatureVelocity style */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/[0.08] pb-12 mb-16">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">
            How Auron
            <br />
            Works.
          </h2>
          <p className="max-w-[220px] text-white/35 font-mono text-xs leading-relaxed uppercase tracking-widest">
            Three steps to intelligent vehicle answers.
          </p>
        </div>

        {/* Step cards — FeatureVelocity dark style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map(({ num, icon: Icon, label, title, description, gradient }) => (
            <div
              key={num}
              className="group relative bg-neutral-950 border border-white/[0.08] rounded-2xl p-10 overflow-hidden hover:border-white/[0.02] transition-all duration-500 cursor-default"
            >
              {/* Colour gradient bleeds in on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
              />

              <div className="relative z-10 space-y-14">
                {/* Icon tile */}
                <div className="w-12 h-12 rounded-2xl bg-white/[0.07] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.12] transition-colors duration-500">
                  <Icon className="w-5 h-5 text-white/60 group-hover:text-white transition-colors duration-300" />
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.3em]">
                    {num} · {label}
                  </span>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-tight">
                    {title}
                  </h3>
                  <p className="text-sm text-white/40 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CinematicSection>
  )
}

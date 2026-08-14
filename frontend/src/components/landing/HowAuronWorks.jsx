/**
 * HowAuronWorks — "How Auron Works" 3-step section
 */
import { User, UploadCloud, MessageSquare } from 'lucide-react'

const STEPS = [
  {
    num: '01',
    icon: User,
    title: 'Add Your Vehicle',
    description:
      'Provide your vehicle details — manufacturer, model, variant, year, fuel type, and transmission. Auron uses this context to tailor every response to your specific vehicle.',
    detail: 'Tata · Nexon · XZ+ · 2023 · Petrol · Manual',
  },
  {
    num: '02',
    icon: UploadCloud,
    title: 'Upload Your Documents',
    description:
      "Upload your vehicle owner's manual, service booklets, or any relevant vehicle documents. Auron reads and understands them so you don't have to.",
    detail: "Owner's Manual · Service Guide · Safety Booklet",
  },
  {
    num: '03',
    icon: MessageSquare,
    title: 'Ask Auron',
    description:
      'Ask questions in plain language and receive intelligent answers grounded in your vehicle information and uploaded documents.',
    detail: '"What does this warning light mean?" · "When should I service?" · "Tyre pressure?"',
  },
]

export default function HowAuronWorks() {
  return (
    <section className="w-full bg-black border-t border-white/[0.06] px-6 md:px-16 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">How Auron Works</h2>
          <p className="text-white/40 text-sm md:text-base">Simple questions. Intelligent vehicle answers.</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map(({ num, icon: Icon, title, description, detail }) => (
            <div
              key={num}
              className="relative bento-card p-6 group transition-all duration-300"
            >
              {/* Step number watermark */}
              <span
                className="absolute top-4 right-5 text-6xl font-black text-white/[0.04] select-none leading-none"
                aria-hidden="true"
              >
                {num}
              </span>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                <Icon className="w-5 h-5 text-indigo-400" />
              </div>

              {/* Step label */}
              <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-[0.2em] mb-2">
                Step {num}
              </p>

              <h3 className="text-base font-bold text-white mb-3">{title}</h3>
              <p className="text-sm text-white/45 leading-relaxed mb-4">{description}</p>

              {/* Subtle example pill */}
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-xs text-white/30 leading-relaxed">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

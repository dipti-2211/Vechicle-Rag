/**
 * AuronFeatures — "What Auron Can Do" 6-feature grid
 * Wrapped in CinematicSection for scroll-reveal + aurora + grid bg.
 */
import CinematicSection from './CinematicSection'
import {
  MessageSquare, BookOpen, Wrench,
  ShieldCheck, Car, Languages,
} from 'lucide-react'

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'AI Vehicle Assistant',
    description: 'Ask natural language questions about your vehicle and receive accurate, context-aware answers instantly.',
  },
  {
    icon: BookOpen,
    title: 'Vehicle Manual Intelligence',
    description: "Find information buried in your owner's manual through simple conversation — no more page-flipping.",
  },
  {
    icon: Wrench,
    title: 'Maintenance Guidance',
    description: 'Understand service schedules, fluid requirements, filter intervals, and vehicle care tailored to your model.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety Information',
    description: 'Get clear explanations of warning lights, safety features, and what to do in unfamiliar situations.',
  },
  {
    icon: Car,
    title: 'Personalized Vehicle Context',
    description: 'Auron uses your saved vehicle details — make, model, year, and fuel type — to make every answer relevant to you.',
  },
  {
    icon: Languages,
    title: 'Natural Language Interaction',
    description: 'Ask questions the way you normally speak. No technical terminology or special commands required.',
  },
]

export default function AuronFeatures() {
  return (
    <CinematicSection bgText="FEATURES">
      <div className="max-w-6xl mx-auto px-6 md:px-16 py-24 md:py-32">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">What Auron Can Do</h2>
          <p className="text-white/40 text-sm md:text-base">Everything you need to understand your vehicle better.</p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bento-card p-6 group cursor-default"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:bg-indigo-500/15 group-hover:border-indigo-500/30 transition-all duration-300">
                <Icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </CinematicSection>
  )
}

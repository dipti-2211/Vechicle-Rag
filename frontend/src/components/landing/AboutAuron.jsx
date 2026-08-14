/**
 * AboutAuron — "What is Auron?" section
 * Immediately below the hero. id="about" for smooth-scroll target.
 */
import { Bot, FileText, MessageSquare } from 'lucide-react'

export default function AboutAuron() {
  return (
    <section
      id="about"
      className="w-full bg-black border-t border-white/[0.06] px-6 md:px-16 py-24 md:py-32"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* Left: text */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs text-white/60 font-medium">AI-Powered Vehicle Intelligence</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4">
            What is{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 60%, #505050 100%)' }}
            >
              Auron?
            </span>
          </h2>

          <p className="text-white/40 text-sm font-semibold uppercase tracking-widest mb-5">
            Your Vehicle's Intelligence, Reimagined.
          </p>

          <p className="text-white/55 text-base leading-relaxed mb-4">
            Auron is an AI-powered vehicle intelligence assistant designed to help you understand
            your vehicle — its manuals, maintenance requirements, safety information, and features
            — through natural conversation.
          </p>

          <p className="text-white/40 text-sm leading-relaxed">
            Instead of searching through long vehicle manuals, scattered websites, and confusing
            technical documents, you can simply ask Auron a question and receive a clear,
            relevant answer based on your specific vehicle.
          </p>
        </div>

        {/* Right: visual card */}
        <div className="relative">
          {/* Ambient glow */}
          <div className="absolute -inset-12 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative bento-card p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-white/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Auron AI</p>
                <p className="text-xs text-white/40">Vehicle Intelligence Assistant</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/40">Active</span>
              </div>
            </div>

            {/* Chat bubbles */}
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-white/[0.08] border border-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                  <p className="text-sm text-white/80">What does this warning light mean?</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-sm text-white/70 leading-relaxed">
                    Based on your Tata Nexon manual, that symbol indicates a low tyre pressure warning.
                    Check all four tyres and inflate to <span className="text-indigo-400 font-medium">33 PSI</span>.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-white/[0.08] border border-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                  <p className="text-sm text-white/80">When is my next service due?</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                  <p className="text-sm text-white/70 leading-relaxed">
                    Your vehicle is due for service at <span className="text-indigo-400 font-medium">10,000 km</span> or
                    every 6 months, whichever comes first.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom icons */}
            <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
              <FileText className="w-4 h-4 text-white/25" />
              <span className="text-xs text-white/30">Nexon Owner's Manual · 2023</span>
              <MessageSquare className="w-4 h-4 text-white/25 ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

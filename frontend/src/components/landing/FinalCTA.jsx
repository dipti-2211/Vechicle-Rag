/**
 * FinalCTA — "Meet Auron." CTA + minimal footer
 */
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'

export default function FinalCTA() {
  const navigate = useNavigate()

  function scrollToAbout() {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* CTA */}
      <section className="w-full bg-black border-t border-white/[0.06] px-6 md:px-16 py-24 md:py-28">
        <div className="max-w-2xl mx-auto text-center">

          {/* Ambient glow */}
          <div className="relative">
            <div className="absolute -inset-20 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/60 font-medium">Ready for you</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                Meet{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 60%, #505050 100%)' }}
                >
                  Auron.
                </span>
              </h2>

              <p className="text-white/45 text-sm md:text-base mb-10">
                Your intelligent vehicle assistant is ready.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  id="cta-get-started"
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-white text-black text-sm font-bold shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:bg-white/95 transition-all duration-300 hover:scale-[1.03] w-full sm:w-auto justify-center"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  id="cta-explore"
                  onClick={scrollToAbout}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] w-full sm:w-auto justify-center"
                >
                  Explore Auron
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-black border-t border-white/[0.05] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">
              Auron <span className="text-white/30">· Vehicle AI</span>
            </span>
          </div>
          <p className="text-xs text-white/25">Intelligent assistance for your vehicle.</p>
        </div>
      </footer>
    </>
  )
}

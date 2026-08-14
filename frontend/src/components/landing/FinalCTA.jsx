/**
 * FinalCTA — "Meet Auron." section with cinematic clip-path scroll-reveal.
 *
 * Animation: clip-path wrapper acts as a viewport curtain; the fixed inner
 * panel reveals as the wrapper scrolls into view. GSAP ScrollTrigger drives:
 *   • Giant "AURON" parallax bg text
 *   • Content block fade + rise
 *
 * Buttons now use MotionButton (primary = white, secondary = dark ghost).
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import MotionButton from './MotionButton'

gsap.registerPlugin(ScrollTrigger)

const SECTION_STYLES = `
@keyframes cta-breathe {
  0%   { transform: translate(-50%, -50%) scale(1);    opacity: 0.45; }
  100% { transform: translate(-50%, -50%) scale(1.12); opacity: 0.85; }
}
.cta-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    rgba(99,102,241,0.12) 0%,
    rgba(168,85,247,0.08) 40%,
    transparent 70%
  );
  animation: cta-breathe 8s ease-in-out infinite alternate;
}
.cta-bg-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right,  rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}
.cta-giant-text {
  font-size: 26vw;
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255,255,255,0.04);
  background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 60%);
  -webkit-background-clip: text;
  background-clip: text;
  user-select: none;
  pointer-events: none;
  white-space: nowrap;
}
`

export default function FinalCTA() {
  const navigate = useNavigate()

  const wrapperRef   = useRef(null)
  const giantTextRef = useRef(null)
  const contentRef   = useRef(null)

  function scrollToAbout() {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!wrapperRef.current) return

    const ctx = gsap.context(() => {
      // Giant background text: parallax in
      gsap.fromTo(
        giantTextRef.current,
        { y: '12vh', scale: 0.85, opacity: 0 },
        {
          y: '0vh', scale: 1, opacity: 1,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 80%',
            end:   'bottom bottom',
            scrub: 1.2,
          },
        }
      )

      // Main content: fade + rise
      gsap.fromTo(
        contentRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0, opacity: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 55%',
            end:   'top 15%',
            scrub: 1,
          },
        }
      )
    }, wrapperRef)

    return () => ctx.revert()
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SECTION_STYLES }} />

      {/* Curtain wrapper — clip-path makes this a scrollable window */}
      <div
        ref={wrapperRef}
        className="relative w-full border-t border-white/[0.06]"
        style={{ height: '100vh', clipPath: 'polygon(0% 0, 100% 0%, 100% 100%, 0 100%)' }}
      >
        {/* Fixed inner — anchored to viewport bottom while curtain scrolls over it */}
        <div className="fixed bottom-0 left-0 w-full h-screen bg-black flex flex-col overflow-hidden">

          {/* Aurora */}
          <div className="cta-aurora absolute left-1/2 top-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[90px] pointer-events-none z-0" />

          {/* Grid */}
          <div className="cta-bg-grid absolute inset-0 z-0 pointer-events-none" />

          {/* Giant bg text */}
          <div
            ref={giantTextRef}
            className="cta-giant-text absolute -bottom-[8vh] left-1/2 -translate-x-1/2 z-0"
            aria-hidden="true"
          >
            AURON
          </div>

          {/* Main content — unchanged text, upgraded buttons */}
          <div
            ref={contentRef}
            className="relative z-10 flex flex-1 flex-col items-center justify-center px-6"
          >
            <div className="max-w-2xl w-full mx-auto text-center">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/60 font-medium">Ready for you</span>
              </div>

              {/* Heading — UNCHANGED */}
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                Meet{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 60%, #505050 100%)' }}
                >
                  Auron.
                </span>
              </h2>

              {/* Subtitle — UNCHANGED */}
              <p className="text-white/45 text-sm md:text-base mb-10">
                Your intelligent vehicle assistant is ready.
              </p>

              {/* MotionButton pair */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <MotionButton
                  id="cta-get-started"
                  label="Get Started"
                  variant="primary"
                  onClick={() => navigate('/login')}
                />
                <MotionButton
                  id="cta-explore"
                  label="Explore Auron"
                  variant="secondary"
                  onClick={scrollToAbout}
                />
              </div>
            </div>
          </div>

          {/* Minimal footer bar */}
          <div className="relative z-20 w-full px-6 md:px-12 pb-8 pt-4 flex items-center justify-center border-t border-white/[0.05]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-white">
                Auron <span className="text-white/30">· Vehicle AI</span>
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

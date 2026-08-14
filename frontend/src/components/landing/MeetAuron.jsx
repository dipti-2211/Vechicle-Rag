/**
 * MeetAuron — Cinematic transition interstitial section.
 *
 * Placed between "What is Auron?" and "How Auron Works".
 * Reuses the existing CinematicSection wrapper (GSAP scroll-reveal,
 * aurora glow, grid bg, parallax watermark) and the existing MotionButton.
 *
 * "Get Started"  → /chat if authenticated, /login otherwise
 * "Explore Auron"→ smooth scroll to #how-auron-works
 */
import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useAuth } from '../../contexts/useAuth'
import MotionButton from './MotionButton'

gsap.registerPlugin(ScrollTrigger)

export default function MeetAuron() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const sectionRef  = useRef(null)
  const pillRef     = useRef(null)
  const headingRef  = useRef(null)
  const subRef      = useRef(null)
  const btnsRef     = useRef(null)
  const bgTextRef   = useRef(null)

  // Staggered reveal for individual elements inside the section
  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 72%',
          end:   'top 20%',
          scrub: 1.2,
        },
      })

      // Watermark text parallax
      tl.fromTo(bgTextRef.current,
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power1.out' },
        0
      )
      // Pill
      .fromTo(pillRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power2.out' },
        0.1
      )
      // Heading
      .fromTo(headingRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power3.out' },
        0.2
      )
      // Subtitle
      .fromTo(subRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power3.out' },
        0.3
      )
      // Buttons
      .fromTo(btnsRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, ease: 'power3.out' },
        0.4
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  function handleGetStarted() {
    if (user && !user.is_anonymous) {
      navigate('/chat')
    } else {
      navigate('/login')
    }
  }

  function handleExploreAuron() {
    document.getElementById('how-auron-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden bg-black border-t border-white/[0.06]"
      style={{ minHeight: '90vh' }}
    >
      {/* ── Background layers ──────────────────────────────────────────── */}

      {/* Aurora glow — reuse same keyframe / class used across landing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ma-breathe {
          0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0.4; }
          100% { transform: translate(-50%,-50%) scale(1.12); opacity: 0.75; }
        }
        .ma-aurora {
          background: radial-gradient(
            circle at 50% 50%,
            rgba(99,102,241,0.11) 0%,
            rgba(168,85,247,0.07) 40%,
            transparent 70%
          );
          animation: ma-breathe 8s ease-in-out infinite alternate;
        }
        .ma-grid {
          background-size: 60px 60px;
          background-image:
            linear-gradient(to right,  rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
          mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
          -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
        }
        .ma-watermark {
          font-size: clamp(100px, 24vw, 420px);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 0.8;
          color: transparent;
          -webkit-text-stroke: 1px rgba(255,255,255,0.035);
          background: linear-gradient(180deg, rgba(255,255,255,0.065) 0%, transparent 55%);
          -webkit-background-clip: text;
          background-clip: text;
          user-select: none;
          pointer-events: none;
          white-space: nowrap;
        }
      `}} />

      <div className="ma-aurora absolute left-1/2 top-1/2 h-[65vh] w-[85vw]
        -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[100px]
        pointer-events-none z-0" />
      <div className="ma-grid absolute inset-0 z-0 pointer-events-none" />

      {/* Watermark — behind everything */}
      <div
        ref={bgTextRef}
        className="ma-watermark absolute bottom-0 left-1/2 -translate-x-1/2 z-0 pointer-events-none select-none"
        aria-hidden="true"
      >
        AURON
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center
        min-h-[90vh] px-6 text-center py-20">

        {/* Status pill */}
        <div
          ref={pillRef}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            border border-white/15 bg-white/[0.04] backdrop-blur-sm mb-10"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="text-xs text-white/60 font-medium tracking-wide">Ready for you</span>
        </div>

        {/* Main heading */}
        <h2
          ref={headingRef}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold
            leading-tight tracking-tight mb-5 max-w-4xl"
        >
          <span className="text-white">Meet </span>
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 60%, #505050 100%)' }}
          >
            Auron.
          </span>
        </h2>

        {/* Subtitle */}
        <p
          ref={subRef}
          className="text-white/45 text-base md:text-lg leading-relaxed mb-12 max-w-sm"
        >
          Your intelligent vehicle assistant is ready.
        </p>

        {/* CTA Buttons */}
        <div
          ref={btnsRef}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <MotionButton
            id="meet-get-started"
            label="Get Started"
            variant="primary"
            onClick={handleGetStarted}
          />
          <MotionButton
            id="meet-explore"
            label="Explore Auron"
            variant="secondary"
            onClick={handleExploreAuron}
          />
        </div>
      </div>
    </section>
  )
}

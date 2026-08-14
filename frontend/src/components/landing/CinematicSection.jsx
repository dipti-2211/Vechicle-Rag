/**
 * CinematicSection — Reusable wrapper that gives every landing section
 * the cinematic scroll-reveal aesthetic from the motion-footer pattern.
 *
 * What it adds (without breaking existing section content):
 *   • Aurora glow (breathing radial gradient)
 *   • Subtle dot grid background
 *   • Giant faded watermark text that parallaxes in on scroll (GSAP)
 *   • Section content fades + rises on scroll (GSAP)
 *
 * Usage:
 *   <CinematicSection id="about" bgText="ABOUT" className="px-6 py-24">
 *     ... section content ...
 *   </CinematicSection>
 */
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Scoped CSS — injected once per component instance (browser deduplicates identical rules)
const CINEMATIC_CSS = `
@keyframes cs-breathe {
  0%   { opacity: 0.35; transform: translate(-50%, -50%) scale(1);    }
  100% { opacity: 0.70; transform: translate(-50%, -50%) scale(1.12); }
}
.cs-aurora {
  background: radial-gradient(
    circle at 50% 50%,
    rgba(99,102,241,0.10) 0%,
    rgba(168,85,247,0.07) 40%,
    transparent 70%
  );
  animation: cs-breathe 8s ease-in-out infinite alternate;
}
.cs-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right,  rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
  mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
}
.cs-giant-text {
  font-size: clamp(120px, 22vw, 380px);
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255,255,255,0.04);
  background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 55%);
  -webkit-background-clip: text;
  background-clip: text;
  user-select: none;
  pointer-events: none;
  white-space: nowrap;
}
`

export default function CinematicSection({
  id,
  bgText,
  children,
  className = 'px-6 md:px-16 py-24 md:py-32',
}) {
  const sectionRef = useRef(null)
  const textRef    = useRef(null)
  const contentRef = useRef(null)

  useEffect(() => {
    if (!sectionRef.current) return

    const ctx = gsap.context(() => {
      // Giant watermark text: parallax in from slightly below
      if (textRef.current) {
        gsap.fromTo(
          textRef.current,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: 'power1.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 88%',
              end:   'top 20%',
              scrub: 1.5,
            },
          }
        )
      }

      // Content block: fade + rise
      if (contentRef.current) {
        gsap.fromTo(
          contentRef.current,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 78%',
              end:   'top 22%',
              scrub: 1.2,
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CINEMATIC_CSS }} />

      <section
        ref={sectionRef}
        id={id}
        className={`relative w-full overflow-hidden bg-black border-t border-white/[0.06] ${className}`}
      >
        {/* Aurora glow */}
        <div
          className="cs-aurora absolute left-1/2 top-1/2 h-[70vh] w-[90vw]
            -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[100px]
            pointer-events-none z-0"
        />

        {/* Dot grid */}
        <div className="cs-grid absolute inset-0 z-0 pointer-events-none" />

        {/* Giant watermark */}
        {bgText && (
          <div
            ref={textRef}
            className="cs-giant-text absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0"
            aria-hidden="true"
          >
            {bgText}
          </div>
        )}

        {/* Section content */}
        <div ref={contentRef} className="relative z-10">
          {children}
        </div>
      </section>
    </>
  )
}

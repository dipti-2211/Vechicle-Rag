/**
 * MotionButton — Animated pill button with expanding circle effect.
 *
 * variant="primary"   → white button, dark circle expands on hover
 * variant="secondary" → ghost/dark button, white circle expands on hover
 *
 * From the motion-button prompt, adapted for Auron's dark-first design.
 */
import { ArrowRight } from 'lucide-react'

export default function MotionButton({
  label,
  onClick,
  id,
  variant = 'primary',   // 'primary' | 'secondary'
  type = 'button',
}) {
  const isPrimary = variant === 'primary'

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      className={[
        // base
        'group relative h-14 w-52 cursor-pointer rounded-full p-1 outline-none',
        'transition-shadow duration-300 flex-shrink-0',
        // variant
        isPrimary
          ? 'bg-white shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)]'
          : 'bg-white/[0.06] border border-white/20 backdrop-blur-sm',
      ].join(' ')}
    >
      {/* Expanding circle */}
      <span
        className={[
          'block h-12 w-12 overflow-hidden rounded-full duration-500 ease-in-out group-hover:w-full',
          isPrimary ? 'bg-neutral-900' : 'bg-white',
        ].join(' ')}
        aria-hidden="true"
      />

      {/* Arrow icon — sits on the circle */}
      <div className="absolute top-1/2 left-[1.125rem] -translate-y-1/2 translate-x-0 duration-500 group-hover:translate-x-[0.4rem] pointer-events-none">
        <ArrowRight
          className={['w-5 h-5', isPrimary ? 'text-white' : 'text-black'].join(' ')}
        />
      </div>

      {/* Label */}
      <span
        className={[
          'absolute top-1/2 left-1/2 ml-4 -translate-x-1/2 -translate-y-1/2',
          'text-sm font-bold tracking-tight whitespace-nowrap duration-500',
          isPrimary
            ? 'text-black group-hover:text-white'
            : 'text-white group-hover:text-black',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}

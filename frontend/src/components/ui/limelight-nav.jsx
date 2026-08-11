import { useState, useRef, useLayoutEffect, cloneElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * LimelightNav — an adaptive-width navigation bar with a sliding
 * "limelight" beam that highlights the active tab.
 *
 * @param {{
 *   items?: Array<{ id: string|number, icon: JSX.Element, label?: string, onClick?: () => void }>,
 *   defaultActiveIndex?: number,
 *   onTabChange?: (index: number) => void,
 *   className?: string,
 *   limelightClassName?: string,
 *   iconContainerClassName?: string,
 *   iconClassName?: string,
 * }} props
 */
export function LimelightNav({
  items = [],
  defaultActiveIndex = 0,
  onTabChange,
  className,
  limelightClassName,
  iconContainerClassName,
  iconClassName,
}) {
  const [activeIndex, setActiveIndex]   = useState(defaultActiveIndex);
  const [isReady,     setIsReady]       = useState(false);
  const navItemRefs  = useRef([]);
  const limelightRef = useRef(null);

  useLayoutEffect(() => {
    if (items.length === 0) return;
    const limelight  = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];
    if (limelight && activeItem) {
      const newLeft = activeItem.offsetLeft + activeItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;
      if (!isReady) setTimeout(() => setIsReady(true), 50);
    }
  }, [activeIndex, isReady, items]);

  if (items.length === 0) return null;

  const handleItemClick = (index, itemOnClick) => {
    setActiveIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  return (
    <nav
      className={cn(
        'relative inline-flex items-center h-16 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 px-2',
        className
      )}
    >
      {items.map(({ id, icon, label, onClick }, index) => (
        <a
          key={id}
          ref={(el) => (navItemRefs.current[index] = el)}
          className={cn(
            'relative z-20 flex h-full cursor-pointer items-center justify-center gap-2 px-4 select-none',
            iconContainerClassName
          )}
          onClick={() => handleItemClick(index, onClick)}
          aria-label={label}
        >
          {cloneElement(icon, {
            className: cn(
              'w-4 h-4 transition-all duration-200',
              activeIndex === index ? 'opacity-100 text-white' : 'opacity-40 text-white',
              icon.props.className,
              iconClassName
            ),
          })}
          {label && (
            <span
              className={cn(
                'text-xs font-semibold transition-all duration-200 hidden sm:block',
                activeIndex === index ? 'opacity-100 text-white' : 'opacity-40 text-white'
              )}
            >
              {label}
            </span>
          )}
        </a>
      ))}

      {/* The limelight beam */}
      <div
        ref={limelightRef}
        className={cn(
          'absolute top-0 z-10 w-12 h-[3px] rounded-full bg-white shadow-[0_40px_20px_rgba(255,255,255,0.15)]',
          isReady ? 'transition-[left] duration-300 ease-in-out' : '',
          limelightClassName
        )}
        style={{ left: '-999px' }}
      >
        {/* Cone beam below the limelight */}
        <div className="absolute left-[-30%] top-[3px] w-[160%] h-12 [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      </div>
    </nav>
  );
}

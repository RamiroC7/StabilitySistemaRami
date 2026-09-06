import React, {
  useState,
  useRef,
  useLayoutEffect,
  cloneElement,
} from "react";
import { cn } from "@/lib/utils";

// --- Internal Types and Defaults ---

const DefaultHomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
const DefaultCompassIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </svg>
);
const DefaultBellIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export type NavItem = {
  id: string | number;
  icon: React.ReactElement<{ className?: string }>;
  label?: string;
  onClick?: () => void;
};

const defaultNavItems: NavItem[] = [
  { id: "default-home", icon: <DefaultHomeIcon />, label: "Home" },
  { id: "default-explore", icon: <DefaultCompassIcon />, label: "Explore" },
  { id: "default-notifications", icon: <DefaultBellIcon />, label: "Notifications" },
];

type LimelightNavProps = {
  items?: NavItem[];
  defaultActiveIndex?: number;
  /**
   * Controlled active index. When provided, the parent owns the active state
   * (e.g. derived from the router) and the internal state is ignored for
   * rendering — clicks still fire `onTabChange`.
   */
  activeIndex?: number;
  onTabChange?: (index: number) => void;
  /**
   * Allow dragging the limelight horizontally. Navigation only fires on release,
   * snapping to the nearest item. Defaults to `true`.
   */
  draggable?: boolean;
  className?: string;
  limelightClassName?: string;
  iconContainerClassName?: string;
  iconClassName?: string;
};

/**
 * An adaptive-width navigation bar with a "limelight" effect that highlights the active item.
 */
export const LimelightNav = ({
  items = defaultNavItems,
  defaultActiveIndex = 0,
  activeIndex: controlledActiveIndex,
  onTabChange,
  draggable = true,
  className,
  limelightClassName,
  iconContainerClassName,
  iconClassName,
}: LimelightNavProps) => {
  const [internalActiveIndex, setInternalActiveIndex] =
    useState(defaultActiveIndex);
  const activeIndex = controlledActiveIndex ?? internalActiveIndex;
  const [isReady, setIsReady] = useState(false);

  const navRef = useRef<HTMLElement | null>(null);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  // Drag state: refs drive the per-frame math, `isDragging` drives the render
  // (cursor, transition toggle, highlighted icon). A small move threshold keeps
  // plain taps from nudging the limelight before the eased settle.
  const pointerDownRef = useRef(false);
  const movedRef = useRef(false);
  const startXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHoverIndex, setDragHoverIndex] = useState<number | null>(null);
  const DRAG_THRESHOLD = 2;

  const itemCenter = (i: number) => {
    const el = navItemRefs.current[i];
    return el ? el.offsetLeft + el.offsetWidth / 2 : 0;
  };

  const nearestIndex = (x: number) => {
    let best = 0;
    let bestDist = Infinity;
    navItemRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = Math.abs(itemCenter(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const placeLimelightAt = (x: number) => {
    const lm = limelightRef.current;
    if (!lm || items.length === 0) return;
    const min = itemCenter(0);
    const max = itemCenter(items.length - 1);
    const clamped = Math.max(min, Math.min(max, x));
    lm.style.left = `${clamped - lm.offsetWidth / 2}px`;
  };

  const relativeX = (clientX: number) => {
    const nav = navRef.current;
    return nav ? clientX - nav.getBoundingClientRect().left : 0;
  };

  useLayoutEffect(() => {
    if (items.length === 0 || movedRef.current) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];

    if (limelight && activeItem) {
      limelight.style.left = `${
        activeItem.offsetLeft +
        activeItem.offsetWidth / 2 -
        limelight.offsetWidth / 2
      }px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [activeIndex, isReady, items, isDragging]);

  if (items.length === 0) {
    return null;
  }

  const commitIndex = (index: number, itemOnClick?: () => void) => {
    setInternalActiveIndex(index);
    onTabChange?.(index);
    itemOnClick?.();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerDownRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!pointerDownRef.current || !draggable) return;
    const x = relativeX(e.clientX);
    if (!movedRef.current) {
      if (Math.abs(e.clientX - startXRef.current) < DRAG_THRESHOLD) return;
      movedRef.current = true;
      setIsDragging(true);
      navRef.current?.setPointerCapture(e.pointerId);
      // Kill the eased transition NOW (before the state re-render lands) so the
      // limelight tracks the finger from the very first frame — no lag on start.
      if (limelightRef.current) limelightRef.current.style.transition = "none";
    }
    placeLimelightAt(x);
    const ni = nearestIndex(x);
    setDragHoverIndex((prev) => (prev === ni ? prev : ni));
  };

  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    movedRef.current = false;
    try {
      navRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* capture already released */
    }
    setDragHoverIndex(null);
    // Hand the eased transition back to the class so the snap-to-center animates.
    if (limelightRef.current) limelightRef.current.style.transition = "";

    if (e.type === "pointercancel") {
      setIsDragging(false);
      return;
    }

    setIsDragging(false);
    // Release — whether it was a drag or a tap — selects the nearest item.
    // Same-index release: the layout effect re-snaps the limelight to center.
    const target = nearestIndex(relativeX(e.clientX));
    if (target !== activeIndex) {
      commitIndex(target, items[target]?.onClick);
    }
  };

  return (
    <nav
      ref={navRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "relative inline-flex items-center h-16 rounded-lg bg-card text-foreground border px-2 select-none touch-pan-y",
        draggable && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        className,
      )}
    >
      {items.map(({ id, icon, label, onClick }, index) => {
        const highlighted =
          dragHoverIndex !== null
            ? dragHoverIndex === index
            : activeIndex === index;
        return (
          <a
            key={id}
            ref={(el) => {
              navItemRefs.current[index] = el;
            }}
            role="tab"
            tabIndex={0}
            aria-selected={activeIndex === index}
            className={cn(
              "relative z-20 flex h-full cursor-pointer items-center justify-center p-5",
              iconContainerClassName,
            )}
            onKeyDown={(e) => {
              // Mouse/touch go through the nav's pointer handlers; keyboard here.
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                commitIndex(index, onClick);
              }
            }}
            aria-label={label}
          >
            {cloneElement(icon, {
              className: cn(
                "w-6 h-6 transition-opacity duration-100 ease-in-out",
                highlighted ? "opacity-100" : "opacity-40",
                icon.props.className,
                iconClassName,
              ),
            })}
          </a>
        );
      })}

      <div
        ref={limelightRef}
        className={cn(
          "absolute top-0 z-10 w-11 h-[5px] rounded-full bg-primary shadow-[0_50px_15px_hsl(var(--primary))]",
          isReady &&
            !isDragging &&
            "transition-[left] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          limelightClassName,
        )}
        style={{ left: "-999px" }}
      >
        <div className="absolute left-[-30%] top-[5px] w-[160%] h-14 [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)] bg-gradient-to-b from-primary/30 to-transparent pointer-events-none" />
      </div>
    </nav>
  );
};

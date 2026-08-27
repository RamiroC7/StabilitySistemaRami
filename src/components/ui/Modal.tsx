import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Focus Trap Hook ─────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseModalFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  disableEscape?: boolean;
  returnFocus?: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModalFocusTrap({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef,
  disableEscape = false,
  returnFocus = true,
}: UseModalFocusTrapOptions) {
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Keydown handler: Escape & Focus Trap (Tab / Shift+Tab)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !containerRef.current) return;

      if (e.key === "Escape" && !disableEscape) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusableElements = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter(
          (el) =>
            el.offsetParent !== null &&
            !el.hasAttribute("disabled") &&
            el.getAttribute("aria-hidden") !== "true"
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === firstElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (
            document.activeElement === lastElement ||
            !containerRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isOpen, onClose, containerRef, disableEscape]
  );

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus on close
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Set initial focus
    const timer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          containerRef.current.focus();
        }
      }
    }, 50);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      clearTimeout(timer);

      if (returnFocus && triggerElementRef.current) {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen, handleKeyDown, initialFocusRef, containerRef, returnFocus]);
}

// ── Accessible Modal Component ──────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  disableEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  ariaLabel,
  children,
  className,
  overlayClassName,
  showCloseButton = true,
  disableEscape = false,
  initialFocusRef,
  size = "md",
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useModalFocusTrap({
    isOpen,
    onClose,
    containerRef,
    initialFocusRef,
    disableEscape,
  });

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
        overlayClassName
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget && !disableEscape) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
        onClick={() => {
          if (!disableEscape) onClose();
        }}
      />

      {/* Dialog Box */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!title && ariaLabel ? ariaLabel : undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-2xl transition-all border border-slate-200 dark:border-slate-800",
          "animate-in fade-in zoom-in-95 duration-200",
          sizeClasses[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header if title exists */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg font-bold text-slate-900 dark:text-white leading-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar modal"
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode
    endIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon, endIcon, ...props }, ref) => {
        return (
            <div className="relative flex items-center w-full">
                {icon && (
                    <span className="absolute left-4 text-text-secondary pointer-events-none select-none">
                        {icon}
                    </span>
                )}
                <input
                    type={type}
                    className={cn(
                        "flex h-12 w-full rounded-lg border border-border-color bg-white px-4 py-2 text-base font-normal text-text-main transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-secondary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white",
                        icon && "pl-12",
                        endIcon && "pr-12",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {endIcon && (
                    <span className="absolute right-0 top-0 h-full px-3 flex items-center justify-center">
                        {endIcon}
                    </span>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, id, ...props }, ref) => {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id={id}
                    ref={ref}
                    className={cn(
                        "h-4 w-4 rounded border-border-color text-primary focus:ring-primary focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-800",
                        className
                    )}
                    {...props}
                />
                {label && (
                    <label
                        htmlFor={id}
                        className="text-sm font-medium text-text-main dark:text-slate-200 cursor-pointer"
                    >
                        {label}
                    </label>
                )}
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

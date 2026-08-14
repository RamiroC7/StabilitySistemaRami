import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
    label: string;
    icon: string;
    value: Date;
    onChange: (date: Date) => void;
}

export default function DatePicker({ label, icon, value, onChange }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
    const containerRef = useRef<HTMLDivElement>(null);

    // Close calendar when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const formatDate = (date: Date) => {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
    };

    const getMonthName = (date: Date) => {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[date.getMonth()];
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days: (number | null)[] = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    };

    const handlePreviousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleDateSelect = (day: number) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(newDate);
        setIsOpen(false);
    };

    const isSelectedDate = (day: number | null) => {
        if (day === null) return false;
        const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        return checkDate.toDateString() === value.toDateString();
    };

    const isToday = (day: number | null) => {
        if (day === null) return false;
        const checkDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const today = new Date();
        return checkDate.toDateString() === today.toDateString();
    };

    const days = getDaysInMonth(currentMonth);
    const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                <label className="text-[10px] uppercase font-bold text-[#5e758d] tracking-wider mr-1 cursor-pointer">
                    {label}
                </label>
                <span className="material-symbols-outlined text-[#5e758d] text-base">
                    {icon}
                </span>
                <span className="text-sm font-medium">{formatDate(value)}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 min-w-[280px]">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handlePreviousMonth}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">
                                chevron_left
                            </span>
                        </button>
                        <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                            {getMonthName(currentMonth)} {currentMonth.getFullYear()}
                        </div>
                        <button
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-600 dark:text-gray-400">
                                chevron_right
                            </span>
                        </button>
                    </div>

                    {/* Week Days */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map(day => (
                            <div
                                key={day}
                                className="text-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase py-1"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => (
                            <div key={index} className="aspect-square">
                                {day !== null ? (
                                    <button
                                        onClick={() => handleDateSelect(day)}
                                        className={`
                                            w-full h-full flex items-center justify-center text-sm rounded-md transition-colors
                                            ${isSelectedDate(day)
                                                ? 'bg-primary text-white font-bold'
                                                : isToday(day)
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-primary font-medium'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }
                                        `}
                                    >
                                        {day}
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => {
                                onChange(new Date());
                                setIsOpen(false);
                            }}
                            className="w-full text-xs text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 py-2 rounded transition-colors font-medium"
                        >
                            Hoy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

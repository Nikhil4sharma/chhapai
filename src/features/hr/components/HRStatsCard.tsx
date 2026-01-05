import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HRStatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    description?: string;
    className?: string;
    trend?: {
        value: number;
        label: string;
        positive?: boolean;
    };
    variant?: "blue" | "green" | "orange" | "purple";
    onClick?: () => void;
}

const variants = {
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-900",
    green: "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 text-orange-900",
    purple: "bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 text-purple-900",
};

const iconVariants = {
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    purple: "bg-purple-500/10 text-purple-600",
};

export function HRStatsCard({ title, value, icon: Icon, description, className, trend, variant = "blue", onClick }: HRStatsCardProps) {
    return (
        <Card
            className={cn(
                "border shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 overflow-hidden",
                variants[variant],
                onClick && "cursor-pointer active:scale-95",
                className
            )}
            onClick={onClick}
        >
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold opacity-80 uppercase tracking-wider">{title}</p>
                    <div className={cn("p-2 rounded-lg", iconVariants[variant])}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="text-3xl font-bold tracking-tight">{value}</h3>
                    {(description || trend) && (
                        <div className="flex items-center text-xs font-medium opacity-70">
                            {trend && (
                                <span className={cn("mr-2 flex items-center", trend.positive ? "text-green-600" : "text-red-600")}>
                                    {trend.positive ? "↑" : "↓"} {trend.value}%
                                </span>
                            )}
                            <span className="truncate">{description}</span>
                        </div>
                    )}
                </div>

                {/* Decorative background shape */}
                <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-white/30 blur-2xl pointer-events-none" />
            </CardContent>
        </Card>
    );
}

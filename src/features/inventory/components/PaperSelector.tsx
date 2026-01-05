import * as React from "react"
import { Check, ChevronsUpDown, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { PaperInventory, fetchInventory } from "@/services/inventory"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"

interface PaperSelectorProps {
    value?: string // Paper ID
    onSelect: (paper: PaperInventory | null) => void
    disabled?: boolean
    requiredQty?: number
}

export function PaperSelector({ value, onSelect, disabled, requiredQty = 0 }: PaperSelectorProps) {
    const [open, setOpen] = React.useState(false)

    const { data: inventory = [], isLoading } = useQuery({
        queryKey: ['paper_inventory'],
        queryFn: fetchInventory,
    })

    // Filter only active items for new orders
    const activeInventory = React.useMemo(() =>
        inventory.filter(i => i.status === 'active'),
        [inventory])

    const selectedPaper = React.useMemo(() =>
        activeInventory.find((item) => item.id === value),
        [activeInventory, value])

    const isLowStock = selectedPaper && selectedPaper.available_sheets < requiredQty

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between",
                        !value && "text-muted-foreground",
                        isLowStock && "border-orange-500 text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700"
                    )}
                    disabled={disabled}
                >
                    {value
                        ? activeInventory.find((item) => item.id === value)?.name
                        : "Select paper..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search paper (Name, Brand, GSM)..." />
                    <CommandList>
                        <CommandEmpty>No paper found.</CommandEmpty>
                        <CommandGroup>
                            {activeInventory.map((item) => {
                                const isInsufficient = requiredQty > 0 && item.available_sheets < requiredQty;

                                return (
                                    <CommandItem
                                        key={item.id}
                                        value={item.id} // Shadcn command usually uses value for filtering, better use name if search needed
                                        keywords={[item.name, item.brand || '', item.gsm.toString()]}
                                        onSelect={(currentValue) => {
                                            // Note: currentValue is lowercase value from shadcn
                                            // We need to match back to ID
                                            // Actually shadcn command value is the content if not specified? 
                                            onSelect(item)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === item.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col w-full">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium truncate">{item.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{item.gsm} GSM</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1 text-xs">
                                                <span className={cn(
                                                    "transition-colors",
                                                    isInsufficient
                                                        ? "text-red-500 font-medium"
                                                        : item.available_sheets <= item.reorder_threshold
                                                            ? "text-orange-500"
                                                            : "text-green-600"
                                                )}>
                                                    {item.available_sheets.toLocaleString()} Available
                                                </span>
                                                {item.brand && <span className="text-muted-foreground">{item.brand}</span>}
                                            </div>
                                        </div>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

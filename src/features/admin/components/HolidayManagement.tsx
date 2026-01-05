import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAdminHR } from "@/features/hr/hooks/useAdminHR";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function HolidayManagement() {
    const { holidays, addHoliday, deleteHoliday, isLoading } = useAdminHR();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newHoliday, setNewHoliday] = useState({
        name: "",
        date: undefined as Date | undefined,
        type: "mandatory" as "mandatory" | "optional"
    });

    const handleAddHoliday = async () => {
        if (!newHoliday.name || !newHoliday.date) {
            toast.error("Please fill in all details");
            return;
        }

        try {
            await addHoliday.mutateAsync({
                name: newHoliday.name,
                date: newHoliday.date.toISOString(),
                day_of_week: format(newHoliday.date, 'EEEE'),
                year: newHoliday.date.getFullYear(),
                type: newHoliday.type
            });
            toast.success("Holiday added successfully");
            setIsAddOpen(false);
            setNewHoliday({ name: "", date: undefined, type: "mandatory" });
        } catch (error) {
            toast.error("Failed to add holiday");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this holiday?")) return;
        try {
            await deleteHoliday.mutateAsync(id);
            toast.success("Holiday deleted");
        } catch (error) {
            toast.error("Failed to delete holiday");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Holiday Calendar</CardTitle>
                    <CardDescription>Manage public and optional holidays</CardDescription>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Holiday
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Holiday</DialogTitle>
                            <DialogDescription>Add a new holiday to the calendar.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Holiday Name</label>
                                <Input
                                    value={newHoliday.name}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                    placeholder="e.g. Independence Day"
                                />
                            </div>
                            <div className="space-y-2 flex flex-col">
                                <label className="text-sm font-medium">Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !newHoliday.date && "text-muted-foreground"
                                            )}
                                        >
                                            {newHoliday.date ? (
                                                format(newHoliday.date, "PPP")
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={newHoliday.date}
                                            onSelect={(date) => setNewHoliday({ ...newHoliday, date })}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Type</label>
                                <Select
                                    value={newHoliday.type}
                                    onValueChange={(val: "mandatory" | "optional") => setNewHoliday({ ...newHoliday, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mandatory">Mandatory</SelectItem>
                                        <SelectItem value="optional">Optional</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button onClick={handleAddHoliday}>Add Holiday</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Holiday</TableHead>
                                <TableHead>Day</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : holidays?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No holidays found</TableCell>
                                </TableRow>
                            ) : (
                                holidays?.map((holiday) => (
                                    <TableRow key={holiday.id}>
                                        <TableCell>{format(new Date(holiday.date), "MMM d, yyyy")}</TableCell>
                                        <TableCell className="font-medium">{holiday.name}</TableCell>
                                        <TableCell>{holiday.day_of_week}</TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                holiday.type === 'mandatory' ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                                            )}>
                                                {holiday.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(holiday.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adjustStock, PaperInventory } from '@/services/inventory';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

const adjustSchema = z.object({
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    type: z.enum(['in', 'out', 'adjust']),
    notes: z.string().optional(),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

interface AdjustStockDialogProps {
    item: PaperInventory;
}

export function AdjustStockDialog({ item }: AdjustStockDialogProps) {
    const [open, setOpen] = useState(false);
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const form = useForm<AdjustFormValues>({
        resolver: zodResolver(adjustSchema),
        defaultValues: {
            quantity: 1,
            type: 'in',
            notes: '',
        },
    });

    const mutation = useMutation({
        mutationFn: async (data: AdjustFormValues) => {
            if (!user) throw new Error("User not authenticated");
            // If 'out', we send negative quantity for adjust logic if needed, but the service handles type
            // Let's rely on service's handle logic (absolute qty + type)
            await adjustStock(item.id, data.quantity, data.type, user.id, data.notes);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paper_inventory'] });
            queryClient.invalidateQueries({ queryKey: ['paper_history'] }); // Assuming we have this query key
            toast({
                title: "Stock Adjusted",
                description: `Successfully updated stock for ${item.name}`,
            });
            setOpen(false);
            form.reset();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: AdjustFormValues) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="w-full text-xs h-8">Adjust</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Adjust Stock: {item.name}</DialogTitle>
                    <DialogDescription>
                        Manually update inventory levels.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Action</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select action" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="in">Add Stock (+)</SelectItem>
                                                <SelectItem value="out">Remove Stock (-)</SelectItem>
                                                <SelectItem value="adjust">Correction (Set/Delta)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason / Notes</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. New shipment, Damage found..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Stock
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

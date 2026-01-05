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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addPaperItem } from '@/services/inventory';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';

const paperSchema = z.object({
    name: z.string().min(2, 'Name is required'),
    brand: z.string().optional(),
    gsm: z.coerce.number().min(1, 'GSM must be positive'),
    width: z.coerce.number().min(0.1, 'Width required'),
    height: z.coerce.number().min(0.1, 'Height required'),
    total_sheets: z.coerce.number().min(0, 'Initial stock cannot be negative'),
    reorder_threshold: z.coerce.number().min(0, 'Threshold cannot be negative'),
    location: z.string().optional(),
});

type PaperFormValues = z.infer<typeof paperSchema>;

export function AddPaperDialog() {
    const [open, setOpen] = useState(false);
    const queryClient = useQueryClient();

    const form = useForm<PaperFormValues>({
        resolver: zodResolver(paperSchema),
        defaultValues: {
            name: '',
            brand: '',
            gsm: 300,
            width: 13,
            height: 19,
            total_sheets: 0,
            reorder_threshold: 100,
            location: '',
        },
    });

    const mutation = useMutation({
        mutationFn: addPaperItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['paper_inventory'] });
            toast({
                title: "Paper Added",
                description: "New paper stock has been added to inventory.",
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

    const onSubmit = (data: PaperFormValues) => {
        mutation.mutate(data);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Paper
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Paper Stock</DialogTitle>
                    <DialogDescription>
                        Define the specifications for the new paper item.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Paper Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Art Card 350GSM" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="brand"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Brand</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Sinar" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="gsm"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>GSM</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="width"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Width (inches)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="height"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Height (inches)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.1" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="total_sheets"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Initial Stock (Sheets)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="reorder_threshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reorder Alert Level</FormLabel>
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
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Storage Location</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Rack A-3" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Paper
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

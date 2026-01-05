import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { fetchPaperHistory, PaperInventory } from '@/services/inventory';
import { Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PaperHistoryDialogProps {
    item: PaperInventory;
}

export function PaperHistoryDialog({ item }: PaperHistoryDialogProps) {
    const [open, setOpen] = useState(false);

    const { data: history, isLoading } = useQuery({
        queryKey: ['paper_history', item.id],
        queryFn: () => fetchPaperHistory(item.id),
        enabled: open, // Only fetch when dialog opens
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full text-xs h-8">History</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>History: {item.name}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    {isLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : !history || history.length === 0 ? (
                        <div className="text-center text-muted-foreground p-4">No transaction history found.</div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm capitalize">{tx.type}</span>
                                            <span className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'PPP p')}</span>
                                        </div>
                                        {tx.notes && <p className="text-xs text-muted-foreground italic">{tx.notes}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={
                                            tx.type === 'in' ? 'default' :
                                                tx.type === 'consume' ? 'destructive' :
                                                    tx.type === 'reserve' ? 'secondary' : 'outline'
                                        }>
                                            {tx.type === 'out' || tx.type === 'consume' ? '-' : '+'}{tx.quantity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaperInventory, consumeJobMaterial, releaseJobMaterial } from '@/services/inventory';
import { PackageOpen, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface JobMaterialsCardProps {
    orderId: string;
}

export function JobMaterialsCard({ orderId }: JobMaterialsCardProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const { data: materials, isLoading } = useQuery({
        queryKey: ['job_materials', orderId],
        queryFn: async () => {
            const { data: materialsData, error: materialsError } = await supabase
                .from('job_materials')
                .select('*')
                .eq('job_id', orderId);

            if (materialsError) throw materialsError;

            if (!materialsData || materialsData.length === 0) return [];

            // Fetch paper details manually
            const paperIds = materialsData.map((m: any) => m.paper_id);
            const { data: paperData } = await supabase
                .from('paper_inventory')
                .select('id, name, brand, gsm, unit')
                .in('id', paperIds);

            const paperMap = new Map((paperData || []).map((p: any) => [p.id, p]));

            return materialsData.map((m: any) => ({
                ...m,
                paper_inventory: paperMap.get(m.paper_id)
            }));
        }
    });

    const consumeMutation = useMutation({
        mutationFn: async (materialId: string) => {
            if (!user) throw new Error("No user");
            await consumeJobMaterial(materialId, user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job_materials', orderId] });
            queryClient.invalidateQueries({ queryKey: ['paper_inventory'] }); // Update global stock
            toast({ title: "Material Consumed", description: "Inventory stock updated." });
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
        onSettled: () => setProcessingId(null)
    });

    const releaseMutation = useMutation({
        mutationFn: async (materialId: string) => {
            if (!user) throw new Error("No user");
            await releaseJobMaterial(materialId, user.id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['job_materials', orderId] });
            queryClient.invalidateQueries({ queryKey: ['paper_inventory'] });
            toast({ title: "Reservation Released", description: "Stock returned to available pool." });
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
        onSettled: () => setProcessingId(null)
    });

    const handleAction = (id: string, action: 'consume' | 'release') => {
        if (!confirm(`Are you sure you want to ${action} this material?`)) return;
        setProcessingId(id);
        if (action === 'consume') consumeMutation.mutate(id);
        else releaseMutation.mutate(id);
    };

    if (isLoading) return <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>;

    if (!materials || materials.length === 0) return null; // Don't show if no materials alloc

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <PackageOpen className="h-4 w-4" />
                    Allocated Inventory
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {materials.map((item: any) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-900/50 gap-3">
                            <div>
                                <div className="font-medium text-sm">
                                    {item.paper_inventory?.name}
                                    <span className="text-muted-foreground ml-2 text-xs">({item.paper_inventory?.gsm} GSM)</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Allocated: <span className="font-medium text-foreground">{item.sheets_allocated} {item.paper_inventory?.unit}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {item.status === 'reserved' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs border-red-200 hover:bg-red-50 hover:text-red-600"
                                            disabled={!!processingId}
                                            onClick={() => handleAction(item.id, 'release')}
                                        >
                                            Release
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                            disabled={!!processingId}
                                            onClick={() => handleAction(item.id, 'consume')}
                                        >
                                            Mark Used
                                        </Button>
                                    </>
                                )}

                                {item.status === 'consumed' && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Consumed
                                    </Badge>
                                )}

                                {item.status === 'released' && (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        <XCircle className="h-3 w-3 mr-1" /> Released
                                    </Badge>
                                )}

                                {processingId === item.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

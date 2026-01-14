import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Plus, AlertTriangle, ScrollText, PackageOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getJobMaterials, consumeJobMaterial, reservePaperForJob } from '@/services/inventory';
import { PaperSelector } from '@/features/inventory/components/PaperSelector';
import { PaperInventory } from '@/services/inventory';

interface MaterialManagementProps {
    orderId: string;
    userId: string;
    onUpdate?: () => void;
}

export function MaterialManagement({ orderId, userId, onUpdate }: MaterialManagementProps) {
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Add/Request More State
    const [addMoreOpen, setAddMoreOpen] = useState(false);
    const [selectedPaper, setSelectedPaper] = useState<PaperInventory | null>(null);
    const [extraQty, setExtraQty] = useState<number>(0);

    const fetchMaterials = async () => {
        try {
            setLoading(true);
            const data = await getJobMaterials(orderId);
            setMaterials(data || []);
        } catch (error) {
            console.error("Error fetching materials:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) fetchMaterials();
    }, [orderId]);

    const handleConsume = async (materialId: string) => {
        try {
            setActionLoading(materialId);
            await consumeJobMaterial(materialId, userId);
            toast({ title: "Material Used", description: "Inventory updated successfully." });
            await fetchMaterials(); // Refresh
            onUpdate?.();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const handleAllocateMaterial = async () => {
        if (!selectedPaper || extraQty <= 0) return;
        try {
            setActionLoading('add-more');
            await reservePaperForJob(orderId, selectedPaper.id, extraQty, userId);
            toast({
                title: materials.length === 0 ? "Material Allocated" : "Added Extra Material",
                description: `${extraQty} sheets of ${selectedPaper.name} allocated.`
            });
            setAddMoreOpen(false);
            setSelectedPaper(null);
            setExtraQty(0);
            await fetchMaterials();
            onUpdate?.();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                <PackageOpen className="w-3.5 h-3.5" />
                Material Inventory
            </Label>

            {materials.length === 0 ? (
                // Empty State - No materials allocated yet
                <Card className="p-6 border-dashed bg-muted/10 text-center space-y-3">
                    <PackageOpen className="w-12 h-12 mx-auto text-muted-foreground/30" />
                    <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">No Materials Allocated</h4>
                        <p className="text-xs text-muted-foreground">Allocate paper inventory for this production job</p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 border-dashed"
                        onClick={() => setAddMoreOpen(true)}
                    >
                        <Plus className="w-4 h-4" />
                        Allocate Materials
                    </Button>
                </Card>
            ) : (
                // Material List - Show allocated materials
                <div className="grid gap-2">
                    {materials.map((mat) => (
                        <Card key={mat.id} className="p-3 flex items-center justify-between border-dashed bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 flex items-center justify-center">
                                    <ScrollText className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold">{mat.paper?.name || 'Unknown Paper'}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{mat.sheets_allocated} Sheets</span>
                                        {mat.status === 'consumed' ? (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] h-5">Used</Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] h-5">Reserved</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {mat.status === 'reserved' && (
                                    <Button
                                        size="sm"
                                        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                        disabled={!!actionLoading}
                                        onClick={() => handleConsume(mat.id)}
                                    >
                                        {actionLoading === mat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                        Mark as Used
                                    </Button>
                                )}

                                {/* Allow requesting more on any item */}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-dashed"
                                    title="Add More"
                                    disabled={!!actionLoading}
                                    onClick={() => {
                                        setSelectedPaper(mat.paper);
                                        setAddMoreOpen(true);
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Dialog for Allocating/Adding Materials */}
            <Dialog open={addMoreOpen} onOpenChange={setAddMoreOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {materials.length === 0 ? 'Allocate Materials' : 'Add More Material'}
                        </DialogTitle>
                        <DialogDescription>
                            {materials.length === 0
                                ? 'Select paper and quantity to allocate for this production job.'
                                : `Allocate additional sheets${selectedPaper ? ` of ${selectedPaper.name}` : ''}.`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {/* Paper Selector - Show only if no paper pre-selected (empty state) */}
                        {!selectedPaper && (
                            <div className="space-y-2">
                                <Label>Select Paper</Label>
                                <PaperSelector
                                    value={selectedPaper?.id || ''}
                                    onSelect={setSelectedPaper}
                                    requiredQty={extraQty}
                                />
                            </div>
                        )}

                        {/* Quantity Input */}
                        <div className="space-y-2">
                            <Label>Quantity Needed (Sheets)</Label>
                            <Input
                                type="number"
                                min="1"
                                value={extraQty || ''}
                                onChange={(e) => setExtraQty(parseInt(e.target.value) || 0)}
                                placeholder="Enter quantity"
                                autoFocus
                            />
                            {selectedPaper && (
                                <>
                                    <p className="text-xs text-muted-foreground">
                                        Available in Stock: <span className="font-medium">{selectedPaper.available_sheets}</span>
                                    </p>
                                    {selectedPaper.available_sheets < extraQty && (
                                        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Insufficient Stock
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setAddMoreOpen(false);
                                setSelectedPaper(null);
                                setExtraQty(0);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAllocateMaterial}
                            disabled={!selectedPaper || extraQty <= 0 || (selectedPaper?.available_sheets < extraQty) || !!actionLoading}
                        >
                            {actionLoading === 'add-more' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {materials.length === 0 ? 'Allocate' : 'Add More'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

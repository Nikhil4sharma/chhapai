import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInventory, PaperInventory } from '@/services/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, AlertTriangle, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { AddPaperDialog } from '@/features/inventory/components/AddPaperDialog';
import { AdjustStockDialog } from '@/features/inventory/components/AdjustStockDialog';
import { PaperHistoryDialog } from '@/features/inventory/components/PaperHistoryDialog';

export default function InventoryDashboard() {
    const [searchQuery, setSearchQuery] = useState('');

    const { data: inventory, isLoading, error } = useQuery({
        queryKey: ['paper_inventory'],
        queryFn: fetchInventory,
    });

    // Derived State
    const filteredInventory = inventory?.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const totalItems = inventory?.length || 0;
    const lowStockItems = inventory?.filter(i => i.available_sheets <= i.reorder_threshold).length || 0;
    const totalSheets = inventory?.reduce((sum, i) => sum + i.total_sheets, 0) || 0;

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Paper Inventory</h2>
                    <p className="text-muted-foreground">Manage stock levels, reservations, and reordering.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <AddPaperDialog />
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Paper Types</CardTitle>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalItems}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sheets in Stock</CardTitle>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSheets.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{lowStockItems}</div>
                        <p className="text-xs text-muted-foreground">Items below threshold</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center space-x-2">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search papers..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Inventory Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="h-[200px]">
                            <CardHeader><Skeleton className="h-4 w-[150px]" /></CardHeader>
                            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                        </Card>
                    ))
                ) : filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => (
                        <PaperStockCard key={item.id} item={item} />
                    ))
                ) : (
                    <div className="col-span-full text-center py-10 text-muted-foreground">
                        No paper items found.
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-component for individual card
function PaperStockCard({ item }: { item: PaperInventory }) {
    const utilization = Math.min(((item.total_sheets - item.available_sheets) / item.total_sheets) * 100, 100) || 0;
    const isLowStock = item.available_sheets <= item.reorder_threshold;

    return (
        <Card className={`overflow-hidden transition-all hover:shadow-md ${isLowStock ? 'border-orange-200 dark:border-orange-900/50' : ''}`}>
            <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base font-semibold line-clamp-1" title={item.name}>
                            {item.name}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground mt-1">
                            {item.brand} • {item.gsm} GSM • {item.width}" x {item.height}"
                        </div>
                    </div>
                    {isLowStock && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px]">
                            Low Stock
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">

                <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                        <span>Available</span>
                        <span>{item.available_sheets.toLocaleString()} / {item.total_sheets.toLocaleString()}</span>
                    </div>
                    {/* Simple visual bar: 
                 Background = Total Capacity (Grey)
                 Fill = Available (Green/Orange)
             */}
                    <Progress value={(item.available_sheets / item.total_sheets) * 100} className={`h-2 ${isLowStock ? "bg-orange-100" : "bg-slate-100"}`} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground block">Reserved</span>
                        <span className="font-semibold">{item.reserved_sheets.toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-muted-foreground block">Location</span>
                        <span className="font-semibold truncate">{item.location || 'N/A'}</span>
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <PaperHistoryDialog item={item} />
                    <AdjustStockDialog item={item} />
                </div>
            </CardContent>
        </Card>
    )
}

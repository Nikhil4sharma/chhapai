import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Trash2, Plus, X } from 'lucide-react';
import { PaperSelector } from '@/features/inventory/components/PaperSelector';
import { ProductItem as ProductItemType } from './types';
import { DEFAULT_SPEC_KEYS } from './utils';

interface ProductItemProps {
    product: ProductItemType;
    index: number;
    productCount: number;
    updateProduct: (index: number, field: keyof ProductItemType, value: any) => void;
    removeProduct: (index: number) => void;
    activeProductIndex: number | null;
    setActiveProductIndex: (index: number | null) => void;
    addSpecification: (index: number, key: string, value: string) => void;
    removeSpecification: (index: number, key: string) => void;
}

export function ProductItem({
    product,
    index,
    productCount,
    updateProduct,
    removeProduct,
    activeProductIndex,
    setActiveProductIndex,
    addSpecification,
    removeSpecification
}: ProductItemProps) {

    // Local state helper for adding specs is better handled in parent via activeProductIndex
    // But we need to manage the input values. Parent hook doesn't store input values for each product's spec form
    // Wait, useCreateOrder hook DOES NOT store newSpecKey/Value for ALL products individually, 
    // it likely uses one shared state or we need to manage it locally here.
    // The original code used shared state `newSpecKey` and `newSpecValue`.
    // Ideally, this form state should be local to the component if it's transient.

    // Let's use local controlled inputs for the spec form to avoid prop drilling transient state too much.
    // We can just pass the "add" handler.

    const handleAddSpec = (key: string, value: string) => {
        if (key && value) {
            addSpecification(index, key, value);
        }
    };

    return (
        <Card className="relative border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group/card hover:shadow-md transition-all">
            <div className="bg-blue-50/30 dark:bg-blue-950/20 px-4 py-3 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold text-xs shadow-sm">
                        {index + 1}
                    </div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        Product Details
                        {Object.keys(product.specifications).length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 bg-blue-100/50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-none font-bold text-[10px]">
                                {Object.keys(product.specifications).length} SPECS
                            </Badge>
                        )}
                    </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                    {productCount > 1 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all rounded-full"
                            onClick={() => removeProduct(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            <CardContent className="p-4 sm:p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                    <div className="sm:col-span-6 grid gap-2">
                        <Label htmlFor={`product_name_${index}`} className="text-sm font-medium after:content-['*'] after:ml-0.5 after:text-red-500">
                            Product Name
                        </Label>
                        <div className="relative group/input">
                            <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within/input:text-blue-500 transition-colors" />
                            <Input
                                id={`product_name_${index}`}
                                placeholder="e.g. Visiting Cards"
                                value={product.name}
                                onChange={(e) => updateProduct(index, 'name', e.target.value)}
                                className="pl-10 h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="sm:col-span-3 grid gap-2">
                        <Label htmlFor={`product_quantity_${index}`} className="text-sm font-medium">Quantity</Label>
                        <Input
                            id={`product_quantity_${index}`}
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                        />
                    </div>
                    <div className="sm:col-span-3 grid gap-2">
                        <Label htmlFor={`product_price_${index}`} className="text-sm font-medium">Price (₹)</Label>
                        <Input
                            id={`product_price_${index}`}
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={product.price}
                            onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                            className="h-10 border-slate-200 dark:border-slate-800 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                        />
                    </div>

                    {/* Material Selection (Inventory) */}
                    <div className="sm:col-span-12 space-y-3 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inventory Allocation</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor={`paper_${index}`} className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Paper Material</Label>
                                <PaperSelector
                                    value={product.paperId}
                                    requiredQty={product.paperRequired || 0}
                                    onSelect={(paper) => {
                                        updateProduct(index, 'paperId', paper?.id);
                                    }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor={`paper_qty_${index}`} className="text-xs font-semibold text-slate-600 dark:text-slate-400">Est. Sheets Required</Label>
                                <div className="relative">
                                    <Input
                                        id={`paper_qty_${index}`}
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={product.paperRequired || ''}
                                        onChange={(e) => updateProduct(index, 'paperRequired', parseInt(e.target.value) || 0)}
                                        disabled={!product.paperId}
                                        className="h-10 border-slate-200 dark:border-slate-800 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                                    />
                                    {product.paperId && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                            SHEETS
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Specifications */}
                <SpecificationManager
                    product={product}
                    index={index}
                    addSpecification={handleAddSpec}
                    removeSpecification={removeSpecification}
                />
            </CardContent>
        </Card>
    );
}

// Sub-component for specifications to manage local input state
import { useState } from 'react';

function SpecificationManager({ product, index, addSpecification, removeSpecification }: any) {
    const [newSpecKey, setNewSpecKey] = useState('');
    const [newSpecValue, setNewSpecValue] = useState('');

    const submitSpec = () => {
        if (newSpecKey.trim() && newSpecValue.trim()) {
            addSpecification(newSpecKey, newSpecValue);
            setNewSpecKey('');
            setNewSpecValue('');
        }
    };

    return (
        <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Specifications</Label>
                <span className="text-[10px] text-slate-400 font-medium italic">* At least 1 required</span>
            </div>

            {/* Existing specs */}
            {Object.keys(product.specifications).length > 0 && (
                <div className="flex flex-wrap gap-2 py-1">
                    {Object.entries(product.specifications).map(([key, value]) => (
                        <Badge
                            key={key}
                            variant="outline"
                            className="group/badge py-1.5 px-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:border-blue-400 dark:hover:border-blue-700 pr-1.5"
                        >
                            <span className="font-bold text-blue-600 dark:text-blue-400 mr-1.5">{key}:</span>
                            <span className="truncate max-w-[120px]">{String(value)}</span>
                            <button
                                type="button"
                                className="ml-2 h-4 w-4 rounded-full flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-500 transition-colors"
                                onClick={() => removeSpecification(index, key)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_SPEC_KEYS.filter(key => !product.specifications[key]).map(key => (
                        <Button
                            key={key}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[11px] px-2.5 rounded-full border-dashed bg-slate-50/50 dark:bg-slate-950/20 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all font-semibold"
                            onClick={() => {
                                setNewSpecKey(key);
                                // Auto focus value input? Logic requires refs, maybe simpler to just set key
                            }}
                        >
                            <Plus className="h-3 w-3 mr-1 opacity-60" />
                            {key}
                        </Button>
                    ))}
                </div>

                {/* Add spec form */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Spec name (e.g., Size)"
                        value={newSpecKey}
                        onChange={(e) => setNewSpecKey(e.target.value)}
                        className="flex-1"
                    />
                    <Input
                        placeholder="Value (e.g., A4)"
                        value={newSpecValue}
                        onChange={(e) => setNewSpecValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                submitSpec();
                            }
                        }}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={submitSpec}
                        disabled={!newSpecKey.trim() || !newSpecValue.trim()}
                    >
                        Add
                    </Button>
                </div>
            </div>
        </div>
    );
}

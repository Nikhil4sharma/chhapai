import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Plus } from 'lucide-react';
import { ProductItem } from './ProductItem';
import { ProductItem as ProductItemType } from './types';

interface ProductListProps {
    products: ProductItemType[];
    addProduct: () => void;
    removeProduct: (index: number) => void;
    updateProduct: (index: number, field: keyof ProductItemType, value: any) => void;
    addSpecification: (index: number, key: string, value: string) => void;
    removeSpecification: (index: number, key: string) => void;
    activeProductIndex: number | null;
    setActiveProductIndex: (index: number | null) => void;
    isWooCommerceOrder: boolean;
}

export function ProductList({
    products,
    addProduct,
    removeProduct,
    updateProduct,
    addSpecification,
    removeSpecification,
    activeProductIndex,
    setActiveProductIndex,
    isWooCommerceOrder
}: ProductListProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-sm">
                        <Package className="h-4 w-4 text-white" />
                    </div>
                    Order Products
                    <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border-none font-bold">
                        {products.length}
                    </Badge>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addProduct}
                    disabled={isWooCommerceOrder}
                    className="h-10 px-4 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 hover:border-blue-300 transition-all shadow-sm"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Product
                </Button>
            </div>

            <div className="space-y-4">
                {products.map((product, index) => (
                    <ProductItem
                        key={product.id}
                        index={index}
                        product={product}
                        productCount={products.length}
                        updateProduct={updateProduct}
                        removeProduct={removeProduct}
                        addSpecification={addSpecification}
                        removeSpecification={removeSpecification}
                        activeProductIndex={activeProductIndex}
                        setActiveProductIndex={setActiveProductIndex}
                    />
                ))}
            </div>
        </div>
    );
}

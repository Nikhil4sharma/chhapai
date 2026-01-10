import { Priority } from '@/types/order';

export const DEFAULT_SPEC_KEYS = ['Size', 'Material', 'Finish', 'Color', 'Printing', 'Quantity Details'];

// Helper to compute priority based on days until delivery
export const computePriority = (deliveryDate: Date | null | undefined): Priority => {
    if (!deliveryDate) return 'blue';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil > 5) return 'blue';
    if (daysUntil >= 3) return 'yellow';
    return 'red';
};

// Helper to normalize order numbers for comparison
export const normalizeOrderNumberForComparison = (orderNum: string | number | null | undefined): string => {
    if (!orderNum) return '';
    const str = orderNum.toString().trim();
    const withoutPrefix = str.replace(/^(WC|MAN)-/i, '');
    return withoutPrefix.replace(/\D/g, '');
};

export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 9)}`;
};

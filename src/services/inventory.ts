import { supabase } from "@/integrations/supabase/client";

export interface PaperInventory {
    id: string;
    name: string;
    brand: string | null;
    gsm: number;
    width: number;
    height: number;
    unit: string;
    total_sheets: number;
    reserved_sheets: number;
    available_sheets: number;
    reorder_threshold: number;
    location: string | null;
    status: 'active' | 'discontinued';
    created_at: string;
}

export interface InventoryTransaction {
    id: string;
    paper_id: string;
    type: 'in' | 'out' | 'reserve' | 'release' | 'consume' | 'adjust';
    quantity: number;
    job_id?: string;
    performed_by?: string;
    notes?: string;
    created_at: string;
}

/**
 * Fetch all inventory items
 */
export const fetchInventory = async (): Promise<PaperInventory[]> => {
    const { data, error } = await supabase
        .from('paper_inventory')
        .select('*')
        .order('name');

    if (error) throw error;
    return data as PaperInventory[];
};

/**
 * Add a new paper item (Admin only)
 */
export const addPaperItem = async (item: Partial<PaperInventory>) => {
    const { data, error } = await supabase
        .from('paper_inventory')
        .insert(item)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Adjust stock level via Transaction
 * This ensures the trigger handles the math and we have a log.
 */
export const adjustStock = async (
    paperId: string,
    quantity: number, // Positive adds, Negative removes
    type: 'in' | 'out' | 'adjust',
    userId: string,
    notes?: string
) => {
    // Normalize quantity
    // If type 'adjust', allow negative. Others strict magnitude controlled by type logic in trigger.
    const finalQuantity = type === 'adjust' ? quantity : Math.abs(quantity);

    const { data, error } = await supabase
        .from('inventory_transactions')
        .insert({
            paper_id: paperId,
            type: type,
            quantity: finalQuantity,
            performed_by: userId,
            notes: notes
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Fetch transaction history for a specific paper
 */
export const fetchPaperHistory = async (paperId: string): Promise<InventoryTransaction[]> => {
    const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*')
        .eq('paper_id', paperId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as InventoryTransaction[];
};

/**
 * Get low stock items
 */
export const fetchLowStockItems = async (): Promise<PaperInventory[]> => {
    // We can't use `where available_sheets < reorder_threshold` directly because computed column query support varies?
    // Actually PostgreSQL supports querying generated columns.
    // Warning: RLS might affect this.
    const { data, error } = await supabase
        .from('paper_inventory')
        .select('*')
        .eq('status', 'active');

    if (error) throw error;

    // Filter locally for now to be safe or map
    return (data as PaperInventory[]).filter(i => i.available_sheets <= i.reorder_threshold);
};

/**
 * Reserve paper for a specific job
 * Handles both Job Allocation and Inventory Transaction
 */
export const reservePaperForJob = async (
    jobId: string,
    paperId: string,
    sheetsRequired: number,
    userId: string
) => {
    // 1. Create Job Material Allocation
    const { data: material, error: materialError } = await supabase
        .from('job_materials')
        .insert({
            job_id: jobId,
            paper_id: paperId,
            sheets_required: sheetsRequired,
            sheets_allocated: sheetsRequired, // Reserve full amount initially
            status: 'reserved'
        })
        .select()
        .single();

    if (materialError) throw materialError;

    // 2. Create Inventory Transaction (Reserve)
    // This triggers the available_sheets deduction
    const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert({
            paper_id: paperId,
            type: 'reserve',
            quantity: sheetsRequired,
            job_id: jobId,
            performed_by: userId,
            notes: 'Auto-reservation from Order Creation'
        });

    if (transactionError) {
        // Rollback material (Best effort)
        await supabase.from('job_materials').delete().eq('id', material.id);
        throw transactionError;
    }

    return material;
};

/**
 * Mark a job material as consumed (Production Done)
 * Triggers: status='consumed', Transaction type='consume'
 */
export const consumeJobMaterial = async (materialId: string, userId: string) => {
    // 1. Get Material Details
    const { data: material, error: fetchError } = await supabase
        .from('job_materials')
        .select('*')
        .eq('id', materialId)
        .single();

    if (fetchError) throw fetchError;
    if (material.status !== 'reserved') throw new Error(`Material must be reserved to consume. Current status: ${material.status}`);

    // 2. Update Status
    const { error: updateError } = await supabase
        .from('job_materials')
        .update({ status: 'consumed', updated_at: new Date().toISOString() })
        .eq('id', materialId);

    if (updateError) throw updateError;

    // 3. Log Consumption Transaction
    // This triggers: reserved_sheets -= qty, total_sheets -= qty
    const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
            paper_id: material.paper_id,
            type: 'consume',
            quantity: material.sheets_allocated,
            job_id: material.job_id,
            performed_by: userId,
            notes: 'Material consumed in production'
        });

    if (txError) {
        // Rever status (Manual Rollback)
        await supabase.from('job_materials').update({ status: 'reserved' }).eq('id', materialId);
        throw txError;
    }

    return true;
};

/**
 * Release a job material (Order Cancelled/Revised)
 * Triggers: status='released', Transaction type='release'
 */
export const releaseJobMaterial = async (materialId: string, userId: string) => {
    // 1. Get Material Details
    const { data: material, error: fetchError } = await supabase
        .from('job_materials')
        .select('*')
        .eq('id', materialId)
        .single();

    if (fetchError) throw fetchError;
    if (material.status !== 'reserved') throw new Error(`Material must be reserved to release. Current status: ${material.status}`);

    // 2. Update Status
    const { error: updateError } = await supabase
        .from('job_materials')
        .update({ status: 'released', updated_at: new Date().toISOString() })
        .eq('id', materialId);

    if (updateError) throw updateError;

    // 3. Log Release Transaction
    // This triggers: reserved_sheets -= qty
    const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert({
            paper_id: material.paper_id,
            type: 'release',
            quantity: material.sheets_allocated,
            job_id: material.job_id,
            performed_by: userId,
            notes: 'Reservation released'
        });

    if (txError) {
        // Revert status
        await supabase.from('job_materials').update({ status: 'reserved' }).eq('id', materialId);
        throw txError;
    }

    return true;
};

/**
 * Fetch materials allocated to a specific job
 */
export const getJobMaterials = async (jobId: string) => {
    const { data, error } = await supabase
        .from('job_materials')
        .select(`
            *,
            paper:paper_inventory(*)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
};





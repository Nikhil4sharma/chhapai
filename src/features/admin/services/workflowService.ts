
import { supabase } from '@/integrations/supabase/client';
import { WorkflowConfig, DEFAULT_WORKFLOW } from '@/types/workflow';

const SETTINGS_KEY = 'workflow_config';

/**
 * Fetch Workflow Configuration from Supabase (or fallback to defaults)
 */
export async function fetchWorkflowConfig(): Promise<WorkflowConfig> {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SETTINGS_KEY)
            .maybeSingle();

        if (error) {
            // If table doesn't exist, ignore error and return default
            if (error.code === '42P01') {
                console.warn('app_settings table not found, using defaults.');
                return DEFAULT_WORKFLOW;
            }
            console.warn('Error fetching workflow config:', error);
            return DEFAULT_WORKFLOW;
        }

        if (data && data.value) {
            // Merge with default to ensure structural integrity? 
            // For now, just return what's in DB or default if empty
            return (data.value as unknown as WorkflowConfig) || DEFAULT_WORKFLOW;
        }

        return DEFAULT_WORKFLOW;
    } catch (error) {
        console.error('Unexpected error fetching workflow config:', error);
        return DEFAULT_WORKFLOW;
    }
}

/**
 * Save Workflow Configuration to Supabase
 */
export async function saveWorkflowConfig(config: WorkflowConfig): Promise<void> {
    try {
        // Check if table exists first by doing a lightweight read or just try upsert
        // We'll try upsert. If it fails due to table missing, we can't do much without SQL migration.
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: SETTINGS_KEY,
                value: config as any,
                updated_at: new Date().toISOString()
            });

        if (error) {
            if (error.code === '42P01') {
                throw new Error('Database table "app_settings" does not exist. Please contact developer.');
            }
            throw error;
        }
    } catch (error) {
        console.error('Error saving workflow config:', error);
        throw error;
    }
}

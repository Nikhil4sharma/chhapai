
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WorkflowConfig, DEFAULT_WORKFLOW } from '@/types/workflow';
import { fetchWorkflowConfig, saveWorkflowConfig } from '@/features/admin/services/workflowService';
import { toast } from '@/hooks/use-toast';
import { PRODUCTION_STEPS } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowContextType {
    config: WorkflowConfig;
    isLoading: boolean;
    updateConfig: (newConfig: WorkflowConfig) => Promise<void>;
    refreshConfig: () => Promise<void>;
    productionStages: Array<{ key: string; label: string; order: number }>;
    updateProductionStages: (stages: Array<{ key: string; label: string; order: number }>) => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<WorkflowConfig>(DEFAULT_WORKFLOW);
    const [isLoading, setIsLoading] = useState(true);
    const [productionStages, setProductionStages] = useState<Array<{ key: string; label: string; order: number }>>([]);

    const loadConfig = async () => {
        setIsLoading(true);
        try {
            // Load Workflow Config
            const data = await fetchWorkflowConfig();
            setConfig(data);

            // Load Production Stages
            const { data: stageData, error: stageError } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'production_stages')
                .maybeSingle();

            if (stageData?.value && Array.isArray(stageData.value)) {
                setProductionStages(stageData.value);
            } else {
                // Fallback to default
                setProductionStages(PRODUCTION_STEPS.map(s => ({ key: s.key, label: s.label, order: s.order })));
            }

        } catch (error) {
            console.error('Failed to load workflow config or stages:', error);
            setConfig(DEFAULT_WORKFLOW);
            // Fallback for stages
            setProductionStages(PRODUCTION_STEPS.map(s => ({ key: s.key, label: s.label, order: s.order })));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const updateConfig = async (newConfig: WorkflowConfig) => {
        try {
            await saveWorkflowConfig(newConfig);
            setConfig(newConfig);
            toast({
                title: "Configuration Saved",
                description: "Workflow settings have been updated successfully.",
            });
        } catch (error: any) {
            console.error('Save config error', error);
            toast({
                title: "Error Saving Configuration",
                description: error.message || "Could not save settings.",
                variant: "destructive",
            });
            throw error;
        }
    };

    const updateProductionStages = async (stages: Array<{ key: string; label: string; order: number }>) => {
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'production_stages',
                    value: stages,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;
            setProductionStages(stages);
            toast({
                title: "Stages Saved",
                description: "Production stages updated successfully.",
            });
        } catch (error: any) {
            console.error('Save stages error', error);
            toast({
                title: "Error Saving Stages",
                description: error.message || "Could not save stages.",
                variant: "destructive",
            });
            throw error;
        }
    }

    return (
        <WorkflowContext.Provider value={{ config, isLoading, updateConfig, refreshConfig: loadConfig, productionStages, updateProductionStages }}>
            {children}
        </WorkflowContext.Provider>
    );
}

export function useWorkflow() {
    const context = useContext(WorkflowContext);
    if (context === undefined) {
        throw new Error('useWorkflow must be used within a WorkflowProvider');
    }
    return context;
}

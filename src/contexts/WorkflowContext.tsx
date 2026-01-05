
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WorkflowConfig, DEFAULT_WORKFLOW } from '@/types/workflow';
import { fetchWorkflowConfig, saveWorkflowConfig } from '@/features/admin/services/workflowService';
import { toast } from '@/hooks/use-toast';

interface WorkflowContextType {
    config: WorkflowConfig;
    isLoading: boolean;
    updateConfig: (newConfig: WorkflowConfig) => Promise<void>;
    refreshConfig: () => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<WorkflowConfig>(DEFAULT_WORKFLOW);
    const [isLoading, setIsLoading] = useState(true);

    const loadConfig = async () => {
        setIsLoading(true);
        try {
            const data = await fetchWorkflowConfig();
            setConfig(data);
        } catch (error) {
            console.error('Failed to load workflow config:', error);
            // Fallback is already handled in service, but just in case
            setConfig(DEFAULT_WORKFLOW);
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
            toast({
                title: "Error Saving Configuration",
                description: error.message || "Could not save settings.",
                variant: "destructive",
            });
            throw error;
        }
    };

    return (
        <WorkflowContext.Provider value={{ config, isLoading, updateConfig, refreshConfig: loadConfig }}>
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

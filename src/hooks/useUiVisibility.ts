
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';

export type UiPageType = 'product_card' | 'order_details';

export interface UiModule {
    module_key: string;
    label: string;
    page_type: UiPageType;
    description: string | null;
}

export interface UiVisibilityRule {
    id: string;
    scope_type: 'department' | 'user';
    scope_id: string;
    module_key: string;
    is_visible: boolean;
    page_type?: string;
}

export const useUiVisibility = (pageType: UiPageType) => {
    const { user, role } = useAuth();
    const [rules, setRules] = useState<UiVisibilityRule[]>([]);
    const [modules, setModules] = useState<UiModule[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchVisibilityData = useCallback(async () => {
        if (!user || !role) return;

        try {
            setLoading(true);

            // 1. Fetch all modules for this page type (to know what exists)
            const { data: modulesData, error: modulesError } = await supabase
                .from('ui_modules')
                .select('*')
                .eq('page_type', pageType);

            if (modulesError) throw modulesError;

            // 2. Fetch relevant rules (Global/Dept/User)
            // strategies:
            // - Fetch ALL rules for this user's ID
            // - Fetch ALL rules for this user's Department
            // We can do this in one query with OR condition if we know the department name
            // BUT 'role' in AuthContext is essentially the department name (sales, design, etc)

            const { data: rulesData, error: rulesError } = await supabase
                .from('ui_visibility_rules')
                .select('*')
                .or(`scope_id.eq.${user.id},scope_id.eq.${role.toLowerCase()}`)
                .eq('scope_type', 'user') // We'll handle OR department in js filtering or improve query?
            // Actually, supabase OR syntax is: scope_id.eq.X,scope_id.eq.Y
            // And we need to ensure scope_type matches.
            // Let's just fetch ALL rules for now (or filter by page modules if we joined) - 
            // Optimization: Fetch rules where module_key is in the modules list we just got.

            // Better Query:
            // Fetch rules where module_key IN (modules we care about) AND (scope_id = user.id OR scope_id = role)
            const moduleKeys = modulesData.map(m => m.module_key);

            if (moduleKeys.length === 0) {
                setModules([]);
                setRules([]);
                setLoading(false);
                return;
            }

            const { data: relevantRules, error: rulesFetchError } = await supabase
                .from('ui_visibility_rules')
                .select('*')
                .in('module_key', moduleKeys)
                .or(`scope_id.eq.${user.id},scope_id.eq.${role}`);

            if (rulesFetchError) throw rulesFetchError;

            setModules(modulesData);
            setRules(relevantRules || []);

        } catch (error) {
            console.error('Error fetching UI visibility:', error);
        } finally {
            setLoading(false);
        }
    }, [user, role, pageType]);

    useEffect(() => {
        fetchVisibilityData();

        // specific subscription for this user's scope or their department
        // Note: Supabase Realtime RLS can be tricky.
        // We'll subscribe to the table and filter clientside or rely on the fetch if we receive ANY change event on this table.
        // Since this table is low velocity, re-fetching on any change is acceptable.
        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ui_visibility_rules',
                },
                (payload) => {
                    // We could optimize by checking if payload.new/old.scope_id matches current user/dept
                    // But simply refetching is safer to ensure consistency.
                    console.log('Visibility rule changed, refreshing...', payload);
                    fetchVisibilityData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchVisibilityData]);

    // Resolution Logic
    const canView = useCallback((moduleKey: string): boolean => {
        // 0. If loading, maybe show or hide? Default to show to prevent layout shift or hide?
        // Let's default to TRUE (Visible) if no rule exists.

        // 1. Look for User-specific rule
        const userRule = rules.find(r => r.scope_type === 'user' && r.scope_id === user?.id && r.module_key === moduleKey);
        if (userRule) return userRule.is_visible;

        // 2. Look for Department-specific rule
        const deptRule = rules.find(r => r.scope_type === 'department' && r.scope_id === role && r.module_key === moduleKey);
        if (deptRule) return deptRule.is_visible;

        // 3. Default Validation (Fallthrough)
        return true;
    }, [rules, user, role]);

    return { canView, loading, modules, rules, refresh: fetchVisibilityData };
};

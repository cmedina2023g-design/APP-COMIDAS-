import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getOrCreateProfile } from '@/lib/auth-helpers'

export function useInventoryAudits() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['inventory-audits'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_audits')
                .select('*, created_by_user:profiles(full_name)')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data
        }
    })
}

export function useCreateAudit() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: {
            notes: string,
            items: { ingredient_id: string, real_stock: number }[]
        }) => {
            const { organization_id, user } = await getOrCreateProfile(supabase)

            const { data: result, error } = await supabase.rpc('process_inventory_audit', {
                p_organization_id: organization_id,
                p_user_id: user.id,
                p_notes: data.notes,
                p_items: data.items
            })

            if (error) throw error
            return result
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-audits'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] }) // Stocks updated
            toast.success('Auditoría registrada y stock ajustado')
        },
        onError: (err: any) => {
            console.error(err)
            toast.error('Error al guardar auditoría', { description: err.message })
        }
    })
}

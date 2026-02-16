import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getOrCreateProfile } from '@/lib/auth-helpers'

export type PaymentMethod = {
    id: string
    organization_id: string
    name: string
    active: boolean
}

export function usePaymentMethods() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['payment_methods'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .order('name')

            if (error) throw error
            return data as PaymentMethod[]
        }
    })
}

export function useCreatePaymentMethod() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (name: string) => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.from('payment_methods').insert({
                name,
                organization_id,
                active: true
            }).select().single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment_methods'] })
            toast.success('Método de pago creado')
        },
        onError: (err: any) => toast.error('Error', { description: err.message })
    })
}

export function useTogglePaymentMethod() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
            const { error } = await supabase.from('payment_methods').update({ active }).eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment_methods'] })
            toast.success('Estado actualizado')
        },
        onError: (err: any) => toast.error('Error', { description: err.message })
    })
}

export function useDeletePaymentMethod() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('payment_methods').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payment_methods'] })
            toast.success('Eliminado')
        },
        onError: (err: any) => toast.error('Error', { description: err.message })
    })
}

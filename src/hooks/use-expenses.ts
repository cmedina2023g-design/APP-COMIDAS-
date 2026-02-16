import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Expense } from '@/lib/types'
import { toast } from 'sonner'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { startOfDay, endOfDay } from 'date-fns'

export function useExpenses(date?: Date) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['expenses', date],
        queryFn: async () => {
            let query = supabase
                .from('expenses')
                .select('*, ingredients(name)')
                .order('date', { ascending: false })

            if (date) {
                const start = startOfDay(date).toISOString()
                const end = endOfDay(date).toISOString()
                query = query.gte('date', start).lte('date', end)
            }

            const { data, error } = await query
            if (error) throw error
            return data as (Expense & { ingredients?: { name: string } })[]
        }
    })
}

export function useDeleteExpense() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.rpc('delete_expense', { p_expense_id: id })
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] }) // Refetch expenses
            queryClient.invalidateQueries({ queryKey: ['ingredients'] }) // Refetch inventory in case it was a purchase
            toast.success('Gasto eliminado')
        },
        onError: (err: any) => {
            toast.error('Error al eliminar', { description: err.message })
        }
    })
}

export function useCreateGeneralExpense() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (expense: { description: string, amount: number, date?: Date }) => {
            const { organization_id, user } = await getOrCreateProfile(supabase)

            // Use provided date or now
            const expenseDate = expense.date ? expense.date.toISOString() : new Date().toISOString()

            const { error } = await supabase.from('expenses').insert({
                organization_id,
                description: expense.description,
                amount: expense.amount,
                category: 'GENERAL',
                created_by: user.id,
                date: expenseDate
            })

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
            toast.success('Gasto registrado')
        },
        onError: (err: any) => {
            toast.error('Error al registrar gasto', { description: err.message })
        }
    })
}

export function useCreateInventoryPurchase() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (purchase: { ingredient_id: string, qty: number, total_price: number, description?: string }) => {
            const { organization_id, user } = await getOrCreateProfile(supabase)

            // Calculate exact description
            const desc = purchase.description || `Compra Inventario`

            console.log('Registering purchase:', { organization_id, user_id: user.id, ...purchase })

            // Call RPC function for atomic transaction

            const { error } = await supabase.rpc('register_inventory_purchase', {
                p_organization_id: organization_id,
                p_description: desc,
                p_amount: purchase.total_price,
                p_ingredient_id: purchase.ingredient_id,
                p_qty_bought: purchase.qty,
                p_user_id: user.id
            })

            if (error) {
                console.error('RPC Error:', error)
                throw error
            }

        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] }) // Update inventory list too
            toast.success('Compra registrada e inventario actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al registrar compra', { description: err.message })
        }
    })
}

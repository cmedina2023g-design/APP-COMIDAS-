import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { EmployeeMeal, EmployeeDailySummary, AllEmployeesSummary } from '@/lib/types'
import { toast } from 'sonner'
import { getOrCreateProfile } from '@/lib/auth-helpers'

// Record a meal for an employee
export function useRecordMeal() {
    const queryClient = useQueryClient()
    const supabase = createClient()

    return useMutation({
        mutationFn: async (params: {
            employee_id: string  // Now required for shared devices
            product_id: string
            quantity: number
            shift_id?: string | null
            session_id?: string | null
            notes?: string | null
        }) => {
            const { data, error } = await supabase.rpc('record_employee_meal', {
                p_employee_id: params.employee_id,
                p_product_id: params.product_id,
                p_quantity: params.quantity,
                p_shift_id: params.shift_id || null,
                p_session_id: params.session_id || null,
                p_notes: params.notes || null
            })

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee-meals-today'] })
            queryClient.invalidateQueries({ queryKey: ['employee-daily-summary'] })
            queryClient.invalidateQueries({ queryKey: ['all-employees-summary'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })

            toast.success('Comida registrada correctamente')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Error al registrar comida')
        }
    })
}

// Get today's meals for a specific employee
export function useEmployeeMealsToday(employeeId?: string) {
    const supabase = createClient()

    return useQuery<EmployeeMeal[]>({
        queryKey: ['employee-meals-today', employeeId],
        queryFn: async () => {
            if (!employeeId) return []

            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('employee_meals')
                .select(`
                    *,
                    product:products(*)
                `)
                .eq('employee_id', employeeId)
                .gte('consumed_at', `${today}T00:00:00`)
                .lte('consumed_at', `${today}T23:59:59`)
                .order('consumed_at', { ascending: false })

            if (error) throw error
            return data as EmployeeMeal[]
        },
        enabled: !!employeeId  // Only run if employeeId is provided
    })
}

// Get daily summary for an employee
export function useEmployeeDailySummary(date?: string) {
    const supabase = createClient()
    const targetDate = date || new Date().toISOString().split('T')[0]

    return useQuery<EmployeeDailySummary>({
        queryKey: ['employee-daily-summary', targetDate],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user found')

            const { data, error } = await supabase.rpc('get_employee_daily_summary', {
                p_employee_id: user.id,
                p_date: targetDate
            })

            if (error) throw error
            return data[0] as EmployeeDailySummary
        }
    })
}

// Get all employees summary (Admin only)
export function useAllEmployeesSummary(date?: string) {
    const supabase = createClient()
    const targetDate = date || new Date().toISOString().split('T')[0]

    return useQuery<AllEmployeesSummary[]>({
        queryKey: ['all-employees-summary', targetDate],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('get_all_employees_summary', {
                p_organization_id: organization_id,
                p_date: targetDate
            })

            if (error) throw error
            return data as AllEmployeesSummary[]
        }
    })
}

// Delete a meal (same day only)
export function useDeleteMeal() {
    const queryClient = useQueryClient()
    const supabase = createClient()

    return useMutation({
        mutationFn: async (mealId: string) => {
            const { error } = await supabase
                .from('employee_meals')
                .delete()
                .eq('id', mealId)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employee-meals-today'] })
            queryClient.invalidateQueries({ queryKey: ['employee-daily-summary'] })
            queryClient.invalidateQueries({ queryKey: ['all-employees-summary'] })
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })

            toast.success('Comida eliminada')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Error al eliminar comida')
        }
    })
}

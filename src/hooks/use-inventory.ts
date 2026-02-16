import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Ingredient } from '@/lib/types'
import { toast } from 'sonner'

export function useIngredients() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['ingredients'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ingredients')
                .select('*')
                .order('name')

            if (error) throw error
            return data as Ingredient[]
        }
    })
}

export function useIngredientCategories() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['ingredient-categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ingredients')
                .select('category')
                .not('category', 'is', null)

            if (error) throw error

            // Extract unique categories
            const categories = Array.from(new Set(data.map(i => i.category)))
            return categories.filter(Boolean).sort() as string[]
        }
    })
}

import { getOrCreateProfile } from '@/lib/auth-helpers'

export function useCreateIngredient() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (newIngredient: Omit<Ingredient, 'id' | 'organization_id' | 'created_at'>) => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.from('ingredients').insert({
                ...newIngredient,
                organization_id
            }).select().single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            toast.success('Insumo creado')
        },
        onError: (err: any) => {
            toast.error('Error al crear insumo', { description: err.message })
        }
    })
}

export function useUpdateIngredient() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Ingredient> & { id: string }) => {
            const { data, error } = await supabase.from('ingredients').update(updates).eq('id', id).select().single()
            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            toast.success('Insumo actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al actualizar', { description: err.message })
        }
    })
}

export function useDeleteIngredient() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('ingredients').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ingredients'] })
            toast.success('Insumo eliminado')
        },
        onError: (err: any) => {
            toast.error('Error al eliminar', { description: err.message })
        }
    })
}

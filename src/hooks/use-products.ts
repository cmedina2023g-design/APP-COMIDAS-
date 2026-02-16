import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductRecipe } from '@/lib/types'
import { toast } from 'sonner'

type ProductWithRecipes = Product & {
    recipes: (ProductRecipe & { ingredient_name: string })[]
}

export function useProducts() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            // Fetch products
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .order('name')

            if (error) throw error
            return products as Product[]
        }
    })
}

// Get products with calculated available units based on inventory
export function useProductsWithStock() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['products-with-stock'],
        queryFn: async () => {
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('get_products_with_available_units', {
                p_organization_id: organization_id
            })

            if (error) throw error
            return data as (Product & { available_units: number })[]
        }
    })
}

export function useCategories() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select('category')
                .not('category', 'is', null)

            if (error) throw error

            // Extract unique categories
            const categories = Array.from(new Set(data.map(p => p.category)))
            return categories.filter(Boolean).sort() as string[]
        }
    })
}

export function useProductWithRecipes(productId: string | null) {
    const supabase = createClient()
    return useQuery({
        queryKey: ['product', productId],
        queryFn: async () => {
            if (!productId) return null

            const { data: product, error: prodError } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single()

            if (prodError) throw prodError

            const { data: recipes, error: recError } = await supabase
                .from('product_recipes')
                .select('*, ingredients(name)')
                .eq('product_id', productId)

            if (recError) throw recError

            return {
                ...product,
                recipes: recipes.map(r => ({ ...r, ingredient_name: r.ingredients?.name }))
            }
        },
        enabled: !!productId
    })
}

import { getOrCreateProfile } from '@/lib/auth-helpers'

export function useCreateProduct() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ product, recipes }: { product: Omit<Product, 'id' | 'organization_id' | 'created_at'>, recipes: { ingredient_id: string, qty: number }[] }) => {
            const { organization_id } = await getOrCreateProfile(supabase)

            // 1. Create Product
            const { data: newDist, error: prodError } = await supabase.from('products').insert({
                ...product,
                organization_id
            }).select().single()

            if (prodError) throw prodError

            // 2. Create Recipes
            if (recipes.length > 0) {
                const recipeRows = recipes.map(r => ({
                    organization_id,
                    product_id: newDist.id,
                    ingredient_id: r.ingredient_id,
                    qty: r.qty
                }))

                const { error: recError } = await supabase.from('product_recipes').insert(recipeRows)
                if (recError) throw recError // TODO: rollback product?
            }

            return newDist
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            toast.success('Producto creado')
        },
        onError: (err: any) => {
            toast.error('Error al crear producto', { description: err.message })
        }
    })
}

export function useUpdateProduct() {
    const supabase = createClient()
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, product, recipes }: { id: string, product: Partial<Product>, recipes?: { ingredient_id: string, qty: number }[] }) => {
            const { error: prodError } = await supabase.from('products').update(product).eq('id', id)
            if (prodError) throw prodError

            if (recipes) {
                // Replace recipes logic: Delete old, Insert new
                await supabase.from('product_recipes').delete().eq('product_id', id)

                const { organization_id } = await getOrCreateProfile(supabase)

                if (recipes.length > 0) {
                    const recipeRows = recipes.map(r => ({
                        organization_id,
                        product_id: id,
                        ingredient_id: r.ingredient_id,
                        qty: r.qty
                    }))
                    await supabase.from('product_recipes').insert(recipeRows)
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            toast.success('Producto actualizado')
        },
        onError: (err: any) => {
            toast.error('Error al actualizar', { description: err.message })
        }
    })
}

export function useDeleteProduct() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('products').delete().eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            toast.success('Producto eliminado')
        }
    })
}

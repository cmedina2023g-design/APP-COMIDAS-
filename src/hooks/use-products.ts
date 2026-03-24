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
            const products = data as (Product & { available_units: number })[]

            // Fetch modifiers for all products
            const { data: modsData, error: modsErr } = await supabase
                .from('product_modifier_groups')
                .select(`
                    *,
                    modifiers:product_modifiers(
                        *,
                        recipes:modifier_recipes(
                            *,
                            ingredients(name)
                        )
                    )
                `)
                .order('order_index')

            if (modsErr) throw modsErr

            // Attach to products
            return products.map(p => ({
                ...p,
                modifier_groups: modsData.filter(m => m.product_id === p.id).map(group => ({
                    ...group,
                    modifiers: group.modifiers?.map((mod: any) => ({
                        ...mod,
                        recipes: mod.recipes?.map((r: any) => ({
                            ...r,
                            ingredient_name: r.ingredients?.name
                        }))
                    }))
                }))
            }))
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

// Fetches ALL recipes for ALL products in one query - used by the product list page
export function useAllProductRecipes() {
    const supabase = createClient()
    return useQuery({
        queryKey: ['all-product-recipes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_recipes')
                .select('product_id, qty, ingredient_id, ingredients(name, unit)')

            if (error) throw error

            // Group by product_id for easy lookup
            const byProduct: Record<string, { ingredient_id: string, name: string, unit: string, qty: number }[]> = {}
            for (const row of data ?? []) {
                if (!byProduct[row.product_id]) byProduct[row.product_id] = []
                const ing = row.ingredients as any
                byProduct[row.product_id].push({
                    ingredient_id: row.ingredient_id,
                    name: ing?.name ?? '?',
                    unit: ing?.unit ?? '',
                    qty: row.qty
                })
            }
            return byProduct
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

            // Fetch modifiers
            const { data: modifierGroups, error: modGroupsError } = await supabase
                .from('product_modifier_groups')
                .select(`
                    *,
                    modifiers:product_modifiers(
                        *,
                        recipes:modifier_recipes(
                            *,
                            ingredients(name)
                        )
                    )
                `)
                .eq('product_id', productId)
                .order('order_index')

            if (modGroupsError) throw modGroupsError

            return {
                ...product,
                recipes: recipes.map(r => ({ ...r, ingredient_name: r.ingredients?.name })),
                modifier_groups: modifierGroups.map(group => ({
                    ...group,
                    modifiers: group.modifiers?.map((mod: any) => ({
                        ...mod,
                        recipes: mod.recipes?.map((r: any) => ({
                            ...r,
                            ingredient_name: r.ingredients?.name
                        }))
                    }))
                }))
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
        mutationFn: async ({ product, recipes, modifier_groups }: {
            product: Omit<Product, 'id' | 'organization_id' | 'created_at'>,
            recipes: { ingredient_id: string, qty: number }[],
            modifier_groups?: any[]
        }) => {
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

            // 3. Create Modifiers
            if (modifier_groups && modifier_groups.length > 0) {
                for (let i = 0; i < modifier_groups.length; i++) {
                    const group = modifier_groups[i]
                    // Create group
                    const { data: groupData, error: groupErr } = await supabase
                        .from('product_modifier_groups')
                        .insert({
                            product_id: newDist.id,
                            name: group.name,
                            min_selections: group.min_selections,
                            max_selections: group.max_selections,
                            order_index: i
                        })
                        .select()
                        .single()

                    if (groupErr) {
                        console.error('Error creating modifier group:', groupErr)
                        throw groupErr
                    }

                    // Create modifiers for group
                    if (group.modifiers && group.modifiers.length > 0) {
                        for (let j = 0; j < group.modifiers.length; j++) {
                            const mod = group.modifiers[j]
                            const { data: modData, error: modErr } = await supabase
                                .from('product_modifiers')
                                .insert({
                                    group_id: groupData.id,
                                    name: mod.name,
                                    extra_price: mod.extra_price || 0,
                                    order_index: j
                                })
                                .select()
                                .single()

                            if (modErr) {
                                console.error('Error creating product modifier:', modErr)
                                throw modErr
                            }

                            const validRecipes = mod.recipes.filter((mr: any) => mr.ingredient_id && mr.ingredient_id !== '')
                            if (validRecipes.length > 0) {
                                const modRecipeRows = validRecipes.map((mr: any) => ({
                                    modifier_id: modData.id,
                                    ingredient_id: mr.ingredient_id,
                                    qty: mr.qty || 0
                                }))
                                const { error: mrErr } = await supabase.from('modifier_recipes').insert(modRecipeRows)
                                if (mrErr) {
                                    console.error('Error creating modifier recipe:', mrErr)
                                    throw mrErr
                                }
                            }
                        }
                    }
                }
            }

            return newDist
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['products-with-stock'] })
            queryClient.invalidateQueries({ queryKey: ['all-product-recipes'] })
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
        mutationFn: async ({ id, product, recipes, modifier_groups }: {
            id: string,
            product: Partial<Product>,
            recipes?: { ingredient_id: string, qty: number }[],
            modifier_groups?: any[]
        }) => {
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

            // Always recreate modifiers on update to handle complex changes easily
            // Note: In a production heavily-used system, diffing might be better, but delete+reinsert is safer for now.
            // But we can only do this if modifier_groups is explicitly passed in the update payload.
            if (modifier_groups) {
                // Delete old groups (cascades to modifiers and recipes)
                await supabase.from('product_modifier_groups').delete().eq('product_id', id)

                if (modifier_groups.length > 0) {
                    for (let i = 0; i < modifier_groups.length; i++) {
                        const group = modifier_groups[i]
                        // Create group
                        const { data: groupData, error: groupErr } = await supabase
                            .from('product_modifier_groups')
                            .insert({
                                product_id: id,
                                name: group.name,
                                min_selections: group.min_selections,
                                max_selections: group.max_selections,
                                order_index: i
                            })
                            .select()
                            .single()

                        if (groupErr) {
                            console.error('Error creating modifier group (Update):', groupErr)
                            throw groupErr
                        }

                        // Create modifiers for group
                        if (group.modifiers && group.modifiers.length > 0) {
                            for (let j = 0; j < group.modifiers.length; j++) {
                                const mod = group.modifiers[j]
                                const { data: modData, error: modErr } = await supabase
                                    .from('product_modifiers')
                                    .insert({
                                        group_id: groupData.id,
                                        name: mod.name,
                                        extra_price: mod.extra_price || 0,
                                        order_index: j
                                    })
                                    .select()
                                    .single()

                                if (modErr) {
                                    console.error('Error creating product modifier (Update):', modErr)
                                    throw modErr
                                }

                                // Create modifier recipes
                                const validRecipes = mod.recipes ? mod.recipes.filter((mr: any) => mr.ingredient_id && mr.ingredient_id !== '') : []
                                if (validRecipes.length > 0) {
                                    const modRecipeRows = validRecipes.map((mr: any) => ({
                                        modifier_id: modData.id,
                                        ingredient_id: mr.ingredient_id,
                                        qty: mr.qty || 0
                                    }))
                                    const { error: mrErr } = await supabase.from('modifier_recipes').insert(modRecipeRows)
                                    if (mrErr) {
                                        console.error('Error creating modifier recipe (Update):', mrErr)
                                        throw mrErr
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['products-with-stock'] })
            queryClient.invalidateQueries({ queryKey: ['all-product-recipes'] })
            queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
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
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['products-with-stock'] })
            queryClient.invalidateQueries({ queryKey: ['all-product-recipes'] })
            queryClient.invalidateQueries({ queryKey: ['product', id] })
            toast.success('Producto eliminado')
        }
    })
}

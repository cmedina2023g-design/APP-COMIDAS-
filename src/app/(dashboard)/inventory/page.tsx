'use client'

import React, { useState } from 'react'
import { useIngredients, useDeleteIngredient } from '@/hooks/use-inventory'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Trash2, AlertCircle, UtensilsCrossed } from 'lucide-react'
import Link from 'next/link'
import { IngredientDialog } from '@/components/inventory/ingredient-dialog'
import { BulkInventoryUpload } from '@/components/inventory/bulk-inventory-upload'
import { Ingredient } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

export default function InventoryPage() {
    const { data: ingredients, isLoading, error } = useIngredients()
    const deleteMutation = useDeleteIngredient()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
    const [search, setSearch] = useState('')

    const filteredIngredients = ingredients?.filter(ing =>
        ing.name.toLowerCase().includes(search.toLowerCase()) ||
        ing.category?.toLowerCase().includes(search.toLowerCase())
    )

    const handleEdit = (ing: Ingredient) => {
        setEditingIngredient(ing)
        setIsDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingIngredient(null)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este insumo?')) {
            await deleteMutation.mutateAsync(id)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Inventario</h2>
                    <p className="text-muted-foreground">Gestiona tus insumos y existencias.</p>
                </div>
                <div className="flex gap-2">
                    <BulkInventoryUpload onSuccess={() => window.location.reload()} />
                    <Link href="/inventory/audit">
                        <Button variant="outline">
                            <UtensilsCrossed className="mr-2 h-4 w-4" /> Realizar Auditoría
                        </Button>
                    </Link>
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Insumo
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar insumo..."
                            className="max-w-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-10">Cargando inventario...</div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500">Error al cargar datos</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Stock Actual</TableHead>
                                    <TableHead>Unidad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredIngredients?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No hay insumos registrados.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredIngredients?.map((ing) => (
                                    <TableRow key={ing.id}>
                                        <TableCell className="font-medium">{ing.name}</TableCell>
                                        <TableCell>{ing.category || '-'}</TableCell>
                                        <TableCell>
                                            <span className={ing.stock <= ing.min_stock ? 'text-red-600 font-bold flex items-center gap-1' : ''}>
                                                {ing.stock}
                                                {ing.stock <= ing.min_stock && <AlertCircle className="h-3 w-3" />}
                                            </span>
                                        </TableCell>
                                        <TableCell>{ing.unit}</TableCell>
                                        <TableCell>
                                            {ing.active ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(ing)}>
                                                <Edit className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(ing.id)}>
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <IngredientDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                ingredientToEdit={editingIngredient}
            />
        </div>
    )
}

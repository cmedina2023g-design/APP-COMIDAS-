'use client'

import React, { useState } from 'react'
import { useProducts, useDeleteProduct } from '@/hooks/use-products'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'
import { ProductDialog } from '@/components/products/product-dialog'
import { Product } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function ProductsPage() {
    const { data: products, isLoading, error } = useProducts()
    const deleteMutation = useDeleteProduct()

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [search, setSearch] = useState('')

    const filteredProducts = products?.filter(prod =>
        prod.name.toLowerCase().includes(search.toLowerCase()) ||
        prod.category?.toLowerCase().includes(search.toLowerCase())
    )

    const handleEdit = (prod: Product) => {
        setEditingProduct(prod)
        setIsDialogOpen(true)
    }

    const handleCreate = () => {
        setEditingProduct(null)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            await deleteMutation.mutateAsync(id)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Menú / Productos</h2>
                    <p className="text-muted-foreground">Administra lo que vendes y sus recetas.</p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar producto..."
                            className="max-w-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-10">Cargando menú...</div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500">Error al cargar datos</div>
                    ) : (
                        <Accordion type="multiple" className="space-y-4">
                            {Object.entries(
                                filteredProducts?.reduce((acc, prod) => {
                                    const cat = prod.category || 'Sin Categoría'
                                    if (!acc[cat]) acc[cat] = []
                                    acc[cat].push(prod)
                                    return acc
                                }, {} as Record<string, typeof products>) || {}
                            ).sort((a, b) => a[0].localeCompare(b[0])).map(([category, items]) => (
                                <AccordionItem key={category} value={category} className="border rounded-lg px-4 bg-card">
                                    <AccordionTrigger className="hover:no-underline py-3">
                                        <div className="flex items-center gap-4">
                                            <span className="font-semibold text-lg">{category}</span>
                                            <Badge variant="secondary" className="text-xs font-normal">
                                                {items.length} productos
                                            </Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[40%]">Nombre</TableHead>
                                                    <TableHead>Precio</TableHead>
                                                    <TableHead>Estado</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map((prod) => (
                                                    <TableRow key={prod.id}>
                                                        <TableCell className="font-medium">{prod.name}</TableCell>
                                                        <TableCell>${prod.price.toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            {prod.active ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                                                        </TableCell>
                                                        <TableCell className="text-right flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(prod)}>
                                                                <Edit className="h-4 w-4 text-blue-600" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(prod.id)}>
                                                                <Trash2 className="h-4 w-4 text-red-600" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}

                            {filteredProducts?.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground border rounded-lg">
                                    No se encontraron productos.
                                </div>
                            )}
                        </Accordion>
                    )}
                </CardContent>
            </Card>

            <ProductDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                productToEdit={editingProduct}
            />
        </div>
    )
}

'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Info, ClipboardList, Search } from 'lucide-react'
import { read, utils, write } from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Ingredient } from '@/lib/types'

type ParsedRow = {
    name: string
    quantity: number
    total_price: number
    category?: string
    unit?: string
    rowNumber: number
}

type UploadResult = {
    success: boolean
    ingredient_name: string
    was_created: boolean
    quantity: number | null
    error_message: string | null
}

type InAppCountRow = {
    id: string
    name: string
    unit: string
    category: string
    currentQty: number
    newQty: string // string para edición
}

export function BulkInventoryUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [tab, setTab] = useState<'excel' | 'app'>('app')

    // Excel tab state
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<ParsedRow[]>([])
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [results, setResults] = useState<UploadResult[]>([])
    const [downloadingTemplate, setDownloadingTemplate] = useState(false)

    // In-app count state
    const [ingredients, setIngredients] = useState<InAppCountRow[]>([])
    const [loadingIngredients, setLoadingIngredients] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
    const [savingCount, setSavingCount] = useState(false)

    const categories = useMemo(() => {
        const cats = Array.from(new Set(ingredients.map(i => i.category).filter(Boolean)))
        return ['Todos', ...cats.sort()]
    }, [ingredients])

    const filteredIngredients = useMemo(() => {
        return ingredients.filter(i => {
            const matchSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase())
            const matchCat = selectedCategory === 'Todos' || i.category === selectedCategory
            return matchSearch && matchCat
        })
    }, [ingredients, searchQuery, selectedCategory])

    const changedCount = useMemo(() => {
        return ingredients.filter(i => i.newQty !== '' && Number(i.newQty) !== i.currentQty).length
    }, [ingredients])

    const loadIngredients = async () => {
        setLoadingIngredients(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('ingredients')
                .select('id, name, unit, category, quantity')
                .order('category')
                .order('name')

            if (error) throw error

            setIngredients((data || []).map(i => ({
                id: i.id,
                name: i.name,
                unit: i.unit || 'und',
                category: i.category || 'General',
                currentQty: i.quantity ?? 0,
                newQty: ''
            })))
        } catch (err: any) {
            toast.error('Error al cargar insumos', { description: err.message })
        } finally {
            setLoadingIngredients(false)
        }
    }

    const handleQtyChange = (id: string, value: string) => {
        setIngredients(prev => prev.map(i => i.id === id ? { ...i, newQty: value } : i))
    }

    const handleSaveInApp = async () => {
        const toUpdate = ingredients.filter(i => i.newQty !== '' && !isNaN(Number(i.newQty)) && Number(i.newQty) >= 0)
        if (toUpdate.length === 0) {
            toast.warning('No hay cambios para guardar')
            return
        }

        setSavingCount(true)
        try {
            const supabase = createClient()
            const { organization_id } = await getOrCreateProfile(supabase)

            const items = toUpdate.map(i => ({
                name: i.name,
                quantity: Number(i.newQty),
                total_price: 0,
                category: i.category,
                unit: i.unit
            }))

            const { data, error } = await supabase.rpc('upload_physical_count', {
                p_organization_id: organization_id,
                p_items: items
            })

            if (error) throw error

            const successCount = (data as UploadResult[]).filter(r => r.success).length
            toast.success(`✅ ${successCount} insumos actualizados`)
            onSuccess?.()
            // Reset new quantities
            setIngredients(prev => prev.map(i => ({
                ...i,
                currentQty: i.newQty !== '' && !isNaN(Number(i.newQty)) ? Number(i.newQty) : i.currentQty,
                newQty: ''
            })))
        } catch (err: any) {
            toast.error('Error al guardar', { description: err.message })
        } finally {
            setSavingCount(false)
        }
    }

    // Excel download: fetch real ingredients from DB
    const downloadTemplate = async () => {
        setDownloadingTemplate(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('ingredients')
                .select('name, category, unit, quantity')
                .order('category')
                .order('name')

            if (error) throw error

            if (!data || data.length === 0) {
                toast.warning('No hay insumos registrados aún')
                return
            }

            const template = data.map(i => ({
                'Ingrediente': i.name,
                'Cantidad NUEVA': '',           // <-- el trabajador llena esto
                'Unidad': i.unit || 'und',
                'Categoría': i.category || 'General',
                'Stock Actual': i.quantity ?? 0  // referencia, para que vean cuánto hay
            }))

            const worksheet = utils.json_to_sheet(template)

            // Widen columns
            worksheet['!cols'] = [
                { wch: 30 }, // Ingrediente
                { wch: 18 }, // Cantidad NUEVA
                { wch: 10 }, // Unidad
                { wch: 18 }, // Categoría
                { wch: 14 }, // Stock Actual
            ]

            const workbook = utils.book_new()
            utils.book_append_sheet(workbook, worksheet, 'Inventario')

            const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' })
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `conteo_inventario_${new Date().toISOString().split('T')[0]}.xlsx`
            link.click()
            URL.revokeObjectURL(url)

            toast.success(`✅ Excel descargado con ${data.length} insumos`)
        } catch (err: any) {
            toast.error('Error al descargar plantilla', { description: err.message })
        } finally {
            setDownloadingTemplate(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        setFile(selectedFile)
        setValidationErrors([])
        setResults([])

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const data = event.target?.result
                const workbook = read(data, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const jsonData = utils.sheet_to_json(worksheet) as any[]

                const errors: string[] = []
                const parsed: ParsedRow[] = []

                jsonData.forEach((row, index) => {
                    const rowNum = index + 2

                    const name = row['Ingrediente'] ? String(row['Ingrediente']).trim() : ''
                    if (!name) {
                        errors.push(`Fila ${rowNum}: Falta el nombre del ingrediente`)
                        return
                    }

                    // Accept "Cantidad NUEVA" (from pre-filled template) OR "Cantidad"
                    const rawQty = row['Cantidad NUEVA'] ?? row['Cantidad']
                    if (rawQty === undefined || rawQty === '') {
                        errors.push(`Fila ${rowNum}: "${name}" — falta la cantidad`)
                        return
                    }

                    const quantity = Number(rawQty)
                    if (isNaN(quantity)) {
                        errors.push(`Fila ${rowNum}: "${name}" — cantidad inválida`)
                        return
                    }
                    if (quantity < 0) {
                        errors.push(`Fila ${rowNum}: "${name}" — cantidad no puede ser negativa`)
                        return
                    }

                    const totalPrice = row['Precio Total'] !== undefined && row['Precio Total'] !== '' ? Number(row['Precio Total']) : 0

                    parsed.push({
                        name,
                        quantity,
                        total_price: isNaN(totalPrice) ? 0 : totalPrice,
                        category: row['Categoría'] ? String(row['Categoría']).trim() : undefined,
                        unit: row['Unidad'] ? String(row['Unidad']).trim() : undefined,
                        rowNumber: rowNum
                    })
                })

                setValidationErrors(errors)
                setParsedData(parsed)

                if (parsed.length > 0 && errors.length === 0) {
                    toast.success(`✅ ${parsed.length} insumos listos para subir`)
                }
            } catch {
                toast.error('Error al leer el archivo', {
                    description: 'Asegúrate de que sea un archivo Excel válido (.xlsx)'
                })
            }
        }
        reader.readAsBinaryString(selectedFile)
    }

    const handleUpload = async () => {
        if (parsedData.length === 0) return

        setUploading(true)
        try {
            const supabase = createClient()
            const { organization_id } = await getOrCreateProfile(supabase)

            const { data, error } = await supabase.rpc('upload_physical_count', {
                p_organization_id: organization_id,
                p_items: parsedData as any
            })

            if (error) throw error

            setResults(data as UploadResult[])

            const successCount = data.filter((r: UploadResult) => r.success).length
            const createdCount = data.filter((r: UploadResult) => r.was_created).length
            const errorCount = data.length - successCount

            if (errorCount === 0) {
                toast.success(`✅ Inventario actualizado`, {
                    description: `${successCount} insumos${createdCount > 0 ? ` (${createdCount} nuevos)` : ''}`
                })
                onSuccess?.()
                setTimeout(() => setOpen(false), 2000)
            } else {
                toast.warning(`⚠️ ${successCount} actualizados, ${errorCount} con errores`)
            }
        } catch (error: any) {
            toast.error('Error al actualizar inventario', { description: error.message })
        } finally {
            setUploading(false)
        }
    }

    const resetForm = () => {
        setFile(null)
        setParsedData([])
        setValidationErrors([])
        setResults([])
        setIngredients([])
        setSearchQuery('')
        setSelectedCategory('Todos')
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            resetForm()
        } else {
            // Auto-load ingredients for in-app tab
            loadIngredients()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Subir Conteo
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Conteo Físico de Inventario</DialogTitle>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => setTab(v as 'excel' | 'app')}>
                    <TabsList className="w-full">
                        <TabsTrigger value="app" className="flex-1 gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Contar en la App
                        </TabsTrigger>
                        <TabsTrigger value="excel" className="flex-1 gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Subir Excel
                        </TabsTrigger>
                    </TabsList>

                    {/* ── IN-APP TAB ─────────────────────────────────── */}
                    <TabsContent value="app" className="space-y-3 mt-4">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                Escribe la <strong>cantidad actual</strong> de cada insumo. Deja en blanco los que no vayas a actualizar.
                            </AlertDescription>
                        </Alert>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar insumo..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <div className="flex gap-1 flex-wrap">
                                {categories.map(cat => (
                                    <Button
                                        key={cat}
                                        size="sm"
                                        variant={selectedCategory === cat ? 'default' : 'outline'}
                                        onClick={() => setSelectedCategory(cat)}
                                        className="text-xs h-8"
                                    >
                                        {cat}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {loadingIngredients ? (
                            <div className="text-center py-8 text-muted-foreground">Cargando insumos...</div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted sticky top-0">
                                        <tr>
                                            <th className="text-left p-2 font-semibold">Insumo</th>
                                            <th className="text-center p-2 font-semibold">Categoría</th>
                                            <th className="text-right p-2 font-semibold">Stock Actual</th>
                                            <th className="text-right p-2 font-semibold w-32">Cantidad Nueva</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredIngredients.map((ing) => {
                                            const hasChange = ing.newQty !== '' && Number(ing.newQty) !== ing.currentQty
                                            return (
                                                <tr key={ing.id} className={`border-t ${hasChange ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                                                    <td className="p-2 font-medium">{ing.name}</td>
                                                    <td className="p-2 text-center">
                                                        <Badge variant="outline" className="text-xs">{ing.category}</Badge>
                                                    </td>
                                                    <td className="p-2 text-right text-muted-foreground">
                                                        {ing.currentQty.toLocaleString()} {ing.unit}
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            placeholder="—"
                                                            value={ing.newQty}
                                                            onChange={e => handleQtyChange(ing.id, e.target.value)}
                                                            className="w-28 text-right h-8 ml-auto"
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                                {filteredIngredients.length === 0 && (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        No se encontraron insumos
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                            <span className="text-sm text-muted-foreground">
                                {changedCount > 0 ? (
                                    <span className="text-blue-600 font-medium">{changedCount} insumo(s) modificado(s)</span>
                                ) : 'Sin cambios aún'}
                            </span>
                            <Button
                                onClick={handleSaveInApp}
                                disabled={savingCount || changedCount === 0}
                                className="gap-2"
                            >
                                {savingCount ? 'Guardando...' : `Guardar ${changedCount > 0 ? changedCount : ''} Cambios`}
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ── EXCEL TAB ──────────────────────────────────── */}
                    <TabsContent value="excel" className="space-y-4 mt-4">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                <div className="font-semibold mb-1">¿Cómo usar el Excel?</div>
                                <ol className="text-xs space-y-1 list-decimal list-inside">
                                    <li>Descarga la plantilla — ya viene con todos tus insumos y su stock actual</li>
                                    <li>Llena la columna <strong>"Cantidad NUEVA"</strong> con lo que contaste</li>
                                    <li>Sube el archivo y confirma la actualización</li>
                                </ol>
                            </AlertDescription>
                        </Alert>

                        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
                            <div>
                                <h4 className="font-semibold text-sm">Descargar Plantilla con tus Insumos</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">Se descarga con los nombres, categorías y stock actual. Solo llena la "Cantidad NUEVA".</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={downloadingTemplate} className="gap-2 shrink-0">
                                <Download className="h-4 w-4" />
                                {downloadingTemplate ? 'Descargando...' : 'Descargar'}
                            </Button>
                        </div>

                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="excel-upload"
                            />
                            <label htmlFor="excel-upload" className="cursor-pointer">
                                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">
                                    {file ? file.name : 'Seleccionar archivo Excel'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">Haz clic para seleccionar el archivo</p>
                            </label>
                        </div>

                        {validationErrors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="font-semibold mb-2">Errores ({validationErrors.length}):</div>
                                    <ul className="list-disc list-inside text-xs space-y-1 max-h-32 overflow-y-auto">
                                        {validationErrors.map((error, i) => (
                                            <li key={i}>{error}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {parsedData.length > 0 && validationErrors.length === 0 && !results.length && (
                            <div>
                                <h4 className="font-semibold mb-2">Vista Previa — {parsedData.length} insumos</h4>
                                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="text-left p-2">Ingrediente</th>
                                                <th className="text-center p-2">Categoría</th>
                                                <th className="text-center p-2">Unidad</th>
                                                <th className="text-right p-2">Cantidad Nueva</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.map((row, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2 font-medium">{row.name}</td>
                                                    <td className="p-2 text-center">
                                                        {row.category ? (
                                                            <Badge variant="outline" className="text-xs">{row.category}</Badge>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <Badge variant="secondary" className="text-xs">{row.unit || '-'}</Badge>
                                                    </td>
                                                    <td className="p-2 text-right font-semibold">{row.quantity.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Resultados</h4>
                                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="text-left p-2">Estado</th>
                                                <th className="text-left p-2">Ingrediente</th>
                                                <th className="text-right p-2">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((result, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2">
                                                        {result.success ? (
                                                            <div className="flex items-center gap-1">
                                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                                {result.was_created && (
                                                                    <Badge variant="secondary" className="text-xs">Nuevo</Badge>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                                        )}
                                                    </td>
                                                    <td className="p-2">
                                                        {result.ingredient_name}
                                                        {result.error_message && (
                                                            <div className="text-xs text-red-600">{result.error_message}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right font-semibold">
                                                        {result.quantity?.toLocaleString() ?? '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {parsedData.length > 0 && validationErrors.length === 0 && !results.length && (
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                                <Button onClick={handleUpload} disabled={uploading}>
                                    {uploading ? 'Subiendo...' : `Subir ${parsedData.length} Insumos`}
                                </Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

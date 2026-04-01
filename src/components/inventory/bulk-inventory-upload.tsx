'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Upload, Download, FileSpreadsheet, AlertCircle,
    CheckCircle2, Info, ClipboardList, Search, Save, RefreshCw, X, Plus, ChevronUp
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { read, utils, write } from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

// ── Types ──────────────────────────────────────────────────────────────────
type IngredientRow = {
    id: string
    name: string
    unit: string
    category: string
    stock: number        // stock actual en BD (columna: stock)
    cost_unit: number    // precio/unidad en BD (columna: cost_unit)
    newStock: string
    newCostUnit: string
}

type ParsedExcelRow = {
    name: string
    quantity: number
    cost_unit: number
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

// ══════════════════════════════════════════════════════════════════════════
// SUB-MODAL: Conteo en App (pantalla completa)
// ══════════════════════════════════════════════════════════════════════════
const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'und', 'lb', 'oz', 'paq', 'caja', 'rollo']

function InAppCountModal({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [ingredients, setIngredients] = useState<IngredientRow[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('Todos')

    // ── New ingredient form ─────────────────────────────────────────────
    const [showAddForm, setShowAddForm] = useState(false)
    const [creatingIngredient, setCreatingIngredient] = useState(false)
    const [newIng, setNewIng] = useState({
        name: '',
        unit: 'und',
        category: '',
        stock: '',
        cost_unit: '',
    })

    const categories = useMemo(() => {
        const cats = Array.from(new Set(ingredients.map(i => i.category).filter(Boolean)))
        return ['Todos', ...cats.sort()]
    }, [ingredients])

    const filtered = useMemo(() => {
        return ingredients.filter(i => {
            const matchSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase())
            const matchCat = selectedCategory === 'Todos' || i.category === selectedCategory
            return matchSearch && matchCat
        })
    }, [ingredients, searchQuery, selectedCategory])

    const changedCount = useMemo(() => {
        return ingredients.filter(i => i.newStock !== '' || i.newCostUnit !== '').length
    }, [ingredients])

    const loadIngredients = async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('ingredients')
                .select('id, name, unit, category, stock, cost_unit')
                .eq('active', true)
                .order('category')
                .order('name')

            if (error) throw error

            setIngredients((data || []).map(i => ({
                id: i.id,
                name: i.name,
                unit: i.unit || 'und',
                category: i.category || 'General',
                stock: Number(i.stock ?? 0),
                cost_unit: Number(i.cost_unit ?? 0),
                newStock: '',
                newCostUnit: ''
            })))
        } catch (err: any) {
            toast.error('Error al cargar insumos', { description: err.message })
        } finally {
            setLoading(false)
        }
    }

    const handleField = (id: string, field: 'newStock' | 'newCostUnit', value: string) => {
        setIngredients(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
    }

    const handleCreateIngredient = async () => {
        if (!newIng.name.trim()) { toast.warning('El nombre es obligatorio'); return }
        if (!newIng.unit) { toast.warning('La unidad es obligatoria'); return }

        setCreatingIngredient(true)
        try {
            const supabase = createClient()
            const { organization_id } = await getOrCreateProfile(supabase)

            const { error } = await supabase.from('ingredients').insert({
                organization_id,
                name: newIng.name.trim(),
                unit: newIng.unit,
                category: newIng.category.trim() || null,
                stock: newIng.stock !== '' ? Number(newIng.stock) : 0,
                cost_unit: newIng.cost_unit !== '' ? Number(newIng.cost_unit) : 0,
                min_stock: 0,
                active: true
            })

            if (error) throw error

            toast.success(`✅ Insumo "${newIng.name.trim()}" creado`)
            setNewIng({ name: '', unit: 'und', category: '', stock: '', cost_unit: '' })
            setShowAddForm(false)
            await loadIngredients()
            onSuccess?.()
        } catch (err: any) {
            toast.error('Error al crear insumo', { description: err.message })
        } finally {
            setCreatingIngredient(false)
        }
    }

    const handleSave = async () => {
        const toUpdate = ingredients.filter(i =>
            (i.newStock !== '' && !isNaN(Number(i.newStock)) && Number(i.newStock) >= 0) ||
            (i.newCostUnit !== '' && !isNaN(Number(i.newCostUnit)) && Number(i.newCostUnit) >= 0)
        )
        if (toUpdate.length === 0) { toast.warning('Sin cambios para guardar'); return }

        setSaving(true)
        try {
            const supabase = createClient()
            const updates = toUpdate.map(i => {
                const patch: Record<string, number> = {}
                if (i.newStock !== '' && !isNaN(Number(i.newStock))) patch.stock = Number(i.newStock)
                if (i.newCostUnit !== '' && !isNaN(Number(i.newCostUnit))) patch.cost_unit = Number(i.newCostUnit)
                return supabase.from('ingredients').update(patch).eq('id', i.id)
            })

            const settled = await Promise.allSettled(updates)
            const failed = settled.filter(r => r.status === 'rejected').length
            const success = settled.length - failed

            if (failed === 0) {
                toast.success(`✅ ${success} insumo(s) actualizados`)
                onSuccess?.()
                await loadIngredients()
            } else {
                toast.warning(`⚠️ ${success} actualizados, ${failed} con error`)
            }
        } catch (err: any) {
            toast.error('Error al guardar', { description: err.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadIngredients() }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Contar en la App
                </Button>
            </DialogTrigger>

            {/* FULL-SCREEN MODAL */}
            <DialogContent className="!max-w-none w-screen h-screen max-h-screen rounded-none flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="flex-none px-6 py-4 border-b bg-background">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold">Conteo Físico de Inventario</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Escribe el stock físico que contaste y/o el precio por unidad. Solo se guardan los campos que edites.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {changedCount > 0 && (
                                <span className="text-sm font-semibold text-blue-600">
                                    {changedCount} insumo(s) con cambios
                                </span>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => setShowAddForm(v => !v)}
                                className="gap-2"
                            >
                                {showAddForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {showAddForm ? 'Cancelar' : 'Agregar Insumo'}
                            </Button>
                            <Button onClick={handleSave} disabled={saving || changedCount === 0} className="gap-2">
                                <Save className="h-4 w-4" />
                                {saving ? 'Guardando...' : `Guardar (${changedCount})`}
                            </Button>
                        </div>
                    </div>

                    {/* ── Formulario Agregar Insumo ──── */}
                    {showAddForm && (
                        <div className="mt-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <h3 className="font-semibold text-sm text-green-800 dark:text-green-300 mb-3">Nuevo Insumo</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="lg:col-span-2">
                                    <Label className="text-xs">Nombre *</Label>
                                    <Input
                                        placeholder="Ej: Queso tajado"
                                        value={newIng.name}
                                        onChange={e => setNewIng(p => ({ ...p, name: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Unidad *</Label>
                                    <Select value={newIng.unit} onValueChange={v => setNewIng(p => ({ ...p, unit: v }))}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMMON_UNITS.map(u => (
                                                <SelectItem key={u} value={u}>{u}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Categoría</Label>
                                    <Input
                                        placeholder="Ej: Lácteos"
                                        value={newIng.category}
                                        onChange={e => setNewIng(p => ({ ...p, category: e.target.value }))}
                                        className="mt-1"
                                        list="category-suggestions"
                                    />
                                    <datalist id="category-suggestions">
                                        {categories.filter(c => c !== 'Todos').map(c => (
                                            <option key={c} value={c} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <Label className="text-xs">Stock Inicial</Label>
                                    <Input
                                        type="number" min={0} placeholder="0"
                                        value={newIng.stock}
                                        onChange={e => setNewIng(p => ({ ...p, stock: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Precio / Unidad</Label>
                                    <Input
                                        type="number" min={0} placeholder="0"
                                        value={newIng.cost_unit}
                                        onChange={e => setNewIng(p => ({ ...p, cost_unit: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end mt-3">
                                <Button
                                    onClick={handleCreateIngredient}
                                    disabled={creatingIngredient || !newIng.name.trim()}
                                    className="gap-2 bg-green-700 hover:bg-green-800 text-white"
                                >
                                    <Plus className="h-4 w-4" />
                                    {creatingIngredient ? 'Creando...' : 'Crear Insumo'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogHeader>

                {/* Filters */}
                <div className="flex-none px-6 py-3 border-b bg-muted/30 space-y-2">
                    <div className="flex gap-3 items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar insumo..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadIngredients}
                            disabled={loading}
                            className="gap-2 text-muted-foreground"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Recargar
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {filtered.length} insumo(s) • {ingredients.length} total
                        </span>
                    </div>

                    {/* Category pills */}
                    {categories.length > 1 && (
                        <div className="flex gap-2 flex-wrap">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        selectedCategory === cat
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-background border hover:border-primary/50 text-muted-foreground'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Table body — scrollable */}
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                            Cargando insumos...
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-muted/80 sticky top-0 z-10">
                                <tr className="border-b">
                                    <th className="text-left px-4 py-3 font-semibold w-[30%]">Insumo</th>
                                    <th className="text-left px-4 py-3 font-semibold w-[15%]">Categoría</th>
                                    <th className="text-center px-4 py-3 font-semibold w-[8%]">Unidad</th>
                                    <th className="text-right px-4 py-3 font-semibold w-[12%]">Stock Actual</th>
                                    <th className="text-right px-4 py-3 font-semibold w-[12%]">Precio / Unidad</th>
                                    <th className="text-right px-4 py-3 font-semibold w-[11%] text-blue-700 dark:text-blue-400">
                                        ✏️ Stock Nuevo
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold w-[12%] text-blue-700 dark:text-blue-400">
                                        ✏️ Precio/Unidad Nuevo
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((ing) => {
                                    const hasChange = ing.newStock !== '' || ing.newCostUnit !== ''
                                    return (
                                        <tr
                                            key={ing.id}
                                            className={`border-b transition-colors ${
                                                hasChange
                                                    ? 'bg-blue-50 dark:bg-blue-950/20'
                                                    : 'hover:bg-muted/30'
                                            }`}
                                        >
                                            <td className="px-4 py-3 font-medium">{ing.name}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="text-xs font-normal">
                                                    {ing.category}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">{ing.unit}</td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {ing.stock.toLocaleString('es-CO')}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                                                {ing.cost_unit > 0
                                                    ? `$${ing.cost_unit.toLocaleString('es-CO')}`
                                                    : <span className="text-slate-400">—</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    placeholder="—"
                                                    value={ing.newStock}
                                                    onChange={e => handleField(ing.id, 'newStock', e.target.value)}
                                                    className="w-32 text-right h-9 ml-auto border-blue-200 focus:border-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    placeholder="—"
                                                    value={ing.newCostUnit}
                                                    onChange={e => handleField(ing.id, 'newCostUnit', e.target.value)}
                                                    className="w-32 text-right h-9 ml-auto border-blue-200 focus:border-blue-500"
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground">
                            No se encontraron insumos
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-none px-6 py-3 border-t bg-background flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        Los campos en blanco no se modifican. Solo se actualizan los insumos que edites.
                    </p>
                    <Button onClick={handleSave} disabled={saving || changedCount === 0} size="lg" className="gap-2">
                        <Save className="h-4 w-4" />
                        {saving ? 'Guardando...' : `Guardar ${changedCount} cambio(s)`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: Wrapper with Excel upload + In-App trigger
// ══════════════════════════════════════════════════════════════════════════
export function BulkInventoryUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [excelOpen, setExcelOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<ParsedExcelRow[]>([])
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [results, setResults] = useState<UploadResult[]>([])
    const [downloadingTemplate, setDownloadingTemplate] = useState(false)

    const downloadTemplate = async () => {
        setDownloadingTemplate(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('ingredients')
                .select('name, category, unit, stock, cost_unit')
                .eq('active', true)
                .order('category')
                .order('name')

            if (error) throw error
            if (!data || data.length === 0) { toast.warning('No hay insumos registrados'); return }

            const rows = data.map(i => ({
                'Ingrediente': i.name,
                'Categoría': i.category || 'General',
                'Unidad': i.unit || 'und',
                'Stock Actual': Number(i.stock ?? 0),
                'Precio/Unidad Actual': Number(i.cost_unit ?? 0),
                'Stock NUEVO (llenar)': '',
                'Precio/Unidad NUEVO (opcional)': ''
            }))

            const ws = utils.json_to_sheet(rows)
            ws['!cols'] = [
                { wch: 34 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 28 }
            ]
            const wb = utils.book_new()
            utils.book_append_sheet(wb, ws, 'Inventario')
            const buf = write(wb, { bookType: 'xlsx', type: 'array' })
            const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
            const a = document.createElement('a')
            a.href = url
            a.download = `conteo_inventario_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
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
                const workbook = read(event.target?.result, { type: 'binary' })
                const jsonData = utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[]
                const errors: string[] = []
                const parsed: ParsedExcelRow[] = []

                jsonData.forEach((row, index) => {
                    const name = row['Ingrediente'] ? String(row['Ingrediente']).trim() : ''
                    if (!name) return
                    const rawQty = row['Stock NUEVO (llenar)'] ?? row['Cantidad NUEVA'] ?? row['Cantidad']
                    if (rawQty === undefined || rawQty === '') return
                    const qty = Number(rawQty)
                    if (isNaN(qty) || qty < 0) { errors.push(`Fila ${index + 2}: "${name}" — cantidad inválida`); return }
                    const rawCost = row['Precio/Unidad NUEVO (opcional)'] ?? row['Precio Total'] ?? ''
                    const cost = rawCost !== '' ? Number(rawCost) : 0
                    parsed.push({ name, quantity: qty, cost_unit: isNaN(cost) ? 0 : cost, category: row['Categoría'], unit: row['Unidad'], rowNumber: index + 2 })
                })

                setValidationErrors(errors)
                setParsedData(parsed)
                if (parsed.length > 0 && errors.length === 0) toast.success(`✅ ${parsed.length} insumos listos`)
                else if (parsed.length === 0 && errors.length === 0) toast.warning('No hay filas con "Stock NUEVO" llenado')
            } catch {
                toast.error('Error al leer el archivo')
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
            const items = parsedData.map(r => ({
                name: r.name,
                quantity: r.quantity,
                total_price: r.cost_unit > 0 ? r.cost_unit * r.quantity : 0,
                category: r.category,
                unit: r.unit
            }))
            const { data, error } = await supabase.rpc('upload_physical_count', { p_organization_id: organization_id, p_items: items })
            if (error) throw error
            setResults(data as UploadResult[])
            const successCount = (data as UploadResult[]).filter(r => r.success).length
            const errorCount = data.length - successCount
            if (errorCount === 0) {
                toast.success('✅ Inventario actualizado', { description: `${successCount} insumos` })
                onSuccess?.()
                setTimeout(() => setExcelOpen(false), 2000)
            } else {
                toast.warning(`⚠️ ${successCount} actualizados, ${errorCount} con errores`)
            }
        } catch (err: any) {
            toast.error('Error al actualizar inventario', { description: err.message })
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex gap-2">
            {/* In-App count (full-screen modal) */}
            <InAppCountModal onSuccess={onSuccess} />

            {/* Excel upload modal */}
            <Dialog open={excelOpen} onOpenChange={(v) => { setExcelOpen(v); if (!v) { setFile(null); setParsedData([]); setResults([]) } }}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Subir Excel
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Subir Conteo por Excel</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                <ol className="text-xs list-decimal list-inside space-y-1">
                                    <li>Descarga la plantilla — ya trae todos tus insumos con stock actual</li>
                                    <li>Llena solo <strong>"Stock NUEVO"</strong> y opcionalmente "Precio/Unidad NUEVO"</li>
                                    <li>Sube el archivo aquí</li>
                                </ol>
                            </AlertDescription>
                        </Alert>

                        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
                            <div>
                                <h4 className="font-semibold text-sm">Descargar Plantilla con tus Insumos</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">Incluye nombres, categorías, stock y precio actuales.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={downloadingTemplate} className="gap-2 shrink-0">
                                <Download className="h-4 w-4" />
                                {downloadingTemplate ? 'Descargando...' : 'Descargar'}
                            </Button>
                        </div>

                        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="excel-upload-main" />
                            <label htmlFor="excel-upload-main" className="cursor-pointer block">
                                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">{file ? file.name : 'Haz clic para seleccionar el Excel'}</p>
                                {!file && <p className="text-xs text-muted-foreground mt-1">Formato .xlsx</p>}
                            </label>
                        </div>

                        {validationErrors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <div className="font-semibold mb-1">Errores ({validationErrors.length}):</div>
                                    <ul className="list-disc list-inside text-xs space-y-1 max-h-24 overflow-y-auto">
                                        {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        {parsedData.length > 0 && validationErrors.length === 0 && !results.length && (
                            <>
                                <div>
                                    <h4 className="font-semibold mb-2">Vista Previa — {parsedData.length} insumos</h4>
                                    <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted sticky top-0">
                                                <tr>
                                                    <th className="text-left p-2">Insumo</th>
                                                    <th className="text-center p-2">Cat.</th>
                                                    <th className="text-center p-2">Und.</th>
                                                    <th className="text-right p-2">Stock Nuevo</th>
                                                    <th className="text-right p-2">Precio/Und</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedData.map((row, i) => (
                                                    <tr key={i} className="border-t">
                                                        <td className="p-2 font-medium">{row.name}</td>
                                                        <td className="p-2 text-center text-xs">{row.category || '—'}</td>
                                                        <td className="p-2 text-center text-xs text-muted-foreground">{row.unit || '—'}</td>
                                                        <td className="p-2 text-right font-semibold">{row.quantity.toLocaleString('es-CO')}</td>
                                                        <td className="p-2 text-right">{row.cost_unit > 0 ? `$${row.cost_unit.toLocaleString('es-CO')}` : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={() => { setFile(null); setParsedData([]) }}>Cancelar</Button>
                                    <Button onClick={handleUpload} disabled={uploading}>
                                        {uploading ? 'Subiendo...' : `Confirmar ${parsedData.length} Insumos`}
                                    </Button>
                                </div>
                            </>
                        )}

                        {results.length > 0 && (
                            <div>
                                <h4 className="font-semibold mb-2">Resultados</h4>
                                <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted sticky top-0">
                                            <tr>
                                                <th className="text-left p-2">Estado</th>
                                                <th className="text-left p-2">Insumo</th>
                                                <th className="text-right p-2">Cantidad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((r, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2">
                                                        {r.success
                                                            ? <div className="flex gap-1 items-center"><CheckCircle2 className="h-4 w-4 text-green-600" />{r.was_created && <Badge variant="secondary" className="text-xs">Nuevo</Badge>}</div>
                                                            : <AlertCircle className="h-4 w-4 text-red-600" />
                                                        }
                                                    </td>
                                                    <td className="p-2">{r.ingredient_name}{r.error_message && <div className="text-xs text-red-600">{r.error_message}</div>}</td>
                                                    <td className="p-2 text-right font-semibold">{r.quantity?.toLocaleString('es-CO') ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

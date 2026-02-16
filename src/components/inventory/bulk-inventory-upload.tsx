'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { read, utils, write } from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateProfile } from '@/lib/auth-helpers'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

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

export function BulkInventoryUpload({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [parsedData, setParsedData] = useState<ParsedRow[]>([])
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [results, setResults] = useState<UploadResult[]>([])

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

                    if (!row['Ingrediente'] || String(row['Ingrediente']).trim() === '') {
                        errors.push(`Fila ${rowNum}: Falta el nombre del ingrediente`)
                        return
                    }
                    if (row['Cantidad'] === undefined || row['Cantidad'] === '') {
                        errors.push(`Fila ${rowNum}: Falta la cantidad`)
                        return
                    }
                    // Precio Total is OPTIONAL - defaults to 0

                    const quantity = Number(row['Cantidad'])
                    const totalPrice = row['Precio Total'] !== undefined && row['Precio Total'] !== '' ? Number(row['Precio Total']) : 0

                    if (isNaN(quantity)) {
                        errors.push(`Fila ${rowNum}: Cantidad debe ser un número`)
                        return
                    }
                    if (isNaN(totalPrice)) {
                        errors.push(`Fila ${rowNum}: Precio Total debe ser un número`)
                        return
                    }
                    if (quantity < 0) {
                        errors.push(`Fila ${rowNum}: Cantidad no puede ser negativa`)
                        return
                    }
                    if (totalPrice < 0) {
                        errors.push(`Fila ${rowNum}: Precio Total no puede ser negativo`)
                        return
                    }

                    parsed.push({
                        name: String(row['Ingrediente']).trim(),
                        quantity,
                        total_price: totalPrice,
                        category: row['Categoría'] ? String(row['Categoría']).trim() : undefined,
                        unit: row['Unidad'] ? String(row['Unidad']).trim() : undefined,
                        rowNumber: rowNum
                    })
                })

                setValidationErrors(errors)
                setParsedData(parsed)

                if (parsed.length > 0 && errors.length === 0) {
                    toast.success(`✅ ${parsed.length} ingredientes listos para subir`)
                }
            } catch (error) {
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
                    description: `${successCount} ingredientes${createdCount > 0 ? ` (${createdCount} nuevos)` : ''}`
                })
                onSuccess?.()
                setTimeout(() => setOpen(false), 2000)
            } else {
                toast.warning(`⚠️ ${successCount} actualizados, ${errorCount} con errores`)
            }
        } catch (error: any) {
            toast.error('Error al actualizar inventario', {
                description: error.message
            })
        } finally {
            setUploading(false)
        }
    }

    const downloadTemplate = () => {
        const template = [
            { Ingrediente: 'Papas', Cantidad: 5000, 'Precio Total': 10000, Categoría: 'Verduras', Unidad: 'g' },
            { Ingrediente: 'Pollo', Cantidad: 3000, 'Precio Total': 30000, Categoría: 'Proteínas', Unidad: 'g' },
            { Ingrediente: 'Aceite', Cantidad: 2000, 'Precio Total': 15000, Categoría: 'Aceites', Unidad: 'ml' }
        ]

        const worksheet = utils.json_to_sheet(template)
        const workbook = utils.book_new()
        utils.book_append_sheet(workbook, worksheet, 'Inventario')

        const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `inventario_${new Date().toISOString().split('T')[0]}.xlsx`
        link.click()
        URL.revokeObjectURL(url)
    }

    const resetForm = () => {
        setFile(null)
        setParsedData([])
        setValidationErrors([])
        setResults([])
    }

    return (
        <Dialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen)
            if (!newOpen) resetForm()
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Subir Conteo
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Subir Conteo Físico de Inventario</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            <div className="font-semibold mb-1">Formato simple:</div>
                            <p className="text-xs">Ingrediente | Cantidad | Precio Total | Categoría | Unidad</p>
                            <p className="text-xs text-muted-foreground mt-1">(Categoría y Unidad son opcionales - por defecto: General, g)</p>
                            <p className="text-xs mt-1">Si el ingrediente no existe, se crea automáticamente ✨</p>
                        </AlertDescription>
                    </Alert>

                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border">
                        <div>
                            <h4 className="font-semibold text-sm">Descargar Plantilla</h4>
                            <p className="text-xs text-muted-foreground">Excel con formato correcto</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                            <Download className="h-4 w-4" />
                            Descargar
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
                            <h4 className="font-semibold mb-2">Vista Previa - {parsedData.length} ingredientes</h4>
                            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted sticky top-0">
                                        <tr>
                                            <th className="text-left p-2">Ingrediente</th>
                                            <th className="text-right p-2">Cantidad</th>
                                            <th className="text-center p-2">Unidad</th>
                                            <th className="text-right p-2">Precio Total</th>
                                            <th className="text-left p-2">Categoría</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.map((row, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2">{row.name}</td>
                                                <td className="p-2 text-right">{row.quantity.toLocaleString()}</td>
                                                <td className="p-2 text-center">
                                                    <Badge variant="secondary" className="text-xs">
                                                        {row.unit || 'g'}
                                                    </Badge>
                                                </td>
                                                <td className="p-2 text-right font-semibold">${row.total_price.toLocaleString()}</td>
                                                <td className="p-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {row.category || 'General'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-muted font-bold border-t-2">
                                        <tr>
                                            <td colSpan={4} className="p-2">TOTAL INVENTARIO</td>
                                            <td className="p-2 text-right">
                                                ${parsedData.reduce((sum, row) => sum + row.total_price, 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
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
                                {uploading ? 'Subiendo...' : `Subir ${parsedData.length} Ingredientes`}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

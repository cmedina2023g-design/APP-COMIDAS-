'use client'

import { useDailyProductSummary } from '@/hooks/use-sales'
import { Loader2, ScrollText, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function DailySalesWidget() {
    const { data: summary, isLoading, refetch } = useDailyProductSummary()

    return (
        <Card className="flex flex-col h-full shadow-md border-slate-200 bg-white">
            <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0 bg-slate-50/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                    <ScrollText className="h-4 w-4 text-blue-600" />
                    Resumen del Turno
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-slate-200"
                    onClick={() => refetch()}
                    title="Actualizar"
                >
                    <RefreshCw className="h-3 w-3 text-slate-500" />
                </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200">
                {isLoading ? (
                    <div className="flex justify-center items-center h-20">
                        <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
                    </div>
                ) : !summary || summary.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground px-4">
                        No hay ventas registradas hoy.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {summary.map((item, index) => (
                            <div key={`${item.name}-${index}`} className="py-2 px-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        {item.time}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-700 line-clamp-1" title={item.name}>
                                            {item.name}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {item.paymentMethod}
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full text-xs">
                                        x{item.qty}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

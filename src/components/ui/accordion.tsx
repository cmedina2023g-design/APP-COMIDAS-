"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Simple Context for the Accordion
type AccordionContextType = {
    activeItems: string[]
    toggleItem: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextType | null>(null)

// Simple Context for the Item to know its own value
const AccordionItemContext = React.createContext<string | null>(null)

const Accordion = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        type?: "single" | "multiple"
        defaultValue?: string | string[]
    }
>(({ className, type = "single", defaultValue, children, ...props }, ref) => {
    const [activeItems, setActiveItems] = React.useState<string[]>(() => {
        if (defaultValue) return Array.isArray(defaultValue) ? defaultValue : [defaultValue]
        return []
    })

    const toggleItem = React.useCallback((value: string) => {
        setActiveItems((prev) => {
            if (type === "multiple") {
                return prev.includes(value)
                    ? prev.filter((v) => v !== value)
                    : [...prev, value]
            } else {
                return prev.includes(value) ? [] : [value]
            }
        })
    }, [type])

    return (
        <AccordionContext.Provider value={{ activeItems, toggleItem }}>
            <div ref={ref} className={cn("", className)} {...props}>
                {children}
            </div>
        </AccordionContext.Provider>
    )
})
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, children, ...props }, ref) => {
    return (
        <AccordionItemContext.Provider value={value}>
            <div ref={ref} className={cn("border-b", className)} {...props}>
                {children}
            </div>
        </AccordionItemContext.Provider>
    )
})
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, onClick, ...props }, ref) => {
    const { activeItems, toggleItem } = React.useContext(AccordionContext)!
    const value = React.useContext(AccordionItemContext)!
    const isOpen = activeItems.includes(value)

    return (
        <div className="flex">
            <button
                ref={ref}
                onClick={(e) => {
                    toggleItem(value)
                    onClick?.(e)
                }}
                className={cn(
                    "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                    className
                )}
                data-state={isOpen ? "open" : "closed"}
                {...props}
            >
                {children}
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
            </button>
        </div>
    )
})
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const { activeItems } = React.useContext(AccordionContext)!
    const value = React.useContext(AccordionItemContext)!
    const isOpen = activeItems.includes(value)

    if (!isOpen) return null

    return (
        <div
            ref={ref}
            className={cn(
                "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
                className
            )}
            {...props}
        >
            <div className="pb-4 pt-0">{children}</div>
        </div>
    )
})
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }

export type Organization = {
    id: string
    name: string
}

export type Ingredient = {
    id: string
    organization_id: string
    name: string
    unit: string
    cost_unit: number
    stock: number
    min_stock: number
    category: string | null
    active: boolean
}

export type Product = {
    id: string
    organization_id: string
    name: string
    price: number
    category: string | null
    subcategory: string | null
    active: boolean
    image_url: string | null
}

export type ProductRecipe = {
    id: string
    product_id: string
    ingredient_id: string
    qty: number
}

export type Sale = {
    id: string
    total: number
    status: 'CONFIRMED' | 'VOID'
    created_at: string
    payment_method_id: string | null
    seller_id?: string
    session_id?: string
    shift_id?: string
}

export type SalePayment = {
    id: string
    sale_id: string
    payment_method_id: string
    amount: number
    created_at: string
}

export type Expense = {
    id: string
    organization_id: string
    description: string
    amount: number
    category: 'GENERAL' | 'INVENTORY'
    date: string
    ingredient_id: string | null
    qty_bought: number | null
    created_by: string
}

export type Profile = {
    id: string
    organization_id: string
    role: 'admin' | 'cashier' | 'runner'
    full_name: string | null
    active: boolean
    created_at: string
}

export type UserSession = {
    id: string
    user_id: string
    organization_id: string
    started_at: string
    ended_at: string | null
    device_info: string | null
    active: boolean
    terminated_by: string | null
    termination_reason: string | null
    user?: Profile
}

export type Shift = {
    id: string
    organization_id: string
    name: string
    start_time: string
    end_time: string
    active: boolean
}

export type RunnerInventoryAssignment = {
    id: string
    organization_id: string
    runner_id: string
    product_id: string
    assigned_qty: number
    returned_qty: number
    sold_qty: number
    assigned_at: string
    returned_at: string | null
    assigned_by: string | null
    shift_id: string | null
    assignment_date: string
    status: 'active' | 'closed' | 'cancelled'
    notes: string | null
    runner?: Profile
    product?: Product
}

export type EmployeeMeal = {
    id: string
    organization_id: string
    employee_id: string
    product_id: string
    quantity: number
    unit_price: number
    total_value: number
    consumed_at: string
    shift_id?: string | null
    session_id?: string | null
    notes?: string | null
    // Relations
    product?: Product
    employee?: Profile
}

export type EmployeeDailySummary = {
    employee_id: string
    employee_name: string
    total_sales: number
    total_meals: number
    meal_count: number
    meal_details: Array<{
        product_name: string
        quantity: number
        unit_price: number
        total_value: number
        consumed_at: string
    }>
    net_amount: number
}

export type AllEmployeesSummary = {
    employee_id: string
    employee_name: string
    role: string
    total_meals: number
    meal_count: number
    meal_details: Array<{
        product_name: string
        quantity: number
        unit_price: number
        total_value: number
        consumed_at: string
    }>
}

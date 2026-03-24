-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations (Multi-tenant root)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Profiles (Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'VENDEDOR')),
    full_name TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Ingredients (Inventory Items)
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- 'UNIDAD', 'GR', 'ML'
    cost_unit NUMERIC(10, 2) DEFAULT 0,
    stock NUMERIC(10, 2) DEFAULT 0,
    min_stock NUMERIC(10, 2) DEFAULT 0,
    category TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    ingredient_id UUID REFERENCES ingredients(id),
    type TEXT CHECK (type IN ('IN', 'OUT', 'ADJUST')),
    qty NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(10, 2),
    reason TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Products (Menu)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT,
    active BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Product Recipes (BOM)
CREATE TABLE IF NOT EXISTS product_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    qty NUMERIC(10, 2) NOT NULL -- Amount of ingredient per 1 unit of product
);

-- 8. Sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    seller_id UUID REFERENCES profiles(id),
    payment_method_id UUID REFERENCES payment_methods(id),
    total NUMERIC(10, 2) NOT NULL,
    status TEXT CHECK (status IN ('CONFIRMED', 'VOID')) DEFAULT 'CONFIRMED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    qty INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL
);

-- RLS Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Helper function to get org id
CREATE OR REPLACE FUNCTION get_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT organization_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple Org Policy
CREATE POLICY "Org Access" ON organizations FOR ALL USING (id = get_org_id());

-- Profiles
CREATE POLICY "Profile View" ON profiles FOR SELECT USING (organization_id = get_org_id() OR id = auth.uid());
-- Only admin can update profiles? For now let's keep it simple. User can update their own? 
-- Let's restrict edits to Admin later if needed, or self.

-- Ingredients
CREATE POLICY "Ingredients View" ON ingredients FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "Ingredients Edit" ON ingredients FOR ALL USING (organization_id = get_org_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('ADMIN', 'VENDEDOR')); 
-- Actually VENDEDOR probably shouldn't edit master data, but they need to do adjustments. 
-- Adjustments are via inventory_movements. 
-- Let's say ingredients master data is ADMIN only.
DROP POLICY IF EXISTS "Ingredients Edit" ON ingredients;
CREATE POLICY "Ingredients Edit" ON ingredients FOR ALL USING (organization_id = get_org_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');

-- Inventory Movements
CREATE POLICY "Inv Move View" ON inventory_movements FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "Inv Move Insert" ON inventory_movements FOR INSERT WITH CHECK (organization_id = get_org_id()); 

-- Products
CREATE POLICY "Products View" ON products FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "Products Edit" ON products FOR ALL USING (organization_id = get_org_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');

-- Product Recipes
CREATE POLICY "Recipes View" ON product_recipes FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "Recipes Edit" ON product_recipes FOR ALL USING (organization_id = get_org_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');

-- Sales
CREATE POLICY "Sales View" ON sales FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "Sales Insert" ON sales FOR INSERT WITH CHECK (organization_id = get_org_id()); 
-- Only ADMIN can VOID? We'll handle via update policy if needed.

-- Sale Items
CREATE POLICY "Sale Items View" ON sale_items FOR SELECT USING (sale_id IN (SELECT id FROM sales WHERE organization_id = get_org_id()));
CREATE POLICY "Sale Items Insert" ON sale_items FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM sales WHERE organization_id = get_org_id()));

-- Payment Methods
CREATE POLICY "Payment Methods View" ON payment_methods FOR SELECT USING (organization_id = get_org_id());
CREATE POLICY "Payment Methods Edit" ON payment_methods FOR ALL USING (organization_id = get_org_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');

-- TRIGGERS for Inventory Deduction
CREATE OR REPLACE FUNCTION process_sale()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    rec RECORD;
BEGIN
    -- For each item in the sale, find its recipe and deduct inventory
    -- NOTE: This trigger runs on sales INSERT presumably? No, usually on sale_items insert or sale confirmation update.
    -- Best pattern: Insert Sales + Items. Then if status is CONFIRMED, deduct.
    
    IF NEW.status = 'CONFIRMED' THEN
        -- Loop through sale items
        FOR item IN SELECT * FROM sale_items WHERE sale_id = NEW.id LOOP
            -- Loop through recipe ingredients for the product
            FOR rec IN SELECT * FROM product_recipes WHERE product_id = item.product_id LOOP
                -- Deduct stock
                UPDATE ingredients 
                SET stock = stock - (rec.qty * item.qty)
                WHERE id = rec.ingredient_id;
                
                -- Log movement (Automated)
                INSERT INTO inventory_movements (organization_id, ingredient_id, type, qty, reason, created_by)
                VALUES (NEW.organization_id, rec.ingredient_id, 'OUT', (rec.qty * item.qty), 'Venta #' || NEW.id, NEW.seller_id);
            END LOOP;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition
-- Assuming we insert sales with status 'CONFIRMED' immediately.
-- However, if we insert `sales` first, then `sale_items`, the trigger on `sales` (AFTER INSERT) won't see items yet!
-- Architecture fix:
-- 1. Insert Sale (status = PENDING)
-- 2. Insert Items
-- 3. Update Sale (status = CONFIRMED) -> Fires Trigger.

CREATE TRIGGER on_sale_confirm
AFTER UPDATE OF status ON sales
FOR EACH ROW
WHEN (OLD.status <> 'CONFIRMED' AND NEW.status = 'CONFIRMED')
EXECUTE FUNCTION process_sale();

-- Also handle implicit confirmation on insert if items are somehow there? 
-- No, transactionally we should do the Insert/Update pattern or use an RPC.
-- For simplicity in frontend, we will use RPC `create_sale` which does everything.

-- RPC: Create Sale
CREATE OR REPLACE FUNCTION create_sale(
    p_organization_id UUID,
    p_seller_id UUID,
    p_payment_method_id UUID,
    p_total NUMERIC,
    p_items JSONB -- Array of {product_id, qty, unit_price}
)
RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB; 
    v_rec RECORD;
    v_product_id UUID;
    v_qty INTEGER;
    v_price NUMERIC;
BEGIN
    -- 1. Insert Sale
    INSERT INTO sales (organization_id, seller_id, payment_method_id, total, status)
    VALUES (p_organization_id, p_seller_id, p_payment_method_id, p_total, 'CONFIRMED')
    RETURNING id INTO v_sale_id;

    -- 2. Insert Items and Deduct Inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'qty')::INTEGER;
        v_price := (v_item->>'unit_price')::NUMERIC;

        INSERT INTO sale_items (sale_id, product_id, qty, unit_price, subtotal)
        VALUES (v_sale_id, v_product_id, v_qty, v_price, v_qty * v_price);

        -- Deduct Inventory (Logic from Trigger moved here for atomicity)
        FOR v_rec IN SELECT * FROM product_recipes WHERE product_id = v_product_id LOOP
            UPDATE ingredients
            SET stock = stock - (v_rec.qty * v_qty)
            WHERE id = v_rec.ingredient_id;

            INSERT INTO inventory_movements (organization_id, ingredient_id, type, qty, reason, created_by)
            VALUES (p_organization_id, v_rec.ingredient_id, 'OUT', (v_rec.qty * v_qty), 'Venta', p_seller_id);
        END LOOP;
    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

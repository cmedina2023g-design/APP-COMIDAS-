-- Fix: create_sale RPC now processes modifier recipes for inventory deduction
-- and saves modifiers to sale_item_modifiers table.
-- Each item in p_items can now include: { product_id, qty, unit_price, modifiers: [{modifier_id, modifier_name, extra_price}] }

CREATE OR REPLACE FUNCTION create_sale(
    p_organization_id UUID,
    p_seller_id UUID,
    p_payments JSONB,
    p_total NUMERIC,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_modifier JSONB;
    v_rec RECORD;
    v_product_id UUID;
    v_qty INTEGER;
    v_price NUMERIC;
    v_sale_item_id UUID;
    v_payment JSONB;
BEGIN
    -- 1. Insert Sale
    INSERT INTO sales (organization_id, seller_id, total, status)
    VALUES (p_organization_id, p_seller_id, p_total, 'CONFIRMED')
    RETURNING id INTO v_sale_id;

    -- 2. Insert Payments
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        INSERT INTO sale_payments (sale_id, payment_method_id, amount)
        VALUES (
            v_sale_id,
            (v_payment->>'payment_method_id')::UUID,
            (v_payment->>'amount')::NUMERIC
        );
    END LOOP;

    -- 3. Insert Items, deduct base recipe, and process modifiers
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty        := (v_item->>'qty')::INTEGER;
        v_price      := (v_item->>'unit_price')::NUMERIC;

        -- Insert sale item
        INSERT INTO sale_items (sale_id, product_id, qty, unit_price, subtotal)
        VALUES (v_sale_id, v_product_id, v_qty, v_price, v_qty * v_price)
        RETURNING id INTO v_sale_item_id;

        -- Deduct BASE product recipe from inventory
        FOR v_rec IN SELECT * FROM product_recipes WHERE product_id = v_product_id LOOP
            UPDATE ingredients
            SET stock = stock - (v_rec.qty * v_qty)
            WHERE id = v_rec.ingredient_id;

            INSERT INTO inventory_movements (organization_id, ingredient_id, type, qty, reason, created_by)
            VALUES (p_organization_id, v_rec.ingredient_id, 'OUT', (v_rec.qty * v_qty), 'Venta', p_seller_id);
        END LOOP;

        -- 4. Process modifiers (if any)
        IF (v_item ? 'modifiers') AND jsonb_array_length(v_item->'modifiers') > 0 THEN
            FOR v_modifier IN SELECT * FROM jsonb_array_elements(v_item->'modifiers') LOOP

                -- Save modifier record
                INSERT INTO sale_item_modifiers (sale_item_id, modifier_id, modifier_name, extra_price)
                VALUES (
                    v_sale_item_id,
                    (v_modifier->>'modifier_id')::UUID,
                    v_modifier->>'modifier_name',
                    COALESCE((v_modifier->>'extra_price')::NUMERIC, 0)
                );

                -- Deduct modifier recipe from inventory
                FOR v_rec IN
                    SELECT mr.* FROM modifier_recipes mr
                    WHERE mr.modifier_id = (v_modifier->>'modifier_id')::UUID
                LOOP
                    UPDATE ingredients
                    SET stock = stock - (v_rec.qty * v_qty)
                    WHERE id = v_rec.ingredient_id;

                    INSERT INTO inventory_movements (organization_id, ingredient_id, type, qty, reason, created_by)
                    VALUES (p_organization_id, v_rec.ingredient_id, 'OUT', (v_rec.qty * v_qty), 'Venta (modificador)', p_seller_id);
                END LOOP;

            END LOOP;
        END IF;

    END LOOP;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

# Documentación Principal - Street Food POS

## 🎯 Objetivo de la Aplicación
**Street Food POS** es un sistema integral de Punto de Venta (POS) y administración diseñado específicamente para puestos de comidas rápidas y restaurantes ágiles. Su objetivo principal es centralizar la operación diaria de ventas, controlar estrictamente el inventario a través de recetas precisas, gestionar turnos de empleados de manera transparente y proporcionar reportes financieros detallados a los dueños y administradores.

El sistema fue construido para ser rápido, confiable (capaz de calcular y descontar múltiples ingredientes en tiempo real) y adaptable a cualquier dispositivo (computadores de escritorio, tablets y teléfonos móviles).

---

## 🚀 Características Principales

1. **Punto de Venta Ágil (POS)**: Una interfaz rápida para tomar pedidos. Soporta productos simples y productos complejos con modificadores (ej. "Arma tu Bowl" con múltiples bases y proteínas).
2. **Control de Inventario Basado en Recetas**: Cada vez que se vende un producto o se añade un extra, el sistema descuenta automáticamente los gramos/unidades exactas de los insumos según la receta configurada.
3. **Múltiples Roles de Usuario**: 
   - **Administrador (ADMIN)**: Acceso total a reportes, inventario crítico, creación de productos y anulación de ventas.
   - **Vendedor / Cajero (SELLER)**: Toma pedidos, genera cierres de caja y gestiona stock operativo.
   - **Corredor (RUNNER)**: Permisos limitados, orientado a despachos o entregas.
4. **Gestión de Turnos y Caja**: Las ventas se agrupan por "Turnos". El sistema hace el cuadre de caja (Efectivo, Transferencias, Créditos) por cada sesión activa.
5. **Cuentas por Cobrar (Cartera)**: Permite registrar ventas a crédito y liquidarlas posteriormente.
6. **Manejo de Modificadores (Novedad)**: Soporte profundo para grupos de modificadores (obligatorios u opcionales, con límites mínimos y máximos), donde cada opción descuenta su propia porción de inventario inteligente.

---

## 📂 Arquitectura y Estructura de Directorios

La aplicación está construida utilizando el stack **Next.js 14/15 (App Router)**, **React 18**, **Tailwind CSS**, **shadcn/ui**, **React Query (@tanstack/react-query)** y **Supabase** como backend asíncrono (Base de Datos PostgreSQL y Autenticación).

```text
app/
├── next.config.ts          # Configuración de Next.js. Turbopack desactivado para evitar fallos locales con espacios en ruta.
├── package.json            # Dependencias del proyecto.
├── supabase/               
│   └── migrations/         # Scripts en SQL puro que instancian la Base de Datos inicial (Tablas, Triggers, RPCs).
└── src/
    ├── app/                # Rutas de la Aplicación (Next.js App Router)
    │   ├── (auth)/         # Vistas sin sesión (ej. /login).
    │   └── (dashboard)/    # Vistas protegidas que cargan el layout principal.
    │       ├── admin/      # Historial de ventas y finanzas exclusivas del Administrador.
    │       ├── inventory/  # Tablas para revisar stock, reportar mermas y crear ingredientes.
    │       ├── pos/        # Pantalla central de Punto de Venta (Catálogo + Carrito + Widget de Turno).
    │       ├── products/   # CRUD de productos, recetas base y creación de Grupos Modificadores.
    │       ├── reports/    # Gráficos de tendencias y métricas financieras.
    │       └── settings/   # Configuración de empleados, turnos, roles.
    │
    ├── components/         # Componentes React Reutilizables organizados por dominio
    │   ├── admin/          # Ej. finance-dashboard.tsx, receivables-list.tsx
    │   ├── inventory/      # Ej. ingredient-dialog.tsx, bulk-inventory-upload.tsx
    │   ├── pos/            # Ej. cart-sidebar.tsx, product-grid.tsx, product-options-modal.tsx
    │   ├── products/       # Ej. product-dialog.tsx (Gestión de Recetas y Modificadores)
    │   └── ui/             # Componentes base del sistema de diseño (Botones, Inputs, Modales de shadcn).
    │
    ├── hooks/              # Lógica de Datos y Caché (React Query)
    │   ├── use-inventory.ts# Hooks para cargar insumos y registrar movimientos/mermas.
    │   ├── use-products.ts # Hooks para guardar recetas y modificadores.
    │   ├── use-sales.ts    # Lógica de procesamiento complejo: guardar venta e iterar el carrito, anular ventas.
    │   └── use-sessions.ts # Control de entrada y salida de empleados, caja y métodos de pago del turno.
    │
    └── lib/                # Utilidades Base
        ├── supabase/       # Clientes SSR y de cliente para conectar con Supabase Auth/DB.
        ├── store/          # Estado global simple (ej. zustand) para el carrito (`cart.ts`).
        └── types.ts        # Definiciones globales estrictas de TypeScript de las tablas de DB.
```

---

## 🛠️ Resumen de los Trabajos Recientes (Lo que se ha hecho)

A lo largo del desarrollo y de las últimas actualizaciones, hemos solidificado características cruciales para llevar la app a un nivel profesional:

1. **Optimización Móvil Completa**:
   - Todo el sistema POS y Dashboard fue ajustado estructuralmente. El catálogo de productos (`product-grid.tsx`) ahora envuelve responsivamente los ítems y las categorías en móviles se pueden deslizar (scroll horizontal). 
   - El carrito (`cart-sidebar.tsx`) se diseñó para no tapar la pantalla innecesariamente, integrándose en cajones ocultables o re-apilándose en pantallas de tablet.
   - Las grandes tablas del Admin ahora tienen scroll lateral evitando que el layout se rompa.

2. **Sistema Avanzado de Modificadores (El Caso "Bowl")**:
   - Para evitar tener docenas de productos como "Bowl Res/Pollo", "Bowl Cerdo", etc, construimos una estructura de Base de Datos para `product_modifier_groups`, `product_modifiers` y `modifier_recipes`.
   - Modificamos el `useCreateSale` en `use-sales.ts` y actualizamos profundamente la función SQL remota `create_sale` en Supabase.
   - Ahora, al presionar un Bowl, no se va directo al carrito: se levanta el nuevo `ProductOptionsModal` obligando al cajero a elegir una "Base" (Mín 1, Máx 1) y unas "Carnes" (Mín 1, Máx 3).
   - Cuando se cobra la factura, el Servidor descuenta la receta estructural del Bowl + las recetas específicas de la base o carne extra elegida.

3. **Anulación de Ventas Segura**:
   - Se levantaba un problema: Si un cajero anota una venta mal, el inventario se perdía.
   - Implementamos la página `Historial de Ventas` (`/admin/sales`).
   - Programamos el procedimiento remoto en Base de Datos `void_sale(sale_id, admin_id)`.
   - Esta función tiene doble candado: Valida estrictamente que quien ejecute sea 'ADMIN', luego ubica todas las recetas base y todo modificador vendido en esa factura y ejecuta sentencias `UPDATE ingredients SET stock = stock + cantidad` para recuperar literalmente cada gramo descontado de forma precisa.

4. **Corrección de Entorno y Vercel**:
   - Limpieza de errores de tipado e interfaces de TypeScript obsoletas previas a desplegar.
   - Resolución manual del bug de "Async Cookies" en los handlers SSR e Next.js 15 (`cookies()`).
   - Solución maestra al error de la terminal `invalid digit found in string` en entornos Mac: Se detectó que el nuevo compilador de Next (Turbopack) se corrompía al hacer caché sobre rutas con espacios en blanco ("COMIDAS RAPIDAS"). Lo arreglamos desactivando Turbopack explícitamente dentro del ambiente local forzando Webpack clásico (`package.json > dev`).

---

## 💡 Cómo seguir
La app está configurada para escalar. El principal motor de rendimiento (`React Query`) hace caché inteligente en cliente, lo que significa que a medida que tu internet local en el restaurante pase por lentitudes, el Punto de Venta se sentirá fluido y sincrónico para la persona despachando clientes.

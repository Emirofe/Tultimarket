const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'senora_chela', password: 'hola', port: 5432 });

async function check() {
  // Ver detalle_pedido para ver si hay items en los pedidos
  const detalles = await pool.query(`
    SELECT dp.id, dp.id_pedido, dp.id_producto, dp.id_servicio,
           dp.cantidad, dp.precio_unitario_historico,
           p.id_negocio AS negocio_producto,
           s.id_negocio AS negocio_servicio
    FROM detalle_pedido dp
    LEFT JOIN productos p ON p.id = dp.id_producto
    LEFT JOIN servicios s ON s.id = dp.id_servicio
    ORDER BY dp.id_pedido DESC
    LIMIT 15
  `);
  console.log("=== DETALLE DE PEDIDOS ===");
  console.table(detalles.rows);
  
  // Ver a qué negocio pertenecen los productos de los pedidos
  const resumen = await pool.query(`
    SELECT n.nombre_comercial, n.id, COUNT(DISTINCT dp.id_pedido) as pedidos
    FROM detalle_pedido dp
    LEFT JOIN productos p ON p.id = dp.id_producto
    LEFT JOIN servicios s ON s.id = dp.id_servicio
    LEFT JOIN negocios n ON n.id = COALESCE(p.id_negocio, s.id_negocio)
    GROUP BY n.nombre_comercial, n.id
  `);
  console.log("\n=== PEDIDOS POR NEGOCIO ===");
  console.table(resumen.rows);
  
  await pool.end();
}

check().catch(console.error);

const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'senora_chela', password: 'hola', port: 5432 });

async function check() {
  // Vendedores
  const vendedores = await pool.query("SELECT u.id, u.nombre, u.email, n.id AS id_negocio, n.nombre_comercial FROM usuarios u LEFT JOIN negocios n ON n.id_usuario = u.id WHERE u.id_rol = 2");
  console.log("=== VENDEDORES ===");
  console.log(vendedores.rows);
  
  // Pedidos
  const pedidos = await pool.query("SELECT id, id_usuario, total, estado_pedido, fecha_pedido FROM pedidos ORDER BY id DESC LIMIT 5");
  console.log("\n=== ÚLTIMOS 5 PEDIDOS ===");
  console.log(pedidos.rows);
  
  await pool.end();
}

check().catch(console.error);

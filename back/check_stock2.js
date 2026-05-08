const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'senora_chela', password: 'hola', port: 5432 });

async function check() {
  // Ver columnas de lotes_inventario
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lotes_inventario'`);
  console.log("Columnas de lotes_inventario:", cols.rows.map(r => r.column_name));
  
  // Ver stock directo de productos  
  const stocks = await pool.query(`SELECT id, nombre, esta_activo, stock_total FROM productos ORDER BY id LIMIT 10`);
  console.log("\n=== STOCK PRODUCTOS ===");
  console.table(stocks.rows);
  await pool.end();
}

check().catch(console.error);

const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "senora_chela",
  password: process.env.PGPASSWORD || "hola",
  port: Number(process.env.PGPORT || 5432),
});

async function main() {
  const trigger = await pool.query(
    `SELECT tgname
     FROM pg_trigger
     WHERE tgrelid = 'lotes_inventario'::regclass
       AND NOT tgisinternal
       AND tgname = 'tg_sync_stock'
     LIMIT 1`
  );

  const desincronizados = await pool.query(
    `WITH stock_lotes AS (
       SELECT
         id_producto,
         COALESCE(SUM(stock_disponible), 0)::int AS stock_lotes
       FROM lotes_inventario
       WHERE fecha_caducidad >= CURRENT_DATE
       GROUP BY id_producto
     )
     SELECT
       p.id,
       p.nombre,
       p.stock_total::int AS stock_total,
       COALESCE(sl.stock_lotes, 0)::int AS stock_lotes
     FROM productos p
     LEFT JOIN stock_lotes sl ON sl.id_producto = p.id
     WHERE COALESCE(p.stock_total, 0)::int <> COALESCE(sl.stock_lotes, 0)::int
     ORDER BY p.id ASC`
  );

  const resultado = {
    trigger_stock_instalado: trigger.rows.length > 0,
    productos_desincronizados: desincronizados.rows,
  };

  console.log(JSON.stringify(resultado, null, 2));

  if (!resultado.trigger_stock_instalado || resultado.productos_desincronizados.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

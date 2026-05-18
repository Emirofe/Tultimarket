const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'senora_chela',
  password: 'hola',
  port: 5432,
});

async function run() {
  try {
    await client.connect();
    const query = `
      WITH RECURSIVE cat_tree AS (
          SELECT id_categoria as id_cat, id_producto, NULL::integer AS id_servicio FROM producto_categoria
          UNION ALL
          SELECT id_categoria as id_cat, NULL::integer, id_servicio FROM servicio_categoria
          UNION ALL
          SELECT c.id_padre, ct.id_producto, ct.id_servicio FROM cat_tree ct
          JOIN categorias c ON ct.id_cat = c.id WHERE c.id_padre IS NOT NULL
      ),
      cat_stats AS (
          SELECT id_cat, COUNT(DISTINCT id_producto) as prods, COUNT(DISTINCT id_servicio) as servs
          FROM cat_tree GROUP BY id_cat
      )
      SELECT c.id, c.nombre_categoria, COALESCE(cs.prods, 0) as prods, COALESCE(cs.servs, 0) as servs
      FROM categorias c LEFT JOIN cat_stats cs ON c.id = cs.id_cat ORDER BY c.nombre_categoria;
    `;
    const res = await client.query(query);
    
    let con_prod = [];
    let sin_prod = [];
    
    res.rows.forEach(r => {
        let total = parseInt(r.prods) + parseInt(r.servs);
        let line = `ID: ${String(r.id).padEnd(4)} | Categoría: ${r.nombre_categoria.padEnd(50)} | Productos: ${String(r.prods).padEnd(3)} | Servicios: ${String(r.servs).padEnd(3)}`;
        if (total > 0) {
            con_prod.push(line);
        } else {
            sin_prod.push(line);
        }
    });
    
    let output = "=".repeat(90) + "\n";
    output += "REPORTE DE CATEGORÍAS CON PRODUCTOS / SERVICIOS (Directos o en Subcategorías)\n";
    output += "=".repeat(90) + "\n";
    output += `Total: ${con_prod.length} categorías\n\n`;
    output += con_prod.join('\n') + "\n\n";
    
    output += "=".repeat(90) + "\n";
    output += "REPORTE DE CATEGORÍAS TOTALMENTE VACÍAS (0 productos y 0 servicios)\n";
    output += "=".repeat(90) + "\n";
    output += `Total: ${sin_prod.length} categorías\n\n`;
    output += sin_prod.join('\n') + "\n";
    
    fs.writeFileSync('C:/Users/Emili/Downloads/TultiMarket_4/reporte/auditoria_categorias.txt', output, 'utf8');
    console.log("Archivo generado exitosamente en reporte/auditoria_categorias.txt");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();

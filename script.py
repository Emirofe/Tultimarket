import psycopg2

try:
    conn = psycopg2.connect(dbname='senora_chela', user='postgres', password='hola', host='localhost')
    cur = conn.cursor()

    query = '''
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
    '''
    cur.execute(query)
    rows = cur.fetchall()
    
    con_prod = []
    sin_prod = []
    
    for r in rows:
        total = r[2] + r[3]
        line = f"ID: {r[0]:<4} | Categoría: {r[1]:<50} | Productos: {r[2]:<3} | Servicios: {r[3]:<3}"
        if total > 0:
            con_prod.append(line)
        else:
            sin_prod.append(line)
            
    with open('c:/Users/Emili/Downloads/TultiMarket_4/reporte/auditoria_categorias.txt', 'w', encoding='utf-8') as f:
        f.write("="*90 + "\n")
        f.write("REPORTE DE CATEGORÍAS CON PRODUCTOS / SERVICIOS (Directos o en Subcategorías)\n")
        f.write("="*90 + "\n")
        f.write(f"Total: {len(con_prod)} categorías\n\n")
        for line in con_prod:
            f.write(line + "\n")
            
        f.write("\n" + "="*90 + "\n")
        f.write("REPORTE DE CATEGORÍAS TOTALMENTE VACÍAS (0 productos y 0 servicios)\n")
        f.write("="*90 + "\n")
        f.write(f"Total: {len(sin_prod)} categorías\n\n")
        for line in sin_prod:
            f.write(line + "\n")
            
    print("Archivo generado exitosamente.")
except Exception as e:
    print(f"Error: {e}")

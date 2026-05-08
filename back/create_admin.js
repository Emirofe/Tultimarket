const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'senora_chela', password: 'hola', port: 5432 });

pool.query("UPDATE usuarios SET password_hash = 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79' WHERE id_rol = 3 RETURNING *")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());

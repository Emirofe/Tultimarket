const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'senora_chela', password: 'hola', port: 5432 });

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
  .then(res => console.log(res.rows.map(r => r.table_name)))
  .catch(console.error)
  .finally(() => pool.end());

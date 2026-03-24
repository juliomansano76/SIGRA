const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Erro ao conectar no banco:', err.message);
    } else {
        console.log('Banco de dados conectado!');
        release();
    }
});

module.exports = pool;

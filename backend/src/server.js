require('dotenv').config();
const express = require('express');
const path    = require('path');

require('./config/database');

const app = express();

app.use(express.json());
app.use(express.static('C:\\Projetos\\reclamacoes\\frontend'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/clientes',    require('./routes/clientes'));
app.use('/api/areas',       require('./routes/areas'));
app.use('/api/defeitos',    require('./routes/defeitos'));
app.use('/api/usuarios',    require('./routes/usuarios'));
app.use('/api/reclamacoes', require('./routes/reclamacoes'));

app.get('/api/ping', (req, res) => {
    res.json({ ok: true, mensagem: 'Servidor funcionando!' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log('Servidor rodando em http://' + HOST + ':' + PORT);
    console.log('Acesso na rede: http://10.0.0.60:' + PORT);
});

const dashboard = require('./routes/dashboard');
app.use('/api/dashboard', dashboard);
const { buscarSessao } = require('../services/auth');

async function autenticar(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ erro: 'Acesso negado. Faça login.' });
    }

    const usuario = await buscarSessao(token);

    if (!usuario) {
        return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }

    req.usuario = usuario;
    next();
}

module.exports = { autenticar };
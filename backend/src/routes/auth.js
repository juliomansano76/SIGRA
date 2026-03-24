const express = require('express');
const router  = express.Router();
const { login, logout } = require('../services/auth');
const { autenticar }    = require('../middleware/auth');

router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

        const resultado = await login(
            email,
            senha,
            req.ip,
            req.headers['user-agent']
        );

        res.json(resultado);

    } catch (err) {
        res.status(401).json({ erro: err.message });
    }
});

router.post('/logout', autenticar, async (req, res) => {
    try {
        const token = req.headers['authorization'].split(' ')[1];
        await logout(token);
        res.json({ ok: true, mensagem: 'Logout realizado.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao fazer logout.' });
    }
});

router.get('/me', autenticar, (req, res) => {
    res.json({ usuario: req.usuario });
});

module.exports = router;
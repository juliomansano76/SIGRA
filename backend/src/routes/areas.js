const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { permitir }   = require('../middleware/permissao');

router.get('/', autenticar, async (req, res) => {
    try {
        const resultado = await db.query('SELECT * FROM areas ORDER BY ativo DESC, nome');
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar áreas.' });
    }
});

router.post('/', autenticar, permitir('admin', 'qualidade'), async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
        const resultado = await db.query(
            'INSERT INTO areas (nome, descricao, criado_por) VALUES ($1, $2, $3) RETURNING *',
            [nome, descricao, req.usuario.id]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao criar área.' });
    }
});

router.put('/:id', autenticar, permitir('admin', 'qualidade'), async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        const resultado = await db.query(
            'UPDATE areas SET nome=$1, descricao=$2 WHERE id=$3 RETURNING *',
            [nome, descricao, req.params.id]
        );
        res.json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar área.' });
    }
});

router.delete('/:id', autenticar, permitir('admin'), async (req, res) => {
    try {
        await db.query('UPDATE areas SET ativo=false WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover área.' });
    }
});

router.put('/:id/reativar', autenticar, permitir('admin', 'qualidade'), async (req, res) => {
    try {
        await db.query('UPDATE areas SET ativo=true WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao reativar área.' });
    }
});

module.exports = router;
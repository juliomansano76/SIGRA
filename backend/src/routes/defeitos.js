const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { permitir }   = require('../middleware/permissao');

router.get('/', autenticar, async (req, res) => {
    try {
        const resultado = await db.query('SELECT * FROM defeitos ORDER BY ativo DESC, codigo');
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar defeitos.' });
    }
});

router.post('/', autenticar, permitir('admin', 'qualidade'), async (req, res) => {
    try {
        const { descricao } = req.body;
        if (!descricao) return res.status(400).json({ erro: 'Descrição é obrigatória.' });

        // Gera código automático sequencial
        const ultimo = await db.query(
            "SELECT codigo FROM defeitos ORDER BY criado_em DESC LIMIT 1"
        );
        let proximoNum = 1;
        if (ultimo.rows.length > 0 && ultimo.rows[0].codigo) {
            const num = parseInt(ultimo.rows[0].codigo.replace('DEF-', ''));
            if (!isNaN(num)) proximoNum = num + 1;
        }
        const codigo = 'DEF-' + String(proximoNum).padStart(3, '0');

        const resultado = await db.query(
            'INSERT INTO defeitos (codigo, descricao, criado_por) VALUES ($1, $2, $3) RETURNING *',
            [codigo, descricao, req.usuario.id]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao criar defeito.' });
    }
});

router.put('/:id', autenticar, permitir('admin', 'qualidade'), async (req, res) => {
    try {
        const { descricao } = req.body;
        const resultado = await db.query(
            'UPDATE defeitos SET descricao=$1 WHERE id=$2 RETURNING *',
            [descricao, req.params.id]
        );
        res.json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar defeito.' });
    }
});

router.delete('/:id', autenticar, permitir('admin'), async (req, res) => {
    try {
        await db.query('UPDATE defeitos SET ativo=false WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover defeito.' });
    }
});

router.put('/:id/reativar', autenticar, permitir('admin', 'qualidade'), async (req, res) => {
    try {
        await db.query('UPDATE defeitos SET ativo=true WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao reativar defeito.' });
    }
});

module.exports = router;
const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { permitir }   = require('../middleware/permissao');

// Listar todos
router.get('/', autenticar, async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT * FROM clientes ORDER BY ativo DESC, nome'
        );
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar clientes.' });
    }
});

// Criar
router.post('/', autenticar, permitir('admin', 'sac'), async (req, res) => {
    try {
        const { nome, cnpj_cpf, email, telefone, contato } = req.body;
        if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });

        const resultado = await db.query(
            `INSERT INTO clientes (nome, cnpj_cpf, email, telefone, contato, criado_por)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [nome, cnpj_cpf, email, telefone, contato, req.usuario.id]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao criar cliente.' });
    }
});

// Atualizar
router.put('/:id', autenticar, permitir('admin', 'sac'), async (req, res) => {
    try {
        const { nome, cnpj_cpf, email, telefone, contato } = req.body;
        const resultado = await db.query(
            `UPDATE clientes SET nome=$1, cnpj_cpf=$2, email=$3, telefone=$4, contato=$5
             WHERE id=$6 RETURNING *`,
            [nome, cnpj_cpf, email, telefone, contato, req.params.id]
        );
        res.json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar cliente.' });
    }
});

// Desativar
router.delete('/:id', autenticar, permitir('admin', 'sac'), async (req, res) => {
    try {
        await db.query('UPDATE clientes SET ativo=false WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover cliente.' });
    }
});

router.put('/:id/reativar', autenticar, permitir('admin', 'sac'), async (req, res) => {
    try {
        await db.query('UPDATE clientes SET ativo=true WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao reativar cliente.' });
    }
});

module.exports = router;
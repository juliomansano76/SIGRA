const express  = require('express');
const router   = express.Router();
const db       = require('../config/database');
const bcrypt   = require('bcryptjs');
const { autenticar } = require('../middleware/auth');
const { permitir }   = require('../middleware/permissao');

// ⚠️ IMPORTANTE: /meu-perfil DEVE vir antes de /:id
router.put('/meu-perfil', autenticar, async (req, res) => {
    try {
        const { nome, senha_atual, senha_nova } = req.body;
        if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });

        if (senha_nova) {
            const u = await db.query('SELECT senha_hash FROM usuarios WHERE id=$1', [req.usuario.id]);
            const ok = await bcrypt.compare(senha_atual || '', u.rows[0].senha_hash);
            if (!ok) return res.status(400).json({ erro: 'Senha atual incorreta.' });
            const novaHash = await bcrypt.hash(senha_nova, 12);
            await db.query('UPDATE usuarios SET nome=$1, senha_hash=$2 WHERE id=$3', [nome, novaHash, req.usuario.id]);
        } else {
            await db.query('UPDATE usuarios SET nome=$1 WHERE id=$2', [nome, req.usuario.id]);
        }

        const atualizado = await db.query(
            'SELECT id, nome, email, perfil, avatar_url FROM usuarios WHERE id=$1',
            [req.usuario.id]
        );
        res.json(atualizado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
    }
});

router.get('/', autenticar, permitir('admin'), async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY ativo DESC, nome'
        );
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar usuários.' });
    }
});

router.post('/', autenticar, permitir('admin'), async (req, res) => {
    try {
        const { nome, email, senha, perfil } = req.body;
        if (!nome || !email || !senha || !perfil)
            return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });

        const senhaHash = await bcrypt.hash(senha, 12);
        const resultado = await db.query(
            `INSERT INTO usuarios (nome, email, senha_hash, perfil)
             VALUES ($1, $2, $3, $4) RETURNING id, nome, email, perfil`,
            [nome, email, senhaHash, perfil]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ erro: 'E-mail já cadastrado.' });
        res.status(500).json({ erro: 'Erro ao criar usuário.' });
    }
});

router.put('/:id', autenticar, permitir('admin'), async (req, res) => {
    try {
        const { nome, email, perfil, ativo } = req.body;
        const resultado = await db.query(
            `UPDATE usuarios SET nome=$1, email=$2, perfil=$3, ativo=$4
             WHERE id=$5 RETURNING id, nome, email, perfil, ativo`,
            [nome, email, perfil, ativo, req.params.id]
        );
        res.json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar usuário.' });
    }
});

router.put('/:id/senha', autenticar, permitir('admin'), async (req, res) => {
    try {
        const { senha } = req.body;
        if (!senha) return res.status(400).json({ erro: 'Senha é obrigatória.' });
        const senhaHash = await bcrypt.hash(senha, 12);
        await db.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [senhaHash, req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar senha.' });
    }
});

router.delete('/:id', autenticar, permitir('admin'), async (req, res) => {
    try {
        await db.query('UPDATE usuarios SET ativo=false WHERE id=$1', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover usuário.' });
    }
});

module.exports = router;
// ── Esqueci minha senha ────────────────────────────────────────────
const crypto = require('crypto');
const email  = require('../services/email');

router.post('/esqueci-senha', async (req, res) => {
    try {
        const { emailUsuario } = req.body;
        if (!emailUsuario) return res.status(400).json({ erro: 'Informe o e-mail.' });

        const r = await db.query(
            'SELECT id, nome, email FROM usuarios WHERE email=$1 AND ativo=true',
            [emailUsuario.toLowerCase().trim()]
        );

        if (!r.rows.length)
            return res.status(404).json({ erro: 'E-mail não cadastrado no sistema.' });

        const usuario = r.rows[0];

        // Gera token único com validade de 2 horas
        const token   = crypto.randomBytes(32).toString('hex');
        const expira  = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h

        await db.query(
            `INSERT INTO tokens_redefinicao_senha (usuario_id, token, expira_em)
             VALUES ($1, $2, $3)
             ON CONFLICT (usuario_id) DO UPDATE SET token=$2, expira_em=$3, usado=false`,
            [usuario.id, token, expira]
        );

        // Envia email com link
        const APP_URL = process.env.APP_URL || 'http://localhost:3000';
        const link    = `${APP_URL}/pages/redefinir-senha.html?token=${token}`;

        await email.notificarRedefinicaoSenha(usuario, link);

        res.json({ ok: true, mensagem: 'E-mail enviado com instruções para redefinição de senha.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao processar solicitação.' });
    }
});

router.post('/redefinir-senha', async (req, res) => {
    try {
        const { token, senha_nova } = req.body;
        if (!token || !senha_nova)
            return res.status(400).json({ erro: 'Token e nova senha são obrigatórios.' });
        if (senha_nova.length < 6)
            return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });

        const r = await db.query(
            `SELECT t.*, u.nome FROM tokens_redefinicao_senha t
             JOIN usuarios u ON u.id = t.usuario_id
             WHERE t.token=$1 AND t.usado=false AND t.expira_em > NOW()`,
            [token]
        );

        if (!r.rows.length)
            return res.status(400).json({ erro: 'Link inválido ou expirado. Solicite um novo.' });

        const t = r.rows[0];
        const hash = await bcrypt.hash(senha_nova, 12);

        await db.query('UPDATE usuarios SET senha_hash=$1 WHERE id=$2', [hash, t.usuario_id]);
        await db.query('UPDATE tokens_redefinicao_senha SET usado=true WHERE id=$1', [t.id]);

        res.json({ ok: true, mensagem: 'Senha redefinida com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao redefinir senha.' });
    }
});

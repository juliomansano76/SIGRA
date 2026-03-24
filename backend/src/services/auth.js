const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function login(email, senha, ip, userAgent) {
    const resultado = await db.query(
        'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
        [email]
    );

    if (resultado.rows.length === 0) {
        throw new Error('E-mail ou senha incorretos');
    }

    const usuario = resultado.rows[0];

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
        throw new Error('E-mail ou senha incorretos');
    }

    const token = uuidv4() + '-' + uuidv4();
    const expiresHours = parseInt(process.env.SESSION_EXPIRES_HOURS) || 8;
    const expiraEm = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    await db.query(
        'INSERT INTO sessoes (usuario_id, token_hash, ip, user_agent, expira_em) VALUES ($1, $2, $3, $4, $5)',
        [usuario.id, token, ip, userAgent, expiraEm]
    );

    return {
        token,
        usuario: {
            id:     usuario.id,
            nome:   usuario.nome,
            email:  usuario.email,
            perfil: usuario.perfil,
            avatar: usuario.avatar_url
        }
    };
}

async function logout(token) {
    await db.query(
        'UPDATE sessoes SET encerrada_em = NOW() WHERE token_hash = $1',
        [token]
    );
}

async function buscarSessao(token) {
    const resultado = await db.query(
        `SELECT u.id, u.nome, u.email, u.perfil, u.avatar_url
         FROM sessoes s
         JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.token_hash = $1
           AND s.encerrada_em IS NULL
           AND s.expira_em > NOW()`,
        [token]
    );

    if (resultado.rows.length === 0) return null;
    return resultado.rows[0];
}

module.exports = { login, logout, buscarSessao };

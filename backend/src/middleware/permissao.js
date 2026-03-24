// Retorna um middleware que só permite os perfis informados
function permitir(...perfis) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ erro: 'Não autenticado.' });
        }

        if (!perfis.includes(req.usuario.perfil)) {
            return res.status(403).json({ erro: 'Sem permissão para esta ação.' });
        }

        next();
    };
}

module.exports = { permitir };

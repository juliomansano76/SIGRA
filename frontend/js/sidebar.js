function carregarSidebar() {
    const usuario = getUsuario();
    if (!usuario) { window.location.href = '/index.html'; return; }

    const perfil = usuario.perfil;
    const menus = [
        { label: '🏠 Dashboard',      href: '/pages/dashboard.html',       perfis: ['admin','sac','qualidade','comercial','fiscal','expedicao','revisao','pcp','financeiro'] },
        { label: '➕ Nova Reclamação', href: '/pages/nova-reclamacao.html', perfis: ['admin','sac'] },
        { label: '📋 Reclamações',     href: '/pages/reclamacoes.html',     perfis: ['admin','sac','qualidade','comercial','fiscal','expedicao','revisao','pcp','financeiro'] },
        { label: '👥 Clientes',        href: '/pages/clientes.html',        perfis: ['admin','sac'] },
        { label: '🗂 Áreas',           href: '/pages/areas.html',           perfis: ['admin','qualidade'] },
        { label: '⚠ Defeitos',        href: '/pages/defeitos.html',        perfis: ['admin','qualidade'] },
        { label: '📊 Planos de Ação',  href: '/pages/plano-acao.html',      perfis: ['admin','qualidade'] },
        { label: '📈 Painel de Gestão',   href: '/pages/painel-gestao.html',   perfis: ['admin','sac'] },
        { label: '🗺️ Fluxo do Processo',  href: '/pages/fluxo-sigra.html',     perfis: ['admin','sac','qualidade','comercial','fiscal','expedicao','revisao','pcp','financeiro'] },
        { label: '👤 Usuários',        href: '/pages/usuarios.html',        perfis: ['admin'] },
    ];

    const paginaAtual = window.location.pathname;
    const itensHtml = menus
        .filter(function(m) { return m.perfis.includes(perfil); })
        .map(function(m) {
            const ativo = paginaAtual.includes(m.href.replace('/pages/', '')) ? 'ativo' : '';
            return '<li><a href="' + m.href + '" class="' + ativo + '">' + m.label + '</a></li>';
        }).join('');

    const iniciais = usuario.nome.split(' ').map(function(p){ return p[0]; }).join('').substring(0,2).toUpperCase();
    const perfilLabel = perfil.charAt(0).toUpperCase() + perfil.slice(1);
    const paginaPerfil = paginaAtual.includes('meu-perfil') ? 'ativo' : '';

    document.getElementById('sidebar-container').innerHTML =
        '<div class="sidebar">' +
            '<div class="sidebar-logo">' +
                '<strong style="font-size:18px;display:block;">SIGRA</strong>' +
                '<span style="font-size:11px;opacity:0.6;line-height:1.4;display:block;margin-top:4px;">Sistema Integrado de Gestão<br>de Reclamações e Atendimento</span>' +
            '</div>' +
            '<ul class="sidebar-menu">' + itensHtml + '</ul>' +
            '<div class="sidebar-usuario">' +
                '<a href="/pages/meu-perfil.html" title="Meu Perfil" style="display:flex;align-items:center;gap:10px;text-decoration:none;padding:4px 0;margin-bottom:6px;' + (paginaPerfil ? 'background:rgba(255,255,255,0.08);border-radius:8px;padding:6px 8px;margin:-6px -8px 6px;' : '') + '">' +
                    '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">' + iniciais + '</div>' +
                    '<div style="overflow:hidden;">' +
                        '<strong style="display:block;font-size:13px;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + usuario.nome + '</strong>' +
                        '<span style="font-size:11px;opacity:0.6;">' + perfilLabel + '</span>' +
                    '</div>' +
                '</a>' +
                '<a href="#" onclick="limparSessao();window.location.href=\'/index.html\';return false;" style="color:rgba(255,255,255,0.4);font-size:12px;">Sair →</a>' +
            '</div>' +
        '</div>';
}

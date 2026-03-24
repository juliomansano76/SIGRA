const API_URL = window.location.protocol + '//' + window.location.hostname + ':3000/api';

function getToken() {
    return localStorage.getItem('token');
}

function getUsuario() {
    const u = localStorage.getItem('usuario');
    return u ? JSON.parse(u) : null;
}

function salvarSessao(token, usuario) {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
}

function limparSessao() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
}

async function api(metodo, rota, corpo = null) {
    const opcoes = {
        method: metodo,
        headers: { 'Content-Type': 'application/json' }
    };

    const token = getToken();
    if (token) {
        opcoes.headers['Authorization'] = 'Bearer ' + token;
    }

    if (corpo) {
        opcoes.body = JSON.stringify(corpo);
    }

    const resposta = await fetch(API_URL + rota, opcoes);
    const dados = await resposta.json();

    if (resposta.status === 401) {
        limparSessao();
        window.location.href = '/index.html';
        return;
    }

    return { ok: resposta.ok, status: resposta.status, dados };
}

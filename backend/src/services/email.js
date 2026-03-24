const nodemailer = require('nodemailer');
const db = require('../config/database');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 2525,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
});

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function emailsPorPerfil(perfis) {
    const lista = Array.isArray(perfis) ? perfis : [perfis];
    const r = await db.query(
        `SELECT email, nome FROM usuarios WHERE perfil = ANY($1) AND ativo = true`,
        [lista]
    );
    return r.rows;
}

function templateBase({ titulo, subtitulo, corpo, linkHref, linkTexto }) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#2c2c2c;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">SIGRA</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:12px;">Sistema Integrado de Gestão de Reclamações</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 0;">
          <h2 style="margin:0;color:#1a1a1a;font-size:18px;">${titulo}</h2>
          <p style="margin:6px 0 0;color:#666;font-size:14px;">${subtitulo}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;">
          <div style="background:#f8f8f8;border-radius:8px;padding:20px;font-size:14px;color:#333;line-height:1.8;">
            ${corpo}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 32px;text-align:center;">
          <a href="${linkHref}" style="display:inline-block;background:#2c2c2c;color:#fff;text-decoration:none;padding:13px 36px;border-radius:8px;font-size:14px;font-weight:600;">
            ${linkTexto || '🔗 Abrir Reclamação no SIGRA'}
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#f5f5f5;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;color:#aaa;font-size:11px;text-align:center;">
            Notificação automática do SIGRA — não responda este e-mail.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function notificar({ perfis, assunto, titulo, subtitulo, corpo, reclamacaoId }) {
    try {
        const destinatarios = await emailsPorPerfil(perfis);
        if (!destinatarios.length) {
            console.log(`📧 Nenhum destinatário ativo para perfis: ${perfis}`);
            return;
        }
        const link = `${APP_URL}/pages/detalhe-reclamacao.html?id=${reclamacaoId}`;
        const html = templateBase({ titulo, subtitulo, corpo, linkHref: link });

        // Envia com delay escalonado para não estourar limite do Mailtrap
        for (let i = 0; i < destinatarios.length; i++) {
            if (i > 0) await sleep(1200);
            const dest = destinatarios[i];
            await transporter.sendMail({
                from:    process.env.EMAIL_FROM || '"SIGRA" <sigra@empresa.com.br>',
                to:      `${dest.nome} <${dest.email}>`,
                subject: assunto,
                html,
            });
            console.log(`📧 [${i+1}/${destinatarios.length}] Email "${assunto}" → ${dest.email}`);
        }
    } catch (err) {
        console.error('❌ Erro ao enviar email:', err.message);
    }
}

// ─── Notificações por evento ──────────────────────────────────────────────────

function linhaInfo(label, valor) {
    return `<p style="margin:4px 0;"><strong>${label}:</strong> ${valor || '—'}</p>`;
}

function corpoBase(rec) {
    return `
        ${linhaInfo('Reclamação', rec.codigo)}
        ${linhaInfo('Cliente', rec.cliente_nome || rec.cliente_id)}
        ${linhaInfo('Nossa NF', rec.nossa_nf)}
        ${linhaInfo('Lote', rec.lote)}
        ${linhaInfo('Problema', rec.descricao)}
    `;
}

async function buscarRec(id) {
    const r = await db.query(
        `SELECT r.*, c.nome AS cliente_nome FROM reclamacoes r LEFT JOIN clientes c ON c.id = r.cliente_id WHERE r.id = $1`,
        [id]
    );
    return r.rows[0];
}

// 1. Reclamação aberta → Qualidade
async function notificarReclamacaoAberta(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['qualidade', 'admin'],
        assunto: `[SIGRA] Nova Reclamação — ${rec.codigo}`,
        titulo: '📋 Nova reclamação aguarda sua análise',
        subtitulo: `A reclamação ${rec.codigo} foi aberta e está aguardando avaliação da Qualidade.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 2. Avaliação concluída → procedente/improcedente → Comercial
async function notificarAvaliacaoConcluida(reclamacaoId, resultado) {
    const rec = await buscarRec(reclamacaoId);
    const label = resultado === 'procedente' ? '✅ Procedente' : '❌ Improcedente';
    await notificar({
        perfis: ['comercial', 'admin'],
        assunto: `[SIGRA] Avaliação Concluída — ${rec.codigo}`,
        titulo: `🔬 Avaliação concluída: ${label}`,
        subtitulo: `A Qualidade concluiu a avaliação da reclamação ${rec.codigo}.`,
        corpo: corpoBase(rec) + linhaInfo('Resultado', label),
        reclamacaoId,
    });
}

// 3. Avaliação → visita técnica → Qualidade
async function notificarVisitaTecnicaSolicitada(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['qualidade', 'admin'],
        assunto: `[SIGRA] Visita Técnica Solicitada — ${rec.codigo}`,
        titulo: '🔍 Visita técnica necessária',
        subtitulo: `A reclamação ${rec.codigo} requer visita técnica. Aguardando agendamento.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 4. Direcionamento → devolução → SAC
async function notificarDevolucaoSolicitada(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] Devolução Solicitada — ${rec.codigo}`,
        titulo: '🔄 Devolução de material solicitada',
        subtitulo: `O Comercial direcionou a reclamação ${rec.codigo} para devolução. Ação necessária do SAC.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 5. Direcionamento → crédito direto → SAC
async function notificarCreditoDireto(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] Crédito Direto — ${rec.codigo}`,
        titulo: '💳 Geração de crédito direto',
        subtitulo: `O Comercial direcionou a reclamação ${rec.codigo} para geração de crédito. Ação necessária do SAC.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 6. Direcionamento → nenhuma ação → encerramento → Comercial
async function notificarEncerramentoDireto(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['comercial', 'admin'],
        assunto: `[SIGRA] Encerramento Pendente — ${rec.codigo}`,
        titulo: '🏁 Reclamação aguarda encerramento',
        subtitulo: `A reclamação ${rec.codigo} foi direcionada para encerramento sem ação adicional.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 7. Visita concluída → 2ª avaliação → Qualidade
async function notificarVisitaConcluida(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['qualidade', 'admin'],
        assunto: `[SIGRA] Visita Concluída — ${rec.codigo}`,
        titulo: '✅ Visita técnica concluída',
        subtitulo: `A visita técnica da reclamação ${rec.codigo} foi concluída. Aguardando 2ª avaliação da Qualidade.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 8. 2ª Avaliação concluída → Comercial
async function notificarSegundaAvaliacaoConcluida(reclamacaoId, resultado) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['comercial', 'admin'],
        assunto: `[SIGRA] 2ª Avaliação Concluída — ${rec.codigo}`,
        titulo: '🔬 2ª Avaliação concluída',
        subtitulo: `A Qualidade concluiu a 2ª avaliação da reclamação ${rec.codigo}. Aguardando direcionamento comercial.`,
        corpo: corpoBase(rec) + linhaInfo('Resultado', resultado),
        reclamacaoId,
    });
}

// 9. SAC confirma devolução → Fiscal (aguardando NF do cliente)
async function notificarAguardandoNFCliente(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['fiscal', 'admin'],
        assunto: `[SIGRA] NF do Cliente Pendente — ${rec.codigo}`,
        titulo: '📄 Aguardando conferência de NF',
        subtitulo: `O SAC confirmou a devolução de ${rec.codigo}. NF do cliente recebida e aguarda conferência do Fiscal.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 10. Fiscal aprova NF → SAC solicitar coleta
async function notificarNFAprovada(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] NF Aprovada — Solicitar Coleta — ${rec.codigo}`,
        titulo: '✅ NF aprovada pelo Fiscal',
        subtitulo: `A NF da reclamação ${rec.codigo} foi aprovada. SAC deve solicitar a coleta do material.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 11. Coleta agendada → TODOS os perfis operacionais
async function notificarColetaAgendada(reclamacaoId, dadosColeta) {
    const rec = await buscarRec(reclamacaoId);
    const corpoExtra = `
        ${corpoBase(rec)}
        <hr style="border:none;border-top:1px solid #e0e0e0;margin:12px 0;">
        ${linhaInfo('Transportadora', dadosColeta.transportadora)}
        ${linhaInfo('Previsão de chegada', dadosColeta.previsao || '—')}
    `;
    await notificar({
        perfis: ['fiscal', 'expedicao', 'pcp', 'qualidade', 'comercial', 'sac', 'admin'],
        assunto: `[SIGRA] Coleta Agendada — ${rec.codigo}`,
        titulo: '🚚 Coleta de material agendada',
        subtitulo: `A coleta do material da reclamação ${rec.codigo} foi agendada. Fique atento à chegada.`,
        corpo: corpoExtra,
        reclamacaoId,
    });
}

// 12. Material chegou → Revisão
async function notificarMaterialRecebido(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['revisao', 'admin'],
        assunto: `[SIGRA] Material Recebido — ${rec.codigo}`,
        titulo: '📦 Material recebido para revisão',
        subtitulo: `O material da reclamação ${rec.codigo} chegou e aguarda revisão.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 13. Revisão concluída → PCP (emitir OF)
async function notificarRevisaoConcluida(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['pcp', 'admin'],
        assunto: `[SIGRA] Revisão Concluída — Emitir OF — ${rec.codigo}`,
        titulo: '🔧 Revisão concluída',
        subtitulo: `A revisão do material da reclamação ${rec.codigo} foi concluída. PCP deve emitir a OF.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 14. OF emitida → Fiscal (conferência NF x Romaneio)
async function notificarOFEmitida(reclamacaoId, numeroOF) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['fiscal', 'admin'],
        assunto: `[SIGRA] OF Emitida — Conferir NF — ${rec.codigo}`,
        titulo: '📋 OF emitida pelo PCP',
        subtitulo: `A OF da reclamação ${rec.codigo} foi emitida. Fiscal deve conferir NF x Romaneio.`,
        corpo: corpoBase(rec) + linhaInfo('Número da OF', numeroOF),
        reclamacaoId,
    });
}

// 15. Conferência material OK → SAC (crédito)
async function notificarConferenciaMaterialOK(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] Material Conferido — Gerar Crédito — ${rec.codigo}`,
        titulo: '✅ Conferência de material aprovada',
        subtitulo: `O material da reclamação ${rec.codigo} foi conferido. SAC deve informar ao cliente sobre o crédito.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 16. Crédito gerado pelo Financeiro → SAC definir crédito
async function notificarCreditoGeradoFinanceiro(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] Crédito Gerado — ${rec.codigo}`,
        titulo: '💳 Crédito gerado pelo Financeiro',
        subtitulo: `O Financeiro gerou o crédito da reclamação ${rec.codigo}. SAC deve definir como será utilizado.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 17. Crédito definido pelo SAC → Financeiro aprovar
async function notificarCreditoDefinido(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['financeiro', 'admin'],
        assunto: `[SIGRA] Forma de Crédito Definida — Aprovação Necessária — ${rec.codigo}`,
        titulo: '💳 SAC definiu a forma de crédito',
        subtitulo: `O SAC definiu a forma de crédito da reclamação ${rec.codigo}. Financeiro deve revisar e aprovar.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 18. Financeiro aprovou → Comercial encerrar
async function notificarFinanceiroAprovouCredito(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['comercial', 'admin'],
        assunto: `[SIGRA] Crédito Aprovado — Encerrar Reclamação — ${rec.codigo}`,
        titulo: '✅ Financeiro aprovou o crédito',
        subtitulo: `O Financeiro aprovou o crédito da reclamação ${rec.codigo}. Comercial deve encerrar.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 18. Reclamação encerrada → SAC
async function notificarEncerramento(reclamacaoId) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] Reclamação Encerrada — ${rec.codigo}`,
        titulo: '✅ Reclamação encerrada',
        subtitulo: `A reclamação ${rec.codigo} foi encerrada pelo Comercial.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 19. Complemento solicitado → SAC
async function notificarComplementoSolicitado(reclamacaoId, mensagem, solicitanteNome) {
    const rec = await buscarRec(reclamacaoId);
    await notificar({
        perfis: ['sac', 'admin'],
        assunto: `[SIGRA] Complemento Solicitado — ${rec.codigo}`,
        titulo: '📋 Informação adicional solicitada',
        subtitulo: `${solicitanteNome} solicitou complemento de informações na reclamação ${rec.codigo}.`,
        corpo: corpoBase(rec) + `
            <hr style="border:none;border-top:1px solid #e0e0e0;margin:12px 0;">
            <p style="margin:4px 0;"><strong>O que precisa ser complementado:</strong></p>
            <p style="background:#fff3e0;border-left:3px solid #f57c00;padding:10px 14px;border-radius:4px;margin:8px 0;">${mensagem}</p>
        `,
        reclamacaoId,
    });
}

// 20. Complemento respondido → quem solicitou (perfil de retorno)
async function notificarComplementoRespondido(reclamacaoId, sacNome) {
    const rec = await buscarRec(reclamacaoId);
    // Busca o perfil de quem solicitou para notificar
    const r = await db.query(
        `SELECT perfil_retorno FROM solicitacoes_complemento WHERE reclamacao_id=$1 ORDER BY criado_em DESC LIMIT 1`,
        [reclamacaoId]
    );
    const perfil = r.rows[0]?.perfil_retorno || 'qualidade';
    await notificar({
        perfis: [perfil, 'admin'],
        assunto: `[SIGRA] Complemento Respondido — ${rec.codigo}`,
        titulo: '✅ SAC complementou as informações',
        subtitulo: `${sacNome} respondeu à solicitação de complemento da reclamação ${rec.codigo}. Reclamação retornou para sua análise.`,
        corpo: corpoBase(rec),
        reclamacaoId,
    });
}

// 21. Redefinição de senha
async function notificarRedefinicaoSenha(usuario, link) {
    try {
        const html = templateBase({
            titulo: '🔐 Redefinição de Senha',
            subtitulo: `Olá, ${usuario.nome}! Recebemos uma solicitação para redefinir sua senha no SIGRA.`,
            corpo: `
                <p style="margin:0 0 16px;font-size:14px;color:#444;">Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>2 horas</strong>.</p>
                <p style="margin:0 0 16px;font-size:13px;color:#888;">Se você não solicitou a redefinição de senha, ignore este e-mail.</p>
            `,
            linkHref: link,
            linkTexto: '🔐 Redefinir Minha Senha',
        });
        await transporter.sendMail({
            from:    process.env.EMAIL_FROM || '"SIGRA" <sigra@empresa.com.br>',
            to:      `${usuario.nome} <${usuario.email}>`,
            subject: '[SIGRA] Redefinição de Senha',
            html,
        });
        console.log(`📧 Email redefinição de senha → ${usuario.email}`);
    } catch (err) {
        console.error('❌ Erro ao enviar email de redefinição:', err.message);
    }
}

module.exports = {
    notificarReclamacaoAberta,
    notificarAvaliacaoConcluida,
    notificarVisitaTecnicaSolicitada,
    notificarDevolucaoSolicitada,
    notificarCreditoDireto,
    notificarEncerramentoDireto,
    notificarVisitaConcluida,
    notificarSegundaAvaliacaoConcluida,
    notificarAguardandoNFCliente,
    notificarNFAprovada,
    notificarColetaAgendada,
    notificarMaterialRecebido,
    notificarRevisaoConcluida,
    notificarOFEmitida,
    notificarConferenciaMaterialOK,
    notificarCreditoGeradoFinanceiro,
    notificarCreditoDefinido,
    notificarFinanceiroAprovouCredito,
    notificarEncerramento,
    notificarComplementoSolicitado,
    notificarComplementoRespondido,
    notificarRedefinicaoSenha,
};

const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { autenticar } = require('../middleware/auth');

const statusPerfil = {
    rascunho:                                               'sac',
    reclamacao_cadastrada:                                  'sac',
    aguardando_analise_qualidade:                           'qualidade',
    aguardando_visita_tecnica_qualidade:                    'qualidade',
    aguardando_comercial_procedente:                        'comercial',
    aguardando_comercial_improcedente:                      'comercial',
    aguardando_direcionamento_comercial_pos_visita:         'comercial',
    aguardando_encerramento_comercial:                      'comercial',
    encaminhando_devolucao_sac:                             'sac',
    encaminhando_devolucao_conferindo_nf:                   'sac',
    encaminhando_devolucao_corrigindo_nf:                   'sac',
    encaminhando_devolucao_sac_solicitar_coleta:            'sac',
    encaminhando_devolucao_aguardando_chegada_material:     'expedicao',
    encaminhando_devolucao_aguardando_revisao:              'revisao',
    encaminhando_devolucao_aguardando_of:                   'pcp',
    encaminhando_devolucao_aguardando_conferencia_material: 'fiscal',
    encaminhando_devolucao_aguardando_correcao_nf_cliente:  'sac',
    gerando_credito_financeiro:                             'fiscal',
    gerando_credito_sac:                                    'sac',
    aguardando_aprovacao_financeiro:                        'financeiro',
    aguardando_complemento_sac:                             'sac',
};

router.get('/stats', autenticar, async (req, res) => {
    try {
        const perfil = req.usuario.perfil;
        const agora  = new Date();

        const inicioMesAtual    = new Date(agora.getFullYear(), agora.getMonth(), 1);
        const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
        const fimMesAnterior    = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);

        // Query separadas e simples — mais fácil de debugar
        const [qRecs, qAv, qAvPos] = await Promise.all([
            db.query('SELECT id, status, criado_em FROM reclamacoes ORDER BY criado_em DESC'),
            db.query('SELECT reclamacao_id, resultado FROM etapa_avaliacao_qualidade WHERE concluido_em IS NOT NULL'),
            db.query('SELECT reclamacao_id, resultado FROM etapa_avaliacao_qualidade_pos_visita WHERE concluido_em IS NOT NULL'),
        ]);

        const recs = qRecs.rows;
        const avMap = {};
        // Avaliação principal
        for (const av of qAv.rows) avMap[String(av.reclamacao_id)] = av.resultado;
        // Avaliação pós-visita sobrescreve se existir (é a mais recente)
        for (const av of qAvPos.rows) avMap[String(av.reclamacao_id)] = av.resultado;

        const abertas    = recs.filter(r => !['concluida','cancelada'].includes(r.status)).length;
        const concluidas = recs.filter(r => r.status === 'concluida').length;

        const minhasPendencias = perfil === 'admin'
            ? abertas
            : recs.filter(r => statusPerfil[r.status] === perfil).length;

        const mesAtual   = recs.filter(r => new Date(r.criado_em) >= inicioMesAtual).length;
        const mesAnterior = recs.filter(r => {
            const d = new Date(r.criado_em);
            return d >= inicioMesAnterior && d <= fimMesAnterior;
        }).length;

        const procedentes   = Object.values(avMap).filter(v => v === 'procedente').length;
        const improcedentes = Object.values(avMap).filter(v => v === 'improcedente').length;

        // Status que indicam que a reclamação JÁ passou pela análise (não conta como "em análise")
        const statusJaAvaliados = [
            'aguardando_visita_tecnica_qualidade',
            'aguardando_analise_qualidade_pos_visita',
            'aguardando_direcionamento_comercial_pos_visita',
            'aguardando_comercial_procedente',
            'aguardando_comercial_improcedente',
            'aguardando_encerramento_comercial',
            'encaminhando_devolucao_sac',
            'encaminhando_devolucao_conferindo_nf',
            'encaminhando_devolucao_corrigindo_nf',
            'encaminhando_devolucao_sac_solicitar_coleta',
            'encaminhando_devolucao_aguardando_chegada_material',
            'encaminhando_devolucao_aguardando_revisao',
            'encaminhando_devolucao_aguardando_of',
            'encaminhando_devolucao_aguardando_conferencia_material',
            'encaminhando_devolucao_aguardando_correcao_nf_cliente',
            'gerando_credito_sac',
            'gerando_credito_financeiro',
            'aguardando_aprovacao_financeiro',
            'aguardando_complemento_sac',
            'concluida',
            'cancelada',
        ];

        // "Em análise" = abertas que ainda não têm avaliação concluída E não passaram da fase de análise
        // Usa String() para garantir comparação correta entre UUID e string
        const em_analise = recs.filter(r =>
            !statusJaAvaliados.includes(r.status) &&
            !avMap[String(r.id)]
        ).length;

        const nomeMes = (d) => d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        res.json({
            abertas,
            concluidas,
            minhas_pendencias:  minhasPendencias,
            mes_atual:          mesAtual,
            mes_anterior:       mesAnterior,
            nome_mes_atual:     nomeMes(inicioMesAtual),
            nome_mes_anterior:  nomeMes(inicioMesAnterior),
            procedentes,
            improcedentes,
            em_analise,
        });
    } catch (err) {
        console.error('❌ Erro dashboard/stats:', err);
        res.status(500).json({ erro: 'Erro ao carregar estatísticas.' });
    }
});

module.exports = router;

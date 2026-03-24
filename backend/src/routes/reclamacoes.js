const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const { autenticar } = require('../middleware/auth');
const { permitir }   = require('../middleware/permissao');

// Listar todas as reclamações
router.get('/', autenticar, async (req, res) => {
    try {
        const resultado = await db.query(`
            SELECT r.id, r.codigo, r.status, r.nossa_nf, r.lote, r.metragem, r.artigo,
                   r.descricao, r.criado_em, r.atualizado_em, r.concluida_em,
                   c.nome AS cliente_nome,
                   u.nome AS criado_por_nome,
                   aq.resultado AS resultado_analise
            FROM reclamacoes r
            JOIN clientes c ON c.id = r.cliente_id
            JOIN usuarios u ON u.id = r.criado_por
            LEFT JOIN etapa_avaliacao_qualidade aq ON aq.reclamacao_id = r.id
            ORDER BY r.criado_em DESC
        `);
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar reclamações.' });
    }
});

// Buscar uma reclamação completa (todas as etapas)
router.get('/:id', autenticar, async (req, res) => {
    try {
        const { id } = req.params;

        const rec = await db.query(`
            SELECT r.*, c.nome AS cliente_nome, u.nome AS criado_por_nome
            FROM reclamacoes r
            JOIN clientes c ON c.id = r.cliente_id
            JOIN usuarios u ON u.id = r.criado_por
            WHERE r.id = $1
        `, [id]);

        if (!rec.rows.length) return res.status(404).json({ erro: 'Reclamação não encontrada.' });

        // Busca todas as etapas em paralelo
        const [arquivos, historico, avaliacao, direcionamento,
               visita, devolucao, cotacoes, confNF, coleta,
               recebimento, revisao, of, confMaterial, credito,
               defCredito, encerramento, areas, defeitos, avPosVisita, romaneioItens, comentarios, planoAcaoItens] = await Promise.all([
            db.query('SELECT * FROM arquivos WHERE reclamacao_id=$1 ORDER BY enviado_em DESC', [id]),
            db.query('SELECT h.*, u.nome AS usuario_nome FROM historico_status h LEFT JOIN usuarios u ON u.id=h.usuario_id WHERE h.reclamacao_id=$1 ORDER BY h.criado_em ASC', [id]),
            db.query('SELECT * FROM etapa_avaliacao_qualidade WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_direcionamento_comercial WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_visita_tecnica WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_encaminhar_devolucao WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM cotacoes_frete WHERE reclamacao_id=$1 ORDER BY criado_em', [id]),
            db.query('SELECT * FROM etapa_conferencia_nf WHERE reclamacao_id=$1 ORDER BY tentativa DESC LIMIT 1', [id]),
            db.query('SELECT * FROM etapa_solicitar_coleta WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_receber_material WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_revisao_material WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_emitir_of WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_conferencia_material WHERE reclamacao_id=$1 ORDER BY tentativa DESC LIMIT 1', [id]),
            db.query('SELECT * FROM etapa_gerar_credito WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_definir_credito WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_encerramento WHERE reclamacao_id=$1', [id]),
            db.query('SELECT a.* FROM reclamacao_areas ra JOIN areas a ON a.id=ra.area_id WHERE ra.reclamacao_id=$1', [id]),
            db.query('SELECT d.* FROM reclamacao_defeitos rd JOIN defeitos d ON d.id=rd.defeito_id WHERE rd.reclamacao_id=$1', [id]),
            db.query('SELECT * FROM etapa_avaliacao_pos_visita WHERE reclamacao_id=$1', [id]),
            db.query('SELECT * FROM romaneio_itens WHERE reclamacao_id=$1 ORDER BY id', [id]),
            db.query('SELECT c.*, u.nome AS autor_nome, u.perfil AS autor_perfil FROM comentarios_reclamacao c LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.reclamacao_id=$1 ORDER BY c.criado_em ASC', [id]).catch(() => ({ rows: [] })),
            db.query('SELECT * FROM plano_acao_itens WHERE reclamacao_id=$1 ORDER BY criado_em ASC', [id]).catch(() => ({ rows: [] })),
        ]);

        res.json({
            ...rec.rows[0],
            arquivos:        arquivos.rows,
            historico:       historico.rows,
            avaliacao:       avaliacao.rows[0] || null,   // <-- linha faltando
            av_pos_visita:   avPosVisita.rows[0] || null,
            direcionamento:  direcionamento.rows[0] || null,
            visita:          visita.rows[0] || null,
            devolucao:       devolucao.rows[0] || null,
            cotacoes:        cotacoes.rows,
            conferencia_nf:  confNF.rows[0] || null,
            coleta:          coleta.rows[0] || null,
            recebimento:     recebimento.rows[0] || null,
            revisao:         revisao.rows[0] || null,
            of:              of.rows[0] || null,
            conferencia_material: confMaterial.rows[0] || null,
            credito:         credito.rows[0] || null,
            def_credito:     defCredito.rows[0] || null,
            encerramento:    encerramento.rows[0] || null,
            areas:           areas.rows,
            defeitos:        defeitos.rows,
            romaneio_itens:  romaneioItens.rows,
            comentarios:     comentarios.rows,
            plano_acao_itens: planoAcaoItens.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao buscar reclamação.' });
    }
});

// Criar nova reclamação (rascunho)
router.post('/', autenticar, permitir('admin', 'sac'), async (req, res) => {
    try {
        const { cliente_id, nossa_nf, lote, metragem, artigo, descricao, concluir } = req.body;
        if (!cliente_id || !descricao)
            return res.status(400).json({ erro: 'Cliente e descrição são obrigatórios.' });

        const status = concluir ? 'aguardando_analise_qualidade' : 'rascunho';

        const resultado = await db.query(`
            INSERT INTO reclamacoes (cliente_id, nossa_nf, lote, metragem, artigo, descricao, status, criado_por)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [cliente_id, nossa_nf, lote, metragem || null, artigo || null, descricao, status, req.usuario.id]);

        res.status(201).json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao criar reclamação.' });
    }
});

// Atualizar reclamação (só rascunho)
router.put('/:id', autenticar, permitir('admin', 'sac'), async (req, res) => {
    try {
        const { cliente_id, nossa_nf, lote, metragem, artigo, descricao, concluir } = req.body;
        const { id } = req.params;

        const atual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        if (atual.rows[0].status !== 'rascunho')
            return res.status(400).json({ erro: 'Só é possível editar reclamações em rascunho.' });

        const status = concluir ? 'aguardando_analise_qualidade' : 'rascunho';

        const resultado = await db.query(`
            UPDATE reclamacoes SET cliente_id=$1, nossa_nf=$2, lote=$3,
            metragem=$4, artigo=$5, descricao=$6, status=$7 WHERE id=$8 RETURNING *
        `, [cliente_id, nossa_nf, lote, metragem || null, artigo || null, descricao, status, id]);

        res.json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar reclamação.' });
    }
});

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', '..', 'uploads', req.params.id);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext  = path.extname(file.originalname);
        const nome = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
        cb(null, nome);
    }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Upload de arquivos
router.post('/:id/arquivos', autenticar, upload.array('arquivos', 50), async (req, res) => {
    try {
        const { id } = req.params;
        const { etapa, ref_id } = req.body;

        const inseridos = [];
        for (const file of req.files) {
            const resultado = await db.query(`
                INSERT INTO arquivos (reclamacao_id, etapa, ref_id, nome_original, nome_arquivo, caminho, mime_type, tamanho_bytes, enviado_por)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
            `, [id, etapa, ref_id || null, file.originalname, file.filename,
                `/uploads/${id}/${file.filename}`, file.mimetype, file.size, req.usuario.id]);
            inseridos.push(resultado.rows[0]);
        }

        res.json(inseridos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao salvar arquivos.' });
    }
});

// Rascunho da avaliação (salva sem avançar status)
router.post('/:id/avaliacao/rascunho', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { resultado, descricao, causa_raiz, plano_acao, areas, defeitos } = req.body;
        const { id } = req.params;

        const existe = await db.query(
            'SELECT id FROM etapa_avaliacao_qualidade WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                'UPDATE etapa_avaliacao_qualidade SET resultado=$1, descricao=$2, causa_raiz=$3, plano_acao=$4, salvo_em=NOW() WHERE reclamacao_id=$5',
                [resultado || null, descricao || null, causa_raiz || null, plano_acao || null, id]
            );
        } else {
            await db.query(
                'INSERT INTO etapa_avaliacao_qualidade (reclamacao_id, resultado, descricao, causa_raiz, plano_acao, usuario_id, salvo_em) VALUES ($1,$2,$3,$4,$5,$6,NOW())',
                [id, resultado || null, descricao || null, causa_raiz || null, plano_acao || null, req.usuario.id]
            );
        }

        // Salva áreas e defeitos (só atualiza se resultado for procedente)
        if (resultado === 'procedente' && Array.isArray(areas)) {
            await db.query('DELETE FROM reclamacao_areas WHERE reclamacao_id=$1', [id]);
            for (const area_id of areas) {
                await db.query(
                    'INSERT INTO reclamacao_areas (reclamacao_id, area_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                    [id, area_id]
                );
            }
        }
        if (resultado === 'procedente' && Array.isArray(defeitos)) {
            await db.query('DELETE FROM reclamacao_defeitos WHERE reclamacao_id=$1', [id]);
            for (const defeito_id of defeitos) {
                await db.query(
                    'INSERT INTO reclamacao_defeitos (reclamacao_id, defeito_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                    [id, defeito_id]
                );
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho.' });
    }
});

// Concluir avaliação (avança status)
router.post('/:id/avaliacao', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { resultado, descricao, causa_raiz, plano_acao, areas, defeitos } = req.body;
        const { id } = req.params;
        console.log('=== POST /avaliacao ===', { resultado, causa_raiz, plano_acao: plano_acao?.substring(0,100) });

        if (!resultado) return res.status(400).json({ erro: 'Resultado é obrigatório.' });

        // Define próximo status conforme resultado
        const proximoStatus = {
            procedente:     'aguardando_comercial_procedente',
            improcedente:   'aguardando_comercial_procedente',
            visita_tecnica: 'aguardando_visita_tecnica_qualidade',
        }[resultado];
        if (!proximoStatus) return res.status(400).json({ erro: 'Resultado inválido.' });

        // Salva/atualiza etapa de avaliação como concluída
        const existe = await db.query(
            'SELECT id FROM etapa_avaliacao_qualidade WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                'UPDATE etapa_avaliacao_qualidade SET resultado=$1, descricao=$2, causa_raiz=$3, plano_acao=$4, salvo_em=NOW(), concluido_em=NOW(), usuario_id=$5 WHERE reclamacao_id=$6',
                [resultado, descricao || null, causa_raiz || null, plano_acao || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                'INSERT INTO etapa_avaliacao_qualidade (reclamacao_id, resultado, descricao, causa_raiz, plano_acao, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())',
                [id, resultado, descricao || null, causa_raiz || null, plano_acao || null, req.usuario.id]
            );
        }

        // Salva áreas e defeitos
        if (Array.isArray(areas)) {
            await db.query('DELETE FROM reclamacao_areas WHERE reclamacao_id=$1', [id]);
            for (const area_id of areas) {
                await db.query(
                    'INSERT INTO reclamacao_areas (reclamacao_id, area_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                    [id, area_id]
                );
            }
        }
        if (Array.isArray(defeitos)) {
            await db.query('DELETE FROM reclamacao_defeitos WHERE reclamacao_id=$1', [id]);
            for (const defeito_id of defeitos) {
                await db.query(
                    'INSERT INTO reclamacao_defeitos (reclamacao_id, defeito_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                    [id, defeito_id]
                );
            }
        }

        // Avança o status da reclamação
        await db.query(
            'UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2',
            [proximoStatus, id]
        );

        // Sincroniza itens do plano de ação na tabela dedicada
        if (plano_acao) {
            await db.query('DELETE FROM plano_acao_itens WHERE reclamacao_id=$1 AND avaliacao_tipo=$2', [id, 'avaliacao']);
            const linhas = plano_acao.split('\n').filter(l => l.trim());
            for (const linha of linhas) {
                const partes = linha.replace(/^\d+\.\s*/, '').split(' | ');
                const acao = partes[0]?.trim();
                if (!acao) continue;
                const responsavel = (partes.find(p => p.startsWith('Resp:')) || '').replace('Resp:', '').trim() || null;
                const prazoStr    = (partes.find(p => p.startsWith('Prazo:')) || '').replace('Prazo:', '').trim();
                let prazo = null;
                if (prazoStr && prazoStr !== '—') {
                    const [d, m, a] = prazoStr.split('/');
                    if (d && m && a) prazo = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                const statusItem  = (partes.find(p => p.startsWith('Status:')) || '').replace('Status:', '').trim() || 'pendente';
                const eficacia    = (partes.find(p => p.startsWith('Eficácia:')) || '').replace('Eficácia:', '').trim() || null;
                await db.query(
                    `INSERT INTO plano_acao_itens (reclamacao_id, avaliacao_tipo, acao, responsavel, prazo, status, eficacia)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [id, 'avaliacao', acao, responsavel, prazo, statusItem === '—' ? 'pendente' : statusItem, eficacia === '—' ? null : eficacia]
                );
            }
        }

        // Registra no histórico
        await db.query(
            'INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)',
            [id, 'aguardando_analise_qualidade', proximoStatus, req.usuario.id, `Avaliação concluída: ${resultado}.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao concluir avaliação.' });
    }
});

router.post('/:id/direcionamento/rascunho', autenticar, permitir('admin','comercial'), async (req, res) => {
    try {
        const { decisao, descricao_encerramento } = req.body;
        const { id } = req.params;

        const visita_tecnica   = decisao === 'visita_tecnica';
        const havera_devolucao = decisao === 'devolucao';
        const havera_credito   = decisao === 'credito';
        const obs              = descricao_encerramento || null;

        const existe = await db.query(
            'SELECT id FROM etapa_direcionamento_comercial WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_direcionamento_comercial
                 SET visita_tecnica=$1, havera_devolucao=$2, havera_credito=$3,
                     descricao_encerramento=$4, salvo_em=NOW()
                 WHERE reclamacao_id=$5`,
                [visita_tecnica, havera_devolucao, havera_credito, obs, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_direcionamento_comercial
                 (reclamacao_id, visita_tecnica, havera_devolucao, havera_credito,
                  descricao_encerramento, usuario_id, salvo_em)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
                [id, visita_tecnica, havera_devolucao, havera_credito, obs, req.usuario.id]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho.' });
    }
});

// Concluir direcionamento comercial (avança status)
router.post('/:id/direcionamento', autenticar, permitir('admin','comercial'), async (req, res) => {
    try {
        const { decisao, descricao_encerramento } = req.body;
        const { id } = req.params;

        if (!decisao) return res.status(400).json({ erro: 'Selecione uma decisão.' });

        const visita_tecnica   = decisao === 'visita_tecnica';
        const havera_devolucao = decisao === 'devolucao';
        const havera_credito   = decisao === 'credito';
        const obs              = descricao_encerramento || null;

        const proximoStatus = {
            devolucao:      'encaminhando_devolucao_sac',
            credito:        'gerando_credito_sac',
            nenhum:         'aguardando_encerramento_comercial',
            visita_tecnica: 'aguardando_visita_tecnica_qualidade',
        }[decisao];
        if (!proximoStatus) return res.status(400).json({ erro: 'Decisão inválida.' });

        // Busca status atual para histórico
        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        // Salva/atualiza etapa de direcionamento como concluída
        const existe = await db.query(
            'SELECT id FROM etapa_direcionamento_comercial WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_direcionamento_comercial
                 SET visita_tecnica=$1, "havera_devolucao"=$2, "havera_credito"=$3,
                     descricao_encerramento=$4,
                     usuario_id=$5, salvo_em=NOW(), concluido_em=NOW()
                 WHERE reclamacao_id=$6`,
                [visita_tecnica, havera_devolucao, havera_credito, obs, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_direcionamento_comercial
                 (reclamacao_id, visita_tecnica, "havera_devolucao", "havera_credito",
                  descricao_encerramento, usuario_id, salvo_em, concluido_em)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
                [id, visita_tecnica, havera_devolucao, havera_credito, obs, req.usuario.id]
            );
        }

        // Se for visita técnica, limpa a etapa de visita anterior para permitir nova entrada
        if (visita_tecnica) {
            await db.query(
                `UPDATE etapa_visita_tecnica
                 SET concluido_em=NULL, salvo_em=NOW()
                 WHERE reclamacao_id=$1`,
                [id]
            );
        }

        // Avança status
        await db.query(
            'UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2',
            [proximoStatus, id]
        );

        // Registra no histórico
        const obsHist = {
            devolucao:      'Comercial direcionou para Devolução do Material.',
            credito:        'Comercial direcionou para Geração de Crédito.',
            nenhum:         'Comercial direcionou para Encerramento Direto.',
            visita_tecnica: 'Comercial solicitou Visita Técnica. Retornando para Qualidade.',
        }[decisao];

        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, obsHist]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao concluir direcionamento.' });
    }
});

// Rascunho da visita técnica
router.post('/:id/visita/rascunho', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { data_visita, hora_visita, responsavel_cliente, descricao } = req.body;
        const { id } = req.params;

        const existe = await db.query(
            'SELECT id FROM etapa_visita_tecnica WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_visita_tecnica
                 SET data_visita=$1, hora_visita=$2, responsavel_cliente=$3, descricao=$4, salvo_em=NOW()
                 WHERE reclamacao_id=$5`,
                [data_visita || null, hora_visita || null, responsavel_cliente || null, descricao || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_visita_tecnica
                 (reclamacao_id, data_visita, hora_visita, responsavel_cliente, descricao, usuario_id, salvo_em)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
                [id, data_visita || null, hora_visita || null, responsavel_cliente || null, descricao || null, req.usuario.id]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho da visita.' });
    }
});

// Concluir visita técnica (avança para 2ª avaliação da qualidade)
router.post('/:id/visita', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { data_visita, hora_visita, responsavel_cliente, descricao } = req.body;
        const { id } = req.params;

        if (!data_visita) return res.status(400).json({ erro: 'Data da visita é obrigatória.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query(
            'SELECT id FROM etapa_visita_tecnica WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_visita_tecnica
                 SET data_visita=$1, hora_visita=$2, responsavel_cliente=$3, descricao=$4,
                     usuario_id=$5, salvo_em=NOW(), concluido_em=NOW()
                 WHERE reclamacao_id=$6`,
                [data_visita, hora_visita || null, responsavel_cliente || null, descricao || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_visita_tecnica
                 (reclamacao_id, data_visita, hora_visita, responsavel_cliente, descricao, usuario_id, salvo_em, concluido_em)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
                [id, data_visita, hora_visita || null, responsavel_cliente || null, descricao || null, req.usuario.id]
            );
        }

        // Avança para 2ª avaliação da qualidade
        const proximoStatus = 'aguardando_analise_qualidade_pos_visita';
        await db.query(
            'UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2',
            [proximoStatus, id]
        );

        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, 'Visita técnica concluída. Aguardando 2ª avaliação da Qualidade.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao concluir visita.' });
    }
});

// Rascunho da 2ª avaliação (pós-visita)
router.post('/:id/avaliacao-pos-visita/rascunho', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { resultado, descricao, causa_raiz, plano_acao, areas, defeitos } = req.body;
        const { id } = req.params;

        const existe = await db.query(
            'SELECT id FROM etapa_avaliacao_pos_visita WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_avaliacao_pos_visita
                 SET resultado=$1, descricao=$2, causa_raiz=$3, plano_acao=$4, salvo_em=NOW()
                 WHERE reclamacao_id=$5`,
                [resultado || null, descricao || null, causa_raiz || null, plano_acao || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_avaliacao_pos_visita
                 (reclamacao_id, resultado, descricao, causa_raiz, plano_acao, usuario_id, salvo_em)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
                [id, resultado || null, descricao || null, causa_raiz || null, plano_acao || null, req.usuario.id]
            );
        }

        if (resultado === 'procedente' && Array.isArray(areas)) {
            await db.query('DELETE FROM reclamacao_areas WHERE reclamacao_id=$1', [id]);
            for (const area_id of areas) {
                await db.query('INSERT INTO reclamacao_areas (reclamacao_id, area_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, area_id]);
            }
        }
        if (resultado === 'procedente' && Array.isArray(defeitos)) {
            await db.query('DELETE FROM reclamacao_defeitos WHERE reclamacao_id=$1', [id]);
            for (const defeito_id of defeitos) {
                await db.query('INSERT INTO reclamacao_defeitos (reclamacao_id, defeito_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, defeito_id]);
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho.' });
    }
});

// Concluir 2ª avaliação pós-visita
router.post('/:id/avaliacao-pos-visita', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { resultado, descricao, causa_raiz, plano_acao, areas, defeitos } = req.body;
        const { id } = req.params;

        if (!resultado) return res.status(400).json({ erro: 'Resultado é obrigatório.' });

        const proximoStatus = 'aguardando_comercial_procedente';
        
        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query(
            'SELECT id FROM etapa_avaliacao_pos_visita WHERE reclamacao_id=$1', [id]
        );
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_avaliacao_pos_visita
                 SET resultado=$1, descricao=$2, causa_raiz=$3, plano_acao=$4,
                     usuario_id=$5, salvo_em=NOW(), concluido_em=NOW()
                 WHERE reclamacao_id=$6`,
                [resultado, descricao || null, causa_raiz || null, plano_acao || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_avaliacao_pos_visita
                 (reclamacao_id, resultado, descricao, causa_raiz, plano_acao, usuario_id, salvo_em, concluido_em)
                 VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
                [id, resultado, descricao || null, causa_raiz || null, plano_acao || null, req.usuario.id]
            );
        }

        if (Array.isArray(areas)) {
            await db.query('DELETE FROM reclamacao_areas WHERE reclamacao_id=$1', [id]);
            for (const area_id of areas) {
                await db.query('INSERT INTO reclamacao_areas (reclamacao_id, area_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, area_id]);
            }
        }
        if (Array.isArray(defeitos)) {
            await db.query('DELETE FROM reclamacao_defeitos WHERE reclamacao_id=$1', [id]);
            for (const defeito_id of defeitos) {
                await db.query('INSERT INTO reclamacao_defeitos (reclamacao_id, defeito_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, defeito_id]);
            }
        }

        await db.query(
            'UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2',
            [proximoStatus, id]
        );

        // Sincroniza itens do plano na tabela dedicada
        if (plano_acao) {
            await db.query('DELETE FROM plano_acao_itens WHERE reclamacao_id=$1 AND avaliacao_tipo=$2', [id, 'avaliacao_pos_visita']);
            const linhas = plano_acao.split('\n').filter(l => l.trim());
            for (const linha of linhas) {
                const partes = linha.replace(/^\d+\.\s*/, '').split(' | ');
                const acao = partes[0]?.trim();
                if (!acao) continue;
                const responsavel = (partes.find(p => p.startsWith('Resp:')) || '').replace('Resp:', '').trim() || null;
                const prazoStr    = (partes.find(p => p.startsWith('Prazo:')) || '').replace('Prazo:', '').trim();
                let prazo = null;
                if (prazoStr && prazoStr !== '—') {
                    const [d, m, a] = prazoStr.split('/');
                    if (d && m && a) prazo = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                const statusItem = (partes.find(p => p.startsWith('Status:')) || '').replace('Status:', '').trim() || 'pendente';
                const eficacia   = (partes.find(p => p.startsWith('Eficácia:')) || '').replace('Eficácia:', '').trim() || null;
                await db.query(
                    `INSERT INTO plano_acao_itens (reclamacao_id, avaliacao_tipo, acao, responsavel, prazo, status, eficacia)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [id, 'avaliacao_pos_visita', acao, responsavel, prazo, statusItem === '—' ? 'pendente' : statusItem, eficacia === '—' ? null : eficacia]
                );
            }
        }

        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `2ª Avaliação concluída: ${resultado}.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao concluir 2ª avaliação.' });
    }
});

// Encerrar reclamação
router.post('/:id/encerrar', autenticar, permitir('admin','comercial','qualidade'), async (req, res) => {
    try {
        const { descricao } = req.body;
        const { id } = req.params;

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_encerramento WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                'UPDATE etapa_encerramento SET descricao=$1, usuario_id=$2, concluido_em=NOW() WHERE reclamacao_id=$3',
                [descricao || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                'INSERT INTO etapa_encerramento (reclamacao_id, descricao, usuario_id, concluido_em) VALUES ($1,$2,$3,NOW())',
                [id, descricao || null, req.usuario.id]
            );
        }

        await db.query(
            'UPDATE reclamacoes SET status=$1, concluida_em=NOW(), atualizado_em=NOW() WHERE id=$2',
            ['concluida', id]
        );

        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, 'concluida', req.usuario.id, 'Reclamação encerrada.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao encerrar reclamação.' });
    }
});


// ============================================================
// FLUXO DE DEVOLUÇÃO
// ============================================================

// --- ETAPA SAC: Confirmar quantidade e cotar fretes ---

router.post('/:id/devolucao/rascunho', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { quantidade_confirmada, observacoes, cotacoes } = req.body;
        const { id } = req.params;

        const existe = await db.query('SELECT id FROM etapa_encaminhar_devolucao WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_encaminhar_devolucao SET quantidade_confirmada=$1, observacoes=$2, salvo_em=NOW() WHERE reclamacao_id=$3`,
                [quantidade_confirmada || null, observacoes || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_encaminhar_devolucao (reclamacao_id, quantidade_confirmada, observacoes, usuario_id, salvo_em) VALUES ($1,$2,$3,$4,NOW())`,
                [id, quantidade_confirmada || null, observacoes || null, req.usuario.id]
            );
        }

        if (Array.isArray(cotacoes)) {
            await db.query('DELETE FROM cotacoes_frete WHERE reclamacao_id=$1', [id]);
            for (const c of cotacoes) {
                if (c.transportadora) {
                    await db.query(
                        `INSERT INTO cotacoes_frete (reclamacao_id, transportadora, valor, escolhida) VALUES ($1,$2,$3,$4)`,
                        [id, c.transportadora, c.valor || null, c.escolhida || false]
                    );
                }
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho.' });
    }
});

router.post('/:id/devolucao/confirmar', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { quantidade_confirmada, observacoes, cotacoes, transportadora_escolhida } = req.body;
        const { id } = req.params;

        if (!quantidade_confirmada) return res.status(400).json({ erro: 'Quantidade é obrigatória.' });
        if (!transportadora_escolhida) return res.status(400).json({ erro: 'Selecione a transportadora.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_encaminhar_devolucao WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_encaminhar_devolucao SET quantidade_confirmada=$1, transportadora_escolhida=$2, observacoes=$3, usuario_id=$4, salvo_em=NOW() WHERE reclamacao_id=$5`,
                [quantidade_confirmada, transportadora_escolhida, observacoes || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_encaminhar_devolucao (reclamacao_id, quantidade_confirmada, transportadora_escolhida, observacoes, usuario_id, salvo_em) VALUES ($1,$2,$3,$4,$5,NOW())`,
                [id, quantidade_confirmada, transportadora_escolhida, observacoes || null, req.usuario.id]
            );
        }

        if (Array.isArray(cotacoes)) {
            await db.query('DELETE FROM cotacoes_frete WHERE reclamacao_id=$1', [id]);
            for (const c of cotacoes) {
                if (c.transportadora) {
                    await db.query(
                        `INSERT INTO cotacoes_frete (reclamacao_id, transportadora, valor, escolhida) VALUES ($1,$2,$3,$4)`,
                        [id, c.transportadora, c.valor || null, c.transportadora === transportadora_escolhida]
                    );
                }
            }
        }

        const proximoStatus = 'encaminhando_devolucao_conferindo_nf';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `SAC confirmou quantidade (${quantidade_confirmada}m) e escolheu transportadora: ${transportadora_escolhida}. Aguardando NF do cliente.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao confirmar devolução.' });
    }
});

// --- ETAPA SAC: Receber NF do cliente e enviar para Fiscal ---

router.post('/:id/devolucao/nf', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { nf_cliente_url, observacoes_nf } = req.body;
        const { id } = req.params;

        if (!nf_cliente_url) return res.status(400).json({ erro: 'Anexo da NF é obrigatório.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        await db.query(
            `UPDATE etapa_encaminhar_devolucao SET nf_cliente_url=$1, observacoes_nf=$2, nf_cliente_recebida_em=NOW(), salvo_em=NOW() WHERE reclamacao_id=$3`,
            [nf_cliente_url, observacoes_nf || null, id]
        );

        const proximoStatus = 'encaminhando_devolucao_conferindo_nf_fiscal';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, 'NF do cliente recebida. Enviada para conferência do Fiscal.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar NF.' });
    }
});

// --- ETAPA FISCAL: Conferir NF ---

router.post('/:id/devolucao/conferencia-nf', autenticar, permitir('admin','fiscal'), async (req, res) => {
    try {
        const { nf_ok, descricao } = req.body;
        const { id } = req.params;

        if (nf_ok === undefined || nf_ok === null) return res.status(400).json({ erro: 'Informe se a NF está OK.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const ultimaTentativa = await db.query(
            'SELECT COALESCE(MAX(tentativa),0) AS max FROM etapa_conferencia_nf WHERE reclamacao_id=$1', [id]
        );
        const tentativa = parseInt(ultimaTentativa.rows[0].max) + 1;

        await db.query(
            `INSERT INTO etapa_conferencia_nf (reclamacao_id, nf_ok, descricao, usuario_id, salvo_em, concluido_em, tentativa) VALUES ($1,$2,$3,$4,NOW(),NOW(),$5)`,
            [id, nf_ok, descricao || null, req.usuario.id, tentativa]
        );

        const proximoStatus = nf_ok ? 'encaminhando_devolucao_sac_solicitar_coleta' : 'encaminhando_devolucao_corrigindo_nf';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, nf_ok ? 'Fiscal aprovou a NF. SAC pode solicitar coleta.' : `Fiscal reprovnou a NF: ${descricao}`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao conferir NF.' });
    }
});

// --- ETAPA SAC: Corrigir NF e reenviar ---

router.post('/:id/devolucao/corrigir-nf', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { nf_cliente_url, observacoes_nf } = req.body;
        const { id } = req.params;

        if (!nf_cliente_url) return res.status(400).json({ erro: 'Anexo da NF corrigida é obrigatório.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        await db.query(
            `UPDATE etapa_encaminhar_devolucao SET nf_cliente_url=$1, observacoes_nf=$2, nf_cliente_recebida_em=NOW(), salvo_em=NOW() WHERE reclamacao_id=$3`,
            [nf_cliente_url, observacoes_nf || null, id]
        );

        const proximoStatus = 'encaminhando_devolucao_conferindo_nf_fiscal';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, 'SAC reenviou NF corrigida para conferência do Fiscal.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao reenviar NF.' });
    }
});

// --- ETAPA SAC: Solicitar coleta ---

router.post('/:id/devolucao/coleta/rascunho', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { transportadora, nf_coleta, data_coleta, data_prevista_chegada, observacoes } = req.body;
        const { id } = req.params;

        const existe = await db.query('SELECT id FROM etapa_solicitar_coleta WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_solicitar_coleta SET transportadora=$1, nf_coleta=$2, data_coleta=$3, data_prevista_chegada=$4, observacoes=$5, salvo_em=NOW() WHERE reclamacao_id=$6`,
                [transportadora || null, nf_coleta || null, data_coleta || null, data_prevista_chegada || null, observacoes || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_solicitar_coleta (reclamacao_id, transportadora, nf_coleta, data_coleta, data_prevista_chegada, observacoes, usuario_id, salvo_em) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
                [id, transportadora || null, nf_coleta || null, data_coleta || null, data_prevista_chegada || null, observacoes || null, req.usuario.id]
            );
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho.' });
    }
});

router.post('/:id/devolucao/coleta', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { transportadora, nf_coleta, data_coleta, data_prevista_chegada, observacoes } = req.body;
        const { id } = req.params;

        if (!transportadora) return res.status(400).json({ erro: 'Transportadora é obrigatória.' });
        if (!data_coleta) return res.status(400).json({ erro: 'Data da coleta é obrigatória.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_solicitar_coleta WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_solicitar_coleta SET transportadora=$1, nf_coleta=$2, data_coleta=$3, data_prevista_chegada=$4, observacoes=$5, usuario_id=$6, salvo_em=NOW(), concluido_em=NOW() WHERE reclamacao_id=$7`,
                [transportadora, nf_coleta || null, data_coleta, data_prevista_chegada || null, observacoes || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_solicitar_coleta (reclamacao_id, transportadora, nf_coleta, data_coleta, data_prevista_chegada, observacoes, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
                [id, transportadora, nf_coleta || null, data_coleta, data_prevista_chegada || null, observacoes || null, req.usuario.id]
            );
        }

        const proximoStatus = 'encaminhando_devolucao_aguardando_chegada_material';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `Coleta solicitada via ${transportadora}. Previsão de chegada: ${data_prevista_chegada || '—'}.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao solicitar coleta.' });
    }
});


// ============================================================
// FLUXO PÓS-COLETA: Expedição → Revisão → PCP → Fiscal → SAC → Comercial
// ============================================================

// --- ETAPA EXPEDIÇÃO: Receber material ---
router.post('/:id/receber-material', autenticar, permitir('admin','expedicao'), async (req, res) => {
    try {
        const { observacoes, data_recebimento } = req.body;
        const { id } = req.params;
        const dataReal = data_recebimento ? new Date(data_recebimento) : new Date();

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_receber_material WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_receber_material SET observacoes=$1, usuario_id=$2, salvo_em=NOW(), concluido_em=$3 WHERE reclamacao_id=$4`,
                [observacoes || null, req.usuario.id, dataReal, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_receber_material (reclamacao_id, observacoes, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,NOW(),$4)`,
                [id, observacoes || null, req.usuario.id, dataReal]
            );
        }

        const proximoStatus = 'encaminhando_devolucao_aguardando_revisao';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, 'Expedição confirmou recebimento do material. Aguardando revisão.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar recebimento.' });
    }
});

// --- ETAPA REVISÃO: Revisar material e preencher romaneio ---
router.post('/:id/revisao/rascunho', autenticar, permitir('admin','revisao'), async (req, res) => {
    try {
        const { descricao, revisora, itens } = req.body;
        const { id } = req.params;

        const existe = await db.query('SELECT id FROM etapa_revisao_material WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_revisao_material SET descricao=$1, revisora=$2, salvo_em=NOW() WHERE reclamacao_id=$3`,
                [descricao || null, revisora || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_revisao_material (reclamacao_id, descricao, revisora, usuario_id, salvo_em) VALUES ($1,$2,$3,$4,NOW())`,
                [id, descricao || null, revisora || null, req.usuario.id]
            );
        }

        if (Array.isArray(itens)) {
            await db.query('DELETE FROM romaneio_itens WHERE reclamacao_id=$1', [id]);
            for (const item of itens) {
                if (item.codigo_produto) {
                    await db.query(
                        `INSERT INTO romaneio_itens (reclamacao_id, codigo_produto, qualidade, metros) VALUES ($1,$2,$3,$4)`,
                        [id, item.codigo_produto, item.qualidade || null, item.metros || null]
                    );
                }
            }
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar rascunho da revisão.' });
    }
});

router.post('/:id/revisao', autenticar, permitir('admin','revisao'), async (req, res) => {
    try {
        const { descricao, revisora, itens } = req.body;
        const { id } = req.params;

        if (!revisora) return res.status(400).json({ erro: 'Informe a revisora.' });
        if (!Array.isArray(itens) || itens.filter(i => i.codigo_produto).length === 0)
            return res.status(400).json({ erro: 'Preencha ao menos um item no romaneio.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_revisao_material WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_revisao_material SET descricao=$1, revisora=$2, usuario_id=$3, salvo_em=NOW(), concluido_em=NOW() WHERE reclamacao_id=$4`,
                [descricao || null, revisora, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_revisao_material (reclamacao_id, descricao, revisora, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
                [id, descricao || null, revisora, req.usuario.id]
            );
        }

        await db.query('DELETE FROM romaneio_itens WHERE reclamacao_id=$1', [id]);
        for (const item of itens) {
            if (item.codigo_produto) {
                await db.query(
                    `INSERT INTO romaneio_itens (reclamacao_id, codigo_produto, qualidade, metros) VALUES ($1,$2,$3,$4)`,
                    [id, item.codigo_produto, item.qualidade || null, item.metros || null]
                );
            }
        }

        const proximoStatus = 'encaminhando_devolucao_aguardando_conferencia_material';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `Revisão concluída por ${revisora}. Aguardando conferência NF x Romaneio pelo Fiscal.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao concluir revisão.' });
    }
});

// --- ETAPA PCP: Emitir OF ---
router.post('/:id/of', autenticar, permitir('admin','pcp'), async (req, res) => {
    try {
        const { numero_of } = req.body;
        const { id } = req.params;

        if (!numero_of) return res.status(400).json({ erro: 'Número da OF é obrigatório.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_emitir_of WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_emitir_of SET numero_of=$1, usuario_id=$2, salvo_em=NOW(), concluido_em=NOW() WHERE reclamacao_id=$3`,
                [numero_of, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_emitir_of (reclamacao_id, numero_of, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,NOW(),NOW())`,
                [id, numero_of, req.usuario.id]
            );
        }

        const proximoStatus = 'gerando_credito_sac';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `PCP emitiu OF nº ${numero_of}. SAC define forma de crédito com o cliente.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao emitir OF.' });
    }
});

// --- ETAPA FISCAL: Conferir NF x Romaneio ---
router.post('/:id/conferencia-material', autenticar, permitir('admin','fiscal'), async (req, res) => {
    try {
        const { romaneio_nf_ok, descricao, valor_credito } = req.body;
        const { id } = req.params;

        if (romaneio_nf_ok === undefined || romaneio_nf_ok === null)
            return res.status(400).json({ erro: 'Informe se NF x Romaneio está OK.' });
        if (!romaneio_nf_ok && !descricao)
            return res.status(400).json({ erro: 'Descreva o problema encontrado.' });
        if (romaneio_nf_ok && !valor_credito)
            return res.status(400).json({ erro: 'Informe o valor do crédito.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const ultimaTentativa = await db.query(
            'SELECT COALESCE(MAX(tentativa),0) AS max FROM etapa_conferencia_material WHERE reclamacao_id=$1', [id]
        );
        const tentativa = parseInt(ultimaTentativa.rows[0].max) + 1;

        await db.query(
            `INSERT INTO etapa_conferencia_material (reclamacao_id, romaneio_nf_ok, descricao, usuario_id, salvo_em, concluido_em, tentativa) VALUES ($1,$2,$3,$4,NOW(),NOW(),$5)`,
            [id, romaneio_nf_ok, descricao || null, req.usuario.id, tentativa]
        );

        let proximoStatus, obsHist;
        if (romaneio_nf_ok) {
            // Salva o crédito gerado pelo fiscal
            const existeCredito = await db.query('SELECT id FROM etapa_gerar_credito WHERE reclamacao_id=$1', [id]);
            if (existeCredito.rows.length > 0) {
                await db.query(
                    `UPDATE etapa_gerar_credito SET valor_credito=$1, usuario_id=$2, salvo_em=NOW(), concluido_em=NOW() WHERE reclamacao_id=$3`,
                    [valor_credito, req.usuario.id, id]
                );
            } else {
                await db.query(
                    `INSERT INTO etapa_gerar_credito (reclamacao_id, valor_credito, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,NOW(),NOW())`,
                    [id, valor_credito, req.usuario.id]
                );
            }
            proximoStatus = 'encaminhando_devolucao_aguardando_of';
            obsHist = `Fiscal aprovou NF x Romaneio. Crédito de R$ ${valor_credito} gerado. Aguardando OF do PCP.`;
        } else {
            proximoStatus = 'encaminhando_devolucao_aguardando_correcao_nf_cliente';
            obsHist = `Fiscal reprovou NF x Romaneio (tentativa ${tentativa}): ${descricao}`;
        }

        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, obsHist]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar conferência.' });
    }
});

// --- ETAPA SAC: Tratar divergência com cliente (NF reprovada pelo Fiscal) ---
router.post('/:id/tratar-divergencia', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { observacoes, nf_nova_url } = req.body;
        const { id } = req.params;

        if (!nf_nova_url) return res.status(400).json({ erro: 'Anexe a nova NF do cliente.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        // Atualiza a NF na etapa de devolução
        await db.query(
            `UPDATE etapa_encaminhar_devolucao SET nf_cliente_url=$1, observacoes_nf=$2, nf_cliente_recebida_em=NOW(), salvo_em=NOW() WHERE reclamacao_id=$3`,
            [nf_nova_url, observacoes || null, id]
        );

        const proximoStatus = 'encaminhando_devolucao_aguardando_conferencia_material';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, 'SAC tratou divergência com cliente e enviou nova NF para conferência do Fiscal.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao tratar divergência.' });
    }
});

// --- FLUXO CRÉDITO DIRETO: SAC envia NF do cliente para o Fiscal ---
router.post('/:id/credito/nf', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { nf_cliente_url, observacoes } = req.body;
        const { id } = req.params;

        if (!nf_cliente_url) return res.status(400).json({ erro: 'Anexe a NF do cliente.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        // Salva na etapa de devolução (reutilizando a estrutura existente)
        const existe = await db.query('SELECT id FROM etapa_encaminhar_devolucao WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_encaminhar_devolucao SET nf_cliente_url=$1, observacoes_nf=$2, nf_cliente_recebida_em=NOW(), salvo_em=NOW() WHERE reclamacao_id=$3`,
                [nf_cliente_url, observacoes || null, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_encaminhar_devolucao (reclamacao_id, nf_cliente_url, observacoes_nf, nf_cliente_recebida_em, usuario_id, salvo_em) VALUES ($1,$2,$3,NOW(),$4,NOW())`,
                [id, nf_cliente_url, observacoes || null, req.usuario.id]
            );
        }

        const proximoStatus = 'gerando_credito_financeiro';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, 'SAC enviou NF do cliente. Aguardando Fiscal informar valor do crédito.']
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao enviar NF.' });
    }
});

// --- FLUXO CRÉDITO DIRETO: Fiscal informa valor do crédito ---
router.post('/:id/credito/fiscal', autenticar, permitir('admin','fiscal'), async (req, res) => {
    try {
        const { valor_credito, observacoes } = req.body;
        const { id } = req.params;

        if (!valor_credito) return res.status(400).json({ erro: 'Informe o valor do crédito.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_gerar_credito WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_gerar_credito SET valor_credito=$1, usuario_id=$2, salvo_em=NOW(), concluido_em=NOW() WHERE reclamacao_id=$3`,
                [valor_credito, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_gerar_credito (reclamacao_id, valor_credito, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,NOW(),NOW())`,
                [id, valor_credito, req.usuario.id]
            );
        }

        const proximoStatus = 'gerando_credito_sac';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `Fiscal informou crédito de R$ ${valor_credito}. SAC define forma de crédito com o cliente.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao informar crédito.' });
    }
});


// --- FLUXO CRÉDITO DIRETO: Fiscal reprova NF ---
router.post('/:id/credito/fiscal-reprovar', autenticar, permitir('admin','fiscal'), async (req, res) => {
    try {
        const { motivo } = req.body;
        const { id } = req.params;

        if (!motivo) return res.status(400).json({ erro: 'Descreva o motivo da reprovação.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        // Salva o motivo no histórico para o SAC visualizar
        const proximoStatus = 'encaminhando_devolucao_aguardando_correcao_nf_cliente';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `Fiscal reprovou NF (crédito direto): ${motivo}`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao reprovar NF.' });
    }
});

router.post('/:id/credito/forma', autenticar, permitir('admin','sac'), async (req, res) => {
    try {
        const { tipo_credito, descricao } = req.body;
        const { id } = req.params;

        if (!tipo_credito) return res.status(400).json({ erro: 'Selecione a forma de crédito.' });

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const existe = await db.query('SELECT id FROM etapa_definir_credito WHERE reclamacao_id=$1', [id]);
        if (existe.rows.length > 0) {
            await db.query(
                `UPDATE etapa_definir_credito SET tipo_credito=$1, descricao=$2, usuario_id=$3, salvo_em=NOW(), concluido_em=NOW() WHERE reclamacao_id=$4`,
                [tipo_credito, descricao || null, req.usuario.id, id]
            );
        } else {
            await db.query(
                `INSERT INTO etapa_definir_credito (reclamacao_id, tipo_credito, descricao, usuario_id, salvo_em, concluido_em) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
                [id, tipo_credito, descricao || null, req.usuario.id]
            );
        }

        const proximoStatus = 'aguardando_aprovacao_financeiro';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `SAC definiu forma de crédito: ${tipo_credito}. Aguardando aprovação do Financeiro.`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao definir forma de crédito.' });
    }
});

// --- FLUXO CRÉDITO DIRETO: Financeiro toma ciência e encaminha para encerramento ---
router.post('/:id/credito/financeiro', autenticar, permitir('admin','financeiro'), async (req, res) => {
    try {
        const { observacoes } = req.body;
        const { id } = req.params;

        const recAtual = await db.query('SELECT status FROM reclamacoes WHERE id=$1', [id]);
        const statusAnterior = recAtual.rows[0]?.status;

        const proximoStatus = 'aguardando_encerramento_comercial';
        await db.query('UPDATE reclamacoes SET status=$1, atualizado_em=NOW() WHERE id=$2', [proximoStatus, id]);
        await db.query(
            `INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo, usuario_id, observacao) VALUES ($1,$2,$3,$4,$5)`,
            [id, statusAnterior, proximoStatus, req.usuario.id, `Financeiro tomou ciência do crédito. ${observacoes ? 'Obs: ' + observacoes : 'Aguardando encerramento pelo Comercial.'}`]
        );

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao confirmar ciência do financeiro.' });
    }
});

// --- COMENTÁRIOS ---
router.post('/:id/comentarios', autenticar, async (req, res) => {
    try {
        const { texto } = req.body;
        const { id } = req.params;
        if (!texto || !texto.trim()) return res.status(400).json({ erro: 'O comentário não pode estar vazio.' });
        const result = await db.query(
            `INSERT INTO comentarios_reclamacao (reclamacao_id, usuario_id, texto, criado_em)
             VALUES ($1, $2, $3, NOW()) RETURNING *`,
            [id, req.usuario.id, texto.trim()]
        );
        const comentario = result.rows[0];
        // Busca nome do autor para retornar completo
        const usuario = await db.query('SELECT nome, perfil FROM usuarios WHERE id=$1', [req.usuario.id]);
        res.json({ ...comentario, autor_nome: usuario.rows[0]?.nome, autor_perfil: usuario.rows[0]?.perfil });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao salvar comentário.' });
    }
});

router.delete('/:id/comentarios/:comentarioId', autenticar, async (req, res) => {
    try {
        const { id, comentarioId } = req.params;
        // Só o próprio autor ou admin pode excluir
        const c = await db.query('SELECT usuario_id FROM comentarios_reclamacao WHERE id=$1 AND reclamacao_id=$2', [comentarioId, id]);
        if (!c.rows.length) return res.status(404).json({ erro: 'Comentário não encontrado.' });
        if (c.rows[0].usuario_id !== req.usuario.id && req.usuario.perfil !== 'admin') {
            return res.status(403).json({ erro: 'Sem permissão para excluir este comentário.' });
        }
        await db.query('DELETE FROM comentarios_reclamacao WHERE id=$1', [comentarioId]);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao excluir comentário.' });
    }
});

// ============================================================
// PLANO DE AÇÃO — ITENS
// ============================================================

// ATENÇÃO: rota estática DEVE vir antes de rotas com parâmetro /:id
// GET overview — todos os itens pendentes/em andamento (para página de followup)
router.get('/plano-acao/pendentes', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { status } = req.query;
        const where = status ? `AND p.status = $1` : `AND (p.status != 'concluido' OR (p.status = 'concluido' AND (p.eficacia IS NULL OR p.eficacia = '')))`;
        const params = status ? [status] : [];
        const r = await db.query(
            `SELECT p.*, r.codigo, r.descricao AS rec_descricao,
                    c.nome AS cliente_nome, r.status AS rec_status
             FROM plano_acao_itens p
             JOIN reclamacoes r ON r.id = p.reclamacao_id
             LEFT JOIN clientes c ON c.id = r.cliente_id
             WHERE 1=1 ${where}
             ORDER BY p.prazo ASC NULLS LAST, p.criado_em ASC`,
            params
        );
        const rows = r.rows.map(row => ({
            ...row,
            codigo: row.codigo ? 'REC-' + String(row.codigo).padStart(6, '0') : '—'
        }));
        res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao buscar pendências.' }); }
});

// GET todos os itens de uma reclamação
router.get('/:id/plano-acao', autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        const r = await db.query(
            `SELECT p.*, r.numero, r.descricao AS rec_descricao,
                    c.nome AS cliente_nome
             FROM plano_acao_itens p
             JOIN reclamacoes r ON r.id = p.reclamacao_id
             LEFT JOIN clientes c ON c.id = r.cliente_id
             WHERE p.reclamacao_id = $1
             ORDER BY p.criado_em ASC`,
            [id]
        );
        res.json(r.rows);
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao buscar plano.' }); }
});

// GET overview — todos os itens pendentes/em andamento (para página de followup)
// POST — criar item do plano
router.post('/:id/plano-acao', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { id } = req.params;
        const { acao, responsavel, prazo, avaliacao_tipo } = req.body;
        if (!acao?.trim()) return res.status(400).json({ erro: 'Descrição da ação é obrigatória.' });
        const r = await db.query(
            `INSERT INTO plano_acao_itens (reclamacao_id, avaliacao_tipo, acao, responsavel, prazo)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, avaliacao_tipo || 'avaliacao', acao.trim(), responsavel || null, prazo || null]
        );
        res.json(r.rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao criar item.' }); }
});

// PATCH — atualizar item (status, eficacia, prazo, observacao)
router.patch('/:id/plano-acao/:itemId', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { itemId } = req.params;
        const { status, eficacia, prazo, observacao, acao, responsavel } = req.body;
        const r = await db.query(
            `UPDATE plano_acao_itens SET
                status      = COALESCE($1, status),
                eficacia    = COALESCE($2, eficacia),
                prazo       = COALESCE($3::date, prazo),
                observacao  = COALESCE($4, observacao),
                acao        = COALESCE($5, acao),
                responsavel = COALESCE($6, responsavel),
                atualizado_em = NOW()
             WHERE id = $7 RETURNING *`,
            [status||null, eficacia||null, prazo||null, observacao||null, acao||null, responsavel||null, itemId]
        );
        if (!r.rows.length) return res.status(404).json({ erro: 'Item não encontrado.' });
        res.json(r.rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao atualizar item.' }); }
});

// DELETE — remover item
router.delete('/:id/plano-acao/:itemId', autenticar, permitir('admin','qualidade'), async (req, res) => {
    try {
        const { itemId } = req.params;
        await db.query('DELETE FROM plano_acao_itens WHERE id=$1', [itemId]);
        res.json({ ok: true });
    } catch (err) { console.error(err); res.status(500).json({ erro: 'Erro ao remover item.' }); }
});


// DELETE — remover arquivo
router.delete('/:id/arquivos/:arquivoId', autenticar, async (req, res) => {
    try {
        const { id, arquivoId } = req.params;
        const arq = await db.query('SELECT * FROM arquivos WHERE id=$1 AND reclamacao_id=$2', [arquivoId, id]);
        if (!arq.rows.length) return res.status(404).json({ erro: 'Arquivo não encontrado.' });

        // Remove do disco
        const caminho = arq.rows[0].nome_arquivo;
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', '..', 'uploads', id, caminho);
        try { fs.unlinkSync(filePath); } catch(e) { /* ignora se já não existir */ }

        await db.query('DELETE FROM arquivos WHERE id=$1', [arquivoId]);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao excluir arquivo.' });
    }
});

module.exports = router;

-- ============================================================
-- SISTEMA DE RECLAMAÇÕES EXTERNAS
-- Estrutura completa do banco de dados PostgreSQL
-- ============================================================

-- Habilitar extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUMS - Tipos fixos do sistema
-- ============================================================

CREATE TYPE perfil_usuario AS ENUM (
    'admin',
    'sac',
    'qualidade',
    'comercial',
    'financeiro',
    'fiscal',
    'expedicao',
    'revisao',
    'pcp'
);

CREATE TYPE status_reclamacao AS ENUM (
    -- Etapa 1: SAC
    'rascunho',
    'reclamacao_cadastrada',

    -- Etapa 2: Qualidade
    'aguardando_analise_qualidade',
    'aguardando_comercial_procedente',
    'aguardando_comercial_improcedente',

    -- Etapa 3: Comercial - visita técnica
    'aguardando_visita_tecnica_qualidade',

    -- Etapa 4: Visita técnica realizada
    'aguardando_direcionamento_comercial_pos_visita',

    -- Etapa 5: Comercial - devolução
    'encaminhando_devolucao_sac',

    -- Etapa 6: SAC - coleta
    'encaminhando_devolucao_conferindo_nf',
    'encaminhando_devolucao_corrigindo_nf',
    'encaminhando_devolucao_sac_solicitar_coleta',

    -- Etapa 7: Logística
    'encaminhando_devolucao_aguardando_chegada_material',
    'encaminhando_devolucao_aguardando_revisao',
    'encaminhando_devolucao_aguardando_of',
    'encaminhando_devolucao_aguardando_conferencia_material',
    'encaminhando_devolucao_aguardando_correcao_nf_cliente',

    -- Etapa 8: Crédito/financeiro
    'gerando_credito_financeiro',
    'gerando_credito_sac',
    'aguardando_encerramento_comercial',

    -- Final
    'concluida',
    'cancelada'
);

CREATE TYPE resultado_analise AS ENUM (
    'procedente',
    'improcedente'
);

CREATE TYPE status_acao_plano AS ENUM (
    'cadastrada',
    'em_andamento',
    'concluida'
);

CREATE TYPE tipo_credito AS ENUM (
    'desconto_boleto',
    'boleto_cancelado',
    'outro'
);

-- ============================================================
-- 2. TABELAS DE CADASTRO BASE
-- ============================================================

-- Usuários do sistema
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(150) NOT NULL,
    email           VARCHAR(200) NOT NULL UNIQUE,
    senha_hash      TEXT NOT NULL,
    perfil          perfil_usuario NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clientes
CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(200) NOT NULL,
    cnpj_cpf        VARCHAR(20),
    email           VARCHAR(200),
    telefone        VARCHAR(30),
    contato         VARCHAR(150),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por      UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Áreas internas (para associar a reclamações procedentes)
CREATE TABLE areas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            VARCHAR(100) NOT NULL UNIQUE,
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por      UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tipos de defeitos (para associar a reclamações procedentes)
CREATE TABLE defeitos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo          VARCHAR(20),
    descricao       VARCHAR(200) NOT NULL UNIQUE,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por      UUID REFERENCES usuarios(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. RECLAMAÇÕES - Tabela principal
-- ============================================================

CREATE TABLE reclamacoes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo              SERIAL UNIQUE,  -- Cod. amigável ex: REC-000001
    cliente_id          UUID NOT NULL REFERENCES clientes(id),
    nossa_nf            VARCHAR(50),
    lote                VARCHAR(50),
    metragem            NUMERIC(12, 3),         -- Pode ser nulo conforme spec
    descricao           TEXT NOT NULL,
    status              status_reclamacao NOT NULL DEFAULT 'rascunho',
    criado_por          UUID NOT NULL REFERENCES usuarios(id),
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluida_em        TIMESTAMPTZ
);

-- ============================================================
-- 4. ETAPAS DO FLUXO
-- ============================================================

-- Etapa 2: Avaliação da Qualidade
CREATE TABLE etapa_avaliacao_qualidade (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id       UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    resultado           resultado_analise,
    descricao           TEXT,
    -- Se procedente:
    causa_raiz          TEXT,
    -- Preenchido por
    usuario_id          UUID REFERENCES usuarios(id),
    salvo_em            TIMESTAMPTZ,
    concluido_em        TIMESTAMPTZ
);

-- Áreas associadas à reclamação procedente
CREATE TABLE reclamacao_areas (
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    area_id         UUID NOT NULL REFERENCES areas(id),
    PRIMARY KEY (reclamacao_id, area_id)
);

-- Defeitos associados à reclamação procedente
CREATE TABLE reclamacao_defeitos (
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    defeito_id      UUID NOT NULL REFERENCES defeitos(id),
    PRIMARY KEY (reclamacao_id, defeito_id)
);

-- Plano de ação (pode ter N ações por reclamação)
CREATE TABLE plano_acoes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    descricao       TEXT NOT NULL,
    responsavel_id  UUID REFERENCES usuarios(id),
    data_prevista   DATE,
    eficacia        TEXT,
    status          status_acao_plano NOT NULL DEFAULT 'cadastrada',
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Etapa 3: Direcionamento Comercial
CREATE TABLE etapa_direcionamento_comercial (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id           UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    -- Visita técnica?
    visita_tecnica          BOOLEAN,
    contato_responsavel_visita  VARCHAR(200),
    datas_sugeridas_visita  TEXT,
    descricao_foco_visita   TEXT,
    -- Direcionamento final
    haverá_devolucao        BOOLEAN,
    haverá_credito          BOOLEAN,
    -- Encerramento direto (sem devolução e sem crédito)
    descricao_encerramento  TEXT,
    -- Preenchido por
    usuario_id              UUID REFERENCES usuarios(id),
    salvo_em                TIMESTAMPTZ,
    concluido_em            TIMESTAMPTZ
);

-- Etapa 4: Visita Técnica
CREATE TABLE etapa_visita_tecnica (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id           UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    data_visita             DATE,
    hora_visita             TIME,
    responsavel_interno_id  UUID REFERENCES usuarios(id),
    responsavel_cliente     VARCHAR(200),
    descricao               TEXT,
    -- Preenchido por
    usuario_id              UUID REFERENCES usuarios(id),
    salvo_em                TIMESTAMPTZ,
    concluido_em            TIMESTAMPTZ
);

-- Etapa 5: Encaminhar Devolução (SAC)
CREATE TABLE etapa_encaminhar_devolucao (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id           UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    quantidade_confirmada   NUMERIC(12, 3),
    transportadora_escolhida VARCHAR(200),
    -- NF recebida do cliente
    nf_cliente_url          TEXT,
    nf_cliente_recebida_em  TIMESTAMPTZ,
    -- Preenchido por
    usuario_id              UUID REFERENCES usuarios(id),
    salvo_em                TIMESTAMPTZ,
    concluido_em            TIMESTAMPTZ
);

-- Cotações de Frete (3 cotações obrigatórias)
CREATE TABLE cotacoes_frete (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    transportadora  VARCHAR(200) NOT NULL,
    valor           NUMERIC(12, 2),
    prazo_dias      INTEGER,
    observacoes     TEXT,
    escolhida       BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Etapa 6: Conferência NF (Fiscal)
CREATE TABLE etapa_conferencia_nf (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    nf_ok           BOOLEAN,
    descricao       TEXT,   -- Motivo se não OK
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    salvo_em        TIMESTAMPTZ,
    concluido_em    TIMESTAMPTZ,
    -- Pode acontecer mais de uma vez (retrabalho)
    tentativa       INTEGER NOT NULL DEFAULT 1
);

-- Etapa 7: Solicitar Coleta (SAC)
CREATE TABLE etapa_solicitar_coleta (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id       UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    transportadora      VARCHAR(200),
    data_estimada       DATE,
    volumes             INTEGER,
    -- Preenchido por
    usuario_id          UUID REFERENCES usuarios(id),
    salvo_em            TIMESTAMPTZ,
    concluido_em        TIMESTAMPTZ
);

-- Etapa 8: Receber Material (Expedição)
CREATE TABLE etapa_receber_material (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id       UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    nf_fisico_ok        BOOLEAN,
    divergencias        TEXT,
    observacoes         TEXT,
    -- Preenchido por
    usuario_id          UUID REFERENCES usuarios(id),
    salvo_em            TIMESTAMPTZ,
    concluido_em        TIMESTAMPTZ
);

-- Etapa 9: Revisar Material (Revisão) + Romaneio
CREATE TABLE etapa_revisao_material (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    descricao       TEXT,
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    salvo_em        TIMESTAMPTZ,
    concluido_em    TIMESTAMPTZ
);

-- Romaneio de peças (N itens por revisão)
CREATE TABLE romaneio_itens (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id       UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    codigo_produto      VARCHAR(100) NOT NULL,
    quantidade_pecas    INTEGER,
    metros              NUMERIC(12, 3),
    observacoes         TEXT
);

-- Etapa 10: Emitir OF (PCP)
CREATE TABLE etapa_emitir_of (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    numero_of       VARCHAR(50) NOT NULL,
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    salvo_em        TIMESTAMPTZ,
    concluido_em    TIMESTAMPTZ
);

-- Etapa 11: Conferir Material / Romaneio x NF (Fiscal)
CREATE TABLE etapa_conferencia_material (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    romaneio_nf_ok  BOOLEAN,
    descricao       TEXT,
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    salvo_em        TIMESTAMPTZ,
    concluido_em    TIMESTAMPTZ,
    tentativa       INTEGER NOT NULL DEFAULT 1
);

-- Etapa 12: Gerar Crédito (Financeiro)
CREATE TABLE etapa_gerar_credito (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    valor_credito   NUMERIC(12, 2),
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    salvo_em        TIMESTAMPTZ,
    concluido_em    TIMESTAMPTZ
);

-- Etapa 13: Definir Forma de Crédito (SAC)
CREATE TABLE etapa_definir_credito (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    tipo_credito    tipo_credito,
    boletos_cancelar TEXT,
    descricao       TEXT,
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    salvo_em        TIMESTAMPTZ,
    concluido_em    TIMESTAMPTZ
);

-- Etapa 14: Encerrar Reclamação (Comercial)
CREATE TABLE etapa_encerramento (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL UNIQUE REFERENCES reclamacoes(id) ON DELETE CASCADE,
    descricao       TEXT,
    -- Preenchido por
    usuario_id      UUID REFERENCES usuarios(id),
    concluido_em    TIMESTAMPTZ
);

-- ============================================================
-- 5. UPLOADS DE ARQUIVOS (compartilhado entre todas as etapas)
-- ============================================================

CREATE TABLE arquivos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    -- Qual etapa gerou o upload
    etapa           VARCHAR(80) NOT NULL,   -- ex: 'cadastro', 'avaliacao_qualidade', 'visita_tecnica', etc.
    -- Referência opcional para sub-entidade (ex: id de plano_acoes)
    ref_id          UUID,
    nome_original   VARCHAR(255) NOT NULL,
    nome_arquivo    VARCHAR(255) NOT NULL,  -- nome salvo no disco (uuid + extensão)
    caminho         TEXT NOT NULL,          -- caminho relativo no servidor
    mime_type       VARCHAR(100),
    tamanho_bytes   BIGINT,
    enviado_por     UUID REFERENCES usuarios(id),
    enviado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. HISTÓRICO DE ALTERAÇÕES DE STATUS
-- ============================================================

CREATE TABLE historico_status (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reclamacao_id   UUID NOT NULL REFERENCES reclamacoes(id) ON DELETE CASCADE,
    status_anterior status_reclamacao,
    status_novo     status_reclamacao NOT NULL,
    usuario_id      UUID REFERENCES usuarios(id),
    observacao      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. NOTIFICAÇÕES
-- ============================================================

CREATE TABLE notificacoes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    reclamacao_id   UUID REFERENCES reclamacoes(id) ON DELETE SET NULL,
    titulo          VARCHAR(200) NOT NULL,
    mensagem        TEXT NOT NULL,
    lida            BOOLEAN NOT NULL DEFAULT FALSE,
    lida_em         TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fila de e-mails a enviar (processada pelo worker Node.js)
CREATE TABLE fila_emails (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    destinatario    VARCHAR(200) NOT NULL,
    assunto         VARCHAR(300) NOT NULL,
    corpo_html      TEXT NOT NULL,
    enviado         BOOLEAN NOT NULL DEFAULT FALSE,
    enviado_em      TIMESTAMPTZ,
    tentativas      INTEGER NOT NULL DEFAULT 0,
    erro            TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. SESSÕES (autenticação stateful server-side)
-- ============================================================

CREATE TABLE sessoes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    ip              INET,
    user_agent      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em       TIMESTAMPTZ NOT NULL,
    encerrada_em    TIMESTAMPTZ
);

-- ============================================================
-- 9. ÍNDICES - Performance nas consultas mais comuns
-- ============================================================

-- Reclamações
CREATE INDEX idx_reclamacoes_status          ON reclamacoes(status);
CREATE INDEX idx_reclamacoes_cliente         ON reclamacoes(cliente_id);
CREATE INDEX idx_reclamacoes_criado_por      ON reclamacoes(criado_por);
CREATE INDEX idx_reclamacoes_criado_em       ON reclamacoes(criado_em DESC);

-- Histórico
CREATE INDEX idx_historico_reclamacao        ON historico_status(reclamacao_id);
CREATE INDEX idx_historico_criado_em         ON historico_status(criado_em DESC);

-- Notificações
CREATE INDEX idx_notificacoes_usuario        ON notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_nao_lidas      ON notificacoes(usuario_id) WHERE lida = FALSE;

-- Arquivos
CREATE INDEX idx_arquivos_reclamacao         ON arquivos(reclamacao_id);
CREATE INDEX idx_arquivos_etapa              ON arquivos(etapa);

-- Sessões
CREATE INDEX idx_sessoes_token               ON sessoes(token_hash);
CREATE INDEX idx_sessoes_usuario             ON sessoes(usuario_id);

-- Fila de e-mails
CREATE INDEX idx_fila_emails_pendentes       ON fila_emails(enviado, tentativas) WHERE enviado = FALSE;

-- ============================================================
-- 10. TRIGGERS - Automações
-- ============================================================

-- Atualiza campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION fn_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reclamacoes_atualizado_em
    BEFORE UPDATE ON reclamacoes
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

CREATE TRIGGER trg_usuarios_atualizado_em
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

CREATE TRIGGER trg_clientes_atualizado_em
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION fn_set_atualizado_em();

-- Registra histórico automaticamente ao mudar status da reclamação
CREATE OR REPLACE FUNCTION fn_historico_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reclamacoes_historico_status
    AFTER UPDATE ON reclamacoes
    FOR EACH ROW EXECUTE FUNCTION fn_historico_status();

-- ============================================================
-- 11. VIEWS ÚTEIS
-- ============================================================

-- Pendências por usuário/perfil (base da tela de Pendências)
CREATE VIEW vw_pendencias AS
SELECT
    r.id,
    r.codigo,
    c.nome                  AS cliente,
    r.status,
    r.criado_em,
    r.atualizado_em,
    -- Perfil responsável pelo status atual
    CASE r.status
        WHEN 'rascunho'                                             THEN 'sac'
        WHEN 'reclamacao_cadastrada'                                THEN 'qualidade'
        WHEN 'aguardando_analise_qualidade'                         THEN 'qualidade'
        WHEN 'aguardando_comercial_procedente'                      THEN 'comercial'
        WHEN 'aguardando_comercial_improcedente'                    THEN 'comercial'
        WHEN 'aguardando_visita_tecnica_qualidade'                  THEN 'qualidade'
        WHEN 'aguardando_direcionamento_comercial_pos_visita'       THEN 'comercial'
        WHEN 'encaminhando_devolucao_sac'                           THEN 'sac'
        WHEN 'encaminhando_devolucao_conferindo_nf'                 THEN 'fiscal'
        WHEN 'encaminhando_devolucao_corrigindo_nf'                 THEN 'sac'
        WHEN 'encaminhando_devolucao_sac_solicitar_coleta'          THEN 'sac'
        WHEN 'encaminhando_devolucao_aguardando_chegada_material'   THEN 'expedicao'
        WHEN 'encaminhando_devolucao_aguardando_revisao'            THEN 'revisao'
        WHEN 'encaminhando_devolucao_aguardando_of'                 THEN 'pcp'
        WHEN 'encaminhando_devolucao_aguardando_conferencia_material' THEN 'fiscal'
        WHEN 'encaminhando_devolucao_aguardando_correcao_nf_cliente' THEN 'sac'
        WHEN 'gerando_credito_financeiro'                           THEN 'financeiro'
        WHEN 'gerando_credito_sac'                                  THEN 'sac'
        WHEN 'aguardando_encerramento_comercial'                    THEN 'comercial'
        ELSE NULL
    END                     AS perfil_responsavel
FROM reclamacoes r
JOIN clientes c ON c.id = r.cliente_id
WHERE r.status NOT IN ('concluida', 'cancelada');

-- Visão geral de reclamações com dados principais
CREATE VIEW vw_reclamacoes_resumo AS
SELECT
    r.id,
    r.codigo,
    c.nome                  AS cliente,
    r.nossa_nf,
    r.lote,
    r.status,
    u.nome                  AS criado_por,
    r.criado_em,
    r.atualizado_em,
    r.concluida_em,
    aq.resultado            AS resultado_analise,
    COUNT(DISTINCT a.id)    AS total_arquivos
FROM reclamacoes r
JOIN clientes c             ON c.id = r.cliente_id
JOIN usuarios u             ON u.id = r.criado_por
LEFT JOIN etapa_avaliacao_qualidade aq ON aq.reclamacao_id = r.id
LEFT JOIN arquivos a        ON a.reclamacao_id = r.id
GROUP BY r.id, c.nome, u.nome, aq.resultado;

-- ============================================================
-- 12. DADOS INICIAIS (seed)
-- ============================================================

-- Usuário Admin padrão (senha: Admin@123 — TROCAR NO PRIMEIRO ACESSO)
INSERT INTO usuarios (nome, email, senha_hash, perfil)
VALUES (
    'Administrador',
    'admin@empresa.com.br',
    crypt('Admin@123', gen_salt('bf', 12)),
    'admin'
);

-- Áreas padrão
INSERT INTO areas (nome, descricao, criado_por)
VALUES
    ('Produção',      'Área de produção',             (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('Expedição',     'Área de expedição',             (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('Qualidade',     'Controle de qualidade',         (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('Logística',     'Logística e transporte',        (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('Comercial',     'Área comercial',                (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br'));

-- Defeitos padrão
INSERT INTO defeitos (codigo, descricao, criado_por)
VALUES
    ('DEF-001', 'Produto com defeito de fabricação',  (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('DEF-002', 'Produto avariado no transporte',     (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('DEF-003', 'Quantidade incorreta na entrega',    (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('DEF-004', 'Produto fora de especificação',      (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br')),
    ('DEF-005', 'Embalagem danificada',               (SELECT id FROM usuarios WHERE email = 'admin@empresa.com.br'));

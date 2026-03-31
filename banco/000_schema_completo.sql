--
-- PostgreSQL database dump
--

\restrict LnofkskckjmMyGY0XewA53jbEFRTbhRBTtLbSQhijui8MwLX10yJf3LZZySawUp

-- Dumped from database version 16.13
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-31 08:45:44

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3 (class 3079 OID 16409)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5274 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 2 (class 3079 OID 16398)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5275 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 932 (class 1247 OID 16447)
-- Name: perfil_usuario; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.perfil_usuario AS ENUM (
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


ALTER TYPE public.perfil_usuario OWNER TO postgres;

--
-- TOC entry 938 (class 1247 OID 16510)
-- Name: resultado_analise; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.resultado_analise AS ENUM (
    'procedente',
    'improcedente',
    'visita_tecnica'
);


ALTER TYPE public.resultado_analise OWNER TO postgres;

--
-- TOC entry 941 (class 1247 OID 16516)
-- Name: status_acao_plano; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_acao_plano AS ENUM (
    'cadastrada',
    'em_andamento',
    'concluida'
);


ALTER TYPE public.status_acao_plano OWNER TO postgres;

--
-- TOC entry 935 (class 1247 OID 16466)
-- Name: status_reclamacao; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.status_reclamacao AS ENUM (
    'rascunho',
    'reclamacao_cadastrada',
    'aguardando_analise_qualidade',
    'aguardando_comercial_procedente',
    'aguardando_comercial_improcedente',
    'aguardando_visita_tecnica_qualidade',
    'aguardando_direcionamento_comercial_pos_visita',
    'encaminhando_devolucao_sac',
    'encaminhando_devolucao_conferindo_nf_fiscal',
    'encaminhando_devolucao_conferindo_nf',
    'encaminhando_devolucao_corrigindo_nf',
    'encaminhando_devolucao_sac_solicitar_coleta',
    'encaminhando_devolucao_aguardando_chegada_material',
    'encaminhando_devolucao_aguardando_revisao',
    'encaminhando_devolucao_aguardando_of',
    'encaminhando_devolucao_aguardando_conferencia_material',
    'encaminhando_devolucao_aguardando_correcao_nf_cliente',
    'gerando_credito_financeiro',
    'gerando_credito_sac',
    'aguardando_encerramento_comercial',
    'concluida',
    'cancelada',
    'aguardando_analise_qualidade_pos_visita',
    'aguardando_aprovacao_financeiro',
    'aguardando_complemento_sac'
);


ALTER TYPE public.status_reclamacao OWNER TO postgres;

--
-- TOC entry 944 (class 1247 OID 16524)
-- Name: tipo_credito; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tipo_credito AS ENUM (
    'desconto_boleto',
    'boleto_cancelado',
    'outro'
);


ALTER TYPE public.tipo_credito OWNER TO postgres;

--
-- TOC entry 306 (class 1255 OID 17055)
-- Name: fn_historico_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_historico_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO historico_status (reclamacao_id, status_anterior, status_novo)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_historico_status() OWNER TO postgres;

--
-- TOC entry 305 (class 1255 OID 17051)
-- Name: fn_set_atualizado_em(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_set_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_set_atualizado_em() OWNER TO postgres;

--
-- TOC entry 307 (class 1255 OID 17461)
-- Name: set_atualizado_em(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION public.set_atualizado_em() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 16560)
-- Name: areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.areas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nome character varying(100) NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.areas OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 16953)
-- Name: arquivos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.arquivos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    etapa character varying(80) NOT NULL,
    ref_id uuid,
    nome_original character varying(255) NOT NULL,
    nome_arquivo character varying(255) NOT NULL,
    caminho text NOT NULL,
    mime_type character varying(100),
    tamanho_bytes bigint,
    enviado_por uuid,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.arquivos OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16544)
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nome character varying(200) NOT NULL,
    cnpj_cpf character varying(20),
    email character varying(200),
    telefone character varying(30),
    contato character varying(150),
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 17421)
-- Name: comentarios_reclamacao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comentarios_reclamacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reclamacao_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    texto text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.comentarios_reclamacao OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16753)
-- Name: cotacoes_frete; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cotacoes_frete (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    transportadora character varying(200) NOT NULL,
    valor numeric(12,2),
    prazo_dias integer,
    observacoes text,
    escolhida boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cotacoes_frete OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16577)
-- Name: defeitos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defeitos (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    codigo character varying(20),
    descricao character varying(200) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.defeitos OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 25046)
-- Name: duvidas_sac; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.duvidas_sac (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reclamacao_id uuid,
    usuario_id uuid,
    mensagem text NOT NULL,
    eh_resposta_sac boolean DEFAULT false,
    status_anterior text,
    criado_em timestamp with time zone DEFAULT now()
);


ALTER TABLE public.duvidas_sac OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 17069)
-- Name: etapa_avaliacao_pos_visita; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_avaliacao_pos_visita (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    resultado public.resultado_analise,
    descricao text,
    causa_raiz text,
    plano_acao text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone
);


ALTER TABLE public.etapa_avaliacao_pos_visita OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16617)
-- Name: etapa_avaliacao_qualidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_avaliacao_qualidade (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    resultado public.resultado_analise,
    descricao text,
    causa_raiz text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    plano_acao text
);


ALTER TABLE public.etapa_avaliacao_qualidade OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 16876)
-- Name: etapa_conferencia_material; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_conferencia_material (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    romaneio_nf_ok boolean,
    descricao text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    tentativa integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.etapa_conferencia_material OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 16768)
-- Name: etapa_conferencia_nf; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_conferencia_nf (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    nf_ok boolean,
    descricao text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    tentativa integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.etapa_conferencia_nf OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 16913)
-- Name: etapa_definir_credito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_definir_credito (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    tipo_credito public.tipo_credito,
    boletos_cancelar text,
    descricao text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    contato_cliente text
);


ALTER TABLE public.etapa_definir_credito OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16688)
-- Name: etapa_direcionamento_comercial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_direcionamento_comercial (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    visita_tecnica boolean,
    contato_responsavel_visita character varying(200),
    datas_sugeridas_visita text,
    descricao_foco_visita text,
    descricao_encerramento text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    havera_credito boolean DEFAULT false,
    havera_devolucao boolean DEFAULT false
);


ALTER TABLE public.etapa_direcionamento_comercial OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 16858)
-- Name: etapa_emitir_of; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_emitir_of (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    numero_of character varying(50) NOT NULL,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone
);


ALTER TABLE public.etapa_emitir_of OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16733)
-- Name: etapa_encaminhar_devolucao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_encaminhar_devolucao (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    quantidade_confirmada numeric(12,3),
    transportadora_escolhida character varying(200),
    nf_cliente_url text,
    nf_cliente_recebida_em timestamp with time zone,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    observacoes text,
    observacoes_nf text,
    nfs_despacho text
);


ALTER TABLE public.etapa_encaminhar_devolucao OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 16933)
-- Name: etapa_encerramento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_encerramento (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    descricao text,
    usuario_id uuid,
    concluido_em timestamp with time zone
);


ALTER TABLE public.etapa_encerramento OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16895)
-- Name: etapa_gerar_credito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_gerar_credito (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    valor_credito numeric(12,2),
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone
);


ALTER TABLE public.etapa_gerar_credito OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 16805)
-- Name: etapa_receber_material; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_receber_material (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    nf_fisico_ok boolean,
    divergencias text,
    observacoes text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone
);


ALTER TABLE public.etapa_receber_material OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 16825)
-- Name: etapa_revisao_material; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_revisao_material (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    descricao text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    revisora character varying(150)
);


ALTER TABLE public.etapa_revisao_material OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16787)
-- Name: etapa_solicitar_coleta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_solicitar_coleta (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    transportadora character varying(200),
    data_estimada date,
    volumes integer,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone,
    nf_coleta character varying(100),
    data_coleta date,
    data_prevista_chegada date,
    observacoes text
);


ALTER TABLE public.etapa_solicitar_coleta OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16708)
-- Name: etapa_visita_tecnica; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etapa_visita_tecnica (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    data_visita date,
    hora_visita time without time zone,
    responsavel_interno_id uuid,
    responsavel_cliente character varying(200),
    descricao text,
    usuario_id uuid,
    salvo_em timestamp with time zone,
    concluido_em timestamp with time zone
);


ALTER TABLE public.etapa_visita_tecnica OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 17011)
-- Name: fila_emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fila_emails (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    destinatario character varying(200) NOT NULL,
    assunto character varying(300) NOT NULL,
    corpo_html text NOT NULL,
    enviado boolean DEFAULT false NOT NULL,
    enviado_em timestamp with time zone,
    tentativas integer DEFAULT 0 NOT NULL,
    erro text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fila_emails OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 16972)
-- Name: historico_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.historico_status (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    status_anterior public.status_reclamacao,
    status_novo public.status_reclamacao NOT NULL,
    usuario_id uuid,
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.historico_status OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 25022)
-- Name: lote_reclamacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lote_reclamacoes (
    lote_id uuid NOT NULL,
    reclamacao_id uuid NOT NULL,
    adicionado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lote_reclamacoes OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 25004)
-- Name: lotes_devolucao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lotes_devolucao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo integer NOT NULL,
    status character varying(80) DEFAULT 'encaminhando_devolucao_sac'::character varying NOT NULL,
    criado_por uuid,
    criado_em timestamp without time zone DEFAULT now(),
    observacoes_nf text,
    transportadora character varying(150),
    nf_coleta character varying(100),
    data_coleta timestamp without time zone,
    data_prevista_chegada timestamp without time zone,
    romaneio_nf_ok boolean,
    descricao_conferencia text,
    concluido_em timestamp without time zone,
    quantidade_confirmada numeric,
    nf_cliente_url text,
    nfs_despacho text,
    nfs_cliente_urls text,
    valor_credito numeric,
    tipo_credito text,
    descricao_credito text,
    contato_cliente text
);


ALTER TABLE public.lotes_devolucao OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 25003)
-- Name: lotes_devolucao_codigo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lotes_devolucao_codigo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lotes_devolucao_codigo_seq OWNER TO postgres;

--
-- TOC entry 5276 (class 0 OID 0)
-- Dependencies: 255
-- Name: lotes_devolucao_codigo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lotes_devolucao_codigo_seq OWNED BY public.lotes_devolucao.codigo;


--
-- TOC entry 243 (class 1259 OID 16991)
-- Name: notificacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificacoes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    usuario_id uuid NOT NULL,
    reclamacao_id uuid,
    titulo character varying(200) NOT NULL,
    mensagem text NOT NULL,
    lida boolean DEFAULT false NOT NULL,
    lida_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notificacoes OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 17442)
-- Name: plano_acao_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plano_acao_itens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reclamacao_id uuid NOT NULL,
    avaliacao_tipo character varying(30) DEFAULT 'avaliacao'::character varying NOT NULL,
    acao text NOT NULL,
    responsavel text,
    prazo date,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    eficacia character varying(20),
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.plano_acao_itens OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16667)
-- Name: plano_acoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plano_acoes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    descricao text NOT NULL,
    responsavel_id uuid,
    data_prevista date,
    eficacia text,
    status public.status_acao_plano DEFAULT 'cadastrada'::public.status_acao_plano NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.plano_acoes OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16637)
-- Name: reclamacao_areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reclamacao_areas (
    reclamacao_id uuid NOT NULL,
    area_id uuid NOT NULL
);


ALTER TABLE public.reclamacao_areas OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16652)
-- Name: reclamacao_defeitos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reclamacao_defeitos (
    reclamacao_id uuid NOT NULL,
    defeito_id uuid NOT NULL
);


ALTER TABLE public.reclamacao_defeitos OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16593)
-- Name: reclamacoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reclamacoes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    codigo integer NOT NULL,
    cliente_id uuid NOT NULL,
    nossa_nf character varying(50),
    lote character varying(50),
    metragem numeric(12,3),
    descricao text NOT NULL,
    status public.status_reclamacao DEFAULT 'rascunho'::public.status_reclamacao NOT NULL,
    criado_por uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    concluida_em timestamp with time zone,
    status_retorno_complemento character varying(100),
    artigo character varying(300),
    rnc_cliente character varying(100),
    lote_id uuid
);


ALTER TABLE public.reclamacoes OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16592)
-- Name: reclamacoes_codigo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reclamacoes_codigo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reclamacoes_codigo_seq OWNER TO postgres;

--
-- TOC entry 5277 (class 0 OID 0)
-- Dependencies: 221
-- Name: reclamacoes_codigo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reclamacoes_codigo_seq OWNED BY public.reclamacoes.codigo;


--
-- TOC entry 235 (class 1259 OID 16845)
-- Name: romaneio_itens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.romaneio_itens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    reclamacao_id uuid NOT NULL,
    codigo_produto character varying(100) NOT NULL,
    quantidade_pecas integer,
    metros numeric(12,3),
    observacoes text,
    qualidade character varying(20),
    numero_nf text
);


ALTER TABLE public.romaneio_itens OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 17022)
-- Name: sessoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessoes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    usuario_id uuid NOT NULL,
    token_hash text NOT NULL,
    ip inet,
    user_agent text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    encerrada_em timestamp with time zone
);


ALTER TABLE public.sessoes OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 17586)
-- Name: solicitacoes_complemento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.solicitacoes_complemento (
    id integer NOT NULL,
    reclamacao_id uuid NOT NULL,
    solicitante_id uuid NOT NULL,
    perfil_retorno character varying(50) NOT NULL,
    status_retorno character varying(100) NOT NULL,
    mensagem text NOT NULL,
    respondido_em timestamp without time zone,
    resposta text,
    criado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.solicitacoes_complemento OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 17585)
-- Name: solicitacoes_complemento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.solicitacoes_complemento_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.solicitacoes_complemento_id_seq OWNER TO postgres;

--
-- TOC entry 5278 (class 0 OID 0)
-- Dependencies: 251
-- Name: solicitacoes_complemento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.solicitacoes_complemento_id_seq OWNED BY public.solicitacoes_complemento.id;


--
-- TOC entry 254 (class 1259 OID 17607)
-- Name: tokens_redefinicao_senha; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tokens_redefinicao_senha (
    id integer NOT NULL,
    usuario_id uuid NOT NULL,
    token character varying(64) NOT NULL,
    expira_em timestamp without time zone NOT NULL,
    usado boolean DEFAULT false,
    criado_em timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tokens_redefinicao_senha OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 17606)
-- Name: tokens_redefinicao_senha_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tokens_redefinicao_senha_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tokens_redefinicao_senha_id_seq OWNER TO postgres;

--
-- TOC entry 5279 (class 0 OID 0)
-- Dependencies: 253
-- Name: tokens_redefinicao_senha_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tokens_redefinicao_senha_id_seq OWNED BY public.tokens_redefinicao_senha.id;


--
-- TOC entry 217 (class 1259 OID 16531)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nome character varying(150) NOT NULL,
    email character varying(200) NOT NULL,
    senha_hash text NOT NULL,
    perfil public.perfil_usuario NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    avatar_url text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 17057)
-- Name: vw_pendencias; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_pendencias AS
 SELECT r.id,
    r.codigo,
    c.nome AS cliente,
    r.status,
    r.criado_em,
    r.atualizado_em,
        CASE r.status
            WHEN 'rascunho'::public.status_reclamacao THEN 'sac'::text
            WHEN 'reclamacao_cadastrada'::public.status_reclamacao THEN 'qualidade'::text
            WHEN 'aguardando_analise_qualidade'::public.status_reclamacao THEN 'qualidade'::text
            WHEN 'aguardando_comercial_procedente'::public.status_reclamacao THEN 'comercial'::text
            WHEN 'aguardando_comercial_improcedente'::public.status_reclamacao THEN 'comercial'::text
            WHEN 'aguardando_visita_tecnica_qualidade'::public.status_reclamacao THEN 'qualidade'::text
            WHEN 'aguardando_direcionamento_comercial_pos_visita'::public.status_reclamacao THEN 'comercial'::text
            WHEN 'encaminhando_devolucao_sac'::public.status_reclamacao THEN 'sac'::text
            WHEN 'encaminhando_devolucao_conferindo_nf'::public.status_reclamacao THEN 'fiscal'::text
            WHEN 'encaminhando_devolucao_corrigindo_nf'::public.status_reclamacao THEN 'sac'::text
            WHEN 'encaminhando_devolucao_sac_solicitar_coleta'::public.status_reclamacao THEN 'sac'::text
            WHEN 'encaminhando_devolucao_aguardando_chegada_material'::public.status_reclamacao THEN 'expedicao'::text
            WHEN 'encaminhando_devolucao_aguardando_revisao'::public.status_reclamacao THEN 'revisao'::text
            WHEN 'encaminhando_devolucao_aguardando_of'::public.status_reclamacao THEN 'pcp'::text
            WHEN 'encaminhando_devolucao_aguardando_conferencia_material'::public.status_reclamacao THEN 'fiscal'::text
            WHEN 'encaminhando_devolucao_aguardando_correcao_nf_cliente'::public.status_reclamacao THEN 'sac'::text
            WHEN 'gerando_credito_financeiro'::public.status_reclamacao THEN 'financeiro'::text
            WHEN 'gerando_credito_sac'::public.status_reclamacao THEN 'sac'::text
            WHEN 'aguardando_encerramento_comercial'::public.status_reclamacao THEN 'comercial'::text
            ELSE NULL::text
        END AS perfil_responsavel
   FROM (public.reclamacoes r
     JOIN public.clientes c ON ((c.id = r.cliente_id)))
  WHERE (r.status <> ALL (ARRAY['concluida'::public.status_reclamacao, 'cancelada'::public.status_reclamacao]));


ALTER VIEW public.vw_pendencias OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 17062)
-- Name: vw_reclamacoes_resumo; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_reclamacoes_resumo AS
SELECT
    NULL::uuid AS id,
    NULL::integer AS codigo,
    NULL::character varying(200) AS cliente,
    NULL::character varying(50) AS nossa_nf,
    NULL::character varying(50) AS lote,
    NULL::public.status_reclamacao AS status,
    NULL::character varying(150) AS criado_por,
    NULL::timestamp with time zone AS criado_em,
    NULL::timestamp with time zone AS atualizado_em,
    NULL::timestamp with time zone AS concluida_em,
    NULL::public.resultado_analise AS resultado_analise,
    NULL::bigint AS total_arquivos;


ALTER VIEW public.vw_reclamacoes_resumo OWNER TO postgres;

--
-- TOC entry 4922 (class 2604 OID 25008)
-- Name: lotes_devolucao codigo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_devolucao ALTER COLUMN codigo SET DEFAULT nextval('public.lotes_devolucao_codigo_seq'::regclass);


--
-- TOC entry 4866 (class 2604 OID 16597)
-- Name: reclamacoes codigo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacoes ALTER COLUMN codigo SET DEFAULT nextval('public.reclamacoes_codigo_seq'::regclass);


--
-- TOC entry 4916 (class 2604 OID 17589)
-- Name: solicitacoes_complemento id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacoes_complemento ALTER COLUMN id SET DEFAULT nextval('public.solicitacoes_complemento_id_seq'::regclass);


--
-- TOC entry 4918 (class 2604 OID 17610)
-- Name: tokens_redefinicao_senha id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_redefinicao_senha ALTER COLUMN id SET DEFAULT nextval('public.tokens_redefinicao_senha_id_seq'::regclass);


--
-- TOC entry 4936 (class 2606 OID 16571)
-- Name: areas areas_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_nome_key UNIQUE (nome);


--
-- TOC entry 4938 (class 2606 OID 16569)
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- TOC entry 5010 (class 2606 OID 16961)
-- Name: arquivos arquivos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arquivos
    ADD CONSTRAINT arquivos_pkey PRIMARY KEY (id);


--
-- TOC entry 4934 (class 2606 OID 16554)
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- TOC entry 5035 (class 2606 OID 17429)
-- Name: comentarios_reclamacao comentarios_reclamacao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios_reclamacao
    ADD CONSTRAINT comentarios_reclamacao_pkey PRIMARY KEY (id);


--
-- TOC entry 4974 (class 2606 OID 16762)
-- Name: cotacoes_frete cotacoes_frete_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cotacoes_frete
    ADD CONSTRAINT cotacoes_frete_pkey PRIMARY KEY (id);


--
-- TOC entry 4940 (class 2606 OID 16586)
-- Name: defeitos defeitos_descricao_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defeitos
    ADD CONSTRAINT defeitos_descricao_key UNIQUE (descricao);


--
-- TOC entry 4942 (class 2606 OID 16584)
-- Name: defeitos defeitos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defeitos
    ADD CONSTRAINT defeitos_pkey PRIMARY KEY (id);


--
-- TOC entry 5056 (class 2606 OID 25055)
-- Name: duvidas_sac duvidas_sac_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duvidas_sac
    ADD CONSTRAINT duvidas_sac_pkey PRIMARY KEY (id);


--
-- TOC entry 5031 (class 2606 OID 17076)
-- Name: etapa_avaliacao_pos_visita etapa_avaliacao_pos_visita_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_pos_visita
    ADD CONSTRAINT etapa_avaliacao_pos_visita_pkey PRIMARY KEY (id);


--
-- TOC entry 5033 (class 2606 OID 17078)
-- Name: etapa_avaliacao_pos_visita etapa_avaliacao_pos_visita_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_pos_visita
    ADD CONSTRAINT etapa_avaliacao_pos_visita_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4952 (class 2606 OID 16624)
-- Name: etapa_avaliacao_qualidade etapa_avaliacao_qualidade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_qualidade
    ADD CONSTRAINT etapa_avaliacao_qualidade_pkey PRIMARY KEY (id);


--
-- TOC entry 4954 (class 2606 OID 16626)
-- Name: etapa_avaliacao_qualidade etapa_avaliacao_qualidade_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_qualidade
    ADD CONSTRAINT etapa_avaliacao_qualidade_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4996 (class 2606 OID 16884)
-- Name: etapa_conferencia_material etapa_conferencia_material_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_conferencia_material
    ADD CONSTRAINT etapa_conferencia_material_pkey PRIMARY KEY (id);


--
-- TOC entry 4976 (class 2606 OID 16776)
-- Name: etapa_conferencia_nf etapa_conferencia_nf_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_conferencia_nf
    ADD CONSTRAINT etapa_conferencia_nf_pkey PRIMARY KEY (id);


--
-- TOC entry 5002 (class 2606 OID 16920)
-- Name: etapa_definir_credito etapa_definir_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_definir_credito
    ADD CONSTRAINT etapa_definir_credito_pkey PRIMARY KEY (id);


--
-- TOC entry 5004 (class 2606 OID 16922)
-- Name: etapa_definir_credito etapa_definir_credito_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_definir_credito
    ADD CONSTRAINT etapa_definir_credito_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4962 (class 2606 OID 16695)
-- Name: etapa_direcionamento_comercial etapa_direcionamento_comercial_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_direcionamento_comercial
    ADD CONSTRAINT etapa_direcionamento_comercial_pkey PRIMARY KEY (id);


--
-- TOC entry 4964 (class 2606 OID 16697)
-- Name: etapa_direcionamento_comercial etapa_direcionamento_comercial_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_direcionamento_comercial
    ADD CONSTRAINT etapa_direcionamento_comercial_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4992 (class 2606 OID 16863)
-- Name: etapa_emitir_of etapa_emitir_of_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_emitir_of
    ADD CONSTRAINT etapa_emitir_of_pkey PRIMARY KEY (id);


--
-- TOC entry 4994 (class 2606 OID 16865)
-- Name: etapa_emitir_of etapa_emitir_of_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_emitir_of
    ADD CONSTRAINT etapa_emitir_of_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4970 (class 2606 OID 16740)
-- Name: etapa_encaminhar_devolucao etapa_encaminhar_devolucao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encaminhar_devolucao
    ADD CONSTRAINT etapa_encaminhar_devolucao_pkey PRIMARY KEY (id);


--
-- TOC entry 4972 (class 2606 OID 16742)
-- Name: etapa_encaminhar_devolucao etapa_encaminhar_devolucao_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encaminhar_devolucao
    ADD CONSTRAINT etapa_encaminhar_devolucao_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 5006 (class 2606 OID 16940)
-- Name: etapa_encerramento etapa_encerramento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encerramento
    ADD CONSTRAINT etapa_encerramento_pkey PRIMARY KEY (id);


--
-- TOC entry 5008 (class 2606 OID 16942)
-- Name: etapa_encerramento etapa_encerramento_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encerramento
    ADD CONSTRAINT etapa_encerramento_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4998 (class 2606 OID 16900)
-- Name: etapa_gerar_credito etapa_gerar_credito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_gerar_credito
    ADD CONSTRAINT etapa_gerar_credito_pkey PRIMARY KEY (id);


--
-- TOC entry 5000 (class 2606 OID 16902)
-- Name: etapa_gerar_credito etapa_gerar_credito_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_gerar_credito
    ADD CONSTRAINT etapa_gerar_credito_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4982 (class 2606 OID 16812)
-- Name: etapa_receber_material etapa_receber_material_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_receber_material
    ADD CONSTRAINT etapa_receber_material_pkey PRIMARY KEY (id);


--
-- TOC entry 4984 (class 2606 OID 16814)
-- Name: etapa_receber_material etapa_receber_material_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_receber_material
    ADD CONSTRAINT etapa_receber_material_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4986 (class 2606 OID 16832)
-- Name: etapa_revisao_material etapa_revisao_material_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_revisao_material
    ADD CONSTRAINT etapa_revisao_material_pkey PRIMARY KEY (id);


--
-- TOC entry 4988 (class 2606 OID 16834)
-- Name: etapa_revisao_material etapa_revisao_material_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_revisao_material
    ADD CONSTRAINT etapa_revisao_material_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4978 (class 2606 OID 16792)
-- Name: etapa_solicitar_coleta etapa_solicitar_coleta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_solicitar_coleta
    ADD CONSTRAINT etapa_solicitar_coleta_pkey PRIMARY KEY (id);


--
-- TOC entry 4980 (class 2606 OID 16794)
-- Name: etapa_solicitar_coleta etapa_solicitar_coleta_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_solicitar_coleta
    ADD CONSTRAINT etapa_solicitar_coleta_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 4966 (class 2606 OID 16715)
-- Name: etapa_visita_tecnica etapa_visita_tecnica_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_visita_tecnica
    ADD CONSTRAINT etapa_visita_tecnica_pkey PRIMARY KEY (id);


--
-- TOC entry 4968 (class 2606 OID 16717)
-- Name: etapa_visita_tecnica etapa_visita_tecnica_reclamacao_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_visita_tecnica
    ADD CONSTRAINT etapa_visita_tecnica_reclamacao_id_key UNIQUE (reclamacao_id);


--
-- TOC entry 5022 (class 2606 OID 17021)
-- Name: fila_emails fila_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fila_emails
    ADD CONSTRAINT fila_emails_pkey PRIMARY KEY (id);


--
-- TOC entry 5014 (class 2606 OID 16980)
-- Name: historico_status historico_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_status
    ADD CONSTRAINT historico_status_pkey PRIMARY KEY (id);


--
-- TOC entry 5054 (class 2606 OID 25027)
-- Name: lote_reclamacoes lote_reclamacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote_reclamacoes
    ADD CONSTRAINT lote_reclamacoes_pkey PRIMARY KEY (lote_id, reclamacao_id);


--
-- TOC entry 5050 (class 2606 OID 25016)
-- Name: lotes_devolucao lotes_devolucao_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_devolucao
    ADD CONSTRAINT lotes_devolucao_codigo_key UNIQUE (codigo);


--
-- TOC entry 5052 (class 2606 OID 25014)
-- Name: lotes_devolucao lotes_devolucao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_devolucao
    ADD CONSTRAINT lotes_devolucao_pkey PRIMARY KEY (id);


--
-- TOC entry 5020 (class 2606 OID 17000)
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- TOC entry 5040 (class 2606 OID 17453)
-- Name: plano_acao_itens plano_acao_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_acao_itens
    ADD CONSTRAINT plano_acao_itens_pkey PRIMARY KEY (id);


--
-- TOC entry 4960 (class 2606 OID 16677)
-- Name: plano_acoes plano_acoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_acoes
    ADD CONSTRAINT plano_acoes_pkey PRIMARY KEY (id);


--
-- TOC entry 4956 (class 2606 OID 16641)
-- Name: reclamacao_areas reclamacao_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacao_areas
    ADD CONSTRAINT reclamacao_areas_pkey PRIMARY KEY (reclamacao_id, area_id);


--
-- TOC entry 4958 (class 2606 OID 16656)
-- Name: reclamacao_defeitos reclamacao_defeitos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacao_defeitos
    ADD CONSTRAINT reclamacao_defeitos_pkey PRIMARY KEY (reclamacao_id, defeito_id);


--
-- TOC entry 4948 (class 2606 OID 16606)
-- Name: reclamacoes reclamacoes_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacoes
    ADD CONSTRAINT reclamacoes_codigo_key UNIQUE (codigo);


--
-- TOC entry 4950 (class 2606 OID 16604)
-- Name: reclamacoes reclamacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacoes
    ADD CONSTRAINT reclamacoes_pkey PRIMARY KEY (id);


--
-- TOC entry 4990 (class 2606 OID 16852)
-- Name: romaneio_itens romaneio_itens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.romaneio_itens
    ADD CONSTRAINT romaneio_itens_pkey PRIMARY KEY (id);


--
-- TOC entry 5027 (class 2606 OID 17030)
-- Name: sessoes sessoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessoes
    ADD CONSTRAINT sessoes_pkey PRIMARY KEY (id);


--
-- TOC entry 5029 (class 2606 OID 17032)
-- Name: sessoes sessoes_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessoes
    ADD CONSTRAINT sessoes_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 5042 (class 2606 OID 17594)
-- Name: solicitacoes_complemento solicitacoes_complemento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacoes_complemento
    ADD CONSTRAINT solicitacoes_complemento_pkey PRIMARY KEY (id);


--
-- TOC entry 5044 (class 2606 OID 17614)
-- Name: tokens_redefinicao_senha tokens_redefinicao_senha_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_redefinicao_senha
    ADD CONSTRAINT tokens_redefinicao_senha_pkey PRIMARY KEY (id);


--
-- TOC entry 5046 (class 2606 OID 17616)
-- Name: tokens_redefinicao_senha tokens_redefinicao_senha_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_redefinicao_senha
    ADD CONSTRAINT tokens_redefinicao_senha_token_key UNIQUE (token);


--
-- TOC entry 5048 (class 2606 OID 17618)
-- Name: tokens_redefinicao_senha tokens_redefinicao_senha_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_redefinicao_senha
    ADD CONSTRAINT tokens_redefinicao_senha_usuario_id_key UNIQUE (usuario_id);


--
-- TOC entry 4930 (class 2606 OID 16543)
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- TOC entry 4932 (class 2606 OID 16541)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- TOC entry 5011 (class 1259 OID 17047)
-- Name: idx_arquivos_etapa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_arquivos_etapa ON public.arquivos USING btree (etapa);


--
-- TOC entry 5012 (class 1259 OID 17046)
-- Name: idx_arquivos_reclamacao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_arquivos_reclamacao ON public.arquivos USING btree (reclamacao_id);


--
-- TOC entry 5036 (class 1259 OID 17440)
-- Name: idx_comentarios_reclamacao_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comentarios_reclamacao_id ON public.comentarios_reclamacao USING btree (reclamacao_id);


--
-- TOC entry 5057 (class 1259 OID 25066)
-- Name: idx_duvidas_sac_rec; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_duvidas_sac_rec ON public.duvidas_sac USING btree (reclamacao_id);


--
-- TOC entry 5023 (class 1259 OID 17050)
-- Name: idx_fila_emails_pendentes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fila_emails_pendentes ON public.fila_emails USING btree (enviado, tentativas) WHERE (enviado = false);


--
-- TOC entry 5015 (class 1259 OID 17043)
-- Name: idx_historico_criado_em; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historico_criado_em ON public.historico_status USING btree (criado_em DESC);


--
-- TOC entry 5016 (class 1259 OID 17042)
-- Name: idx_historico_reclamacao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_historico_reclamacao ON public.historico_status USING btree (reclamacao_id);


--
-- TOC entry 5017 (class 1259 OID 17045)
-- Name: idx_notificacoes_nao_lidas; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notificacoes_nao_lidas ON public.notificacoes USING btree (usuario_id) WHERE (lida = false);


--
-- TOC entry 5018 (class 1259 OID 17044)
-- Name: idx_notificacoes_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notificacoes_usuario ON public.notificacoes USING btree (usuario_id);


--
-- TOC entry 5037 (class 1259 OID 17459)
-- Name: idx_plano_acao_reclamacao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_plano_acao_reclamacao ON public.plano_acao_itens USING btree (reclamacao_id);


--
-- TOC entry 5038 (class 1259 OID 17460)
-- Name: idx_plano_acao_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_plano_acao_status ON public.plano_acao_itens USING btree (status);


--
-- TOC entry 4943 (class 1259 OID 17039)
-- Name: idx_reclamacoes_cliente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reclamacoes_cliente ON public.reclamacoes USING btree (cliente_id);


--
-- TOC entry 4944 (class 1259 OID 17041)
-- Name: idx_reclamacoes_criado_em; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reclamacoes_criado_em ON public.reclamacoes USING btree (criado_em DESC);


--
-- TOC entry 4945 (class 1259 OID 17040)
-- Name: idx_reclamacoes_criado_por; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reclamacoes_criado_por ON public.reclamacoes USING btree (criado_por);


--
-- TOC entry 4946 (class 1259 OID 17038)
-- Name: idx_reclamacoes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reclamacoes_status ON public.reclamacoes USING btree (status);


--
-- TOC entry 5024 (class 1259 OID 17048)
-- Name: idx_sessoes_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessoes_token ON public.sessoes USING btree (token_hash);


--
-- TOC entry 5025 (class 1259 OID 17049)
-- Name: idx_sessoes_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessoes_usuario ON public.sessoes USING btree (usuario_id);


--
-- TOC entry 5268 (class 2618 OID 17065)
-- Name: vw_reclamacoes_resumo _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.vw_reclamacoes_resumo AS
 SELECT r.id,
    r.codigo,
    c.nome AS cliente,
    r.nossa_nf,
    r.lote,
    r.status,
    u.nome AS criado_por,
    r.criado_em,
    r.atualizado_em,
    r.concluida_em,
    aq.resultado AS resultado_analise,
    count(DISTINCT a.id) AS total_arquivos
   FROM ((((public.reclamacoes r
     JOIN public.clientes c ON ((c.id = r.cliente_id)))
     JOIN public.usuarios u ON ((u.id = r.criado_por)))
     LEFT JOIN public.etapa_avaliacao_qualidade aq ON ((aq.reclamacao_id = r.id)))
     LEFT JOIN public.arquivos a ON ((a.reclamacao_id = r.id)))
  GROUP BY r.id, c.nome, u.nome, aq.resultado;


--
-- TOC entry 5120 (class 2620 OID 17054)
-- Name: clientes trg_clientes_atualizado_em; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_clientes_atualizado_em BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();


--
-- TOC entry 5123 (class 2620 OID 17462)
-- Name: plano_acao_itens trg_plano_acao_atualizado; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_plano_acao_atualizado BEFORE UPDATE ON public.plano_acao_itens FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();


--
-- TOC entry 5121 (class 2620 OID 17052)
-- Name: reclamacoes trg_reclamacoes_atualizado_em; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_reclamacoes_atualizado_em BEFORE UPDATE ON public.reclamacoes FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();


--
-- TOC entry 5122 (class 2620 OID 17056)
-- Name: reclamacoes trg_reclamacoes_historico_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_reclamacoes_historico_status AFTER UPDATE ON public.reclamacoes FOR EACH ROW EXECUTE FUNCTION public.fn_historico_status();


--
-- TOC entry 5119 (class 2620 OID 17053)
-- Name: usuarios trg_usuarios_atualizado_em; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_usuarios_atualizado_em BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.fn_set_atualizado_em();


--
-- TOC entry 5059 (class 2606 OID 16572)
-- Name: areas areas_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- TOC entry 5099 (class 2606 OID 16967)
-- Name: arquivos arquivos_enviado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arquivos
    ADD CONSTRAINT arquivos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES public.usuarios(id);


--
-- TOC entry 5100 (class 2606 OID 16962)
-- Name: arquivos arquivos_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arquivos
    ADD CONSTRAINT arquivos_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5058 (class 2606 OID 16555)
-- Name: clientes clientes_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- TOC entry 5108 (class 2606 OID 17430)
-- Name: comentarios_reclamacao comentarios_reclamacao_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios_reclamacao
    ADD CONSTRAINT comentarios_reclamacao_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5109 (class 2606 OID 17435)
-- Name: comentarios_reclamacao comentarios_reclamacao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comentarios_reclamacao
    ADD CONSTRAINT comentarios_reclamacao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5079 (class 2606 OID 16763)
-- Name: cotacoes_frete cotacoes_frete_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cotacoes_frete
    ADD CONSTRAINT cotacoes_frete_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5060 (class 2606 OID 16587)
-- Name: defeitos defeitos_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defeitos
    ADD CONSTRAINT defeitos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- TOC entry 5117 (class 2606 OID 25056)
-- Name: duvidas_sac duvidas_sac_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duvidas_sac
    ADD CONSTRAINT duvidas_sac_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5118 (class 2606 OID 25061)
-- Name: duvidas_sac duvidas_sac_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duvidas_sac
    ADD CONSTRAINT duvidas_sac_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5106 (class 2606 OID 17079)
-- Name: etapa_avaliacao_pos_visita etapa_avaliacao_pos_visita_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_pos_visita
    ADD CONSTRAINT etapa_avaliacao_pos_visita_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5107 (class 2606 OID 17084)
-- Name: etapa_avaliacao_pos_visita etapa_avaliacao_pos_visita_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_pos_visita
    ADD CONSTRAINT etapa_avaliacao_pos_visita_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5064 (class 2606 OID 16627)
-- Name: etapa_avaliacao_qualidade etapa_avaliacao_qualidade_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_qualidade
    ADD CONSTRAINT etapa_avaliacao_qualidade_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5065 (class 2606 OID 16632)
-- Name: etapa_avaliacao_qualidade etapa_avaliacao_qualidade_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_avaliacao_qualidade
    ADD CONSTRAINT etapa_avaliacao_qualidade_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5091 (class 2606 OID 16885)
-- Name: etapa_conferencia_material etapa_conferencia_material_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_conferencia_material
    ADD CONSTRAINT etapa_conferencia_material_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5092 (class 2606 OID 16890)
-- Name: etapa_conferencia_material etapa_conferencia_material_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_conferencia_material
    ADD CONSTRAINT etapa_conferencia_material_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5080 (class 2606 OID 16777)
-- Name: etapa_conferencia_nf etapa_conferencia_nf_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_conferencia_nf
    ADD CONSTRAINT etapa_conferencia_nf_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5081 (class 2606 OID 16782)
-- Name: etapa_conferencia_nf etapa_conferencia_nf_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_conferencia_nf
    ADD CONSTRAINT etapa_conferencia_nf_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5095 (class 2606 OID 16923)
-- Name: etapa_definir_credito etapa_definir_credito_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_definir_credito
    ADD CONSTRAINT etapa_definir_credito_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5096 (class 2606 OID 16928)
-- Name: etapa_definir_credito etapa_definir_credito_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_definir_credito
    ADD CONSTRAINT etapa_definir_credito_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5072 (class 2606 OID 16698)
-- Name: etapa_direcionamento_comercial etapa_direcionamento_comercial_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_direcionamento_comercial
    ADD CONSTRAINT etapa_direcionamento_comercial_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5073 (class 2606 OID 16703)
-- Name: etapa_direcionamento_comercial etapa_direcionamento_comercial_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_direcionamento_comercial
    ADD CONSTRAINT etapa_direcionamento_comercial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5089 (class 2606 OID 16866)
-- Name: etapa_emitir_of etapa_emitir_of_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_emitir_of
    ADD CONSTRAINT etapa_emitir_of_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5090 (class 2606 OID 16871)
-- Name: etapa_emitir_of etapa_emitir_of_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_emitir_of
    ADD CONSTRAINT etapa_emitir_of_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5077 (class 2606 OID 16743)
-- Name: etapa_encaminhar_devolucao etapa_encaminhar_devolucao_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encaminhar_devolucao
    ADD CONSTRAINT etapa_encaminhar_devolucao_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5078 (class 2606 OID 16748)
-- Name: etapa_encaminhar_devolucao etapa_encaminhar_devolucao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encaminhar_devolucao
    ADD CONSTRAINT etapa_encaminhar_devolucao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5097 (class 2606 OID 16943)
-- Name: etapa_encerramento etapa_encerramento_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encerramento
    ADD CONSTRAINT etapa_encerramento_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5098 (class 2606 OID 16948)
-- Name: etapa_encerramento etapa_encerramento_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_encerramento
    ADD CONSTRAINT etapa_encerramento_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5093 (class 2606 OID 16903)
-- Name: etapa_gerar_credito etapa_gerar_credito_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_gerar_credito
    ADD CONSTRAINT etapa_gerar_credito_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5094 (class 2606 OID 16908)
-- Name: etapa_gerar_credito etapa_gerar_credito_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_gerar_credito
    ADD CONSTRAINT etapa_gerar_credito_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5084 (class 2606 OID 16815)
-- Name: etapa_receber_material etapa_receber_material_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_receber_material
    ADD CONSTRAINT etapa_receber_material_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5085 (class 2606 OID 16820)
-- Name: etapa_receber_material etapa_receber_material_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_receber_material
    ADD CONSTRAINT etapa_receber_material_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5086 (class 2606 OID 16835)
-- Name: etapa_revisao_material etapa_revisao_material_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_revisao_material
    ADD CONSTRAINT etapa_revisao_material_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5087 (class 2606 OID 16840)
-- Name: etapa_revisao_material etapa_revisao_material_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_revisao_material
    ADD CONSTRAINT etapa_revisao_material_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5082 (class 2606 OID 16795)
-- Name: etapa_solicitar_coleta etapa_solicitar_coleta_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_solicitar_coleta
    ADD CONSTRAINT etapa_solicitar_coleta_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5083 (class 2606 OID 16800)
-- Name: etapa_solicitar_coleta etapa_solicitar_coleta_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_solicitar_coleta
    ADD CONSTRAINT etapa_solicitar_coleta_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5074 (class 2606 OID 16718)
-- Name: etapa_visita_tecnica etapa_visita_tecnica_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_visita_tecnica
    ADD CONSTRAINT etapa_visita_tecnica_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5075 (class 2606 OID 16723)
-- Name: etapa_visita_tecnica etapa_visita_tecnica_responsavel_interno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_visita_tecnica
    ADD CONSTRAINT etapa_visita_tecnica_responsavel_interno_id_fkey FOREIGN KEY (responsavel_interno_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5076 (class 2606 OID 16728)
-- Name: etapa_visita_tecnica etapa_visita_tecnica_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etapa_visita_tecnica
    ADD CONSTRAINT etapa_visita_tecnica_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5101 (class 2606 OID 16981)
-- Name: historico_status historico_status_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_status
    ADD CONSTRAINT historico_status_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5102 (class 2606 OID 16986)
-- Name: historico_status historico_status_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.historico_status
    ADD CONSTRAINT historico_status_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5115 (class 2606 OID 25028)
-- Name: lote_reclamacoes lote_reclamacoes_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote_reclamacoes
    ADD CONSTRAINT lote_reclamacoes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_devolucao(id) ON DELETE CASCADE;


--
-- TOC entry 5116 (class 2606 OID 25033)
-- Name: lote_reclamacoes lote_reclamacoes_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lote_reclamacoes
    ADD CONSTRAINT lote_reclamacoes_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id);


--
-- TOC entry 5114 (class 2606 OID 25017)
-- Name: lotes_devolucao lotes_devolucao_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lotes_devolucao
    ADD CONSTRAINT lotes_devolucao_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- TOC entry 5103 (class 2606 OID 17006)
-- Name: notificacoes notificacoes_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE SET NULL;


--
-- TOC entry 5104 (class 2606 OID 17001)
-- Name: notificacoes notificacoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- TOC entry 5110 (class 2606 OID 17454)
-- Name: plano_acao_itens plano_acao_itens_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_acao_itens
    ADD CONSTRAINT plano_acao_itens_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5070 (class 2606 OID 16678)
-- Name: plano_acoes plano_acoes_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_acoes
    ADD CONSTRAINT plano_acoes_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5071 (class 2606 OID 16683)
-- Name: plano_acoes plano_acoes_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_acoes
    ADD CONSTRAINT plano_acoes_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5066 (class 2606 OID 16647)
-- Name: reclamacao_areas reclamacao_areas_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacao_areas
    ADD CONSTRAINT reclamacao_areas_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- TOC entry 5067 (class 2606 OID 16642)
-- Name: reclamacao_areas reclamacao_areas_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacao_areas
    ADD CONSTRAINT reclamacao_areas_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5068 (class 2606 OID 16662)
-- Name: reclamacao_defeitos reclamacao_defeitos_defeito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacao_defeitos
    ADD CONSTRAINT reclamacao_defeitos_defeito_id_fkey FOREIGN KEY (defeito_id) REFERENCES public.defeitos(id);


--
-- TOC entry 5069 (class 2606 OID 16657)
-- Name: reclamacao_defeitos reclamacao_defeitos_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacao_defeitos
    ADD CONSTRAINT reclamacao_defeitos_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5061 (class 2606 OID 16607)
-- Name: reclamacoes reclamacoes_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacoes
    ADD CONSTRAINT reclamacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);


--
-- TOC entry 5062 (class 2606 OID 16612)
-- Name: reclamacoes reclamacoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacoes
    ADD CONSTRAINT reclamacoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.usuarios(id);


--
-- TOC entry 5063 (class 2606 OID 25038)
-- Name: reclamacoes reclamacoes_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reclamacoes
    ADD CONSTRAINT reclamacoes_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_devolucao(id);


--
-- TOC entry 5088 (class 2606 OID 16853)
-- Name: romaneio_itens romaneio_itens_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.romaneio_itens
    ADD CONSTRAINT romaneio_itens_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5105 (class 2606 OID 17033)
-- Name: sessoes sessoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessoes
    ADD CONSTRAINT sessoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- TOC entry 5111 (class 2606 OID 17595)
-- Name: solicitacoes_complemento solicitacoes_complemento_reclamacao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacoes_complemento
    ADD CONSTRAINT solicitacoes_complemento_reclamacao_id_fkey FOREIGN KEY (reclamacao_id) REFERENCES public.reclamacoes(id) ON DELETE CASCADE;


--
-- TOC entry 5112 (class 2606 OID 17600)
-- Name: solicitacoes_complemento solicitacoes_complemento_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.solicitacoes_complemento
    ADD CONSTRAINT solicitacoes_complemento_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.usuarios(id);


--
-- TOC entry 5113 (class 2606 OID 17619)
-- Name: tokens_redefinicao_senha tokens_redefinicao_senha_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tokens_redefinicao_senha
    ADD CONSTRAINT tokens_redefinicao_senha_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


-- Completed on 2026-03-31 08:45:45

--
-- PostgreSQL database dump complete
--

\unrestrict LnofkskckjmMyGY0XewA53jbEFRTbhRBTtLbSQhijui8MwLX10yJf3LZZySawUp


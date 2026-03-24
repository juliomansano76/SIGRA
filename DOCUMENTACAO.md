# Sistema de Reclamações Externas — Documentação do Banco de Dados

## Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| Banco de dados | PostgreSQL 15+ |
| Backend | Node.js + Express |
| Frontend | HTML + CSS + JS (Vanilla ou com framework leve) |
| Autenticação | Sessões server-side (token em cookie httpOnly) |
| Upload de arquivos | Multer (Node.js) — armazenamento local |
| E-mails | Nodemailer + worker de fila própria |

---

## Diagrama de Entidades Principais

```
usuarios
  └─ cria ──► reclamacoes ◄── clientes
                  │
                  ├─► etapa_avaliacao_qualidade
                  │       └─► reclamacao_areas
                  │       └─► reclamacao_defeitos
                  │       └─► plano_acoes
                  │
                  ├─► etapa_direcionamento_comercial
                  ├─► etapa_visita_tecnica
                  ├─► etapa_encaminhar_devolucao
                  │       └─► cotacoes_frete
                  ├─► etapa_conferencia_nf
                  ├─► etapa_solicitar_coleta
                  ├─► etapa_receber_material
                  ├─► etapa_revisao_material
                  │       └─► romaneio_itens
                  ├─► etapa_emitir_of
                  ├─► etapa_conferencia_material
                  ├─► etapa_gerar_credito
                  ├─► etapa_definir_credito
                  ├─► etapa_encerramento
                  │
                  ├─► arquivos           (uploads de qualquer etapa)
                  ├─► historico_status   (log automático via trigger)
                  └─► notificacoes
```

---

## Perfis e Permissões por Tela

| Menu / Ação | Admin | SAC | Qualidade | Comercial | Financeiro | Fiscal | Expedição | Revisão | PCP |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Inserir Nova Reclamação | ✅ | ✅ | | | | | | | |
| Reclamações (ver todas) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pendências (ver as suas) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adicionar Cliente | ✅ | ✅ | | | | | | | |
| Cadastro de Áreas | ✅ | | ✅ | | | | | | |
| Cadastro de Defeitos | ✅ | | ✅ | | | | | | |
| Cadastro de Usuários | ✅ | | | | | | | | |

---

## Fluxo de Status — Máquina de Estados

```
[rascunho]
    │ SAC conclui
    ▼
[reclamacao_cadastrada / aguardando_analise_qualidade]
    │ Qualidade avalia
    ▼
    ├─ Improcedente ──► [aguardando_comercial_improcedente]
    │                          │
    └─ Procedente  ──► [aguardando_comercial_procedente]
                               │
                    Comercial direciona
                               │
              ┌────────────────┼──────────────────┐
              │ Visita técnica │ Sem visita        │
              ▼                ▼                   │
    [aguardando_visita]   Direcionamento      Direcionamento
              │           final               final
              │ Qualidade  │                  │
              │ realiza    │                  │
              ▼            ▼                  ▼
    [aguardando_direcionamento_pos_visita]
              │
    Comercial direciona
              │
    ┌─────────┴──────────────┐──────────────┐
    │ Devolução              │ Crédito      │ Sem ação
    ▼                        ▼              ▼
[encaminhando_devolucao] [gerando_credito] [aguardando_encerramento]
    │ (fluxo logístico)      │              │
    │                        ▼              ▼
    │               [gerando_credito_sac] [concluida]
    │                        │
    │               [aguardando_encerramento]
    │                        │
    └──────────► [concluida] ◄┘
```

---

## Decisões de Design

### Por que uma tabela por etapa?

Cada etapa do fluxo tem campos muito específicos e pertencentes a setores diferentes. Usar uma única tabela com dezenas de colunas nullable seria difícil de manter e validar. Com tabelas separadas:

- Cada setor só enxerga/escreve nos seus dados
- Validações são mais claras no backend
- Histórico por etapa é mais limpo
- Adição de campos futuros não quebra a estrutura principal

### Por que `historico_status` via trigger?

O trigger `trg_reclamacoes_historico_status` garante que **toda** mudança de status seja registrada automaticamente, sem depender do código da aplicação. Isso elimina o risco de logs incompletos por bug ou esquecimento.

### Arquivos centralizados com campo `etapa`

Em vez de ter uma tabela de arquivos por etapa (12+ tabelas), todos os uploads ficam em `arquivos` com o campo `etapa` indicando a origem. Isso simplifica queries, listagem do histórico completo e limpeza de arquivos.

### Fila de e-mails própria

A tabela `fila_emails` permite que o Node.js processe os e-mails de forma assíncrona via um worker/cron (ex: a cada 30s), com controle de tentativas e erros. Isso é mais robusto do que enviar e-mails inline nas requests.

---

## Próximos Passos de Desenvolvimento

### Fase 1 — Backend Node.js
```
reclamacoes-backend/
├── src/
│   ├── config/
│   │   ├── database.js       # Conexão PostgreSQL (pg pool)
│   │   └── mailer.js         # Configuração Nodemailer
│   ├── middleware/
│   │   ├── auth.js           # Verificação de sessão
│   │   └── permissao.js      # RBAC por perfil
│   ├── routes/
│   │   ├── auth.js           # Login / logout
│   │   ├── reclamacoes.js    # CRUD + transições de status
│   │   ├── clientes.js
│   │   ├── usuarios.js
│   │   ├── areas.js
│   │   ├── defeitos.js
│   │   └── arquivos.js       # Upload com Multer
│   ├── services/
│   │   ├── fluxo.js          # Lógica de transição de etapas
│   │   └── notificacao.js    # Cria notificações + enfileira e-mails
│   └── workers/
│       └── email.js          # Processa fila_emails (setInterval)
└── package.json
```

### Fase 2 — Frontend HTML
```
reclamacoes-frontend/
├── index.html              # Login
├── pages/
│   ├── dashboard.html      # Pendências + resumo
│   ├── reclamacoes.html    # Lista de reclamações
│   ├── nova-reclamacao.html
│   ├── detalhe-reclamacao.html  # Hub de todas as etapas
│   └── cadastros/
│       ├── clientes.html
│       ├── usuarios.html
│       ├── areas.html
│       └── defeitos.html
├── js/
│   ├── api.js              # Wrapper fetch para a API
│   ├── auth.js
│   └── components/
│       ├── upload.js       # Componente de upload de arquivos
│       └── historico.js    # Timeline de histórico
└── css/
    └── style.css
```

### Dependências Node.js sugeridas
```json
{
  "dependencies": {
    "express": "^4.18",
    "pg": "^8.11",
    "bcryptjs": "^2.4",
    "multer": "^1.4",
    "nodemailer": "^6.9",
    "uuid": "^9.0",
    "dotenv": "^16.0"
  },
  "devDependencies": {
    "nodemon": "^3.0"
  }
}
```

### Variáveis de ambiente (.env)
```env
# Banco
DB_HOST=localhost
DB_PORT=5432
DB_NAME=reclamacoes
DB_USER=postgres
DB_PASSWORD=sua_senha

# Sessão
SESSION_SECRET=chave_secreta_longa_e_aleatoria
SESSION_EXPIRES_HOURS=8

# E-mail (SMTP)
SMTP_HOST=smtp.empresa.com.br
SMTP_PORT=587
SMTP_USER=sistema@empresa.com.br
SMTP_PASS=senha_email
EMAIL_FROM="Sistema de Reclamações <sistema@empresa.com.br>"

# Uploads
UPLOAD_DIR=./uploads
UPLOAD_MAX_MB=50

# App
PORT=3000
NODE_ENV=production
```

---

## Como Aplicar o Schema

```bash
# 1. Criar o banco
psql -U postgres -c "CREATE DATABASE reclamacoes;"

# 2. Aplicar o schema
psql -U postgres -d reclamacoes -f schema.sql

# 3. Verificar tabelas criadas
psql -U postgres -d reclamacoes -c "\dt"
```

# Migração do FitPower para backend próprio com MySQL

Objetivo: sair do Lovable Cloud e passar a usar um banco MySQL seu, com backend próprio.

## O que precisa ficar claro antes

- O Lovable Cloud não pode ser trocado por MySQL "por dentro". A base atual (Postgres) fornece também login/autenticação, regras de permissão por usuário (RLS) e armazenamento de arquivos (capas e PDFs dos ebooks). Nada disso existe pronto no MySQL.
- Portanto a migração é uma reconstrução do backend: você (ou um servidor seu) passa a expor uma API, e o app FitPower consome essa API no lugar do Cloud.
- Desconectar o Cloud deste projeto é irreversível e apaga banco, arquivos e funções. Só faça isso depois que a migração estiver validada.

## Fase 1 — Exportar o que existe hoje (sem quebrar nada)

- Exportar em CSV as tabelas: `profiles`, `user_roles`, `workout_logs`, `ebooks`, `ebook_reading_progress`, `plans`, `subscribers`, `payment_webhook_events`.
- Baixar os arquivos dos buckets `ebook-covers` e `ebook-pdfs`.
- Entregar um script SQL MySQL (`schema.mysql.sql`) com as mesmas tabelas convertidas: `uuid` → `CHAR(36)`, `timestamptz` → `DATETIME(3)`, `numeric` → `DECIMAL(10,2)`, `text[]` (dias_lembrete) → `JSON`, enum `app_role` → `ENUM('admin','user')`, mais índices e chaves estrangeiras.
- Entregar também os `INSERT`s de carga a partir dos CSVs.

## Fase 2 — Serviço backend próprio (fora do Lovable)

Você precisará hospedar (Railway, Render, VPS, etc.) um serviço Node/Express ou similar que conecte ao MySQL e ofereça:

- Autenticação: e-mail/senha com hash (bcrypt/argon2) + tokens JWT, recuperação de senha e envio de e-mail (SMTP/Resend). Substitui o login atual.
- Autorização: verificação de admin lendo `user_roles` no servidor (hoje é feito por RLS).
- Endpoints REST para treinos, progresso, perfil, ebooks, planos e assinantes.
- Armazenamento de arquivos: S3/R2 (ou disco) com URLs assinadas para capas e PDFs, incluindo a regra atual de prévia gratuita (3 a 10 páginas) e liberação total só para assinantes/admin.
- Webhook da Cakto reescrito nesse serviço, criando usuário e assinatura no MySQL.

## Fase 3 — Adaptar o app FitPower

- Criar uma camada de API (`src/lib/api.ts`) apontando para a URL do seu backend.
- Trocar todas as chamadas atuais do Cloud por essa camada: dashboard, treinos, progresso, perfil, biblioteca/leitor de ebooks, planos, e toda a área admin (ebooks, usuários, planos, faturamento).
- Trocar o guard de rotas autenticadas e o hook de admin para o JWT do novo backend.
- Manter o webhook antigo desativado e remover as integrações do Cloud somente ao final.

## Fase 4 — Corte

- Rodar app + backend novo em paralelo, validar login, leitura de ebook, compra e admin.
- Só então desconectar o Cloud (Cloud → Advanced → Disconnect), lembrando que é irreversível.

## Detalhes técnicos

- O MySQL não pode ser acessado direto do navegador: toda consulta passa pela sua API. As funções de servidor do app (`createServerFn`) podem chamar essa API, mas a conexão MySQL vive no seu serviço.
- Segredos do novo backend (URL da API, chaves) entram como variáveis: `VITE_API_URL` para o cliente e segredos sem prefixo para uso apenas em servidor.
- Sessões passam a usar token JWT guardado no cliente, com renovação; o comportamento do `_authenticated` continua igual para o usuário.

## Escopo desta primeira entrega

Como o backend próprio precisa ser hospedado por você, sugiro começar pelas Fases 1 (export completo + schema MySQL + dados) e pela especificação dos endpoints da Fase 2. Assim que o serviço estiver de pé com uma URL, eu faço a Fase 3 no app.

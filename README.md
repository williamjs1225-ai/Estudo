# Scripta — Professor de Escrita com IA

PWA completo (HTML/CSS/JS puro, sem frameworks) para ajudar qualquer pessoa a
melhorar escrita, gramática, ortografia, vocabulário e comunicação, com um
coach de IA disponível 24h. App de uso pessoal — sem login.

## Como ligar a IA de verdade

Vá em **Perfil → IA**, escolha o provedor (Groq, OpenAI ou Gemini) e cole sua
chave de API. Ela fica salva só no `IndexedDB` do seu navegador; as
chamadas (correção, chat, leitura, dica do dia) vão direto do seu navegador
pro provedor escolhido, sem precisar rodar o backend em `/server`.

Use "Testar conexão" pra confirmar que a chave funciona antes de contar com ela.

**Importante**: como a chave fica no navegador, não hospede este app
publicamente com sua chave configurada — qualquer pessoa com acesso ao site
consegue lê-la pelo DevTools. Pra uso só seu (localmente ou num domínio que só
você acessa), é seguro.

Sem chave configurada, o app tenta o backend em `/server` (se estiver
rodando) e, por último, cai em respostas simuladas — nunca trava.

## Status: telas completas

- Splash, Início, Escrita (editor + análise com IA), IA Coach (chat),
  Leitura (textos + perguntas de interpretação), Progresso (plano de
  estudo + vocabulário) e Perfil — todas funcionais, com dados salvos em
  `IndexedDB`.

## Como rodar o front-end

Qualquer servidor estático funciona (service workers exigem HTTP, não `file://`):

```bash
npx serve .
# ou
python3 -m http.server 5500
```

Abra `http://localhost:5500` (ajuste a porta no `CLIENT_ORIGIN` do backend).

## Como rodar o backend

```bash
cd server
cp .env.example .env   # preencha GROQ_API_KEY (ou OPENAI/GEMINI) e o Supabase
npm install
npm run dev
```

## Schema sugerido do Supabase

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  photo_url text,
  goal_daily_words int default 500,
  goals jsonb,
  preferences jsonb,
  created_at timestamptz default now()
);

create table texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  title text,
  content text,
  word_count int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  messages jsonb, -- [{ role, content, timestamp }]
  created_at timestamptz default now()
);

create table statistics (
  user_id uuid primary key references users(id),
  streak_days int default 0,
  words_total int default 0,
  accuracy int default 0,
  vocab_learned int default 0,
  words_today int default 0,
  updated_at timestamptz default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  type text,
  level int,
  question jsonb,
  user_answer text,
  is_correct boolean,
  created_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  period text, -- 'daily' | 'weekly'
  description text,
  completed boolean default false,
  due_date date
);

create table vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  word text,
  definition text,
  interval_days int default 1,
  next_review_at timestamptz default now()
);
```

## Padrão de código (siga em todas as fases seguintes)

- Mudanças cirúrgicas, preservando os padrões já existentes
- Validação de sintaxe com `node --check` antes de qualquer entrega
- Nenhuma chave de API no front-end — tudo passa pelo backend
- Um arquivo CSS por responsabilidade (`tokens`, `base`, `components`, `screens`)
- Comentários em português explicando o "porquê", não só o "o quê"

## Próximos passos sugeridos

1. Editor Inteligente (tela mais complexa: correção em tempo real)
2. IA Coach (chat, reaproveitando `/api/chat`)
3. Exercícios + Leitura (reaproveitando `/api/exercises` e `/api/reading`)
4. Estatísticas com gráficos (Chart.js, como no projeto Academia) + Plano + Vocabulário
5. Perfil

Me diga por qual tela quer continuar.

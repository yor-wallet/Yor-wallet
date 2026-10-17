-- 20261012 — chain_notices : un e-mail par (personne, transaction crypto, événement), écrit uniquement par la fonction chain-notice.
--
-- La fonction chain-notice envoie à la personne connectée l'e-mail « transfert envoyé au réseau » (event = 'sent') puis
-- « transfert confirmé » (event = 'confirmed', seulement si la chaîne le prouve). Cette table sert à ne jamais envoyer deux fois
-- le même e-mail, à relancer un envoi qui a échoué et à limiter à 30 e-mails crypto par personne et par 24 h.
-- Accès : RLS activée, AUCUNE politique, aucun droit pour anon / authenticated : seule la clé de service de la fonction y touche.
-- Aucune adresse e-mail n'est stockée ici (la fonction la relit depuis le compte à chaque envoi).

create table if not exists public.chain_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  txid text not null check (txid ~ '^[0-9a-f]{64}$'),
  event text not null check (event in ('sent', 'confirmed')),
  status text not null default 'SENDING' check (status in ('SENDING', 'SENT', 'FAILED')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, txid, event)
);

create index if not exists chain_notices_user_created_idx on public.chain_notices (user_id, created_at desc);

alter table public.chain_notices enable row level security;
revoke all on public.chain_notices from public, anon, authenticated;

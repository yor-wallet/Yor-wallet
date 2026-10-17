-- 20261018 — Notifications push (iPhone / Android / ordinateur) : la notification arrive même si l'application est fermée.
--
-- Principe : l'appareil s'abonne (Réglages → Alertes sur ce téléphone) en appelant la fonction push-send (action « subscribe »), qui contrôle l'adresse
-- de livraison puis l'écrit dans public.push_subscriptions. Dès qu'une ligne est écrite dans public.notifications (transfert envoyé, argent reçu,
-- dépôt), la base APPELLE la fonction push-send (pg_net, comme send-notice), qui chiffre le message (Web Push, RFC 8291) et le remet au service de
-- push d'Apple (APNs) ou de Google, qui le livre à l'appareil.
-- Une erreur dans cette chaîne ne fait JAMAIS échouer un transfert : le déclencheur attrape toute exception.
--
-- Appliqué en production le 17 octobre 2026 en trois migrations : web_push_tables (§1-§4), web_push_cfg (§4, adresse de la fonction), web_push_trigger (§5).
-- Aucune fonction SQL d'abonnement : tout passe par la fonction push-send (service), qui valide l'adresse (Apple / Google / Firefox / Edge seulement).

-- 1. Abonnements (un par appareil). Aucun droit pour l'application : seule la fonction push-send (rôle service) lit et écrit.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_ok_at timestamptz,
  last_status integer,
  fail_count integer not null default 0
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
comment on table public.push_subscriptions is 'Abonnements Web Push (un par appareil). Contient des secrets de chiffrement : aucun accès public (RLS sans politique) ; écriture par la fonction push-send.';

-- 2. Clé VAPID du serveur (générée par la fonction push-send à la première utilisation). Table privée : la clé privée n'est lisible que par le service.
create table if not exists public.push_vapid (
  id boolean primary key default true check (id),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_vapid enable row level security;
revoke all on public.push_vapid from public, anon, authenticated;
comment on table public.push_vapid is 'Paire de clés VAPID (ES256). private_jwk ne doit JAMAIS être exposée. Ne pas régénérer : tous les abonnements existants deviendraient invalides.';

-- 3. Une seule notification push par ligne de public.notifications, même si la base appelle deux fois.
create table if not exists public.push_sent (
  notification_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from public, anon, authenticated;

-- 4. Adresse de la fonction (même table privée que send-notice : même jeton interne).
alter table public.notice_dispatch_cfg add column if not exists push_fn_url text;
update public.notice_dispatch_cfg set push_fn_url = 'https://gebjmguoauvutiqvoswl.supabase.co/functions/v1/push-send' where id and push_fn_url is null;

-- 5. Déclencheur : une ligne de notification d'ARGENT (la crypto est masquée dans l'application) → appel de push-send, seulement si la personne a un appareil abonné.
create or replace function public._push_on_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.notice_dispatch_cfg;
begin
  if new.type not in ('TRANSFER_SENT', 'TRANSFER_RECEIVED', 'DEPOSIT') then return new; end if;
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return new; end if;
  select * into c from public.notice_dispatch_cfg where id;
  if c.token is null or c.push_fn_url is null then return new; end if;
  perform net.http_post(
    url := c.push_fn_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || c.anon_key, 'apikey', c.anon_key, 'x-notice-token', c.token),
    timeout_milliseconds := 20000);
  return new;
exception when others then
  raise warning '_push_on_notification failed: %', sqlerrm;
  return new;      -- jamais d'échec du transfert à cause d'une notification
end $$;
revoke all on function public._push_on_notification() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'notifications_push' and tgrelid = 'public.notifications'::regclass) then
    create trigger notifications_push after insert on public.notifications
      for each row execute function public._push_on_notification();
  end if;
end $$;

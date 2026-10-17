-- 12 octobre 2026 — décision du propriétaire : un envoi crypto vers une adresse externe est CONFIRMÉ tout de suite, sans étape d'attente.
-- Avant : la ligne était créée en PENDING et rien ne la faisait jamais passer à CONFIRMED (le débit était fait, le reçu restait « en attente »).
-- Après : CONFIRMED à la création (le déclencheur tx_email_ins envoie alors l'e-mail de transaction comme pour les autres opérations).
-- Vérité des données : meta.ledger_only = true dit que l'opération est une écriture du registre YOR, SANS diffusion sur une blockchain.
-- Le reste de la fonction est conservé tel quel (patch sur la définition en place, chaque remplacement doit trouver exactement 1 occurrence).
-- Appliquée sur le projet gebjmguoauvutiqvoswl le 12/10/2026 (migration « crypto_send_external_instant_confirm »).
do $m$
declare
  d text;
  pairs text[][] := array[
    array[$a$v_total, 'PENDING',$a$,                                  $b$v_total, 'CONFIRMED',$b$],
    array[$a$'networkFee', v_gas))$a$,                                $b$'networkFee', v_gas, 'ledger_only', true, 'settlement', 'instant'))$b$],
    array[$a$v_amt::text || ' ' || v_asset || ' is being sent'$a$,    $b$v_amt::text || ' ' || v_asset || ' sent'$b$],
    array[$a$'status', 'PENDING', 'internal', false,$a$,              $b$'status', 'CONFIRMED', 'internal', false,$b$]
  ];
  i int; occ int;
begin
  select pg_get_functiondef('public._crypto_send_external_impl(text,text,text,text,numeric,text)'::regprocedure) into d;
  for i in 1 .. array_length(pairs, 1) loop
    occ := (length(d) - length(replace(d, pairs[i][1], ''))) / length(pairs[i][1]);
    if occ <> 1 then raise exception 'patch % : % occurrence(s) de %', i, occ, pairs[i][1]; end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  execute d;
end
$m$;

/* Logique PURE de la fonction send-notice (message au destinataire d'un transfert).
   Aucun accès réseau, aucune base : tout est testable avec `node --test`.

   Règles de contenu (décidées avec le propriétaire du produit) :
   - le texte donne les DÉTAILS de la transaction : montant, montant estimé à recevoir, expéditeur, référence, date ;
   - il ne contient NI « YOR ID », NI identifiant interne, NI le nom de la marque (pas même dans la référence) ;
   - transfert EXTERNE, message au bénéficiaire : « confirmé » (décidé le 10 octobre 2026 : quand l'argent est sorti du compte de
     l'expéditeur, le transfert est confirmé). Il ne dit JAMAIS « reçu » : l'application ne peut pas vérifier que la personne a le
     montant en main, aucun circuit de paiement réel n'existe encore ;
   - « Reçu » n'est utilisé que pour un transfert interne entre deux comptes de l'application (l'argent est réellement arrivé) ;
   - les SMS sont en anglais, style notification bancaire, et disent « Confirmed » (décidé le 10 octobre 2026) : jamais « Test », jamais « en cours ».
     Les e-mails de l'expéditeur gardent leur avertissement « le versement au bénéficiaire n'est pas suivi ». */

export type Lang = "fr" | "en" | "ar";
export type Outcome = "SUCCESS" | "FAILED" | "PENDING";
export type Audience = "EXTERNAL" | "INTERNAL" | "SENDER";   // SENDER = confirmation du débit envoyée à l'expéditeur lui-même

export interface NoticeData {
  audience: Audience;
  amount: number;                       // montant envoyé (OMR)
  currency: string;                     // devise du montant envoyé
  dest: { amount: number; currency: string } | null; // montant estimé à recevoir (taux configuré, pas un taux bancaire)
  from: string;                         // libellé expéditeur déjà nettoyé (peut être vide)
  ref: string;
  createdAt: string;                    // ISO
  /* Détail du débit (confirmation à l'expéditeur) : valeurs RÉELLES lues dans la transaction, jamais inventées.
     Si total est absent, le message n'affiche pas de frais et parle du seul montant envoyé. */
  total?: number | null;                // montant réellement débité = montant + frais + TVA
  service?: string;                     // service choisi (ex. « Orange Money »), déjà nettoyé
  to?: string;                          // numéro du bénéficiaire : complet « +96891234567 » (service par téléphone) ou masqué « ***1234 » (compte bancaire) — voir recipientNumber
  rate?: number | null;                 // taux configuré (pas un taux bancaire)
  toName?: string;                      // transfert INTERNE : nom du destinataire (« Adam K. ») montré dans la confirmation de l'expéditeur
  /* Message au BÉNÉFICIAIRE : le numéro de l'EXPÉDITEUR, tel que la base l'a normalisé (« +96877986533 »). Décidé avec le propriétaire du produit
     (12 octobre 2026) : le destinataire voit le numéro de l'expéditeur. Vide si l'expéditeur n'a aucun numéro enregistré : on retombe alors sur son
     nom (« Prénom I. »), jamais sur un numéro inventé. */
  fromPhone?: string;
  /* Message au BÉNÉFICIAIRE, modèle arabe (12 octobre 2026) : le compte du bénéficiaire (« إلى الحساب »), numéro complet « +96891234567 » ou masqué « ***1234 »,
     et si le transfert est réellement international (pays de l'expéditeur et du bénéficiaire connus et différents). Vide / faux = la ligne ou l'avertissement manque. */
  account?: string;
  international?: boolean;
  /* 12.5.0 — SMS structuré (« Dear Customer » / « عزيزي العميل »). Tout est optionnel : une ligne n'est écrite que si sa valeur existe. */
  outcome?: Outcome;                     // SUCCESS (défaut) | FAILED | PENDING : l'issue RÉELLE de la transaction au moment de l'envoi
  balance?: { amount: number; currency: string } | null;   // solde disponible LU dans le registre (ledger_entries.balance_after) pour cette transaction, jamais calculé ici
  /* 12.12.0 — pays (code à 2 lettres) dont on affiche l'heure locale : pays de l'expéditeur pour sa confirmation, pays du bénéficiaire pour son message.
     Pays absent ou inconnu → l'heure reste en UTC et le SMS l'écrit « UTC » (rien n'est supposé). */
  tzCountry?: string;
}

/* Langue de TOUS les SMS de transfert (décidé avec le propriétaire du produit, 10 octobre 2026) : anglais, style notification bancaire.
   Les gabarits français et arabe restent dans le code (ils servent aux e-mails et à un retour en arrière), mais aucun SMS n'est envoyé
   dans ces langues tant que cette constante vaut « en ». */
export const SMS_LANG: Lang = "en";

/* Comparaison à durée constante (jeton interne de déclenchement automatique). Deux chaînes vides ne sont jamais égales. */
export function safeEqual(a: unknown, b: unknown): boolean {
  const x = String(a ?? ""), y = String(b ?? "");
  if (!x || x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return r === 0;
}

/* Langue du message = langue du pays du numéro : arabe pour le Golfe, le Levant, l'Égypte, le Soudan, le Yémen, l'Irak, la Libye ;
   français pour l'Afrique de l'Ouest et centrale francophone ; anglais sinon. */
const FR_COUNTRIES = ["ML", "CI", "BF", "GN", "SN", "NE", "TG", "BJ", "CM", "TD", "GA", "CG", "CD", "FR"];
const AR_COUNTRIES = ["OM", "AE", "SA", "KW", "QA", "BH", "YE", "IQ", "JO", "LB", "SY", "PS", "EG", "SD", "LY"];

/* Langue du pays, ou null si le pays n'a pas de langue connue (l'appelant choisit alors la langue de la personne). */
export function knownLangForCountry(iso: string): Lang | null {
  const c = String(iso ?? "").toUpperCase();
  if (FR_COUNTRIES.includes(c)) return "fr";
  if (AR_COUNTRIES.includes(c)) return "ar";
  return null;
}
export function langForCountry(iso: string): Lang {
  return knownLangForCountry(iso) ?? "en";
}

/* Langue de la CONFIRMATION envoyée à l'expéditeur (décidé avec le propriétaire du produit, 10 octobre 2026) :
   - le compte est dans un pays arabophone (Oman, Émirats…) → toujours l'arabe, quel que soit le service (Orange Money compris) ;
   - sinon la langue du service choisi (pays du bénéficiaire) ;
   - sinon la langue de la personne. */
export function senderNoticeLang(senderCountry: string, serviceCountry: string, userLang: Lang): Lang {
  if (knownLangForCountry(senderCountry) === "ar") return "ar";
  return knownLangForCountry(serviceCountry) ?? userLang;
}

export const FIAT_DEC: Record<string, number> = { OMR: 3, XOF: 0, USD: 2, AED: 2, SAR: 2, EGP: 2, SDG: 2, GNF: 0 };

export function fmtNumber(n: number, dec: number, lang: Lang): string {
  if (!Number.isFinite(n)) return "";
  const fixed = Math.abs(n).toFixed(dec);
  const [i, f] = fixed.split(".");
  const group = lang === "fr" ? " " : ",";
  const dsep = lang === "fr" ? "," : ".";
  const ig = i.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (n < 0 ? "-" : "") + ig + (f ? dsep + f : "");
}
export const fmtMoney = (n: number, cur: string, lang: Lang) => `${fmtNumber(n, FIAT_DEC[cur] ?? 2, lang)} ${cur}`;

const p2 = (n: number) => String(n).padStart(2, "0");
export function fmtDateUtc(iso: string): { date: string; time: string; both: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "", both: "" };
  const date = `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const time = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`;
  return { date, time, both: `${date} ${time}` };
}

/* Le prénom/nom vient d'un profil que l'utilisateur écrit lui-même : on ne laisse passer que des lettres,
   espaces, tirets et apostrophes (pas de point : « a.b » ressemblerait à un lien), jamais de chiffres ni de lien (sinon le SMS serait un vecteur d'hameçonnage). */
export function senderLabel(first?: string | null, last?: string | null): string {
  const clean = (s: unknown) => String(s ?? "").normalize("NFC").replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s+/g, " ").trim();
  const f = clean(first).split(" ")[0] ?? "";
  const l = clean(last);
  const initial = l ? [...l][0].toUpperCase() + "." : "";
  return `${f}${f && initial ? " " : ""}${initial}`.trim().slice(0, 24);
}

export const stripDiacritics = (s: string) => s.normalize("NFD").replace(new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"), "");   // combining marks U+0300-U+036F
export const isGsm7Safe = (s: string) => /^[\x20-\x7E\n]*$/.test(s);
export function smsSegments(text: string): { chars: number; unicode: boolean; segments: number } {
  const chars = [...text].length;
  const unicode = !isGsm7Safe(text);
  const single = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  return { chars, unicode, segments: chars <= single ? 1 : Math.ceil(chars / multi) };
}

/* « Adam K. » finit déjà par un point : on ne double pas le point avant « Réf. ». */
const endSentence = (s: string) => (/[.!?]$/.test(s) ? s : s + ".");

/* Le SMS destiné au BÉNÉFICIAIRE ne contient jamais « YOR » (décidé avec le propriétaire du produit, 10 octobre 2026) :
   la référence « YOR-TX-20261010-F627B7 » s'écrit « TX-20261010-F627B7 ». La confirmation envoyée à l'expéditeur garde la référence complète. */
/* La base garde « YOR-TX-… » ; l'application et les messages de l'EXPÉDITEUR affichent « FRD-TX-… » (12.9.0). Le BÉNÉFICIAIRE, lui, voit « TX-… » (recipientRef). */
export const dispRef = (ref: unknown) => String(ref ?? "").replace(/^YOR-/i, "FRD-");
export const recipientRef = (ref: unknown) => String(ref ?? "").replace(/yor[-_ ]*/gi, "");

/* Le nom du service vient d'un champ que l'application envoie : lettres, chiffres, espaces et tirets seulement (pas de lien, pas de point,
   pas de symbole), 24 caractères au plus. Vide si rien de sûr ne reste. */
export function cleanService(raw: unknown): string {
  return String(raw ?? "").normalize("NFC").replace(/[^\p{L}\p{M}\p{N} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24).trim();
}

/* Frais totaux (frais + TVA) = total débité − montant envoyé, 0 si l'information manque ou est incohérente. */
export function feesOf(d: NoticeData): number {
  if (d.total == null || !Number.isFinite(Number(d.total))) return 0;
  const f = Math.round((Number(d.total) - d.amount) * 1000) / 1000;
  return f > 0 ? f : 0;
}

/* Numéro du bénéficiaire : chiffres, « * » et « + » seulement (GSM-safe, jamais un lien). */
export const cleanTo = (raw: unknown) => String(raw ?? "").replace(/[^0-9*+]/g, "").slice(0, 16);

/* Numéro du bénéficiaire montré dans la confirmation envoyée à l'EXPÉDITEUR (décidé avec le propriétaire du produit, 10 octobre 2026) :
   - service par téléphone (Orange Money, Wave, services d'Oman…) : numéro international COMPLET, « +96891234567 ». Il vient du numéro
     que l'expéditeur a lui-même saisi, déjà normalisé par la base (chiffres seuls) ; à défaut, de la saisie si elle commence par « + » ;
   - IBAN, compte bancaire, identifiant de service : masqué « ***1234 » (un numéro de compte ne circule pas en clair par SMS) ;
   - rien de sûr : chaîne vide (le message omet alors le numéro, il n'invente rien). */
export const PHONE_IDENTIFIERS = ["MOBILE_MONEY", "PHONE"];
export function recipientNumber(identifierType: unknown, e164Digits: unknown, rawIdentifier: unknown): string {
  const raw = String(rawIdentifier ?? "").trim();
  const rawDigits = raw.replace(/\D/g, "");
  if (PHONE_IDENTIFIERS.includes(String(identifierType ?? ""))) {
    const e = String(e164Digits ?? "").replace(/\D/g, "");
    if (e.length >= 8 && e.length <= 15) return "+" + e;
    if (raw.startsWith("+") && !/[A-Za-z/]/.test(raw) && rawDigits.length >= 8 && rawDigits.length <= 15) return "+" + rawDigits;
  }
  return rawDigits.length >= 6 ? "***" + rawDigits.slice(-4) : "";
}

/* Dans un texte arabe (écrit de droite à gauche), « +968… » peut s'afficher « …968+ » : on isole en gauche-à-droite (LRE … PDF), vérifié au rendu. */
const ltrIsolate = (s: string) => (s ? String.fromCharCode(0x202a) + s + String.fromCharCode(0x202c) : s);   // LRE (U+202A) ... PDF (U+202C)

/* Montant réellement débité et frais : lus dans la transaction, jamais inventés. */
function debitParts(lang: Lang, d: NoticeData) {
  const hasTotal = d.total != null && Number.isFinite(Number(d.total));
  const fees = feesOf(d);
  return {
    amt: fmtMoney(d.amount, d.currency, lang),
    debited: fmtMoney(hasTotal ? Number(d.total) : d.amount, d.currency, lang),
    feeTxt: fees > 0 ? fmtMoney(fees, d.currency, lang) : "",
    /* conversion (Orange Money : OMR → XOF) : on montre le montant dans la devise du service ; même devise (Oman) : rien à convertir */
    dest: d.dest && d.dest.currency !== d.currency ? fmtMoney(d.dest.amount, d.dest.currency, lang) : "",
    svc: cleanService(d.service), to: cleanTo(d.to), when: fmtDateUtc(d.createdAt).both,
  };
}

/* Confirmation du débit pour l'EXPÉDITEUR (SMS : statut « Confirmed » / « Confirmé » / « مؤكد », le transfert est enregistré et le compte débité). */
function buildSenderSms(lang: Lang, d: NoticeData): string {
  const { amt, debited, feeTxt, dest, svc, to, when } = debitParts(lang, d);
  /* Arabe : le groupe « (+96891234567) » est isolé en gauche-à-droite EN ENTIER, parenthèses comprises (isoler le seul numéro déplaçait les parenthèses). */
  const toTxt = to ? " " + (lang === "ar" ? ltrIsolate(`(${to})`) : `(${to})`) : "";
  let s: string;
  if (lang === "fr") {
    const s1 = `Confirmation de transfert : ${debited} débités de votre compte${feeTxt ? ` (envoi ${amt} + frais ${feeTxt})` : ""}.`;
    const s2 = dest ? `Montant estimé à verser : ${dest}${svc ? ` via ${svc}` : ""}${toTxt}.` : svc ? `Service : ${svc}${toTxt}.` : to ? `Bénéficiaire : ${to}.` : "";
    s = stripDiacritics(`${s1} ${s2} Réf. ${dispRef(d.ref)}. ${when}. Statut : Confirmé.`);
  } else if (lang === "ar") {
    const s1 = `تأكيد التحويل: تم خصم ${debited} من حسابك${feeTxt ? ` (المبلغ ${amt} + الرسوم ${feeTxt})` : ""}.`;
    const s2 = dest ? `المبلغ التقديري للصرف: ${dest}${svc ? ` عبر ${svc}` : ""}${toTxt}.` : svc ? `الخدمة: ${svc}${toTxt}.` : to ? `المستفيد: ${ltrIsolate(to)}.` : "";
    s = `${s1} ${s2} المرجع ${dispRef(d.ref)}. ${when}. الحالة: مؤكد.`;
  } else {
    return bankSenderEn(d);
  }
  return s.replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------------------------------------------------------------
   SMS en anglais, style notification bancaire (décidé avec le propriétaire du produit, 10 octobre 2026).
   Chaque SMS porte : montant, devise, référence, date ET heure. Jamais « Test », jamais « en cours / processing / pending » :
   le transfert enregistré est « Confirmed ». Oman : tout en OMR. Orange Money, Wave et autres services par téléphone :
   montant en FCFA (XOF = FCFA). Le bénéficiaire ne voit ni frais ni nom de marque. */
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDateEn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`;
}
/* Devise telle qu'elle s'écrit dans un SMS : le franc CFA (code XOF) s'écrit FCFA. */
export const smsCurrency = (cur: string) => (cur === "XOF" ? "FCFA" : cur);
const bankMoney = (n: number, cur: string) => `${smsCurrency(cur)} ${fmtNumber(n, FIAT_DEC[cur] ?? 2, "en")}`;

/* Services par téléphone reconnus (le nom saisi par l'application peut être en arabe ou en français : seul un nom reconnu apparaît dans le
   SMS anglais ; sinon rien, le SMS dit simplement « transfer »). */
const BRANDS: [RegExp, string][] = [[/wave/i, "Wave"], [/orange/i, "Orange Money"], [/mtn/i, "MTN MoMo"], [/moov/i, "Moov Money"], [/vodafone/i, "Vodafone Cash"], [/bankak/i, "Bankak"]];
export function serviceLabelEn(raw: unknown): string {
  const s = cleanService(raw);
  for (const [re, name] of BRANDS) if (re.test(s)) return name;
  return "";
}
const personLabel = (raw: unknown) => String(raw ?? "").normalize("NFC").replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);

/* Qui a envoyé, vu par le BÉNÉFICIAIRE : le numéro de l'expéditeur s'il est connu (GSM-safe : chiffres et « + »), sinon son nom. */
export const fromLabel = (d: NoticeData) => cleanTo(d.fromPhone) || d.from;

/* Alerte de débit envoyée à l'EXPÉDITEUR. Le numéro du bénéficiaire est complet (service par téléphone) ou masqué (compte bancaire). */
function bankSenderEn(d: NoticeData): string {
  const hasTotal = d.total != null && Number.isFinite(Number(d.total));
  const fees = feesOf(d);
  const debited = bankMoney(hasTotal ? Number(d.total) : d.amount, d.currency);
  const conv = d.dest && d.dest.currency !== d.currency ? bankMoney(d.dest.amount, d.dest.currency) : "";
  const svc = serviceLabelEn(d.service);
  const who = cleanTo(d.to) || personLabel(d.toName);
  let s = `Debit Alert: ${debited} debited from your account`;
  if (fees > 0) s += ` (transfer ${bankMoney(d.amount, d.currency)} + fees ${bankMoney(fees, d.currency)})`;
  s += " for a transfer";
  if (conv) s += ` of approx. ${conv}`;
  if (svc) s += ` via ${svc}`;
  if (who) s += ` to ${who}`;
  s = endSentence(s) + ` Ref ${dispRef(d.ref)}. ${fmtDateEn(d.createdAt)}. Status: Confirmed.`;      // « Adam K. » finit déjà par un point
  return s.replace(/\s+/g, " ").trim();
}

/* Message envoyé au BÉNÉFICIAIRE : transfert « Confirmed » (l'argent est sorti du compte de l'expéditeur). Pour un transfert externe il ne dit jamais
   « received » : l'application ne peut pas vérifier la réception. Un transfert INTERNE entre deux comptes de l'application, lui, est réellement arrivé. */
function bankRecipientEn(d: NoticeData): string {
  const amt = bankMoney(d.amount, d.currency);
  const conv = d.dest && d.dest.currency !== d.currency ? bankMoney(d.dest.amount, d.dest.currency) : "";
  const svc = serviceLabelEn(d.service);
  const ref = recipientRef(d.ref);
  const who = fromLabel(d);
  const from = who ? ` from ${who}` : "";
  const head = d.audience === "EXTERNAL"
    ? `${svc ? svc + " " : ""}Transfer Confirmed: ${conv ? `approx. ${conv} (${amt})` : amt}${from}`
    : `Transfer Confirmed: You received ${amt}${from}`;
  return `${endSentence(head)} Ref ${ref}. ${fmtDateEn(d.createdAt)}.`.replace(/\s+/g, " ").trim();
}

export function buildSms(lang: Lang, d: NoticeData): string {
  if (d.audience === "SENDER") return buildSenderSms(lang, d);
  if (lang === "en") return bankRecipientEn(d);
  const amt = fmtMoney(d.amount, d.currency, lang);
  const dest = d.dest ? fmtMoney(d.dest.amount, d.dest.currency, lang) : "";
  const when = fmtDateUtc(d.createdAt).both;
  const ext = d.audience === "EXTERNAL";
  const ref = recipientRef(d.ref);
  let s: string;
  if (lang === "fr") {
    s = ext
      ? `${endSentence(`Transfert confirmé : ${amt}${dest ? ` (env. ${dest})` : ""}${fromLabel(d) ? ` de ${fromLabel(d)}` : ""}`)} Réf. ${ref}. ${when}.`
      : `${endSentence(`Vous avez reçu ${amt}${fromLabel(d) ? ` de ${fromLabel(d)}` : ""}`)} Réf. ${ref}. ${when}.`;
    s = stripDiacritics(s);                 // reste en alphabet GSM : 1 SMS = 160 caractères au lieu de 70
  } else if (lang === "ar") {
    s = ext
      ? `${endSentence(`تم تأكيد تحويل بمبلغ ${amt}${dest ? ` (حوالي ${dest})` : ""}${fromLabel(d) ? ` من ${d.fromPhone ? ltrIsolate(fromLabel(d)) : fromLabel(d)}` : ""}`)} المرجع ${ref}. ${when}.`
      : `${endSentence(`لقد استلمت ${amt}${fromLabel(d) ? ` من ${d.fromPhone ? ltrIsolate(fromLabel(d)) : fromLabel(d)}` : ""}`)} المرجع ${ref}. ${when}.`;
  } else {
    s = bankRecipientEn(d);                 // « en » est traité plus haut ; filet de sécurité si une autre langue est ajoutée un jour
  }
  return s.replace(/\s+/g, " ").trim();
}

/* ---------------------------------------------------------------------------------------------------------------
   Modèle ARABE du SMS au BÉNÉFICIAIRE (modèle donné par le propriétaire du produit le 12 octobre 2026 : « عزيزي العميل … »).
   Ce qui est repris : la structure (formule d'appel, montant, référence, date et heure, « من الحساب », « إلى الحساب », avertissement international).
   Ce qui n'est PAS repris, volontairement :
   - la référence « BMCT… » et tout nom de banque tierce : la référence est celle de l'application (« TX-… », sans « YOR ») ;
   - « تم استلام … بنجاح » pour un envoi vers l'EXTÉRIEUR : l'application ne peut pas vérifier que l'argent est arrivé, le texte dit « تم تأكيد تحويل »
     (transfert confirmé, comme le SMS anglais). « تم استلام … بنجاح » n'est utilisé que pour un transfert INTERNE entre deux comptes de l'application,
     où l'argent est réellement arrivé.
   Une ligne n'est écrite que si sa valeur existe : jamais « إلى الحساب: » seul, jamais de valeur inventée. L'avertissement « حوالة دولية » n'est ajouté que
   si le transfert est réellement international (d.international === true : pays de l'expéditeur et pays du bénéficiaire connus ET différents). */
export const AR_INTERNATIONAL_NOTE = "يرجى العلم بأنه نظرًا لأن هذه حوالة دولية، فقد يستغرق وصول المبلغ إلى حسابك بعض الوقت. شكرًا لتفهمكم.";

/** « 2026-10-11 11:22:27 UTC » (UTC explicite, jamais l'heure locale). Vide si la date est invalide. */
export function fmtDateTimeUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} UTC`;
}

/* 12.12.0 — HEURE LOCALE dans les SMS structurés. Avant : « 12 Oct 2026 07:08 UTC » / « 2026-10-12 07:08:00 UTC » — à Oman l'heure affichée avait 4 heures de retard
   et l'arabe montrait les secondes. Maintenant : heure d'Oman (UTC+4, pas d'heure d'été), sans secondes, sans suffixe (c'est l'heure du téléphone de la personne).
   Seuls les pays dont le décalage est fixe et certain sont listés ; un pays absent ou inconnu garde l'UTC et le dit. */
const TZ_MIN: Record<string, number> = { OM: 240, AE: 240, SA: 180, KW: 180, QA: 180, BH: 180 };
export function tzMinutes(country: unknown): number | null {
  const k = String(country ?? "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TZ_MIN, k) ? TZ_MIN[k] : null;
}
/** « 17 Oct 2026, 20:23 » (anglais) / « 17/10/2026 20:23 » (arabe) en heure locale du pays ; « … UTC » si le pays est inconnu. Vide si la date est invalide. */
export function localStamp(iso: string, country: unknown, style: "en" | "ar"): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const off = tzMinutes(country);
  const d = new Date(t + (off ?? 0) * 60000);
  const hm = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  const out = style === "ar"
    ? `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${hm}`
    : `${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hm}`;
  return off === null ? out + " UTC" : out;
}

/** Numéro lisible dans un SMS : « +968 9123 4567 » pour un numéro d'Oman (+968 + 8 chiffres) ; tout autre numéro et les numéros masqués (« ***1234 ») restent tels quels. */
export function fmtPhoneSms(raw: unknown): string {
  const s = cleanTo(raw);
  const m = /^\+968(\d{4})(\d{4})$/.exec(s);
  return m ? `+968 ${m[1]} ${m[2]}` : s;
}

/** International = pays de l'expéditeur ET pays du bénéficiaire connus (code à 2 lettres) et DIFFÉRENTS. Inconnu = non international (rien n'est supposé). */
export function isInternational(senderCountry: unknown, otherCountry: unknown): boolean {
  const a = String(senderCountry ?? "").trim().toUpperCase(), b = String(otherCountry ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(a) && /^[A-Z]{2}$/.test(b) && a !== b;
}

/** Langue du SMS au bénéficiaire : arabe pour un bénéficiaire d'un pays arabophone (transfert externe) ou un compte réglé en arabe (transfert interne),
 *  sinon SMS_LANG. La confirmation à l'expéditeur reste dans SMS_LANG. */
export function recipientSmsLang(audience: Audience, serviceCountry: unknown, userLang: Lang | null): Lang {
  if (audience === "SENDER") return SMS_LANG;
  if (audience === "EXTERNAL") return knownLangForCountry(String(serviceCountry ?? "")) === "ar" ? "ar" : SMS_LANG;
  return userLang === "ar" ? "ar" : SMS_LANG;
}

export function buildRecipientSmsAr(d: NoticeData): string {
  const money = (n: number, cur: string) => ltrIsolate(`${smsCurrency(cur)} ${fmtNumber(n, FIAT_DEC[cur] ?? 2, "en")}`);   // 12.12.0 : « OMR 20.000 » (devise d'abord, comme dans les SMS des banques d'Oman)
  const amt = money(d.amount, d.currency);
  const conv = d.dest && d.dest.currency !== d.currency ? money(d.dest.amount, d.dest.currency) : "";
  const field = (label: string, value: string) => (value ? `${label}: ${value}` : "");
  const ref = recipientRef(d.ref);
  const from = fromLabel(d);
  const account = fmtPhoneSms(d.account);
  const stamp = localStamp(d.createdAt, d.tzCountry, "ar");                  // 12.12.0 : heure locale, sans secondes
  const lines = [
    "عزيزي العميل،",
    d.audience === "INTERNAL" ? `تم استلام مبلغ ${amt} بنجاح.` : `تم تأكيد تحويل مبلغ ${conv ? `حوالي ${conv} (${amt})` : amt}.`,
    field("رقم المرجع", ref ? ltrIsolate(ref) : ""),
    field("التاريخ والوقت", stamp ? ltrIsolate(stamp) : ""),
    field("من الحساب", d.fromPhone && cleanTo(d.fromPhone) ? ltrIsolate(fmtPhoneSms(d.fromPhone)) : from),
    field("إلى الحساب", account ? ltrIsolate(account) : ""),
    d.audience === "INTERNAL" && validBalance(d) ? field("الرصيد المتاح", money(d.balance!.amount, d.balance!.currency)) : "",   // 12.5.0 : le solde du destinataire n'existe que pour un compte de l'application
  ].filter((l) => l !== "");
  if (d.international === true) lines.push("", AR_INTERNATIONAL_NOTE);
  return lines.join("\n");
}

/** Point d'entrée de l'envoi : modèle arabe pour le bénéficiaire, sinon le texte habituel (buildSms, inchangé). */
export function buildNoticeSms(lang: Lang, d: NoticeData): string {
  return d.audience !== "SENDER" && lang === "ar" ? buildRecipientSmsAr(d) : buildSms(lang, d);
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const E: Record<Lang, { dir: "ltr" | "rtl"; subject: (a: string) => string; title: string; intro: string; f: Record<string, string>; status: string; bStatus: string; note: string; auto: string; s: { subject: (a: string) => string; title: string; intro: string } }> = {
  fr: { dir: "ltr", subject: (a) => `Transfert confirmé à votre intention : ${a}`, title: "Un transfert a été confirmé pour vous",
    intro: "Voici les détails de la transaction. Le transfert est confirmé : le montant a été débité du compte de l'expéditeur.",
    f: { amount: "Montant envoyé", fees: "Frais (TVA incluse)", debited: "Total débité", dest: "Montant estimé à recevoir", rate: "Taux (configuré)", to: "Bénéficiaire", service: "Service", from: "Expéditeur", date: "Date", time: "Heure", ref: "Référence", status: "Statut" },
    status: "En cours de traitement", bStatus: "Confirmé", note: "Le montant à recevoir est une estimation fondée sur un taux configuré, pas un taux bancaire.",
    auto: "Message automatique. Si vous n'attendiez pas ce message, ignorez-le.",
    s: { subject: (a) => `Confirmation de votre transfert : ${a}`, title: "Confirmation de votre transfert",
      intro: "Voici le détail de l'opération débitée de votre compte. Le versement au bénéficiaire n'est pas encore effectué : ce message ne confirme pas que les fonds sont arrivés." } },
  en: { dir: "ltr", subject: (a) => `Transfer confirmed for you: ${a}`, title: "A transfer has been confirmed for you",
    intro: "Here are the transaction details. The transfer is confirmed: the amount has been debited from the sender's account.",
    f: { amount: "Amount sent", fees: "Fees (VAT included)", debited: "Total debited", dest: "Estimated amount to receive", rate: "Rate (configured)", to: "Beneficiary", service: "Service", from: "Sender", date: "Date", time: "Time", ref: "Reference", status: "Status" },
    status: "Processing", bStatus: "Confirmed", note: "The amount to receive is an estimate based on a configured rate, not a bank rate.",
    auto: "Automatic message. If you were not expecting it, please ignore it.",
    s: { subject: (a) => `Your transfer confirmation: ${a}`, title: "Confirmation of your transfer",
      intro: "Here are the details of the amount debited from your account. The payout to the beneficiary has not been made yet: this message does not confirm that the funds have arrived." } },
  ar: { dir: "rtl", subject: (a) => `تم تأكيد تحويل لصالحك: ${a}`, title: "تم تأكيد تحويل لصالحك",
    intro: "هذه تفاصيل المعاملة. تم تأكيد التحويل: تم خصم المبلغ من حساب المرسل.",
    f: { amount: "المبلغ المرسل", fees: "الرسوم (شاملة الضريبة)", debited: "إجمالي المبلغ المخصوم", dest: "المبلغ التقديري المستلم", rate: "السعر (مُعدّ)", to: "المستفيد", service: "الخدمة", from: "المرسل", date: "التاريخ", time: "الوقت", ref: "المرجع", status: "الحالة" },
    status: "قيد المعالجة", bStatus: "مؤكد", note: "المبلغ المستلم تقدير مبني على سعر مُعدّ مسبقاً وليس سعر بنك.",
    auto: "رسالة آلية. إذا لم تكن تتوقعها فتجاهلها.",
    s: { subject: (a) => `تأكيد تحويلك: ${a}`, title: "تأكيد تحويلك",
      intro: "هذه تفاصيل المبلغ المخصوم من حسابك. لم يتم الصرف للمستفيد بعد: هذه الرسالة لا تؤكد وصول الأموال." } },
};

export function buildEmail(lang: Lang, d: NoticeData): { subject: string; html: string } {
  const t = E[lang];
  const al = t.dir === "rtl" ? "right" : "left";
  const when = fmtDateUtc(d.createdAt);
  const sender = d.audience === "SENDER";
  const rows: [string, string][] = [[t.f.amount, fmtMoney(d.amount, d.currency, lang)]];
  if (sender) {
    const fees = feesOf(d);
    if (fees > 0) rows.push([t.f.fees, fmtMoney(fees, d.currency, lang)], [t.f.debited, fmtMoney(Number(d.total), d.currency, lang)]);
    if (d.dest && d.dest.currency !== d.currency) {
      rows.push([t.f.dest, "≈ " + fmtMoney(d.dest.amount, d.dest.currency, lang)]);
      if (d.rate != null && Number.isFinite(Number(d.rate))) rows.push([t.f.rate, `1 ${d.currency} = ${Number(d.rate).toFixed(4)} ${d.dest.currency}`]);
    }
    const svc = cleanService(d.service); if (svc) rows.push([t.f.service, svc]);
    const to = cleanTo(d.to); if (to) rows.push([t.f.to, to]);
  } else {
    if (d.dest) rows.push([t.f.dest, "≈ " + fmtMoney(d.dest.amount, d.dest.currency, lang)]);
    if (fromLabel(d)) rows.push([t.f.from, fromLabel(d)]);
  }
  rows.push([t.f.date, when.date], [t.f.time, when.time], [t.f.ref, dispRef(d.ref)], [t.f.status, sender ? t.status : t.bStatus]);
  const body = rows.map(([k, v]) =>
    `<tr><td style="padding:9px 0;color:#6b7280;font-size:14px;text-align:${al};border-bottom:1px solid #eef0f4">${esc(k)}</td>` +
    `<td style="padding:9px 0;color:#111827;font-size:14px;font-weight:600;text-align:${t.dir === "rtl" ? "left" : "right"};border-bottom:1px solid #eef0f4" dir="ltr">${esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="${lang}" dir="${t.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;background:#f3f4f8;font-family:Arial,Helvetica,sans-serif" dir="${t.dir}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">` +
    `<tr><td style="padding:28px;text-align:${al}"><h1 style="margin:0 0 12px;font-size:21px;color:#111827">${esc(sender ? t.s.title : t.title)}</h1>` +
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">${esc(sender ? t.s.intro : t.intro)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>` +
    (d.dest && (!sender || d.dest.currency !== d.currency) ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280">${esc(t.note)}</p>` : "") +
    `</td></tr><tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;line-height:1.6;color:#6b7280;text-align:${al}">${esc(t.auto)}</td></tr>` +
    `</table></td></tr></table></body></html>`;
  return { subject: (sender ? t.s.subject : t.subject)(fmtMoney(sender && d.total != null && Number.isFinite(Number(d.total)) ? Number(d.total) : d.amount, d.currency, lang)), html };
}

export type SmsOutcome =
  | { kind: "sent"; messageId: string | null }
  | { kind: "defer"; minutes: number; reason: string }   // problème de configuration / crédits : on ne brûle pas de tentative
  | { kind: "terminal"; reason: string }                 // le fournisseur refuse ce message : inutile de réessayer
  | { kind: "retry"; reason: string };                   // erreur temporaire

/* Réponses documentées de POST https://api.brevo.com/v3/transactionalSMS/send :
   201 { messageId } ; 400 { code, message } avec not_enough_credits, invalid_parameter, missing_parameter, out_of_range,
   unauthorized, permission_denied, duplicate_request. */
export function classifySmsResponse(status: number, text: string): SmsOutcome {
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(text); } catch { /* corps non JSON */ }
  const code = String(body.code ?? "").toLowerCase();
  const msg = String(body.message ?? text ?? "").slice(0, 200);
  if (status === 200 || status === 201) return { kind: "sent", messageId: body.messageId != null ? String(body.messageId) : null };
  if (code === "duplicate_request") return { kind: "sent", messageId: null };
  if (code === "not_enough_credits" || /insufficient credit|not enough credit/i.test(msg)) return { kind: "defer", minutes: 30, reason: `sms_credits_missing: ${msg}` };
  if (status === 401 || status === 403 || code === "unauthorized" || code === "permission_denied" || /api-key|authentication failed/i.test(msg)) return { kind: "defer", minutes: 10, reason: `provider_auth: ${msg}` };
  if (code === "invalid_parameter" || code === "missing_parameter" || code === "out_of_range") return { kind: "terminal", reason: `provider_rejected: ${msg}` };
  return { kind: "retry", reason: `brevo ${status}: ${msg}` };
}

/* 12.12.0 : nom d'expéditeur par défaut = « FriendlyPay » (11 lettres, le maximum). Avant : « YORWALLET » (Brevo) et « ServiceSMS » (expéditeur d'essai d'Infobip, affiché sur le téléphone du destinataire). */
export const SMS_SENDER_DEFAULT = "FriendlyPay";
/* Anciens noms d'essai : si le secret SMS_SENDER contient encore l'un d'eux, il est ignoré (le téléphone du destinataire afficherait « ServiceSMS » / « YORWALLET »). */
const LEGACY_SENDERS = ["servicesms", "yorwallet", "yor", "nex", "nexwallet"];
export const smsSenderName = (raw: string | undefined) => {
  const v = String(raw ?? "");
  return /^[A-Za-z0-9]{1,11}$/.test(v) && !LEGACY_SENDERS.includes(v.toLowerCase()) ? v : SMS_SENDER_DEFAULT;
};
export const brevoRecipient = (digits: string) => "+" + String(digits).replace(/\D/g, "");
export const retryDelayMin = (attempts: number) => Math.min(2 ** attempts, 60);

/* ---------------------------------------------------------------------------------------------------------------
   Fournisseurs SMS interchangeables (secret SMS_PROVIDER : brevo [défaut] | infobip | twilio).
   « Envoyé » veut dire : ACCEPTÉ par le fournisseur (réponse 2xx). La remise sur le téléphone n'est pas suivie.
   Aucune de ces fonctions ne touche au réseau : elles construisent la requête et classent la réponse. */
export type SmsProvider = "brevo" | "infobip" | "twilio";
/* Choix explicite par le secret SMS_PROVIDER ; sans secret, Infobip dès que sa clé est présente (sinon Brevo, comme avant).
   Une valeur inconnue reste « brevo ». Constat du 10 octobre 2026 : sans SMS_PROVIDER, les SMS partaient par Brevo (identifiants de 16 chiffres),
   avec un nom d'expéditeur non enregistré à Oman, et n'arrivaient pas. */
export const smsProviderName = (raw: string | undefined, infobipKey?: string): SmsProvider => {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "infobip" || v === "twilio" || v === "brevo") return v;
  if (v === "" && String(infobipKey ?? "").trim() !== "") return "infobip";
  return "brevo";
};

export interface SmsEnv {
  sender?: string;                                    // SMS_SENDER (≤ 11 lettres/chiffres), à enregistrer pays par pays chez la plupart des fournisseurs
  brevoKey?: string;
  infobipKey?: string; infobipBase?: string;         // INFOBIP_API_KEY, INFOBIP_BASE_URL (https://xxxxx.api.infobip.com)
  twilioSid?: string; twilioToken?: string; twilioFrom?: string;   // TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (numéro +… ou nom)
}
export type SmsRequest = { url: string; headers: Record<string, string>; body: string } | { error: string; terminal?: boolean };

const ALNUM_SENDER = /^[A-Za-z0-9]{1,11}$/;
const INVISIBLE_RE = new RegExp("[\\s" + [[0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2069], [0xfeff, 0xfeff]].map(([a, b]) => String.fromCharCode(a) + "-" + String.fromCharCode(b)).join("") + "]", "g");   // espaces + marques invisibles (U+200B-200F, U+202A-202E, U+2060-2069, U+FEFF)
export const cleanSecret = (raw: unknown) => String(raw ?? "").replace(INVISIBLE_RE, "");
export const INFOBIP_KEY_RE = /^[A-Za-z0-9._:-]{16,256}$/;

export function buildSmsRequest(provider: SmsProvider, env: SmsEnv, toDigits: string, text: string, unicode: boolean): SmsRequest {
  const digits = String(toDigits ?? "").replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return { error: "invalid_phone", terminal: true };

  if (provider === "infobip") {
    /* La clé vient d'un secret collé depuis un téléphone : on retire espaces, retours à la ligne et marques de direction invisibles (U+200B-200F,
       U+202A-202E, U+2060-2069, U+FEFF) qui rendent l'en-tête invalide (« not a valid ByteString »). Une clé n'en contient jamais. Ce qui reste doit
       ressembler à une clé (lettres, chiffres, . _ : -) ; sinon (texte « curl … » collé par erreur, par exemple) on le dit clairement et on GARDE
       le message en file (pas de tentative brûlée) en attendant que le secret soit corrigé. */
    const key = cleanSecret(env.infobipKey);
    if (!key) return { error: "provider not configured: INFOBIP_API_KEY secret missing" };
    if (!INFOBIP_KEY_RE.test(key)) return { error: "provider not configured: INFOBIP_API_KEY is not a valid key (paste only the key itself, nothing else)" };
    const base = cleanSecret(env.infobipBase || "https://api.infobip.com").replace(/\/+$/, "");
    // l'adresse vient d'un secret : on n'accepte qu'un sous-domaine infobip.com en https (aucun autre serveur ne reçoit la clé)
    if (!/^https:\/\/([a-z0-9-]+\.)*infobip\.com$/i.test(base)) return { error: "provider not configured: INFOBIP_BASE_URL must be https://….infobip.com" };
    const sender = smsSenderName(env.sender);   // 12.12.0 : « FriendlyPay » par défaut, plus « ServiceSMS » (expéditeur d'essai d'Infobip)
    return {
      url: `${base}/sms/3/messages`,
      headers: { Authorization: `App ${key}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ messages: [{ sender, destinations: [{ to: digits }], content: { text } }] }),
    };
  }

  if (provider === "twilio") {
    const sid = String(env.twilioSid ?? "").trim(), tok = String(env.twilioToken ?? "").trim();
    if (!/^AC[0-9a-fA-F]{32}$/.test(sid) || !tok) return { error: "provider not configured: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN secrets missing or invalid" };
    const fromRaw = String(env.twilioFrom ?? "").trim().replace(/[\s().-]/g, "");   // « +1 (500) 555-0006 » collé tel quel
    const from = /^\+?\d{6,15}$/.test(fromRaw) ? "+" + fromRaw.replace(/\D/g, "") : (ALNUM_SENDER.test(fromRaw) ? fromRaw : (env.sender && ALNUM_SENDER.test(env.sender) ? env.sender : ""));
    if (!from) return { error: "provider not configured: TWILIO_FROM (number or name) missing" };
    return {
      url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ To: "+" + digits, From: from, Body: text }).toString(),
    };
  }

  if (!env.brevoKey) return { error: "provider not configured: BREVO_API_KEY secret missing" };
  return {
    url: "https://api.brevo.com/v3/transactionalSMS/send",
    headers: { "api-key": env.brevoKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: smsSenderName(env.sender), recipient: brevoRecipient(digits), content: text, type: "transactional", tag: ["recipient-notice"], unicodeEnabled: unicode }),
  };
}

const CREDIT_RE = /insufficient|balance|funds|credit/i;

/* Infobip : 2xx avec messages[0].status.groupId (1 PENDING = accepté, 3 DELIVERED) ; groupId 2 / 4 / 5 = refusé.
   Erreurs de requête : { requestError: { serviceException: { messageId, text } } }. */
function classifyInfobip(status: number, text: string): SmsOutcome {
  // deno-lint-ignore no-explicit-any
  let b: Record<string, any> = {};
  try { b = JSON.parse(text); } catch { /* corps non JSON */ }
  const m = Array.isArray(b.messages) ? b.messages[0] : null;
  if (status >= 200 && status < 300 && m?.status) {
    const g = Number(m.status.groupId);
    if (g === 1 || g === 3) return { kind: "sent", messageId: m.messageId != null ? String(m.messageId) : null };
    const info = `${m.status.name ?? m.status.groupName ?? ""} ${m.status.description ?? ""}`.trim().slice(0, 200);
    if (CREDIT_RE.test(info)) return { kind: "defer", minutes: 30, reason: `sms_credits_missing: ${info}` };
    if (/sender|not_registered|not_allowed|route|permission/i.test(info)) return { kind: "defer", minutes: 30, reason: `provider_config: ${info}` };   // se règle côté compte : on garde le message
    return { kind: "terminal", reason: `provider_rejected: ${info}` };
  }
  const ex = b.requestError?.serviceException;
  const msg = String(ex?.text ?? ex?.messageId ?? text ?? "").slice(0, 200);
  if (CREDIT_RE.test(msg)) return { kind: "defer", minutes: 30, reason: `sms_credits_missing: ${msg}` };
  if (status === 401 || status === 403) return { kind: "defer", minutes: 10, reason: `provider_auth: ${msg}` };
  if (status === 400 || status === 422) return { kind: "terminal", reason: `provider_rejected: ${msg}` };
  return { kind: "retry", reason: `infobip ${status}: ${msg}` };
}

/* Twilio : 201 { sid, status } ; erreur { code, message, status }.
   21608 = numéro non vérifié (compte d'essai), 21408 = région non activée, 21606/21212 = expéditeur invalide : se règlent côté compte.
   21211 / 21614 = numéro invalide, 21610 = désabonné, 21612 = non routable : définitif. */
function classifyTwilio(status: number, text: string): SmsOutcome {
  // deno-lint-ignore no-explicit-any
  let b: Record<string, any> = {};
  try { b = JSON.parse(text); } catch { /* corps non JSON */ }
  if (status === 200 || status === 201) return b.sid ? { kind: "sent", messageId: String(b.sid) } : { kind: "retry", reason: "twilio: réponse sans identifiant" };
  const code = Number(b.code ?? 0);
  const msg = String(b.message ?? text ?? "").slice(0, 200);
  if (CREDIT_RE.test(msg)) return { kind: "defer", minutes: 30, reason: `sms_credits_missing: ${msg}` };
  if (status === 401 || status === 403 || code === 20003) return { kind: "defer", minutes: 10, reason: `provider_auth: ${msg}` };
  if ([21608, 21408, 21606, 21212].includes(code)) return { kind: "defer", minutes: 30, reason: `provider_config: ${code} ${msg}` };
  if ([21211, 21614, 21610, 21612].includes(code)) return { kind: "terminal", reason: `provider_rejected: ${code} ${msg}` };
  return { kind: "retry", reason: `twilio ${status}: ${code} ${msg}` };
}

export function classifySms(provider: SmsProvider, status: number, text: string): SmsOutcome {
  if (provider === "infobip") return classifyInfobip(status, text);
  if (provider === "twilio") return classifyTwilio(status, text);
  return classifySmsResponse(status, text);
}

/* ===============================================================================================================
   12.5.0 — SMS « structuré » (modèles « Dear Customer » / « عزيزي العميل »), issues réelles, solde disponible, suivi de la livraison.
   Les gabarits compacts ci-dessus (buildSms / buildNoticeSms) restent intacts : SMS_TEMPLATE=compact (secret) y ramène sans redéploiement.
   Règles :
   - un SMS ne décrit JAMAIS une issue que la base n'a pas enregistrée : « réussi » seulement si le statut est CONFIRMED / SUCCESS / COMPLETED,
     « non abouti » seulement si REJECTED / REFUNDED / FAILED…, « en cours » seulement si PENDING / PROCESSING / UNDER_REVIEW ;
   - le solde est la valeur du registre (ledger_entries.balance_after) de CETTE transaction, jamais un calcul ; sans valeur, la ligne manque ;
   - le bénéficiaire d'un envoi EXTERNE (qui n'a pas de compte) reçoit « confirmé », jamais « reçu » (l'application ne peut pas vérifier la réception)
     et jamais de solde ; le solde du bénéficiaire n'existe que pour un compte de l'application (audience INTERNAL) ;
   - aucune devise n'est mélangée : le montant est dans la devise de la transaction (OMR) ; le montant estimé en FCFA n'apparaît que sur sa ligne dédiée. */
const STATUS_SUCCESS = ["CONFIRMED", "SUCCESS", "COMPLETED"];
const STATUS_FAILED = ["REJECTED", "REFUNDED", "FAILED", "CANCELLED", "CANCELED", "DECLINED", "EXPIRED", "ERROR"];
const STATUS_PENDING = ["PENDING", "PROCESSING", "UNDER_REVIEW"];
export const outcomeOfStatus = (status: unknown): Outcome | null => {
  const s = String(status ?? "").toUpperCase();
  return STATUS_SUCCESS.includes(s) ? "SUCCESS" : STATUS_FAILED.includes(s) ? "FAILED" : STATUS_PENDING.includes(s) ? "PENDING" : null;
};
/** Le message en file décrit-il encore la réalité ? (un SMS « en cours » n'est pas envoyé si la transaction est déjà terminée, ni l'inverse.) */
export const statusMatchesOutcome = (status: unknown, outcome: Outcome): boolean => outcomeOfStatus(status) === outcome;

export function validBalance(d: NoticeData): boolean {
  const b = d.balance;
  /* un solde négatif ne peut venir que d'une anomalie de données : on n'affiche rien plutôt qu'un chiffre trompeur */
  return !!b && b.amount != null && typeof b.amount !== "boolean" && Number.isFinite(Number(b.amount)) && Number(b.amount) >= 0 && /^[A-Z]{3}$/.test(String(b.currency ?? ""));
}

/* Langue d'un SMS : confirmation à l'expéditeur dans la langue de son application si c'est l'arabe, sinon l'anglais (le SMS n'existe qu'en arabe et en
   anglais) ; le bénéficiaire garde la règle existante (recipientSmsLang). */
export function noticeSmsLang(audience: Audience, serviceCountry: unknown, userLang: Lang | null): Lang {
  if (audience === "SENDER") return userLang === "ar" ? "ar" : "en";
  return recipientSmsLang(audience, serviceCountry, userLang);
}

function recipientPhrase(d: NoticeData, ar: boolean): string {
  const name = personLabel(d.toName), num = fmtPhoneSms(d.to);
  if (name && num) return `${name} ${ar ? ltrIsolate(`(${num})`) : `(${num})`}`;
  if (num) return ar ? ltrIsolate(num) : num;
  return name;
}

/** Texte du SMS pour l'anglais et l'arabe. Le français (aucun SMS n'est envoyé en français) retombe sur l'anglais.
 *  12.12.0 — messages corrigés (demande du propriétaire, 17 octobre 2026) :
 *  - EXPÉDITEUR : le bénéficiaire n'apparaît plus deux fois (phrase d'ouverture ET ligne « Recipient ») ; les frais (TVA comprise) et le TOTAL DÉBITÉ sont écrits quand
 *    la transaction les contient (valeurs réelles : total − montant, jamais inventées) ; montants « OMR 20.000 » ; heure d'Oman ; numéro « +968 9123 4567 » ;
 *  - BÉNÉFICIAIRE : l'expéditeur n'apparaît plus deux fois non plus ; aucune marque, aucun « YOR » : référence « TX-… » ; son propre numéro sur la ligne « To » ;
 *  - toujours : « confirmed » (jamais « received ») pour un envoi vers l'extérieur ; solde = valeur du registre, jamais calculée ; aucun nom de banque. */
export function buildNotificationSms(lang: Lang, d: NoticeData): string {
  const ar = lang === "ar";
  const outcome: Outcome = d.outcome ?? "SUCCESS";
  const money = (n: number, cur: string) => { const t = `${smsCurrency(cur)} ${fmtNumber(n, FIAT_DEC[cur] ?? 2, "en")}`; return ar ? ltrIsolate(t) : t; };
  const amt = money(d.amount, d.currency);
  const conv = d.dest && d.dest.currency !== d.currency ? money(d.dest.amount, d.dest.currency) : "";
  const svc = serviceLabelEn(d.service);
  const stamp = localStamp(d.createdAt, d.tzCountry, ar ? "ar" : "en");
  const when = ar && stamp ? ltrIsolate(stamp) : stamp;
  /* le solde « disponible » n'est affiché que pour une opération réussie : pour un échec ou une opération en cours, le dernier mouvement du registre n'est pas « le solde après ce transfert » */
  const bal = outcome === "SUCCESS" && validBalance(d) ? money(Number(d.balance!.amount), d.balance!.currency) : "";
  const L = ar
    ? { dear: "عزيزي العميل،", ref: "رقم المرجع", when: "التاريخ والوقت", to: "إلى الحساب", svc: "الخدمة", est: "المبلغ التقديري للاستلام", bal: "الرصيد المتاح", fees: "الرسوم (شاملة الضريبة)", total: "إجمالي المبلغ المخصوم" }
    : { dear: "Dear Customer,", ref: "Reference", when: "Date & Time", to: "To", svc: "Service", est: "Amount to receive", bal: "Available Balance", fees: "Fees (incl. VAT)", total: "Total debited" };
  const field = (label: string, value: string) => (value ? `${label}: ${value}` : "");
  const refTxt = (v: string) => (v ? (ar ? ltrIsolate(v) : v) : "");
  let head: string; const lines: string[] = [];

  if (d.audience === "SENDER") {
    const who = recipientPhrase(d, ar);
    if (ar) {
      head = outcome === "FAILED" ? `لم يتم تحويل مبلغ ${amt}${who ? ` إلى ${who}` : ""}.`
        : outcome === "PENDING" ? `تحويل مبلغ ${amt}${who ? ` إلى ${who}` : ""} قيد المعالجة.`
        : `تم تحويل مبلغ ${amt}${who ? ` إلى ${who}` : ""} بنجاح.`;
    } else {
      head = outcome === "FAILED" ? `Your transfer of ${amt}${who ? ` to ${who}` : ""} was unsuccessful.`
        : outcome === "PENDING" ? `Your transfer of ${amt}${who ? ` to ${who}` : ""} is being processed.`
        : `Your transfer of ${amt}${who ? ` to ${who}` : ""} was successful.`;
    }
    /* frais et total : seulement pour un envoi réussi, et seulement si la transaction porte un total supérieur au montant */
    const fees = outcome === "SUCCESS" ? feesOf(d) : 0;
    const hasTotal = fees > 0 && d.total != null && Number.isFinite(Number(d.total));
    lines.push(field(L.svc, svc ? refTxt(svc) : ""), field(L.est, conv ? (ar ? `حوالي ${conv}` : `approx. ${conv}`) : ""),
      field(L.fees, fees > 0 ? money(fees, d.currency) : ""), field(L.total, hasTotal ? money(Number(d.total), d.currency) : ""),
      field(L.bal, bal), field(L.ref, refTxt(dispRef(d.ref))), field(L.when, when));
  } else if (d.audience === "INTERNAL") {
    if (ar) return buildRecipientSmsAr(d);                 // modèle arabe du propriétaire (12 octobre 2026) + ligne de solde
    const from = fromLabel(d) ? fmtPhoneSms(d.fromPhone) || d.from : "";
    head = `You have received ${amt}${from ? ` from ${from}` : ""}.`;
    lines.push(field(L.bal, bal), field(L.ref, recipientRef(d.ref)), field(L.when, when));
  } else {
    if (ar) return buildRecipientSmsAr(d);
    const from = fromLabel(d) ? fmtPhoneSms(d.fromPhone) || d.from : "";
    const account = fmtPhoneSms(d.account);
    head = `${svc ? `An ${svc}` : "A"} transfer of ${conv ? `approx. ${conv} (${amt})` : amt}${from ? ` from ${from}` : ""} has been confirmed.`;
    lines.push(field(L.to, account), field(L.ref, recipientRef(d.ref)), field(L.when, when));
  }
  return [L.dear, "", head.replace(/\s+/g, " ").replace(/\.\.$/, "."), "", ...lines.filter((l) => l !== "")].join("\n");
}

/* ---------------------------------------------------------------------------------------------------------------
   Suivi de la LIVRAISON (rapport de remise du fournisseur). « SENT » = accepté par le fournisseur ; « DELIVERED » = remis au téléphone.
   Infobip : journal des messages (GET /sms/1/logs?messageId=…) — conservé par le fournisseur, relisible. Twilio : GET …/Messages/{sid}.json.
   Brevo : pas de rapport interrogé ici (UNSUPPORTED). Une réponse inattendue ne change JAMAIS l'état en « remis » ni en « non remis ». */
export type DeliveryState = "PENDING" | "DELIVERED" | "UNDELIVERABLE" | "UNKNOWN" | "UNSUPPORTED";
export type DeliveryRequest = { url: string; headers: Record<string, string> } | { error: string; unsupported?: boolean };
export type DeliveryOutcome = { state: DeliveryState; detail: string };

export function buildDeliveryRequest(provider: SmsProvider, env: SmsEnv, messageId: string): DeliveryRequest {
  const id = String(messageId ?? "").trim();
  if (provider === "infobip") {
    const key = cleanSecret(env.infobipKey);
    if (!INFOBIP_KEY_RE.test(key)) return { error: "provider not configured: INFOBIP_API_KEY" };
    const base = cleanSecret(env.infobipBase || "https://api.infobip.com").replace(/\/+$/, "");
    if (!/^https:\/\/([a-z0-9-]+\.)*infobip\.com$/i.test(base)) return { error: "provider not configured: INFOBIP_BASE_URL" };
    if (!/^[A-Za-z0-9._-]{6,80}$/.test(id)) return { error: "invalid_message_id" };
    return { url: `${base}/sms/1/logs?messageId=${encodeURIComponent(id)}&limit=1`, headers: { Authorization: `App ${key}`, accept: "application/json" } };
  }
  if (provider === "twilio") {
    const sid = String(env.twilioSid ?? "").trim(), tok = String(env.twilioToken ?? "").trim();
    if (!/^AC[0-9a-fA-F]{32}$/.test(sid) || !tok) return { error: "provider not configured: TWILIO" };
    if (!/^(SM|MM)[0-9a-fA-F]{32}$/.test(id)) return { error: "invalid_message_id" };
    return { url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${id}.json`, headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), accept: "application/json" } };
  }
  return { error: "delivery_reports_not_supported", unsupported: true };
}

export function classifyDelivery(provider: SmsProvider, status: number, text: string): DeliveryOutcome {
  // deno-lint-ignore no-explicit-any
  let b: Record<string, any> = {};
  try { b = JSON.parse(text); } catch { /* corps non JSON */ }
  if (status === 401 || status === 403) return { state: "UNKNOWN", detail: "provider_auth" };
  if (provider === "infobip") {
    if (status < 200 || status >= 300) return { state: "UNKNOWN", detail: `infobip_${status}` };
    const r = Array.isArray(b.results) ? b.results[0] : null;
    if (!r?.status) return { state: "PENDING", detail: "no_report_yet" };          // le rapport peut arriver quelques secondes après l'acceptation
    const g = Number(r.status.groupId), name = String(r.status.name ?? r.status.groupName ?? "").slice(0, 60);
    if (g === 3) return { state: "DELIVERED", detail: name };
    if (g === 2 || g === 4 || g === 5) return { state: "UNDELIVERABLE", detail: name || String(r.error?.name ?? "").slice(0, 60) };
    if (g === 0 || g === 1) return { state: "PENDING", detail: name };
    return { state: "UNKNOWN", detail: `group_${r.status.groupId}` };
  }
  if (provider === "twilio") {
    if (status < 200 || status >= 300) return { state: "UNKNOWN", detail: `twilio_${status}` };
    const st = String(b.status ?? "").toLowerCase();
    if (st === "delivered") return { state: "DELIVERED", detail: st };
    if (st === "undelivered" || st === "failed" || st === "canceled") return { state: "UNDELIVERABLE", detail: `${st}${b.error_code ? " " + b.error_code : ""}` };
    if (["queued", "accepted", "scheduled", "sending", "sent"].includes(st)) return { state: "PENDING", detail: st };
    return { state: "UNKNOWN", detail: st ? `status_${st}`.slice(0, 60) : "no_status" };
  }
  return { state: "UNSUPPORTED", detail: "delivery_reports_not_supported" };
}

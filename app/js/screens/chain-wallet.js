'use strict';

/* ============================================================
   YOR-USDT (testnet Nile) — écran de portefeuille blockchain
   - le client (window.YorChain, js/features/yor-chain.js) lit les soldes sur la chaîne, simule, contrôle et diffuse ;
   - la SIGNATURE est faite par TronLink (portefeuille de l'utilisateur) : l'app ne voit jamais de clé privée ;
   - jeton expérimental de TEST, sans valeur, distinct de Tether.
   ============================================================ */
Object.assign(TR.en, {
  'chain.tile':'YOR-USDT (test)','chain.group':'Blockchain (test network)','chain.title':'YOR-USDT',
  'chain.notice.t':'Test network','chain.notice.p':'YOR Experimental USDT is a TEST token on the Nile test network. It has no monetary value and is not Tether (USDT). You sign every transfer in your own TronLink wallet — Friendly Pay never sees your private key.',
  'chain.testBalance':'TEST BALANCE','chain.wallet':'Wallet','chain.connect.btn':'Connect TronLink','chain.connect.ready':'Connect your TronLink wallet to see your balance and send YOR-USDT.',
  'chain.connect.none':'TronLink was not detected in this browser.','chain.connect.help':'On your phone: open the TronLink app, go to its DApp browser and open this page there. On a computer: install the TronLink extension. Then tap Connect.',
  'chain.connect.copyLink':'Copy page link','chain.connect.connecting':'Connecting…','chain.connect.retry':'Check again','chain.disconnect':'Disconnect',
  'chain.net.nile':'Nile Testnet','chain.net.unknown':'Network not verified. Make sure TronLink is on Nile Testnet before you sign.','chain.net.wrong':'TronLink is on {net}. Switch TronLink to Nile Testnet to send.',
  'chain.net.mainnet':'TRON mainnet','chain.net.shasta':'Shasta testnet','chain.net.other':'another network',
  'chain.bal.title':'Balance','chain.bal.available':'Available','chain.bal.expired':'Expired','chain.bal.trx':'TRX for network fees','chain.bal.refresh':'Refresh','chain.bal.loading':'Reading the blockchain…',
  'chain.bal.src.solidity':'Read on the blockchain (confirmed)','chain.bal.src.fullnode':'Read on the blockchain (full node, not yet confirmed)','chain.bal.error':'Could not read the blockchain: {e}',
  'chain.trx.none':'This account has no TRX on Nile yet, so it cannot pay network fees. Get free test TRX first.','chain.trx.low':'Low TRX. A transfer burns about 19 TRX when you have no frozen energy.','chain.trx.faucet':'Get free test TRX',
  'chain.send.title':'Send','chain.send.to':'Recipient address (TRON, starts with T)','chain.send.amount':'Amount (YOR-USDT)','chain.send.max':'Max','chain.send.paste':'Paste','chain.send.review':'Review transfer','chain.send.blocked':'Switch TronLink to Nile Testnet to send.',
  'chain.review.title':'Review transfer','chain.review.from':'From','chain.review.to':'To','chain.review.amount':'Amount','chain.review.network':'Network','chain.review.energy':'Energy (simulated)','chain.review.fee':'Estimated network fee','chain.review.maxfee':'Maximum fee','chain.review.free':'0 TRX (your free resources cover it)',
  'chain.review.note':'The fee is an estimate from a simulation on the network. TronLink will then ask you to confirm.','chain.review.confirm':'Confirm and sign in TronLink','chain.review.cancel':'Cancel',
  'chain.progress.build':'Preparing and checking the transaction…','chain.progress.sign':'Waiting for your signature in TronLink…','chain.progress.signHint':'Open TronLink and approve the transaction. You have about 5 minutes.','chain.progress.signHintShort':'Open TronLink and approve the transaction. It expires in about a minute.','chain.retryStd':'Please try again: the next attempt uses the standard 1-minute validity.',
  'chain.state.draft':'Preparing','chain.state.pending_signature':'Waiting for your signature','chain.state.broadcasted':'Sent to the network','chain.state.confirming':'Confirming…','chain.state.confirmed':'Confirmed on the blockchain','chain.state.failed':'Failed','chain.state.expired':'Expired','chain.state.cancelled':'Cancelled',
  'chain.state.note.broadcasted':'Waiting for the network to include it in a block.','chain.state.note.confirming':'Included in a block. Waiting for it to be finalised.','chain.state.note.confirmed':'Finalised: the receipt is SUCCESS and the Transfer event matches.','chain.state.note.cancelled':'You refused the signature in TronLink. Nothing was sent.','chain.state.note.expired':'The transaction expired before the network included it. Nothing was transferred.','chain.state.note.failed':'The network rejected or failed this transaction.',
  'chain.anomaly':'The receipt says SUCCESS but the expected Transfer event was not found. It is NOT marked confirmed. Check it on the explorer.',
  'chain.detail.title':'Transfer','chain.detail.txid':'Transaction ID','chain.detail.block':'Block','chain.detail.fee':'Network fee paid','chain.detail.explorer':'View on Nile explorer','chain.detail.check':'Check now','chain.detail.back':'Back','chain.detail.indexed':'Confirmed (indexed by TronGrid)',
  'chain.act.title':'Activity','chain.act.none':'No transfer yet','chain.act.sent':'Sent','chain.act.received':'Received','chain.act.clear':'Clear finished',
  'chain.err.INVALID_ADDRESS':'This is not a valid TRON address (check every character).','chain.err.SELF_TRANSFER':'You cannot send to your own address.','chain.err.TO_ZERO_ADDRESS':'This is the zero address. Tokens sent there are lost.','chain.err.TO_CONTRACT':'This is the token contract itself. Tokens sent there are lost.',
  'chain.err.EVM_ADDRESS':'This is an Ethereum-style address (0x…). YOR-USDT only exists on TRON, so it cannot be sent there. Ask the recipient for their TRON address, which starts with T.',
  'chain.err.INVALID_AMOUNT':'Enter an amount greater than zero, like 12.5.','chain.err.TOO_MANY_DECIMALS':'YOR-USDT has 6 decimals at most.','chain.err.INSUFFICIENT_TOKEN':'The amount is higher than your available YOR-USDT balance.',
  'chain.err.INSUFFICIENT_TRX':'Not enough TRX to pay the network fee.','chain.err.ACCOUNT_NOT_ACTIVATED':'This account has no TRX on Nile yet. Get free test TRX first.','chain.err.FEE_TOO_HIGH':'The simulated fee is unusually high, so the transfer was blocked.',
  'chain.err.SIMULATION_REVERTED':'The contract would refuse this transfer.','chain.err.TX_CHECK_FAILED':'The network returned a transaction that does not match your request. Nothing was signed.','chain.err.SIGNED_TX_MISMATCH':'The wallet returned a different transaction than the one prepared. Nothing was sent.',
  'chain.err.SIGNATURE_REJECTED':'You refused the signature in TronLink. Nothing was sent.','chain.err.SIGNING_FAILED':'TronLink could not sign: {e}','chain.err.TX_EXPIRED':'The transaction expired before it could be sent. Try again and approve faster.',
  'chain.err.BROADCAST_REJECTED':'The network refused the transaction: {e}','chain.err.NETWORK_UNREACHABLE':'The TRON test network is unreachable. Check your connection.','chain.err.TIMEOUT':'The TRON test network took too long to answer.','chain.err.HTTP_ERROR':'The TRON test network answered with an error.',
  'chain.err.WRONG_NETWORK_NODE':'The node is not Nile Testnet. Nothing was done.','chain.err.TOKEN_METADATA_MISMATCH':'The contract is not YOR Experimental USDT. Nothing was done.','chain.err.BUSY':'A transfer is already in progress.','chain.err.ESTIMATE_CHANGED':'The fee changed since you reviewed it. Review again.',
  'chain.err.ACCOUNT_CHANGED':'The TronLink account changed. Reconnect.','chain.err.SIGNER_ADDRESS_MISMATCH':'The connected wallet is not the sender. Reconnect.','chain.err.NO_WALLET':'TronLink was not detected.','chain.err.USER_REJECTED':'You refused the connection in TronLink.','chain.err.NO_ACCOUNT':'TronLink returned no account. Unlock TronLink and try again.',
  'chain.err.NO_CHAIN':'The blockchain module did not load. Reload the app.','chain.err.UNKNOWN':'Something went wrong: {e}'
});
Object.assign(TR.fr, {
  'chain.tile':'YOR-USDT (test)','chain.group':'Blockchain (réseau de test)','chain.title':'YOR-USDT',
  'chain.notice.t':'Réseau de test','chain.notice.p':'YOR Experimental USDT est un jeton de TEST sur le réseau de test Nile. Il n\'a aucune valeur monétaire et n\'est pas du Tether (USDT). Vous signez chaque transfert dans votre propre portefeuille TronLink : Friendly Pay ne voit jamais votre clé privée.',
  'chain.testBalance':'SOLDE DE TEST','chain.wallet':'Portefeuille','chain.connect.btn':'Connecter TronLink','chain.connect.ready':'Connectez votre portefeuille TronLink pour voir votre solde et envoyer des YOR-USDT.',
  'chain.connect.none':'TronLink n\'a pas été détecté dans ce navigateur.','chain.connect.help':'Sur téléphone : ouvrez l\'application TronLink, allez dans son navigateur DApp et ouvrez cette page. Sur ordinateur : installez l\'extension TronLink. Puis touchez Connecter.',
  'chain.connect.copyLink':'Copier le lien de la page','chain.connect.connecting':'Connexion…','chain.connect.retry':'Vérifier à nouveau','chain.disconnect':'Déconnecter',
  'chain.net.nile':'Nile Testnet','chain.net.unknown':'Réseau non vérifié. Assurez-vous que TronLink est sur Nile Testnet avant de signer.','chain.net.wrong':'TronLink est sur {net}. Passez TronLink sur Nile Testnet pour envoyer.',
  'chain.net.mainnet':'le mainnet TRON','chain.net.shasta':'le testnet Shasta','chain.net.other':'un autre réseau',
  'chain.bal.title':'Solde','chain.bal.available':'Disponible','chain.bal.expired':'Expiré','chain.bal.trx':'TRX pour les frais réseau','chain.bal.refresh':'Actualiser','chain.bal.loading':'Lecture de la blockchain…',
  'chain.bal.src.solidity':'Lu sur la blockchain (confirmé)','chain.bal.src.fullnode':'Lu sur la blockchain (nœud complet, pas encore confirmé)','chain.bal.error':'Lecture de la blockchain impossible : {e}',
  'chain.trx.none':'Ce compte n\'a pas encore de TRX sur Nile : il ne peut pas payer les frais réseau. Récupérez d\'abord des TRX de test gratuits.','chain.trx.low':'Peu de TRX. Un transfert brûle environ 19 TRX si vous n\'avez pas d\'énergie gelée.','chain.trx.faucet':'Obtenir des TRX de test gratuits',
  'chain.send.title':'Envoyer','chain.send.to':'Adresse du destinataire (TRON, commence par T)','chain.send.amount':'Montant (YOR-USDT)','chain.send.max':'Max','chain.send.paste':'Coller','chain.send.review':'Vérifier le transfert','chain.send.blocked':'Passez TronLink sur Nile Testnet pour envoyer.',
  'chain.review.title':'Vérifier le transfert','chain.review.from':'De','chain.review.to':'À','chain.review.amount':'Montant','chain.review.network':'Réseau','chain.review.energy':'Énergie (simulée)','chain.review.fee':'Frais réseau estimés','chain.review.maxfee':'Frais maximum','chain.review.free':'0 TRX (vos ressources gratuites suffisent)',
  'chain.review.note':'Les frais sont une estimation issue d\'une simulation sur le réseau. TronLink vous demandera ensuite de confirmer.','chain.review.confirm':'Confirmer et signer dans TronLink','chain.review.cancel':'Annuler',
  'chain.progress.build':'Préparation et contrôle de la transaction…','chain.progress.sign':'En attente de votre signature dans TronLink…','chain.progress.signHint':'Ouvrez TronLink et approuvez la transaction. Vous avez environ 5 minutes.','chain.progress.signHintShort':'Ouvrez TronLink et approuvez la transaction. Elle expire en une minute environ.','chain.retryStd':'Réessayez : la prochaine tentative utilise la validité standard d\'une minute.',
  'chain.state.draft':'Préparation','chain.state.pending_signature':'En attente de votre signature','chain.state.broadcasted':'Envoyé au réseau','chain.state.confirming':'Confirmation en cours…','chain.state.confirmed':'Confirmé sur la blockchain','chain.state.failed':'Échec','chain.state.expired':'Expiré','chain.state.cancelled':'Annulé',
  'chain.state.note.broadcasted':'En attente de son inclusion dans un bloc.','chain.state.note.confirming':'Incluse dans un bloc. En attente de la finalisation.','chain.state.note.confirmed':'Finalisé : le reçu est SUCCESS et l\'événement Transfer correspond.','chain.state.note.cancelled':'Vous avez refusé la signature dans TronLink. Rien n\'a été envoyé.','chain.state.note.expired':'La transaction a expiré avant d\'être incluse. Rien n\'a été transféré.','chain.state.note.failed':'Le réseau a rejeté cette transaction ou elle a échoué.',
  'chain.anomaly':'Le reçu indique SUCCESS mais l\'événement Transfer attendu est introuvable. Elle n\'est PAS marquée confirmée. Vérifiez-la sur l\'explorateur.',
  'chain.detail.title':'Transfert','chain.detail.txid':'Identifiant de transaction','chain.detail.block':'Bloc','chain.detail.fee':'Frais réseau payés','chain.detail.explorer':'Voir sur l\'explorateur Nile','chain.detail.check':'Vérifier maintenant','chain.detail.back':'Retour','chain.detail.indexed':'Confirmé (indexé par TronGrid)',
  'chain.act.title':'Activité','chain.act.none':'Aucun transfert pour l\'instant','chain.act.sent':'Envoyé','chain.act.received':'Reçu','chain.act.clear':'Effacer les terminés',
  'chain.err.INVALID_ADDRESS':'Ce n\'est pas une adresse TRON valide (vérifiez chaque caractère).','chain.err.SELF_TRANSFER':'Vous ne pouvez pas envoyer à votre propre adresse.','chain.err.TO_ZERO_ADDRESS':'C\'est l\'adresse nulle. Les jetons envoyés là sont perdus.','chain.err.TO_CONTRACT':'C\'est le contrat du jeton lui-même. Les jetons envoyés là sont perdus.',
  'chain.err.EVM_ADDRESS':'C\'est une adresse de type Ethereum (0x…). YOR-USDT n\'existe que sur TRON : il ne peut pas y être envoyé. Demandez au destinataire son adresse TRON, qui commence par T.',
  'chain.err.INVALID_AMOUNT':'Saisissez un montant supérieur à zéro, par exemple 12,5.','chain.err.TOO_MANY_DECIMALS':'YOR-USDT a 6 décimales au maximum.','chain.err.INSUFFICIENT_TOKEN':'Le montant dépasse votre solde YOR-USDT disponible.',
  'chain.err.INSUFFICIENT_TRX':'Pas assez de TRX pour payer les frais réseau.','chain.err.ACCOUNT_NOT_ACTIVATED':'Ce compte n\'a pas encore de TRX sur Nile. Récupérez d\'abord des TRX de test gratuits.','chain.err.FEE_TOO_HIGH':'Les frais simulés sont anormalement élevés : le transfert a été bloqué.',
  'chain.err.SIMULATION_REVERTED':'Le contrat refuserait ce transfert.','chain.err.TX_CHECK_FAILED':'Le réseau a renvoyé une transaction qui ne correspond pas à votre demande. Rien n\'a été signé.','chain.err.SIGNED_TX_MISMATCH':'Le portefeuille a renvoyé une autre transaction que celle préparée. Rien n\'a été envoyé.',
  'chain.err.SIGNATURE_REJECTED':'Vous avez refusé la signature dans TronLink. Rien n\'a été envoyé.','chain.err.SIGNING_FAILED':'TronLink n\'a pas pu signer : {e}','chain.err.TX_EXPIRED':'La transaction a expiré avant d\'être envoyée. Réessayez et approuvez plus vite.',
  'chain.err.BROADCAST_REJECTED':'Le réseau a refusé la transaction : {e}','chain.err.NETWORK_UNREACHABLE':'Le réseau de test TRON est injoignable. Vérifiez votre connexion.','chain.err.TIMEOUT':'Le réseau de test TRON met trop de temps à répondre.','chain.err.HTTP_ERROR':'Le réseau de test TRON a répondu par une erreur.',
  'chain.err.WRONG_NETWORK_NODE':'Le nœud n\'est pas Nile Testnet. Rien n\'a été fait.','chain.err.TOKEN_METADATA_MISMATCH':'Le contrat n\'est pas YOR Experimental USDT. Rien n\'a été fait.','chain.err.BUSY':'Un transfert est déjà en cours.','chain.err.ESTIMATE_CHANGED':'Les frais ont changé depuis votre vérification. Vérifiez à nouveau.',
  'chain.err.ACCOUNT_CHANGED':'Le compte TronLink a changé. Reconnectez-vous.','chain.err.SIGNER_ADDRESS_MISMATCH':'Le portefeuille connecté n\'est pas l\'expéditeur. Reconnectez-vous.','chain.err.NO_WALLET':'TronLink n\'a pas été détecté.','chain.err.USER_REJECTED':'Vous avez refusé la connexion dans TronLink.','chain.err.NO_ACCOUNT':'TronLink n\'a renvoyé aucun compte. Déverrouillez TronLink et réessayez.',
  'chain.err.NO_CHAIN':'Le module blockchain ne s\'est pas chargé. Rechargez l\'app.','chain.err.UNKNOWN':'Une erreur est survenue : {e}'
});
Object.assign(TR.ar, {
  'chain.tile':'YOR-USDT (تجريبي)','chain.group':'البلوكشين (شبكة تجريبية)','chain.title':'YOR-USDT',
  'chain.notice.t':'شبكة تجريبية','chain.notice.p':'YOR Experimental USDT عملة اختبار على شبكة Nile التجريبية. لا قيمة مالية لها وليست Tether (USDT). توقّع كل تحويل داخل محفظتك TronLink الخاصة بك، ولا يرى Friendly Pay مفتاحك الخاص أبداً.',
  'chain.testBalance':'رصيد تجريبي','chain.wallet':'المحفظة','chain.connect.btn':'ربط TronLink','chain.connect.ready':'اربط محفظة TronLink لعرض رصيدك وإرسال YOR-USDT.',
  'chain.connect.none':'لم يتم اكتشاف TronLink في هذا المتصفح.','chain.connect.help':'على الهاتف: افتح تطبيق TronLink ثم متصفح DApp فيه وافتح هذه الصفحة. على الحاسوب: ثبّت إضافة TronLink. ثم اضغط ربط.',
  'chain.connect.copyLink':'نسخ رابط الصفحة','chain.connect.connecting':'جارٍ الاتصال…','chain.connect.retry':'إعادة الفحص','chain.disconnect':'قطع الاتصال',
  'chain.net.nile':'Nile Testnet','chain.net.unknown':'لم يتم التحقق من الشبكة. تأكد أن TronLink على Nile Testnet قبل التوقيع.','chain.net.wrong':'TronLink على {net}. غيّر TronLink إلى Nile Testnet للإرسال.',
  'chain.net.mainnet':'الشبكة الرئيسية لـ TRON','chain.net.shasta':'شبكة Shasta التجريبية','chain.net.other':'شبكة أخرى',
  'chain.bal.title':'الرصيد','chain.bal.available':'المتاح','chain.bal.expired':'المنتهي','chain.bal.trx':'TRX لرسوم الشبكة','chain.bal.refresh':'تحديث','chain.bal.loading':'جارٍ القراءة من البلوكشين…',
  'chain.bal.src.solidity':'مقروء من البلوكشين (مؤكَّد)','chain.bal.src.fullnode':'مقروء من البلوكشين (العقدة الكاملة، غير مؤكَّد بعد)','chain.bal.error':'تعذّرت القراءة من البلوكشين: {e}',
  'chain.trx.none':'لا يملك هذا الحساب TRX على Nile بعد، لذا لا يستطيع دفع رسوم الشبكة. احصل أولاً على TRX تجريبي مجاني.','chain.trx.low':'رصيد TRX منخفض. يحرق التحويل نحو 19 TRX إذا لم تكن لديك طاقة مجمّدة.','chain.trx.faucet':'احصل على TRX تجريبي مجاني',
  'chain.send.title':'إرسال','chain.send.to':'عنوان المستلم (TRON، يبدأ بالحرف T)','chain.send.amount':'المبلغ (YOR-USDT)','chain.send.max':'الحد الأقصى','chain.send.paste':'لصق','chain.send.review':'مراجعة التحويل','chain.send.blocked':'غيّر TronLink إلى Nile Testnet للإرسال.',
  'chain.review.title':'مراجعة التحويل','chain.review.from':'من','chain.review.to':'إلى','chain.review.amount':'المبلغ','chain.review.network':'الشبكة','chain.review.energy':'الطاقة (محاكاة)','chain.review.fee':'رسوم الشبكة المقدّرة','chain.review.maxfee':'الحد الأقصى للرسوم','chain.review.free':'0 TRX (مواردك المجانية تكفي)',
  'chain.review.note':'الرسوم تقدير من محاكاة على الشبكة. سيطلب منك TronLink التأكيد بعد ذلك.','chain.review.confirm':'تأكيد والتوقيع في TronLink','chain.review.cancel':'إلغاء',
  'chain.progress.build':'جارٍ تجهيز المعاملة والتحقق منها…','chain.progress.sign':'بانتظار توقيعك في TronLink…','chain.progress.signHint':'افتح TronLink ووافق على المعاملة. لديك نحو 5 دقائق.','chain.progress.signHintShort':'افتح TronLink ووافق على المعاملة. تنتهي صلاحيتها خلال نحو دقيقة.','chain.retryStd':'أعد المحاولة: ستستخدم المحاولة التالية الصلاحية القياسية البالغة دقيقة واحدة.',
  'chain.state.draft':'قيد التجهيز','chain.state.pending_signature':'بانتظار توقيعك','chain.state.broadcasted':'أُرسلت إلى الشبكة','chain.state.confirming':'قيد التأكيد…','chain.state.confirmed':'مؤكَّدة على البلوكشين','chain.state.failed':'فشلت','chain.state.expired':'منتهية','chain.state.cancelled':'ملغاة',
  'chain.state.note.broadcasted':'بانتظار إدراجها في كتلة.','chain.state.note.confirming':'أُدرجت في كتلة. بانتظار الإنهاء.','chain.state.note.confirmed':'مُنجزة: الإيصال SUCCESS وحدث Transfer مطابق.','chain.state.note.cancelled':'رفضت التوقيع في TronLink. لم يُرسل شيء.','chain.state.note.expired':'انتهت صلاحية المعاملة قبل إدراجها. لم يُحوَّل شيء.','chain.state.note.failed':'رفضت الشبكة هذه المعاملة أو فشلت.',
  'chain.anomaly':'الإيصال يقول SUCCESS لكن حدث Transfer المتوقع غير موجود. لن تُعتبر مؤكَّدة. تحقق منها في المستكشف.',
  'chain.detail.title':'تحويل','chain.detail.txid':'معرّف المعاملة','chain.detail.block':'الكتلة','chain.detail.fee':'رسوم الشبكة المدفوعة','chain.detail.explorer':'عرض في مستكشف Nile','chain.detail.check':'تحقق الآن','chain.detail.back':'رجوع','chain.detail.indexed':'مؤكَّدة (مفهرسة لدى TronGrid)',
  'chain.act.title':'النشاط','chain.act.none':'لا توجد تحويلات بعد','chain.act.sent':'مُرسَل','chain.act.received':'مُستلَم','chain.act.clear':'مسح المنتهية',
  'chain.err.INVALID_ADDRESS':'هذا ليس عنوان TRON صالحاً (تحقق من كل حرف).','chain.err.SELF_TRANSFER':'لا يمكنك الإرسال إلى عنوانك نفسه.','chain.err.TO_ZERO_ADDRESS':'هذا هو العنوان الصفري. الرموز المرسلة إليه تضيع.','chain.err.TO_CONTRACT':'هذا هو عقد الرمز نفسه. الرموز المرسلة إليه تضيع.',
  'chain.err.EVM_ADDRESS':'هذا عنوان بصيغة Ethereum (0x…). YOR-USDT موجود على شبكة TRON فقط، لذا لا يمكن إرساله إليه. اطلب من المستلم عنوان TRON الخاص به، وهو يبدأ بالحرف T.',
  'chain.err.INVALID_AMOUNT':'أدخل مبلغاً أكبر من الصفر، مثل 12.5.','chain.err.TOO_MANY_DECIMALS':'لـ YOR-USDT ست خانات عشرية على الأكثر.','chain.err.INSUFFICIENT_TOKEN':'المبلغ أكبر من رصيد YOR-USDT المتاح لديك.',
  'chain.err.INSUFFICIENT_TRX':'لا يوجد TRX كافٍ لدفع رسوم الشبكة.','chain.err.ACCOUNT_NOT_ACTIVATED':'لا يملك هذا الحساب TRX على Nile بعد. احصل أولاً على TRX تجريبي مجاني.','chain.err.FEE_TOO_HIGH':'الرسوم المحاكاة مرتفعة بشكل غير معتاد، لذا مُنع التحويل.',
  'chain.err.SIMULATION_REVERTED':'سيرفض العقد هذا التحويل.','chain.err.TX_CHECK_FAILED':'أعادت الشبكة معاملة لا تطابق طلبك. لم يُوقَّع شيء.','chain.err.SIGNED_TX_MISMATCH':'أعادت المحفظة معاملة مختلفة عن المجهّزة. لم يُرسل شيء.',
  'chain.err.SIGNATURE_REJECTED':'رفضت التوقيع في TronLink. لم يُرسل شيء.','chain.err.SIGNING_FAILED':'تعذّر على TronLink التوقيع: {e}','chain.err.TX_EXPIRED':'انتهت صلاحية المعاملة قبل إرسالها. أعد المحاولة ووافق بسرعة أكبر.',
  'chain.err.BROADCAST_REJECTED':'رفضت الشبكة المعاملة: {e}','chain.err.NETWORK_UNREACHABLE':'تعذّر الوصول إلى شبكة TRON التجريبية. تحقق من اتصالك.','chain.err.TIMEOUT':'استغرقت شبكة TRON التجريبية وقتاً طويلاً للرد.','chain.err.HTTP_ERROR':'ردّت شبكة TRON التجريبية بخطأ.',
  'chain.err.WRONG_NETWORK_NODE':'العقدة ليست Nile Testnet. لم يُنفَّذ شيء.','chain.err.TOKEN_METADATA_MISMATCH':'العقد ليس YOR Experimental USDT. لم يُنفَّذ شيء.','chain.err.BUSY':'هناك تحويل قيد التنفيذ بالفعل.','chain.err.ESTIMATE_CHANGED':'تغيّرت الرسوم منذ مراجعتك. راجع مجدداً.',
  'chain.err.ACCOUNT_CHANGED':'تغيّر حساب TronLink. أعد الربط.','chain.err.SIGNER_ADDRESS_MISMATCH':'المحفظة المرتبطة ليست المُرسِل. أعد الربط.','chain.err.NO_WALLET':'لم يتم اكتشاف TronLink.','chain.err.USER_REJECTED':'رفضت الربط في TronLink.','chain.err.NO_ACCOUNT':'لم يُرجع TronLink أي حساب. افتح قفل TronLink وأعد المحاولة.',
  'chain.err.NO_CHAIN':'لم تُحمَّل وحدة البلوكشين. أعد تحميل التطبيق.','chain.err.UNKNOWN':'حدث خطأ: {e}'
});

/* libellés de la grille « Services » (lus par yt()) */
Object.assign(YT.en, { gChain:'Blockchain (test network)', chainTile:'YOR-USDT' });
Object.assign(YT.fr, { gChain:'Blockchain (réseau de test)', chainTile:'YOR-USDT' });
Object.assign(YT.ar, { gChain:'البلوكشين (شبكة تجريبية)', chainTile:'YOR-USDT' });

const ChainUI = (() => {
  const Y = () => (typeof window !== 'undefined' ? window.YorChain : null);
  let client = null, root = null, bound = null, unsubs = [], pollTimer = null, started = false;
  let st = null;

  function fresh(){
    return { view:'main', form:{ to:'', amount:'' }, formErr:'', connErr:'', connecting:false,
      bal:null, balErr:'', balLoading:false, est:null, sendErr:'', reviewing:false, busy:false, progressErr:'',
      selected:null, history:[], histErr:'' };
  }
  const tc = (k, vars) => (vars ? tf(k, vars) : t(k));
  function errText(e){
    const code = e && e.code ? String(e.code) : 'UNKNOWN';
    const key = 'chain.err.' + code;
    const has = TR[LANG] && TR[LANG][key] || TR.en[key];
    const detail = e && e.reason ? e.reason : (e && e.message ? e.message : '');
    if (has) return tf(key, { e: String(detail).slice(0, 160) });
    return tf('chain.err.UNKNOWN', { e: String(detail || code).slice(0, 160) });
  }
  const short = a => (a ? a.slice(0, 6) + '…' + a.slice(-5) : '');
  const ltr = s => '<span class="ch-mono">' + escapeHtml(s) + '</span>';
  const addr = s => '<span class="ch-mono ch-addr">' + escapeHtml(s) + '</span>';
  const cerr = code => new (Y().ChainError)(code);
  const amt = raw => Y().formatAmount(raw);

  function ensureClient(){
    if (client) return client;
    if (!Y()) return null;
    client = Y().createClient({ window: window });
    /* 12.3.6 : e-mail « c'est parti » dès la diffusion, « confirmé » seulement avec la preuve de la chaîne (voir chain-notice.js) */
    try { if (typeof ChainNotice !== 'undefined') ChainNotice.attach(client); } catch (e) { /* jamais bloquant */ }
    return client;
  }

  /* ------------------------------------------------------------------ rendu */
  function render(){
    st = st && st.keepWallet ? st : fresh();
    st.view = 'main'; st.est = null; st.sendErr = ''; st.formErr = ''; st.progressErr = ''; st.busy = false; st.reviewing = false;
    return '<div class="topbar"><button class="topbar-back" data-chain="back" aria-label="' + escapeHtml(t('ui.back')) + '"><span class="dir-flip" style="display:inline-flex">' + icon('back', 20) + '</span></button>' +
      '<span class="topbar-title">' + escapeHtml(t('chain.title')) + '</span><span style="width:calc(44px*var(--ui))"></span></div>' +
      '<div class="screen-body" style="padding-top:0"><div class="ch-wrap" id="ch-wrap"></div></div>';
  }

  function noticeHtml(){
    return '<div class="ch-banner" role="note">' + icon('warn', 18) + '<div><b>' + escapeHtml(t('chain.notice.t')) + '</b> · ' + escapeHtml(Y() ? Y().CONFIG.network.name : 'Nile Testnet') +
      '<p>' + escapeHtml(t('chain.notice.p')) + '</p></div></div>';
  }

  function netChip(w){
    if (!w.connected) return '';
    if (w.network === 'nile') return '<span class="ch-chip ok">' + icon('check', 13) + escapeHtml(t('chain.net.nile')) + '</span>';
    if (w.network === 'unknown') return '<span class="ch-chip warn">' + icon('warn', 13) + escapeHtml(t('chain.net.unknown')) + '</span>';
    const nm = t('chain.net.' + (['mainnet', 'shasta'].includes(w.network) ? w.network : 'other'));
    return '<span class="ch-chip bad">' + icon('warn', 13) + escapeHtml(tf('chain.net.wrong', { net: nm })) + '</span>';
  }
  const netBlocked = w => w.connected && w.network !== 'nile' && w.network !== 'unknown';

  function connHtml(){
    if (!client) return '<div class="ch-card"><div class="ch-err" role="alert">' + escapeHtml(t('chain.err.NO_CHAIN')) + '</div></div>';
    const w = client.wallet.state();
    let body;
    if (!w.connected){
      const avail = client.wallet.available();
      body = avail
        ? '<p class="ch-p">' + escapeHtml(t('chain.connect.ready')) + '</p><button class="btn btn-primary" data-chain="connect"' + (st.connecting ? ' disabled' : '') + '>' + icon('wallet', 18) + '<span>' + escapeHtml(st.connecting ? t('chain.connect.connecting') : t('chain.connect.btn')) + '</span></button>'
        : '<p class="ch-p">' + escapeHtml(t('chain.connect.none')) + '</p><p class="ch-p ch-dim">' + escapeHtml(t('chain.connect.help')) + '</p>' +
          '<div class="ch-btns"><button class="btn btn-secondary" data-chain="copylink">' + icon('copy', 16) + '<span>' + escapeHtml(t('chain.connect.copyLink')) + '</span></button>' +
          '<button class="btn btn-secondary" data-chain="recheck"><span>' + escapeHtml(t('chain.connect.retry')) + '</span></button></div>';
      if (st.connErr) body += '<div class="ch-err" role="alert">' + escapeHtml(st.connErr) + '</div>';
    } else {
      body = '<div class="ch-row"><span class="ch-k">' + icon('wallet', 16) + ' TronLink</span><span class="ch-v">' + addr(short(w.address)) +
        ' <button class="ch-mini" data-chain="copy" data-v="' + escapeHtml(w.address) + '" aria-label="' + escapeHtml(t('action.copy')) + '">' + icon('copy', 14) + '</button></span></div>' +
        '<div class="ch-netline">' + netChip(w) + '</div>' +
        '<button class="ch-link" data-chain="disconnect">' + escapeHtml(t('chain.disconnect')) + '</button>';
    }
    return '<div class="ch-card"><h2 class="ch-h">' + escapeHtml(t('chain.wallet')) + '</h2>' + body + '</div>';
  }

  function balHtml(){
    if (!client || !client.wallet.state().connected) return '';
    const b = st.bal;
    let body;
    if (st.balLoading && !b) body = '<p class="ch-p ch-dim">' + escapeHtml(t('chain.bal.loading')) + '</p>';
    else if (!b) body = st.balErr ? '<div class="ch-err" role="alert">' + escapeHtml(tf('chain.bal.error', { e: st.balErr })) + '</div>' : '';
    else {
      const trx = b.trx;
      const trxLine = !trx ? '—' : (trx.exists ? ltr(Y().formatTrx(trx.balanceSun) + ' TRX') : ltr('0 TRX'));
      const needFaucet = trx && (!trx.exists || trx.balanceSun < 25000000n);
      body = '<div class="ch-big">' + ltr(amt(b.available)) + ' <small>' + escapeHtml(Y().CONFIG.token.symbol) + '</small></div>' +
        '<div class="ch-badges"><span class="ch-badge test">' + escapeHtml(t('chain.testBalance')) + '</span><span class="ch-badge">' + escapeHtml(t('chain.bal.src.' + b.source)) + '</span></div>' +
        '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.bal.title')) + '</span><span class="ch-v">' + ltr(amt(b.total)) + '</span></div>' +
        (b.expired !== null && b.expired > 0n ? '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.bal.expired')) + '</span><span class="ch-v">' + ltr(amt(b.expired)) + '</span></div>' : '') +
        '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.bal.trx')) + '</span><span class="ch-v">' + trxLine + '</span></div>' +
        (needFaucet ? '<div class="ch-note warn">' + icon('info', 16) + '<span>' + escapeHtml(trx && !trx.exists ? t('chain.trx.none') : t('chain.trx.low')) + '</span></div>' +
          '<a class="btn btn-secondary ch-faucet" href="' + escapeHtml(Y().CONFIG.network.faucet) + '" target="_blank" rel="noopener noreferrer"><span>' + escapeHtml(t('chain.trx.faucet')) + '</span></a>' : '');
      if (st.balErr) body += '<div class="ch-err" role="alert">' + escapeHtml(tf('chain.bal.error', { e: st.balErr })) + '</div>';
    }
    return '<div class="ch-card"><div class="ch-hrow"><h2 class="ch-h">' + escapeHtml(t('chain.bal.title')) + '</h2>' +
      '<button class="ch-mini" data-chain="refresh" aria-label="' + escapeHtml(t('chain.bal.refresh')) + '"' + (st.balLoading ? ' disabled' : '') + '>' + escapeHtml(st.balLoading ? '…' : t('chain.bal.refresh')) + '</button></div>' + body + '</div>';
  }

  function sendHtml(){
    if (!client) return '';
    const w = client.wallet.state();
    if (!w.connected) return '';
    const blocked = netBlocked(w);
    return '<div class="ch-card"><h2 class="ch-h">' + escapeHtml(t('chain.send.title')) + '</h2>' +
      '<div class="field"><label class="field-label" for="ch-to">' + escapeHtml(t('chain.send.to')) + '</label><div class="field-box ch-fb">' +
      '<input type="text" id="ch-to" class="ltr" value="' + escapeHtml(st.form.to) + '" placeholder="T…" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="off">' +
      '<button class="ch-mini" data-chain="paste" type="button">' + escapeHtml(t('chain.send.paste')) + '</button></div></div>' +
      '<div class="field"><label class="field-label" for="ch-amount">' + escapeHtml(t('chain.send.amount')) + '</label><div class="field-box ch-fb">' +
      '<input type="text" id="ch-amount" class="ltr" inputmode="decimal" value="' + escapeHtml(st.form.amount) + '" placeholder="0.00" autocomplete="off" spellcheck="false">' +
      '<button class="ch-mini" data-chain="max" type="button">' + escapeHtml(t('chain.send.max')) + '</button></div></div>' +
      '<div id="ch-form-msg" class="ch-err" role="alert"' + (st.formErr ? '' : ' hidden') + '>' + escapeHtml(st.formErr) + '</div>' +
      (blocked ? '<div class="ch-note warn">' + icon('warn', 16) + '<span>' + escapeHtml(t('chain.send.blocked')) + '</span></div>' : '') +
      '<button class="btn btn-primary" data-chain="review"' + (blocked || st.reviewing ? ' disabled' : '') + '>' + icon('send', 18) + '<span>' + escapeHtml(st.reviewing ? t('chain.progress.build') : t('chain.send.review')) + '</span></button></div>';
  }

  /* Activité : enregistrements locaux (états vérifiés) + historique TronGrid (confirmé selon l'index) */
  function activityItems(){
    const recs = client ? client.records() : [];
    const known = new Set(recs.map(r => r.txid).filter(Boolean));
    const items = recs.map(r => ({ kind:'rec', id:r.id, dir: (client.wallet.state().address === r.from ? 'out' : 'in'), peer: r.to, amountRaw: BigInt(r.amountRaw), ts: r.updatedAt || r.createdAt, state:r.state }));
    st.history.filter(h => !known.has(h.txid)).forEach(h => items.push({ kind:'hist', id:h.txid, dir:h.direction, peer: h.direction === 'out' ? h.to : h.from, amountRaw:h.amountRaw, ts:h.ts || 0, state:'confirmed', indexed:true }));
    return items.sort((a, b) => b.ts - a.ts).slice(0, 25);
  }
  function actHtml(){
    if (!client || !client.wallet.state().connected) return '';
    const items = activityItems();
    const hasFinished = (client.records() || []).some(r => ['confirmed', 'failed', 'expired', 'cancelled'].includes(r.state));
    const rows = items.length ? items.map(i => '<button class="ch-act" data-chain="open" data-id="' + escapeHtml(i.id) + '" data-kind="' + i.kind + '">' +
      '<span class="ch-act-ic ' + i.dir + '">' + icon(i.dir === 'out' ? 'arrowUpRight' : 'arrowDownRight', 18) + '</span>' +
      '<span class="ch-act-b"><b>' + escapeHtml(i.dir === 'out' ? t('chain.act.sent') : t('chain.act.received')) + '</b><small>' + addr(short(i.peer)) + (i.ts ? ' · ' + escapeHtml(fmtDate(i.ts)) : '') + '</small></span>' +
      '<span class="ch-act-r"><b class="' + i.dir + '">' + (i.dir === 'out' ? '−' : '+') + ltr(amt(i.amountRaw)) + '</b><small class="ch-st" data-s="' + i.state + '">' + escapeHtml(t('chain.state.' + i.state)) + '</small></span></button>').join('')
      : '<p class="ch-p ch-dim">' + escapeHtml(t('chain.act.none')) + '</p>';
    return '<div class="ch-card"><div class="ch-hrow"><h2 class="ch-h">' + escapeHtml(t('chain.act.title')) + '</h2>' +
      (hasFinished ? '<button class="ch-mini" data-chain="clear">' + escapeHtml(t('chain.act.clear')) + '</button>' : '') + '</div>' + rows +
      (st.histErr ? '<div class="ch-err" role="alert">' + escapeHtml(st.histErr) + '</div>' : '') + '</div>';
  }

  function reviewHtml(){
    const e = st.est;
    const feeTxt = e.expectedBurnSun === 0n ? t('chain.review.free') : '≈ ' + Y().formatTrx(e.expectedBurnSun) + ' TRX';
    return '<div class="ch-card"><h2 class="ch-h">' + escapeHtml(t('chain.review.title')) + '</h2>' +
      '<div class="ch-big">' + ltr(amt(e.amountRaw)) + ' <small>' + escapeHtml(Y().CONFIG.token.symbol) + '</small></div>' +
      '<div class="ch-badges"><span class="ch-badge test">' + escapeHtml(t('chain.testBalance')) + '</span></div>' +
      '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.review.from')) + '</span><span class="ch-v">' + addr(short(e.from)) + '</span></div>' +
      '<div class="ch-row col"><span class="ch-k">' + escapeHtml(t('chain.review.to')) + '</span><span class="ch-v wide">' + addr(e.to) + '</span></div>' +
      '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.review.network')) + '</span><span class="ch-v">' + escapeHtml(Y().CONFIG.network.name) + '</span></div>' +
      '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.review.energy')) + '</span><span class="ch-v">' + ltr(String(e.energyUsed)) + '</span></div>' +
      '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.review.fee')) + '</span><span class="ch-v">' + ltr(feeTxt) + '</span></div>' +
      '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.review.maxfee')) + '</span><span class="ch-v">' + ltr(e.feeLimitTrx + ' TRX') + '</span></div>' +
      '<div class="ch-note">' + icon('info', 16) + '<span>' + escapeHtml(t('chain.review.note')) + '</span></div>' +
      (st.sendErr ? '<div class="ch-err" role="alert">' + escapeHtml(st.sendErr) + '</div>' : '') +
      '<button class="btn btn-primary" data-chain="confirm"' + (st.busy ? ' disabled' : '') + '>' + icon('shield', 18) + '<span>' + escapeHtml(t('chain.review.confirm')) + '</span></button>' +
      '<button class="btn btn-secondary" data-chain="cancel"' + (st.busy ? ' disabled' : '') + '><span>' + escapeHtml(t('chain.review.cancel')) + '</span></button></div>';
  }

  function progressHtml(){
    const active = client.records().find(r => r.state === 'draft' || r.state === 'pending_signature');
    const signing = active && active.state === 'pending_signature';
    return '<div class="ch-card ch-center"><div class="ch-spin" aria-hidden="true"></div>' +
      '<p class="ch-p"><b>' + escapeHtml(signing ? t('chain.progress.sign') : t('chain.progress.build')) + '</b></p>' +
      (signing ? '<p class="ch-p ch-dim">' + escapeHtml(t(active.extended ? 'chain.progress.signHint' : 'chain.progress.signHintShort')) + '</p>' : '') +
      (st.progressErr ? '<div class="ch-err" role="alert">' + escapeHtml(st.progressErr) + '</div><button class="btn btn-secondary" data-chain="cancel"><span>' + escapeHtml(t('chain.detail.back')) + '</span></button>' : '') + '</div>';
  }

  function detailHtml(){
    const sel = st.selected;
    let r = null, indexed = false;
    if (sel.kind === 'rec') r = client.records().find(x => x.id === sel.id);
    else {
      const h = st.history.find(x => x.txid === sel.id);
      if (h) { indexed = true; r = { txid:h.txid, from:h.from, to:h.to, amountRaw:h.amountRaw.toString(), state:'confirmed', blockNumber:null, feeSun:null, updatedAt:h.ts }; }
    }
    if (!r) return '<div class="ch-card"><button class="btn btn-secondary" data-chain="cancel"><span>' + escapeHtml(t('chain.detail.back')) + '</span></button></div>';
    const s = r.state;
    const tone = s === 'confirmed' ? 'ok' : (s === 'failed' || s === 'expired' || s === 'cancelled') ? 'bad' : 'pend';
    const icn = s === 'confirmed' ? 'check' : tone === 'bad' ? 'close' : 'clock';
    const steps = ['broadcasted', 'confirming', 'confirmed'];
    const idx = steps.indexOf(s);
    const stepper = tone === 'bad' ? '' : '<ol class="ch-steps">' + steps.map((k, i) => '<li class="' + (i <= idx ? 'on' : '') + '">' + escapeHtml(t('chain.state.' + k)) + '</li>').join('') + '</ol>';
    const explorer = r.txid ? Y().CONFIG.network.explorerTx + r.txid : null;
    const note = indexed ? t('chain.detail.indexed') : t('chain.state.note.' + s);
    const reasonLine = r.reason && s === 'failed' ? '<div class="ch-err" role="alert">' + escapeHtml(String(r.reason).slice(0, 200)) + '</div>' : '';
    return '<div class="ch-card ch-center"><div class="ch-state ' + tone + '">' + icon(icn, 30) + '</div>' +
      '<h2 class="ch-title">' + escapeHtml(t('chain.state.' + s)) + '</h2><p class="ch-p ch-dim">' + escapeHtml(note) + '</p>' + stepper + '</div>' +
      '<div class="ch-card"><div class="ch-big">' + ltr(amt(BigInt(r.amountRaw))) + ' <small>' + escapeHtml(Y().CONFIG.token.symbol) + '</small></div>' +
      '<div class="ch-badges"><span class="ch-badge test">' + escapeHtml(t('chain.testBalance')) + '</span></div>' +
      '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.review.from')) + '</span><span class="ch-v">' + addr(short(r.from)) + '</span></div>' +
      '<div class="ch-row col"><span class="ch-k">' + escapeHtml(t('chain.review.to')) + '</span><span class="ch-v wide">' + addr(r.to) + '</span></div>' +
      (r.blockNumber ? '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.detail.block')) + '</span><span class="ch-v">' + ltr(String(r.blockNumber)) + '</span></div>' : '') +
      (r.feeSun ? '<div class="ch-row"><span class="ch-k">' + escapeHtml(t('chain.detail.fee')) + '</span><span class="ch-v">' + ltr(Y().formatTrx(r.feeSun) + ' TRX') + '</span></div>' : '') +
      (r.txid ? '<div class="ch-row col"><span class="ch-k">' + escapeHtml(t('chain.detail.txid')) + ' <button class="ch-mini" data-chain="copy" data-v="' + escapeHtml(r.txid) + '" aria-label="' + escapeHtml(t('action.copy')) + '">' + icon('copy', 14) + '</button></span><span class="ch-v wide">' + addr(r.txid) + '</span></div>' : '') +
      (r.anomaly ? '<div class="ch-note warn">' + icon('warn', 16) + '<span>' + escapeHtml(t('chain.anomaly')) + '</span></div>' : '') + reasonLine +
      (explorer ? '<a class="btn btn-secondary" href="' + escapeHtml(explorer) + '" target="_blank" rel="noopener noreferrer"><span>' + escapeHtml(t('chain.detail.explorer')) + '</span></a>' : '') +
      (sel.kind === 'rec' && r.txid && !['confirmed', 'failed', 'expired', 'cancelled'].includes(s) ? '<button class="btn btn-secondary" data-chain="check"><span>' + escapeHtml(t('chain.detail.check')) + '</span></button>' : '') +
      '<button class="btn btn-primary" data-chain="cancel"><span>' + escapeHtml(t('chain.detail.back')) + '</span></button></div>';
  }

  /* ------------------------------------------------------------------ peinture */
  const $ = id => (root ? root.querySelector('#' + id) : null);
  function paintMain(){
    const wrap = $('ch-wrap'); if (!wrap) return;
    wrap.innerHTML = noticeHtml() + '<div id="ch-conn"></div><div id="ch-bal"></div><div id="ch-send"></div><div id="ch-act"></div>';
    paint('conn'); paint('bal'); paint('send'); paint('act');
  }
  function paint(part){
    if (!root || st.view !== 'main') return;
    const map = { conn:connHtml, bal:balHtml, send:sendHtml, act:actHtml };
    const el = $('ch-' + part); if (el) el.innerHTML = map[part]();
  }
  function paintView(){
    const wrap = $('ch-wrap'); if (!wrap) return;
    if (st.view === 'main') { paintMain(); return; }
    const body = st.view === 'review' ? reviewHtml() : st.view === 'progress' ? progressHtml() : detailHtml();
    wrap.innerHTML = noticeHtml() + body;
    if (root) root.scrollTop = 0;
  }
  function setView(v){ st.view = v; paintView(); }

  /* ------------------------------------------------------------------ actions */
  async function loadBalances(){
    const w = client.wallet.state(); if (!w.connected) return;
    st.balLoading = true; st.balErr = ''; paint('bal');
    try { st.bal = await client.readBalances(w.address); }
    catch (e) { st.balErr = errText(e); }
    st.balLoading = false; paint('bal');
  }
  async function loadHistory(){
    const w = client.wallet.state(); if (!w.connected) return;
    try { st.history = await client.chainHistory(w.address, 20); st.histErr = ''; }
    catch (e) { st.histErr = errText(e); }
    paint('act');
  }
  async function connect(){
    st.connecting = true; st.connErr = ''; paint('conn');
    try { await client.wallet.connect(); }
    catch (e) { st.connErr = errText(e); }
    st.connecting = false; paint('conn'); paint('bal'); paint('send'); paint('act');
    if (client.wallet.state().connected){ loadBalances(); loadHistory(); }
  }
  async function review(){
    st.formErr = '';
    const w = client.wallet.state();
    const to = ($('ch-to') || {}).value || '', amtTxt = ($('ch-amount') || {}).value || '';
    /* 12.3.7 : le texte collé est nettoyé (espaces, caractères invisibles, lien d'explorateur, forme hexadécimale 41…) ; l'adresse nettoyée est celle qui est affichée et envoyée */
    st.form.to = Y().cleanAddressInput(to); st.form.amount = amtTxt.trim();
    const fail = e => { st.formErr = errText(e); st.reviewing = false; paint('send'); };
    let raw;
    try {
      if (!Y().isAddress(st.form.to)) throw cerr(/^0x[0-9a-fA-F]{40}$/.test(st.form.to) ? 'EVM_ADDRESS' : 'INVALID_ADDRESS');
      raw = Y().parseAmount(st.form.amount);
    } catch (e) { return fail(e); }
    st.reviewing = true; paint('send');
    try {
      const est = await client.estimateTransfer({ from: w.address, to: st.form.to, amountRaw: raw });
      if (!est.accountActivated) throw cerr('ACCOUNT_NOT_ACTIVATED');
      if (!est.hasEnoughTrx) throw cerr('INSUFFICIENT_TRX');
      st.est = est; st.reviewing = false; st.sendErr = ''; setView('review');
    } catch (e) { fail(e); }
  }
  async function confirm(){
    const e0 = st.est; if (!e0 || st.busy) return;
    st.busy = true; st.progressErr = ''; setView('progress');
    try {
      const rec = await client.sendTransfer({ from: e0.from, to: e0.to, amountRaw: e0.amountRaw, signer: client.wallet.signer, reviewed: e0, extendExpiration: !st.noExtend });
      st.busy = false; st.selected = { kind:'rec', id: rec.id }; st.form = { to:'', amount:'' };
      setView('detail');
      client.track(rec).then(() => { loadBalances(); loadHistory(); });
    } catch (e) {
      st.busy = false;
      st.progressErr = errText(e);
      /* si TronLink renvoie une transaction différente de la version à validité allongée, le prochain essai utilise la transaction standard du nœud (60 s) */
      if (e && e.code === 'SIGNED_TX_MISMATCH' && !st.noExtend){ st.noExtend = true; st.progressErr += ' ' + t('chain.retryStd'); }
      paintView();
    }
  }
  async function checkNow(){
    if (!st.selected || st.selected.kind !== 'rec') return;
    const r = client.records().find(x => x.id === st.selected.id); if (!r) return;
    try { await client.refreshRecord(r); } catch (e) { toast(errText(e), 'error'); }
    if (st.view === 'detail') paintView();
  }

  function onClick(ev){
    const el = ev.target.closest('[data-chain]'); if (!el || !root.contains(el)) return;
    const a = el.getAttribute('data-chain');
    if (a === 'back'){ if (st.view !== 'main' && !st.busy) { setView('main'); } else if (!st.busy) R.back(); return; }
    if (!client) return;
    if (a === 'connect') connect();
    else if (a === 'recheck'){ paint('conn'); }
    else if (a === 'disconnect'){ client.wallet.disconnect(); st.bal = null; st.history = []; paintMain(); }
    else if (a === 'copylink'){ try { navigator.clipboard.writeText(location.href.split('#')[0]).then(() => toast(t('action.copy')), () => {}); } catch (e) {} }
    else if (a === 'copy'){ try { navigator.clipboard.writeText(el.getAttribute('data-v')).then(() => toast(t('action.copy')), () => {}); } catch (e) {} }
    else if (a === 'refresh'){ loadBalances(); loadHistory(); }
    else if (a === 'paste'){ try { navigator.clipboard.readText().then(v => { const i = $('ch-to'); if (i) { i.value = Y().cleanAddressInput(v); st.form.to = i.value; } }, () => {}); } catch (e) {} }
    else if (a === 'max'){ if (st.bal){ const i = $('ch-amount'); if (i) { const txt = Y().L.formatUnits(st.bal.available, Y().CONFIG.token.decimals).replace(/\.?0+$/, ''); i.value = txt; st.form.amount = txt; } } }
    else if (a === 'review') review();
    else if (a === 'confirm') confirm();
    else if (a === 'cancel'){ if (!st.busy || st.progressErr){ st.busy = false; setView('main'); } }
    else if (a === 'open'){ st.selected = { kind: el.getAttribute('data-kind'), id: el.getAttribute('data-id') }; setView('detail'); }
    else if (a === 'check') checkNow();
    else if (a === 'clear'){ client.clearFinished(); paint('act'); }
  }
  function onInput(ev){
    if (ev.target.id === 'ch-to') st.form.to = ev.target.value;
    else if (ev.target.id === 'ch-amount') st.form.amount = ev.target.value;
    else return;
    if (st.formErr){ st.formErr = ''; const m = $('ch-form-msg'); if (m){ m.hidden = true; m.textContent = ''; } }
  }

  /* ------------------------------------------------------------------ câblage */
  function wire(rootEl){
    root = rootEl;
    ensureClient();
    if (bound !== root){
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      bound = root;
    }
    unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = [];
    if (client){
      unsubs.push(client.wallet.subscribe(() => { if (st.view === 'main'){ paint('conn'); paint('send'); } }));
      unsubs.push(client.subscribe(() => {
        if (st.view === 'main') paint('act');
        else if (st.view === 'detail') paintView();
        else if (st.view === 'progress') paintView();
      }));
      if (!started){ started = true; try { client.resumeAll(); } catch (e) {} }
    }
    R.onLeave(() => {
      unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = [];
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (st) st.keepWallet = true;
    });
    paintMain();
    if (client){
      const w = client.wallet.state();
      if (w.connected){ loadBalances(); loadHistory(); }
      else {
        /* le navigateur DApp mobile injecte parfois TronLink après le chargement de la page : on le guette quelques secondes */
        let tries = 0;
        pollTimer = setInterval(() => {
          tries++;
          if (st.view === 'main' && !client.wallet.state().connected) paint('conn');
          if (client.wallet.state().connected || client.wallet.available() || tries >= 20){ clearInterval(pollTimer); pollTimer = null; paint('conn'); }
        }, 500);
      }
    }
  }

  return { render, wire, _state: () => st };
})();

/* Écran réservé aux administrateurs (profiles.role = 'admin'). Masquage d'INTERFACE : le rôle vient du profil lu par l'app ; la sécurité des fonds
   ne repose pas dessus (la signature se fait toujours dans le TronLink de la personne). */
function canUseChain(){ try { return !!(Runtime && Runtime.ctx && Runtime.ctx.role === 'admin'); } catch (e) { return false; } }
function renderChain(){ return canUseChain() ? ChainUI.render() : ''; }
function wireChain(rootEl){ if (canUseChain()) ChainUI.wire(rootEl); }

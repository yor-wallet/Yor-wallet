'use strict';

/* ============================================================
   NOTIFICATION ENGINE — writes under the current user only
   ============================================================ */
const NotificationEngine = (() => {
  async function add(input){
    const uid = UserContext.requireCtx().uid;
    const id = ID.notification();
    const n = { type:input.type, title:input.title, message:input.message, read:false, priority: input.priority || 'NORMAL', transactionId: input.transactionId || null, createdAt: Date.now() };
    await UserDataEngine.writeSub(uid, 'notifications', id, n);
    Runtime.notifications.unshift(Object.assign({ id }, n));
    return n;
  }
  async function markAllRead(){
    const uid = UserContext.requireCtx().uid;
    const updates = Runtime.notifications.map(n => UserDataEngine.writeSub(uid, 'notifications', n.id, { read: true }));
    Runtime.notifications = Runtime.notifications.map(n => Object.assign({}, n, { read: true }));
    await Promise.all(updates);
  }
  return { add, markAllRead };
})();

const InAppNotif = Object.freeze({
  show({ icon='bell', title, message, amount, status='default', onClick, durationMs=5000 }){
    const layer = document.getElementById('notif-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'notif-ios';
    el.setAttribute('role', 'status');
    const iconClass = status === 'success' ? 'success' : status === 'warning' ? 'warning' : '';
    el.innerHTML = '<div class="notif-ios-icon ' + iconClass + '">' + svg(icon, 18) + '</div>' +
      '<div class="notif-ios-body">' +
        '<div class="notif-ios-head"><span class="notif-ios-app">Friendly Pay</span><span class="notif-ios-time">' + t('common.now') + '</span></div>' +
        '<div class="notif-ios-title">' + escapeHtml(title) + '</div>' +
        (message ? '<div class="notif-ios-msg">' + escapeHtml(message) + '</div>' : '') +
        (amount ? '<div class="notif-ios-amt">' + escapeHtml(amount) + '</div>' : '') +
      '</div>';
    if (onClick) el.onclick = () => { InAppNotif.dismiss(el); onClick(); };
    layer.appendChild(el);
    setTimeout(() => InAppNotif.dismiss(el), durationMs);
    try { if (navigator.vibrate) navigator.vibrate(15); } catch(e){}
  },
  showCall({ title, message, sub, amount, durationMs=5000, onClick }){
    const layer = document.getElementById('notif-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'notif-call';
    el.innerHTML =
      '<div class="notif-call-head"><span class="notif-call-app">Friendly Pay</span><span class="notif-call-time">' + t('common.now') + '</span></div>' +
      '<div class="notif-call-title">' + escapeHtml(title) + '</div>' +
      (message ? '<div class="notif-call-msg">' + escapeHtml(message) + '</div>' : '') +
      (sub ? '<div class="notif-call-msg">' + escapeHtml(sub) + '</div>' : '') +
      (amount ? '<div class="notif-call-amt">' + escapeHtml(amount) + '</div>' : '') +
      '<div class="notif-call-bar"></div>';
    if (onClick) el.onclick = () => { InAppNotif.dismiss(el); onClick(); };
    layer.appendChild(el);
    try { if (navigator.vibrate) navigator.vibrate([30, 80, 30]); } catch(e){}
    setTimeout(() => InAppNotif.dismiss(el), durationMs);
  },
  dismiss(el){
    if (!el || !el.parentElement) return;
    el.classList.add('dismiss');
    setTimeout(() => el.remove(), 280);
  }
});


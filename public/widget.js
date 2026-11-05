(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__MNS_WEBCHAT_LOADED__) return;
  window.__MNS_WEBCHAT_LOADED__ = true;

  var scriptEl = document.currentScript ||
    document.querySelector('script[data-channel],script[data-channel-uuid]');
  var globalCfg = window.MnsWebchatConfig || {};
  var channelUUID = (scriptEl && (scriptEl.getAttribute('data-channel') || scriptEl.getAttribute('data-channel-uuid'))) ||
    globalCfg.channelUUID || '';
  if (!channelUUID) return;

  var titleText = (scriptEl && scriptEl.getAttribute('data-title')) || globalCfg.title || 'Atendimento';
  var subtitleText = (scriptEl && scriptEl.getAttribute('data-subtitle')) || globalCfg.subtitle || 'Envie sua mensagem para nossa equipe';
  var primaryColor = (scriptEl && scriptEl.getAttribute('data-color')) || globalCfg.color || '#2563eb';
  var position = ((scriptEl && scriptEl.getAttribute('data-position')) || globalCfg.position || 'right') === 'left' ? 'left' : 'right';

  var apiBase = (scriptEl && scriptEl.getAttribute('data-api-base')) || globalCfg.apiBase || '';
  if (!apiBase && scriptEl && scriptEl.src) {
    try {
      var srcUrl = new URL(scriptEl.src, window.location.href);
      apiBase = srcUrl.origin + '/api/v1/conversations/webchat';
    } catch (_e) {
      apiBase = '/api/v1/conversations/webchat';
    }
  }
  if (!apiBase) apiBase = '/api/v1/conversations/webchat';
  apiBase = apiBase.replace(/\/+$/, '');

  var storageKey = 'mns_webchat_' + channelUUID;
  var state = {
    open: false,
    visitorToken: '',
    visitorId: '',
    conversationUUID: '',
    name: '',
    email: '',
    messages: [],
    sending: false
  };

  try {
    var saved = localStorage.getItem(storageKey);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        state.visitorToken = parsed.visitorToken || '';
        state.visitorId = parsed.visitorId || '';
        state.conversationUUID = parsed.conversationUUID || '';
        state.name = parsed.name || '';
        state.email = parsed.email || '';
      }
    }
  } catch (_e) {}

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        visitorToken: state.visitorToken,
        visitorId: state.visitorId,
        conversationUUID: state.conversationUUID,
        name: state.name,
        email: state.email
      }));
    } catch (_e) {}
  }

  var host = document.createElement('div');
  host.setAttribute('data-mns-webchat', channelUUID);
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

  var style = document.createElement('style');
  style.textContent = [
    ':host { all: initial; font-family: system-ui, -apple-system, sans-serif; }',
    '.mns-wc-root { position: fixed; bottom: 20px; ' + position + ': 20px; z-index: 2147483000; display: flex; flex-direction: column; align-items: ' + (position === 'left' ? 'flex-start' : 'flex-end') + '; }',
    '.mns-wc-launcher { width: 56px; height: 56px; border-radius: 9999px; border: none; cursor: pointer; background: ' + primaryColor + '; color: #fff; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25); display: flex; align-items: center; justify-content: center; font-size: 22px; transition: transform 0.15s ease; }',
    '.mns-wc-launcher:hover { transform: scale(1.05); }',
    '.mns-wc-panel { width: 360px; max-width: calc(100vw - 32px); height: 500px; max-height: calc(100vh - 100px); margin-bottom: 12px; border-radius: 16px; background: #ffffff; color: #0f172a; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.22); border: 1px solid #e2e8f0; display: none; flex-direction: column; overflow: hidden; }',
    '.mns-wc-panel.open { display: flex; }',
    '.mns-wc-header { background: ' + primaryColor + '; color: #ffffff; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; }',
    '.mns-wc-title { font-size: 15px; font-weight: 600; margin: 0; }',
    '.mns-wc-subtitle { font-size: 12px; opacity: 0.9; margin: 2px 0 0 0; }',
    '.mns-wc-close { background: transparent; border: none; color: #ffffff; cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: 6px; }',
    '.mns-wc-prechat { padding: 12px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 6px; }',
    '.mns-wc-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; color: #0f172a; background: #fff; }',
    '.mns-wc-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; }',
    '.mns-wc-empty { margin: auto; text-align: center; color: #64748b; font-size: 13px; padding: 16px; }',
    '.mns-wc-msg { max-width: 82%; padding: 9px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; word-break: break-word; }',
    '.mns-wc-msg.visitor { align-self: flex-end; background: ' + primaryColor + '; color: #ffffff; border-bottom-right-radius: 4px; }',
    '.mns-wc-msg.agent { align-self: flex-start; background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; border-bottom-left-radius: 4px; }',
    '.mns-wc-meta { font-size: 10px; opacity: 0.72; margin-top: 4px; }',
    '.mns-wc-composer { padding: 10px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; }',
    '.mns-wc-send { background: ' + primaryColor + '; color: #ffffff; border: none; border-radius: 8px; padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer; }',
    '.mns-wc-send:disabled { opacity: 0.5; cursor: not-allowed; }'
  ].join('\n');
  shadow.appendChild(style);

  var root = document.createElement('div');
  root.className = 'mns-wc-root';

  var panel = document.createElement('div');
  panel.className = 'mns-wc-panel';

  var header = document.createElement('div');
  header.className = 'mns-wc-header';
  var headerText = document.createElement('div');
  var hTitle = document.createElement('p');
  hTitle.className = 'mns-wc-title';
  hTitle.textContent = titleText;
  var hSub = document.createElement('p');
  hSub.className = 'mns-wc-subtitle';
  hSub.textContent = subtitleText;
  headerText.appendChild(hTitle);
  headerText.appendChild(hSub);
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mns-wc-close';
  closeBtn.setAttribute('aria-label', 'Fechar chat');
  closeBtn.textContent = '×';
  header.appendChild(headerText);
  header.appendChild(closeBtn);

  var prechat = document.createElement('div');
  prechat.className = 'mns-wc-prechat';
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'mns-wc-input';
  nameInput.placeholder = 'Seu nome (opcional)';
  nameInput.value = state.name;
  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'mns-wc-input';
  emailInput.placeholder = 'Seu e-mail (opcional)';
  emailInput.value = state.email;
  prechat.appendChild(nameInput);
  prechat.appendChild(emailInput);
  if (state.visitorToken) {
    prechat.style.display = 'none';
  }

  var messagesBox = document.createElement('div');
  messagesBox.className = 'mns-wc-messages';

  var composer = document.createElement('form');
  composer.className = 'mns-wc-composer';
  var msgInput = document.createElement('input');
  msgInput.type = 'text';
  msgInput.className = 'mns-wc-input';
  msgInput.placeholder = 'Digite sua mensagem...';
  msgInput.maxLength = 4096;
  var sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'mns-wc-send';
  sendBtn.textContent = 'Enviar';
  composer.appendChild(msgInput);
  composer.appendChild(sendBtn);

  panel.appendChild(header);
  panel.appendChild(prechat);
  panel.appendChild(messagesBox);
  panel.appendChild(composer);

  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'mns-wc-launcher';
  launcher.setAttribute('aria-label', 'Abrir chat');
  launcher.textContent = '💬';

  root.appendChild(panel);
  root.appendChild(launcher);
  shadow.appendChild(root);

  function mount() {
    if (document.body && !host.parentNode) {
      document.body.appendChild(host);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  function renderMessages() {
    while (messagesBox.firstChild) {
      messagesBox.removeChild(messagesBox.firstChild);
    }
    if (!state.messages.length) {
      var empty = document.createElement('div');
      empty.className = 'mns-wc-empty';
      empty.textContent = subtitleText;
      messagesBox.appendChild(empty);
      return;
    }
    var ordered = state.messages.slice().sort(function (a, b) {
      var ta = String(a.CnmSentAt || '');
      var tb = String(b.CnmSentAt || '');
      return ta.localeCompare(tb);
    });
    for (var i = 0; i < ordered.length; i++) {
      var m = ordered[i];
      var isVisitor = m.CnmAuthorType === 'contact' || m.CnmDirection === 'inbound';
      var bubble = document.createElement('div');
      bubble.className = 'mns-wc-msg ' + (isVisitor ? 'visitor' : 'agent');
      var bodyDiv = document.createElement('div');
      bodyDiv.textContent = String(m.CnmBody || '');
      bubble.appendChild(bodyDiv);
      if (m.AuthorName && !isVisitor) {
        var meta = document.createElement('div');
        meta.className = 'mns-wc-meta';
        meta.textContent = String(m.AuthorName);
        bubble.appendChild(meta);
      }
      messagesBox.appendChild(bubble);
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function ensureSession() {
    if (state.visitorToken) {
      return Promise.resolve(state.visitorToken);
    }
    state.name = (nameInput.value || '').trim();
    state.email = (emailInput.value || '').trim();
    return fetch(apiBase + '/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelUUID: channelUUID,
        visitorId: state.visitorId || undefined,
        name: state.name || undefined,
        email: state.email || undefined,
        origin: window.location.origin
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('session_init_failed');
        return res.json();
      })
      .then(function (payload) {
        var data = (payload && payload.data) || {};
        state.visitorToken = data.visitorToken || '';
        state.visitorId = data.visitorId || state.visitorId;
        saveState();
        prechat.style.display = 'none';
        return state.visitorToken;
      });
  }

  function pollMessages() {
    if (!state.open || !state.visitorToken || !state.conversationUUID) return;
    fetch(apiBase + '/messages?conversationUUID=' + encodeURIComponent(state.conversationUUID), {
      method: 'GET',
      headers: { 'X-Visitor-Token': state.visitorToken }
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (payload) {
        if (!payload || !payload.data || !Array.isArray(payload.data.items)) return;
        state.messages = payload.data.items;
        renderMessages();
      })
      .catch(function () {});
  }

  function toggleOpen(nextOpen) {
    state.open = typeof nextOpen === 'boolean' ? nextOpen : !state.open;
    if (state.open) {
      panel.classList.add('open');
      renderMessages();
      if (state.visitorToken && state.conversationUUID) {
        pollMessages();
      }
    } else {
      panel.classList.remove('open');
    }
  }

  launcher.addEventListener('click', function () {
    toggleOpen();
  });
  closeBtn.addEventListener('click', function () {
    toggleOpen(false);
  });

  composer.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var text = (msgInput.value || '').trim();
    if (!text || state.sending) return;
    state.sending = true;
    sendBtn.disabled = true;
    ensureSession()
      .then(function (token) {
        return fetch(apiBase + '/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Visitor-Token': token
          },
          body: JSON.stringify({ body: text })
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error('send_failed');
        return res.json();
      })
      .then(function (payload) {
        msgInput.value = '';
        var data = (payload && payload.data) || {};
        if (data.conversationUUID) {
          state.conversationUUID = data.conversationUUID;
          saveState();
        }
        pollMessages();
      })
      .catch(function () {})
      .finally(function () {
        state.sending = false;
        sendBtn.disabled = false;
      });
  });

  setInterval(pollMessages, 4000);
})();

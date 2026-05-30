import './style.css';

class ChatApp {
  constructor() {
    this.ws = null;
    this.currentUser = null;
    this.users = [];
    this.init();
  }

  init() {
    this.showAuthModal();
  }

  showAuthModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.insertAdjacentHTML('beforeend', `
      <h2>Вход в чат</h2>
      <input type="text" id="nickname" placeholder="Введите никнейм" maxlength="20" autocomplete="off">
      <button id="join-btn">Войти</button>
      <div id="modal-error" class="error"></div>
    `);
    overlay.append(modal);
    document.body.append(overlay);

    const input = modal.querySelector('#nickname');
    const joinBtn = modal.querySelector('#join-btn');
    const errorDiv = modal.querySelector('#modal-error');

    const connect = () => {
      const name = input.value.trim();
      if (!name) {
        errorDiv.textContent = 'Никнейм не может быть пустым';
        return;
      }
      this.connectWebSocket(name, errorDiv, overlay);
    };

    joinBtn.addEventListener('click', connect);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') connect();
    });
    input.focus();
  }

  connectWebSocket(name, errorDiv, overlay) {
    const backendUrl = process.env.WS_BACKEND_URL || 'ws://localhost:3000';
    this.ws = new WebSocket(backendUrl);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: 'join', name }));
    };

    this.ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      this.handleMessage(data, overlay);
    };

    this.ws.onerror = () => {
      errorDiv.textContent = 'Ошибка соединения с сервером';
    };
  }

  handleMessage(data, overlay) {
    switch (data.type) {
      case 'error':
        const errorDiv = document.querySelector('#modal-error');
        if (errorDiv) errorDiv.textContent = data.message;
        break;
      case 'join_success':
        this.currentUser = data.user;
        if (overlay) overlay.remove();
        this.renderChat();
        if (data.messages && data.messages.length) {
          data.messages.forEach(msg => this.addMessage(msg));
        }
        break;
      case 'users':
        this.users = data.users;
        this.updateUsersList();
        break;
      case 'user_joined':
        this.addSystemMessage(`Пользователь ${data.user.name} присоединился`);
        this.users.push(data.user);
        this.updateUsersList();
        break;
      case 'user_left':
        this.addSystemMessage(`Пользователь ${data.user.name} покинул чат`);
        this.users = this.users.filter(u => u.id !== data.user.id);
        this.updateUsersList();
        break;
      case 'message':
        this.addMessage(data);
        break;
    }
  }

  renderChat() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'chat-container';
    container.insertAdjacentHTML('beforeend', `
      <div class="sidebar">
        <div class="sidebar-header">Участники</div>
        <div class="users-list" id="users-list"></div>
        <button id="logout-btn" class="logout-button">Выйти из чата</button>
      </div>
      <div class="chat-main">
        <div class="messages-area" id="messages-area"></div>
        <div class="input-area">
          <input type="text" id="message-input" placeholder="Введите сообщение..." autocomplete="off">
          <button id="send-btn">Отправить</button>
        </div>
      </div>
    `);
    app.append(container);
    this.updateUsersList();

    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const sendMessage = () => {
      const text = input.value.trim();
      if (!text) return;
      this.ws.send(JSON.stringify({ type: 'send', message: text }));
      input.value = '';
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    logoutBtn.addEventListener('click', () => this.logout());
  }

  logout() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.currentUser = null;
    this.users = [];
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) chatContainer.remove();
    this.showAuthModal();
  }

  updateUsersList() {
    const usersListEl = document.getElementById('users-list');
    if (!usersListEl) return;
    usersListEl.innerHTML = '';
    this.users.forEach(user => {
      const userDiv = document.createElement('div');
      userDiv.className = 'user-item';
      if (this.currentUser && user.id === this.currentUser.id) {
        userDiv.classList.add('current-user');
      }
      const statusSpan = document.createElement('span');
      statusSpan.className = 'user-status';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = user.name;
      userDiv.append(statusSpan, nameSpan);
      usersListEl.append(userDiv);
    });
  }

  addMessage(msg) {
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea) return;
    const isOwn = this.currentUser && msg.user.id === this.currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'message-self' : 'message-other'}`;
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'message-name';
    nameSpan.textContent = isOwn ? 'You' : msg.user.name;
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = msg.message;
    headerDiv.append(nameSpan, timeSpan);
    messageDiv.append(headerDiv, textDiv);
    messagesArea.append(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  addSystemMessage(text) {
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea) return;
    const sysDiv = document.createElement('div');
    sysDiv.className = 'system-message';
    sysDiv.textContent = text;
    messagesArea.append(sysDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
}

new ChatApp();
/* ========================================== */
/* PRICONNECTE MESSENGER - FRONTEND           */
/* ========================================== */

let currentUser = null;
let currentChat = null;
let socket = null;
let chats = [];
let isDarkTheme = false;
let typingTimeout = null;

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('%c🚀 Priconnecte Messenger', 'background: #3390ec; color: white; font-size: 16px; padding: 8px;');
    
    loadTheme();
    initializeSocket();
    checkOrCreateUser();
    setupInputHandlers();
    generateTestData();
});

// ==========================================
// SOCKET.IO
// ==========================================
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => console.log('✅ Подключено:', socket.id));
    
    socket.on('auth_success', (data) => {
        currentUser = data.user;
        updateProfileUI();
        console.log('✅ Авторизован:', currentUser.name);
    });
    
    socket.on('auth_error', (data) => {
        showNotification(data.error, 'error');
    });
    
    socket.on('new_message', (data) => handleNewMessage(data));
    socket.on('user_typing', (data) => showTypingIndicator(data));
    socket.on('messages_read', (data) => updateMessageStatus(data));
    socket.on('user_status', (data) => updateUserStatus(data));
    
    socket.on('disconnect', () => showNotification('Потеряно соединение', 'error'));
}

// ==========================================
// АВТО-СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
// ==========================================
async function checkOrCreateUser() {
    let userData = localStorage.getItem('priconnecte_user');
    
    if (userData) {
        currentUser = JSON.parse(userData);
        socket.emit('auth', { userId: currentUser.id });
        initApp();
    } else {
        await createUser();
    }
}

async function createUser() {
    const guestName = 'Гость ' + Math.floor(Math.random() * 1000);
    
    try {
        const response = await fetch('/api/user/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: guestName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('priconnecte_user', JSON.stringify(currentUser));
            
            socket.emit('auth', { userId: currentUser.id });
            initApp();
            
            showNotification('Добро пожаловать в Priconnecte!', 'success');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка подключения', 'error');
    }
}

function initApp() {
    renderChatList();
    if (chats.length > 0) selectChat(chats[0].id);
}

// ==========================================
// ЧАТЫ И СООБЩЕНИЯ
// ==========================================
function generateTestData() {
    chats = [
        {
            id: 1,
            name: 'Павел Дуров',
            avatar: 'П',
            lastMessage: 'Добро пожаловать в Priconnecte!',
            time: '14:20',
            unread: 1,
            online: true,
            color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
            id: 2,
            name: 'Команда разработки',
            avatar: 'К',
            lastMessage: 'Мессенджер работает без регистрации!',
            time: '10:05',
            unread: 0,
            online: false,
            color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        },
        {
            id: 3,
            name: 'Избранное',
            avatar: '★',
            lastMessage: 'Сохранённые сообщения',
            time: 'Вчера',
            unread: 0,
            online: false,
            color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        }
    ];
}

function renderChatList() {
    const container = document.getElementById('chat-list-container');
    container.innerHTML = '';
    
    chats.forEach(chat => {
        const el = document.createElement('div');
        el.className = 'chat-item';
        el.dataset.chatId = chat.id;
        el.onclick = () => selectChat(chat.id);
        
        el.innerHTML = `
            <div class="avatar" style="background: ${chat.color}">${chat.avatar}
                ${chat.online ? '<span class="status-dot online"></span>' : ''}
            </div>
            <div class="chat-info">
                <div class="chat-top">
                    <h4>${escapeHtml(chat.name)}</h4>
                    <span class="time">${chat.time}</span>
                </div>
                <div class="chat-bottom">
                    <p class="last-message">${escapeHtml(chat.lastMessage)}</p>
                    ${chat.unread > 0 ? `<span class="badge">${chat.unread}</span>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(el);
    });
}

function selectChat(chatId) {
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    const selected = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (selected) selected.classList.add('active');
    
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        currentChat = chat;
        document.getElementById('current-chat-name').textContent = chat.name;
        document.getElementById('current-chat-initial').textContent = chat.avatar;
        document.getElementById('current-chat-avatar').style.background = chat.color;
        document.getElementById('current-chat-status').textContent = chat.online ? 'в сети' : 'был(а) недавно';
        
        document.getElementById('info-panel-name').textContent = chat.name;
        document.getElementById('info-panel-initial').textContent = chat.avatar;
        
        loadMessages(chatId);
        chat.unread = 0;
        renderChatList();
    }
}

function loadMessages(chatId) {
    const container = document.getElementById('messages-box');
    container.innerHTML = '<div class="message date-divider">Сегодня</div>';
    
    const testMessages = [
        { text: 'Привет! Это Priconnecte!', type: 'in', time: '14:15' },
        { text: 'Работает без регистрации!', type: 'out', time: '14:16', read: true },
        { text: 'Быстро и удобно 👍', type: 'in', time: '14:18' }
    ];
    
    testMessages.forEach(msg => addMessageToDOM(msg.text, msg.type, msg.time, msg.read));
    scrollToBottom();
}

function handleNewMessage(data) {
    const { chatId, message } = data;
    
    if (currentChat && chatId === currentChat.id) {
        const isOut = message.sender.id === currentUser.id;
        addMessageToDOM(message.text, isOut ? 'out' : 'in', formatTime(message.timestamp), isOut);
        if (!isOut) socket.emit('mark_read', { chatId, messageIds: [message.id] });
    } else {
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.lastMessage = message.text;
            chat.time = formatTime(message.timestamp);
            if (message.sender.id !== currentUser.id) chat.unread++;
            renderChatList();
        }
    }
    scrollToBottom();
}

function addMessageToDOM(text, type, time, read = false) {
    const container = document.getElementById('messages-box');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `${escapeHtml(text)}<span class="message-meta">${time}${type === 'out' ? (read ? ' <i class="fas fa-check-double"></i>' : ' <i class="fas fa-check"></i>') : ''}</span>`;
    container.appendChild(div);
    scrollToBottom();
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !currentChat) return;
    
    socket.emit('send_message', { chatId: currentChat.id, text, type: 'text' });
    input.value = '';
    toggleSendButton();
    socket.emit('typing', { chatId: currentChat.id, isTyping: false });
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function handleTyping() {
    if (!currentChat) return;
    socket.emit('typing', { chatId: currentChat.id, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('typing', { chatId: currentChat.id, isTyping: false }), 2000);
}

function toggleSendButton() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('send-mic-toggle');
    
    if (input.value.trim()) {
        sendBtn.classList.remove('hidden');
        micBtn.classList.add('hidden');
    } else {
        sendBtn.classList.add('hidden');
        micBtn.classList.remove('hidden');
    }
}

function scrollToBottom() {
    const container = document.getElementById('messages-box');
    container.scrollTop = container.scrollHeight;
}

function setupInputHandlers() {
    const input = document.getElementById('message-input');
    if (input) {
        input.addEventListener('input', () => { toggleSendButton(); handleTyping(); });
        input.addEventListener('keypress', handleEnter);
    }
    
    const search = document.getElementById('chat-search');
    if (search) {
        search.addEventListener('input', function() {
            const q = this.value.toLowerCase();
            document.querySelectorAll('.chat-item').forEach(item => {
                const name = item.querySelector('h4').textContent.toLowerCase();
                const msg = item.querySelector('.last-message').textContent.toLowerCase();
                item.style.display = (name.includes(q) || msg.includes(q)) ? 'flex' : 'none';
            });
        });
    }
}

// ==========================================
// ИНТЕРФЕЙС
// ==========================================
function toggleMenu() {
    document.getElementById('sidebar-menu').classList.toggle('hidden');
}

function toggleInfoPanel() {
    document.getElementById('info-panel').classList.toggle('hidden');
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('sidebar-menu').classList.add('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function openSavedMessages() {
    showNotification('Избранное', 'info');
}

function createGroup() {
    const name = document.getElementById('group-name-input').value;
    if (name) {
        showNotification(`Группа "${name}" создана`, 'success');
        closeModal('create-group-modal');
    }
}

function blockUser() {
    if (confirm('Заблокировать?')) showNotification('Пользователь заблокирован', 'success');
}

function toggleEmojiPicker() {
    showNotification('Эмодзи', 'info');
}

// ==========================================
// ПРОФИЛЬ
// ==========================================
function updateProfileUI() {
    if (!currentUser) return;
    
    document.getElementById('mini-username').textContent = currentUser.name;
    document.getElementById('mini-avatar-initial').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-username').value = currentUser.username;
    document.getElementById('profile-bio').value = currentUser.bio || '';
    document.getElementById('profile-avatar-initial').textContent = currentUser.name.charAt(0).toUpperCase();
}

function saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const username = document.getElementById('profile-username').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();
    
    if (!name) {
        showNotification('Введите имя', 'error');
        return;
    }
    
    currentUser.name = name;
    currentUser.username = username;
    currentUser.bio = bio;
    
    fetch(`/api/user/profile/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, bio })
    });
    
    localStorage.setItem('priconnecte_user', JSON.stringify(currentUser));
    updateProfileUI();
    closeModal('profile-modal');
    showNotification('Профиль сохранён', 'success');
}

function changeAvatar() {
    showNotification('Смена аватара', 'info');
}

// ==========================================
// ТЕМА
// ==========================================
function loadTheme() {
    if (localStorage.getItem('priconnecte_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        isDarkTheme = true;
        const sw = document.getElementById('theme-switch');
        if (sw) sw.checked = true;
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.setAttribute('data-theme', isDarkTheme ? 'dark' : '');
    localStorage.setItem('priconnecte_theme', isDarkTheme ? 'dark' : 'light');
    const sw = document.getElementById('theme-switch');
    if (sw) sw.checked = isDarkTheme;
    showNotification(isDarkTheme ? 'Тёмная тема' : 'Светлая тема', 'success');
}

// ==========================================
// ДАННЫЕ
// ==========================================
function clearData() {
    if (confirm('Очистить все данные и начать заново?')) {
        localStorage.removeItem('priconnecte_user');
        location.reload();
    }
}

function confirmClearData() {
    if (confirm('Это удалит все данные безвозвратно!')) {
        fetch(`/api/user/data/${currentUser.id}`, { method: 'DELETE' });
        localStorage.removeItem('priconnecte_user');
        location.reload();
    }
}

function exportData() {
    const data = {
        user: currentUser,
        chats: chats,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'priconnecte-data.json';
    a.click();
    showNotification('Данные экспортированы', 'success');
}

// ==========================================
// БЕЗОПАСНОСТЬ (passwords.html)
// ==========================================
function toggleLocalPassword() {
    const form = document.getElementById('local-password-form');
    const btn = document.getElementById('local-pass-btn');
    if (form) {
        form.classList.toggle('hidden');
        btn.innerHTML = form.classList.contains('hidden') ? 
            '<i class="fas fa-plus"></i> Включить' : 
            '<i class="fas fa-minus"></i> Отмена';
    }
}

function cancelLocalPassword() {
    document.getElementById('local-password-form').classList.add('hidden');
    document.getElementById('local-pass-btn').innerHTML = '<i class="fas fa-plus"></i> Включить';
}

function saveLocalPassword() {
    const pass = document.getElementById('local-password').value;
    const confirm = document.getElementById('local-password-confirm').value;
    
    if (pass.length < 4) {
        showNotification('Минимум 4 символа', 'error');
        return;
    }
    if (pass !== confirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    localStorage.setItem('priconnecte_local_pass', pass);
    cancelLocalPassword();
    showNotification('Пароль установлен', 'success');
}

function savePrivacySettings() {
    const privacy = {
        online: document.getElementById('privacy-online').value,
        photo: document.getElementById('privacy-photo').value,
        lastSeen: document.getElementById('privacy-lastseen').value
    };
    
    fetch(`/api/user/profile/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy })
    });
    
    showNotification('Настройки сохранены', 'success');
}

// ==========================================
// УТИЛИТЫ
// ==========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    
    notification.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showTypingIndicator(data) {
    if (data.chatId !== currentChat?.id) return;
    const indicator = document.getElementById('typing-indicator');
    const text = indicator.querySelector('.typing-text');
    
    if (data.isTyping) {
        text.textContent = `${data.username} печатает...`;
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function updateMessageStatus(data) {
    data.messageIds.forEach(id => {
        const el = document.querySelector(`[data-message-id="${id}"]`);
        if (el) {
            const meta = el.querySelector('.message-meta');
            if (meta) meta.innerHTML = meta.innerHTML.replace('fa-check', 'fa-check-double');
        }
    });
}

function updateUserStatus(data) {
    const item = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (item) {
        const dot = item.querySelector('.status-dot');
        if (dot) dot.classList.toggle('online', data.status === 'online');
    }
}

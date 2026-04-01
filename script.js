/* ========================================== */
/* PRICONNECTE MESSENGER - FRONTEND LOGIC     */
/* ========================================== */

// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let currentUser = null;
let currentChat = null;
let currentSessionId = null;
let socket = null;
let messages = [];
let chats = [];
let isDarkTheme = false;
let is2FAEnabled = false;
let typingTimeout = null;

// ==========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('%c🚀 Priconnecte Messenger', 'background: #3390ec; color: white; font-size: 16px; padding: 8px;');
    console.log('%cВерсия: 1.0.0', 'color: #707579; font-size: 12px;');
    
    loadTheme();
    checkExistingSession();
    setupInputHandlers();
    generateTestData();
    initializeSocket();
});

// ==========================================
// SOCKET.IO CONNECTION
// ==========================================
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ Подключено к серверу:', socket.id);
    });
    
    socket.on('auth_success', (data) => {
        console.log('✅ Авторизация успешна:', data.user.name);
        currentUser = data.user;
        updateProfileUI();
    });
    
    socket.on('auth_error', (data) => {
        console.error('❌ Ошибка авторизации:', data.error);
        showNotification(data.error, 'error');
    });
    
    socket.on('new_message', (data) => {
        console.log('📥 Новое сообщение:', data);
        handleNewMessage(data);
    });
    
    socket.on('user_typing', (data) => {
        showTypingIndicator(data);
    });
    
    socket.on('messages_read', (data) => {
        updateMessageStatus(data);
    });
    
    socket.on('user_status', (data) => {
        updateUserStatus(data);
    });
    
    socket.on('user_deleted', (data) => {
        if (currentUser && currentUser.id === data.userId) {
            logout();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Отключено от сервера');
        showNotification('Потеряно соединение с сервером', 'error');
    });
    
    socket.on('connect_error', (error) => {
        console.error('Ошибка подключения:', error);
        showNotification('Ошибка подключения к серверу', 'error');
    });
}

// ==========================================
// УПРАВЛЕНИЕ ФОРМАМИ ВХОДА/РЕГИСТРАЦИИ
// ==========================================
function showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('recover-form').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('recover-form').classList.add('hidden');
}

function showRecoverForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('recover-form').classList.remove('hidden');
}

// ==========================================
// РЕГИСТРАЦИЯ
// ==========================================
async function register() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    const termsAgree = document.getElementById('terms-agree').checked;
    
    // Валидация
    if (!name) {
        showNotification('Введите ваше имя', 'error');
        return;
    }
    
    if (!email || !isValidEmail(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    
    if (password !== confirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    if (!termsAgree) {
        showNotification('Примите условия использования', 'error');
        return;
    }
    
    // Показываем лоадер
    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.btn-loader').classList.remove('hidden');
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Регистрация успешна! Теперь войдите', 'success');
            showLoginForm();
            
            // Автозаполнение полей
            document.getElementById('login-email').value = email;
            document.getElementById('login-password').value = password;
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').classList.remove('hidden');
        btn.querySelector('.btn-loader').classList.add('hidden');
    }
}

// ==========================================
// ВХОД
// ==========================================
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showNotification('Введите email и пароль', 'error');
        return;
    }
    
    // Показываем лоадер
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.btn-loader').classList.remove('hidden');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentSessionId = data.sessionId;
            currentUser = data.user;
            
            localStorage.setItem('priconnecte_user', JSON.stringify({
                ...data.user,
                sessionId: data.sessionId
            }));
            
            socket.emit('auth', {
                userId: currentUser.id,
                sessionId: currentSessionId
            });
            
            showMainApp();
            showNotification('Добро пожаловать, ' + currentUser.name + '!', 'success');
        } else {
            showNotification(data.error || 'Ошибка входа', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').classList.remove('hidden');
        btn.querySelector('.btn-loader').classList.add('hidden');
    }
}

// ==========================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// ==========================================
async function recoverPassword() {
    const email = document.getElementById('recover-email').value.trim();
    
    if (!email || !isValidEmail(email)) {
        showNotification('Введите корректный email', 'error');
        return;
    }
    
    const btn = document.getElementById('recover-btn');
    btn.disabled = true;
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.btn-loader').classList.remove('hidden');
    
    try {
        const response = await fetch('/api/auth/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            console.log('Debug token:', data.debugToken);
        } else {
            showNotification(data.error || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').classList.remove('hidden');
        btn.querySelector('.btn-loader').classList.add('hidden');
    }
}

// ==========================================
// ПРОВЕРКА СУЩЕСТВУЮЩЕЙ СЕССИИ
// ==========================================
function checkExistingSession() {
    const savedUser = localStorage.getItem('priconnecte_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        currentUser = user;
        currentSessionId = user.sessionId;
        
        socket.emit('auth', {
            userId: currentUser.id,
            sessionId: currentSessionId
        });
        
        showMainApp();
    }
}

function showMainApp() {
    document.getElementById('auth-screen').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('main-app').style.display = 'flex';
        
        renderChatList();
        
        if (chats.length > 0) {
            selectChat(chats[0].id);
        }
    }, 500);
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: currentSessionId })
        }).catch(err => console.error(err));
        
        localStorage.removeItem('priconnecte_user');
        location.reload();
    }
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function checkPasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    strengthBar.className = 'strength-bar';
    
    if (strength <= 2) {
        strengthBar.classList.add('weak');
        strengthText.textContent = 'Слабый пароль';
        strengthText.style.color = 'var(--danger-color)';
    } else if (strength <= 4) {
        strengthBar.classList.add('medium');
        strengthText.textContent = 'Средний пароль';
        strengthText.style.color = 'var(--warning-color)';
    } else {
        strengthBar.classList.add('strong');
        strengthText.textContent = 'Надёжный пароль';
        strengthText.style.color = 'var(--success-color)';
    }
}

// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==========================================
// ОСТАЛЬНЫЕ ФУНКЦИИ (чаты, сообщения, настройки)
// ==========================================
// ... (остальной код из предыдущей версии script.js остается без изменений)
// Просто добавьте функции для смены пароля, 2FA и т.д. из предыдущей версии

function loadTheme() {
    const savedTheme = localStorage.getItem('priconnecte_theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        isDarkTheme = true;
        const themeSwitch = document.getElementById('theme-switch');
        if (themeSwitch) themeSwitch.checked = true;
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    
    if (isDarkTheme) {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('priconnecte_theme', 'dark');
    } else {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('priconnecte_theme', 'light');
    }
    
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
        themeSwitch.checked = isDarkTheme;
    }
    
    showNotification(isDarkTheme ? 'Тёмная тема включена' : 'Светлая тема включена', 'success');
}

function updateProfileUI() {
    if (!currentUser) return;
    
    const settingsUsername = document.getElementById('settings-username');
    const settingsEmail = document.getElementById('settings-email');
    const settingsAvatar = document.getElementById('settings-avatar');
    
    if (settingsUsername) settingsUsername.textContent = currentUser.name;
    if (settingsEmail) settingsEmail.textContent = currentUser.email;
    if (settingsAvatar) settingsAvatar.querySelector('span').textContent = currentUser.name.charAt(0).toUpperCase();
}

function generateTestData() {
    chats = [
        {
            id: 1,
            name: 'Павел Дуров',
            avatar: 'П',
            lastMessage: 'Как тебе новый дизайн Priconnecte?',
            time: '14:20',
            unread: 2,
            online: true,
            color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
            id: 2,
            name: 'Команда разработки',
            avatar: 'К',
            lastMessage: 'Сервер перегружен, чиним...',
            time: '10:05',
            unread: 0,
            online: false,
            color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        }
    ];
}

function renderChatList() {
    const container = document.getElementById('chat-list-container');
    container.innerHTML = '';
    
    chats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        chatElement.dataset.chatId = chat.id;
        chatElement.onclick = () => selectChat(chat.id);
        
        chatElement.innerHTML = `
            <div class="avatar" style="background: ${chat.color}">
                ${chat.avatar}
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
        
        container.appendChild(chatElement);
    });
}

function selectChat(chatId) {
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedChat = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (selectedChat) {
        selectedChat.classList.add('active');
    }
    
    const chatData = chats.find(c => c.id === chatId);
    if (chatData) {
        currentChat = chatData;
        
        document.getElementById('current-chat-name').textContent = chatData.name;
        document.getElementById('current-chat-initial').textContent = chatData.avatar;
        document.getElementById('current-chat-avatar').style.background = chatData.color;
        
        const statusText = chatData.online ? 'в сети' : 'был(а) недавно';
        document.getElementById('current-chat-status').textContent = statusText;
        
        document.getElementById('info-panel-name').textContent = chatData.name;
        document.getElementById('info-panel-initial').textContent = chatData.avatar;
        
        loadMessages(chatId);
        
        chatData.unread = 0;
        renderChatList();
    }
}

function loadMessages(chatId) {
    const container = document.getElementById('messages-box');
    container.innerHTML = '<div class="message date-divider">Сегодня</div>';
    
    const testMessages = [
        { text: 'Привет! Как дела?', type: 'in', time: '14:15' },
        { text: 'Привет! Всё отлично', type: 'out', time: '14:16', read: true }
    ];
    
    testMessages.forEach(msg => {
        addMessageToDOM(msg.text, msg.type, msg.time, msg.read);
    });
    
    scrollToBottom();
}

function handleNewMessage(data) {
    const { chatId, message } = data;
    
    if (currentChat && chatId === currentChat.id) {
        const isOut = message.sender.id === currentUser.id;
        addMessageToDOM(message.text, isOut ? 'out' : 'in', message.time, isOut);
        
        if (!isOut) {
            socket.emit('mark_read', {
                chatId,
                messageIds: [message.id]
            });
        }
    } else {
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            chat.lastMessage = message.text;
            chat.time = message.time;
            if (message.sender.id !== currentUser.id) {
                chat.unread++;
            }
            renderChatList();
        }
    }
    
    scrollToBottom();
}

function addMessageToDOM(text, type, time, read = false) {
    const container = document.getElementById('messages-box');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const readIcon = read ? 
        '<i class="fas fa-check-double message-read"></i>' : 
        '<i class="fas fa-check message-read"></i>';
    
    messageDiv.innerHTML = `
        ${escapeHtml(text)}
        <span class="message-meta">
            ${time}
            ${type === 'out' ? readIcon : ''}
        </span>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text || !currentChat) return;
    
    socket.emit('send_message', {
        chatId: currentChat.id,
        text: text,
        type: 'text'
    });
    
    input.value = '';
    toggleSendButton();
    
    socket.emit('typing', {
        chatId: currentChat.id,
        isTyping: false
    });
}

function handleEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function handleTyping() {
    if (!currentChat) return;
    
    socket.emit('typing', {
        chatId: currentChat.id,
        isTyping: true
    });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', {
            chatId: currentChat.id,
            isTyping: false
        });
    }, 2000);
}

function toggleSendButton() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('send-mic-toggle');
    
    if (input.value.trim().length > 0) {
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
        input.addEventListener('input', () => {
            toggleSendButton();
            handleTyping();
        });
        input.addEventListener('keypress', handleEnter);
    }
    
    const searchInput = document.getElementById('chat-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            const chatItems = document.querySelectorAll('.chat-item');
            
            chatItems.forEach(item => {
                const name = item.querySelector('h4').textContent.toLowerCase();
                const message = item.querySelector('.last-message').textContent.toLowerCase();
                
                if (name.includes(query) || message.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}

function toggleMenu() {
    const menu = document.getElementById('sidebar-menu');
    menu.classList.toggle('hidden');
}

function toggleInfoPanel() {
    const panel = document.getElementById('info-panel');
    panel.classList.toggle('hidden');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById('sidebar-menu').classList.add('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function openSavedMessages() {
    showNotification('Избранное открывается...', 'info');
    closeModal('sidebar-menu');
}

function editProfile() {
    showNotification('Редактирование профиля', 'info');
}

function copyToClipboard() {
    const email = document.getElementById('info-panel-email').textContent;
    navigator.clipboard.writeText(email).then(() => {
        showNotification('Email скопирован', 'success');
    });
}

function blockUser() {
    if (confirm('Заблокировать этого пользователя?')) {
        showNotification('Пользователь заблокирован', 'success');
    }
}

function toggleEmojiPicker() {
    showNotification('Эмодзи панель', 'info');
}

function createGroup() {
    const name = document.getElementById('group-name-input').value;
    if (name) {
        showNotification(`Группа "${name}" создана`, 'success');
        closeModal('create-group-modal');
    } else {
        showNotification('Введите название группы', 'error');
    }
}

// ==========================================
// ФУНКЦИИ ДЛЯ PASSWORDS.HTML
// ==========================================
function toggleChangePassword() {
    const form = document.getElementById('change-password-form');
    if (form) {
        form.classList.toggle('hidden');
    }
}

function cancelChangePassword() {
    const form = document.getElementById('change-password-form');
    if (form) {
        form.classList.add('hidden');
    }
}

async function saveNewPassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword.length < 6) {
        showNotification('Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                sessionId: currentSessionId,
                currentPassword,
                newPassword
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Пароль успешно изменён', 'success');
            cancelChangePassword();
        } else {
            showNotification(data.error || 'Ошибка смены пароля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

function toggle2FASetup() {
    const form = document.getElementById('2fa-setup-form');
    const btn = document.getElementById('2fa-toggle-btn');
    
    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        btn.innerHTML = '<i class="fas fa-minus"></i> Отмена';
    } else {
        form.classList.add('hidden');
        btn.innerHTML = '<i class="fas fa-plus"></i> Включить';
    }
}

function cancel2FA() {
    document.getElementById('2fa-setup-form').classList.add('hidden');
    document.getElementById('2fa-toggle-btn').innerHTML = '<i class="fas fa-plus"></i> Включить';
}

async function save2FA() {
    const password = document.getElementById('2fa-password').value;
    const confirm = document.getElementById('2fa-confirm').value;
    const hint = document.getElementById('2fa-hint').value;
    const email = document.getElementById('2fa-email').value;
    
    if (password.length < 6) {
        showNotification('Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    
    if (password !== confirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/user/2fa/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                password,
                hint,
                email
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            is2FAEnabled = true;
            document.getElementById('2fa-setup-form').classList.add('hidden');
            document.getElementById('2fa-toggle-btn').innerHTML = '<i class="fas fa-check"></i> Включено';
            document.getElementById('2fa-toggle-btn').disabled = true;
            showNotification('Двухэтапная аутентификация включена', 'success');
        } else {
            showNotification(data.error || 'Ошибка включения 2FA', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

async function terminateSession(button) {
    if (confirm('Завершить этот сеанс?')) {
        const sessionItem = button.closest('.session-item');
        const sessionId = sessionItem.dataset.sessionId;
        
        try {
            await fetch(`/api/user/session/${sessionId}`, {
                method: 'DELETE'
            });
            
            sessionItem.style.opacity = '0';
            setTimeout(() => sessionItem.remove(), 300);
            showNotification('Сеанс завершён', 'success');
        } catch (error) {
            showNotification('Ошибка завершения сеанса', 'error');
        }
    }
}

async function terminateAllSessions() {
    if (confirm('Завершить все сеансы кроме текущего?')) {
        const sessions = document.querySelectorAll('.session-item:not(.current)');
        
        for (const session of sessions) {
            const sessionId = session.dataset.sessionId;
            try {
                await fetch(`/api/user/session/${sessionId}`, {
                    method: 'DELETE'
                });
                session.style.opacity = '0';
                setTimeout(() => session.remove(), 300);
            } catch (error) {
                console.error('Ошибка:', error);
            }
        }
        
        showNotification('Все сеансы завершены', 'success');
    }
}

function confirmDeleteAccount() {
    openModal('delete-confirm-modal');
}

async function deleteAccount() {
    const password = document.getElementById('delete-confirm-password').value;
    
    if (!password) {
        showNotification('Введите пароль', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/user/account/${currentUser.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (response.ok) {
            showNotification('Аккаунт удалён', 'success');
            setTimeout(() => {
                logout();
            }, 1000);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка удаления аккаунта', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

async function savePrivacySettings() {
    const privacy = {
        email: document.getElementById('privacy-email').value,
        profilePhoto: document.getElementById('privacy-photo').value,
        lastSeen: document.getElementById('privacy-lastseen').value,
        forwardMessages: document.getElementById('privacy-forward').value
    };
    
    try {
        const response = await fetch(`/api/user/profile/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ privacy })
        });
        
        if (response.ok) {
            showNotification('Настройки приватности сохранены', 'success');
        } else {
            showNotification('Ошибка сохранения', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

function viewLoginHistory() {
    showNotification('История входов загружается...', 'info');
}

function exportData() {
    showNotification('Подготовка экспорта данных...', 'info');
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
        const messageElement = document.querySelector(`[data-message-id="${id}"]`);
        if (messageElement) {
            const meta = messageElement.querySelector('.message-meta');
            if (meta) {
                meta.innerHTML = meta.innerHTML.replace('fa-check', 'fa-check-double');
            }
        }
    });
}

function updateUserStatus(data) {
    const chatItem = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (chatItem) {
        const statusDot = chatItem.querySelector('.status-dot');
        if (statusDot) {
            statusDot.classList.toggle('online', data.status === 'online');
        }
    }
}

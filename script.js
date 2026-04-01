// ==========================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let currentUser = null;
let currentChat = null;
let socket = null;
let chats = [];
let contacts = [];
let messages = {};
let isDarkTheme = true;
let typingTimeout = null;
let blockedUsers = [];
let pinnedChats = [];
let mutedChats = [];
let archivedChats = [];
let folders = [];
let currentFontSize = 14;
let chatBackgrounds = [];
let notificationSettings = {
    sound: true,
    vibrate: true,
    desktop: true
};
let mediaFiles = [];
let currentMediaIndex = 0;
let isRecording = false;
let recordingTimeout = null;

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c🚀 Priconnecte Messenger', 'background: linear-gradient(135deg, #667eea, #764ba2); color: white; font-size: 16px; padding: 10px; border-radius: 8px;');
    
    loadTheme();
    loadSettings();
    initializeSocket();
    checkOrCreateUser();
    setupInputHandlers();
    generateTestData();
    loadBlockedUsers();
    loadFolders();
    renderEmojiPicker();
    requestNotificationPermission();
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
    
    socket.on('auth_error', (data) => showNotification(data.error, 'error'));
    socket.on('new_message', (data) => handleNewMessage(data));
    socket.on('user_typing', (data) => showTypingIndicator(data));
    socket.on('messages_read', (data) => updateMessageStatus(data));
    socket.on('user_status', (data) => updateUserStatus(data));
    socket.on('disconnect', () => showNotification('Потеряно соединение', 'error'));
}

// ==========================================
// ПОЛЬЗОВАТЕЛЬ
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
        showNotification('Ошибка подключения', 'error');
    }
}

function initApp() {
    renderChatList();
    renderContacts();
    renderNewChatContacts();
    if (chats.length > 0) selectChat(chats[0].id);
}

// ==========================================
// ЧАТЫ
// ==========================================
function generateTestData() {
    chats = [
        { id: 1, name: 'Павел Дуров', avatar: 'П', lastMessage: 'Добро пожаловать!', time: '14:20', unread: 1, online: true, pinned: false, muted: false, archived: false, color: 'linear-gradient(135deg, #667eea, #764ba2)' },
        { id: 2, name: 'Команда', avatar: 'К', lastMessage: 'Мессенджер работает!', time: '10:05', unread: 0, online: false, pinned: true, muted: false, archived: false, color: 'linear-gradient(135deg, #f093fb, #f5576c)' },
        { id: 3, name: 'Избранное', avatar: '★', lastMessage: 'Сохранённые сообщения', time: 'Вчера', unread: 0, online: false, pinned: false, muted: false, archived: false, color: 'linear-gradient(135deg, #fa709a, #fee140)' },
        { id: 4, name: 'Дизайн команда', avatar: 'Д', lastMessage: 'Новые макеты готовы', time: 'Пн', unread: 3, online: true, pinned: false, muted: true, archived: false, color: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
        { id: 5, name: 'Новости', avatar: 'Н', lastMessage: 'Обновление версии 1.0.0', time: 'Вс', unread: 0, online: false, pinned: false, muted: false, archived: true, color: 'linear-gradient(135deg, #a8edea, #fed6e3)' }
    ];
    
    contacts = [
        { id: 101, name: 'Алексей Иванов', avatar: 'А', online: true, color: 'linear-gradient(135deg, #667eea, #764ba2)' },
        { id: 102, name: 'Мария Петрова', avatar: 'М', online: false, color: 'linear-gradient(135deg, #f093fb, #f5576c)' },
        { id: 103, name: 'Дмитрий Сидоров', avatar: 'Д', online: true, color: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
        { id: 104, name: 'Елена Козлова', avatar: 'Е', online: false, color: 'linear-gradient(135deg, #fa709a, #fee140)' },
        { id: 105, name: 'Андрей Новиков', avatar: 'А', online: true, color: 'linear-gradient(135deg, #a8edea, #fed6e3)' }
    ];
    
    messages = {
        1: [
            { id: 1, text: 'Привет! Это Priconnecte!', type: 'in', time: '14:15', read: true },
            { id: 2, text: 'Работает без регистрации!', type: 'out', time: '14:16', read: true },
            { id: 3, text: 'Быстро и удобно 👍', type: 'in', time: '14:18', read: true }
        ],
        2: [
            { id: 1, text: 'Сервер перегружен, чиним...', type: 'in', time: '10:05', read: true }
        ],
        3: [
            { id: 1, text: 'Сохранённые сообщения', type: 'in', time: 'Вчера', read: true }
        ]
    };
}

function renderChatList(filter = 'all') {
    const container = document.getElementById('chat-list-container');
    container.innerHTML = '';
    
    let filteredChats = chats;
    
    if (filter === 'unread') {
        filteredChats = chats.filter(c => c.unread > 0);
    } else if (filter === 'archived') {
        filteredChats = chats.filter(c => c.archived);
    } else {
        filteredChats = chats.filter(c => !c.archived);
    }
    
    // Закреплённые чаты сверху
    const pinned = filteredChats.filter(c => c.pinned);
    const unpinned = filteredChats.filter(c => !c.pinned);
    const sortedChats = [...pinned, ...unpinned];
    
    sortedChats.forEach(chat => {
        const el = document.createElement('div');
        el.className = `chat-item${chat.pinned ? ' pinned' : ''}${currentChat && currentChat.id === chat.id ? ' active' : ''}`;
        el.dataset.chatId = chat.id;
        el.onclick = () => selectChat(chat.id);
        el.oncontextmenu = (e) => {
            e.preventDefault();
            showChatContextMenu(e, chat);
        };
        
        el.innerHTML = `
            <div class="avatar-gradient" style="background: ${chat.color}">${chat.avatar}
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
                    ${chat.muted ? '<i class="fas fa-bell-slash" style="color: var(--text-hint); margin-left: 8px;"></i>' : ''}
                </div>
            </div>
        `;
        
        container.appendChild(el);
    });
}

function filterChats(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    renderChatList(tab);
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
        document.getElementById('current-chat-status').innerHTML = chat.online ? 
            '<i class="fas fa-circle online-dot"></i> в сети' : 'был(а) недавно';
        
        document.getElementById('info-panel-name').textContent = chat.name;
        document.getElementById('info-panel-initial').textContent = chat.avatar;
        document.getElementById('info-panel-status').innerHTML = chat.online ?
            '<i class="fas fa-circle online-dot"></i> в сети' : 'был(а) недавно';
        document.getElementById('info-panel-username').textContent = chat.username || '@' + chat.name.toLowerCase();
        document.getElementById('info-panel-bio').textContent = chat.bio || 'О себе не указано';
        
        loadMessages(chatId);
        chat.unread = 0;
        renderChatList();
    }
}

function loadMessages(chatId) {
    const container = document.getElementById('messages-box');
    container.innerHTML = '<div class="message date-divider"><span>Сегодня</span></div>';
    
    const chatMessages = messages[chatId] || [];
    
    chatMessages.forEach(msg => {
        addMessageToDOM(msg.text, msg.type, msg.time, msg.read, msg.file);
    });
    
    scrollToBottom();
}

function handleNewMessage(data) {
    const { chatId, message } = data;
    
    if (currentChat && chatId === currentChat.id) {
        const isOut = message.sender.id === currentUser.id;
        addMessageToDOM(message.text, isOut ? 'out' : 'in', formatTime(message.timestamp), isOut, message.file);
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
    
    // Уведомление
    if (notificationSettings.sound) {
        playNotificationSound();
    }
    if (notificationSettings.vibrate && navigator.vibrate) {
        navigator.vibrate(200);
    }
    if (notificationSettings.desktop && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Priconnecte', {
            body: message.text,
            icon: '/logo.png'
        });
    }
}

function addMessageToDOM(text, type, time, read = false, file = null) {
    const container = document.getElementById('messages-box');
    const div = document.createElement('div');
    
    if (file && file.type === 'image') {
        div.className = `message ${type} image-message`;
        div.innerHTML = `
            <img src="${file.url}" alt="Image" onclick="viewImage('${file.url}')">
            <span class="message-meta">${time}${type === 'out' ? (read ? ' <i class="fas fa-check-double"></i>' : ' <i class="fas fa-check"></i>') : ''}</span>
        `;
    } else if (file && file.type === 'file') {
        div.className = `message ${type} file-message`;
        div.innerHTML = `
            <div class="file-icon"><i class="fas fa-file"></i></div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${file.size}</div>
            </div>
            <span class="message-meta">${time}</span>
        `;
    } else {
        div.className = `message ${type}`;
        div.innerHTML = `${escapeHtml(text)}<span class="message-meta">${time}${type === 'out' ? (read ? ' <i class="fas fa-check-double"></i>' : ' <i class="fas fa-check"></i>') : ''}</span>`;
    }
    
    container.appendChild(div);
    scrollToBottom();
    
    // Сохраняем медиа для просмотра
    if (file) {
        mediaFiles.push({ type: file.type, url: file.url, name: file.name });
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !currentChat) return;
    
    socket.emit('send_message', { chatId: currentChat.id, text, type: 'text' });
    
    // Локальное добавление
    if (!messages[currentChat.id]) messages[currentChat.id] = [];
    messages[currentChat.id].push({
        id: Date.now(),
        text: text,
        type: 'out',
        time: formatTime(Date.now()),
        read: false
    });
    
    currentChat.lastMessage = text;
    currentChat.time = formatTime(Date.now());
    
    input.value = '';
    toggleSendButton();
    socket.emit('typing', { chatId: currentChat.id, isTyping: false });
    renderChatList();
}

function handleEnter(e) {
    const enterSend = document.getElementById('enter-send-switch');
    if (e.key === 'Enter' && !e.shiftKey && enterSend?.checked) {
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
// НОВЫЙ ЧАТ
// ==========================================
function renderNewChatContacts() {
    const container = document.getElementById('new-chat-contacts');
    container.innerHTML = '';
    
    contacts.forEach(contact => {
        const el = document.createElement('div');
        el.className = 'contact-item';
        el.innerHTML = `
            <div class="avatar-gradient" style="background: ${contact.color}; width: 45px; height: 45px; font-size: 18px;">${contact.avatar}</div>
            <div class="chat-info">
                <h4>${escapeHtml(contact.name)}</h4>
                <p class="user-status">${contact.online ? '<i class="fas fa-circle online-dot"></i> онлайн' : 'офлайн'}</p>
            </div>
        `;
        el.onclick = () => selectContactForNewChat(contact.id);
        container.appendChild(el);
    });
}

function filterContactsForNewChat() {
    const query = document.getElementById('new-chat-search').value.toLowerCase();
    document.querySelectorAll('#new-chat-contacts .contact-item').forEach(item => {
        const name = item.querySelector('h4').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

let selectedContactId = null;

function selectContactForNewChat(contactId) {
    selectedContactId = contactId;
    document.querySelectorAll('#new-chat-contacts .contact-item').forEach(item => {
        item.style.background = '';
    });
    event.currentTarget.style.background = 'var(--active-color)';
    showNotification('Контакт выбран', 'success');
}

function createNewChat() {
    if (!selectedContactId) {
        showNotification('Выберите контакт', 'error');
        return;
    }
    
    const contact = contacts.find(c => c.id === selectedContactId);
    if (contact) {
        const newChat = {
            id: Date.now(),
            name: contact.name,
            avatar: contact.avatar,
            lastMessage: 'Чат создан',
            time: formatTime(Date.now()),
            unread: 0,
            online: contact.online,
            pinned: false,
            muted: false,
            archived: false,
            color: contact.color
        };
        
        chats.unshift(newChat);
        messages[newChat.id] = [];
        
        closeModal('new-chat-modal');
        renderChatList();
        selectChat(newChat.id);
        showNotification(`Чат с ${contact.name} создан`, 'success');
        selectedContactId = null;
    }
}

// ==========================================
// ЗАГРУЗКА ФОТО И ФАЙЛОВ
// ==========================================
function toggleAttachmentPanel() {
    const panel = document.getElementById('attachment-panel');
    panel.classList.toggle('hidden');
}

function closeAttachmentPanel() {
    document.getElementById('attachment-panel').classList.add('hidden');
}

function triggerPhotoUpload() {
    document.getElementById('photo-upload').click();
    closeAttachmentPanel();
}

function triggerFileUpload() {
    document.getElementById('file-upload').click();
    closeAttachmentPanel();
}

function handlePhotoUpload(event) {
    const files = event.target.files;
    if (!files.length || !currentChat) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            
            // Отправка через сокет
            socket.emit('send_message', {
                chatId: currentChat.id,
                text: 'Фото',
                type: 'image',
                file: {
                    type: 'image',
                    url: imageUrl,
                    name: file.name,
                    size: formatFileSize(file.size)
                }
            });
            
            // Локальное добавление
            if (!messages[currentChat.id]) messages[currentChat.id] = [];
            messages[currentChat.id].push({
                id: Date.now(),
                text: 'Фото',
                type: 'out',
                time: formatTime(Date.now()),
                read: false,
                file: {
                    type: 'image',
                    url: imageUrl,
                    name: file.name,
                    size: formatFileSize(file.size)
                }
            });
            
            addMessageToDOM('Фото', 'out', formatTime(Date.now()), false, {
                type: 'image',
                url: imageUrl,
                name: file.name,
                size: formatFileSize(file.size)
            });
            
            currentChat.lastMessage = '📷 Фото';
            currentChat.time = formatTime(Date.now());
            renderChatList();
        };
        reader.readAsDataURL(file);
    });
    
    event.target.value = '';
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentChat) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        socket.emit('send_message', {
            chatId: currentChat.id,
            text: file.name,
            type: 'file',
            file: {
                type: 'file',
                url: e.target.result,
                name: file.name,
                size: formatFileSize(file.size)
            }
        });
        
        if (!messages[currentChat.id]) messages[currentChat.id] = [];
        messages[currentChat.id].push({
            id: Date.now(),
            text: file.name,
            type: 'out',
            time: formatTime(Date.now()),
            read: false,
            file: {
                type: 'file',
                url: e.target.result,
                name: file.name,
                size: formatFileSize(file.size)
            }
        });
        
        addMessageToDOM(file.name, 'out', formatTime(Date.now()), false, {
            type: 'file',
            url: e.target.result,
            name: file.name,
            size: formatFileSize(file.size)
        });
        
        currentChat.lastMessage = '📎 Файл';
        currentChat.time = formatTime(Date.now());
        renderChatList();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================
// ГОЛОСОВЫЕ СООБЩЕНИЯ
// ==========================================
function startVoiceRecording() {
    showNotification('Запись голосового сообщения...', 'info');
    closeAttachmentPanel();
}

function startRecording() {
    isRecording = true;
    const micBtn = document.getElementById('send-mic-toggle');
    micBtn.style.background = 'var(--danger-gradient)';
    micBtn.style.color = 'white';
    showNotification('Запись... Отпустите для отправки', 'info');
    
    recordingTimeout = setTimeout(() => {
        if (isRecording) {
            stopRecording();
        }
    }, 60000); // Максимум 1 минута
}

function stopRecording() {
    isRecording = false;
    const micBtn = document.getElementById('send-mic-toggle');
    micBtn.style.background = '';
    micBtn.style.color = '';
    clearTimeout(recordingTimeout);
    showNotification('Голосовое сообщение отправлено', 'success');
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
    const saved = chats.find(c => c.name === 'Избранное');
    if (saved) {
        selectChat(saved.id);
    }
    showNotification('Избранное открыто', 'info');
}

function createGroup() {
    const name = document.getElementById('group-name-input').value;
    const desc = document.getElementById('group-desc-input').value;
    if (name) {
        const newChat = {
            id: Date.now(),
            name: name,
            avatar: name.charAt(0).toUpperCase(),
            lastMessage: desc || 'Группа создана',
            time: formatTime(Date.now()),
            unread: 0,
            online: false,
            pinned: false,
            muted: false,
            archived: false,
            color: 'linear-gradient(135deg, #667eea, #764ba2)',
            isGroup: true
        };
        
        chats.unshift(newChat);
        messages[newChat.id] = [];
        
        closeModal('create-group-modal');
        renderChatList();
        selectChat(newChat.id);
        showNotification(`Группа "${name}" создана`, 'success');
        
        document.getElementById('group-name-input').value = '';
        document.getElementById('group-desc-input').value = '';
    } else {
        showNotification('Введите название группы', 'error');
    }
}

function blockUser() {
    if (confirm('Заблокировать этого пользователя?')) {
        if (currentChat) {
            blockedUsers.push(currentChat.id);
            localStorage.setItem('priconnecte_blocked', JSON.stringify(blockedUsers));
            updateBlockedCount();
            showNotification('Пользователь заблокирован', 'success');
        }
    }
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
}

function renderEmojiPicker() {
    const emojis = {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'],
        animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'],
        food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🥞', '🥖', '🥐', '🥨', '🥯', '🥪', '🌮'],
        activities: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳'],
        travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵'],
        objects: ['💡', '🔦', '🏮', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '💽', '💾', '💿', '📀', '📼', '📷'],
        symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
        flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️', '🇷🇺', '🇺🇸', '🇬🇧', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇯🇵', '🇨🇳']
    };
    
    const grid = document.getElementById('emoji-grid');
    grid.innerHTML = '';
    
    emojis.smileys.forEach(emoji => {
        const el = document.createElement('span');
        el.className = 'emoji-item';
        el.textContent = emoji;
        el.onclick = () => insertEmoji(emoji);
        grid.appendChild(el);
    });
    
    // Категории
    document.querySelectorAll('.emoji-category').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.emoji-category').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.dataset.category;
            grid.innerHTML = '';
            emojis[category].forEach(emoji => {
                const el = document.createElement('span');
                el.className = 'emoji-item';
                el.textContent = emoji;
                el.onclick = () => insertEmoji(emoji);
                grid.appendChild(el);
            });
        };
    });
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    input.value += emoji;
    toggleSendButton();
}

// ==========================================
// ПРОСМОТР МЕДИА
// ==========================================
function viewImage(url) {
    openModal('media-viewer-modal');
    const content = document.getElementById('media-viewer-content');
    content.innerHTML = `<img src="${url}" alt="Image">`;
}

function viewMedia(type) {
    showNotification(`Просмотр ${type}`, 'info');
}

function showAllMedia() {
    showNotification('Все медиа', 'info');
}

function previousMedia() {
    if (currentMediaIndex > 0) {
        currentMediaIndex--;
        updateMediaViewer();
    }
}

function nextMedia() {
    if (currentMediaIndex < mediaFiles.length - 1) {
        currentMediaIndex++;
        updateMediaViewer();
    }
}

function updateMediaViewer() {
    const content = document.getElementById('media-viewer-content');
    const media = mediaFiles[currentMediaIndex];
    if (media.type === 'image') {
        content.innerHTML = `<img src="${media.url}" alt="Image">`;
    }
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
    document.getElementById('profile-email').value = currentUser.email || '';
    document.getElementById('profile-avatar-initial').textContent = currentUser.name.charAt(0).toUpperCase();
    
    if (currentUser.settings) {
        document.getElementById('theme-switch').checked = currentUser.settings.theme === 'dark';
        document.getElementById('enter-send-switch').checked = currentUser.settings.enterSend !== false;
        currentFontSize = currentUser.settings.fontSize || 14;
        document.getElementById('font-size-display').textContent = currentFontSize + 'px';
    }
}

function saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const username = document.getElementById('profile-username').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    
    if (!name) {
        showNotification('Введите имя', 'error');
        return;
    }
    
    currentUser.name = name;
    currentUser.username = username;
    currentUser.bio = bio;
    currentUser.email = email;
    
    fetch(`/api/user/profile/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, bio, email })
    });
    
    localStorage.setItem('priconnecte_user', JSON.stringify(currentUser));
    updateProfileUI();
    closeModal('profile-modal');
    showNotification('Профиль сохранён', 'success');
}

function changeAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                showNotification('Аватар обновлён', 'success');
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

// ==========================================
// ТЕМА И НАСТРОЙКИ
// ==========================================
function loadTheme() {
    const saved = localStorage.getItem('priconnecte_theme');
    if (saved === 'dark' || saved === null) {
        document.body.setAttribute('data-theme', 'dark');
        isDarkTheme = true;
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    localStorage.setItem('priconnecte_theme', isDarkTheme ? 'dark' : 'light');
    
    if (currentUser) {
        currentUser.settings.theme = isDarkTheme ? 'dark' : 'light';
        fetch(`/api/user/profile/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: currentUser.settings })
        });
    }
    
    showNotification(isDarkTheme ? 'Тёмная тема включена' : 'Светлая тема включена', 'success');
}

function loadSettings() {
    const settings = localStorage.getItem('priconnecte_settings');
    if (settings) {
        const s = JSON.parse(settings);
        notificationSettings = s.notificationSettings || notificationSettings;
        currentFontSize = s.fontSize || 14;
    }
}

function saveNotificationSettings() {
    notificationSettings = {
        sound: document.getElementById('sound-switch')?.checked || true,
        vibrate: document.getElementById('vibration-switch')?.checked || true,
        desktop: document.getElementById('desktop-notif-switch')?.checked || true
    };
    
    localStorage.setItem('priconnecte_settings', JSON.stringify({
        notificationSettings,
        fontSize: currentFontSize
    }));
    
    showNotification('Настройки уведомлений сохранены', 'success');
}

function changeChatBackground() {
    const backgrounds = [
        'var(--bg-chat)',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'url("https://example.com/bg1.jpg")'
    ];
    
    const current = localStorage.getItem('priconnecte_chat_bg') || '0';
    const next = (parseInt(current) + 1) % backgrounds.length;
    localStorage.setItem('priconnecte_chat_bg', next.toString());
    
    document.querySelector('.messages-container').style.background = backgrounds[next];
    showNotification('Фон чата изменён', 'success');
}

function changeFontSize() {
    const sizes = [12, 14, 16, 18, 20];
    const currentIndex = sizes.indexOf(currentFontSize);
    currentFontSize = sizes[(currentIndex + 1) % sizes.length];
    
    document.body.style.fontSize = currentFontSize + 'px';
    document.getElementById('font-size-display').textContent = currentFontSize + 'px';
    
    localStorage.setItem('priconnecte_settings', JSON.stringify({
        notificationSettings,
        fontSize: currentFontSize
    }));
    
    showNotification(`Размер шрифта: ${currentFontSize}px`, 'success');
}

function clearCache() {
    if (confirm('Очистить кэш приложения?')) {
        localStorage.removeItem('priconnecte_cache');
        showNotification('Кэш очищен', 'success');
    }
}

function clearData() {
    if (confirm('Это удалит ВСЕ данные безвозвратно! Продолжить?')) {
        fetch(`/api/user/data/${currentUser.id}`, { method: 'DELETE' });
        localStorage.clear();
        location.reload();
    }
}

function exportData() {
    const data = {
        user: currentUser,
        chats: chats,
        messages: messages,
        contacts: contacts,
        settings: { notificationSettings, fontSize: currentFontSize },
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `priconnecte-backup-${Date.now()}.json`;
    a.click();
    showNotification('Данные экспортированы', 'success');
}

function importData() {
    document.getElementById('import-file').click();
}

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.user) {
                localStorage.setItem('priconnecte_user', JSON.stringify(data.user));
                currentUser = data.user;
            }
            if (data.chats) chats = data.chats;
            if (data.messages) messages = data.messages;
            if (data.contacts) contacts = data.contacts;
            
            showNotification('Данные импортированы', 'success');
            location.reload();
        } catch (error) {
            showNotification('Ошибка импорта', 'error');
        }
    };
    reader.readAsText(file);
}

function savePrivacySettings() {
    const privacy = {
        online: document.getElementById('privacy-online').value,
        photo: document.getElementById('privacy-photo').value,
        lastSeen: document.getElementById('privacy-lastseen').value
    };
    
    currentUser.privacy = { ...currentUser.privacy, ...privacy };
    
    fetch(`/api/user/profile/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy })
    });
    
    localStorage.setItem('priconnecte_user', JSON.stringify(currentUser));
    closeModal('privacy-modal');
    showNotification('Настройки приватности сохранены', 'success');
}

function loadBlockedUsers() {
    const blocked = localStorage.getItem('priconnecte_blocked');
    if (blocked) {
        blockedUsers = JSON.parse(blocked);
        updateBlockedCount();
    }
}

function updateBlockedCount() {
    const count = document.getElementById('blocked-count');
    if (count) {
        count.textContent = `${blockedUsers.length} контактов`;
    }
}

function loadFolders() {
    const saved = localStorage.getItem('priconnecte_folders');
    if (saved) {
        folders = JSON.parse(saved);
    }
}

function createFolder() {
    const name = prompt('Название папки:');
    if (name) {
        folders.push({ id: Date.now(), name, chats: [] });
        localStorage.setItem('priconnecte_folders', JSON.stringify(folders));
        showNotification(`Папка "${name}" создана`, 'success');
    }
}

function addContact() {
    const name = prompt('Имя контакта:');
    if (name) {
        const contact = {
            id: Date.now(),
            name: name,
            avatar: name.charAt(0).toUpperCase(),
            online: false,
            color: 'linear-gradient(135deg, #667eea, #764ba2)'
        };
        contacts.push(contact);
        renderContacts();
        renderNewChatContacts();
        showNotification('Контакт добавлен', 'success');
    }
}

function renderContacts() {
    const container = document.getElementById('contacts-list');
    if (!container) return;
    
    container.innerHTML = '';
    contacts.forEach(contact => {
        const el = document.createElement('div');
        el.className = 'contact-item';
        el.innerHTML = `
            <div class="avatar-gradient" style="background: ${contact.color}; width: 45px; height: 45px; font-size: 18px;">${contact.avatar}</div>
            <div class="chat-info">
                <h4>${escapeHtml(contact.name)}</h4>
                <p class="user-status">${contact.online ? '<i class="fas fa-circle online-dot"></i> онлайн' : 'офлайн'}</p>
            </div>
        `;
        container.appendChild(el);
    });
}

function changeLanguage(lang) {
    showNotification(`Язык: ${lang === 'ru' ? 'Русский' : 'English'}`, 'success');
}

function checkForUpdates() {
    showNotification('Проверка обновлений...', 'info');
    setTimeout(() => {
        showNotification('Установлена последняя версия', 'success');
    }, 1500);
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbqWEyMmih0NupYTIyaKHQ26lhMjJoodDbqWEyMmih0NupYTIyaKHQ26lhMjJoodDbqWEyMmih0NupYTI=');
    audio.play().catch(() => {});
}

// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================
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
    const chatMessages = document.querySelectorAll('.message.out');
    chatMessages.forEach(msg => {
        const meta = msg.querySelector('.message-meta');
        if (meta && !meta.querySelector('.fa-check-double')) {
            meta.innerHTML = meta.innerHTML.replace('fa-check', 'fa-check-double');
        }
    });
}

function updateUserStatus(data) {
    const chatItem = document.querySelector(`[data-chat-id="${data.userId}"]`);
    if (chatItem) {
        const dot = chatItem.querySelector('.status-dot');
        if (dot) dot.classList.toggle('online', data.status === 'online');
    }
}

// ==========================================
// ФУНКЦИИ ЧАТА
// ==========================================
function showChatContextMenu(e, chat) {
    const popup = document.getElementById('chat-menu-popup');
    popup.style.top = e.clientY + 'px';
    popup.style.left = e.clientX + 'px';
    popup.classList.remove('hidden');
    
    setTimeout(() => {
        document.addEventListener('click', () => popup.classList.add('hidden'), { once: true });
    }, 100);
}

function openChatMenu() {
    const popup = document.getElementById('chat-menu-popup');
    popup.classList.toggle('hidden');
}

function pinChat() {
    if (currentChat) {
        currentChat.pinned = !currentChat.pinned;
        renderChatList();
        showNotification(currentChat.pinned ? 'Чат закреплён' : 'Чат откреплён', 'success');
    }
}

function muteChat() {
    if (currentChat) {
        currentChat.muted = !currentChat.muted;
        renderChatList();
        showNotification(currentChat.muted ? 'Чат отключён' : 'Чат включён', 'success');
    }
}

function archiveChat() {
    if (currentChat) {
        currentChat.archived = !currentChat.archived;
        renderChatList();
        showNotification(currentChat.archived ? 'Чат архивирован' : 'Чат разархивирован', 'success');
    }
}

function clearChatHistory() {
    if (confirm('Очистить историю чата?')) {
        messages[currentChat.id] = [];
        loadMessages(currentChat.id);
        showNotification('История очищена', 'success');
    }
}

function deleteChat() {
    if (confirm('Удалить этот чат?')) {
        chats = chats.filter(c => c.id !== currentChat.id);
        delete messages[currentChat.id];
        currentChat = null;
        renderChatList();
        document.getElementById('messages-box').innerHTML = '<div class="message date-divider"><span>Выберите чат</span></div>';
        showNotification('Чат удалён', 'success');
    }
}

function startCall(type) {
    showNotification(`${type === 'audio' ? 'Аудио' : 'Видео'} звонок...`, 'info');
}

function openSearchInChat() {
    showNotification('Поиск в чате', 'info');
}

function openLocationPicker() {
    showNotification('Выбор геопозиции', 'info');
    closeAttachmentPanel();
}

function openContactPicker() {
    showNotification('Выбор контакта', 'info');
    closeAttachmentPanel();
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

// Закрытие модальных окон по клику вне
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
    }
});

// Закрытие emoji picker при клике вне
document.addEventListener('click', (e) => {
    const picker = document.getElementById('emoji-picker');
    const btn = document.querySelector('.emoji-btn');
    if (picker && !picker.contains(e.target) && btn && !btn.contains(e.target)) {
        picker.classList.add('hidden');
    }
});

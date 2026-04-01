// Инициализация сокета
const socket = io();

// Элементы
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const messagesBox = document.getElementById('messages-box');
const messageInput = document.getElementById('message-input');
const profileModal = document.getElementById('profile-modal');
const profileNameDisplay = document.getElementById('profile-name-display');
const profileAvatarDisplay = document.getElementById('profile-avatar-display');

let currentUser = "";

// 1. Логика Входа
function login() {
    const input = document.getElementById('username-input');
    const username = input.value.trim();
    
    if (username) {
        // Отправляем событие на сервер
        socket.emit('login', username);
    } else {
        alert("Пожалуйста, введите имя!");
    }
}

// Обработка успешного входа от сервера
socket.on('login_success', (data) => {
    currentUser = data.username;
    
    // Обновляем профиль
    profileNameDisplay.innerText = currentUser;
    profileAvatarDisplay.innerText = currentUser.charAt(0).toUpperCase();
    profileAvatarDisplay.style.background = getRandomColor();

    // Переключаем экраны
    loginScreen.style.opacity = '0';
    setTimeout(() => {
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        mainApp.classList.remove('hidden');
    }, 500);
});

// 2. Логика Сообщений
function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        // Отправляем на сервер
        socket.emit('chat_message', { text: text });
        messageInput.value = "";
    }
}

// Слушаем входящие сообщения от сервера
socket.on('chat_message', (data) => {
    addMessageToDOM(data.text, data.user, data.time, data.id === socket.id ? 'out' : 'in');
});

// Слушаем системные сообщения (кто зашел/вышел)
socket.on('system_message', (data) => {
    const div = document.createElement('div');
    div.classList.add('message', 'system');
    div.innerText = `${data.time} - ${data.text}`;
    messagesBox.appendChild(div);
    scrollToBottom();
});

// Функция добавления сообщения в интерфейс
function addMessageToDOM(text, user, time, type) {
    const div = document.createElement('div');
    div.classList.add('message', type);
    
    let authorHtml = '';
    if (type === 'in') {
        authorHtml = `<span class="msg-author">${user}</span>`;
    }

    div.innerHTML = `
        ${authorHtml}
        ${text}
        <span class="msg-meta">${time}</span>
    `;
    
    messagesBox.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function handleEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

// 3. Логика Профиля
function toggleProfile() {
    profileModal.style.display = profileModal.style.display === 'flex' ? 'none' : 'flex';
}

function toggleTheme() {
    const body = document.body;
    const checkbox = document.getElementById('theme-toggle');
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        checkbox.checked = false;
    } else {
        body.setAttribute('data-theme', 'dark');
        checkbox.checked = true;
    }
}

function logout() {
    location.reload();
}

// Утилита для цвета аватара
function getRandomColor() {
    const colors = ['#e66465', '#9198e5', '#f6d365', '#fda085', '#84fab0', '#8fd3f4'];
    return colors[Math.floor(Math.random() * colors.length)];
}

const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Token (from vs_bot.js)
const BOT_TOKEN = '7561904266:AAFjav_tANptvTghfFr7Z-SnUJcT-dqcGb4';

// Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Serve static files
app.use(express.static(__dirname));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Telegram Bot Commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '📄 Відкрити Документообіг PRO',
                    web_app: { url: `https://yourdomain.com` } // Замініть на ваш URL
                }
            ]]
        }
    };
    
    bot.sendMessage(chatId, 
        '👋 Вітаю! Я бот для генерації документів.\n\n' +
        'Натисніть кнопку нижче, щоб відкрити веб-додаток:',
        options
    );
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        '📚 Доступні команди:\n\n' +
        '/start - Запустити бота\n' +
        '/help - Допомога\n\n' +
        'Функції:\n' +
        '• Генерація договорів (20+ типів)\n' +
        '• Створення рахунків та актів\n' +
        '• Аналітика доходів та податків\n' +
        '• Підписання документів\n' +
        '• Система підписок'
    );
});

// Handle web app data (if sent from web app)
bot.on('message', (msg) => {
    if (msg.web_app_data) {
        const data = JSON.parse(msg.web_app_data.data);
        const chatId = msg.chat.id;
        
        // Handle data from web app
        bot.sendMessage(chatId, 'Дані отримано з веб-додатку!');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Telegram bot is running`);
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

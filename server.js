const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Token (from vs_bot.js)
const BOT_TOKEN = '7561904266:AAFjav_tANptvTghfFr7Z-SnUJcT-dqcGb4';

// Initialize Telegram Bot with proper error handling
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: true,
    polling: {
        interval: 1000,
        autoStart: true,
        params: { timeout: 10, allowed_updates: ['message', 'callback_query', 'web_app_info'] }
    }
});

// Flag to prevent multiple polling instances
let isRunning = true;

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
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Telegram bot is running`);
});

// Error handling for bot polling
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        // 409 Conflict - another instance is running, retry after delay
        console.log('Bot conflict detected - another instance running. Retrying...');
        setTimeout(() => {
            try {
                bot.startPolling();
            } catch (e) {
                console.error('Error restarting polling:', e.message);
            }
        }, 5000);
    } else {
        console.error('Polling error:', error.message || error);
    }
});

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    isRunning = false;
    
    try {
        // Stop bot polling
        await bot.stopPolling();
        console.log('✓ Bot polling stopped');
    } catch (error) {
        console.error('Error stopping bot:', error.message);
    }
    
    // Close server
    server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('Forced shutdown timeout - exiting');
        process.exit(1);
    }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGHUP', gracefulShutdown);

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 10000;

// Telegram Bot Token - NEW TOKEN
const BOT_TOKEN = '8157459514:AAGpIH9kXChzVX1pV3zykYZAhg3EHuRrNfo';
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || 'https://docflow-bot.onrender.com';

// Initialize Telegram Bot with webhook (NO POLLING)
const bot = new TelegramBot(BOT_TOKEN, { 
    webHook: {
        port: PORT,
        host: '0.0.0.0'
    }
});

// Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint for Telegram
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Setup webhook on start
async function setupWebhook() {
    try {
        console.log('🤖 Setting up Telegram webhook...');
        
        // Delete old webhook
        try {
            await bot.deleteWebHook({ drop_pending_updates: true });
            console.log('✓ Old webhook deleted');
        } catch (e) {
            // Ignore if no webhook exists
        }
        
        // Wait
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set new webhook
        const webhookPath = `/bot${BOT_TOKEN}`;
        const fullWebhookUrl = `${WEBHOOK_URL}${webhookPath}`;
        await bot.setWebHook(fullWebhookUrl);
        console.log(`✓ Webhook set: ${fullWebhookUrl}`);
        console.log('✓ Bot ready!');
    } catch (error) {
        console.error('❌ Webhook error:', error.message);
        setTimeout(setupWebhook, 5000);
    }
}

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
                    web_app: { url: `https://docflow-bot.onrender.com` } // Render URL
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
    // Setup webhook after server starts
    setupWebhook();
});

// Error handling
bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error.message);
});

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    try {
        // Delete webhook
        await bot.deleteWebHook();
        console.log('✓ Webhook deleted');
    } catch (error) {
        console.error('Error cleaning up bot:', error.message);
    }
    
    // Close server
    server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('⏱️  Forced shutdown timeout - exiting');
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

const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const { Document, Packer, Paragraph, AlignmentType } = require('docx');
const stream = require('stream');
const { Readable } = require('stream');
const crypto = require('crypto');
// Merchant credentials for WayForPay
const WAYFORPAY_MERCHANT_ACCOUNT = 'docflow_bot_onrender_com';
const WAYFORPAY_SECRET_KEY = 'def425737aa57e5590a82be25a4f51bf27ac1063';

const app = express();
const PORT = process.env.PORT || 10000;

// Telegram Bot Token - NEW TOKEN
const BOT_TOKEN = '8157459514:AAGpIH9kXChzVX1pV3zykYZAhg3EHuRrNfo';
const WEBHOOK_URL = process.env.RENDER_EXTERNAL_URL || 'https://docflow-bot.onrender.com';

// Initialize Telegram Bot with webhook (NO POLLING)
const bot = new TelegramBot(BOT_TOKEN); // Без webHook параметрів, порт слухає лише Express!

// Parse JSON
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Simple DOCX generator endpoint for WebView downloads
app.get('/api/generate-docx', (req, res) => {
    res.status(400).json({ error: 'Use POST with content and filename' });
});

app.post('/api/generate-docx', async (req, res) => {
    try {
        const { content, filename } = req.body || {};
        if (!content || !filename) {
            return res.status(400).json({ error: 'content and filename are required' });
        }

        // NEW: генеруємо структуру як у прикладі
        const { Document, Packer, Paragraph, AlignmentType, TextRun } = require('docx');
        const doc = new Document({
            sections: [{
                properties: {
                    page: { margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
                },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: 'Договір', bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: 'оренди житлового приміщення', bold: true, size: 24 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 100 },
                        children: [
                            new TextRun({ text: 'м. ______________ "__" ___________ 20__ р.', size: 24 })
                        ]
                    }),
                    new Paragraph({
                        text: 'Власник житла, свідоцтво No. __________ (копія свідоцтва є додатком до даного договору), ________________ (П.І.П.), іменований надалі "Орендодавець", з одного боку, і ________________ (П.І.П.), іменований надалі "Орендар", з іншого боку, уклали даний договір про наступне:',
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { after: 200 },
                        indent: { left: 720 },
                    }),
                    new Paragraph({
                        text: '1. Предмет договору',
                        bold: true,
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 100 },
                    }),
                    new Paragraph({
                        text: '1.1. Орендодавець представляє Орендареві й членам його родини в користування строком на _____ рік квартиру загальною площею _______ кв. м. за адресою: ________________, характеристика якої наведена в акті здачі квартири.',
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { after: 100 },
                        indent: { left: 720 },
                    }),
                    new Paragraph({
                        text: '1.2. За згодою сторін договором встановлюється плата за оренду квартири в розмірі _____ (__________) гривень на місяць, до складу якої включені пропорційно орендованої площі платежі на повне відновлення будинку, витрати на обслуговування й ремонт будинку й квартири, витрати по оплаті комунальних і інших послуг.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 200 },
                    }),
                    new Paragraph({ text: '2. Обов\'язку сторін', bold: true, spacing: { after: 100 } }),
                    new Paragraph({
                        text: '2.1. Орендодавець зобов\'язується:',
                        bold: true,
                        indent: { left: 720 },
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        text: '2.1.1. Надати в оренду належне йому на праві власності житло в придатному для проживання стані.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 1440 },
                        spacing: { after: 80 }
                    }),
                    new Paragraph({
                        text: '2.1.2. Здійснювати утримання будинку й технічних обладнань квартири відповідно до вимог користування житловими приміщеннями, утримання житлового будинку і прибудинкової території в Україні.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 1440 },
                        spacing: { after: 80 }
                    }),
                    new Paragraph({
                        text: '2.1.3. Забезпечувати надання комунальних і інших послуг.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 1440 },
                        spacing: { after: 150 }
                    }),
                    new Paragraph({
                        text: '2.2. Орендар зобов\'язується:', bold: true,
                        indent: { left: 720 },
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        text: '2.2.1. Використати здану йому за договором оренди квартиру за призначенням.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 1440 },
                        spacing: { after: 80 }
                    }),
                    new Paragraph({
                        text: '2.2.2. Дотримуватися вимог до користування житловими приміщеннями, утриманням житлового будинку й прибудинкової території в Україні.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 1440 },
                        spacing: { after: 80 }
                    }),
                    new Paragraph({
                        text: '2.2.3. Вчасно повідомляти Орендодавцеві про виявлені несправності елементів квартири й будинку.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 1440 },
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        text: '4.2.1. Орендар відшкодовує Орендодавцеві матеріальний збиток, заподіяний у результаті невиконання обов\'язків, передбачених у п. п. 2.2.1 і п. п. 2.2.2 даного договору, у встановленому законом порядку.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        text: '5. Заключні умови', bold: true,
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        text: '5.1. Даний договір може бути розірваний із ініціативи кожної зі сторін при наявності умов і в порядку, передбаченому житловим законодавством.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: '5.2. Виниклі при виконанні даного договору спори між сторонами вирішуються у встановленому законом порядку.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: '5.3. Даний договір складений в 2-х екземплярах, один з яких перебуває в Орендодавця, інший - в Орендаря.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: '5.4. Невід\'ємною частиною даного договору є акт здачі квартири Орендареві.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: '5.5. Договір набуває чинності з моменту його підписання.',
                        alignment: AlignmentType.JUSTIFIED,
                        indent: { left: 720 },
                        spacing: { after: 200 }
                    }),
                    new Paragraph({ text: 'Орендодавець:', bold: true, spacing: { after: 60 } }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Паспорт No._________, серія __________, виданий __________________\n', bold: false, underline: 'single' }),
                        ],
                        indent: { left: 1440 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: 'Адреса: ________________________________________________________',
                        indent: { left: 1440 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: 'Орендодавець ________________     (підпис)',
                        indent: { left: 1440 },
                        spacing: { after: 120 }
                    }),
                    new Paragraph({ text: 'Орендар:', bold: true, spacing: { after: 60 } }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Паспорт No._________, серія __________, виданий __________________\n', underline: 'single' }),
                        ],
                        indent: { left: 1440 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: 'Адреса: ________________________________________________________',
                        indent: { left: 1440 },
                        spacing: { after: 60 }
                    }),
                    new Paragraph({
                        text: 'Орендар ________________     (підпис)',
                        indent: { left: 1440 },
                        spacing: { after: 80 }
                    }),

                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
        });
        return res.send(buffer);
    } catch (err) {
        console.error('generate-docx error:', err.message);
        res.status(500).json({ error: 'failed to generate docx' });
    }
});

// Send DOCX directly to user via Telegram bot
app.post('/api/send-doc', async (req, res) => {
    try {
        const { content, filename, chatId } = req.body || {};
        if (!content || !filename || !chatId) {
            return res.status(400).json({ error: 'content, filename, chatId are required' });
        }

        const lines = String(content).split('\n');
        const children = lines.map(line => new Paragraph({
            text: line || '',
            spacing: { line: 280, after: line.trim() === '' ? 100 : 0 },
            alignment: (line.length < 60 && (line === line.toUpperCase() || line.includes(':')))
                ? AlignmentType.CENTER
                : AlignmentType.JUSTIFIED
        }));

        const doc = new Document({
            sections: [{
                properties: {
                    page: { margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }
                },
                children
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        const fileStream = Readable.from(buffer);

        await bot.sendDocument(
            chatId,
            fileStream,
            {},
            {
                filename,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }
        );

        return res.json({ ok: true });
    } catch (err) {
        console.error('send-doc error:', err.message);
        res.status(500).json({ error: 'failed to send doc' });
    }
});

// WayForPay: subscription link
app.post('/api/create-subscription-link', async (req, res) => {
    try {
        const orderReference = 'subscr_' + Date.now();
        const amount = 7; // $7 per month (або змініть на грн)
        const currency = 'USD'; // або 'UAH'
        const returnUrl = 'https://docflow-bot.onrender.com/?subscription-success';
        
        // Спрощена форма: генеруємо базовий pay url (у продакшн підпис і схема складніша, див. WayForPay docs)
        const payUrl = `https://secure.wayforpay.com/pay?merchantAccount=${WAYFORPAY_MERCHANT_ACCOUNT}&orderReference=${orderReference}&amount=${amount}&currency=${currency}&returnUrl=${encodeURIComponent(returnUrl)}&productName=DocFlow%20PRO%20Subscription&productPrice=${amount}&productCount=1`;

        return res.json({ url: payUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Temporary in-memory store (for demo)
const userSubscriptions = {};

// WayForPay payment callback/webhook
app.post('/api/wayforpay-callback', (req, res) => {
    const body = req.body;
    // WayForPay відправляє user дані через customerEmail, orderReference, etc.
    const userEmail = body.customerEmail;
    const reference = body.orderReference;
    const status = body.transactionStatus;
    const now = new Date();

    // ПРО: якщо статус success — даємо PRO на місяць
    if (status === 'Approved' || status === 'SuccessfullyProcessed') {
        if (userEmail) {
            userSubscriptions[userEmail] = {
                plan: 'pro',
                start: now,
                end: new Date(now.getTime() + 30*24*60*60*1000)
            };
            console.log(`Підписка PRO активована для ${userEmail}`);
        }
    }
    res.json({ status: 'ok' });
});

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
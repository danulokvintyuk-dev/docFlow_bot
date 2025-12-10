const express = require('express');
const path = require('path');
const net = require('net');

const app = express();
const DEFAULT_PORT = 3000;

// Serve static files
app.use(express.static(__dirname));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Function to check if port is available
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });
        server.on('error', () => resolve(false));
    });
}

// Function to find available port
async function findAvailablePort(startPort) {
    let port = startPort;
    while (port < startPort + 100) {
        if (await isPortAvailable(port)) {
            return port;
        }
        port++;
    }
    throw new Error('Не вдалося знайти вільний порт');
}

// Start server
async function startServer() {
    const requestedPort = process.env.PORT || DEFAULT_PORT;
    
    try {
        const port = await findAvailablePort(parseInt(requestedPort));
        
        app.listen(port, () => {
            console.log('═══════════════════════════════════════════════════');
            console.log('🚀 Локальний сервер запущено!');
            console.log(`📱 Відкрийте в браузері: http://localhost:${port}`);
            if (port !== parseInt(requestedPort)) {
                console.log(`⚠️  Порт ${requestedPort} був зайнятий, використовується порт ${port}`);
            }
            console.log('═══════════════════════════════════════════════════');
            console.log('\n💡 Для тестування Telegram Web App:');
            console.log(`   1. Встановіть ngrok: npm install -g ngrok`);
            console.log(`   2. Запустіть: ngrok http ${port}`);
            console.log('   3. Використайте HTTPS URL з ngrok для Telegram Bot\n');
        });
    } catch (error) {
        console.error('❌ Помилка запуску сервера:', error.message);
        process.exit(1);
    }
}

startServer();

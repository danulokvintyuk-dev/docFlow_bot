// Railway API Service
class RailwayAPI {
    constructor() {
        // Замініть на ваш Railway URL
        this.serverURL = 'https://your-railway-app.up.railway.app/api';
        this.userId = this.getUserId();
    }

    getUserId() {
        // Отримуємо user ID з Telegram або localStorage
        if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
            return `telegram_${window.Telegram.WebApp.initDataUnsafe.user.id}`;
        }
        let userId = localStorage.getItem('user_id');
        if (!userId) {
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('user_id', userId);
        }
        return userId;
    }

    async request(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.serverURL}${endpoint}`;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': this.userId
                }
            };

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.warn('Railway API Error:', error.message);
            return null;
        }
    }

    // Contracts
    async loadContracts() {
        try {
            const result = await this.request(`/contracts?userId=${this.userId}`);
            return result?.data || [];
        } catch (error) {
            console.warn('Failed to load contracts:', error);
            return [];
        }
    }

    async saveContract(contract) {
        try {
            const data = {
                ...contract,
                userId: this.userId
            };
            const result = await this.request('/contracts', 'POST', data);
            return result?.data || { objectId: `local_${Date.now()}` };
        } catch (error) {
            console.warn('Failed to save contract:', error);
            return { objectId: `local_${Date.now()}` };
        }
    }

    // Invoices
    async loadInvoices() {
        try {
            const result = await this.request(`/invoices?userId=${this.userId}`);
            return result?.data || [];
        } catch (error) {
            console.warn('Failed to load invoices:', error);
            return [];
        }
    }

    async saveInvoice(invoice) {
        try {
            const data = {
                ...invoice,
                userId: this.userId
            };
            const result = await this.request('/invoices', 'POST', data);
            return result?.data || { objectId: `local_${Date.now()}` };
        } catch (error) {
            console.warn('Failed to save invoice:', error);
            return { objectId: `local_${Date.now()}` };
        }
    }

    // Documents
    async loadDocuments() {
        try {
            const result = await this.request(`/documents?userId=${this.userId}`);
            return result?.data || [];
        } catch (error) {
            console.warn('Failed to load documents:', error);
            return [];
        }
    }

    async saveDocument(document) {
        try {
            const data = {
                ...document,
                userId: this.userId
            };
            const result = await this.request('/documents', 'POST', data);
            return result?.data || { objectId: `local_${Date.now()}` };
        } catch (error) {
            console.warn('Failed to save document:', error);
            return { objectId: `local_${Date.now()}` };
        }
    }

    // Settings
    async loadUserSettings() {
        try {
            const result = await this.request(`/settings/${this.userId}`);
            return result?.data || null;
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return null;
        }
    }

    async saveUserSettings(settings) {
        try {
            const data = {
                ...settings,
                userId: this.userId
            };
            const result = await this.request(`/settings/${this.userId}`, 'PUT', data);
            return result?.data || { objectId: `local_${Date.now()}` };
        } catch (error) {
            console.warn('Failed to save settings:', error);
            return { objectId: `local_${Date.now()}` };
        }
    }
}

// Створюємо глобальний екземпляр API
const api = new RailwayAPI();

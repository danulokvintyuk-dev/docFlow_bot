// Global modal functions are defined at line ~508 and exposed to window object
// Telegram Web App initialization
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
} else {
    // Fallback for local testing without Telegram
    tg = {
        showAlert: (message) => alert(message),
        showConfirm: (message) => confirm(message)
    };
    console.log('⚠️ Telegram Web App SDK не знайдено. Режим локального тестування.');
}

// Mark script load for diagnostics
window.__APP_LOADED__ = true;
window.__APP_VERSION__ = '1.0.9';

// Basic diagnostics for browser console
console.log('[init] app.js loaded');
window.addEventListener('error', (e) => {
    console.error('[global error]', e.message, e.filename, e.lineno, e.colno);
});
window.addEventListener('unhandledrejection', (e) => {
    console.error('[global unhandledrejection]', e.reason);
});

// Simple on-screen debug helper (shows messages on mobile)
function showDebug(msg) {
    let dbg = document.getElementById('debugBox');
    if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'debugBox';
        dbg.style.position = 'fixed';
        dbg.style.bottom = '10px';
        dbg.style.left = '10px';
        dbg.style.right = '10px';
        dbg.style.padding = '10px';
        dbg.style.zIndex = '9999';
        dbg.style.background = 'rgba(0,0,0,0.7)';
        dbg.style.color = '#fff';
        dbg.style.fontSize = '14px';
        dbg.style.borderRadius = '6px';
        dbg.style.textAlign = 'center';
        document.body.appendChild(dbg);
    }
    dbg.innerText = msg;
}

// App state
const appState = {
    subscription: 'free',
    contracts: [],
    invoices: [],
    documents: [],
    income: [],
    taxSystem: 'single'
};

// Prevent double-close glitches on modal hide animation
let contractModalClosing = false;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[init] DOMContentLoaded');
    await loadAppState();
    initializeTabs();
    initializeContracts();
    initializeInvoices();
    initializeAnalytics();
    initializeSigning();
    initializeSubscription();
    updateSubscriptionBadge();
    // Initialize flatpickr for mobile/webview if needed (fix oversized native date controls)
    initializeFlatpickrForMobile();
    // Use element-specific handlers (touchstart + click) for mobile
    
    // Ensure contracts are re-rendered after a short delay for mobile
    setTimeout(() => {
        initializeContracts();
    }, 500);
    
    // Синхронізація з Back4App кожні 30 секунд на мобілі
    setInterval(async () => {
        try {
            const [contracts, invoices] = await Promise.all([
                api.loadContracts().catch(() => []),
                api.loadInvoices().catch(() => [])
            ]);
            if (contracts.length > appState.contracts.length || invoices.length > appState.invoices.length) {
                appState.contracts = contracts;
                appState.invoices = invoices;
                saveAppStateToLocal();
                renderContractsList();
                renderInvoicesList();
            }
        } catch (e) {
            console.debug('Auto-sync failed:', e.message);
        }
    }, 30000);
});

// Note: removed global tap delegation to avoid capture-phase conflicts on mobile WebViews.
// The code now registers direct `click` + `touchstart` handlers on buttons and cards in `initializeContracts`.

// Load state from localStorage (primary) or API (optional sync)
async function loadAppState() {
    // Спочатку завантажуємо з localStorage (основний джерело)
    const saved = localStorage.getItem('docAppState');
    if (saved) {
        try {
            Object.assign(appState, JSON.parse(saved));
            console.log('✅ Дані завантажено з localStorage');
        } catch (error) {
            console.error('Помилка читання localStorage:', error);
        }
    }

    // Спробуємо синхронізувати з Back4App (опціонально)
    try {
        const [contracts, invoices, documents, settings] = await Promise.all([
            api.loadContracts().catch(() => []),
            api.loadInvoices().catch(() => []),
            api.loadDocuments().catch(() => []),
            api.loadUserSettings().catch(() => null)
        ]);

        // Об'єднуємо дані: localStorage має пріоритет
        if (contracts.length > 0) {
            console.log(`📥 Синхронізовано ${contracts.length} договорів з Back4App`);
        }
        if (invoices.length > 0) {
            console.log(`📥 Синхронізовано ${invoices.length} рахунків з Back4App`);
        }

        if (settings) {
            appState.subscription = settings.subscription || appState.subscription || 'free';
            appState.taxSystem = settings.taxSystem || appState.taxSystem || 'single';
        }

        // Зберігаємо об'єднані дані в localStorage
        saveAppStateToLocal();
    } catch (error) {
        console.warn('⚠️ Back4App недоступний, використовується localStorage:', error.message);
        // Продовжуємо роботу з localStorage
    }
}

// Show loaded version in the header badge (reads ?v= from CSS/JS links)
function showLoadedVersion() {
    try {
        const badge = document.getElementById('appVersionBadge');
        if (!badge) return;
        badge.style.display = 'none';
    } catch (e) {
        console.debug('showLoadedVersion failed', e.message);
    }
}

// call once DOM ready
document.addEventListener('DOMContentLoaded', showLoadedVersion);

// Replace native date inputs with flatpickr instances on iOS Telegram WebView
function initializeFlatpickrForMobile() {
    try {
        const ua = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isTelegram = /Telegram/i.test(ua) || !!window.Telegram;
        if (!isIOS || !isTelegram || typeof flatpickr === 'undefined') return;

        const ids = ['startDate', 'endDate', 'rentStartDate', 'rentEndDate', 'invoiceDate'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            // If already initialized, skip
            if (el._flatpickr) return;

            flatpickr(el, {
                dateFormat: 'Y-m-d',
                allowInput: true,
                clickOpens: true,
                // match appearance to app theme
                onReady: function(inst) {
                    // ensure input sizing matches other fields
                    inst.input.classList.add('date-text');
                }
            });
        });
        console.log('✅ flatpickr initialized for mobile Telegram WebView');
    } catch (err) {
        console.warn('flatpickr init failed:', err.message);
    }
}

// Save state to localStorage (primary) and API (optional sync)
async function saveAppState() {
    // Зберігаємо в localStorage (основний спосіб)
    saveAppStateToLocal();
    console.log('✅ Дані збережено в localStorage');

    // Спробуємо синхронізувати з Back4App (опціонально, у фоні)
    try {
        await api.saveUserSettings({
            subscription: appState.subscription,
            taxSystem: appState.taxSystem
        });
    } catch (error) {
        // Тихо ігноруємо помилки API - localStorage достатньо
        console.debug('Back4App sync failed (не критично):', error.message);
    }
}

// Save to localStorage (backup)
function saveAppStateToLocal() {
    localStorage.setItem('docAppState', JSON.stringify(appState));
}

// Tab navigation
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Contract Types with SVG icons
const contractTypes = [
    { id: 'services', name: 'Послуги', icon: 'services' },
    { id: 'rent', name: 'Оренда', icon: 'rent' },
    { id: 'sale', name: 'Купівля-продаж', icon: 'sale' },
    { id: 'nda', name: 'NDA', icon: 'lock' },
    { id: 'subcontract', name: 'Підряд', icon: 'document' },
    { id: 'employment', name: 'Трудовий договір', icon: 'briefcase' },
    { id: 'loan', name: 'Позика', icon: 'credit' },
    { id: 'partnership', name: 'Партнерство', icon: 'handshake' },
    { id: 'license', name: 'Ліцензія', icon: 'certificate' },
    { id: 'franchise', name: 'Франшиза', icon: 'store' },
    { id: 'consulting', name: 'Консалтинг', icon: 'briefcase' },
    { id: 'development', name: 'Розробка', icon: 'code' },
    { id: 'marketing', name: 'Маркетинг', icon: 'megaphone' },
    { id: 'maintenance', name: 'Обслуговування', icon: 'tools' },
    { id: 'delivery', name: 'Доставка', icon: 'truck' },
    { id: 'storage', name: 'Зберігання', icon: 'box' },
    { id: 'insurance', name: 'Страхування', icon: 'shield' },
    { id: 'guarantee', name: 'Гарантія', icon: 'check' },
    { id: 'confidentiality', name: 'Конфіденційність', icon: 'lock' },
    { id: 'noncompete', name: 'Не конкуренція', icon: 'ban' }
];

// SVG Icons mapping
function getContractIcon(iconType) {
    const icons = {
        services: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
        rent: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        sale: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
        lock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
        document: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
        briefcase: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
        credit: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
        handshake: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"></path><path d="M7 21h1c.5 0 .9-.2 1.2-.6l5.6-6.4"></path><path d="M21 12h-2a2 2 0 1 1 0-4h3c.6 0 1.1.2 1.4.6L21 16"></path><path d="M17 21h-1c-.5 0-.9-.2-1.2-.6l-5.6-6.4"></path></svg>',
        certificate: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="12" cy="15" r="1"></circle><path d="M10 19h4"></path></svg>',
        store: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        code: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
        megaphone: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>',
        tools: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
        truck: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
        box: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        shield: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
        check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        ban: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>'
    };
    return icons[iconType] || icons.document;
}

// Initialize Contracts
function initializeContracts() {
    const grid = document.getElementById('contractTypesGrid');
    const newContractBtn = document.getElementById('newContractBtn');
    
    // Check if user has premium subscription
    if (appState.subscription === 'free') {
        // Show upgrade prompt for free users with remaining quota
        const monthlyCount = getMonthlyDocumentCount();
        const remaining = Math.max(0, 3 - monthlyCount);
        
        if (remaining > 0) {
            // Show contract types AND upgrade prompt for free users with remaining quota
            grid.innerHTML = `
                <div style="grid-column: 1/-1; margin-bottom: 30px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                padding: 20px; border-radius: 12px; color: white; text-align: center;">
                        <p style="margin: 0; font-size: 14px;">
                            ✨ У вас залишилося <strong>${remaining}</strong> документ${remaining === 1 ? '' : 'и'} для створення цього місяця
                        </p>
                    </div>
                </div>
                ${contractTypes.map(type => `
                    <div class="contract-type-card" data-type="${type.id}">
                        <div class="icon">${getContractIcon(type.icon)}</div>
                        <span class="name">${type.name}</span>
                    </div>
                `).join('')}
            `;
            
            grid.querySelectorAll('.contract-type-card').forEach(card => {
                card.addEventListener('click', () => {
                    const typeId = card.dataset.type;
                    openContractModal(typeId);
                });
            });
            
            newContractBtn.style.display = 'block';
        } else {
            // Show only upgrade prompt for free users without remaining quota
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                padding: 30px; border-radius: 12px; color: white;">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 20px;">
                            <path d="M12 15v-6M8 11h8M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0z"></path>
                        </svg>
                        <h3 style="margin: 0 0 10px 0; font-size: 20px;">Límит досягнут</h3>
                        <p style="margin: 0 0 20px 0; font-size: 14px; opacity: 0.9;">
                            Ви використали всі 3 дозволених документи на цей місяць
                        </p>
                        <button class="btn-primary" style="background: white; color: #667eea; border: none; cursor: pointer; padding: 10px 20px; border-radius: 6px; font-weight: bold;" 
                                onclick="document.querySelector('.tab-btn[data-tab=subscription]').click();">
                            Оновити підписку
                        </button>
                    </div>
                </div>
            `;
            newContractBtn.style.display = 'none';
        }
    } else {
        // Show contract types for premium users
        grid.innerHTML = contractTypes.map(type => `
            <div class="contract-type-card" data-type="${type.id}">
                <div class="icon">${getContractIcon(type.icon)}</div>
                <span class="name">${type.name}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.contract-type-card').forEach(card => {
            card.addEventListener('click', () => {
                const typeId = card.dataset.type;
                openContractModal(typeId);
            });
            // Add touchstart for mobile/webview to ensure immediate response
            card.addEventListener('touchstart', (ev) => {
                ev.preventDefault();
                const typeId = card.dataset.type;
                openContractModal(typeId);
            }, { passive: false });
            // Make cards keyboard-focusable and behave like buttons
            try { card.tabIndex = 0; card.setAttribute('role', 'button'); card.style.touchAction = 'manipulation'; } catch (e) {}
        });
        
        newContractBtn.style.display = 'block';
    }

    const newBtnEl = document.getElementById('newContractBtn');
    if (newBtnEl) {
        newBtnEl.addEventListener('click', () => {
            try { openContractModal(); } catch (e) { console.debug('openContractModal error', e); }
        });
        // also handle touchstart for mobile/webview where click may be delayed/blocked
        newBtnEl.addEventListener('touchstart', (ev) => {
            ev.preventDefault();
            try { openContractModal(); } catch (e) { console.debug('openContractModal error', e); }
        }, { passive: false });
    } else {
        console.debug('newContractBtn not found');
    }

    const closeModalEl = document.getElementById('closeModal');
    if (closeModalEl) {
        closeModalEl.addEventListener('click', closeContractModal);
        closeModalEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            closeContractModal();
        }, { passive: false });
    }

    const cancelBtnEl = document.getElementById('cancelBtn');
    if (cancelBtnEl) {
        cancelBtnEl.addEventListener('click', closeContractModal);
        cancelBtnEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            closeContractModal();
        }, { passive: false });
    }
    
    // Add modal background click handler to close modal
    const contractModal = document.getElementById('contractModal');
    if (contractModal) {
        contractModal.addEventListener('click', (e) => {
            if (e.target === contractModal) {
                closeContractModal();
            }
        });
    }
    
    const contractFormEl = document.getElementById('contractForm');
    if (contractFormEl) {
        // disable native validation to avoid hidden required errors; we validate manually
        contractFormEl.setAttribute('novalidate', 'true');
        contractFormEl.addEventListener('submit', handleContractSubmit);
        console.log('[init] contractForm submit listener attached');
    } else {
        console.warn('[init] contractForm not found');
    }

    // Populate contract type select
    const contractTypeSelect = document.getElementById('contractType');
    contractTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = type.name;
        contractTypeSelect.appendChild(option);
    });
    if (contractTypeSelect) {
        contractTypeSelect.addEventListener('change', handleContractTypeChange);
        toggleContractFields(contractTypeSelect.value === 'rent');
    }
    
    // Render the list of created contracts
    renderContractsList();
}

// Attach minimal newContractBtn handler (safe - waits for DOM)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('newContractBtn');
    if (btn) {
        try { btn.removeAttribute('onclick'); } catch (e) {}
        btn.addEventListener('click', () => openContractModal());
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); openContractModal(); }, { passive: false });
    }
});

// Replace openContractModal with a robust mobile-first implementation
function openContractModal(typeId = null) {
    try {
        // 1. ПЕРЕВІРКА МОДАЛЮ
        const modal = document.getElementById('contractModal');
        if (!modal) {
            console.error('❌ contractModal element not found');
            if (typeof tg !== 'undefined' && tg && typeof tg.showAlert === 'function') {
                tg.showAlert('Помилка: модаль не знайдена на сторінці');
            } else {
                alert('Помилка: модаль не знайдена');
            }
            return;
        }

        // 2. ПЕРЕВІРКА ФОРМИ
        const form = document.getElementById('contractForm');
        if (form) {
            try { form.reset(); } catch (e) { console.warn('Form reset failed:', e.message); }
        }

        // 3. ПЕРЕВІРКА SUBSCRIPTION (appState може бути недоступним)
        if (typeof appState !== 'undefined' && appState && appState.subscription === 'free') {
            let monthlyCount = 0;
            if (typeof getMonthlyDocumentCount === 'function') {
                try {
                    monthlyCount = getMonthlyDocumentCount();
                } catch (e) {
                    console.warn('getMonthlyDocumentCount failed:', e.message);
                    monthlyCount = 0;
                }
            }
            const remaining = Math.max(0, 3 - monthlyCount);
            if (remaining <= 0) {
                const alertFn = (typeof tg !== 'undefined' && tg && typeof tg.showAlert === 'function') 
                    ? tg.showAlert.bind(tg) 
                    : alert;
                alertFn('Ви досягли ліміту безкоштовного плану (3 документи/місяць).');
                return;
            }
        }

        // 4. ВІДКРИТТЯ МОДАЛЮ
        modal.style.display = 'flex';
        contractModalClosing = false; // reset close guard
        setTimeout(() => {
            try {
                modal.classList.add('active');
                document.body.classList.add('modal-open');
                
                // 5. ВСТАНОВИТИ ТИП ДОГОВОРУ (якщо передано)
                if (typeId) {
                    const typeEl = document.getElementById('contractType');
                    if (typeEl) {
                        try { typeEl.value = typeId; } catch (e) { console.warn('Cannot set contract type:', e.message); }
                        try { toggleContractFields(typeEl.value === 'rent'); } catch (e) {}
                    }
                } else {
                    const typeEl = document.getElementById('contractType');
                    if (typeEl) {
                        try { toggleContractFields(typeEl.value === 'rent'); } catch (e) {}
                    }
                }
                
                // 6. ФОКУС НА ПЕРШИЙ INPUT (для відкриття клавіатури на мобільному)
                try {
                    const first = modal.querySelector('input, select, textarea, button');
                    if (first && typeof first.focus === 'function') {
                        first.focus();
                    }
                } catch (e) {
                    console.warn('Focus failed:', e.message);
                }
            } catch (e) {
                console.error('Error during modal activation:', e.message);
            }
        }, 10);

        console.log('✅ Modal opened successfully');
    } catch (err) {
        console.error('❌ FATAL ERROR in openContractModal:', err && err.message ? err.message : err);
        const alertFn = (typeof tg !== 'undefined' && tg && typeof tg.showAlert === 'function') 
            ? tg.showAlert.bind(tg) 
            : alert;
        alertFn('Помилка при відкритті модалю: ' + (err && err.message ? err.message : 'невідома помилка'));
    }
}


function handleContractTypeChange(e) {
    const isRent = e.target.value === 'rent';
    toggleContractFields(isRent);
}

function toggleContractFields(isRent) {
    // Basic fields that should be hidden for rent
    const basicFields = document.getElementById('basicContractFields');
    const rentFields = document.getElementById('rentFields');
    const basicRequiredIds = ['counterpartyName', 'startDate', 'contractAmount', 'contractSubject'];
    const rentRequiredIds = ['rentStartDate', 'rentAmount'];
    
    if (isRent) {
        // Hide basic fields, show rent fields
        if (basicFields) basicFields.style.display = 'none';
        if (rentFields) rentFields.style.display = 'block';
        basicRequiredIds.forEach(id => { const el = document.getElementById(id); if (el) el.required = false; });
        rentRequiredIds.forEach(id => { const el = document.getElementById(id); if (el) el.required = true; });
    } else {
        // Show basic fields, hide rent fields
        if (basicFields) basicFields.style.display = 'block';
        if (rentFields) rentFields.style.display = 'none';
        basicRequiredIds.forEach(id => { const el = document.getElementById(id); if (el) el.required = true; });
        rentRequiredIds.forEach(id => { const el = document.getElementById(id); if (el) el.required = false; });
    }
}

function closeContractModal() {
    const modal = document.getElementById('contractModal');
    if (!modal || contractModalClosing) return;
    contractModalClosing = true;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    // hide after animation/frame
    setTimeout(() => { 
        try { modal.style.display = 'none'; } catch (e) {} 
        contractModalClosing = false;
    }, 180);
}

async function handleContractSubmit(e) {
    e.preventDefault();
    
    if (appState.subscription === 'free') {
        const monthlyCount = getMonthlyDocumentCount();
        if (monthlyCount >= 3) {
            tg.showAlert('Ви досягли ліміту безкоштовного плану (3 документи/місяць). Оновіть підписку для необмеженої генерації.');
            return;
        }
    }

    const contractType = document.getElementById('contractType').value;
    const isRent = contractType === 'rent';
    
    const formData = {
        type: contractType,
        createdAt: new Date().toISOString(),
        id: Date.now().toString()
    };

    console.log('[contract] submit start', { type: contractType });

    // Для оренди використовуємо інші поля
    if (isRent) {
        formData.startDate = document.getElementById('rentStartDate')?.value || '';
        formData.endDate = document.getElementById('rentEndDate')?.value || '';
        formData.amount = parseFloat(document.getElementById('rentAmount')?.value || 0);
        formData.additionalTerms = document.getElementById('additionalTerms')?.value || '';
    } else {
        // Базові поля для інших типів договорів
        formData.counterpartyName = document.getElementById('counterpartyName')?.value || '';
        formData.taxId = document.getElementById('taxId')?.value || '';
        formData.startDate = document.getElementById('startDate')?.value || '';
        formData.endDate = document.getElementById('endDate')?.value || '';
        formData.amount = parseFloat(document.getElementById('contractAmount')?.value || 0);
        formData.subject = document.getElementById('contractSubject')?.value || '';
        formData.additionalTerms = document.getElementById('additionalTerms')?.value || '';
    }

    console.log('[contract] collected data', formData);

    // Додаткові поля для договору оренди
    if (isRent) {
        formData.landlordName = document.getElementById('landlordName')?.value || '';
        formData.landlordPassportSeries = document.getElementById('landlordPassportSeries')?.value || '';
        formData.landlordPassportNumber = document.getElementById('landlordPassportNumber')?.value || '';
        formData.landlordPassportIssued = document.getElementById('landlordPassportIssued')?.value || '';
        formData.landlordRegistered = document.getElementById('landlordRegistered')?.value || '';
        formData.landlordAddress = document.getElementById('landlordAddress')?.value || '';
        formData.landlordPhone = document.getElementById('landlordPhone')?.value || '';
        formData.tenantName = document.getElementById('tenantName')?.value || '';
        formData.counterpartyName = formData.tenantName; // Для сумісності
        formData.tenantPassportSeries = document.getElementById('tenantPassportSeries')?.value || '';
        formData.tenantPassportNumber = document.getElementById('tenantPassportNumber')?.value || '';
        formData.tenantPassportIssued = document.getElementById('tenantPassportIssued')?.value || '';
        formData.tenantRegistered = document.getElementById('tenantRegistered')?.value || '';
        formData.tenantAddress = document.getElementById('tenantAddress')?.value || '';
        formData.tenantPhone = document.getElementById('tenantPhone')?.value || '';
        formData.street = document.getElementById('street')?.value || '';
        formData.building = document.getElementById('building')?.value || '';
        formData.apartment = document.getElementById('apartment')?.value || '';
        formData.rooms = document.getElementById('rooms')?.value || '';
        formData.area = document.getElementById('area')?.value || '';
        formData.transferDays = document.getElementById('transferDays')?.value || '';
        formData.gasMeter = document.getElementById('gasMeter')?.value || '';
        formData.electricityMeter = document.getElementById('electricityMeter')?.value || '';
        formData.waterMeter = document.getElementById('waterMeter')?.value || '';
        formData.propertyList = document.getElementById('propertyList')?.value || '';
        formData.equipment = document.getElementById('equipment')?.value || '';
    }

    appState.contracts.push(formData);
    
    // Зберігаємо в localStorage (основний спосіб)
    await saveAppState();
    
    // Спробуємо синхронізувати з Back4App (опціонально, у фоні)
    try {
        await api.saveContract(formData);
    } catch (error) {
        // Не критично - дані вже в localStorage
        console.debug('Back4App sync failed (не критично):', error.message);
    }
    console.log('[contract] generating file');
    generateContractPDF(formData);
    
    // Delay UI updates to avoid blocking the thread during file creation
    setTimeout(() => {
        try { closeContractModal(); } catch (e) {}
        try { renderContractsList(); } catch (e) {}
        try { updateAnalytics(); } catch (e) {}
        try { tg.showAlert('Договір успішно згенеровано!'); } catch (e) {}
    }, 50);
}

function getMonthlyDocumentCount() {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const contracts = (appState.contracts || []).filter(c => new Date(c.createdAt) > monthAgo).length;
    const invoices = (appState.invoices || []).filter(i => new Date(i.createdAt) > monthAgo).length;
    
    return contracts + invoices;
}

function generateContractPDF(data) {
    const contractType = contractTypes.find(t => t.id === data.type);
    if (!contractType) {
        const alertFn = (typeof tg !== 'undefined' && tg?.showAlert) ? tg.showAlert.bind(tg) : alert;
        alertFn('Тип договору не обрано або не підтримується. Оберіть тип та повторіть.');
        return;
    }
    
    const template = getContractTemplate(data.type);
    if (!template) {
        const alertFn = (typeof tg !== 'undefined' && tg?.showAlert) ? tg.showAlert.bind(tg) : alert;
        alertFn('Шаблон для цього типу не знайдено. Спробуйте інший тип або перезавантажте сторінку.');
        return;
    }
    
    console.log('[contract] generateContractPDF', { type: data.type, name: contractType.name });
    
    // Parse date for day, month, year
    const contractDate = new Date(data.startDate || new Date());
    let day = contractDate.getDate();
    let month = '';
    let year = contractDate.getFullYear();
    
    if (!isNaN(contractDate.getTime())) {
        const monthNames = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 
                            'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
        month = monthNames[contractDate.getMonth()];
    } else {
        day = '___';
        month = '___________';
        year = '20___';
    }
    
    // Replace placeholders
    let content = template
        .replace(/{TYPE}/g, contractType.name)
        .replace(/{COUNTERPARTY}/g, data.counterpartyName || data.tenantName || 'не вказано')
        .replace(/{TAX_ID}/g, data.taxId || 'не вказано')
        .replace(/{START_DATE}/g, data.startDate ? formatDate(data.startDate) : 'не вказано')
        .replace(/{END_DATE}/g, data.endDate ? formatDate(data.endDate) : 'не вказано')
        .replace(/{AMOUNT}/g, data.amount ? data.amount.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' }) : 'не вказано')
        .replace(/{SUBJECT}/g, data.subject || 'не вказано')
        .replace(/{ADDITIONAL}/g, data.additionalTerms || 'немає')
        .replace(/{DATE}/g, formatDate(new Date().toISOString()))
        .replace(/{DAY}/g, day)
        .replace(/{MONTH}/g, month)
        .replace(/{YEAR}/g, year);
    
    // For rent contract - replace all additional fields
    if (data.type === 'rent') {
        content = content
            .replace(/{LANDLORD_NAME}/g, data.landlordName || '_________________________')
            .replace(/{LANDLORD_PASSPORT_SERIES}/g, data.landlordPassportSeries || '___')
            .replace(/{LANDLORD_PASSPORT_NUMBER}/g, data.landlordPassportNumber || '___________________')
            .replace(/{LANDLORD_PASSPORT_ISSUED}/g, data.landlordPassportIssued || '_________________________')
            .replace(/{LANDLORD_REGISTERED}/g, data.landlordRegistered || '_________________________')
            .replace(/{LANDLORD_ADDRESS}/g, data.landlordAddress || '_________________________')
            .replace(/{LANDLORD_PHONE}/g, data.landlordPhone || '_________________________')
            .replace(/{TENANT_NAME}/g, data.counterpartyName || '_________________________')
            .replace(/{TENANT_PASSPORT_SERIES}/g, data.tenantPassportSeries || '___')
            .replace(/{TENANT_PASSPORT_NUMBER}/g, data.tenantPassportNumber || '___________________')
            .replace(/{TENANT_PASSPORT_ISSUED}/g, data.tenantPassportIssued || '_________________________')
            .replace(/{TENANT_REGISTERED}/g, data.tenantRegistered || '_________________________')
            .replace(/{TENANT_ADDRESS}/g, data.tenantAddress || '_________________________')
            .replace(/{TENANT_PHONE}/g, data.tenantPhone || '_________________________')
            .replace(/{STREET}/g, data.street || '_________________________')
            .replace(/{BUILDING}/g, data.building || '___')
            .replace(/{APARTMENT}/g, data.apartment || '___')
            .replace(/{ROOMS}/g, data.rooms || '___')
            .replace(/{TRANSFER_DAYS}/g, data.transferDays || '___')
            .replace(/{GAS_METER}/g, data.gasMeter || '_____________')
            .replace(/{ELECTRICITY_METER}/g, data.electricityMeter || '_____________')
            .replace(/{WATER_METER}/g, data.waterMeter || '_____________')
            .replace(/{AREA}/g, data.area || '___')
            .replace(/{PROPERTY_LIST}/g, data.propertyList || '_________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________')
            .replace(/{EQUIPMENT}/g, data.equipment || '_________________________________________________________________________________________________________________________________');
    }

    // Generate DOCX file
    createAndDownloadDocx(content, `Договір_${contractType.name}_${Date.now()}.docx`);
}

function getContractTemplate(type) {
    const templates = {
        services: `ДОГОВІР ПРО НАДАННЯ ПОСЛУГ

Тип: {TYPE}
Дата: {DATE}

СТОРОНИ:
Замовник: {COUNTERPARTY}
ІПН: {TAX_ID}

ПРЕДМЕТ ДОГОВОРУ:
{SUBJECT}

ТЕРМІН ДІЇ:
З {START_DATE} по {END_DATE}

ВАРТІСТЬ:
{AMOUNT}

ДОДАТКОВІ УМОВИ:
{ADDITIONAL}

ПІДПИСИ СТОРІН:
_________________          _________________
Замовник                   Виконавець`,

        rent: `ДОГОВІР ОРЕНДИ КВАРТИРИ У ПРИВАТНОЇ ОСОБИ

м. Львів                                                                                    " {DAY} " {MONTH} {YEAR} р.

Сторони:

Орендодавець {LANDLORD_NAME} діючого на підставі паспорта {LANDLORD_PASSPORT_SERIES} № {LANDLORD_PASSPORT_NUMBER}
виданий {LANDLORD_PASSPORT_ISSUED}
зареєстрований(а) {LANDLORD_REGISTERED}
проживає {LANDLORD_ADDRESS}
номер засобу зв'язку: {LANDLORD_PHONE}

з однієї сторони, та

Орендар {TENANT_NAME} діючого на підставі паспорта {TENANT_PASSPORT_SERIES} № {TENANT_PASSPORT_NUMBER}
виданий {TENANT_PASSPORT_ISSUED}
зареєстрований(а) {TENANT_REGISTERED}
проживає {TENANT_ADDRESS}
номер засобу зв'язку: {TENANT_PHONE}

з другої сторони, уклали цей Договір про наступне:

1. Предмет договору.

Орендодавець надає, а Орендар приймає в строкове платне користування квартиру (далі за текстом "об'єкт оренди"):

Адреса: м. Львів, вул. {STREET} буд. № {BUILDING} кв. {APARTMENT}

Кількість кімнат: {ROOMS}

Орендодавець також передає в оренду майно, що знаходиться у квартирі, і вказане у Акті здачі-приймання.

2. Мета та умови використання об'єкту оренди.

Об'єкт оренди передається в оренду для проживання.

3. Термін оренди.

Термін оренди складає з {START_DATE} до {END_DATE}.

Термін оренди може бути скорочений лише за згодою сторін.

Після закінчення терміну Договору Орендар може поновити його на новий термін за згодою сторін.

4. Орендна плата.

Розмір орендної плати за об'єкт, що орендується, складає {AMOUNT} на місяць.

Розмір орендної плати може переглядатися Сторонами не частіше, ніж один раз протягом року або за згодою сторін у разі погіршення стану Об'єкту оренди не з вини Орендаря, що підтверджено документами.

Комунальні послуги оплачуються Орендарем самостійно на підставі рахунків відповідних організацій.

5. Порядок передачі об'єкта в оренду.

Квартира та майно повинні бути передані Орендодавцем та прийняті Орендарем протягом {TRANSFER_DAYS} з моменту укладення Даного Договору. Протягом цього терміну Орендодавець зобов'язаний виїхати з квартири та підготувати її для передачі Орендареві.

Передача квартири в оренду оформлюється актом здачі-приймання.

У момент підписання акту здачі-приймання Орендодавець передає Орендареві ключі від квартири та від кімнат.

Об'єкт, що орендується, вважається переданим в оренду з моменту підписання акту здачі-приймання.

6. Права та обов'язки сторін.

Обов'язки Орендаря:
- Використовувати майно, що орендується, за його цільовим призначенням у відповідності до п.2 Даного договору.
- Своєчасно здійснювати комунальні платежі.
- Здійснювати за власний рахунок профілактичне обслуговування та поточний ремонт майна, що орендується.
- Дотримуватися протипожежних правил.
- Не здійснювати перебудову та перепланування квартири, що орендується.
- Дотримуватися правил проживання в будинку, в якому знаходиться квартира.

Права Орендаря:
- Обладнати та оформити квартиру на власний розсуд за згодою Орендодавця.
- Міняти замки вхідних дверей та кімнат, укріплювати вхідні двері, установлювати сигналізацію та інші системи охорони квартири за згодою Орендодавця.

Права Орендодавця:
- Орендодавець має право 1 (один) раз на місяць здійснювати перевірку порядку використання Орендарем майна, що орендується, у відповідності до умов Даного Договору.
- У разі зміни власника об'єкта оренди до нового власника переходять права та обов'язки Орендодавця.

7. Порядок повернення квартири Орендодавцю. Розірвання Договору оренди.

Після закінчення терміну оренди Орендар зобов'язаний передати Орендодавцю квартиру та майно, що орендується, протягом 1 (одного) дня з моменту закінчення терміну оренди за актом здачі-приймання.

Квартира та майно вважаються фактично переданим Орендодавцю з моменту підписання акту здачі-приймання.

У момент підписання акту здачі-приймання Орендар передає Орендодавцю ключі від квартири та кімнат.

Квартира та майно повинні бути передані Орендодавцю у тому ж стані, в якому вони були передані в оренду з урахуванням нормального зносу.

Невідокремлювані покращення здійснені в квартирі Орендарем, переходять до Орендодавця без відшкодування здійснених витрат.

Договір оренди може бути розірваний з ініціативи Орендодавця у разі:
- невнесення Орендарем орендної плати та плати за комунальні послуги за поточний місяць (за один місяць);
- руйнування або псування Об'єкту оренди Орендарем або іншими особами, за дії яких він відповідає;
- якщо Орендар або інші особи, за дії яких він відповідає, використовують об'єкт оренди не за призначенням (не дозволяється використовувати під суборенду) або систематично порушують права та інтереси сусідів.

Дострокове розірвання Договору можливе лише за взаємною згодою Сторін, якщо інше не встановлено Договором або законодавством України, за винятком випадків, коли одна із сторін систематично порушує умови договору і свої зобов'язання. Орендар чи орендодавець, при розірванні договору зобов'язаний попередити за два тижні орендодавця чи орендаря про виселення з квартири.

8. Інші умови.

Договір набуває чинності з моменту його підписання Сторонами і діє до моменту повного виконання Сторонами своїх зобов'язань за цим Договором.

Умови даного Договору можуть бути змінені лише за взаємною згодою Сторін з обов'язковим складанням письмового документу.

Усі спори, що пов'язані з цим Договором, вирішуються шляхом переговорів між Сторонами. Якщо спір не може бути вирішений шляхом переговорів, він вирішується в судовому порядку за встановленою підвідомчістю та підсудністю такого спору, визначеному відповідним чинним законодавством України.

Даний Договір укладено у двох оригінальних примірниках, по одному для кожної із сторін.

Після підписання цього Договору усі попередні переговори за ним, листування, попередні угоди та протоколи про наміри з питань, що так чи інакше стосуються цього Договору, втрачають юридичну силу.

Додатки до Даного Договору складають його невід'ємну частину.

До Даного Договору додається: акт приймання-передачі, таблиця розрахунків.

9. Додаткові умови.

{ADDITIONAL}

10. Показники лічильників:

Газ: {GAS_METER}
Електроенергія: {ELECTRICITY_METER}
Вода: {WATER_METER}

11. Місцезнаходження та реквізити сторін.

Орендодавець

П.І.Б. {LANDLORD_NAME}
Паспорт {LANDLORD_PASSPORT_SERIES} № {LANDLORD_PASSPORT_NUMBER}
Виданий {LANDLORD_PASSPORT_ISSUED}
Зареєстрований(а) {LANDLORD_REGISTERED}
Проживає {LANDLORD_ADDRESS}
Номер засобу зв'язку: {LANDLORD_PHONE}

Підпис ______________________

Орендар

П.І.Б. {TENANT_NAME}
Паспорт {TENANT_PASSPORT_SERIES} № {TENANT_PASSPORT_NUMBER}
Виданий {TENANT_PASSPORT_ISSUED}
Зареєстрований(а) {TENANT_REGISTERED}
Проживає {TENANT_ADDRESS}
Номер засобу зв'язку: {TENANT_PHONE}

Підпис ______________________


ДОДАТОК ДО ДОГОВОРУ ОРЕНДИ
від " {DAY} " {MONTH} {YEAR} року

АКТ ПРИЙМАННЯ-ПЕРЕДАЧІ

Ми, що нижче підписалися:

Від Орендодавця {LANDLORD_NAME}
Від Орендаря {TENANT_NAME}

склали цей акт в тому, що Орендодавцем передано, а Орендарем прийнято в оренду, згідно договору від " {DAY} " {MONTH} {YEAR} року об'єкт (квартиру, будинок, приміщення) за адресою: м. Львів, вул. {STREET} буд. № {BUILDING} кв. {APARTMENT}, загальною площею {AREA} м.кв.

На момент передачі в оренду об'єкт знаходиться в справному стані. На час дії договору оренди Орендодавець передає, а Орендар приймає в користування таке майно:

{PROPERTY_LIST}

Санітарні, технічні, газо (електро) нагрівальні прилади та обладнання: {EQUIPMENT}

Прийняті (здані) у робочому (справному) стані.

Від Орендодавця                                    Від Орендаря
________________                                  ________________`,

        sale: `ДОГОВІР КУПІВЛІ-ПРОДАЖУ

Тип: {TYPE}
Дата: {DATE}

СТОРОНИ:
Покупець: {COUNTERPARTY}
ІПН: {TAX_ID}

ПРЕДМЕТ ДОГОВОРУ:
{SUBJECT}

ВАРТІСТЬ:
{AMOUNT}

ДОДАТКОВІ УМОВИ:
{ADDITIONAL}

ПІДПИСИ СТОРІН:
_________________          _________________
Покупець                   Продавець`,

        nda: `ДОГОВІР ПРО НЕРОЗГОЛОШЕННЯ (NDA)

Тип: {TYPE}
Дата: {DATE}

СТОРОНИ:
Контрагент: {COUNTERPARTY}
ІПН: {TAX_ID}

ПРЕДМЕТ ДОГОВОРУ:
{SUBJECT}

ТЕРМІН ДІЇ:
З {START_DATE} по {END_DATE}

ДОДАТКОВІ УМОВИ:
{ADDITIONAL}

ПІДПИСИ СТОРІН:
_________________          _________________
Контрагент                 Наша компанія`
    };

    return templates[type] || templates.services;
}

// Initialize Invoices
function initializeInvoices() {
    document.getElementById('newInvoiceBtn').addEventListener('click', () => {
        openInvoiceModal();
    });

    document.querySelectorAll('.invoice-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            openInvoiceModal(type);
        });
    });

    document.getElementById('closeInvoiceModal').addEventListener('click', closeInvoiceModal);
    document.getElementById('closeInvoiceModal').addEventListener('touchstart', (e) => {
        e.preventDefault();
        closeInvoiceModal();
    }, { passive: false });
    
    document.getElementById('cancelInvoiceBtn').addEventListener('click', closeInvoiceModal);
    document.getElementById('cancelInvoiceBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        closeInvoiceModal();
    }, { passive: false });
    
    // Add modal background click handler to close modal
    const invoiceModal = document.getElementById('invoiceModal');
    if (invoiceModal) {
        invoiceModal.addEventListener('click', (e) => {
            if (e.target === invoiceModal) {
                closeInvoiceModal();
            }
        });
    }
    
    document.getElementById('addItemBtn').addEventListener('click', addInvoiceItem);
    document.getElementById('invoiceForm').addEventListener('submit', handleInvoiceSubmit);
    document.getElementById('invoiceDate').valueAsDate = new Date();
}

function openInvoiceModal(type = 'invoice') {
    const modal = document.getElementById('invoiceModal');
    const form = document.getElementById('invoiceForm');
    
    document.getElementById('invoiceType').value = type;
    form.reset();
    document.getElementById('invoiceDate').valueAsDate = new Date();
    
    // Reset items
    const itemsContainer = document.getElementById('invoiceItems');
    itemsContainer.innerHTML = `
        <div class="invoice-item">
            <input type="text" placeholder="Назва послуги/товару" class="item-name" required>
            <input type="number" placeholder="Кількість" class="item-quantity" step="0.01" value="1" required>
            <input type="number" placeholder="Ціна" class="item-price" step="0.01" required>
            <button type="button" class="remove-item-btn">×</button>
        </div>
    `;
    
    attachItemListeners();
    
    // Ensure modal is visible
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }, 10);
}

function closeInvoiceModal() {
    document.body.classList.remove('modal-open');
    document.getElementById('invoiceModal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function addInvoiceItem() {
    const container = document.getElementById('invoiceItems');
    const item = document.createElement('div');
    item.className = 'invoice-item';
    item.innerHTML = `
        <input type="text" placeholder="Назва послуги/товару" class="item-name" required>
        <input type="number" placeholder="Кількість" class="item-quantity" step="0.01" value="1" required>
        <input type="number" placeholder="Ціна" class="item-price" step="0.01" required>
        <button type="button" class="remove-item-btn">×</button>
    `;
    container.appendChild(item);
    attachItemListeners();
}

function attachItemListeners() {
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (document.querySelectorAll('.invoice-item').length > 1) {
                e.target.closest('.invoice-item').remove();
            }
        });
    });
}

async function handleInvoiceSubmit(e) {
    e.preventDefault();
    
    if (appState.subscription === 'free') {
        const monthlyCount = getMonthlyDocumentCount();
        if (monthlyCount >= 3) {
            tg.showAlert('Ви досягли ліміту безкоштовного плану (3 документи/місяць). Оновіть підписку для необмеженої генерації.');
            return;
        }
    }

    const items = Array.from(document.querySelectorAll('.invoice-item')).map(item => {
        return {
            name: item.querySelector('.item-name').value,
            quantity: parseFloat(item.querySelector('.item-quantity').value),
            price: parseFloat(item.querySelector('.item-price').value)
        };
    });

    const vatRate = parseFloat(document.getElementById('vatRate').value) || 0;
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    const invoiceData = {
        type: document.getElementById('invoiceType').value,
        clientName: document.getElementById('clientName').value,
        clientTaxId: document.getElementById('clientTaxId').value,
        date: document.getElementById('invoiceDate').value,
        items: items,
        subtotal: subtotal,
        vat: vat,
        total: total,
        vatRate: vatRate,
        number: generateInvoiceNumber(),
        createdAt: new Date().toISOString(),
        id: Date.now().toString()
    };

    appState.invoices.push(invoiceData);
    
    // Зберігаємо в localStorage (основний спосіб)
    await saveAppState();
    
    // Спробуємо синхронізувати з Back4App (опціонально, у фоні)
    try {
        await api.saveInvoice(invoiceData);
    } catch (error) {
        // Не критично - дані вже в localStorage
        console.debug('Back4App sync failed (не критично):', error.message);
    }
    generateInvoicePDF(invoiceData);
    closeInvoiceModal();
    
    tg.showAlert('Рахунок успішно згенеровано!');
    updateAnalytics();
    renderInvoicesList();
}

function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const count = appState.invoices.length + 1;
    return `INV-${year}-${String(count).padStart(4, '0')}`;
}

function generateInvoicePDF(data) {
    const typeNames = {
        invoice: 'Рахунок-фактура',
        act: 'Акт наданих послуг',
        'invoice-foreign': 'Інвойс',
        receipt: 'Квитанція'
    };

    let content = `${typeNames[data.type]}\n`;
    content += `Номер: ${data.number}\n`;
    content += `Дата: ${formatDate(data.date)}\n\n`;
    content += `Клієнт: ${data.clientName}\n`;
    if (data.clientTaxId) {
        content += `ІПН/ЄДРПОУ: ${data.clientTaxId}\n`;
    }
    content += `\nПозиції:\n`;
    content += `${'Назва'.padEnd(30)} ${'Кільк.'.padEnd(10)} ${'Ціна'.padEnd(15)} ${'Сума'.padEnd(15)}\n`;
    content += '-'.repeat(70) + '\n';
    
    data.items.forEach(item => {
        const sum = item.quantity * item.price;
        content += `${item.name.substring(0, 28).padEnd(30)} ${item.quantity.toString().padEnd(10)} ${item.price.toFixed(2).padEnd(15)} ${sum.toFixed(2).padEnd(15)}\n`;
    });
    
    content += '\n';
    content += `Підсумок без ПДВ: ${data.subtotal.toFixed(2)} ₴\n`;
    if (data.vatRate > 0) {
        content += `ПДВ (${data.vatRate}%): ${data.vat.toFixed(2)} ₴\n`;
    }
    content += `ВСЬОГО: ${data.total.toFixed(2)} ₴\n`;

    createAndDownloadDocx(content, `${typeNames[data.type]}_${data.number}.docx`);
}

function renderInvoicesList() {
    const list = document.getElementById('invoicesList');
    if (!list) return;
    
    const typeNames = {
        invoice: 'Рахунок-фактура',
        act: 'Акт',
        'invoice-foreign': 'Інвойс',
        receipt: 'Квитанція'
    };

    list.innerHTML = appState.invoices.slice(-10).reverse().map(inv => `
        <div class="document-item">
            <div class="document-info">
                <h4>${typeNames[inv.type]} ${inv.number}</h4>
                <p>${inv.clientName} • ${formatDate(inv.date)} • ${inv.total.toFixed(2)} ₴</p>
            </div>
            <div class="document-actions">
                <button class="btn-secondary" onclick="regenerateInvoice('${inv.id}')">Повторити</button>
            </div>
        </div>
    `).join('');
}

window.regenerateInvoice = function(id) {
    const invoice = appState.invoices.find(i => i.id === id);
    if (invoice) {
        generateInvoicePDF(invoice);
    }
};

function renderContractsList() {
    const list = document.getElementById('contractsList');
    if (!list) return;
    
    const contractTypeNames = {
        services: 'Договір про послуги',
        rent: 'Договір оренди',
        sale: 'Договір купівлі-продажу',
        employment: 'Трудовий договір',
        confidentiality: 'Угода про конфіденційність'
    };

    if (appState.contracts.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Договорів ще немає. Створіть перший договір!</p>';
        return;
    }

    list.innerHTML = appState.contracts.slice(-10).reverse().map(contract => `
        <div class="document-item">
            <div class="document-info">
                <h4>${contractTypeNames[contract.type] || contract.type}</h4>
                <p>${contract.counterpartyName || contract.tenantName || 'не вказано'} • ${formatDate(contract.createdAt)} • ${contract.amount ? contract.amount.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' }) : 'не вказано'}</p>
            </div>
            <div class="document-actions">
                <button class="btn-secondary" onclick="regenerateContract('${contract.id}')">Завантажити</button>
            </div>
        </div>
    `).join('');
}

window.regenerateContract = function(id) {
    const contract = appState.contracts.find(c => c.id === id);
    if (contract) {
        generateContractPDF(contract);
    } else {
        tg.showAlert('Договір не знайден');
    }
};

// Initialize Analytics
function initializeAnalytics() {
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('taxSystem').addEventListener('change', (e) => {
        appState.taxSystem = e.target.value;
        saveAppState();
        updateAnalytics();
    });
    
    document.getElementById('taxSystem').value = appState.taxSystem;
    updateAnalytics();
}

function updateAnalytics() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate monthly income from invoices
    const monthlyInvoices = appState.invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
    });
    
    const monthlyIncome = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
    
    // Calculate tax based on system
    let taxRate = 0.05; // 5% default
    if (appState.taxSystem === 'single-10') taxRate = 0.10;
    else if (appState.taxSystem === 'general') taxRate = 0.20;
    
    const monthlyTax = monthlyIncome * taxRate;
    
    // Year forecast (average monthly * 12)
    const allInvoices = appState.invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getFullYear() === currentYear;
    });
    const avgMonthly = allInvoices.length > 0 
        ? allInvoices.reduce((sum, inv) => sum + inv.total, 0) / (currentMonth + 1)
        : 0;
    const yearForecast = avgMonthly * 12;
    
    document.getElementById('monthlyIncome').textContent = 
        monthlyIncome.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' });
    document.getElementById('monthlyTax').textContent = 
        monthlyTax.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' });
    document.getElementById('yearForecast').textContent = 
        yearForecast.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' });
    
    // Update chart
    updateIncomeChart();
}

function updateIncomeChart() {
    const canvas = document.getElementById('incomeChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;
    
    // Simple bar chart
    const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const monthlyData = months.map((_, index) => {
        const monthInvoices = appState.invoices.filter(inv => {
            const invDate = new Date(inv.date);
            return invDate.getMonth() === index && invDate.getFullYear() === currentYear;
        });
        return monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
    });
    
    const maxValue = Math.max(...monthlyData, 1);
    const barWidth = canvas.width / 12;
    const barHeight = canvas.height - 40;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-button-color') || '#2481cc';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-text-color') || '#000000';
    
    ctx.fillStyle = primaryColor;
    
    monthlyData.forEach((value, index) => {
        const height = (value / maxValue) * barHeight;
        const x = index * barWidth + barWidth * 0.1;
        const y = canvas.height - height - 20;
        
        ctx.fillRect(x, y, barWidth * 0.8, height);
        
        // Month labels
        ctx.fillStyle = textColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(months[index], x + barWidth * 0.4, canvas.height - 5);
        ctx.fillStyle = primaryColor;
    });
}

function exportToExcel() {
    // Simple CSV export (in real app, use proper Excel library)
    let csv = 'Дата,Тип,Клієнт,Сума\n';
    
    appState.invoices.forEach(inv => {
        csv += `${inv.date},${inv.type},${inv.clientName},${inv.total}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Аналітика_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    tg.showAlert('Дані експортовано у CSV файл!');
}

// Initialize Signing
function initializeSigning() {
    document.getElementById('generateSignLinkBtn').addEventListener('click', generateSignLink);
    document.getElementById('documentUpload').addEventListener('change', handleDocumentUpload);
    renderPendingSignatures();
}

function handleDocumentUpload(e) {
    const file = e.target.files[0];
    if (file) {
        tg.showAlert('Документ завантажено! Тепер введіть email контрагента та згенеруйте посилання.');
    }
}

async function generateSignLink() {
    const email = document.getElementById('signerEmail').value;
    if (!email) {
        tg.showAlert('Будь ласка, введіть email контрагента');
        return;
    }
    
    if (appState.subscription === 'free') {
        tg.showAlert('Підписання документів доступне тільки в платних пакетах. Оновіть підписку!');
        return;
    }
    
    const linkId = Date.now().toString();
    const signLink = {
        id: linkId,
        email: email,
        createdAt: new Date().toISOString(),
        status: 'pending',
        documentName: 'Документ.pdf'
    };
    
    appState.documents.push(signLink);
    
    // Зберігаємо в localStorage (основний спосіб)
    await saveAppState();
    
    // Спробуємо синхронізувати з Back4App (опціонально, у фоні)
    try {
        await api.saveDocument(signLink);
    } catch (error) {
        // Не критично - дані вже в localStorage
        console.debug('Back4App sync failed (не критично):', error.message);
    }
    const signUrl = `https://yourdomain.com/sign/${linkId}`;
    tg.showAlert(`Посилання згенеровано:\n${signUrl}\n\nВідправте його контрагента для підписання.`);
    
    document.getElementById('signerEmail').value = '';
    renderPendingSignatures();
}

function renderPendingSignatures() {
    const list = document.getElementById('signaturesList');
    if (!list) return;
    
    const pending = appState.documents.filter(doc => doc.status === 'pending');
    
    if (pending.length === 0) {
        list.innerHTML = '<p style="color: var(--tg-theme-hint-color); text-align: center; padding: 20px;">Немає документів, що очікують підпису</p>';
        return;
    }
    
    list.innerHTML = pending.map(doc => `
        <div class="signature-item">
            <div>
                <strong>${doc.documentName}</strong>
                <p style="font-size: 12px; color: var(--tg-theme-hint-color); margin-top: 5px;">
                    ${doc.email} • ${formatDate(doc.createdAt)}
                </p>
            </div>
            <span style="padding: 4px 12px; background: var(--warning-color); border-radius: 12px; font-size: 12px;">
                Очікує
            </span>
        </div>
    `).join('');
}

// Initialize Subscription
function initializeSubscription() {
    document.getElementById('subscribeProBtn').addEventListener('click', () => {
        subscribeToPlan('pro');
    });
    
    document.getElementById('subscribeBusinessBtn').addEventListener('click', () => {
        subscribeToPlan('business');
    });
}

function subscribeToPlan(plan) {
    // In real app, integrate with payment provider
    // For now, activate directly for testing
    appState.subscription = plan;
    saveAppState();
    updateSubscriptionBadge();
    
    tg.showAlert(`Поздоровляємо! Вас активовано підписку "${plan === 'pro' ? 'PRO' : 'BUSINESS'}". Тепер у вас є доступ до генератора договорів!`);
}

function updateSubscriptionBadge() {
    const badge = document.getElementById('subscriptionBadge');
    if (badge) {
        badge.textContent = appState.subscription.toUpperCase();
        
        if (appState.subscription === 'pro') {
            badge.style.background = 'rgba(255, 193, 7, 0.3)';
        } else if (appState.subscription === 'business') {
            badge.style.background = 'rgba(40, 167, 69, 0.3)';
        }
    }
    
    // Перезавантажити карточки договорів при зміні підписки
    initializeContracts();
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Show loading
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}

// Render invoices list on load
setTimeout(() => {
    renderInvoicesList();
}, 100);

// Unified blob download helper that works in Telegram WebApp and browsers
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);

    // 1) FileSaver (якщо є)
    if (typeof saveAs !== 'undefined') {
        try {
            saveAs(blob, filename);
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            return;
        } catch (e) {
            console.debug('saveAs failed:', e.message);
        }
    }

    // 2) Telegram openLink як спроба відкрити у зовнішньому браузері
    try {
        if (window.Telegram?.WebApp?.openLink) {
            console.log('[download] using Telegram.openLink fallback');
            window.Telegram.WebApp.openLink(url);
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            return;
        }
    } catch (e) {
        console.debug('openLink fallback failed:', e.message);
    }

    // 3) Прямий клік по посиланню
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return;
    } catch (e) {
        console.debug('anchor download failed:', e.message);
    }

    // 4) Відкрити у новій вкладці/браузері (де є менеджер завантажень)
    try {
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return;
    } catch (e) {
        console.debug('window.open failed:', e.message);
    }

    // 5) Останній шанс: скопіювати посилання у буфер та показати alert
    try {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(url).catch(() => {});
        }
    } catch (e) {}
    if (typeof tg !== 'undefined' && tg?.showAlert) {
        tg.showAlert('Не вдалося автоматично завантажити файл. Посилання на файл скопійовано, вставте його у браузер.');
    } else {
        alert('Не вдалося автоматично завантажити файл. Посилання на файл скопійовано, вставте його у браузер.');
    }
}

// Create and download DOCX file function
async function createAndDownloadDocx(content, filename) {
    try {
        console.log('[contract] createAndDownloadDocx start', { filename });
        // Check if docx library is available from CDN
        if (typeof docx !== 'undefined') {
            console.log('[contract] docx available, building document');
            // Split content by lines
            const lines = content.split('\n');
            const children = [];

            lines.forEach((line, index) => {
                // Detect if line is a title/header (uppercase, short, or ends with colon)
                const isTitle = line.length < 60 && (line === line.toUpperCase() || line.includes(':'));
                const isEmpty = line.trim() === '';
                
                // Create paragraph with proper formatting
                const paragraph = new docx.Paragraph({
                    text: line || '',
                    spacing: { 
                        line: 280,
                        after: isEmpty ? 100 : 0
                    },
                    alignment: isTitle && !line.includes(':') ? docx.AlignmentType.CENTER : docx.AlignmentType.JUSTIFIED,
                    indent: {
                        left: isEmpty ? 0 : 720, // 0.5 inch indent for normal text
                        right: 720
                    },
                    font: {
                        name: 'Calibri',
                        size: 22 // 11pt
                    }
                });

                children.push(paragraph);
            });

            const doc = new docx.Document({
                sections: [{
                    properties: {
                        page: {
                            margins: {
                                top: 1440,    // 1 inch
                                bottom: 1440,
                                left: 1440,
                                right: 1440
                            }
                        }
                    },
                    children: children
                }]
            });

            try {
                const blob = await docx.Packer.toBlob(doc);
                console.log('DOCX blob created, saving file');
                triggerDownload(blob, filename);
            } catch (err) {
                console.error('docx pack error:', err);
                if (typeof tg !== 'undefined' && tg?.showAlert) {
                    tg.showAlert('Не вдалося створити DOCX. Спробуємо текстовий файл.');
                }
                const fallbackBlob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                triggerDownload(fallbackBlob, filename.replace('.docx', '.txt'));
            }
        } else {
            console.warn('[contract] docx library not available, falling back to raw blob');
            // Fallback: create blob from text
            const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8' });
            triggerDownload(blob, filename);
        }
    } catch (error) {
        console.error('Error creating DOCX:', error);
        // Fallback to text file
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        triggerDownload(blob, filename.replace('.docx', '.txt'));
    }
}

// Global function for debugging on mobile
window.debugAppState = function() {
    console.log('Current appState:', appState);
    console.log('Subscription:', appState.subscription);
    console.log('Monthly count:', getMonthlyDocumentCount());
    console.log('Contracts:', appState.contracts);
    return appState;
};

window.reinitializeContracts = function() {
    console.log('Manually reinitializing contracts');
    initializeContracts();
};

window.testToggleRentFields = function() {
    console.log('Testing toggleContractFields');
    const basicFields = document.getElementById('basicContractFields');
    const rentFields = document.getElementById('rentFields');
    console.log('basicFields:', basicFields);
    console.log('rentFields:', rentFields);
    toggleContractFields(true);
    console.log('After toggle to rent:');
    console.log('basicFields.style.display:', basicFields?.style.display);
    console.log('rentFields.style.display:', rentFields?.style.display);
};

// --- Simple mobile-first modal/button handlers ---
function simpleOpenContractModal(typeId = null) {
    const modal = document.getElementById('contractModal');
    const form = document.getElementById('contractForm');
    if (form) form.reset();
    if (typeId) {
        const t = document.getElementById('contractType');
        if (t) t.value = typeId;
    }
    if (modal) {
        modal.style.display = 'flex';
        // small delay to allow styles to apply
        setTimeout(() => {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
            // focus first input to trigger keyboard on mobile
            try {
                const first = modal.querySelector('input, select, textarea, button');
                if (first && typeof first.focus === 'function') first.focus();
            } catch (e) {}
        }, 10);
    }
}

function simpleCloseContractModal() {
    const modal = document.getElementById('contractModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            try { modal.style.display = 'none'; } catch (e) {}
            document.body.classList.remove('modal-open');
        }, 150);
    }
}

function attachSimpleMobileHandlers() {
    // Remove old listeners by replacing nodes with clones
    const replaceNode = (sel) => {
        const el = document.querySelector(sel);
        if (el && el.parentNode) {
            try { el.parentNode.replaceChild(el.cloneNode(true), el); } catch (e) {}
        }
    };

    // Buttons
    replaceNode('#newContractBtn');
    replaceNode('#closeModal');
    replaceNode('#cancelBtn');

    const newBtn = document.getElementById('newContractBtn');
    if (newBtn) {
        newBtn.addEventListener('click', (e) => { e.stopPropagation(); simpleOpenContractModal(); });
        newBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); simpleOpenContractModal(); }, { passive: false });
    }

    const closeEl = document.getElementById('closeModal');
    if (closeEl) {
        closeEl.addEventListener('click', (e) => { e.stopPropagation(); simpleCloseContractModal(); });
        closeEl.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); simpleCloseContractModal(); }, { passive: false });
    }

    const cancelEl = document.getElementById('cancelBtn');
    if (cancelEl) {
        cancelEl.addEventListener('click', (e) => { e.stopPropagation(); simpleCloseContractModal(); });
        cancelEl.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); simpleCloseContractModal(); }, { passive: false });
    }

    // Contract type cards (may be generated dynamically)
    const setupCards = () => {
        const cards = document.querySelectorAll('.contract-type-card');
        if (!cards || cards.length === 0) return false;
        cards.forEach(card => {
            const typeId = card.dataset?.type;
            // replace card to remove previous listeners
            try { card.parentNode.replaceChild(card.cloneNode(true), card); } catch (e) {}
        });
        // re-query after clone
        document.querySelectorAll('.contract-type-card').forEach(card => {
            const typeId = card.dataset?.type;
            card.addEventListener('click', (e) => { e.stopPropagation(); simpleOpenContractModal(typeId); });
            card.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); simpleOpenContractModal(typeId); }, { passive: false });
            try { card.tabIndex = 0; card.setAttribute('role', 'button'); } catch (e) {}
        });
        return true;
    };

    // Try to setup cards now; if none, retry a few times (they may be rendered later)
    let attempts = 0;
    const trySetup = () => {
        attempts++;
        const ok = setupCards();
        if (!ok && attempts < 8) setTimeout(trySetup, 300);
    };
    trySetup();
}

// Attach simplified handlers after initial render (mobile-first)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { attachSimpleMobileHandlers(); }, 800);
});

// Ensure global functions are properly exposed
document.addEventListener('DOMContentLoaded', () => {
    // The robust openContractModal and closeContractModal are defined globally above
    // Make sure they are available on window for onclick handlers
    if (typeof window.openContractModal === 'undefined' || window.openContractModal === simpleOpenContractModal) {
        // Skip - use the robust global functions
    }
});



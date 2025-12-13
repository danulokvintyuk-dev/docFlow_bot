//7561904266:AAFjav_tANptvTghfFr7Z-SnUJcT-dqcGb4
document.addEventListener('DOMContentLoaded', function() {
    const subscribeBtn = document.getElementById('subscribeProBtn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', async () => {
            try {
                const resp = await fetch('/api/create-subscription-link', { method: 'POST' });
                const result = await resp.json();
                if (result.url) {
                    window.open(result.url, '_blank');
                } else {
                    alert('Не вдалося отримати платіжне посилання.');
                }
            } catch (e) {
                alert('Помилка створення платіжного посилання: ' + e.message);
            }
        });
    }
});
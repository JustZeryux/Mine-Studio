// ==========================================
// 1. ESTIMADOR DE HARDWARE (hardware-estimator.js)
// ==========================================
window.HardwareEstimator = {
    init: function() {
        console.log("🌡️ Estimador de Hardware iniciado");
        this.injectUI();
        this.setupHook();
    },

    injectUI: function() {
        // Buscamos el contenedor del carrito (ajusta '.cart-container' si tu clase es distinta)
        const cartSidebar = document.querySelector('.cart-container') || document.body;
        
        const estimatorHtml = `
            <div id="hw-estimator-panel" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px; margin-top: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #fff; font-size: 0.9rem;"><i class="ph-fill ph-cpu"></i> RAM Estimada</strong>
                    <span id="hw-ram-text" style="color: var(--accent); font-weight: bold;">2.0 GB</span>
                </div>
                <div style="width: 100%; background: #27272a; border-radius: 10px; height: 10px; overflow: hidden;">
                    <div id="hw-ram-bar" style="width: 20%; height: 100%; background: #10b981; transition: all 0.3s ease;"></div>
                </div>
                <p id="hw-warning" style="font-size: 0.75rem; color: var(--muted); margin-top: 8px; margin-bottom: 0;">Rendimiento óptimo para PCs de gama baja.</p>
            </div>
        `;
        
        // Lo inyectamos al final del carrito
        if (document.querySelector('.cart-header')) {
            document.querySelector('.cart-header').insertAdjacentHTML('afterend', estimatorHtml);
        }
    },

    setupHook: function() {
        // Interceptamos la actualización del carrito
        const originalUpdate = window.updateCartUI;
        window.updateCartUI = () => {
            if(typeof originalUpdate === 'function') originalUpdate();
            this.calculate();
        };
    },

    calculate: function() {
        let baseRamMB = 2048; // 2GB base para Vanilla
        let totalMods = window.modpackCart.length;

        window.modpackCart.forEach(mod => {
            baseRamMB += 30; // 30MB base por cada mod
            
            // Verificamos categorías si existen
            if (mod.categories) {
                if (mod.categories.includes('worldgen') || mod.categories.includes('biome')) baseRamMB += 150;
                if (mod.categories.includes('shader')) baseRamMB += 400;
                if (mod.categories.includes('optimization')) baseRamMB -= 50; // ¡Optimiza!
            }
        });

        // Aseguramos un mínimo
        if (baseRamMB < 1024) baseRamMB = 1024;

        const gb = (baseRamMB / 1024).toFixed(1);
        document.getElementById('hw-ram-text').innerText = `${gb} GB`;

        const bar = document.getElementById('hw-ram-bar');
        const warning = document.getElementById('hw-warning');
        
        let percentage = (baseRamMB / 8192) * 100; // Tomamos 8GB como el 100%
        if (percentage > 100) percentage = 100;
        bar.style.width = `${percentage}%`;

        // Colores y alertas
        if (gb <= 3) {
            bar.style.background = '#10b981'; // Verde
            warning.innerText = "Súper ligero. Cualquier PC patata puede correrlo.";
            warning.style.color = '#10b981';
        } else if (gb <= 5) {
            bar.style.background = '#f59e0b'; // Naranja
            warning.innerText = "Peso medio. Necesitarás al menos 8GB de RAM física.";
            warning.style.color = '#f59e0b';
        } else {
            bar.style.background = '#ef4444'; // Rojo
            warning.innerText = "¡Peligro! Modpack ultrapesado. Requiere PC de la NASA.";
            warning.style.color = '#ef4444';
        }
    }
};

window.addEventListener('load', () => setTimeout(() => window.HardwareEstimator.init(), 1000));

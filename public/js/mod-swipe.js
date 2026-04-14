// ==========================================
// 2. MOD SWIPE (mod-swipe.js) - Conectado a la Ruleta
// ==========================================
window.ModSwipe = {
    currentMods: [],
    currentIndex: 0,

    init: function() {
        console.log("🔥 Mod Swipe (Ruleta) iniciado");
        this.bindExistingButton();
        this.injectModal();
    },

    bindExistingButton: function() {
        // En lugar de inyectar uno nuevo, usamos tu botón "Ruleta de Retos" que ya existe en tu HTML
        const btnRuleta = document.getElementById('btn-randomizer');
        if (btnRuleta) {
            btnRuleta.onclick = () => this.startSwipe();
        } else {
            console.warn("No se encontró el botón de la Ruleta (#btn-randomizer).");
        }
    },

    injectModal: function() {
        const btn = `<button id="btn-open-swipe" class="btn btn-primary" style="margin-left: 10px; background: linear-gradient(135deg, #ec4899, #f43f5e); border:none;"><i class="ph-bold ph-cards"></i> Descubrir Mods</button>`;
        // Inyectar en la barra superior (junto a los filtros)
        const topBar = document.querySelector('.search-bar') || document.body;
        topBar.insertAdjacentHTML('beforeend', btn);

        document.getElementById('btn-open-swipe').onclick = () => this.startSwipe();
    },

    injectModal: function() {
        const modal = `
            <div id="swipe-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; justify-content:center; align-items:center; flex-direction:column; backdrop-filter: blur(10px);">
                <button onclick="document.getElementById('swipe-modal').style.display='none'" style="position:absolute; top:20px; right:30px; background:none; border:none; color:white; font-size:2rem; cursor:pointer;"><i class="ph-bold ph-x"></i></button>
                
                <div id="swipe-card" style="background:#18181b; width:350px; height:500px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); overflow:hidden; display:flex; flex-direction:column; position:relative; transition: transform 0.3s ease;">
                    <div id="swipe-banner" style="height:200px; background-size:cover; background-position:center;"></div>
                    <div style="padding:20px; flex:1; text-align:center;">
                        <img id="swipe-icon" src="" style="width:80px; height:80px; border-radius:16px; margin-top:-60px; border:4px solid #18181b; background:#27272a;">
                        <h2 id="swipe-title" style="color:white; margin:10px 0 5px 0;">Cargando...</h2>
                        <p id="swipe-desc" style="color:var(--muted); font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical;"></p>
                    </div>
                </div>

                <div style="display:flex; gap:30px; margin-top:30px;">
                    <button id="btn-swipe-left" class="hover-scale" style="width:70px; height:70px; border-radius:50%; border:none; background:#ef4444; color:white; font-size:2rem; cursor:pointer; box-shadow:0 5px 15px rgba(239, 68, 68, 0.4);"><i class="ph-bold ph-x"></i></button>
                    <button id="btn-swipe-right" class="hover-scale" style="width:70px; height:70px; border-radius:50%; border:none; background:#10b981; color:white; font-size:2rem; cursor:pointer; box-shadow:0 5px 15px rgba(16, 185, 129, 0.4);"><i class="ph-fill ph-heart"></i></button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);

        document.getElementById('btn-swipe-left').onclick = () => this.nextMod();
        document.getElementById('btn-swipe-right').onclick = () => {
            this.addToCart();
            this.nextMod();
        };
    },

    startSwipe: async function() {
        document.getElementById('swipe-modal').style.display = 'flex';
        document.getElementById('swipe-title').innerText = 'Buscando mods épicos...';
        
        // Obtenemos versión del select global
        const version = document.getElementById('version-select') ? document.getElementById('version-select').value : '1.20.1';
        
        try {
            // Buscamos mods ordenados por "random" o "follows"
            const res = await fetch(`https://api.modrinth.com/v2/search?limit=20&facets=[["versions:${version}"]]&index=random`);
            const data = await res.json();
            this.currentMods = data.hits;
            this.currentIndex = 0;
            this.renderCurrentMod();
        } catch(e) {
            console.error(e);
        }
    },

    renderCurrentMod: function() {
        if(this.currentIndex >= this.currentMods.length) {
            document.getElementById('swipe-modal').style.display = 'none';
            alert("¡No hay más mods por ahora! Revisa tu carrito.");
            return;
        }

        const mod = this.currentMods[this.currentIndex];
        const icon = mod.icon_url || 'https://placehold.co/80x80/18181b/ffffff?text=M';
        const banner = (mod.gallery && mod.gallery.length > 0) ? mod.gallery[0] : icon;

        document.getElementById('swipe-banner').style.backgroundImage = `url('${banner}')`;
        document.getElementById('swipe-icon').src = icon;
        document.getElementById('swipe-title').innerText = mod.title;
        document.getElementById('swipe-desc').innerText = mod.description;
    },

    nextMod: function() {
        const card = document.getElementById('swipe-card');
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.currentIndex++;
            this.renderCurrentMod();
            card.style.transform = 'scale(1)';
        }, 150);
    },

    addToCart: function() {
        const mod = this.currentMods[this.currentIndex];
        // Usamos la API de StudioPro para agregar dependencias automáticas si existe
        if(window.StudioPro && window.StudioPro.smartAddToCart) {
            window.StudioPro.smartAddToCart({ id: mod.project_id, title: mod.title, type: mod.project_type, icon: mod.icon_url });
        } else {
            window.modpackCart.push({ id: mod.project_id, title: mod.title, type: mod.project_type, icon: mod.icon_url });
            window.updateCartUI();
        }
    }
};

window.addEventListener('load', () => setTimeout(() => window.ModSwipe.init(), 1200));

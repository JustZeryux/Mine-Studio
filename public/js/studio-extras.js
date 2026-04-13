// ==========================================
// ESTUDIO PRO EXTRAS (studio-extras.js)
// ==========================================

window.StudioPro = {
    settings: {
        autoDependencies: localStorage.getItem('setting_autoDep') === 'true' || false,
    },

    init: function() {
        console.log("🚀 Studio Pro Extras Iniciado");
        this.injectSettingsUI();
        this.setupAutoSave();
        this.injectSmartUpgradeButton();
        this.checkDraftOnLoad();
    },

    // ------------------------------------------
    // 1. SISTEMA DE PREFERENCIAS
    // ------------------------------------------
    injectSettingsUI: function() {
        // Inyectamos un botón de engranaje flotante
        const settingsBtn = `
            <button id="btn-pro-settings" class="hover-scale" style="position: fixed; bottom: 20px; left: 20px; z-index: 1000; background: #27272a; color: white; border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                <i class="ph-fill ph-gear" style="font-size: 1.5rem;"></i>
            </button>
        `;
        document.body.insertAdjacentHTML('beforeend', settingsBtn);

        // Inyectamos el Modal de Configuraciones
        const settingsModal = `
            <div id="pro-settings-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1001; justify-content: center; align-items: center; backdrop-filter: blur(5px);">
                <div style="background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 30px; width: 90%; max-width: 400px; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;"><i class="ph-fill ph-sparkle" style="color: #6366f1;"></i> Ajustes Pro</h2>
                        <i id="close-pro-settings" class="ph-bold ph-x hover-scale" style="cursor: pointer; font-size: 1.2rem;"></i>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px;">
                        <div>
                            <strong style="display: block; margin-bottom: 5px;">Auto-Dependencias</strong>
                            <span style="font-size: 0.8rem; color: var(--muted);">Descarga automáticamente las librerías necesarias al agregar un mod.</span>
                        </div>
                        <input type="checkbox" id="toggle-auto-dep" ${this.settings.autoDependencies ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', settingsModal);

        // Eventos
        document.getElementById('btn-pro-settings').onclick = () => document.getElementById('pro-settings-modal').style.display = 'flex';
        document.getElementById('close-pro-settings').onclick = () => document.getElementById('pro-settings-modal').style.display = 'none';
        
        document.getElementById('toggle-auto-dep').onchange = (e) => {
            this.settings.autoDependencies = e.target.checked;
            localStorage.setItem('setting_autoDep', e.target.checked);
        };
    },

    // ------------------------------------------
    // 2. AUTOGUARDADO (Borradores)
    // ------------------------------------------
    setupAutoSave: function() {
        // Interceptamos tu función original de updateCartUI para guardar en cada cambio
        if (typeof window.updateCartUI === 'function') {
            const originalUpdateCartUI = window.updateCartUI;
            window.updateCartUI = function() {
                originalUpdateCartUI(); // Ejecuta tu código original
                localStorage.setItem('modpackDraft', JSON.stringify(window.modpackCart)); // Guarda el borrador
            };
        }
    },

    checkDraftOnLoad: function() {
        const draft = localStorage.getItem('modpackDraft');
        if (draft) {
            const parsedDraft = JSON.parse(draft);
            if (parsedDraft.length > 0 && window.modpackCart.length === 0) {
                if (confirm(`💾 Tienes un modpack sin terminar con ${parsedDraft.length} mods guardado localmente.\n\n¿Quieres restaurarlo?`)) {
                    window.modpackCart = parsedDraft;
                    if(typeof window.updateCartUI === 'function') window.updateCartUI();
                } else {
                    localStorage.removeItem('modpackDraft');
                }
            }
        }
    },

    // ------------------------------------------
    // 3. AUTO-DEPENDENCIAS (Smart Add)
    // ------------------------------------------
    smartAddToCart: async function(modItem) {
        // 1. Agregar el mod principal
        if (!window.modpackCart.some(c => c.id === modItem.id)) {
            window.modpackCart.push(modItem);
            window.updateCartUI();
        } else {
            return; // Ya está en el carrito
        }

        // 2. Si la opción está apagada, terminamos aquí
        if (!this.settings.autoDependencies) return;

        // 3. Buscar dependencias en Modrinth
        try {
            const res = await fetch(`https://api.modrinth.com/v2/project/${modItem.id}/dependencies`);
            if(!res.ok) return;
            const deps = await res.json();
            
            let addedCount = 0;
            const projectIds = deps.projects.filter(d => d.dependency_type === "required").map(d => d.project_id);
            
            if(projectIds.length > 0) {
                // Traer la info de los proyectos requeridos
                const depsRes = await fetch(`https://api.modrinth.com/v2/projects?ids=["${projectIds.join('","')}"]`);
                const depsData = await depsRes.json();
                
                depsData.forEach(depData => {
                    if (!window.modpackCart.some(c => c.id === depData.id)) {
                        window.modpackCart.push({
                            id: depData.id,
                            title: depData.title,
                            type: 'mod', // Asumimos mod por defecto para dependencias
                            icon: depData.icon_url || 'https://placehold.co/80x80/18181b/ffffff?text=M'
                        });
                        addedCount++;
                    }
                });

                if(addedCount > 0) {
                    window.updateCartUI();
                    console.log(`[Smart Add] Se agregaron ${addedCount} dependencias para ${modItem.title}`);
                    // Opcional: Podrías usar tu sistema de notificaciones aquí si tienes uno
                }
            }
        } catch(e) {
            console.error("Error buscando dependencias:", e);
        }
    },

    // ------------------------------------------
    // 4. MIGRACIÓN INTELIGENTE (Smart Upgrade)
    // ------------------------------------------
    injectSmartUpgradeButton: function() {
        // Esperamos a que el DOM cargue y buscamos el carrito
        setTimeout(() => {
            const cartHeader = document.querySelector('.cart-header'); // Ajusta este selector si tu carrito se llama diferente
            if(cartHeader) {
                const upgradeBtn = `
                    <button id="btn-smart-upgrade" class="hover-scale" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; margin-left: 10px;" title="Actualizar todos los mods a otra versión">
                        <i class="ph-bold ph-trend-up"></i> Migrar Pack
                    </button>
                `;
                cartHeader.insertAdjacentHTML('beforeend', upgradeBtn);

                document.getElementById('btn-smart-upgrade').onclick = () => this.runSmartUpgrade();
            }
        }, 1000);
    },

    runSmartUpgrade: async function() {
        if(window.modpackCart.length === 0) return alert("El carrito está vacío.");
        
        const targetVersion = prompt("¿A qué versión de Minecraft quieres migrar este modpack? (Ej: 1.20.1, 1.21)");
        if(!targetVersion) return;

        const loader = prompt("¿Qué Mod Loader? (fabric, forge, neoforge, quilt)").toLowerCase();
        if(!['fabric','forge','neoforge','quilt'].includes(loader)) return alert("Loader inválido.");

        alert("⏳ Iniciando escaneo... Esto puede tomar unos segundos. Abre la consola para ver el progreso.");
        
        let successCount = 0;
        let failCount = 0;
        let failedMods = [];

        for (let i = window.modpackCart.length - 1; i >= 0; i--) {
            const mod = window.modpackCart[i];
            try {
                // Preguntamos a Modrinth si este mod tiene archivos para la versión y loader elegidos
                const res = await fetch(`https://api.modrinth.com/v2/project/${mod.id}/version?game_versions=["${targetVersion}"]&loaders=["${loader}"]`);
                const versions = await res.json();

                if (versions.length > 0) {
                    successCount++;
                } else {
                    failCount++;
                    failedMods.push(mod.title);
                    // Si no es compatible, lo quitamos del carrito
                    window.modpackCart.splice(i, 1); 
                }
            } catch(e) {
                console.error("Error comprobando", mod.title);
            }
        }

        window.updateCartUI();
        
        let msg = `✅ Migración completada a ${targetVersion} (${loader}).\n\n`;
        msg += `🟩 ${successCount} mods compatibles mantenidos.\n`;
        msg += `🟥 ${failCount} mods incompatibles eliminados.`;
        
        if(failCount > 0) {
            msg += `\n\nMods eliminados: ${failedMods.join(', ')}`;
        }
        
        alert(msg);
    }
};

// Arrancamos todo cuando la ventana cargue
window.addEventListener('load', () => {
    window.StudioPro.init();
});

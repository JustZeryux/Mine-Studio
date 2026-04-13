// ==========================================
// 3. PRE-CONFIGURADOR (pre-configurator.js)
// ==========================================
window.PreConfigurator = {
    configs: {}, // Aquí se guardan los JSON modificados

    init: function() {
        console.log("⚙️ Pre-Configurador iniciado");
        this.injectModal();
        // Exponemos la función global para que el carrito la llame
        window.openModConfig = (modId, modTitle) => this.openSettings(modId, modTitle);
    },

    injectModal: function() {
        const modal = `
            <div id="config-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; justify-content:center; align-items:center;">
                <div style="background:#18181b; padding:30px; border-radius:15px; border: 1px solid #6366f1; width:400px;">
                    <h2 style="color:white; margin-top:0;"><i class="ph-fill ph-sliders-horizontal"></i> Configurar <span id="config-mod-title" style="color:#6366f1;"></span></h2>
                    <p style="color:var(--muted); font-size:0.85rem;">Estas opciones se inyectarán en la carpeta 'config' del ZIP.</p>
                    
                    <div style="margin-top:20px;">
                        <label style="color:white; font-size:0.9rem;">Mensaje de Bienvenida del Mod</label>
                        <input type="text" id="config-input-1" placeholder="Ej: ¡Bienvenido al server!" style="width:100%; padding:10px; background:#27272a; border:1px solid rgba(255,255,255,0.1); color:white; border-radius:8px; margin-top:5px; margin-bottom: 15px;">
                        
                        <label style="color:white; font-size:0.9rem;">Habilitar modo Difícil</label>
                        <select id="config-input-2" style="width:100%; padding:10px; background:#27272a; border:1px solid rgba(255,255,255,0.1); color:white; border-radius:8px; margin-top:5px;">
                            <option value="true">Sí (True)</option>
                            <option value="false">No (False)</option>
                        </select>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:25px;">
                        <button onclick="document.getElementById('config-modal').style.display='none'" class="btn btn-secondary">Cancelar</button>
                        <button id="btn-save-config" class="btn btn-primary">Guardar Archivo .json</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
    },

    openSettings: function(id, title) {
        document.getElementById('config-modal').style.display = 'flex';
        document.getElementById('config-mod-title').innerText = title;
        
        // Si ya había config guardada, la cargamos
        if(this.configs[id]) {
            document.getElementById('config-input-1').value = this.configs[id].welcomeMessage;
            document.getElementById('config-input-2').value = this.configs[id].hardMode;
        } else {
            document.getElementById('config-input-1').value = "";
            document.getElementById('config-input-2').value = "true";
        }

        document.getElementById('btn-save-config').onclick = () => {
            this.configs[id] = {
                welcomeMessage: document.getElementById('config-input-1').value,
                hardMode: document.getElementById('config-input-2').value
            };
            document.getElementById('config-modal').style.display = 'none';
            alert(`✅ Configuración guardada en la nube para ${title}.`);
            // NOTA: Para que esto funcione real, en tu código de JSZip deberás hacer algo como:
            // zip.file(`config/${id}.json`, JSON.stringify(window.PreConfigurator.configs[id]));
        };
    }
};

window.addEventListener('load', () => setTimeout(() => window.PreConfigurator.init(), 1000));

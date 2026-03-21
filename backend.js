require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const archiver = require('archiver'); 
const { Readable } = require('stream');
const { finished } = require('stream/promises');

// Paquetes para manejo de ZIPs
const multer = require('multer');
const AdmZip = require('adm-zip');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Asegurar carpeta temporal de exportaciones
const EXPORT_DIR = path.join(__dirname, 'temp_exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

const requireAuth = (req, res, next) => next(); // Mock Auth


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- API MIS MODPACKS ---
// Guardar un Modpack
app.post('/api/modpacks', requireAuth, async (req, res) => {
    try {
        // En un entorno real, sacarías el ownerId de req.session.user.id
        // Como estamos simulando, buscaremos el primer usuario o crearemos uno dummy
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({ data: { discordId: 'dummy123', username: 'Zeryux' }});
        }

        const { name, mcVersion, modLoader, mods, worldSettings, isPublic } = req.body;

        const newModpack = await prisma.modpack.create({
            data: {
                name,
                mcVersion,
                modLoader,
                modsData: JSON.stringify(mods), // Guardamos el array como texto JSON
                worldData: JSON.stringify(worldSettings), // Guardamos configuraciones
                isPublic: isPublic || false,
                ownerId: user.id
            }
        });

        res.json({ success: true, modpack: newModpack });
    } catch (error) {
        console.error("Error guardando modpack:", error);
        res.status(500).json({ error: "No se pudo guardar el modpack" });
    }
});

// Obtener mis Modpacks
app.get('/api/modpacks', requireAuth, async (req, res) => {
    try {
        const modpacks = await prisma.modpack.findMany({
            // En producción: where: { ownerId: req.session.user.id }
            orderBy: { createdAt: 'desc' }
        });
        res.json(modpacks);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar perfiles" });
    }
});

// --- API PRINCIPAL: ENSAMBLADO Y EXPORTACIÓN FINAL (MINEPACK STUDIO) ---
app.post('/api/export', requireAuth, async (req, res) => {
    const { mcVersion, modLoader, mods } = req.body;
    
    const buildId = `minepack_${Date.now()}`;
    const buildPath = path.join(EXPORT_DIR, buildId);
    fs.mkdirSync(buildPath, { recursive: true });

    console.log(`[MinePack] Ensamblando ${buildId} (${mods.length} items)...`);

    try {
        // 1. DESCARGAR CONTENIDO CON "MODO RESCATE"
        const downloadPromises = mods.map(async (modItem) => {
            try {
                const encodedVersion = encodeURIComponent(`["${mcVersion}"]`);
                const encodedLoader = encodeURIComponent(`["${modLoader}"]`);
                
                let baseUrl = `https://api.modrinth.com/v2/project/${modItem.id}/version`;
                let strictUrl = baseUrl + `?game_versions=${encodedVersion}`;
                
                // Solo los mods requieren Forge/Fabric. Shaders y recursos no.
                if (modItem.type === 'mod') strictUrl += `&loaders=${encodedLoader}`;

                let versionRes = await fetch(strictUrl);
                let versions = await versionRes.json();
                
                // MODO RESCATE: Si Modrinth no encuentra la versión exacta (Común en Shaders)
                // le pedimos TODAS las versiones y agarramos la más reciente.
                if (!versions || versions.length === 0) {
                    console.log(`[MinePack] Versión exacta no encontrada para ${modItem.title}. Usando Modo Rescate...`);
                    const fallbackRes = await fetch(baseUrl);
                    versions = await fallbackRes.json();
                }

                if (!versions || versions.length === 0) {
                    console.error(`[MinePack] Imposible encontrar archivo para: ${modItem.title}`);
                    return; // Salta este archivo y sigue con los demás
                }

                const fileData = versions[0].files.find(f => f.primary) || versions[0].files[0];
                
                // Crear la carpeta exacta según el tipo
                let targetFolder = 'mods';
                if (modItem.type === 'shader') targetFolder = 'shaderpacks';
                if (modItem.type === 'resourcepack') targetFolder = 'resourcepacks';

                const folderPath = path.join(buildPath, targetFolder);
                if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

                // Descargar con Buffer (100% seguro)
                const fileName = fileData.filename;
                const fileResponse = await fetch(fileData.url);
                if (!fileResponse.ok) throw new Error("Error en la descarga directa");
                
                const arrayBuffer = await fileResponse.arrayBuffer();
                fs.writeFileSync(path.join(folderPath, fileName), Buffer.from(arrayBuffer));
                
                console.log(`[MinePack] Guardado: ${fileName} en /${targetFolder}`);

            } catch (err) {
                console.error(`[Error] Falló ${modItem.title}: ${err.message}`);
            }
        });

// Esperar estrictamente a que TODOS terminen
        await Promise.all(downloadPromises);

        // --- NUEVO: CREAR ARCHIVO DE INSTRUCCIONES DETALLADO ---
        const readmePath = path.join(buildPath, 'INSTRUCCIONES.txt');
        const readmeText = `¡Tu Modpack de MinePack Studio está listo!
Version de Minecraft: ${mcVersion}
Mod Loader: ${modLoader}

=========================================
1. COMO INSTALAR EN TU PC (Para poder jugar)
=========================================
1. Instala ${modLoader} ${mcVersion} en tu cliente de Minecraft.
2. Presiona las teclas Win + R, escribe %appdata% y presiona Enter.
3. Entra a la carpeta .minecraft.
4. Pega las carpetas 'mods', 'shaderpacks' y 'resourcepacks' de este ZIP alli adentro.
5. Abre tu Launcher de Minecraft, selecciona el perfil de ${modLoader} y a jugar.

=========================================
2. COMO INSTALAR EN ATERNOS
=========================================
1. Ve a la pestana "Software" e instala ${modLoader} para la version ${mcVersion}.
2. Ve a la pestana "Archivos" (Files).
3. Entra a la carpeta de tu servidor. Si no tienes una carpeta llamada "mods", creala.
4. Extrae este ZIP en tu PC y sube el contenido de nuestra carpeta "mods" a la carpeta "mods" de Aternos.
(Nota importante: Aternos NO usa la carpeta 'shaderpacks' ni 'resourcepacks', esas son exclusivas para tu PC, por eso solo sube los mods).
5. Inicia el servidor.

=========================================
3. COMO INSTALAR EN HOSTS AVANZADOS (FalixNodes, HolyHosting, Pterodactyl)
=========================================
1. Asegurate de instalar ${modLoader} ${mcVersion} en la configuracion de tu panel.
2. Ve a "File Manager" (Gestor de Archivos).
3. Sube ESTE archivo .zip completo a la carpeta raiz (donde esta tu server.jar).
4. Haz clic derecho en el .zip y selecciona "Unarchive" (Descomprimir).
5. Inicia el servidor.
`;
        fs.writeFileSync(readmePath, readmeText);
        // --------------------------------------------------------

        // --- CREACIÓN DEL SERVER.PROPERTIES ---
        const { worldSettings } = req.body;
        if (worldSettings) {
            let serverPropsText = `# Generado por MinePack Studio
# Ajustes del Mundo
gamemode=${worldSettings.gamemode || 'survival'}
difficulty=${worldSettings.difficulty || 'normal'}
level-type=${worldSettings.levelType || 'minecraft:normal'}
generate-structures=${worldSettings.structures !== false ? 'true' : 'false'}
hardcore=${worldSettings.hardcore === true ? 'true' : 'false'}
`;
            // Solo añadir la semilla si el usuario escribió una
            if (worldSettings.seed && worldSettings.seed.trim() !== '') {
                serverPropsText += `level-seed=${worldSettings.seed}\n`;
            }

            fs.writeFileSync(path.join(buildPath, 'server.properties'), serverPropsText);
            console.log(`[MinePack] server.properties generado.`);
        }
        
        // 2. EMPAQUETAR EL ZIP
        const zipName = `Mod_Pack_${mcVersion}.zip`;
        const zipPath = path.join(EXPORT_DIR, zipName);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`[MinePack] ZIP finalizado. Enviando...`);
            res.download(zipPath, (err) => {
                // Borrar temporales
                if(fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
                if(fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            });
        });

        archive.on('error', (err) => { throw err; });
        archive.pipe(output);

        // Esto meterá SOLO las carpetas (mods, shaderpacks, resourcepacks) al ZIP
        archive.directory(buildPath, false);
        await archive.finalize();

    } catch (error) {
        console.error("[ERROR FATAL EN ENSAMBLADO]", error);
        if(!res.headersSent) res.status(500).json({ error: "Fallo el ensamblado final." });
        if(fs.existsSync(buildPath)) fs.rmSync(buildPath, { recursive: true, force: true });
    }
});

server.listen(3000, () => console.log(`🚀 MinePack Studio Híbrido Activo en http://localhost:3000`));
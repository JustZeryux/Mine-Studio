document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN DE SUPABASE ---
    // Reemplaza esto con tus datos de Configuración > API en Supabase
    const SUPABASE_URL = 'https://dndknmfpekswzgeroawu.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_secret_l2BYir2jorVAlMOPX9REYA_3FbevGn3';
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- ELEMENTOS UI PRINCIPALES ---
    const profileSection = document.querySelector('.profile-section');
    const authModal = document.getElementById('auth-modal');
    const authLocalSection = document.getElementById('auth-local-section');
    const completeProfileSection = document.getElementById('auth-complete-profile-section');

    // --- 2. CONTROL DE ESTADO EN TIEMPO REAL ---
    async function checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            const user = session.user;
            
            // Consultar la tabla de usuarios (PostgreSQL) para ver si ya completó su perfil
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                // Perfil completo: Mostrar interfaz logueada
                const defaultAvatar = 'https://crafatar.com/avatars/Steve?size=40';
                profileSection.innerHTML = `
                    <div style="text-align: right; line-height: 1.2;">
                        <span id="header-username" style="display: block; font-weight: 700;">${profile.username}</span>
                        <span style="font-size: 0.75rem; color: var(--accent);">Miembro</span>
                    </div>
                    <img src="${profile.avatar || defaultAvatar}" class="avatar" style="border-color: var(--accent);">
                    <button class="btn btn-text" id="btn-logout" style="padding: 4px; margin-left: 5px; color: var(--danger);" title="Cerrar Sesión"><i class="ph-bold ph-sign-out"></i></button>
                `;
                
                document.getElementById('btn-logout').addEventListener('click', async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                });
                
                document.getElementById('btn-open-save-modal').disabled = false;
                if(authModal) authModal.classList.add('hidden');
                
            } else {
                // Usuario autenticado por Discord/Google pero NO ha elegido Username
                authModal.classList.remove('hidden');
                authLocalSection.classList.add('hidden');
                completeProfileSection.classList.remove('hidden');
            }
        } else {
            // Usuario NO logueado
            profileSection.innerHTML = `
                <button class="btn btn-primary" id="btn-trigger-login" style="padding: 6px 16px; border-radius: 20px; font-size: 0.9rem;">
                    <i class="ph-bold ph-sign-in"></i> Iniciar Sesión
                </button>
            `;
            document.getElementById('btn-trigger-login').addEventListener('click', () => {
                authLocalSection.classList.remove('hidden');
                completeProfileSection.classList.add('hidden');
                authModal.classList.remove('hidden');
            });
            document.getElementById('btn-open-save-modal').disabled = true;
        }
    }

    // Escuchar cambios de inicio de sesión (cuando el usuario vuelve de Discord/Google)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            checkUser();
        }
    });

    // Iniciar comprobación al cargar la página
    checkUser();

    // --- 3. LÓGICA DEL FORMULARIO LOCAL (EMAIL + PASS) ---
    const authForm = document.getElementById('local-auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const usernameInput = document.getElementById('auth-username');
    const btnSubmit = document.getElementById('btn-auth-submit');
    const toggleMode = document.getElementById('toggle-auth-mode');
    
    let isRegisterMode = false;
    let usernameAvailable = false;
    let checkTimeout = null;

    if(toggleMode) {
        toggleMode.addEventListener('click', (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            if (isRegisterMode) {
                authTitle.innerHTML = '<i class="ph-bold ph-user-plus"></i> Crear Cuenta';
                authSubtitle.innerText = 'Regístrate para guardar y compartir tus modpacks.';
                usernameInput.style.display = 'block';
                usernameInput.required = true;
                btnSubmit.innerHTML = '<i class="ph-bold ph-check"></i> Registrarse';
                btnSubmit.disabled = true;
                toggleMode.innerText = 'Inicia sesión aquí';
            } else {
                authTitle.innerHTML = '<i class="ph-bold ph-user-circle"></i> Iniciar Sesión';
                authSubtitle.innerText = 'Accede a tu cuenta global de Mine-Studio.';
                usernameInput.style.display = 'none';
                usernameInput.required = false;
                btnSubmit.innerHTML = '<i class="ph-bold ph-sign-in"></i> Entrar';
                btnSubmit.disabled = false;
                toggleMode.innerText = 'Regístrate aquí';
            }
        });
    }

    // Comprobar Username Único consultando PostgreSQL directo (Supabase)
    if(usernameInput) {
        usernameInput.addEventListener('input', () => {
            const username = usernameInput.value.trim();
            usernameAvailable = false;
            btnSubmit.disabled = true;
            
            if(checkTimeout) clearTimeout(checkTimeout);
            if(username.length < 3) return;

            checkTimeout = setTimeout(async () => {
                // Buscamos en la base de datos si existe alguien con ese nombre
                const { data, error } = await supabase
                    .from('users')
                    .select('username')
                    .eq('username_lowercase', username.toLowerCase());

                if (data && data.length === 0) {
                    usernameAvailable = true;
                    if (isRegisterMode) btnSubmit.disabled = false;
                    // El usuario ESTÁ DISPONIBLE
                }
            }, 500);
        });
    }

    if(authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...';
            btnSubmit.disabled = true;

            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const username = usernameInput.value.trim();

            try {
                if (isRegisterMode) {
                    if(!usernameAvailable) throw new Error("Nombre de usuario ocupado");
                    
                    // 1. Registrar el correo en el sistema de Auth
                    const { data, error } = await supabase.auth.signUp({ email, password });
                    if (error) throw error;

                    // 2. Guardar el perfil en PostgreSQL
                    const avatarUrl = `https://crafatar.com/avatars/${username}?size=40`;
                    const { error: dbError } = await supabase.from('users').insert([{
                        id: data.user.id,
                        username: username,
                        username_lowercase: username.toLowerCase(),
                        email: email,
                        avatar: avatarUrl
                    }]);
                    if (dbError) throw dbError;

                    alert(`¡Cuenta creada! Bienvenido, ${username}.`);
                } else {
                    // Login
                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                }
                authModal.classList.add('hidden');
            } catch (error) {
                alert('❌ Error: ' + error.message);
            } finally {
                btnSubmit.innerHTML = originalText;
                btnSubmit.disabled = false;
            }
        });
    }

    // --- 4. INICIOS DE SESIÓN MULTIPLATAFORMA (OAuth) ---
    async function loginOAuth(providerName) {
        // Redirige al proveedor, y al terminar vuelve a la misma página
        await supabase.auth.signInWithOAuth({
            provider: providerName,
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
    }

    document.getElementById('btn-firebase-google')?.addEventListener('click', () => loginOAuth('google'));
    document.getElementById('btn-firebase-discord')?.addEventListener('click', () => loginOAuth('discord'));
    document.getElementById('btn-firebase-microsoft')?.addEventListener('click', () => loginOAuth('azure')); // Azure es Microsoft

    // --- 5. COMPLETAR PERFIL (Usuarios nuevos de Discord/Google) ---
    const completeProfileForm = document.getElementById('complete-profile-form');
    const completeUsernameInput = document.getElementById('complete-username');
    const btnCompleteSubmit = document.getElementById('btn-complete-submit');
    const checkIcon = document.getElementById('username-check-icon');
    const errorIcon = document.getElementById('username-error-icon');

    let completeUsernameAvailable = false;

    if(completeUsernameInput) {
        completeUsernameInput.addEventListener('input', () => {
            const username = completeUsernameInput.value.trim();
            completeUsernameAvailable = false;
            btnCompleteSubmit.disabled = true;
            checkIcon.style.display = 'none'; errorIcon.style.display = 'none';
            
            if(checkTimeout) clearTimeout(checkTimeout);
            if(username.length < 3) return;

            checkTimeout = setTimeout(async () => {
                const { data } = await supabase.from('users').select('username').eq('username_lowercase', username.toLowerCase());
                if (data && data.length === 0) {
                    completeUsernameAvailable = true;
                    btnCompleteSubmit.disabled = false;
                    checkIcon.style.display = 'block';
                } else {
                    errorIcon.style.display = 'block';
                }
            }, 500);
        });
    }

    if(completeProfileForm) {
        completeProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { session } } = await supabase.auth.getSession();
            if(!session || !completeUsernameAvailable) return;

            const password = document.getElementById('complete-password').value;
            const passwordConfirm = document.getElementById('complete-password-confirm').value;
            
            if (password !== passwordConfirm) return alert("❌ Las contraseñas no coinciden.");
            if (password.length < 6) return alert("❌ La contraseña debe tener al menos 6 caracteres.");

            btnCompleteSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Finalizando...';
            btnCompleteSubmit.disabled = true;

            const username = completeUsernameInput.value.trim();
            const avatarUrl = `https://crafatar.com/avatars/${username}?size=40`;

            try {
                // 1. Le asignamos la contraseña al usuario de Discord/Google para que pueda entrar por correo si quiere
                await supabase.auth.updateUser({ password: password });

                // 2. Guardamos su perfil en PostgreSQL
                const { error } = await supabase.from('users').insert([{
                    id: session.user.id,
                    username: username,
                    username_lowercase: username.toLowerCase(),
                    email: session.user.email,
                    avatar: avatarUrl
                }]);
                
                if (error) throw error;
                
                alert(`¡Perfil completado! Bienvenido, ${username}.`);
                window.location.reload(); // Recargamos para que quite la pantalla y muestre su perfil

            } catch (error) {
                alert('❌ Error al completar perfil: ' + error.message);
                btnCompleteSubmit.innerHTML = '<i class="ph-bold ph-check"></i> Finalizar Registro';
                btnCompleteSubmit.disabled = false;
            }
        });
    }
});

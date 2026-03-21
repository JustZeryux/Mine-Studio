document.addEventListener('DOMContentLoaded', async () => {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    
    // 1. Verificar si ya hay una sesión activa en el backend
    try {
        const res = await fetch('/api/me');
        const data = await res.json();
        
        if (data.loggedIn) {
            // Ya estamos logueados, ocultar login y mostrar panel
            authScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            window.showNotification(`Welcome back, ${data.user.username}!`, "success");
            
            // Opcional: Puedes usar data.user.avatar para actualizar la foto de perfil en el HTML después
        }
    } catch (error) {
        console.error("Error comprobando sesión:", error);
    }

    // 2. Conectar los botones sociales a las rutas reales del backend
    const btnDiscord = document.querySelector('.btn-discord');
    const btnGoogle = document.querySelector('.btn-google');
    const btnGithub = document.querySelector('.btn-github');

    if (btnDiscord) {
        btnDiscord.addEventListener('click', () => {
            btnDiscord.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Redirigiendo...';
            window.location.href = '/auth/discord';
        });
    }

    if (btnGoogle) {
        btnGoogle.addEventListener('click', () => {
            btnGoogle.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Redirigiendo...';
            window.location.href = '/auth/google';
        });
    }

    if (btnGithub) {
        btnGithub.addEventListener('click', () => {
            btnGithub.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Redirigiendo...';
            window.location.href = '/auth/github';
        });
    }

    // 3. Simular login con correo (Como no conectamos Passport-Local, esto sigue siendo visual por ahora)
    const loginForm = document.getElementById('login-form');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Autenticando...';
            btn.disabled = true;

            setTimeout(() => {
                authScreen.classList.add('hidden');
                mainApp.classList.remove('hidden');
                window.showNotification("¡Bienvenido (Local)!", "success");
            }, 1000);
        });
    }
});
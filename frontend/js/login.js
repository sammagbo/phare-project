/**
 * login.js
 * Logic for the login page of pHARe project.
 */

import { loginNotice, loginUser } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    if (!loginForm) return;

    // Sent here by a page that could not reach the auth service
    const notice = loginNotice();
    if (notice) {
        errorBox.textContent = notice;
        errorBox.style.display = 'block';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous error
        errorBox.style.display = 'none';
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Disable button to prevent double submissions
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion en cours...';

        try {
            // Using actual async backend call
            const result = await loginUser(email, password);

            if (result.success) {
                // Successful login
                window.location.href = 'phare-gestion-harcelement.html';
            } else {
                // Failed login
                errorBox.textContent = result.message || 'Identifiants incorrects.';
                errorBox.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
                
                // Visual feedback: shake the card (.login-container since the redesign; a missing one used to throw
                // here and replace the real message with « Erreur de connexion au serveur. »)
                const card = document.querySelector('.login-container') || loginForm;
                card.style.animation = 'none';
                void card.offsetWidth; // trigger reflow
                card.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
            }
        } catch (error) {
            console.error("Login exception:", error);
            errorBox.textContent = "Erreur de connexion au serveur.";
            errorBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';
        }
    });
});

// Add shake animation to the stylesheet dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
        40%, 60% { transform: translate3d(4px, 0, 0); }
    }
`;
document.head.appendChild(style);

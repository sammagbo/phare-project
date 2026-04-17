/**
 * login.js
 * Logic for the login page of pHARe project.
 */

import { loginUser } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    if (!loginForm) return;

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Clear previous error
        errorBox.style.display = 'none';
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Disable button to prevent double submissions
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion en cours...';

        // Add a slight artificial delay for a better UX feeling (simulating network request)
        setTimeout(() => {
            const success = loginUser(email, password);

            if (success) {
                // Successful login
                window.location.href = 'phare-gestion-harcelement.html';
            } else {
                // Failed login
                errorBox.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
                
                // Visual feedback: shake the card
                const card = document.querySelector('.login-card');
                card.style.animation = 'none';
                void card.offsetWidth; // trigger reflow
                card.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
            }
        }, 800);
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

// js/dialogs.js

// Inyectamos los estilos del diálogo dinámicamente para no saturar el CSS
const estilos = document.createElement('style');
estilos.textContent = `
    .custom-dialog {
        background: #111827;
        color: #f3f4f6;
        border: 1px solid #374151;
        border-radius: 16px;
        padding: 1.5rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        text-align: center;
    }
    .custom-dialog::backdrop {
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
    }
    .dialog-text {
        font-size: 1rem;
        line-height: 1.5;
        margin-bottom: 1.5rem;
        color: #d1d5db;
        white-space: pre-line;
    }
    .dialog-actions {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
    }
    .dialog-btn {
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: background 0.2s;
    }
    .dialog-btn-primary {
        background: #3b82f6;
        color: white;
    }
    .dialog-btn-primary:hover { background: #2563eb; }
    .dialog-btn-secondary {
        background: #374151;
        color: #d1d5db;
    }
    .dialog-btn-secondary:hover { background: #4b5563; }
`;
document.head.appendChild(estilos);

// Crear la estructura base del diálogo en el body
const dialogEl = document.createElement('dialog');
dialogEl.classList.add('custom-dialog');
dialogEl.innerHTML = `
    <div class="dialog-text" id="dialog-msg"></div>
    <div class="dialog-actions" id="dialog-buttons"></div>
`;
document.body.appendChild(dialogEl);

const dialogMsg = document.getElementById('dialog-msg');
const dialogButtons = document.getElementById('dialog-buttons');

// FUNCIÓN: Sustituta de alert()
export function mostrarAlerta(mensaje) {
    return new Promise((resolve) => {
        dialogMsg.textContent = mensaje;
        dialogButtons.innerHTML = `
            <button class="dialog-btn dialog-btn-primary" id="dialog-ok-btn">Aceptar</button>
        `;
        
        dialogEl.showModal();
        
        document.getElementById('dialog-ok-btn').addEventListener('click', () => {
            dialogEl.close();
            resolve();
        }, { once: true });
    });
}

// FUNCIÓN: Sustituta de confirm()
export function mostrarConfirmacion(mensaje) {
    return new Promise((resolve) => {
        dialogMsg.textContent = mensaje;
        dialogButtons.innerHTML = `
            <button class="dialog-btn dialog-btn-secondary" id="dialog-cancel-btn">Cancelar</button>
            <button class="dialog-btn dialog-btn-primary" id="dialog-confirm-btn">Confirmar</button>
        `;
        
        dialogEl.showModal();
        
        document.getElementById('dialog-confirm-btn').addEventListener('click', () => {
            dialogEl.close();
            resolve(true);
        }, { once: true });
        
        document.getElementById('dialog-cancel-btn').addEventListener('click', () => {
            dialogEl.close();
            resolve(false);
        }, { once: true });
    });
}
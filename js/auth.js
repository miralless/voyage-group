// js/auth.js

import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarAlerta } from "./dialogs.js"; // ¡IMPORTANTE!

// Elementos del HTML
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// Pasos del Formulario
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const btnBack = document.getElementById("btn-back");

// Elementos de perfil (Paso 2)
const usernameInput = document.getElementById("username");
const nombreCompletoInput = document.getElementById("nombreCompleto");
const avatarInput = document.getElementById("avatar-input");
const avatarImage = document.getElementById("avatar-image");

// Textos e interfaces
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const submitBtn = document.getElementById("submit-btn");
const toggleLink = document.getElementById("go-to-register");
const toggleText = document.getElementById("toggle-text");

let isRegisterMode = false;
let currentStep = 1; // Controla en qué pestaña del registro estamos

// Vista previa de la foto
avatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => avatarImage.src = event.target.result;
        reader.readAsDataURL(file);
    }
});

// Cambiar entre Login y Modo Registro
toggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    resetFormTabs();
});

function resetFormTabs() {
    currentStep = 1;
    if (isRegisterMode) {
        authTitle.textContent = "Crear Cuenta";
        authSubtitle.textContent = "Paso 1: Datos de acceso";
        submitBtn.textContent = "Siguiente";
        toggleText.textContent = "¿Ya tienes una cuenta?";
        toggleLink.textContent = "Inicia sesión aquí";
        step1.style.display = "block";
        step2.style.display = "none";
        usernameInput.required = false;
        nombreCompletoInput.required = false;
        passwordInput.placeholder = "Mínimo 6 caracteres"
    } else {
        authTitle.textContent = "Iniciar Sesión";
        authSubtitle.textContent = "Entra para ver los recuerdos de tus viajes, ¡o añadir nuevos!";
        submitBtn.textContent = "Entrar";
        toggleText.textContent = "¿No tienes una cuenta?";
        toggleLink.textContent = "Regístrate aquí";
        step1.style.display = "block";
        step2.style.display = "none";
        usernameInput.required = false;
        nombreCompletoInput.required = false;
        passwordInput.placeholder = "Introduce tu contraseña"
    }
}

// Botón "Volver atrás" en el paso 2
btnBack.addEventListener("click", (e) => {
    e.preventDefault();
    currentStep = 1;
    authSubtitle.textContent = "Paso 1: Datos de acceso";
    submitBtn.textContent = "Siguiente";
    step1.style.display = "block";
    step2.style.display = "none";
    usernameInput.required = false;
    nombreCompletoInput.required = false;
});

// Control del envío o avance del formulario
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!isRegisterMode) {
        // --- LOGIC: LOGIN ---
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "app.html";
        } catch (error) {
            manejarErrores(error.code);
        }
    } else {
        // --- LOGIC: REGISTRO (POR PASOS) ---
        if (currentStep === 1) {
            // Validaciones básicas antes de pasar de pestaña
            if (password.length < 6) {
                await mostrarAlerta("La contraseña debe tener al menos 6 caracteres.");
                return;
            }
            // Avanzamos al paso 2
            currentStep = 2;
            authSubtitle.textContent = "Paso 2: Personaliza tu perfil";
            submitBtn.textContent = "Finalizar Registro";
            step1.style.display = "none";
            step2.style.display = "block";
            
            // Hacemos requeridos los campos del paso 2 ahora que son visibles
            usernameInput.required = true;
            nombreCompletoInput.required = true;
        } else if (currentStep === 2) {
            const username = usernameInput.value.trim().toLowerCase();
            const nombreCompleto = nombreCompletoInput.value.trim();

            try {
                // 1. Comprobamos si el username está libre en Firestore
                const usuariosRef = collection(db, "usuarios");
                const q = query(usuariosRef, where("username", "==", username));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    await mostrarAlerta("Ese nombre de usuario ya existe. Prueba con otro.");
                    return;
                }

                // Cambiamos el texto del botón para que el usuario vea que está cargando
                submitBtn.textContent = "Subiendo perfil...";
                submitBtn.disabled = true;

                // 2. RECOGEMOS EL ARCHIVO DE LA FOTO
                let fotoPerfilUrl = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // Foto por defecto si no sube nada
                const file = avatarInput.files[0];

                if (file) {
                    // Preparamos los datos para enviar a Cloudinary (Formulario virtual)
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("upload_preset", "viajes_preset"); 

                    // Reemplaza 'TU_CLOUD_NAME' por el tuyo de la consola de Cloudinary
                    const cloudName = "dcb6sj2ox";
                    
                    // Enviamos la foto a Cloudinary
                    const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                        method: "POST",
                        body: formData
                    });

                    if (!cloudinaryResponse.ok) {
                        throw new Error("Error al subir la imagen a Cloudinary");
                    }

                    const cloudinaryData = await cloudinaryResponse.json();
                    fotoPerfilUrl = cloudinaryData.secure_url; 
                }

                // 3. CREAMOS EL USUARIO EN FIREBASE AUTH
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 4. GUARDAMOS LA FICHA EN FIRESTORE (Ahora con la URL real de Cloudinary)
                await setDoc(doc(db, "usuarios", user.uid), {
                    username: username,
                    nombreCompleto: nombreCompleto,
                    email: email,
                    fotoPerfil: fotoPerfilUrl, 
                    grupos: []
                });
                
                window.location.href = "app.html";

            } catch (error) {
                console.error(error); // Conservado
                await mostrarAlerta("Hubo un error en el registro: " + error.message);
                submitBtn.textContent = "Finalizar Registro";
                submitBtn.disabled = false;
            }
        }
    }
});

async function manejarErrores(errorCode) {
    switch (errorCode) {
        case "auth/invalid-credential": await mostrarAlerta("El correo o la contraseña son incorrectos."); break;
        case "auth/email-already-in-use": await mostrarAlerta("Este correo electrónico ya está registrado."); break;
        case "auth/invalid-email": await mostrarAlerta("El formato del correo electrónico no es válido."); break;
        default: await mostrarAlerta("Error: " + errorCode);
    }
}
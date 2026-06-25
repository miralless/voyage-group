// js/perfil.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarAlerta, mostrarConfirmacion } from "./dialogs.js"; // ¡IMPORTANTE!

// Elementos comunes de los menús (Nav/Footer)
const navUsername = document.getElementById("nav-username");
const navAvatar = document.getElementById("nav-avatar");
const footerAvatar = document.getElementById("footer-avatar");
const appLoader = document.getElementById("app-loader");
const statGroupsCount = document.getElementById("stat-groups-count");
const statPinsCount = document.getElementById("stat-pins-count");
const profileRole = document.getElementById("profile-role");

// Elementos de la ficha de perfil
const profileAvatar = document.getElementById("profile-avatar");
const profileName = document.getElementById("profile-name");
const profileUsername = document.getElementById("profile-username");
const profileEmail = document.getElementById("profile-email");
const btnLogout = document.getElementById("btn-logout");

const btnChangePhoto = document.getElementById("btn-change-photo");
const profileFileInput = document.getElementById("profile-file-input");

let currentUserId = null;

// GUARDIÁN DE SEGURIDAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUserId = user.uid;
        await cargarPerfilUsuario(user.uid);
        appLoader.classList.add("hidden");
    }
});

btnChangePhoto.addEventListener("click", () => {
    profileFileInput.click();
});

profileFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        appLoader.classList.remove("hidden");
        const loaderText = appLoader.querySelector("p");
        if (loaderText) loaderText.textContent = "Actualizando foto de perfil...";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "viajes_preset"); 

        const cloudName = "dcb6sj2ox";

        const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData
        });

        if (!cloudinaryResponse.ok) {
            throw new Error("Fallo en la respuesta del servidor de Cloudinary");
        }

        const cloudinaryData = await cloudinaryResponse.json();
        const nuevaFotoUrl = cloudinaryData.secure_url; 

        const userDocRef = doc(db, "usuarios", currentUserId);
        await updateDoc(userDocRef, {
            fotoPerfil: nuevaFotoUrl
        });

        profileAvatar.src = nuevaFotoUrl;
        footerAvatar.src = nuevaFotoUrl;

        await mostrarAlerta("¡Foto de perfil actualizada correctamente! 📸");

    } catch (error) {
        console.error("Error al cambiar la foto de perfil:", error); // Conservado
        await mostrarAlerta("No se pudo actualizar la foto de perfil.");
    } finally {
        const loaderText = appLoader.querySelector("p");
        if (loaderText) loaderText.textContent = "Cargando...";
        appLoader.classList.add("hidden");
    }
});

async function cargarPerfilUsuario(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();

            navUsername.textContent = `@${userData.username}`;
            if (userData.fotoPerfil) {
                footerAvatar.src = userData.fotoPerfil;
                profileAvatar.src = userData.fotoPerfil;
            }
            profileName.textContent = userData.nombreCompleto || "Usuario de VoyageGroup";
            profileUsername.textContent = `@${userData.username}`;
            profileEmail.textContent = userData.email;

            const totalGrupos = userData.grupos ? userData.grupos.length : 0;
            statGroupsCount.textContent = totalGrupos; 
            statPinsCount.textContent = "0";

        } else {
            console.error("No se encontró el documento del usuario."); // Conservado
        }
    } catch (error) {
        console.error("Error al obtener el perfil:", error); // Conservado
    }
}

// LÓGICA: CERRAR SESIÓN
btnLogout.addEventListener("click", async () => {
    // CAMBIO: Ahora usa nuestro modal custom de confirmación
    const confirmar = await mostrarConfirmacion("¿Estás seguro de que quieres cerrar sesión?");
    if (confirmar) {
        try {
            await signOut(auth);
            console.log("Sesión cerrada con éxito."); // Conservado
        } catch (error) {
            console.error("Error al cerrar sesión:", error); // Conservado
            await mostrarAlerta("No se pudo cerrar la sesión de forma correcta.");
        }
    }
});
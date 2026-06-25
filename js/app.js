// js/app.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, getDoc, setDoc, addDoc, collection, updateDoc, arrayUnion, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarAlerta } from "./dialogs.js"; // ¡IMPORTANTE!

// Elementos de la interfaz principal
const navUsername = document.getElementById("nav-username");
const navAvatar = document.getElementById("nav-avatar");
const footerAvatar = document.getElementById("footer-avatar");
const groupsContainer = document.getElementById("groups-container");
const btnCreateGroup = document.getElementById("btn-create-group");
const appLoader = document.getElementById("app-loader");

// Elementos de la Ventana Modal
const groupModal = document.getElementById("group-modal");
const closeModal = document.getElementById("close-modal");
const inputGroupName = document.getElementById("new-group-name");
const btnSubmitCreate = document.getElementById("btn-submit-create");

const inputJoinCode = document.getElementById("join-group-code");
const btnSubmitJoin = document.getElementById("btn-submit-join");

// Variable global para guardar el ID del usuario logueado
let currentUserId = null;

// GUARDIÁN DE SEGURIDAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUserId = user.uid;
        await cargarDatosUsuario(user.uid);
        appLoader.classList.add("hidden");
    }
});

// Cargar datos de perfil
async function cargarDatosUsuario(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            navUsername.textContent = `@${userData.username}`;
            if (userData.fotoPerfil) {
                footerAvatar.src = userData.fotoPerfil;
            }
            
            // Cargar los grupos
            cargarGruposUsuario(userData.grupos || []);
        }
    } catch (error) {
        console.error("Error al cargar datos de perfil:", error); // Conservado
    }
}

// ==========================================================================
/* CONTROL DE LA VENTANA MODAL */
// ==========================================================================
btnCreateGroup.addEventListener("click", () => groupModal.classList.add("open"));

// Cerrar si hacen clic fuera de la caja de la modal
groupModal.addEventListener("click", (e) => {
    if (e.target === groupModal) groupModal.classList.remove("open");
});

// Función auxiliar para generar un código único de 6 caracteres (Ej: WQ92LX)
function generarCodigoGrupo() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let resultado = "";
    for (let i = 0; i < 6; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
}

// ==========================================================================
/* LÓGICA: CREAR UN NUEVO GRUPO EN FIRESTORE */
// ==========================================================================
btnSubmitCreate.addEventListener("click", async () => {
    const nombreGrupo = inputGroupName.value.trim();

    if (!nombreGrupo) {
        await mostrarAlerta("Por favor, introduce un nombre para el grupo.");
        return;
    }

    try {
        btnSubmitCreate.textContent = "Creando...";
        btnSubmitCreate.disabled = true;

        const codigoUnico = generarCodigoGrupo();

        // 1. Creamos el documento del grupo en una nueva colección "grupos"
        const grupoData = {
            nombre: nombreGrupo,
            codigo: codigoUnico,
            creador: currentUserId,
            participantes: [currentUserId], 
            fechaCreacion: new Date()
        };

        const docRef = await addDoc(collection(db, "grupos"), grupoData);
        const grupoId = docRef.id;

        // 2. Vinculamos este grupo al usuario actual metiendo el ID en su array de "grupos"
        const usuarioRef = doc(db, "usuarios", currentUserId);
        await updateDoc(usuarioRef, {
            grupos: arrayUnion(grupoId) 
        });

        await mostrarAlerta(`¡Grupo "${nombreGrupo}" creado con éxito!\nCódigo de invitación: ${codigoUnico}`);
        
        // Limpiamos el formulario, cerramos la modal y recargamos el perfil para ver los cambios
        inputGroupName.value = "";
        groupModal.classList.remove("open");
        
        // Restauramos el botón
        btnSubmitCreate.textContent = "Crear Grupo";
        btnSubmitCreate.disabled = false;

        // Volvemos a cargar los datos del usuario para actualizar la lista de divs
        await cargarDatosUsuario(currentUserId);

    } catch (error) {
        console.error("Error al crear el grupo:", error); // Conservado
        await mostrarAlerta("Hubo un fallo al crear el grupo.");
        btnSubmitCreate.textContent = "Crear Grupo";
        btnSubmitCreate.disabled = false;
    }
});

// ==========================================================================
/* LÓGICA: UNIRSE A UN GRUPO EXISTENTE MEDIANTE CÓDIGO */
// ==========================================================================
btnSubmitJoin.addEventListener("click", async () => {
    const codigoIntroducido = inputJoinCode.value.trim().toUpperCase();

    if (!codigoIntroducido || codigoIntroducido.length !== 6) {
        await mostrarAlerta("Por favor, introduce un código válido de 6 caracteres.");
        return;
    }

    try {
        btnSubmitJoin.textContent = "Uniéndose...";
        btnSubmitJoin.disabled = true;

        // 1. Buscamos en la colección "grupos" el documento que tenga ese código
        const q = query(collection(db, "grupos"), where("codigo", "==", codigoIntroducido));
        const querySnapshot = await getDocs(q);

        // Si no encuentra ningún grupo con ese código, salimos
        if (querySnapshot.empty) {
            await mostrarAlerta("No se ha encontrado ningún grupo de viaje con ese código. Revísalo bien.");
            btnSubmitJoin.textContent = "Unirse";
            btnSubmitJoin.disabled = false;
            return;
        }

        const grupoDoc = querySnapshot.docs[0];
        const grupoId = grupoDoc.id;
        const grupoData = grupoDoc.data();

        // 2. CONTROL DE SEGURIDAD: Comprobar si el usuario ya forma parte del grupo
        if (grupoData.participantes && grupoData.participantes.includes(currentUserId)) {
            await mostrarAlerta(`¡Ya formas parte del grupo "${grupoData.nombre}"!`);
            inputJoinCode.value = "";
            groupModal.classList.remove("open");
            btnSubmitJoin.textContent = "Unirse";
            btnSubmitJoin.disabled = false;
            return;
        }

        // 3. VINCULACIÓN EN FIRESTORE (Doble dirección)
        const grupoRef = doc(db, "grupos", grupoId);
        await updateDoc(grupoRef, {
            participantes: arrayUnion(currentUserId)
        });

        const usuarioRef = doc(db, "usuarios", currentUserId);
        await updateDoc(usuarioRef, {
            grupos: arrayUnion(grupoId)
        });

        await mostrarAlerta(`¡Te has unido con éxito al viaje: "${grupoData.nombre}"! 🥳`);

        inputJoinCode.value = "";
        groupModal.classList.remove("open");
        
        btnSubmitJoin.textContent = "Unirse";
        btnSubmitJoin.disabled = false;

        await cargarDatosUsuario(currentUserId);

    } catch (error) {
        console.error("Error al unirse al grupo:", error); // Conservado
        await mostrarAlerta("Hubo un problema al intentar unirte al grupo.");
        btnSubmitJoin.textContent = "Unirse";
        btnSubmitJoin.disabled = false;
    }
});

// ==========================================================================
/* LÓGICA: RENDERIZAR LAS TARJETAS DE LOS GRUPOS EN LA PANTALLA */
// ==========================================================================
async function cargarGruposUsuario(listaIdsGrupos) {
    groupsContainer.innerHTML = ""; 

    if (!listaIdsGrupos || listaIdsGrupos.length === 0) {
        return;
    }

    try {
        for (const grupoId of listaIdsGrupos) {
            const grupoDocRef = doc(db, "grupos", grupoId);
            const grupoDocSnap = await getDoc(grupoDocRef);

            if (grupoDocSnap.exists()) {
                const grupoData = grupoDocSnap.data();

                const tarjeta = document.createElement("div");
                tarjeta.classList.add("group-card");
                
                tarjeta.addEventListener("click", async () => {
                    localStorage.setItem("grupoActivoId", grupoId);
                    window.location.href = "grupo.html";
                });

                tarjeta.innerHTML = `
                    <div class="group-info-left">
                        <h3>${grupoData.nombre}</h3>
                        <p>${grupoData.participantes ? grupoData.participantes.length : 1} participante(s)</p>
                    </div>
                    <div class="group-info-right">
                        <span class="group-code-badge">${grupoData.codigo}</span>
                        <p style="font-size: 0.7rem;">Código del grupo</p>
                    </div>
                `;

                groupsContainer.appendChild(tarjeta);
            }
        }
    } catch (error) {
        console.error("Error al obtener los detalles de los grupos:", error); // Conservado
        groupsContainer.innerHTML = `<p class="loading-text" style="color: #ef4444;">Error al cargar las tarjetas de los viajes.</p>`;
    }
}
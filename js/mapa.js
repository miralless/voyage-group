import { db, auth } from "./firebase-config.js";
import { doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Capturar elementos del DOM
const navUsername = document.getElementById("nav-username");
const footerAvatar = document.getElementById("footer-avatar");
const viajeTitulo = document.getElementById("viaje-titulo");
const viajeFechas = document.getElementById("viaje-fechas");
const viajeCiudadCompleta = document.getElementById("viaje-ciudad-completa");
const galeriaFotos = document.getElementById("galeria-fotos");
const btnAbandonar = document.getElementById("btn-eliminar-viaje"); // Mapeado a tu id de botón actual para que no rompa el HTML
const inputSubirFoto = document.getElementById("input-subir-foto");

// Elementos del Dialog de Zoom
const zoomModal = document.getElementById("zoom-modal");
const zoomImg = document.getElementById("zoom-img");
const btnCloseZoom = document.getElementById("btn-close-zoom");

// Elementos del Dialog de Confirmación de Abandono (Reutilizando tus modales)
const borrarModal = document.getElementById("confirmar-borrado-modal");
const btnCancelarBorrado = document.getElementById("btn-cancelar-borrado");
const btnConfirmarBorrado = document.getElementById("btn-confirmar-borrado");

const fotoModal = document.getElementById("confirmar-foto-modal");
const btnCancelarFoto = document.getElementById("btn-cancelar-foto");
const btnConfirmarFoto = document.getElementById("btn-confirmar-foto");

// Variables globales de los nuevos elementos
const zonaAdmin = document.getElementById("zona-administrador");
const btnEliminarGrupoTotal = document.getElementById("btn-eliminar-grupo-total");
const inputAddMiembroEmail = document.getElementById("input-add-miembro-email");
const btnAddMiembro = document.getElementById("btn-add-miembro");
const listaGestionMiembros = document.getElementById("lista-gestion-miembros");
const selectAddMiembro = document.getElementById("select-add-miembro");

async function cargarUsuariosDisponiblesParaSelect(participantesActuales) {
    try {
        selectAddMiembro.innerHTML = '<option value="" disabled selected>Selecciona un usuario...</option>';
        
        // Traemos todos los usuarios registrados en la app
        const usuariosRef = collection(db, "usuarios");
        const querySnapshot = await getDocs(usuariosRef);
        
        let usuariosAgregadosAlSelect = 0;

        const participantesLimpios = participantesActuales.map(id => id.trim());
        querySnapshot.forEach((usuarioDoc) => {
            const uidUsuario = usuarioDoc.id.trim();
            const userData = usuarioDoc.data();
            
            // 2. Comparamos con el array normalizado
            if (!participantesLimpios.includes(uidUsuario)) {
                const option = document.createElement("option");
                option.value = uidUsuario;
                option.textContent = `@${userData.username} (${userData.nombreCompleto || userData.email})`;
                selectAddMiembro.appendChild(option);
                usuariosAgregadosAlSelect++;
            }
        });

        if (usuariosAgregadosAlSelect === 0) {
            selectAddMiembro.innerHTML = '<option value="" disabled>No hay más usuarios disponibles</option>';
        }

    } catch (error) {
        console.error("Error al cargar la lista de usuarios para el select:", error);
        selectAddMiembro.innerHTML = '<option value="" disabled>Error al cargar usuarios</option>';
    }
}

async function verificarRolCreador(grupoData, idDelGrupo) {
    grupoActivoId = idDelGrupo; 

    if (grupoData.creador === currentUserId) {
        zonaAdmin.style.display = "block"; 
        await renderizarListaGestionMiembros(grupoData.participantes);
        
        // 👇 LLAMADA NUEVA: Rellenamos el select con los usuarios que no están en el grupo
        await cargarUsuariosDisponiblesParaSelect(grupoData.participantes);
    } else {
        zonaAdmin.style.display = "none";
    }
}

// Renderiza la lista de miembros con el botón de "Expulsar" al lado
async function renderizarListaGestionMiembros(participantesIds) {
    listaGestionMiembros.innerHTML = "";
    
    for (const uid of participantesIds) {
        // Ignoramos al propio creador para que no se auto-expulse de la lista
        if (uid === currentUserId) continue; 

        const userDoc = await getDoc(doc(db, "usuarios", uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            const li = document.createElement("li");
            li.style = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #374151;";
            li.innerHTML = `
                <span>@${userData.username} (${userData.nombreCompleto || userData.email})</span>
                <button class="btn-expulsar" data-uid="${uid}" style="background: transparent; border: 1px solid #f87171; color: #f87171; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px; cursor: pointer;">Expulsar</button>
            `;
            
            // Evento para el botón expulsar miembro
            li.querySelector(".btn-expulsar").addEventListener("click", async (e) => {
                const uidAExpulsar = e.target.getAttribute("data-uid");
                if (confirm(`¿Seguro que quieres expulsar a @${userData.username} del grupo?`)) {
                    await expulsarMiembro(uidAExpulsar);
                }
            });

            listaGestionMiembros.appendChild(li);
        }
    }
}

// 1. ACCIÓN: EXPULSAR MIEMBRO
async function expulsarMiembro(uidMiembro) {
    try {
        const grupoRef = doc(db, "grupos", grupoActivoId);
        
        // Lo sacamos del array de participantes del grupo
        await updateDoc(grupoRef, {
            participantes: arrayRemove(uidMiembro)
        });

        // También lo quitamos de su lista de grupos en su perfil personal
        const usuarioRef = doc(db, "usuarios", uidMiembro);
        await updateDoc(usuarioRef, {
            grupos: arrayRemove(grupoActivoId)
        });

        alert("Miembro expulsado del grupo.");
        window.location.reload(); // Recargamos para actualizar el mapa y contadores
    } catch (error) {
        console.error("Error al expulsar:", error);
        alert("Error al intentar expulsar al miembro.");
    }
}

// 2. ACCIÓN: AÑADIR MIEMBRO POR EMAIL
btnAddMiembro.addEventListener("click", async () => {
    const targetUid = selectAddMiembro.value; // Obtenemos directamente el UID del usuario elegido
    
    if (!targetUid) {
        alert("Por favor, selecciona primero un usuario de la lista.");
        return;
    }

    try {
        btnAddMiembro.textContent = "Añadiendo...⏳";
        btnAddMiembro.disabled = true;

        // 1. Metemos el UID en el array del grupo activo
        await updateDoc(doc(db, "grupos", grupoActivoId), {
            participantes: arrayUnion(targetUid)
        });

        // 2. Registramos el ID del grupo en el historial de grupos del usuario añadido
        await updateDoc(doc(db, "usuarios", targetUid), {
            grupos: arrayUnion(grupoActivoId)
        });

        alert("¡Miembro añadido con éxito!");
        window.location.reload(); // Recarga para actualizar las listas

    } catch (error) {
        console.error("Error al añadir miembro desde el select:", error);
        alert("Ocurrió un error al procesar la solicitud.");
        btnAddMiembro.textContent = "Añadir";
        btnAddMiembro.disabled = false;
    }
});

// 3. ACCIÓN: ELIMINAR EL GRUPO POR COMPLETO (Borrado total)
btnEliminarGrupoTotal.addEventListener("click", async () => {
    const confirmacion1 = confirm("¡CUIDADO! ¿Estás completamente seguro de que quieres ELIMINAR todo el grupo? Esta acción es irreversible.");
    if (!confirmacion1) return;

    const confirmacion2 = prompt("Para confirmar la destrucción total, escribe la palabra: BORRAR");
    if (confirmacion2 !== "BORRAR") {
        alert("Confirmación incorrecta. Operación cancelada.");
        return;
    }

    try {
        btnEliminarGrupoTotal.textContent = "Destruyendo grupo... 🧨";
        btnEliminarGrupoTotal.disabled = true;

        // Borramos el documento del grupo de Firestore
        await deleteDoc(doc(db, "grupos", grupoActivoId));

        // Limpiamos los rastros locales de las variables de sesión
        localStorage.removeItem("grupoActivoId");
        localStorage.removeItem("viajeActivoId");

        alert("El grupo ha sido eliminado permanentemente.");
        window.location.href = "app.html"; // Regresa al dashboard general

    } catch (error) {
        console.error("Error al suprimir el grupo:", error);
        alert("Las reglas de Firebase impidieron el borrado o hubo un fallo de red.");
        btnEliminarGrupoTotal.textContent = "🔥 Eliminar Grupo Permanentemente";
        btnEliminarGrupoTotal.disabled = false;
    }
});

// Variables globales temporales
let fotoSeleccionadaParaBorrar = null;
let currentUserId = null; // 👈 Guardamos el UID del usuario logueado para sacarlo del array
let grupoActivoId = null;

// Recuperar ID del LocalStorage
const viajeId = localStorage.getItem("viajeActivoId");

// GUARDIÁN DE SEGURIDAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else if (!viajeId) {
        window.location.href = "grupo.html";
    } else {
        currentUserId = user.uid; // Asignamos el ID globalmente
        await cargarDatosBaseUsuario(user.uid);
        await cargarDatosDelViaje();
    }
});

// Cargar datos del perfil del usuario (Nav y Footer)
async function cargarDatosBaseUsuario(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            navUsername.textContent = `@${userData.username}`;
            if (userData.fotoPerfil) footerAvatar.src = userData.fotoPerfil;
        }
    } catch (error) {
        console.error("Error al cargar datos del navbar/footer:", error);
    }
}

// Cargar textos del viaje
async function cargarDatosDelViaje() {
    try {
        const viajeRef = doc(db, "viajes", viajeId);
        const viajeSnap = await getDoc(viajeRef);

        if (!viajeSnap.exists()) {
            viajeTitulo.textContent = "El viaje no existe o ha sido borrado.";
            return;
        }

        const viajeData = viajeSnap.data();
        viajeTitulo.textContent = viajeData.nombreViaje || viajeData.ciudad;
        
        const formatearFecha = (f) => f ? f.split("-").reverse().join("/") : "";
        viajeFechas.textContent = `📅 Del ${formatearFecha(viajeData.fechaIda)} al ${formatearFecha(viajeData.fechaVuelta)}`;
        viajeCiudadCompleta.textContent = `📍 ${viajeData.ciudadCompleta}`;

        // 👇 NUEVA LÓGICA: Obtener el ID del grupo asociado al viaje para validar el creador
        const grupoIdDelViaje = viajeData.grupoId || localStorage.getItem("grupoActivoId");
        if (grupoIdDelViaje) {
            const grupoRef = doc(db, "grupos", grupoIdDelViaje);
            const grupoSnap = await getDoc(grupoRef);
            
            if (grupoSnap.exists()) {
                await verificarRolCreador(grupoSnap.data(), grupoIdDelViaje);
            }
        }

        await cargarFotosDelViaje();

    } catch (error) {
        console.error("Error al estructurar los datos del viaje:", error);
    }
}

// Renderizar las fotos y configurar eventos (Zoom y Eliminar Individual)
async function cargarFotosDelViaje() {
    galeriaFotos.innerHTML = "";
    try {
        const fotosDocRef = doc(db, "viajes_fotos", viajeId);
        const fotosSnap = await getDoc(fotosDocRef);

        if (fotosSnap.exists() && fotosSnap.data().fotos?.length > 0) {
            const listaFotos = fotosSnap.data().fotos;
            
            listaFotos.forEach(fotoBase64 => {
                const wrapper = document.createElement("div");
                wrapper.classList.add("foto-wrapper");

                const imgElement = document.createElement("img");
                imgElement.src = fotoBase64;
                imgElement.classList.add("foto-item");
                imgElement.alt = "Foto de la cuadrilla";

                imgElement.addEventListener("click", () => {
                    zoomImg.src = fotoBase64;
                    zoomModal.showModal();
                });

                const btnBorrarFoto = document.createElement("button");
                btnBorrarFoto.innerHTML = "&times;"; 
                btnBorrarFoto.classList.add("btn-borrar-foto"); 
                btnBorrarFoto.title = "Eliminar foto permanentemente";
                
                btnBorrarFoto.addEventListener("click", (e) => {
                    e.stopPropagation(); 
                    fotoSeleccionadaParaBorrar = fotoBase64; 
                    fotoModal.showModal();
                });

                wrapper.appendChild(imgElement);
                wrapper.appendChild(btnBorrarFoto); 
                galeriaFotos.appendChild(wrapper);
            });
        } else {
            galeriaFotos.innerHTML = `<p style="color: #6b7280; font-style: italic;">No se han añadido fotos para este viaje todavía.</p>`;
        }
    } catch (error) {
        console.error("Error al cargar el álbum de fotos:", error);
    }
}

// ==========================================================================
// ACCIÓN: ACCIÓN DE AÑADIR/SUBIR FOTOS NUEVAS
// ==========================================================================
inputSubirFoto.addEventListener("change", async (e) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    const labelOriginal = document.querySelector("label[for='input-subir-foto']");
    labelOriginal.textContent = "Subiendo... ⏳";
    labelOriginal.style.pointerEvents = "none";

    const fotosDocRef = doc(db, "viajes_fotos", viajeId);

    try {
        const fotosSnap = await getDoc(fotosDocRef);
        if (!fotosSnap.exists()) {
            await setDoc(fotosDocRef, {
                viajeId: viajeId,
                grupoId: localStorage.getItem("grupoActivoId") || "",
                fotos: []
            });
        }

        for (const archivo of archivos) {
            const base64Str = await transformarABase64(archivo);
            await updateDoc(fotosDocRef, {
                fotos: arrayUnion(base64Str)
            });
        }

        inputSubirFoto.value = ""; 
        await cargarFotosDelViaje();

    } catch (error) {
        console.error("Error al subir las imágenes a Firebase:", error);
        alert("Hubo un fallo al intentar guardar las fotos.");
    } finally {
        labelOriginal.textContent = "Añadir Foto 📸";
        labelOriginal.style.pointerEvents = "auto";
    }
});

function transformarABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// ==========================================================================
// ACCIÓN: ELIMINAR FOTO ESPECÍFICA
// ==========================================================================
async function eliminarFotoEspecifica(fotoBase64) {
    try {
        const fotosDocRef = doc(db, "viajes_fotos", viajeId);
        await updateDoc(fotosDocRef, {
            fotos: arrayRemove(fotoBase64)
        });
        await cargarFotosDelViaje();
    } catch (error) {
        console.error("Error al eliminar la foto de Firestore:", error);
        alert("No se pudo eliminar la foto.");
    }
}

// Modales del zoom
btnCloseZoom.addEventListener("click", () => { zoomModal.close(); zoomImg.src = ""; });
zoomModal.addEventListener("click", (e) => { if (e.target === zoomModal) { zoomModal.close(); zoomImg.src = ""; } });

// ==========================================================================
// NUEVA LÓGICA: ABANDONAR EL VIAJE ACTUAL (EN LUGAR DE BORRADO TOTAL)
// ==========================================================================
btnAbandonar.addEventListener("click", () => {
    borrarModal.showModal();
});

btnCancelarBorrado.addEventListener("click", () => {
    borrarModal.close();
});

borrarModal.addEventListener("click", (e) => {
    if (e.target === borrarModal) {
        borrarModal.close();
    }
});

// Ejecución del abandono al confirmar en el Dialog modal
btnConfirmarBorrado.addEventListener("click", async () => {
    if (!currentUserId || !viajeId) return;

    try {
        btnConfirmarBorrado.textContent = "Saliendo del viaje... ⏳";
        btnConfirmarBorrado.disabled = true;
        btnCancelarBorrado.disabled = true;

        const viajeRef = doc(db, "viajes", viajeId);

        // Sacamos de forma atómica nuestro uid del array 'participantes' de este viaje
        await updateDoc(viajeRef, {
            participantes: arrayRemove(currentUserId)
        });

        // Limpiamos los rastros locales del viaje actual
        localStorage.removeItem("viajeActivoId");
        localStorage.removeItem("viajeActivoCiudad");

        borrarModal.close();
        window.location.href = "grupo.html";
        
    } catch (error) {
        console.error("Error al intentar abandonar el viaje:", error);
        alert("Hubo un fallo al intentar salir del viaje.");
        
        btnConfirmarBorrado.textContent = "Confirmar";
        btnConfirmarBorrado.disabled = false;
        btnCancelarBorrado.disabled = false;
    }
});

// LÓGICA DEL MODAL PARA ELIMINAR FOTO INDIVIDUAL
btnCancelarFoto.addEventListener("click", () => {
    fotoModal.close();
    fotoSeleccionadaParaBorrar = null;
});

fotoModal.addEventListener("click", (e) => {
    if (e.target === fotoModal) {
        fotoModal.close();
        fotoSeleccionadaParaBorrar = null;
    }
});

btnConfirmarFoto.addEventListener("click", async () => {
    if (!fotoSeleccionadaParaBorrar) return;

    try {
        btnConfirmarFoto.textContent = "Borrando... ⏳";
        btnConfirmarFoto.disabled = true;
        btnCancelarFoto.disabled = true;

        await eliminarFotoEspecifica(fotoSeleccionadaParaBorrar);
        fotoModal.close();
        
    } catch (error) {
        console.error("Error al confirmar borrado de foto:", error);
        alert("No se pudo eliminar la foto.");
    } finally {
        btnConfirmarFoto.textContent = "Eliminar";
        btnConfirmarFoto.disabled = false;
        btnCancelarFoto.disabled = false;
        fotoSeleccionadaParaBorrar = null;
    }
});
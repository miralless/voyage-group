import { db, auth } from "./firebase-config.js";
import { doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, setDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Capturar elementos del DOM
const navUsername = document.getElementById("nav-username");
const footerAvatar = document.getElementById("footer-avatar");
const viajeTitulo = document.getElementById("viaje-titulo");
const viajeFechas = document.getElementById("viaje-fechas");
const viajeCiudadCompleta = document.getElementById("viaje-ciudad-completa");
const galeriaFotos = document.getElementById("galeria-fotos");
const btnAbandonar = document.getElementById("btn-eliminar-viaje"); 
const inputSubirFoto = document.getElementById("input-subir-foto");

// Elementos del Dialog de Zoom
const zoomModal = document.getElementById("zoom-modal");
const zoomImg = document.getElementById("zoom-img");
const btnCloseZoom = document.getElementById("btn-close-zoom");

// Elementos del Dialog de Confirmación de Abandono
const borrarModal = document.getElementById("confirmar-borrado-modal");
const btnCancelarBorrado = document.getElementById("btn-cancelar-borrado");
const btnConfirmarBorrado = document.getElementById("btn-confirmar-borrado");

// Elementos del Dialog de Confirmación de Foto
const fotoModal = document.getElementById("confirmar-foto-modal");
const btnCancelarFoto = document.getElementById("btn-cancelar-foto");
const btnConfirmarFoto = document.getElementById("btn-confirmar-foto");

// 🆕 Elementos de nuevos Modales (Reemplazos de alerts y prompts nativos)
const alertModal = document.getElementById("alert-modal");
const alertModalTexto = document.getElementById("alert-modal-texto");
const btnAlertCerrar = document.getElementById("btn-alert-cerrar");

const expulsarModal = document.getElementById("confirmar-expulsar-modal");
const btnCancelarExpulsar = document.getElementById("btn-cancelar-expulsar");
const btnConfirmarExpulsar = document.getElementById("btn-confirmar-expulsar");
const expulsarModalTexto = document.getElementById("expulsar-modal-texto");

const destruirModal = document.getElementById("confirmar-destruir-modal");
const inputDestruirConfirmacion = document.getElementById("input-destruir-confirmacion");
const btnCancelarDestruir = document.getElementById("btn-cancelar-destruir");
const btnConfirmarDestruir = document.getElementById("btn-confirmar-destruir");

// Variables globales de los elementos de administración
const zonaAdmin = document.getElementById("zona-administrador");
const btnEliminarGrupoTotal = document.getElementById("btn-eliminar-grupo-total");
const listaGestionMiembros = document.getElementById("lista-gestion-miembros");
const selectAddMiembro = document.getElementById("select-add-miembro");
const btnAddMiembro = document.getElementById("btn-add-miembro");

// Variables de estado temporales
let fotoSeleccionadaParaBorrar = null;
let usuarioSeleccionadoParaExpulsar = null;
let currentUserId = null; 
let grupoActivoId = null;

// Recuperar ID del LocalStorage
const viajeId = localStorage.getItem("viajeActivoId");

// 🆕 Función para lanzar avisos en pantalla en vez de usar 'alert()'
function mostrarMensajePantalla(mensaje, recargarAlCerrar = false) {
    alertModalTexto.textContent = mensaje;
    alertModal.showModal();
    
    // Configurar evento único de cierre
    const cerrarHandler = () => {
        alertModal.close();
        btnAlertCerrar.removeEventListener("click", cerrarHandler);
        if (recargarAlCerrar) {
            window.location.reload();
        }
    };
    btnAlertCerrar.addEventListener("click", cerrarHandler);
}

// GUARDIÁN DE SEGURIDAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else if (!viajeId) {
        window.location.href = "grupo.html";
    } else {
        currentUserId = user.uid; 
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

        const participantesDelViaje = viajeData.participantes || []; 

        const formatearFecha = (f) => f ? f.split("-").reverse().join("/") : "";
        viajeFechas.textContent = `📅 Del ${formatearFecha(viajeData.fechaIda)} al ${formatearFecha(viajeData.fechaVuelta)}`;
        viajeCiudadCompleta.textContent = `📍 ${viajeData.ciudadCompleta}`;

        const grupoIdDelViaje = viajeData.grupoId || localStorage.getItem("grupoActivoId");
        if (grupoIdDelViaje) {
            const grupoRef = doc(db, "grupos", grupoIdDelViaje);
            const grupoSnap = await getDoc(grupoRef);
            
            if (grupoSnap.exists()) {
                await verificarRolCreador(grupoSnap.data(), grupoIdDelViaje, participantesDelViaje);
            }
        }

        await cargarFotosDelViaje();

    } catch (error) {
        console.error("Error al estructurar los datos del viaje:", error);
    }
}

async function cargarUsuariosDisponiblesParaSelect(participantesGrupo, participantesViaje) {
    try {
        selectAddMiembro.innerHTML = '<option value="" disabled selected>Selecciona un miembro...</option>';
        let usuariosAgregadosAlSelect = 0;

        for (const uidUsuario of participantesGrupo) {
            if (participantesViaje.includes(uidUsuario)) continue;

            const userDoc = await getDoc(doc(db, "usuarios", uidUsuario));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const option = document.createElement("option");
                option.value = uidUsuario;
                option.textContent = `@${userData.username}`;
                selectAddMiembro.appendChild(option);
                usuariosAgregadosAlSelect++;
            }
        }

        if (usuariosAgregadosAlSelect === 0) {
            selectAddMiembro.innerHTML = '<option value="" disabled>Toda la cuadrilla está en este viaje ✈️</option>';
        }

    } catch (error) {
        console.error("Error al filtrar miembros del grupo:", error);
        selectAddMiembro.innerHTML = '<option value="" disabled>Error al cargar usuarios</option>';
    }
}

async function verificarRolCreador(grupoData, idDelGrupo, participantesDelViaje) {
    grupoActivoId = idDelGrupo; 

    if (grupoData.creador === currentUserId) {
        zonaAdmin.style.display = "block"; 
        await renderizarListaGestionMiembros(participantesDelViaje);
        await cargarUsuariosDisponiblesParaSelect(grupoData.participantes, participantesDelViaje);
    } else {
        zonaAdmin.style.display = "none";
    }
}

// Renderiza la lista de miembros con el modal de confirmación en pantalla
async function renderizarListaGestionMiembros(participantesViajeIds) {
    listaGestionMiembros.innerHTML = "";
    
    for (const uid of participantesViajeIds) {
        if (uid === currentUserId) continue; 

        const userDoc = await getDoc(doc(db, "usuarios", uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            const li = document.createElement("li");
            li.style = "display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #374151;";
            li.innerHTML = `
                <span>${userData.nombreCompleto || userData.username}</span>
                <button class="btn-expulsar" data-uid="${uid}" style="background: transparent; border: 1px solid #f87171; color: #f87171; padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 4px; cursor: pointer;">Sacar del viaje</button>
            `;
            
            li.querySelector(".btn-expulsar").addEventListener("click", (e) => {
                usuarioSeleccionadoParaExpulsar = e.target.getAttribute("data-uid");
                expulsarModalTexto.textContent = `¿Seguro que quieres quitar a @${userData.username} de este viaje?`;
                expulsarModal.showModal();
            });

            listaGestionMiembros.appendChild(li);
        }
    }
}

// Manejadores de eventos del Modal de Expulsión
btnCancelarExpulsar.addEventListener("click", () => {
    expulsarModal.close();
    usuarioSeleccionadoParaExpulsar = null;
});

btnConfirmarExpulsar.addEventListener("click", async () => {
    if (!usuarioSeleccionadoParaExpulsar) return;
    expulsarModal.close();
    await expulsarMiembroDelViaje(usuarioSeleccionadoParaExpulsar);
    usuarioSeleccionadoParaExpulsar = null;
});

// 1. ACCIÓN: EXPULSAR MIEMBRO REAL
async function expulsarMiembroDelViaje(uidMiembro) {
    try {
        const viajeRef = doc(db, "viajes", viajeId);
        await updateDoc(viajeRef, {
            participantes: arrayRemove(uidMiembro)
        });
        mostrarMensajePantalla("El usuario ha sido retirado de este viaje.", true);
    } catch (error) {
        console.error("Error al retirar del viaje:", error);
        mostrarMensajePantalla("Error al intentar quitar al miembro del viaje.");
    }
}

// 2. ACCIÓN: AÑADIR MIEMBRO POR SELECT
btnAddMiembro.addEventListener("click", async () => {
    const targetUid = selectAddMiembro.value; 
    
    if (!targetUid) {
        mostrarMensajePantalla("Por favor, selecciona primero un miembro de la lista.");
        return;
    }

    try {
        btnAddMiembro.textContent = "Añadiendo...⏳";
        btnAddMiembro.disabled = true;

        await updateDoc(doc(db, "viajes", viajeId), {
            participantes: arrayUnion(targetUid)
        });

        mostrarMensajePantalla("¡Miembro añadido al viaje con éxito!", true);

    } catch (error) {
        console.error("Error al añadir miembro al viaje:", error);
        mostrarMensajePantalla("Ocurrió un error al procesar la solicitud.");
        btnAddMiembro.textContent = "Añadir";
        btnAddMiembro.disabled = false;
    }
});

// 3. ACCIÓN: ELIMINAR EL VIAJE POR COMPLETO (Solo Creador)
const btnEliminarViajeTotal = document.getElementById("btn-eliminar-grupo-total"); // Mantén el id antiguo si no lo has cambiado en el HTML

btnEliminarViajeTotal.addEventListener("click", () => {
    inputDestruirConfirmacion.value = ""; // Limpiamos la caja de texto
    destruirModal.showModal();
});

btnCancelarDestruir.addEventListener("click", () => {
    destruirModal.close();
});

btnConfirmarDestruir.addEventListener("click", async () => {
    const palabraIntroducida = inputDestruirConfirmacion.value.trim();

    if (palabraIntroducida !== "BORRAR") {
        destruirModal.close();
        mostrarMensajePantalla("Confirmación incorrecta. Operación cancelada.");
        return;
    }

    try {
        destruirModal.close();
        btnEliminarViajeTotal.textContent = "Eliminando viaje... 🧨";
        btnEliminarViajeTotal.disabled = true;

        // CAMBIO CLAVE: Ahora borra el documento de la colección "viajes" usando el viajeActivoId
        await deleteDoc(doc(db, "viajes", viajeId));

        // Limpiamos únicamente el ID del viaje activo del almacenamiento local
        localStorage.removeItem("viajeActivoId");

        // Lanzamos el modal de éxito, y al cerrar volvemos a la pantalla del grupo (grupo.html)
        // ya que el grupo sigue existiendo y solo ha desaparecido este viaje.
        alertModalTexto.textContent = "El viaje ha sido eliminado permanentemente.";
        alertModal.showModal();
        
        btnAlertCerrar.addEventListener("click", () => {
            window.location.href = "grupo.html";
        });

    } catch (error) {
        console.error("Error al suprimir el viaje:", error);
        mostrarMensajePantalla("Las reglas de Firebase impidieron el borrado o hubo un fallo de red.");
        btnEliminarViajeTotal.textContent = "Eliminar Viaje Permanentemente";
        btnEliminarViajeTotal.disabled = false;
    }
});

// Renderizar las fotos y configurar eventos (Zoom y Eliminar Individual)
async function cargarFotosDelViaje() {
    galeriaFotos.innerHTML = "";
    try {
        // Apuntamos a la subcolección 'fotos' dentro del viaje activo
        const fotosSubcoleccionRef = collection(db, "viajes", viajeId, "fotos");
        
        // Traemos los documentos (puedes añadir un query con orderBy si guardas timestamp)
        const querySnapshot = await getDocs(fotosSubcoleccionRef);

        if (!querySnapshot.empty) {
            querySnapshot.forEach((fotoDoc) => {
                const fotoData = fotoDoc.data();
                const fotoBase64 = fotoData.url;
                const fotoDocId = fotoDoc.id; // Guardamos el ID del documento para poder borrarlo luego

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
                    // 💥 CAMBIO: Ahora guardamos el ID del documento de la foto para borrarlo
                    fotoSeleccionadaParaBorrar = fotoDocId; 
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
        console.error("Error al cargar el álbum de fotos desde la subcolección:", error);
    }
}

// ACCIÓN: ACCIÓN DE AÑADIR/SUBIR FOTOS NUEVAS
inputSubirFoto.addEventListener("change", async (e) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    const labelOriginal = document.querySelector("label[for='input-subir-foto']");
    labelOriginal.textContent = "Subiendo... ⏳";
    labelOriginal.style.pointerEvents = "none";

    try {
        // Referencia a la subcolección interna 'fotos' del viaje
        const fotosSubcoleccionRef = collection(db, "viajes", viajeId, "fotos");

        for (const archivo of archivos) {
            // Transformamos y comprimimos la imagen a Base64
            const base64Str = await transformarYComprimirABase64(archivo);
            
            // Creamos un documento nuevo único para esta foto concreta
            await addDoc(fotosSubcoleccionRef, {
                url: base64Str,
                subidaPor: currentUserId,
                fechaSubida: Date.now()
            });
        }

        inputSubirFoto.value = ""; 
        await cargarFotosDelViaje();

    } catch (error) {
        console.error("Error al subir las imágenes a la subcolección de Firebase:", error);
        mostrarMensajePantalla("Hubo un fallo al intentar guardar las fotos.");
    } finally {
        labelOriginal.textContent = "Añadir Foto 📸";
        labelOriginal.style.pointerEvents = "auto";
    }
});

function transformarYComprimirABase64(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Forzamos codificación JPEG ligera
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (error) => reject(error);
    });
}

// ACCIÓN: ELIMINAR FOTO ESPECÍFICA
async function eliminarFotoEspecifica(fotoDocId) {
    try {
        // Apuntamos directamente al documento de la foto dentro de la subcolección y lo eliminamos
        const fotoDocRef = doc(db, "viajes", viajeId, "fotos", fotoDocId);
        await deleteDoc(fotoDocRef);
        
        await cargarFotosDelViaje();
    } catch (error) {
        console.error("Error al eliminar el documento de la foto:", error);
        mostrarMensajePantalla("No se pudo eliminar la foto.");
    }
}

// Cierre de Modales de Zoom
btnCloseZoom.addEventListener("click", () => { zoomModal.close(); zoomImg.src = ""; });
zoomModal.addEventListener("click", (e) => { if (e.target === zoomModal) { zoomModal.close(); zoomImg.src = ""; } });

// ABANDONAR EL VIAJE ACTUAL
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

btnConfirmarBorrado.addEventListener("click", async () => {
    if (!currentUserId || !viajeId) return;

    try {
        btnConfirmarBorrado.textContent = "Saliendo del viaje... ⏳";
        btnConfirmarBorrado.disabled = true;
        btnCancelarBorrado.disabled = true;

        const viajeRef = doc(db, "viajes", viajeId);

        await updateDoc(viajeRef, {
            participantes: arrayRemove(currentUserId)
        });

        localStorage.removeItem("viajeActivoId");
        localStorage.removeItem("viajeActivoCiudad");

        borrarModal.close();
        window.location.href = "grupo.html";
        
    } catch (error) {
        console.error("Error al intentar abandonar el viaje:", error);
        mostrarMensajePantalla("Hubo un fallo al intentar salir del viaje.");
        
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
        mostrarMensajePantalla("No se pudo eliminar la foto.");
    } finally {
        btnConfirmarFoto.textContent = "Eliminar";
        btnConfirmarFoto.disabled = false;
        btnCancelarFoto.disabled = false;
        fotoSeleccionadaParaBorrar = null;
    }
});
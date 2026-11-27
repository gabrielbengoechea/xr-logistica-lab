// Botón de entrada a la realidad virtual en español (Sprint 01, B22).
//
// El botón lo arma VRButton de three.js (vendor/addons/webxr/VRButton.js, código de terceros que no se toca) y
// le cambia el texto según el estado: ENTER VR, EXIT VR, VR NOT SUPPORTED… Acá solo se traduce lo que se ve y
// se ensancha el botón para el texto más largo. La sesión XR la sigue manejando VRButton, igual que antes.

export const TEXTOS_VR = Object.freeze({
  'ENTER VR': 'ENTRAR EN REALIDAD VIRTUAL',
  'EXIT VR': 'VOLVER AL MODO DE ESCRITORIO',
  'VR NOT SUPPORTED': 'REALIDAD VIRTUAL NO COMPATIBLE',
  'VR NOT ALLOWED': 'REALIDAD VIRTUAL NO PERMITIDA',
  'WEBXR NEEDS HTTPS': 'LA REALIDAD VIRTUAL NECESITA HTTPS',
  'WEBXR NOT AVAILABLE': 'ESTE NAVEGADOR NO TIENE REALIDAD VIRTUAL',
});

/** Explicación para quien ve que no puede entrar (va en el `title` del botón). */
export const AYUDA_VR = Object.freeze({
  'VR NOT SUPPORTED': 'Este dispositivo no tiene realidad virtual. Podés recorrer la estación con el mouse y el teclado.',
  'VR NOT ALLOWED': 'El navegador no dio permiso para la realidad virtual. Revisá los permisos del sitio.',
  'WEBXR NEEDS HTTPS': 'La realidad virtual solo funciona en una dirección https. Podés recorrer la estación con el mouse y el teclado.',
  'WEBXR NOT AVAILABLE': 'Abrí esta página en el navegador del Meta Quest para entrar en realidad virtual. En la compu se recorre con el mouse y el teclado.',
});

const ANCHO = '300px';

/** Traduce el texto actual del elemento, si es uno de los de VRButton. Devuelve si cambió algo. */
export function traducirTexto(el) {
  const original = (el.textContent || '').trim();
  const traducido = TEXTOS_VR[original];
  if (!traducido) return false;
  el.textContent = traducido;
  el.setAttribute('aria-label', traducido);
  if (AYUDA_VR[original]) el.title = AYUDA_VR[original];
  else el.removeAttribute('title');
  el.style.width = ANCHO;
  el.style.left = `calc(50% - ${parseInt(ANCHO, 10) / 2}px)`;
  return true;
}

/**
 * Traduce el botón (o el aviso) que devuelve VRButton.createButton y lo sigue traduciendo cuando VRButton le
 * cambia el texto (al entrar o salir de la sesión, o cuando termina de averiguar si hay soporte).
 * @template {HTMLElement} T
 * @param {T} el
 * @returns {T}
 */
export function traducirBotonVR(el) {
  traducirTexto(el);
  if (typeof MutationObserver === 'function') {
    const obs = new MutationObserver(() => { traducirTexto(el); });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }
  return el;
}

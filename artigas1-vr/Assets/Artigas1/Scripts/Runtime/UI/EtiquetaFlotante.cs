using TMPro;
using UnityEngine;

namespace Artigas1
{
    /// <summary>Cartel de texto en el mundo (rótulo de botones y equipos), legible a un metro.</summary>
    [AddComponentMenu("Artigas-1/Etiqueta flotante")]
    public sealed class EtiquetaFlotante : MonoBehaviour
    {
        [TextArea] [SerializeField] private string texto = "Etiqueta";
        [SerializeField] private Vector2 tamanoMetros = new Vector2(0.22f, 0.05f);
        [SerializeField] private float tamanoLetra = 24f;

        private const float PxPorMetro = 1500f;

        public void Configurar(string contenido, Vector2 tamano)
        {
            texto = contenido;
            tamanoMetros = tamano;
        }

        private void Awake()
        {
            RectTransform lienzo = UiVR.Lienzo(transform, "Etiqueta", tamanoMetros * PxPorMetro, 1f / PxPorMetro);
            UiVR.Caja(lienzo, "Fondo", UiVR.Fondo, Vector2.zero, Vector2.one);
            UiVR.Texto_(lienzo, "Texto", tamanoLetra, UiVR.Texto, Vector2.zero, Vector2.one, TextAlignmentOptions.Center).text = texto;
        }
    }
}

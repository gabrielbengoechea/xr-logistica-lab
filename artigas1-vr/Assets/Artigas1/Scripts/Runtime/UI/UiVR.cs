using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Artigas1
{
    /// <summary>
    /// Ayudas para armar interfaces de mundo (world space) legibles en el visor: paneles, textos y barras.
    /// Todo se crea por código para que las pantallas no dependan de prefabs de UI.
    /// </summary>
    public static class UiVR
    {
        public static readonly Color Fondo = new Color(0.02f, 0.05f, 0.09f, 0.94f);
        public static readonly Color Marco = new Color(0.10f, 0.22f, 0.32f, 1f);
        public static readonly Color Acento = new Color(0.20f, 0.80f, 0.95f, 1f);
        public static readonly Color Exito = new Color(0.20f, 0.90f, 0.45f, 1f);
        public static readonly Color Alerta = new Color(1.00f, 0.60f, 0.10f, 1f);
        public static readonly Color Texto = new Color(0.90f, 0.95f, 1.00f, 1f);
        public static readonly Color TextoTenue = new Color(0.55f, 0.66f, 0.76f, 1f);

        /// <summary>Lienzo en el mundo de <paramref name="px"/> píxeles; <paramref name="metrosPorPx"/> fija el tamaño real.</summary>
        public static RectTransform Lienzo(Transform padre, string nombre, Vector2 px, float metrosPorPx)
        {
            var go = new GameObject(nombre, typeof(RectTransform));
            go.transform.SetParent(padre, false);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            var escalador = go.AddComponent<CanvasScaler>();
            escalador.dynamicPixelsPerUnit = 3f;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = px;
            rt.localScale = Vector3.one * metrosPorPx;
            return rt;
        }

        public static Image Caja(Transform padre, string nombre, Color color, Vector2 anclaMin, Vector2 anclaMax)
        {
            RectTransform rt = Nuevo(padre, nombre, anclaMin, anclaMax);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        public static TextMeshProUGUI Texto_(Transform padre, string nombre, float tam, Color color,
            Vector2 anclaMin, Vector2 anclaMax, TextAlignmentOptions alineacion = TextAlignmentOptions.TopLeft)
        {
            RectTransform rt = Nuevo(padre, nombre, anclaMin, anclaMax);
            var t = rt.gameObject.AddComponent<TextMeshProUGUI>();
            t.fontSize = tam;
            t.color = color;
            t.alignment = alineacion;
            t.textWrappingMode = TextWrappingModes.Normal;
            t.overflowMode = TextOverflowModes.Ellipsis;
            t.raycastTarget = false;
            t.margin = new Vector4(10f, 6f, 10f, 6f);
            return t;
        }

        /// <summary>Barra horizontal: devuelve el relleno; su ancho se ajusta con <see cref="Llenar"/>.</summary>
        public static RectTransform Barra(Transform padre, string nombre, Vector2 anclaMin, Vector2 anclaMax)
        {
            Image fondo = Caja(padre, nombre, Marco, anclaMin, anclaMax);
            Image relleno = Caja(fondo.transform, "Relleno", Acento, Vector2.zero, new Vector2(0f, 1f));
            return relleno.rectTransform;
        }

        public static void Llenar(RectTransform relleno, float valor, Color color)
        {
            relleno.anchorMax = new Vector2(Mathf.Clamp01(valor), 1f);
            relleno.GetComponent<Image>().color = color;
        }

        private static RectTransform Nuevo(Transform padre, string nombre, Vector2 anclaMin, Vector2 anclaMax)
        {
            var go = new GameObject(nombre, typeof(RectTransform));
            go.transform.SetParent(padre, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = anclaMin;
            rt.anchorMax = anclaMax;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            return rt;
        }
    }
}

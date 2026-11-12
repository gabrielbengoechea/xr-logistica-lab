using System.Collections.Generic;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Pinta un indicador (LED de hueco, luz del portal RFID) cambiando entre unos pocos materiales compartidos.
    /// No usa MaterialPropertyBlock porque eso saca al renderer del SRP Batcher; apagado, el renderer se oculta.
    /// Colores de estado de la sección 3.1 del plan.
    /// </summary>
    public static class LuzEstado
    {
        public static readonly Color Apagada = new Color(0f, 0f, 0f, 0f);
        public static readonly Color Verde = new Color(0.10f, 0.90f, 0.35f);
        public static readonly Color Ambar = new Color(1.00f, 0.55f, 0.05f);
        public static readonly Color Rojo = new Color(1.00f, 0.05f, 0.05f);
        public static readonly Color Cian = new Color(0.20f, 0.80f, 0.95f);

        private static readonly int BaseColor = Shader.PropertyToID("_BaseColor");
        private static readonly int EmissionColor = Shader.PropertyToID("_EmissionColor");
        private static readonly Dictionary<Color, Material> Cache = new Dictionary<Color, Material>();
        private static Material _plantilla;

        /// <summary>Pinta el renderer con el color (Apagada lo oculta). Solo toca el renderer si cambia algo.</summary>
        public static void Pintar(Renderer r, Color c)
        {
            if (r == null)
            {
                return;
            }
            bool visible = c.a > 0f;
            if (r.enabled != visible)
            {
                r.enabled = visible;
            }
            if (!visible)
            {
                return;
            }
            Material m = MaterialPara(c, r.sharedMaterial);
            if (r.sharedMaterial != m)
            {
                r.sharedMaterial = m;
            }
        }

        private static Material MaterialPara(Color c, Material actual)
        {
            if (Cache.TryGetValue(c, out Material m) && m != null)
            {
                return m;
            }
            if (_plantilla == null)
            {
                _plantilla = actual;
            }
            m = _plantilla != null ? new Material(_plantilla) : new Material(Shader.Find("Universal Render Pipeline/Lit"));
            m.name = $"M_LED_{ColorUtility.ToHtmlStringRGB(c)}";
            m.SetColor(BaseColor, c);
            m.SetColor(EmissionColor, c * 2f);
            m.EnableKeyword("_EMISSION");
            m.SetTexture("_BaseMap", null);
            m.SetTexture("_EmissionMap", null);
            Cache[c] = m;
            return m;
        }
    }
}

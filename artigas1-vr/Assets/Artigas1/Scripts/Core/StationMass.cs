using System.Collections.Generic;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Centro de masa de la estación y puntaje del minijuego B (sección 2.3 del plan):
    /// CM = (Σ mᵢ·rᵢ + M·r_estructura) / (Σ mᵢ + M)
    /// puntaje = 100 − 40·(desvío / tolerancia) − 10·reglas violadas − 0,5·metros de picking extra
    /// </summary>
    public static class StationMass
    {
        public static Vector3 CenterOfMass(IReadOnlyList<(float masaKg, Vector3 posicion)> cargas, float masaEstructuraKg, Vector3 centroEstructura)
        {
            float total = Mathf.Max(0f, masaEstructuraKg);
            Vector3 momento = centroEstructura * total;
            if (cargas != null)
            {
                for (int i = 0; i < cargas.Count; i++)
                {
                    float m = Mathf.Max(0f, cargas[i].masaKg);
                    momento += cargas[i].posicion * m;
                    total += m;
                }
            }
            return total > 0f ? momento / total : centroEstructura;
        }

        /// <summary>Desvío horizontal (en el plano perpendicular a "arriba" no importa en 0G: se usa la distancia 3D).</summary>
        public static float Deviation(Vector3 centro, Vector3 objetivo) => Vector3.Distance(centro, objetivo);

        public static int ScoreB(float desvio, float tolerancia, int reglasVioladas, float metrosPickingExtra)
        {
            float t = tolerancia > 0f ? desvio / tolerancia : 0f;
            float s = 100f - 40f * t - 10f * Mathf.Max(0, reglasVioladas) - 0.5f * Mathf.Max(0f, metrosPickingExtra);
            return Mathf.Clamp(Mathf.RoundToInt(s), 0, 100);
        }

        /// <summary>Propelente gastado (unidades relativas) para corregir la actitud: crece con el cuadrado del exceso.</summary>
        public static float PropellantCost(float desvio, float tolerancia)
        {
            if (desvio <= tolerancia || tolerancia <= 0f)
            {
                return 0f;
            }
            float exceso = (desvio - tolerancia) / tolerancia;
            return exceso * exceso;
        }
    }
}

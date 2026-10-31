using UnityEngine;

namespace XRLab.Pruebas
{
    public static class PruebasExplotada
    {
        [Prueba]
        public static void LasCurvasEmpiezanEnCeroYTerminanEnUno()
        {
            foreach (EaseCurve c in System.Enum.GetValues(typeof(EaseCurve)))
            {
                Afirmar.Cerca(0, ExplodedViewMath.Ease(0f, c), 1e-5, $"{c} en 0");
                Afirmar.Cerca(1, ExplodedViewMath.Ease(1f, c), 1e-5, $"{c} en 1");
                Afirmar.Cerca(0, ExplodedViewMath.Ease(-3f, c), 1e-5, $"{c} recorta abajo");
                Afirmar.Cerca(1, ExplodedViewMath.Ease(7f, c), 1e-5, $"{c} recorta arriba");
            }
        }

        [Prueba]
        public static void SmoothStepYCubicaSonMonotonas()
        {
            foreach (EaseCurve c in new[] { EaseCurve.Linear, EaseCurve.SmoothStep, EaseCurve.EaseInOutCubic })
            {
                float prev = 0f;
                for (int i = 1; i <= 100; i++)
                {
                    float v = ExplodedViewMath.Ease(i / 100f, c);
                    Afirmar.Verdadero(v >= prev - 1e-6f, $"{c} no es monótona en {i}");
                    prev = v;
                }
            }
            Afirmar.Cerca(0.5, ExplodedViewMath.Ease(0.5f, EaseCurve.EaseInOutCubic), 1e-5);
        }

        [Prueba]
        public static void EaseOutBackSePasaUnPocoAntesDeVolver()
        {
            float max = 0f;
            for (int i = 0; i <= 100; i++)
            {
                max = Mathf.Max(max, ExplodedViewMath.Ease(i / 100f, EaseCurve.EaseOutBack));
            }
            Afirmar.Verdadero(max > 1.05f && max < 1.15f, $"el rebote máximo fue {max}");
        }

        [Prueba]
        public static void ElEscalonadoDistribuyeLosTurnos()
        {
            // 5 piezas con escalonado 0,4: la primera arranca en 0 y la última en 0,4; cada una tarda 0,6.
            Afirmar.Cerca(0, ExplodedViewMath.StaggeredFactor(0f, 0, 5, 0.4f));
            Afirmar.Cerca(0.5, ExplodedViewMath.StaggeredFactor(0.3f, 0, 5, 0.4f), 1e-5);
            Afirmar.Cerca(0, ExplodedViewMath.StaggeredFactor(0.39f, 4, 5, 0.4f));
            Afirmar.Cerca(1, ExplodedViewMath.StaggeredFactor(1f, 4, 5, 0.4f));
            Afirmar.Cerca(0.42, ExplodedViewMath.StaggeredFactor(0.42f, 3, 5, 0f), 1e-6, "sin escalonado todas iguales");
            Afirmar.Cerca(0.42, ExplodedViewMath.StaggeredFactor(0.42f, 0, 1, 0.5f), 1e-6, "una sola pieza");
        }

        [Prueba]
        public static void ElDesplazamientoAutomaticoSeAlejaDelCentro()
        {
            Vector3 o = ExplodedViewMath.AutoOffset(new Vector3(1, 0, 0), Vector3.zero, 0.3f);
            Afirmar.Cerca(0.3, o.x, 1e-6);
            Afirmar.Cerca(0, o.y, 1e-6);
            Vector3 centro = ExplodedViewMath.AutoOffset(Vector3.zero, Vector3.zero, 0.2f);
            Afirmar.Cerca(0.2, centro.y, 1e-6, "en el centro sube");
        }

        [Prueba]
        public static void GltfAUnityInvierteX()
        {
            Vector3 u = ExplodedViewMath.GltfToUnity(new Vector3(1.5f, 2f, -3f));
            Afirmar.Igual(-1.5f, u.x);
            Afirmar.Igual(2f, u.y);
            Afirmar.Igual(-3f, u.z);
        }

        [Prueba]
        public static void ElEstadoAvanzaAVelocidadConstante()
        {
            var s = new ExplodeState(2f);
            s.SetTarget(1f);
            Afirmar.Verdadero(s.IsMoving);
            Afirmar.Falso(s.Step(0.5f));
            Afirmar.Cerca(0.25, s.Raw, 1e-6);
            Afirmar.Falso(s.Step(1.0f));
            Afirmar.Cerca(0.75, s.Raw, 1e-6);
            Afirmar.Verdadero(s.Step(10f), "llega en este paso");
            Afirmar.Cerca(1, s.Raw);
            Afirmar.Falso(s.Step(1f), "ya llegó");
            s.SetTarget(0f);
            s.Step(1f);
            Afirmar.Cerca(0.5, s.Raw, 1e-6, "vuelve");
        }

        [Prueba]
        public static void ConDuracionCeroSaltaDirecto()
        {
            var s = new ExplodeState(0f);
            s.SetTarget(1f);
            Afirmar.Verdadero(s.Step(0.016f));
            Afirmar.Igual(1f, s.Raw);
            s.Snap(0.3f);
            Afirmar.Falso(s.IsMoving);
            Afirmar.Igual(0.3f, s.Target);
        }
    }
}

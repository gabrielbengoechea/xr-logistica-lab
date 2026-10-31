using UnityEngine;

namespace XRLab
{
    /// <summary>Curvas de interpolación para la vista explotada.</summary>
    public enum EaseCurve
    {
        Linear,
        SmoothStep,
        EaseInOutCubic,
        EaseOutBack,
    }

    /// <summary>
    /// Matemática de la vista explotada, sin MonoBehaviour: se prueba fuera de Unity.
    /// El factor 0 es el ensamblado y 1 el despiece completo.
    /// </summary>
    public static class ExplodedViewMath
    {
        /// <summary>Aplica la curva a <paramref name="t"/> (se recorta a [0, 1]).</summary>
        public static float Ease(float t, EaseCurve curve)
        {
            t = Mathf.Clamp01(t);
            switch (curve)
            {
                case EaseCurve.SmoothStep:
                    return t * t * (3f - 2f * t);
                case EaseCurve.EaseInOutCubic:
                    return t < 0.5f ? 4f * t * t * t : 1f - Mathf.Pow(-2f * t + 2f, 3f) / 2f;
                case EaseCurve.EaseOutBack:
                    const float c1 = 1.70158f;
                    const float c3 = c1 + 1f;
                    return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
                default:
                    return t;
            }
        }

        /// <summary>
        /// Desplazamiento automático de una pieza: se aleja del centro del conjunto en la dirección centro → pieza.
        /// Si la pieza está en el centro, sube (así nunca queda un vector nulo).
        /// </summary>
        public static Vector3 AutoOffset(Vector3 partCenter, Vector3 assemblyCenter, float distance)
        {
            Vector3 dir = partCenter - assemblyCenter;
            if (dir.sqrMagnitude < 1e-8f)
            {
                dir = Vector3.up;
            }
            return dir.normalized * distance;
        }

        /// <summary>
        /// Factor propio de una pieza cuando el despiece va escalonado: la pieza <paramref name="index"/> de
        /// <paramref name="count"/> empieza a moverse cuando el factor global pasa su turno.
        /// Con <paramref name="stagger"/> = 0 todas se mueven a la vez.
        /// </summary>
        public static float StaggeredFactor(float globalFactor, int index, int count, float stagger)
        {
            if (count <= 1 || stagger <= 0f)
            {
                return Mathf.Clamp01(globalFactor);
            }
            stagger = Mathf.Clamp01(stagger);
            float window = 1f - stagger;
            float start = stagger * index / (count - 1);
            return Mathf.Clamp01((globalFactor - start) / Mathf.Max(window, 1e-4f));
        }

        /// <summary>Convierte un vector del manifest (glTF, mano derecha) al sistema de Unity (mano izquierda): x cambia de signo.</summary>
        public static Vector3 GltfToUnity(Vector3 v)
        {
            return new Vector3(-v.x, v.y, v.z);
        }
    }

    /// <summary>
    /// Estado del despiece en el tiempo: avanza el factor hacia el objetivo a velocidad constante
    /// (una transición completa dura <see cref="Duration"/> segundos) y devuelve el valor con la curva aplicada.
    /// </summary>
    public sealed class ExplodeState
    {
        public float Duration { get; set; }
        public float Raw { get; private set; }
        public float Target { get; private set; }
        public bool IsMoving => !Mathf.Approximately(Raw, Target);

        public ExplodeState(float duration, float initial = 0f)
        {
            Duration = Mathf.Max(0f, duration);
            Raw = Target = Mathf.Clamp01(initial);
        }

        public void SetTarget(float target)
        {
            Target = Mathf.Clamp01(target);
        }

        /// <summary>Salta directo a un valor (sin transición).</summary>
        public void Snap(float value)
        {
            Raw = Target = Mathf.Clamp01(value);
        }

        /// <summary>Avanza <paramref name="deltaTime"/> segundos. Devuelve true si llegó al objetivo en este paso.</summary>
        public bool Step(float deltaTime)
        {
            if (!IsMoving)
            {
                return false;
            }
            if (Duration <= 0f)
            {
                Raw = Target;
                return true;
            }
            Raw = Mathf.MoveTowards(Raw, Target, Mathf.Max(0f, deltaTime) / Duration);
            return !IsMoving;
        }
    }
}

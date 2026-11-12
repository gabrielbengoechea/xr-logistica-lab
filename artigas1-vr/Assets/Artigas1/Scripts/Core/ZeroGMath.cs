using UnityEngine;

namespace Artigas1
{
    /// <summary>Cuentas de la locomoción en gravedad cero, sin MonoBehaviour (se prueban fuera de Unity).</summary>
    public static class ZeroGMath
    {
        /// <summary>
        /// Promedia las últimas <paramref name="frames"/> velocidades del búfer (las más nuevas al final) y limita
        /// el módulo a <paramref name="maxSpeed"/>. Así se filtra el temblor de la mano al soltar.
        /// </summary>
        public static Vector3 ReleaseVelocity(VelocityBuffer buffer, int frames, float maxSpeed)
        {
            if (buffer == null || buffer.Count == 0 || frames <= 0)
            {
                return Vector3.zero;
            }
            int n = Mathf.Min(frames, buffer.Count);
            Vector3 sum = Vector3.zero;
            for (int i = 0; i < n; i++)
            {
                sum += buffer.FromNewest(i);
            }
            return ClampMagnitude(sum / n, maxSpeed);
        }

        /// <summary>Amortiguación exponencial: v · e^(−k·dt). Con k = 0 la velocidad se conserva.</summary>
        public static Vector3 Damp(Vector3 velocity, float damping, float dt)
        {
            if (damping <= 0f || dt <= 0f)
            {
                return velocity;
            }
            return velocity * (float)System.Math.Exp(-damping * dt);
        }

        /// <summary>Como <see cref="Damp"/>, y además frena del todo por debajo de <paramref name="minSpeed"/>.</summary>
        public static Vector3 Drift(Vector3 velocity, float damping, float minSpeed, float dt)
        {
            Vector3 v = Damp(velocity, damping, dt);
            return v.magnitude < minSpeed ? Vector3.zero : v;
        }

        public static Vector3 ClampMagnitude(Vector3 v, float max)
        {
            float m = v.magnitude;
            if (max <= 0f)
            {
                return Vector3.zero;
            }
            return m > max ? v * (max / m) : v;
        }

        /// <summary>
        /// Respuesta a un choque contra una superficie de normal <paramref name="normal"/> (unitaria): se quita la
        /// componente que entra a la pared y se devuelve una fracción <paramref name="bounce"/> de ella.
        /// </summary>
        public static Vector3 Collide(Vector3 velocity, Vector3 normal, float bounce)
        {
            float into = Vector3.Dot(velocity, normal);
            if (into >= 0f)
            {
                return velocity; // se aleja de la pared
            }
            return velocity - normal * (into * (1f + Mathf.Clamp01(bounce)));
        }

        /// <summary>
        /// Apertura de la viñeta (1 = abierta) según la aceleración: lineal entre 1 y <paramref name="minAperture"/>
        /// cuando la aceleración va de 0 a <paramref name="accelForMax"/>.
        /// </summary>
        public static float VignetteAperture(float acceleration, float accelForMax, float minAperture)
        {
            if (accelForMax <= 0f)
            {
                return 1f;
            }
            float k = Mathf.Clamp01(acceleration / accelForMax);
            return Mathf.Lerp(1f, Mathf.Clamp01(minAperture), k);
        }

        /// <summary>
        /// Respuesta de una carga a la mano según su masa: 1 para cargas livianas, baja hasta 0,2 a 80 kg.
        /// Se usa como escala de velocidad del agarre (la carga pesada «llega tarde» a la mano).
        /// </summary>
        public static float HandResponse(float massKg)
        {
            if (massKg <= 5f)
            {
                return 1f;
            }
            float k = Mathf.Clamp01((massKg - 5f) / 75f);
            return Mathf.Lerp(1f, 0.2f, k);
        }

        /// <summary>Las cargas de más de 30 kg piden las dos manos (sección 1.2 del plan).</summary>
        public static bool NeedsTwoHands(float massKg) => massKg > 30f;
    }

    /// <summary>Búfer circular de velocidades recientes (sin asignar memoria por cuadro).</summary>
    public sealed class VelocityBuffer
    {
        private readonly Vector3[] _items;
        private int _next;

        public VelocityBuffer(int capacity)
        {
            _items = new Vector3[Mathf.Max(1, capacity)];
        }

        public int Count { get; private set; }

        public int Capacity => _items.Length;

        public void Push(Vector3 v)
        {
            _items[_next] = v;
            _next = (_next + 1) % _items.Length;
            if (Count < _items.Length)
            {
                Count++;
            }
        }

        /// <summary>0 = la más nueva.</summary>
        public Vector3 FromNewest(int index)
        {
            int i = (_next - 1 - index) % _items.Length;
            if (i < 0)
            {
                i += _items.Length;
            }
            return _items[i];
        }

        public void Clear()
        {
            Count = 0;
            _next = 0;
        }
    }
}

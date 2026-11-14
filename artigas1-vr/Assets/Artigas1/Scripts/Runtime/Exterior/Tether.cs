using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Cable de seguridad de la caminata espacial: une un punto de anclaje de la estación con el traje.
    /// Cambia de color al acercarse al largo máximo y, si se tensa, frena al astronauta (no lo arrastra).
    /// </summary>
    [RequireComponent(typeof(LineRenderer))]
    [AddComponentMenu("Artigas-1/Tether de seguridad")]
    public sealed class Tether : MonoBehaviour
    {
        [SerializeField] private Transform ancla;
        [SerializeField] private float largoMaximo = 18f;
        [Range(4, 32)] [SerializeField] private int puntos = 16;

        private LineRenderer _linea;
        private Transform _cabeza;
        private ZeroGLocomotion _locomocion;
        private bool _tenso;

        public float Distancia { get; private set; }

        public float LargoMaximo => largoMaximo;

        public void Configurar(Transform puntoAncla, float largo)
        {
            ancla = puntoAncla;
            largoMaximo = largo;
        }

        private void Awake()
        {
            _linea = GetComponent<LineRenderer>();
            _linea.positionCount = puntos;
            _linea.useWorldSpace = true;
            _locomocion = FindAnyObjectByType<ZeroGLocomotion>();
        }

        private void LateUpdate()
        {
            if (ancla == null)
            {
                return;
            }
            if (_cabeza == null)
            {
                if (Camera.main == null)
                {
                    return;
                }
                _cabeza = Camera.main.transform;
            }
            Vector3 a = ancla.position;
            // el cable se engancha en la cintura del traje, unos 45 cm debajo de la cabeza
            Vector3 b = _cabeza.position - _cabeza.parent.up * 0.45f;
            Distancia = Vector3.Distance(a, b);
            float flojo = Mathf.Max(0f, largoMaximo - Distancia);
            Vector3 comba = -_cabeza.parent.up * Mathf.Min(1.2f, flojo * 0.12f);
            Vector3 medio = (a + b) * 0.5f + comba;
            for (int i = 0; i < puntos; i++)
            {
                float t = i / (float)(puntos - 1);
                Vector3 p = (1f - t) * (1f - t) * a + 2f * (1f - t) * t * medio + t * t * b;
                _linea.SetPosition(i, p);
            }
            float uso = Distancia / largoMaximo;
            Color c = uso < 0.75f ? new Color(0.95f, 0.85f, 0.20f) : uso < 1f ? LuzEstado.Ambar : LuzEstado.Rojo;
            _linea.startColor = c;
            _linea.endColor = c;
            bool tenso = Distancia > largoMaximo;
            if (tenso && !_tenso && _locomocion != null)
            {
                _locomocion.Detener();
                Debug.Log("[Artigas1] Tether tenso: el cable frenó al astronauta.", this);
            }
            _tenso = tenso;
        }
    }
}

using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Mide el tiempo por cuadro y publica un resumen cada <c>intervalo</c> segundos (consola o logcat:
    /// <c>adb logcat -s Unity | grep Artigas1</c>). Complementa al OVR Metrics Tool, no lo reemplaza.
    /// Presupuesto del Quest 2 a 72 Hz: 13,8 ms.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Medidor de rendimiento")]
    public sealed class MedidorRendimiento : MonoBehaviour
    {
        [SerializeField] private float intervalo = 10f;
        [SerializeField] private float presupuestoMs = FrameStats.PresupuestoQuest2Ms;
        [Tooltip("Cuadros iniciales que se descartan (carga de la escena).")]
        [SerializeField] private int descartarAlInicio = 60;

        private FrameStats _ventana;
        private float _proximo;
        private int _descartados;

        public string UltimoResumen { get; private set; } = "midiendo…";

        public float UltimoFps { get; private set; }

        private void Awake()
        {
            _ventana = new FrameStats(presupuestoMs);
            _proximo = Time.unscaledTime + intervalo;
        }

        private void Update()
        {
            if (_descartados < descartarAlInicio)
            {
                _descartados++;
                return;
            }
            _ventana.Agregar(Time.unscaledDeltaTime * 1000f);
            if (Time.unscaledTime < _proximo)
            {
                return;
            }
            UltimoResumen = _ventana.Resumen();
            UltimoFps = _ventana.FpsPromedio;
            Debug.Log($"[Artigas1] Rendimiento: {UltimoResumen}", this);
            _ventana.Reiniciar();
            _proximo = Time.unscaledTime + intervalo;
        }
    }
}

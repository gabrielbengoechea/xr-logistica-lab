using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Movimiento lento de piezas exteriores: las alas solares siguen al sol oscilando unos grados y la antena
    /// barre el cielo. Solo rota la pieza, nunca la mueve de lugar.
    /// </summary>
    [AddComponentMenu("Artigas-1/Rotación lenta")]
    public sealed class RotacionLenta : MonoBehaviour
    {
        [SerializeField] private Vector3 ejeLocal = Vector3.up;
        [Tooltip("Amplitud de la oscilación en grados (0 = giro continuo).")]
        [SerializeField] private float amplitud = 8f;
        [SerializeField] private float periodoSegundos = 60f;
        [Tooltip("Velocidad del giro continuo en grados por segundo (solo si la amplitud es 0).")]
        [SerializeField] private float gradosPorSegundo = 2f;

        private Quaternion _inicial;

        public void Configurar(Vector3 eje, float amp, float periodo, float velocidad)
        {
            ejeLocal = eje;
            amplitud = amp;
            periodoSegundos = periodo;
            gradosPorSegundo = velocidad;
        }

        private void Start()
        {
            _inicial = transform.localRotation;
        }

        private void Update()
        {
            float angulo = amplitud > 0f
                ? Mathf.Sin(Time.time * 2f * Mathf.PI / Mathf.Max(1f, periodoSegundos)) * amplitud
                : Time.time * gradosPorSegundo;
            transform.localRotation = _inicial * Quaternion.AngleAxis(angulo, ejeLocal);
        }
    }
}

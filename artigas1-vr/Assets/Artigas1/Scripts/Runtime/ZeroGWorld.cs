using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Ajustes globales de la escena en microgravedad: sin gravedad y paso de física de 1/72 s (un paso por cuadro
    /// en el Quest 2). Restaura los valores anteriores al desactivarse.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Mundo en gravedad cero")]
    public sealed class ZeroGWorld : MonoBehaviour
    {
        [SerializeField] private bool sinGravedad = true;
        [Tooltip("Paso fijo de física en segundos (1/72 = 0,01389).")]
        [SerializeField] private float pasoFisica = 1f / 72f;

        private Vector3 _gravedadAnterior;
        private float _pasoAnterior;

        private void OnEnable()
        {
            _gravedadAnterior = Physics.gravity;
            _pasoAnterior = Time.fixedDeltaTime;
            if (sinGravedad)
            {
                Physics.gravity = Vector3.zero;
            }
            if (pasoFisica > 0f)
            {
                Time.fixedDeltaTime = pasoFisica;
            }
        }

        private void OnDisable()
        {
            Physics.gravity = _gravedadAnterior;
            Time.fixedDeltaTime = _pasoAnterior;
        }
    }
}

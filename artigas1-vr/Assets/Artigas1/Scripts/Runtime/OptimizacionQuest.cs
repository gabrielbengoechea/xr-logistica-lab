using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR;

namespace Artigas1
{
    /// <summary>
    /// Ajustes de rendimiento para el visor: renderizado foveado fijo (los bordes de la imagen, que el ojo casi no ve
    /// nítidos, se dibujan con menos detalle) y la escala de resolución del ojo. Ayuda a llegar a los 72 fps del Quest 2.
    /// Fuera del visor no hace nada.
    /// </summary>
    [AddComponentMenu("Artigas-1/Optimización para Quest")]
    public sealed class OptimizacionQuest : MonoBehaviour
    {
        [Tooltip("0 = sin foveado, 1 = máximo. 0,5 es casi imperceptible y ahorra bastante GPU.")]
        [Range(0f, 1f)] [SerializeField] private float foveado = 0.5f;
        [Tooltip("Escala de la textura de cada ojo. 1 = la resolución recomendada por el visor.")]
        [Range(0.7f, 1.2f)] [SerializeField] private float escalaOjo = 1f;

        private readonly List<XRDisplaySubsystem> _pantallas = new List<XRDisplaySubsystem>();
        private bool _aplicado;

        private void Update()
        {
            // el subsistema de XR arranca unos cuadros después de la escena: se reintenta hasta que esté
            if (_aplicado)
            {
                return;
            }
            SubsystemManager.GetSubsystems(_pantallas);
            foreach (XRDisplaySubsystem p in _pantallas)
            {
                if (!p.running)
                {
                    continue;
                }
                p.foveatedRenderingLevel = foveado;
                p.foveatedRenderingFlags = XRDisplaySubsystem.FoveatedRenderingFlags.None;
                XRSettings.eyeTextureResolutionScale = escalaOjo;
                _aplicado = true;
                Debug.Log($"[Artigas1] Visor: foveado {foveado:0.00}, escala del ojo {escalaOjo:0.00}.", this);
            }
            enabled = !_aplicado;
        }
    }
}

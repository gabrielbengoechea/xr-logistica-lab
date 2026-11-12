using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Locomotion.Comfort;

namespace Artigas1
{
    /// <summary>
    /// Viñeta dinámica: cierra el campo visual periférico solo cuando hay aceleración (sección 1.1 del plan).
    /// Le pide la viñeta al <c>TunnelingVignetteController</c> del rig de XR Interaction Toolkit, con la apertura
    /// que calcula <see cref="ZeroGLocomotion"/>.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Viñeta de confort")]
    public sealed class ConfortVineta : MonoBehaviour, ITunnelingVignetteProvider
    {
        [SerializeField] private TunnelingVignetteController controlador;
        [SerializeField] private ZeroGLocomotion locomocion;
        [SerializeField] private VignetteParameters parametros = new VignetteParameters();
        [Tooltip("Por debajo de esta apertura se enciende la viñeta.")]
        [Range(0.5f, 1f)] [SerializeField] private float umbral = 0.97f;

        private bool _activa;

        public VignetteParameters vignetteParameters => parametros;

        private void Awake()
        {
            if (controlador == null)
            {
                controlador = FindAnyObjectByType<TunnelingVignetteController>();
            }
            if (locomocion == null)
            {
                locomocion = FindAnyObjectByType<ZeroGLocomotion>();
            }
        }

        private void OnDisable()
        {
            Apagar();
        }

        private void Update()
        {
            if (controlador == null || locomocion == null)
            {
                return;
            }
            float apertura = locomocion.AperturaVineta;
            parametros.apertureSize = apertura;
            bool quiere = apertura < umbral;
            if (quiere && !_activa)
            {
                controlador.BeginTunnelingVignette(this);
                _activa = true;
            }
            else if (!quiere && _activa)
            {
                Apagar();
            }
        }

        private void Apagar()
        {
            if (_activa && controlador != null)
            {
                controlador.EndTunnelingVignette(this);
            }
            _activa = false;
        }
    }
}

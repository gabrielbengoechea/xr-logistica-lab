using UnityEngine;
using UnityEngine.Events;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace Artigas1
{
    /// <summary>
    /// Botón físico de panel: se aprieta con el agarre (de cerca o con el rayo) o con el gatillo.
    /// El capuchón se hunde y el LED parpadea para confirmar la pulsación.
    /// </summary>
    [AddComponentMenu("Artigas-1/Botón físico")]
    public sealed class BotonFisico : MonoBehaviour
    {
        [SerializeField] private Transform capuchon;
        [SerializeField] private Renderer led;
        [SerializeField] private float recorrido = 0.012f;
        [SerializeField] private float segundosPulsado = 0.15f;
        [SerializeField] private UnityEvent alPresionar = new UnityEvent();

        private XRSimpleInteractable _interactuable;
        private Vector3 _reposo;
        private float _hasta;

        public UnityEvent AlPresionar => alPresionar;

        public void Configurar(Transform cap, Renderer luz)
        {
            capuchon = cap;
            led = luz;
        }

        private void Awake()
        {
            _interactuable = GetComponent<XRSimpleInteractable>();
            if (_interactuable == null)
            {
                _interactuable = gameObject.AddComponent<XRSimpleInteractable>();
            }
            if (capuchon != null)
            {
                _reposo = capuchon.localPosition;
            }
        }

        private void OnEnable()
        {
            _interactuable.selectEntered.AddListener(OnSelect);
            _interactuable.activated.AddListener(OnActivate);
        }

        private void OnDisable()
        {
            _interactuable.selectEntered.RemoveListener(OnSelect);
            _interactuable.activated.RemoveListener(OnActivate);
        }

        private void OnSelect(SelectEnterEventArgs args)
        {
            Presionar();
        }

        private void OnActivate(ActivateEventArgs args)
        {
            Presionar();
        }

        public void Presionar()
        {
            if (Time.time < _hasta)
            {
                return;
            }
            _hasta = Time.time + segundosPulsado;
            alPresionar.Invoke();
        }

        private void Update()
        {
            bool abajo = Time.time < _hasta;
            if (capuchon != null)
            {
                capuchon.localPosition = _reposo + (abajo ? Vector3.forward * recorrido : Vector3.zero);
            }
            if (led != null)
            {
                LuzEstado.Pintar(led, abajo ? LuzEstado.Verde : LuzEstado.Cian);
            }
        }
    }
}

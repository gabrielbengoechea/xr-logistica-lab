using System;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;
using XRLab;
using XRLab.Telemetry;

namespace Artigas1
{
    /// <summary>
    /// Unidad de carga (bolsa de transferencia o contenedor). En 0G no pesa pero tiene masa: cuesta arrancarla y
    /// frenarla, y una carga pesada «llega tarde» a la mano. Las de más de 30 kg piden las dos manos.
    /// Lleva la máquina de estados de la sección 1.2 del plan.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Rigidbody))]
    [RequireComponent(typeof(XRGrabInteractable))]
    [AddComponentMenu("Artigas-1/Unidad de carga")]
    public sealed class CargoUnit : MonoBehaviour
    {
        [SerializeField] private CargoSpec datos = new CargoSpec();
        [SerializeField] private EstadoCarga estado = EstadoCarga.EnTransito;
        [Tooltip("Debe aparecer en el manifiesto del turno.")]
        [SerializeField] private bool enManifiesto = true;
        [Tooltip("Punto del bolsillo de la etiqueta (ETIQUETA_* del FBX). Vacío: sin etiqueta.")]
        [SerializeField] private Transform etiqueta;
        [SerializeField] private XRGrabInteractable grab;
        [SerializeField] private Rigidbody body;
        [SerializeField] private TelemetryLogger telemetria;

        private int _manos;

        public CargoSpec Datos => datos;

        public string Codigo => datos.codigo;

        public EstadoCarga Estado => estado;

        public bool EnManifiesto => enManifiesto;

        public bool TieneEtiqueta => etiqueta != null && datos.etiquetaLegible;

        /// <summary>Dirección hacia la que mira la etiqueta (del centro de la carga al bolsillo).</summary>
        public Vector3 NormalEtiqueta =>
            etiqueta != null ? (etiqueta.position - body.worldCenterOfMass).normalized : Vector3.zero;

        public bool Tomada => _manos > 0;

        /// <summary>Hueco donde está apoyada (lo maneja <see cref="RackSlot"/>).</summary>
        public RackSlot Hueco { get; internal set; }

        public event Action<CargoUnit> AlTomar;
        public event Action<CargoUnit> AlSoltar;
        public event Action<CargoUnit, EstadoCarga> EstadoCambiado;

        private void Reset()
        {
            grab = GetComponent<XRGrabInteractable>();
            body = GetComponent<Rigidbody>();
        }

        private void Awake()
        {
            if (grab == null)
            {
                grab = GetComponent<XRGrabInteractable>();
            }
            if (body == null)
            {
                body = GetComponent<Rigidbody>();
            }
            if (telemetria == null)
            {
                telemetria = FindAnyObjectByType<TelemetryLogger>();
            }
            AplicarFisica();
        }

        private void OnEnable()
        {
            grab.selectEntered.AddListener(OnSelectEntered);
            grab.selectExited.AddListener(OnSelectExited);
        }

        private void OnDisable()
        {
            grab.selectEntered.RemoveListener(OnSelectEntered);
            grab.selectExited.RemoveListener(OnSelectExited);
        }

        /// <summary>Carga los datos (lo usa el armado de escena del editor).</summary>
        public void Configurar(CargoSpec spec, bool manifiesto, Transform puntoEtiqueta)
        {
            datos = spec;
            enManifiesto = manifiesto;
            etiqueta = puntoEtiqueta;
            if (body == null)
            {
                body = GetComponent<Rigidbody>();
            }
            if (grab == null)
            {
                grab = GetComponent<XRGrabInteractable>();
            }
            AplicarFisica();
        }

        /// <summary>Masa, sin gravedad y respuesta del agarre según la masa.</summary>
        public void AplicarFisica()
        {
            body.useGravity = false;
            body.mass = Mathf.Max(0.5f, datos.masaKg);
            body.linearDamping = 0.02f;
            body.angularDamping = 0.05f;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            grab.movementType = XRBaseInteractable.MovementType.VelocityTracking;
            grab.throwOnDetach = true;
            grab.useDynamicAttach = true;
            grab.selectMode = InteractableSelectMode.Multiple;
            AjustarRespuesta();
        }

        private void AjustarRespuesta()
        {
            float r = ZeroGMath.HandResponse(datos.masaKg);
            if (ZeroGMath.NeedsTwoHands(datos.masaKg) && _manos < 2)
            {
                r = 0.05f; // con una sola mano casi no se mueve: hacen falta las dos
            }
            grab.velocityScale = r;
            grab.angularVelocityScale = r;
        }

        public bool CambiarEstado(EstadoCarga nuevo)
        {
            if (!SlotRules.CanTransition(estado, nuevo))
            {
                return false;
            }
            estado = nuevo;
            EstadoCambiado?.Invoke(this, nuevo);
            return true;
        }

        /// <summary>Fija la carga (apoyada en un hueco) o la libera. No usa isKinematic para no pelear con el agarre.</summary>
        public void Congelar(bool fija)
        {
            if (body == null)
            {
                body = GetComponent<Rigidbody>();
            }
            body.linearVelocity = Vector3.zero;
            body.angularVelocity = Vector3.zero;
            body.constraints = fija ? RigidbodyConstraints.FreezeAll : RigidbodyConstraints.None;
        }

        private void OnSelectEntered(SelectEnterEventArgs args)
        {
            _manos = grab.interactorsSelecting.Count;
            AjustarRespuesta();
            if (_manos != 1)
            {
                return; // la segunda mano no es un agarre nuevo
            }
            CambiarEstado(EstadoCarga.EnTransito);
            if (telemetria != null)
            {
                telemetria.Log(TelemetryEventType.Grab, Codigo);
            }
            AlTomar?.Invoke(this);
            if (body.constraints != RigidbodyConstraints.None)
            {
                Congelar(false);
            }
        }

        private void OnSelectExited(SelectExitEventArgs args)
        {
            _manos = grab.interactorsSelecting.Count;
            AjustarRespuesta();
            if (_manos > 0)
            {
                return;
            }
            if (telemetria != null)
            {
                telemetria.Log(TelemetryEventType.Release, Codigo);
            }
            AlSoltar?.Invoke(this);
        }
    }
}

using System.Collections.Generic;
using UnityEngine;
using XRLab;
using XRLab.Telemetry;

namespace Artigas1
{
    /// <summary>
    /// Hueco de un rack (Snap Zone). Cuando se suelta una carga adentro, valida las reglas (talla, masa, categoría,
    /// ocupado); si están bien, la acerca como un imán y la deja apoyada. Si no, el LED parpadea en rojo y la carga
    /// sigue flotando. Una carga apoyada se libera en cuanto alguien la vuelve a tomar.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BoxCollider))]
    [AddComponentMenu("Artigas-1/Hueco de rack")]
    public sealed class RackSlot : MonoBehaviour
    {
        [SerializeField] private SlotSpec reglas = new SlotSpec();
        [Tooltip("LED del hueco (SM_Indicador_Hueco).")]
        [SerializeField] private Renderer indicador;
        [SerializeField] private CargoUnit ocupante;
        [Tooltip("Fase 2: la carga queda «apoyada» (ámbar) hasta que se amarra con correas.")]
        [SerializeField] private bool requiereAmarre;
        [SerializeField] private float segundosIman = 0.25f;
        [SerializeField] private TelemetryLogger telemetria;

        private readonly HashSet<CargoUnit> _cerca = new HashSet<CargoUnit>();
        private Vector3 _desdePos;
        private Quaternion _desdeRot;
        private float _t = 1f;
        private float _rojoHasta;
        private Color _ultimaLuz = new Color(-1f, -1f, -1f, -1f);

        public SlotSpec Reglas => reglas;

        public string Codigo => reglas.codigo;

        public CargoUnit Ocupante => ocupante;

        public Renderer Indicador => indicador;

        public string UltimoRechazo { get; private set; }

        private void Awake()
        {
            GetComponent<BoxCollider>().isTrigger = true;
            if (telemetria == null)
            {
                telemetria = FindAnyObjectByType<TelemetryLogger>();
            }
        }

        private void Start()
        {
            if (ocupante != null)
            {
                ocupante.Hueco = this;
                ocupante.Congelar(true);
                ocupante.AlTomar += OnTomanOcupante;
            }
            ActualizarLuz();
        }

        /// <summary>Configura el hueco (armado de escena en el editor).</summary>
        public void Configurar(SlotSpec spec, Renderer led, bool amarre)
        {
            reglas = spec;
            indicador = led;
            requiereAmarre = amarre;
        }

        /// <summary>Deja una carga en el hueco sin animación ni telemetría (armado de escena en el editor).</summary>
        public void ColocarInmediato(CargoUnit carga)
        {
            ocupante = carga;
            carga.transform.SetPositionAndRotation(transform.position, transform.rotation);
            carga.Congelar(true);
        }

        private void OnTriggerEnter(Collider other)
        {
            CargoUnit c = other.attachedRigidbody != null ? other.attachedRigidbody.GetComponent<CargoUnit>() : null;
            if (c != null && _cerca.Add(c))
            {
                c.AlSoltar += OnSueltan;
            }
        }

        private void OnTriggerExit(Collider other)
        {
            CargoUnit c = other.attachedRigidbody != null ? other.attachedRigidbody.GetComponent<CargoUnit>() : null;
            if (c != null && _cerca.Remove(c))
            {
                c.AlSoltar -= OnSueltan;
            }
        }

        private void OnDestroy()
        {
            foreach (CargoUnit c in _cerca)
            {
                if (c != null)
                {
                    c.AlSoltar -= OnSueltan;
                }
            }
            if (ocupante != null)
            {
                ocupante.AlTomar -= OnTomanOcupante;
            }
        }

        private void OnSueltan(CargoUnit c)
        {
            if (c == ocupante || c.Hueco != null)
            {
                return;
            }
            SlotCheck chk = SlotRules.Check(c.Datos, reglas, ocupante != null);
            if (!chk.Ok)
            {
                UltimoRechazo = chk.Motivo;
                _rojoHasta = Time.time + 0.8f;
                if (telemetria != null)
                {
                    telemetria.Log(TelemetryEventType.SnapFail, c.Codigo, reglas.codigo, chk.Motivo);
                }
                return;
            }
            UltimoRechazo = null;
            ocupante = c;
            c.Hueco = this;
            c.Congelar(true);
            c.CambiarEstado(EstadoCarga.Apoyada);
            if (!requiereAmarre)
            {
                c.CambiarEstado(EstadoCarga.Asegurada);
            }
            c.AlTomar += OnTomanOcupante;
            _desdePos = c.transform.position;
            _desdeRot = c.transform.rotation;
            _t = 0f;
            if (telemetria != null)
            {
                telemetria.Log(TelemetryEventType.SnapOk, c.Codigo, reglas.codigo);
            }
        }

        private void OnTomanOcupante(CargoUnit c)
        {
            if (c != ocupante)
            {
                return;
            }
            c.AlTomar -= OnTomanOcupante;
            c.Hueco = null;
            c.Congelar(false);
            ocupante = null;
            _t = 1f;
            if (telemetria != null)
            {
                telemetria.NotifyUnplaced();
            }
        }

        private void Update()
        {
            if (_t < 1f && ocupante != null)
            {
                _t = segundosIman > 0f ? Mathf.Min(1f, _t + Time.deltaTime / segundosIman) : 1f;
                float k = _t * _t * (3f - 2f * _t);
                ocupante.transform.SetPositionAndRotation(
                    Vector3.Lerp(_desdePos, transform.position, k),
                    Quaternion.Slerp(_desdeRot, transform.rotation, k));
            }
            ActualizarLuz();
        }

        private void ActualizarLuz()
        {
            if (indicador == null)
            {
                return;
            }
            Color c;
            if (Time.time < _rojoHasta)
            {
                c = Mathf.Repeat(Time.time * 6f, 1f) < 0.5f ? LuzEstado.Rojo : LuzEstado.Apagada;
            }
            else if (ocupante != null)
            {
                c = ocupante.Estado == EstadoCarga.Apoyada ? LuzEstado.Ambar : LuzEstado.Verde;
            }
            else
            {
                c = HayCargaTomadaCerca() ? LuzEstado.Cian : LuzEstado.Apagada;
            }
            if (c != _ultimaLuz)
            {
                LuzEstado.Pintar(indicador, c);
                _ultimaLuz = c;
            }
        }

        private bool HayCargaTomadaCerca()
        {
            foreach (CargoUnit c in _cerca)
            {
                if (c != null && c.Tomada)
                {
                    return true;
                }
            }
            return false;
        }
    }
}

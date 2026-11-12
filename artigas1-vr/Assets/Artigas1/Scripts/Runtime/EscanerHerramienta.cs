using System;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace Artigas1
{
    /// <summary>
    /// Escáner de mano (sección 1.2 del plan): con el gatillo dispara un rayo de 1,5 m. Lee la etiqueta si la carga
    /// la muestra con menos de 45° de ángulo; si no, pide girarla. En 0G la etiqueta puede quedar del otro lado.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(XRGrabInteractable))]
    [AddComponentMenu("Artigas-1/Escáner de mano")]
    public sealed class EscanerHerramienta : MonoBehaviour
    {
        [Tooltip("Lente del escáner (RAYO_SM_Escaner del FBX).")]
        [SerializeField] private Transform rayo;
        [Tooltip("Dirección del rayo en coordenadas locales del escáner (la calcula el armado de prefabs).")]
        [SerializeField] private Vector3 ejeLocal = Vector3.forward;
        [SerializeField] private float alcance = 1.5f;
        [SerializeField] private float anguloMaximo = 45f;
        [SerializeField] private InventoryService inventario;
        [SerializeField] private XRGrabInteractable grab;

        [Header("Respuesta")]
        [SerializeField] private AudioSource audioFuente;
        [SerializeField] private AudioClip sonidoOk;
        [SerializeField] private AudioClip sonidoError;
        [SerializeField] private LineRenderer laser;
        [SerializeField] private float segundosLaser = 0.15f;

        private float _laserHasta;

        /// <summary>Texto corto para la pantalla del escáner.</summary>
        public string UltimoMensaje { get; private set; } = "Listo";

        public event Action<string> Mensaje;

        public Vector3 Direccion => transform.TransformDirection(ejeLocal).normalized;

        public void Configurar(Transform puntoRayo, Vector3 eje)
        {
            rayo = puntoRayo;
            ejeLocal = eje;
        }

        private void Awake()
        {
            if (grab == null)
            {
                grab = GetComponent<XRGrabInteractable>();
            }
            if (inventario == null)
            {
                inventario = FindAnyObjectByType<InventoryService>();
            }
            if (laser != null)
            {
                laser.enabled = false;
            }
        }

        private void OnEnable()
        {
            grab.activated.AddListener(OnActivated);
        }

        private void OnDisable()
        {
            grab.activated.RemoveListener(OnActivated);
        }

        private void OnActivated(ActivateEventArgs args)
        {
            Escanear();
        }

        /// <summary>Dispara una lectura. Devuelve la carga leída o null.</summary>
        public CargoUnit Escanear()
        {
            Vector3 origen = rayo != null ? rayo.position : transform.position;
            Vector3 dir = Direccion;
            Vector3 fin = origen + dir * alcance;
            CargoUnit carga = null;
            if (Physics.Raycast(origen, dir, out RaycastHit hit, alcance, ~0, QueryTriggerInteraction.Ignore))
            {
                fin = hit.point;
                carga = hit.collider.GetComponentInParent<CargoUnit>();
            }
            MostrarLaser(origen, fin);
            if (carga == null)
            {
                Avisar("Sin lectura", false);
                return null;
            }
            if (carga.TieneEtiqueta && Vector3.Angle(-dir, carga.NormalEtiqueta) > anguloMaximo)
            {
                Avisar("Girá la carga: la etiqueta no se ve", false);
                return null;
            }
            ResultadoLectura r = inventario != null ? inventario.Leer(carga, "escaner") : ResultadoLectura.EnManifiesto;
            switch (r)
            {
                case ResultadoLectura.EnManifiesto:
                    Avisar($"{carga.Codigo} · {SlotRules.Nombre(carga.Datos.categoria)} · {carga.Datos.masaKg:0.#} kg", true);
                    break;
                case ResultadoLectura.Repetida:
                    Avisar($"{carga.Codigo} ya estaba leída", true);
                    break;
                case ResultadoLectura.NoEstaEnManifiesto:
                    Avisar($"{carga.Codigo} NO está en el manifiesto: a cuarentena", false);
                    break;
                default:
                    Avisar("Etiqueta ilegible: a cuarentena", false);
                    break;
            }
            return carga;
        }

        private void Avisar(string texto, bool ok)
        {
            UltimoMensaje = texto;
            Mensaje?.Invoke(texto);
            if (audioFuente != null)
            {
                AudioClip clip = ok ? sonidoOk : sonidoError;
                if (clip != null)
                {
                    audioFuente.PlayOneShot(clip);
                }
            }
        }

        private void MostrarLaser(Vector3 a, Vector3 b)
        {
            if (laser == null)
            {
                return;
            }
            laser.positionCount = 2;
            laser.SetPosition(0, a);
            laser.SetPosition(1, b);
            laser.enabled = true;
            _laserHasta = Time.time + segundosLaser;
        }

        private void Update()
        {
            if (laser != null && laser.enabled && Time.time > _laserHasta)
            {
                laser.enabled = false;
            }
        }
    }
}

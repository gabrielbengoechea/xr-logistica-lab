using System.Collections.Generic;
using Unity.XR.CoreUtils;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Inspección exterior: llegar con las barandas hasta un componente marcado y mantener la mano cerca
    /// unos segundos mientras se revisa. Sirve para la caminata espacial (fase 5).
    /// </summary>
    [AddComponentMenu("Artigas-1/Actividad: inspección exterior")]
    public sealed class ActividadInspeccion : ActividadBase
    {
        [SerializeField] private Transform objetivo;
        [SerializeField] private string componente = "la junta del ala solar";
        [SerializeField] private float radio = 0.7f;
        [SerializeField] private float segundosRequeridos = 3f;

        private readonly List<Transform> _manos = new List<Transform>();
        private float _acumulado;
        private float _proximoAviso;

        public void Configurar(Transform punto, string nombre)
        {
            objetivo = punto;
            componente = nombre;
            TextosPorDefecto();
        }

        private void Reset()
        {
            TextosPorDefecto();
        }

        /// <summary>Carga el título, la introducción y las instrucciones de fábrica.</summary>
        public void TextosPorDefecto()
        {
            titulo = "Caminata espacial: inspección";
            introduccion = $"El control de tierra pide revisar {componente}. Afuera no hay piso ni paredes: el cuerpo se mueve tomándose de los pasamanos, siempre con el cable de seguridad enganchado.";
            instrucciones = $"Avanzá mano sobre mano por los pasamanos amarillos hasta la baliza ámbar de {componente}. Acercá una mano a menos de {radio:0.0} m y mantenela {segundosRequeridos:0} s para completar la inspección. No sueltes las dos manos a la vez.";
        }

        public float Distancia { get; private set; } = float.PositiveInfinity;

        public override float Progreso => Mathf.Clamp01(_acumulado / segundosRequeridos);

        public override string DetalleProgreso => float.IsInfinity(Distancia)
            ? "Buscando el objetivo"
            : $"A {Distancia:0.0} m de {componente} · inspección {Progreso * 100f:0}%";

        protected override void AlComenzar()
        {
            _acumulado = 0f;
            _manos.Clear();
            XROrigin origen = FindAnyObjectByType<XROrigin>();
            if (origen != null)
            {
                foreach (Transform t in origen.GetComponentsInChildren<Transform>(true))
                {
                    if (t.name.Contains("Controller") && (t.name.Contains("Left") || t.name.Contains("Right")) && t.parent != null && !t.parent.name.Contains("Controller"))
                    {
                        _manos.Add(t);
                    }
                }
                if (origen.Camera != null)
                {
                    _manos.Add(origen.Camera.transform);
                }
            }
        }

        protected override void AlCompletar()
        {
            Puntaje = Mathf.Max(150, 1200 - Mathf.RoundToInt(Segundos * 3f));
        }

        private void Update()
        {
            if (Estado != EstadoActividad.EnCurso || objetivo == null)
            {
                return;
            }
            float d = float.PositiveInfinity;
            foreach (Transform m in _manos)
            {
                if (m != null)
                {
                    d = Mathf.Min(d, Vector3.Distance(m.position, objetivo.position));
                }
            }
            Distancia = d;
            _acumulado = d <= radio ? _acumulado + Time.deltaTime : Mathf.Max(0f, _acumulado - Time.deltaTime * 0.5f);
            if (Time.time >= _proximoAviso)
            {
                _proximoAviso = Time.time + 0.25f;
                Avisar();
            }
            if (_acumulado >= segundosRequeridos)
            {
                Completar();
            }
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Artigas1
{
    /// <summary>Ordena las actividades del turno: comenzar, pasar a la siguiente y sumar el puntaje.</summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Gestor de actividades")]
    public sealed class GestorActividades : MonoBehaviour
    {
        [SerializeField] private List<ActividadBase> actividades = new List<ActividadBase>();

        private int _indice;

        public IReadOnlyList<ActividadBase> Actividades => actividades;

        public ActividadBase Actual => _indice < actividades.Count ? actividades[_indice] : null;

        public bool TurnoTerminado => _indice >= actividades.Count;

        public int PuntajeTotal => actividades.Where(a => a != null).Sum(a => a.Puntaje);

        public event Action Cambio;

        private void Awake()
        {
            if (actividades.Count == 0)
            {
                actividades.AddRange(GetComponentsInChildren<ActividadBase>(true));
            }
            foreach (ActividadBase a in actividades)
            {
                if (a != null)
                {
                    a.Cambio += OnCambio;
                }
            }
        }

        private void OnDestroy()
        {
            foreach (ActividadBase a in actividades)
            {
                if (a != null)
                {
                    a.Cambio -= OnCambio;
                }
            }
        }

        /// <summary>Botón principal: comienza la actividad pendiente o, si ya terminó, pasa a la siguiente.</summary>
        public void AccionPrincipal()
        {
            ActividadBase a = Actual;
            if (a == null)
            {
                return;
            }
            if (a.Estado == EstadoActividad.Pendiente)
            {
                a.Comenzar();
            }
            else if (a.Estado == EstadoActividad.Completada)
            {
                _indice++;
                Cambio?.Invoke();
            }
        }

        private void OnCambio(ActividadBase a)
        {
            Cambio?.Invoke();
        }
    }
}

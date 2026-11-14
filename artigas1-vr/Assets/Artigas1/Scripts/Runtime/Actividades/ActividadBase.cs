using System;
using UnityEngine;

namespace Artigas1
{
    public enum EstadoActividad
    {
        Pendiente,
        EnCurso,
        Completada,
    }

    /// <summary>
    /// Actividad del turno: tiene introducción, objetivo, instrucciones, condición de fin y puntaje.
    /// Las actividades concretas solo escuchan los sistemas que ya existen (racks, inventario, escáner).
    /// </summary>
    public abstract class ActividadBase : MonoBehaviour
    {
        [SerializeField] protected string titulo = "Actividad";
        [TextArea(2, 4)] [SerializeField] protected string introduccion = "";
        [TextArea(2, 5)] [SerializeField] protected string instrucciones = "";

        private float _inicio;
        private float _duracion;

        public string Titulo => titulo;
        public string Introduccion => introduccion;
        public string Instrucciones => instrucciones;
        public EstadoActividad Estado { get; private set; } = EstadoActividad.Pendiente;
        public int Puntaje { get; protected set; }
        public float Segundos => Estado == EstadoActividad.EnCurso ? Time.time - _inicio : _duracion;

        /// <summary>Avance entre 0 y 1.</summary>
        public abstract float Progreso { get; }

        /// <summary>Texto corto del avance (p. ej. «2/3 cargas aseguradas»).</summary>
        public abstract string DetalleProgreso { get; }

        public event Action<ActividadBase> Cambio;

        public void Comenzar()
        {
            if (Estado == EstadoActividad.EnCurso)
            {
                return;
            }
            _inicio = Time.time;
            _duracion = 0f;
            Puntaje = 0;
            Estado = EstadoActividad.EnCurso;
            AlComenzar();
            Debug.Log($"[Artigas1] Actividad iniciada: {titulo}", this);
            Avisar();
        }

        protected void Completar()
        {
            if (Estado != EstadoActividad.EnCurso)
            {
                return;
            }
            _duracion = Time.time - _inicio;
            Estado = EstadoActividad.Completada;
            AlCompletar();
            Debug.Log($"[Artigas1] Actividad completada: {titulo} · {Puntaje} puntos · {_duracion:0} s", this);
            Avisar();
        }

        protected void Avisar()
        {
            Cambio?.Invoke(this);
        }

        protected abstract void AlComenzar();

        protected virtual void AlCompletar()
        {
        }
    }
}

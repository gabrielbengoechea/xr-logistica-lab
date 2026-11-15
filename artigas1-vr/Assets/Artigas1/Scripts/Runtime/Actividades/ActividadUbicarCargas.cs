using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Gestión de almacenamiento: las cargas que flotan sueltas en el módulo deben quedar aseguradas en un hueco
    /// de rack compatible (talla, masa y categoría). Usa las reglas de <see cref="RackSlot"/> tal como están.
    /// </summary>
    [AddComponentMenu("Artigas-1/Actividad: ubicar cargas")]
    public sealed class ActividadUbicarCargas : ActividadBase
    {
        private readonly List<CargoUnit> _sueltas = new List<CargoUnit>();

        private void Reset()
        {
            TextosPorDefecto();
        }

        /// <summary>Carga el título, la introducción y las instrucciones de fábrica.</summary>
        public void TextosPorDefecto()
        {
            titulo = "Ubicar las cargas sueltas";
            introduccion = "Llegaron cargas que quedaron flotando en el Módulo Rivera. En 0G nada queda quieto: todo se guarda y se asegura.";
            instrucciones = "Tomá cada carga con el botón de agarre y soltala frente a un hueco libre. El LED verde indica que el hueco la acepta; rojo, que no (talla, masa o categoría). Las de más de 30 kg necesitan las dos manos.";
        }

        public int Total => _sueltas.Count;

        public int Colocadas => _sueltas.Count(c => c != null && c.Hueco != null);

        public override float Progreso => Total == 0 ? 0f : Colocadas / (float)Total;

        public override string DetalleProgreso => $"{Colocadas}/{Total} cargas aseguradas · {Segundos:0} s";

        protected override void AlComenzar()
        {
            Soltar();
            _sueltas.AddRange(FindObjectsByType<CargoUnit>(FindObjectsSortMode.None).Where(c => c.Hueco == null));
            foreach (CargoUnit c in _sueltas)
            {
                c.EstadoCambiado += OnEstado;
            }
            if (_sueltas.Count == 0)
            {
                Completar();
            }
        }

        protected override void AlCompletar()
        {
            Puntaje = Mathf.Max(100, 1000 - Mathf.RoundToInt(Segundos * 4f));
            Soltar();
        }

        private void OnEstado(CargoUnit carga, EstadoCarga estado)
        {
            if (Estado != EstadoActividad.EnCurso)
            {
                return;
            }
            Avisar();
            if (Colocadas >= Total)
            {
                Completar();
            }
        }

        private void Soltar()
        {
            foreach (CargoUnit c in _sueltas)
            {
                if (c != null)
                {
                    c.EstadoCambiado -= OnEstado;
                }
            }
            if (Estado != EstadoActividad.Completada)
            {
                _sueltas.Clear();
            }
        }

        private void OnDestroy()
        {
            foreach (CargoUnit c in _sueltas)
            {
                if (c != null)
                {
                    c.EstadoCambiado -= OnEstado;
                }
            }
        }
    }
}

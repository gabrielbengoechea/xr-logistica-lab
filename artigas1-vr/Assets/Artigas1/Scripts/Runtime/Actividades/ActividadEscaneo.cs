using System.Collections.Generic;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Control de inventario con el escáner: leer etiquetas de cargas que están en el manifiesto.
    /// Escucha <see cref="InventoryService.Lectura"/>; una lectura repetida o fuera del manifiesto resta puntos.
    /// </summary>
    [AddComponentMenu("Artigas-1/Actividad: escaneo de inventario")]
    public sealed class ActividadEscaneo : ActividadBase
    {
        [Min(1)] [SerializeField] private int objetivo = 8;

        private readonly HashSet<string> _leidas = new HashSet<string>();
        private InventoryService _inventario;
        private int _errores;

        private void Reset()
        {
            TextosPorDefecto();
        }

        /// <summary>Carga el título, la introducción y las instrucciones de fábrica.</summary>
        public void TextosPorDefecto()
        {
            titulo = "Control de inventario";
            introduccion = "Cada carga de la estación tiene un código. El inventario se controla escaneando las etiquetas y comparándolas con el manifiesto del turno.";
            instrucciones = "Tomá el escáner, apuntá a la etiqueta de una bolsa en el rack (de frente, a menos de 1,5 m) y apretá el gatillo. Leé etiquetas distintas: repetir una lectura cuenta como error.";
        }

        public override float Progreso => _leidas.Count / (float)objetivo;

        public override string DetalleProgreso => $"{_leidas.Count}/{objetivo} etiquetas leídas · {_errores} errores";

        private void Awake()
        {
            _inventario = FindAnyObjectByType<InventoryService>();
        }

        protected override void AlComenzar()
        {
            _leidas.Clear();
            _errores = 0;
            if (_inventario == null)
            {
                Debug.LogWarning("[Artigas1] No hay InventoryService en la escena: la actividad de escaneo no puede avanzar.", this);
                return;
            }
            _inventario.Lectura -= OnLectura;
            _inventario.Lectura += OnLectura;
        }

        protected override void AlCompletar()
        {
            Puntaje += Mathf.Max(0, 300 - Mathf.RoundToInt(Segundos * 2f));
            if (_inventario != null)
            {
                _inventario.Lectura -= OnLectura;
            }
        }

        private void OnLectura(CargoUnit carga, ResultadoLectura resultado, string fuente)
        {
            if (Estado != EstadoActividad.EnCurso)
            {
                return;
            }
            if (resultado == ResultadoLectura.EnManifiesto && _leidas.Add(carga.Codigo))
            {
                Puntaje += 100;
            }
            else
            {
                _errores++;
                Puntaje = Mathf.Max(0, Puntaje - 25);
            }
            Avisar();
            if (_leidas.Count >= objetivo)
            {
                Completar();
            }
        }

        private void OnDestroy()
        {
            if (_inventario != null)
            {
                _inventario.Lectura -= OnLectura;
            }
        }
    }
}

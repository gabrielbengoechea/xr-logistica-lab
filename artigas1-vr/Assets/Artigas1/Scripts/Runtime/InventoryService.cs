using System;
using System.Collections.Generic;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Inventario del turno: arma el manifiesto con las cargas de la escena marcadas «en manifiesto» y registra
    /// las lecturas del escáner y del portal RFID. Es la fuente de verdad que leen las pantallas.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Inventario del turno")]
    public sealed class InventoryService : MonoBehaviour
    {
        [Tooltip("Códigos que el manifiesto lista pero no vienen en la escena (faltantes plantados).")]
        [SerializeField] private List<string> faltantesPlantados = new List<string>();
        [SerializeField] private bool registrarEnConsola = true;

        private readonly Manifiesto _manifiesto = new Manifiesto();

        public Manifiesto Manifiesto => _manifiesto;

        /// <summary>Se leyó una carga: (carga, resultado, fuente "escaner" o "rfid").</summary>
        public event Action<CargoUnit, ResultadoLectura, string> Lectura;

        private void Start()
        {
            foreach (CargoUnit c in FindObjectsByType<CargoUnit>(FindObjectsSortMode.None))
            {
                if (c.EnManifiesto)
                {
                    _manifiesto.Esperar(c.Datos);
                }
            }
            foreach (string codigo in faltantesPlantados)
            {
                _manifiesto.Esperar(new CargoSpec { codigo = codigo });
            }
            if (registrarEnConsola)
            {
                Debug.Log($"[Artigas1] Manifiesto del turno: {_manifiesto.Esperadas} cargas esperadas.", this);
            }
        }

        public ResultadoLectura Leer(CargoUnit carga, string fuente)
        {
            ResultadoLectura r = _manifiesto.Leer(carga.Datos);
            if (r == ResultadoLectura.EnManifiesto)
            {
                carga.CambiarEstado(EstadoCarga.Recibida);
            }
            if (registrarEnConsola)
            {
                Debug.Log($"[Artigas1] {fuente}: {carga.Codigo} → {r} ({_manifiesto.Leidas}/{_manifiesto.Esperadas})", carga);
            }
            Lectura?.Invoke(carga, r, fuente);
            return r;
        }
    }
}

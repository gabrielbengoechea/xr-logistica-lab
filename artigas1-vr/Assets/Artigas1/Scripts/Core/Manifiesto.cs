using System;
using System.Collections.Generic;

namespace Artigas1
{
    /// <summary>Resultado de leer una carga (escáner de mano o portal RFID).</summary>
    public enum ResultadoLectura
    {
        EnManifiesto,
        Repetida,
        NoEstaEnManifiesto,
        EtiquetaIlegible,
    }

    /// <summary>Tipos de discrepancia que se separan en la red de cuarentena.</summary>
    public enum Discrepancia
    {
        Faltante,
        Sobrante,
        Danada,
        Ilegible,
    }

    /// <summary>
    /// Manifiesto de un turno: qué carga se espera, qué se leyó y qué discrepancias hay. Sin Unity.
    /// </summary>
    public sealed class Manifiesto
    {
        private readonly Dictionary<string, CargoSpec> _esperadas = new Dictionary<string, CargoSpec>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _leidas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _sobrantes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly HashSet<string> _danadas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private int _ilegibles;

        public int Esperadas => _esperadas.Count;

        public int Leidas => _leidas.Count;

        public void Esperar(CargoSpec carga)
        {
            if (carga != null && !string.IsNullOrEmpty(carga.codigo))
            {
                _esperadas[carga.codigo] = carga;
            }
        }

        public bool Espera(string codigo) => !string.IsNullOrEmpty(codigo) && _esperadas.ContainsKey(codigo);

        public bool FueLeida(string codigo) => !string.IsNullOrEmpty(codigo) && _leidas.Contains(codigo);

        /// <summary>Registra una lectura. Una carga dañada se cuenta como recibida y además como discrepancia.</summary>
        public ResultadoLectura Leer(CargoSpec carga)
        {
            if (carga == null)
            {
                throw new ArgumentNullException(nameof(carga));
            }
            if (!carga.etiquetaLegible)
            {
                _ilegibles++;
                return ResultadoLectura.EtiquetaIlegible;
            }
            if (_leidas.Contains(carga.codigo) || _sobrantes.Contains(carga.codigo))
            {
                return ResultadoLectura.Repetida;
            }
            if (!_esperadas.ContainsKey(carga.codigo))
            {
                _sobrantes.Add(carga.codigo);
                return ResultadoLectura.NoEstaEnManifiesto;
            }
            _leidas.Add(carga.codigo);
            if (carga.danada)
            {
                _danadas.Add(carga.codigo);
            }
            return ResultadoLectura.EnManifiesto;
        }

        /// <summary>Discrepancias actuales. Los faltantes son las esperadas sin leer.</summary>
        public List<(Discrepancia tipo, string codigo)> Discrepancias()
        {
            var lista = new List<(Discrepancia, string)>();
            foreach (string c in _esperadas.Keys)
            {
                if (!_leidas.Contains(c))
                {
                    lista.Add((Discrepancia.Faltante, c));
                }
            }
            foreach (string c in _sobrantes)
            {
                lista.Add((Discrepancia.Sobrante, c));
            }
            foreach (string c in _danadas)
            {
                lista.Add((Discrepancia.Danada, c));
            }
            for (int i = 0; i < _ilegibles; i++)
            {
                lista.Add((Discrepancia.Ilegible, "sin etiqueta"));
            }
            lista.Sort((a, b) => a.Item1 != b.Item1 ? a.Item1.CompareTo(b.Item1) : string.CompareOrdinal(a.Item2, b.Item2));
            return lista;
        }
    }
}

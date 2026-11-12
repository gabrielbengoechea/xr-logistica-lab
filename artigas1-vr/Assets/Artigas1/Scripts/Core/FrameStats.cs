namespace Artigas1
{
    /// <summary>
    /// Estadísticas de tiempo por cuadro de una ventana (p. ej. 10 s). Sin Unity: se prueba fuera del editor.
    /// Presupuesto del Quest 2 a 72 Hz: 13,8 ms por cuadro.
    /// </summary>
    public sealed class FrameStats
    {
        public const float PresupuestoQuest2Ms = 13.8f;

        private readonly float _presupuestoMs;
        private int _cuadros;
        private int _fueraDePresupuesto;
        private double _sumaMs;
        private float _peorMs;

        public FrameStats(float presupuestoMs = PresupuestoQuest2Ms)
        {
            _presupuestoMs = presupuestoMs;
        }

        public int Cuadros => _cuadros;

        public float PeorMs => _peorMs;

        public float PromedioMs => _cuadros > 0 ? (float)(_sumaMs / _cuadros) : 0f;

        public float FpsPromedio => PromedioMs > 0f ? 1000f / PromedioMs : 0f;

        /// <summary>Fracción de cuadros que se pasaron del presupuesto (0 a 1).</summary>
        public float FraccionFuera => _cuadros > 0 ? (float)_fueraDePresupuesto / _cuadros : 0f;

        public void Agregar(float ms)
        {
            if (ms <= 0f)
            {
                return;
            }
            _cuadros++;
            _sumaMs += ms;
            if (ms > _peorMs)
            {
                _peorMs = ms;
            }
            if (ms > _presupuestoMs)
            {
                _fueraDePresupuesto++;
            }
        }

        public void Reiniciar()
        {
            _cuadros = 0;
            _fueraDePresupuesto = 0;
            _sumaMs = 0;
            _peorMs = 0f;
        }

        public string Resumen()
        {
            return string.Format(System.Globalization.CultureInfo.InvariantCulture,
                "{0:0.0} fps promedio · {1:0.0} ms promedio · peor {2:0.0} ms · {3:0.0} % fuera de {4:0.0} ms ({5} cuadros)",
                FpsPromedio, PromedioMs, PeorMs, FraccionFuera * 100f, _presupuestoMs, _cuadros);
        }
    }
}

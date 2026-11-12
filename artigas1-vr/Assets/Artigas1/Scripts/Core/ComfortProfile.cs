using System;

namespace Artigas1
{
    /// <summary>Modo de confort del jugador (sección 1.1 del plan Beta).</summary>
    public enum ModoConfort
    {
        Confort,
        Realista,
    }

    /// <summary>
    /// Parámetros de la locomoción en gravedad cero. Los valores por defecto son los iniciales del plan;
    /// se calibran en las pruebas de la fase 1.
    /// </summary>
    [Serializable]
    public sealed class ComfortProfile
    {
        /// <summary>Velocidad máxima al soltar la baranda (m/s).</summary>
        public float velocidadMaxima;

        /// <summary>Amortiguación lineal mientras se flota (1/s). 0 = inercia pura.</summary>
        public float amortiguacion;

        /// <summary>Cuadros de física promediados para calcular la velocidad al soltar.</summary>
        public int cuadrosAlSoltar;

        /// <summary>Por debajo de esta velocidad (m/s) el cuerpo se detiene del todo.</summary>
        public float velocidadMinima;

        /// <summary>Fracción de la velocidad que conserva al chocar una pared (0 = frena sin rebote).</summary>
        public float rebote;

        /// <summary>Viñeta dinámica activa.</summary>
        public bool vineta;

        /// <summary>Aceleración (m/s²) a la que la viñeta llega a su máximo.</summary>
        public float aceleracionVinetaMax;

        /// <summary>Apertura mínima de la viñeta (0 = cerrada, 1 = sin viñeta).</summary>
        public float aperturaMinima;

        public static ComfortProfile For(ModoConfort modo)
        {
            switch (modo)
            {
                case ModoConfort.Realista:
                    return new ComfortProfile
                    {
                        velocidadMaxima = 2.0f,
                        amortiguacion = 0.05f,
                        cuadrosAlSoltar = 3,
                        velocidadMinima = 0.01f,
                        rebote = 0.2f,
                        vineta = false,
                        aceleracionVinetaMax = 6f,
                        aperturaMinima = 0.75f,
                    };
                default:
                    return new ComfortProfile
                    {
                        velocidadMaxima = 1.2f,
                        amortiguacion = 0.6f,
                        cuadrosAlSoltar = 5,
                        velocidadMinima = 0.02f,
                        rebote = 0f,
                        vineta = true,
                        aceleracionVinetaMax = 3f,
                        aperturaMinima = 0.55f,
                    };
            }
        }
    }
}

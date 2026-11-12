using System;

namespace Artigas1
{
    /// <summary>Categoría de la carga (reglas de compatibilidad del minijuego B).</summary>
    [Flags]
    public enum CategoriaCarga
    {
        Ninguna = 0,
        Alimentos = 1 << 0,
        Repuestos = 1 << 1,
        Medico = 1 << 2,
        Quimicos = 1 << 3,
        Higiene = 1 << 4,
        Experimento = 1 << 5,
        Todas = Alimentos | Repuestos | Medico | Quimicos | Higiene | Experimento,
    }

    /// <summary>Tamaño de la unidad de carga, de menor a mayor.</summary>
    public enum TallaCarga
    {
        Btc1 = 1,
        Btc2 = 2,
        Rigido = 3,
    }

    /// <summary>Estados de una unidad de carga (sección 1.2 del plan).</summary>
    public enum EstadoCarga
    {
        EnManifiesto,
        Recibida,
        EnTransito,
        Apoyada,
        Asegurada,
        Reservada,
        Retirada,
        Consumida,
        Suelta,
    }

    /// <summary>Datos de una unidad de carga, sin Unity.</summary>
    [Serializable]
    public sealed class CargoSpec
    {
        public string codigo = "BTC1-0000";
        public CategoriaCarga categoria = CategoriaCarga.Alimentos;
        public TallaCarga talla = TallaCarga.Btc1;
        public float masaKg = 6f;
        public bool danada;
        public bool etiquetaLegible = true;
    }

    /// <summary>Qué acepta un hueco de rack.</summary>
    [Serializable]
    public sealed class SlotSpec
    {
        public string codigo = "RIV-E1-A1";
        public CategoriaCarga categorias = CategoriaCarga.Todas;
        public TallaCarga tallaMaxima = TallaCarga.Btc2;
        public float masaMaximaKg = 40f;
    }

    /// <summary>Resultado de validar una carga contra un hueco.</summary>
    public readonly struct SlotCheck
    {
        public SlotCheck(bool ok, string motivo)
        {
            Ok = ok;
            Motivo = motivo;
        }

        public bool Ok { get; }

        /// <summary>Texto para el panel del rack (vacío si está bien).</summary>
        public string Motivo { get; }
    }

    public static class SlotRules
    {
        /// <summary>Valida la carga contra el hueco. Devuelve el primer motivo de rechazo, en el orden en que se ven.</summary>
        public static SlotCheck Check(CargoSpec carga, SlotSpec hueco, bool ocupado)
        {
            if (carga == null || hueco == null)
            {
                return new SlotCheck(false, "Sin datos de la carga o del hueco");
            }
            if (ocupado)
            {
                return new SlotCheck(false, $"El hueco {hueco.codigo} ya está ocupado");
            }
            if (carga.talla > hueco.tallaMaxima)
            {
                return new SlotCheck(false, $"No entra: {Nombre(carga.talla)} en un hueco para {Nombre(hueco.tallaMaxima)}");
            }
            if (carga.masaKg > hueco.masaMaximaKg)
            {
                return new SlotCheck(false, $"Demasiado pesada: {carga.masaKg:0.#} kg (máximo {hueco.masaMaximaKg:0.#} kg)");
            }
            if ((hueco.categorias & carga.categoria) == 0)
            {
                return new SlotCheck(false, $"{Nombre(carga.categoria)} no va en este hueco");
            }
            return new SlotCheck(true, string.Empty);
        }

        public static string Nombre(TallaCarga talla)
        {
            switch (talla)
            {
                case TallaCarga.Btc1:
                    return "bolsa chica";
                case TallaCarga.Btc2:
                    return "bolsa grande";
                default:
                    return "contenedor rígido";
            }
        }

        public static string Nombre(CategoriaCarga categoria)
        {
            switch (categoria)
            {
                case CategoriaCarga.Alimentos:
                    return "Alimentos";
                case CategoriaCarga.Repuestos:
                    return "Repuestos";
                case CategoriaCarga.Medico:
                    return "Material médico";
                case CategoriaCarga.Quimicos:
                    return "Químicos";
                case CategoriaCarga.Higiene:
                    return "Higiene";
                case CategoriaCarga.Experimento:
                    return "Experimento";
                default:
                    return categoria.ToString();
            }
        }

        /// <summary>Transiciones permitidas de la máquina de estados de la carga.</summary>
        public static bool CanTransition(EstadoCarga desde, EstadoCarga hacia)
        {
            if (desde == hacia)
            {
                return false;
            }
            if (hacia == EstadoCarga.Suelta)
            {
                return desde != EstadoCarga.Consumida;
            }
            switch (desde)
            {
                case EstadoCarga.EnManifiesto:
                    return hacia == EstadoCarga.Recibida || hacia == EstadoCarga.EnTransito;
                case EstadoCarga.Recibida:
                    return hacia == EstadoCarga.EnTransito;
                case EstadoCarga.EnTransito:
                    return hacia == EstadoCarga.Apoyada || hacia == EstadoCarga.Recibida || hacia == EstadoCarga.Retirada;
                case EstadoCarga.Apoyada:
                    return hacia == EstadoCarga.Asegurada || hacia == EstadoCarga.EnTransito;
                case EstadoCarga.Asegurada:
                    return hacia == EstadoCarga.Reservada || hacia == EstadoCarga.EnTransito || hacia == EstadoCarga.Apoyada;
                case EstadoCarga.Reservada:
                    return hacia == EstadoCarga.EnTransito || hacia == EstadoCarga.Asegurada;
                case EstadoCarga.Retirada:
                    return hacia == EstadoCarga.Consumida || hacia == EstadoCarga.EnTransito;
                case EstadoCarga.Suelta:
                    return hacia == EstadoCarga.EnTransito;
                default:
                    return false;
            }
        }
    }
}

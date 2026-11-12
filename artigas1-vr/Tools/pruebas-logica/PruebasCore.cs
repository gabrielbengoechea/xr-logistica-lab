using System.Collections.Generic;
using UnityEngine;

namespace Artigas1.Pruebas
{
    public static class PruebasLocomocion
    {
        [Prueba]
        private static void VelocidadAlSoltarPromediaYLimita()
        {
            var b = new VelocityBuffer(8);
            b.Push(new Vector3(9f, 0f, 0f));      // vieja, queda afuera del promedio de 3
            b.Push(new Vector3(0.6f, 0f, 0f));
            b.Push(new Vector3(0.9f, 0f, 0f));
            b.Push(new Vector3(1.2f, 0f, 0f));
            Vector3 v = ZeroGMath.ReleaseVelocity(b, 3, 5f);
            Afirmar.Cerca(0.9, v.x, 1e-5, "promedio de las 3 más nuevas");
            Vector3 lim = ZeroGMath.ReleaseVelocity(b, 4, 1.2f);
            Afirmar.Cerca(1.2, lim.magnitude, 1e-5, "limitada a la velocidad máxima");
        }

        [Prueba]
        private static void BuferCircularDaVueltas()
        {
            var b = new VelocityBuffer(2);
            b.Push(Vector3.one);
            b.Push(Vector3.one * 2f);
            b.Push(Vector3.one * 3f);
            Afirmar.Igual(2, b.Count);
            Afirmar.Cerca(3, b.FromNewest(0).x);
            Afirmar.Cerca(2, b.FromNewest(1).x);
        }

        [Prueba]
        private static void AmortiguacionExponencial()
        {
            Vector3 v = new Vector3(1f, 0f, 0f);
            Afirmar.Cerca(1.0, ZeroGMath.Damp(v, 0f, 1f).x, 1e-6, "sin amortiguación se conserva");
            Afirmar.Cerca(System.Math.Exp(-0.6), ZeroGMath.Damp(v, 0.6f, 1f).x, 1e-5);
            Afirmar.Igual(Vector3.zero, ZeroGMath.Drift(new Vector3(0.01f, 0f, 0f), 0.6f, 0.02f, 0.014f), "frena por debajo del mínimo");
        }

        [Prueba]
        private static void ChoqueSinYConRebote()
        {
            Vector3 v = new Vector3(1f, 0f, -2f);
            Vector3 n = new Vector3(0f, 0f, 1f);
            Vector3 frena = ZeroGMath.Collide(v, n, 0f);
            Afirmar.Cerca(1.0, frena.x);
            Afirmar.Cerca(0.0, frena.z);
            Vector3 rebota = ZeroGMath.Collide(v, n, 0.2f);
            Afirmar.Cerca(0.4, rebota.z, 1e-5, "devuelve el 20 % de la componente normal");
            Vector3 aleja = ZeroGMath.Collide(new Vector3(0f, 0f, 1f), n, 0f);
            Afirmar.Cerca(1.0, aleja.z, 1e-6, "si se aleja de la pared no cambia");
        }

        [Prueba]
        private static void VinetaYRespuestaDeLaMano()
        {
            Afirmar.Cerca(1.0, ZeroGMath.VignetteAperture(0f, 3f, 0.55f));
            Afirmar.Cerca(0.775, ZeroGMath.VignetteAperture(1.5f, 3f, 0.55f), 1e-5);
            Afirmar.Cerca(0.55, ZeroGMath.VignetteAperture(10f, 3f, 0.55f), 1e-5);
            Afirmar.Cerca(1.0, ZeroGMath.HandResponse(4f));
            Afirmar.Cerca(0.6, ZeroGMath.HandResponse(42.5f), 1e-5);
            Afirmar.Cerca(0.2, ZeroGMath.HandResponse(120f), 1e-5);
            Afirmar.Verdadero(ZeroGMath.NeedsTwoHands(31f));
            Afirmar.Falso(ZeroGMath.NeedsTwoHands(30f));
        }

        [Prueba]
        private static void PerfilesDeConfort()
        {
            ComfortProfile c = ComfortProfile.For(ModoConfort.Confort);
            ComfortProfile r = ComfortProfile.For(ModoConfort.Realista);
            Afirmar.Cerca(1.2, c.velocidadMaxima);
            Afirmar.Verdadero(c.vineta && !r.vineta);
            Afirmar.Verdadero(r.amortiguacion < c.amortiguacion, "el modo realista conserva más inercia");
        }
    }

    public static class PruebasCarga
    {
        private static CargoSpec Bolsa(string codigo, CategoriaCarga cat = CategoriaCarga.Alimentos, TallaCarga talla = TallaCarga.Btc1, float kg = 6f)
            => new CargoSpec { codigo = codigo, categoria = cat, talla = talla, masaKg = kg };

        [Prueba]
        private static void ReglasDelHueco()
        {
            var hueco = new SlotSpec { codigo = "RIV-E1-A1", categorias = CategoriaCarga.Alimentos | CategoriaCarga.Higiene, tallaMaxima = TallaCarga.Btc2, masaMaximaKg = 30f };
            Afirmar.Verdadero(SlotRules.Check(Bolsa("A"), hueco, false).Ok);
            Afirmar.Contiene(SlotRules.Check(Bolsa("A"), hueco, true).Motivo, "ocupado");
            Afirmar.Contiene(SlotRules.Check(Bolsa("A", talla: TallaCarga.Rigido), hueco, false).Motivo, "No entra");
            Afirmar.Contiene(SlotRules.Check(Bolsa("A", kg: 35f), hueco, false).Motivo, "pesada");
            Afirmar.Contiene(SlotRules.Check(Bolsa("A", CategoriaCarga.Quimicos), hueco, false).Motivo, "Químicos");
        }

        [Prueba]
        private static void TransicionesDeEstado()
        {
            Afirmar.Verdadero(SlotRules.CanTransition(EstadoCarga.EnTransito, EstadoCarga.Apoyada));
            Afirmar.Verdadero(SlotRules.CanTransition(EstadoCarga.Apoyada, EstadoCarga.Asegurada));
            Afirmar.Verdadero(SlotRules.CanTransition(EstadoCarga.Asegurada, EstadoCarga.Suelta), "una carga asegurada se puede soltar (falla de correa)");
            Afirmar.Falso(SlotRules.CanTransition(EstadoCarga.EnManifiesto, EstadoCarga.Asegurada));
            Afirmar.Falso(SlotRules.CanTransition(EstadoCarga.Consumida, EstadoCarga.Suelta));
        }

        [Prueba]
        private static void ManifiestoYDiscrepancias()
        {
            var m = new Manifiesto();
            m.Esperar(Bolsa("BTC1-0001"));
            m.Esperar(Bolsa("BTC1-0002"));
            m.Esperar(Bolsa("BTC1-0003"));
            Afirmar.Igual(ResultadoLectura.EnManifiesto, m.Leer(Bolsa("BTC1-0001")));
            Afirmar.Igual(ResultadoLectura.Repetida, m.Leer(Bolsa("btc1-0001")), "el código no distingue mayúsculas");
            var danada = Bolsa("BTC1-0002");
            danada.danada = true;
            Afirmar.Igual(ResultadoLectura.EnManifiesto, m.Leer(danada));
            Afirmar.Igual(ResultadoLectura.NoEstaEnManifiesto, m.Leer(Bolsa("BTC1-0099")));
            var sin = Bolsa("BTC1-0004");
            sin.etiquetaLegible = false;
            Afirmar.Igual(ResultadoLectura.EtiquetaIlegible, m.Leer(sin));
            List<(Discrepancia tipo, string codigo)> d = m.Discrepancias();
            Afirmar.Igual(4, d.Count);
            Afirmar.Igual(Discrepancia.Faltante, d[0].tipo);
            Afirmar.Igual("BTC1-0003", d[0].codigo);
            Afirmar.Igual(Discrepancia.Sobrante, d[1].tipo);
            Afirmar.Igual(Discrepancia.Danada, d[2].tipo);
            Afirmar.Igual(Discrepancia.Ilegible, d[3].tipo);
            Afirmar.Igual(2, m.Leidas);
        }
    }

    public static class PruebasBalance
    {
        [Prueba]
        private static void CentroDeMasa()
        {
            var cargas = new List<(float, Vector3)> { (10f, new Vector3(2f, 0f, 0f)), (10f, new Vector3(-2f, 0f, 0f)) };
            Vector3 cm = StationMass.CenterOfMass(cargas, 80f, Vector3.zero);
            Afirmar.Cerca(0.0, cm.x, 1e-6, "simétrico");
            var cargas2 = new List<(float, Vector3)> { (20f, new Vector3(5f, 0f, 0f)) };
            Afirmar.Cerca(1.0, StationMass.CenterOfMass(cargas2, 80f, Vector3.zero).x, 1e-5);
        }

        [Prueba]
        private static void PuntajeDelMinijuegoB()
        {
            Afirmar.Igual(64, StationMass.ScoreB(0.27f, 0.30f, 0, 0f));
            Afirmar.Igual(52, StationMass.ScoreB(0.27f, 0.30f, 1, 4f));
            Afirmar.Igual(0, StationMass.ScoreB(1.0f, 0.30f, 3, 0f), "no baja de 0");
            Afirmar.Cerca(0.0, StationMass.PropellantCost(0.2f, 0.3f));
            Afirmar.Cerca(1.0, StationMass.PropellantCost(0.6f, 0.3f), 1e-5);
        }

        [Prueba]
        private static void EstadisticasDeCuadros()
        {
            var f = new FrameStats();
            f.Agregar(10f);
            f.Agregar(10f);
            f.Agregar(20f);
            Afirmar.Cerca(13.3333, f.PromedioMs, 1e-3);
            Afirmar.Cerca(75.0, f.FpsPromedio, 1e-2);
            Afirmar.Cerca(1.0 / 3.0, f.FraccionFuera, 1e-5);
            Afirmar.Cerca(20.0, f.PeorMs);
            Afirmar.Contiene(f.Resumen(), "fps promedio");
        }
    }
}

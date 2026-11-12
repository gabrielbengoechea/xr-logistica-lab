using NUnit.Framework;
using UnityEngine;

namespace Artigas1.Tests
{
    /// <summary>
    /// Pruebas EditMode de la lógica pura (Window → General → Test Runner). Las mismas reglas se prueban fuera de
    /// Unity con Tools/pruebas-logica (dotnet run).
    /// </summary>
    public sealed class CoreTests
    {
        [Test]
        public void SoltarPromediaYLimita()
        {
            var b = new VelocityBuffer(8);
            b.Push(new Vector3(0.6f, 0f, 0f));
            b.Push(new Vector3(0.9f, 0f, 0f));
            b.Push(new Vector3(1.2f, 0f, 0f));
            Assert.AreEqual(0.9f, ZeroGMath.ReleaseVelocity(b, 3, 5f).x, 1e-5f);
            Assert.AreEqual(0.5f, ZeroGMath.ReleaseVelocity(b, 3, 0.5f).magnitude, 1e-5f);
        }

        [Test]
        public void ChoqueFrenaSinRebote()
        {
            Vector3 v = ZeroGMath.Collide(new Vector3(1f, 0f, -2f), Vector3.forward, 0f);
            Assert.AreEqual(0f, v.z, 1e-6f);
            Assert.AreEqual(1f, v.x, 1e-6f);
        }

        [Test]
        public void HuecoRechazaQuimicosEnAlimentos()
        {
            var hueco = new SlotSpec { categorias = CategoriaCarga.Alimentos };
            var carga = new CargoSpec { categoria = CategoriaCarga.Quimicos };
            Assert.IsFalse(SlotRules.Check(carga, hueco, false).Ok);
        }

        [Test]
        public void PuntajeB()
        {
            Assert.AreEqual(64, StationMass.ScoreB(0.27f, 0.30f, 0, 0f));
        }
    }
}

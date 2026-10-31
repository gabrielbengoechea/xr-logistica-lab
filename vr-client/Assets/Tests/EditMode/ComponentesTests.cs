using NUnit.Framework;
using UnityEngine;

namespace XRLab.Tests
{
    /// <summary>
    /// Pruebas de los componentes dentro del editor (Window → General → Test Runner → EditMode). La lógica pura se
    /// prueba también fuera de Unity en Tools/pruebas-logica.
    /// </summary>
    public sealed class ComponentesTests
    {
        private GameObject _raiz;

        [SetUp]
        public void Crear()
        {
            _raiz = new GameObject("Conjunto");
        }

        [TearDown]
        public void Borrar()
        {
            Object.DestroyImmediate(_raiz);
        }

        private Transform Hijo(string nombre, Transform padre, Vector3 local)
        {
            var go = new GameObject(nombre);
            go.transform.SetParent(padre, false);
            go.transform.localPosition = local;
            return go.transform;
        }

        [Test]
        public void LaVistaExplotadaMueveCadaPiezaYVuelve()
        {
            Transform a = Hijo("Part_Tapa", _raiz.transform, new Vector3(0f, 0.5f, 0f));
            Transform b = Hijo("Part_Base", _raiz.transform, Vector3.zero);
            var mgr = _raiz.AddComponent<ExplodedViewManager>();
            Assert.IsTrue(mgr.SetOffset(a, new Vector3(0f, 1f, 0f)));
            Assert.IsTrue(mgr.SetOffset(b, new Vector3(0f, -0.5f, 0f)));

            mgr.SetImmediate(true);
            Assert.AreEqual(1.5f, a.localPosition.y, 1e-4f);
            Assert.AreEqual(-0.5f, b.localPosition.y, 1e-4f);
            Assert.IsTrue(mgr.IsExploded);

            mgr.SetImmediate(false);
            Assert.AreEqual(0.5f, a.localPosition.y, 1e-4f);
            Assert.AreEqual(0f, b.localPosition.y, 1e-4f);
        }

        [Test]
        public void ElDesplazamientoDeUnHijoSeSumaAlDeSuPadre()
        {
            Transform carro = Hijo("Part_Carro", _raiz.transform, Vector3.zero);
            Transform horquillas = Hijo("Part_Horquillas", carro, new Vector3(0f, 0f, 0.4f));
            var mgr = _raiz.AddComponent<ExplodedViewManager>();
            mgr.SetOffset(carro, new Vector3(1f, 0f, 0f));
            mgr.SetOffset(horquillas, new Vector3(0f, 0f, 0.5f));
            mgr.SetImmediate(true);
            Assert.AreEqual(1f, horquillas.position.x, 1e-4f, "las horquillas viajan con el carro");
            Assert.AreEqual(0.9f, horquillas.position.z, 1e-4f, "y además se separan");
        }

        [Test]
        public void ElManifestCargaLosDesplazamientosEnEjesDeUnity()
        {
            Transform p = Hijo("Part_Bateria", _raiz.transform, Vector3.zero);
            var mgr = _raiz.AddComponent<ExplodedViewManager>();
            var asset = new ModelAssetDto
            {
                id = "forklift",
                parts = new[] { new ModelPartDto { node = "Part_Bateria", explode_offset = new[] { 0.5f, 1f, 0f } } },
            };
            Assert.AreEqual(1, mgr.ApplyManifest(asset));
            mgr.SetImmediate(true);
            Assert.AreEqual(-0.5f, p.localPosition.x, 1e-4f, "x cambia de signo de glTF a Unity");
            Assert.AreEqual(1f, p.localPosition.y, 1e-4f);
        }

        [Test]
        public void LaZonaEncajaLaPiezaEnSuPuntoYLaSuelta()
        {
            var zonaGo = new GameObject("Snap_Ranura_OBC");
            zonaGo.transform.SetParent(_raiz.transform, false);
            zonaGo.transform.localPosition = new Vector3(0f, 0.07f, 0f);
            zonaGo.AddComponent<BoxCollider>().isTrigger = true;
            var zona = zonaGo.AddComponent<SnapZone>();
            zona.Configure("placa_obc", 0.004f, 0.05f);

            var piezaGo = new GameObject("Part_Placa_OBC");
            piezaGo.transform.SetParent(_raiz.transform, false);
            piezaGo.transform.localPosition = new Vector3(0.3f, 0f, 0f);
            var pieza = piezaGo.AddComponent<SnappablePart>();
            Assert.AreEqual("placa_obc", pieza.PartType);

            zona.ForceSnap(pieza);
            Assert.AreSame(pieza, zona.Occupant);
            Assert.AreSame(zona, pieza.CurrentZone);
            Assert.AreEqual(0.07f, pieza.transform.position.y, 1e-4f);
            Assert.IsTrue(piezaGo.GetComponent<Rigidbody>().isKinematic);

            zona.Unsnap(pieza);
            Assert.IsNull(zona.Occupant);
            Assert.IsFalse(pieza.IsSnapped);
        }

        [Test]
        public void LaZonaRechazaLaPiezaEquivocadaConElMotivo()
        {
            var zonaGo = new GameObject("Snap_Ranura_EPS");
            zonaGo.transform.SetParent(_raiz.transform, false);
            zonaGo.AddComponent<BoxCollider>().isTrigger = true;
            var zona = zonaGo.AddComponent<SnapZone>();
            zona.Configure("placa_eps", 0.004f, 0.05f);
            var pieza = new GameObject("Part_Placa_OBC").AddComponent<SnappablePart>();
            pieza.transform.SetParent(_raiz.transform, false);

            SnapEvaluation e = zona.Evaluate(pieza);
            Assert.AreEqual(SnapRejection.WrongType, e.Rejection);
            Assert.AreEqual("Esa pieza no va en este lugar", SnapMath.Explain(e.Rejection));
        }
    }
}

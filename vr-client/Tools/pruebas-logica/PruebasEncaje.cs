using UnityEngine;

namespace XRLab.Pruebas
{
    public static class PruebasEncaje
    {
        private static readonly Quaternion Id = Quaternion.identity;

        private static SnapEvaluation Evaluar(string tipo, Vector3 pos, Quaternion rot, string acepta = "placa_obc",
            SnapSymmetry sim = SnapSymmetry.None, bool ocupado = false)
        {
            return SnapMath.Evaluate(tipo, pos, rot, acepta, Vector3.zero, Id, 0.05f, 20f, 0.075f, sim, ocupado);
        }

        [Prueba]
        public static void LaMatematicaDeCuaternionesCoincideConUnity()
        {
            Afirmar.Cerca(90, Quaternion.Angle(Id, Quaternion.Euler(0, 90, 0)), 1e-3);
            Afirmar.Cerca(180, Quaternion.Angle(Id, Quaternion.Euler(0, 180, 0)), 1e-3);
            Afirmar.Cerca(0, Quaternion.Angle(Quaternion.Euler(0, 360, 0), Id), 1e-3, "una vuelta entera es lo mismo");
            Vector3 v = Quaternion.Euler(0, 90, 0) * new Vector3(0, 0, 1);
            Afirmar.Cerca(1, v.x, 1e-5, "girar +90° en Y lleva +Z a +X (como en Unity)");
            Afirmar.Cerca(45, Quaternion.Angle(Id, Quaternion.Slerp(Id, Quaternion.Euler(0, 90, 0), 0.5f)), 1e-3);
        }

        [Prueba]
        public static void AceptaLaPiezaCorrectaCercaYAlineada()
        {
            SnapEvaluation e = Evaluar("placa_obc", new Vector3(0.01f, 0.02f, 0), Quaternion.Euler(0, 10, 0));
            Afirmar.Verdadero(e.Accepted, e.Rejection.ToString());
            Afirmar.Verdadero(e.InMagnetRange);
            Afirmar.Igual("Encajada", SnapMath.Explain(e.Rejection));
        }

        [Prueba]
        public static void LosRechazosVanEnElOrdenQueSeLeExplicaAlAlumno()
        {
            Vector3 lejos = new Vector3(0.3f, 0, 0);
            Quaternion girada = Quaternion.Euler(0, 90, 0);
            Afirmar.Igual(SnapRejection.WrongType, Evaluar("placa_eps", lejos, girada, ocupado: true).Rejection, "primero el tipo");
            Afirmar.Igual(SnapRejection.Occupied, Evaluar("placa_obc", lejos, girada, ocupado: true).Rejection, "después ocupado");
            Afirmar.Igual(SnapRejection.TooFar, Evaluar("placa_obc", lejos, girada).Rejection, "después la distancia");
            Afirmar.Igual(SnapRejection.BadOrientation, Evaluar("placa_obc", Vector3.zero, girada).Rejection, "por último el giro");
        }

        [Prueba]
        public static void ElRadioDelImanEsIndependienteDeLaTolerancia()
        {
            SnapEvaluation e = Evaluar("placa_obc", new Vector3(0.06f, 0, 0), Id);
            Afirmar.Igual(SnapRejection.TooFar, e.Rejection);
            Afirmar.Verdadero(e.InMagnetRange, "a 6 cm sigue dentro del radio de 7,5 cm (cuenta como intento fallido)");
            Afirmar.Falso(Evaluar("placa_obc", new Vector3(0.2f, 0, 0), Id).InMagnetRange);
        }

        [Prueba]
        public static void LaSimetriaAceptaLaPiezaDadaVuelta()
        {
            Quaternion vuelta = Quaternion.Euler(0, 178, 0);
            Afirmar.Igual(SnapRejection.BadOrientation, Evaluar("placa_obc", Vector3.zero, vuelta).Rejection);
            Afirmar.Verdadero(Evaluar("placa_obc", Vector3.zero, vuelta, sim: SnapSymmetry.Yaw180).Accepted);
            Afirmar.Verdadero(Evaluar("placa_obc", Vector3.zero, Quaternion.Euler(0, 92, 0), sim: SnapSymmetry.Yaw90).Accepted);
            Afirmar.Falso(Evaluar("placa_obc", Vector3.zero, Quaternion.Euler(0, 92, 0), sim: SnapSymmetry.Yaw180).Accepted);
        }

        [Prueba]
        public static void AlEncajarGiraLoMenosPosible()
        {
            Quaternion r = SnapMath.ClosestSymmetricRotation(Quaternion.Euler(0, 170, 0), Id, SnapSymmetry.Yaw180);
            Afirmar.Cerca(180, Quaternion.Angle(Id, r), 1e-3, "elige la orientación de 180°");
            Quaternion s = SnapMath.ClosestSymmetricRotation(Quaternion.Euler(0, 170, 0), Id, SnapSymmetry.None);
            Afirmar.Cerca(0, Quaternion.Angle(Id, s), 1e-3);
        }

        [Prueba]
        public static void LosTiposAceptanListasYComodin()
        {
            Afirmar.Verdadero(SnapMath.TypeMatches("PLACA_EPS", "placa_obc, placa_eps"));
            Afirmar.Verdadero(SnapMath.TypeMatches("lo_que_sea", "*"));
            Afirmar.Verdadero(SnapMath.TypeMatches("x", ""));
            Afirmar.Falso(SnapMath.TypeMatches("", "pallet"));
            Afirmar.Falso(SnapMath.TypeMatches("pallet_chico", "pallet"));
        }

        [Prueba]
        public static void ElImanEsFirmeCercaYSuaveLejos()
        {
            Afirmar.Igual(1f, SnapMath.MagnetStrength(0f, 0.1f));
            Afirmar.Cerca(0.25, SnapMath.MagnetStrength(0.05f, 0.1f), 1e-6);
            Afirmar.Igual(0f, SnapMath.MagnetStrength(0.1f, 0.1f));
            Afirmar.Igual(0f, SnapMath.MagnetStrength(0.01f, 0f));
        }

        [Prueba]
        public static void ElTipoSaleDelNombreDelNodo()
        {
            Afirmar.Igual("placa_obc", ManifestMath.PartTypeFromNode("Part_Placa_OBC"));
            Afirmar.Igual("rueda", ManifestMath.PartTypeFromNode("Part_Rueda.001"));
            Afirmar.Igual("pallet", ManifestMath.PartTypeFromNode("Pallet"));
            Afirmar.Igual(string.Empty, ManifestMath.PartTypeFromNode(null));
            Vector3 u = ManifestMath.ToUnity(new[] { 1f, 2f, 3f });
            Afirmar.Igual(-1f, u.x);
            Afirmar.Igual(Vector3.zero, ManifestMath.ToUnity(new[] { 1f }));
        }

        [Prueba]
        public static void LasPropiedadesDelFbxLleganDeCualquierForma()
        {
            Afirmar.Verdadero(UserPropertyParser.TryVector3(new Vector4(1, 2, 3, 0), out Vector3 a) && a.z == 3f);
            Afirmar.Verdadero(UserPropertyParser.TryVector3("[0.0, 1.6, -0.25]", out Vector3 b) && System.Math.Abs(b.z + 0.25f) < 1e-6);
            Afirmar.Verdadero(UserPropertyParser.TryVector3(new double[] { 1, 2, 3 }, out Vector3 c) && c.y == 2f);
            Afirmar.Verdadero(UserPropertyParser.TryVector3(new Vector3(4, 5, 6), out Vector3 d) && d.x == 4f);
            Afirmar.Falso(UserPropertyParser.TryVector3("1,2", out _));
            Afirmar.Falso(UserPropertyParser.TryVector3(new[] { 1f, 2f, 3f, 4f }, out _));
            Afirmar.Falso(UserPropertyParser.TryVector3(42, out _));
            Afirmar.Verdadero(UserPropertyParser.TryFloat("0.004", out float t) && System.Math.Abs(t - 0.004f) < 1e-7);
            Afirmar.Verdadero(UserPropertyParser.TryFloat(3, out float i) && i == 3f);
            Afirmar.Igual((object)"pallet", UserPropertyParser.Find(new[] { "tolerancia_m", "encaje" }, new object[] { 0.01f, "pallet" }, "encaje"));
            Afirmar.Igual(null, UserPropertyParser.Find(new[] { "a" }, new object[] { 1 }, "b"));
        }
    }
}

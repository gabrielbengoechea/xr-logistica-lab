using System.Collections.Generic;
using XRLab.Editor;

namespace XRLab.Pruebas
{
    public static class PruebasBuild
    {
        [Prueba]
        public static void SinArgumentosUsaLosValoresPorDefecto()
        {
            BuildArguments b = BuildArguments.Parse(new[] { "Unity", "-batchmode", "-quit" });
            Afirmar.Igual(0, b.Errors.Count);
            Afirmar.Igual(BuildArguments.DefaultOutput, b.OutputPath);
            Afirmar.Igual("com.utec.xrlab", b.ApplicationId);
            Afirmar.Igual(1, b.BuildNumber);
            Afirmar.Falso(b.Development);
            Afirmar.Igual(0, b.Scenes.Count);
        }

        [Prueba]
        public static void LeeTodosLosArgumentos()
        {
            BuildArguments b = BuildArguments.Parse(new[]
            {
                "-batchmode", "-buildOutput", "out/lab", "-buildVersion", "1.4.0", "-buildNumber", "17", "-development",
                "-appId", "uy.edu.utec.lab", "-scenes", "Assets/Scenes/Lab.unity;Assets/Scenes/Menu.unity", "-aab",
            });
            Afirmar.Igual(0, b.Errors.Count, string.Join("; ", b.Errors));
            Afirmar.Igual("out/lab.aab", b.OutputPath, "la extensión sigue al formato");
            Afirmar.Igual("1.4.0", b.Version);
            Afirmar.Igual(17, b.BuildNumber);
            Afirmar.Verdadero(b.Development && b.AppBundle);
            Afirmar.Igual("uy.edu.utec.lab", b.ApplicationId);
            Afirmar.Igual(2, b.Scenes.Count);
        }

        [Prueba]
        public static void LasVariablesDeEntornoSirvenEnCiYLaLineaDeComandosGana()
        {
            var env = new Dictionary<string, string> { ["XRLAB_BUILD_VERSION"] = "2.0.0", ["XRLAB_BUILD_NUMBER"] = "99" };
            BuildArguments b = BuildArguments.Parse(new[] { "-buildNumber", "100" }, k => env.TryGetValue(k, out string v) ? v : null);
            Afirmar.Igual("2.0.0", b.Version);
            Afirmar.Igual(100, b.BuildNumber);
        }

        [Prueba]
        public static void InformaLosErrores()
        {
            BuildArguments b = BuildArguments.Parse(new[] { "-buildNumber", "cero", "-appId", "sinpuntos", "-scenes", "Lab.prefab", "-buildOutput" });
            Afirmar.Igual(4, b.Errors.Count, string.Join(" | ", b.Errors));
        }
    }
}

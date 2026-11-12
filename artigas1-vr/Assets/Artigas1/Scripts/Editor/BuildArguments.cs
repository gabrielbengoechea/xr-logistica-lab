// Copiado de xr-logistica-lab (vr-client/Assets/Scripts/Editor), adaptado a Artigas-1 (namespace, rutas e identificador).
using System;
using System.Collections.Generic;
using System.Globalization;

namespace Artigas1.Editor
{
    /// <summary>
    /// Opciones de la compilación para Quest, leídas de la línea de comandos de Unity (sin dependencias del editor,
    /// así se prueban fuera de Unity):
    /// <code>
    /// -buildOutput Builds/Quest/Artigas1.apk   ruta del APK (relativa al proyecto o absoluta)
    /// -buildVersion 1.2.0                     versión visible (bundleVersion)
    /// -buildNumber 42                         versionCode de Android (entero creciente)
    /// -development                            build de desarrollo (perfilador y depuración)
    /// -appId com.utec.artigas1                   identificador del paquete
    /// -scenes Assets/Scenes/A.unity;Assets/Scenes/B.unity   escenas (por defecto, las de Build Settings)
    /// -aab                                    Android App Bundle en lugar de APK
    /// </code>
    /// También se leen las variables de entorno ARTIGAS1_BUILD_VERSION y ARTIGAS1_BUILD_NUMBER (útiles en CI).
    /// </summary>
    public sealed class BuildArguments
    {
        public const string DefaultOutput = "Builds/Quest/Artigas1.apk";
        public const string DefaultAppId = "com.utec.artigas1";
        public const string DefaultVersion = "0.1.0";

        public string OutputPath { get; private set; } = DefaultOutput;
        public string Version { get; private set; } = DefaultVersion;
        public int BuildNumber { get; private set; } = 1;
        public bool Development { get; private set; }
        public bool AppBundle { get; private set; }
        public string ApplicationId { get; private set; } = DefaultAppId;
        public IReadOnlyList<string> Scenes { get; private set; } = Array.Empty<string>();

        /// <summary>Errores de los argumentos (vacío si están bien).</summary>
        public IReadOnlyList<string> Errors => _errors;

        private readonly List<string> _errors = new List<string>();

        public static BuildArguments Parse(IReadOnlyList<string> args, Func<string, string> env = null)
        {
            var b = new BuildArguments();
            env = env ?? (_ => null);
            string envVersion = env("ARTIGAS1_BUILD_VERSION");
            if (!string.IsNullOrWhiteSpace(envVersion))
            {
                b.Version = envVersion.Trim();
            }
            string envNumber = env("ARTIGAS1_BUILD_NUMBER");
            if (!string.IsNullOrWhiteSpace(envNumber))
            {
                b.SetNumber(envNumber);
            }
            for (int i = 0; i < (args?.Count ?? 0); i++)
            {
                string a = args[i];
                string next = i + 1 < args.Count && !args[i + 1].StartsWith("-", StringComparison.Ordinal) ? args[i + 1] : null;
                switch (a)
                {
                    case "-buildOutput":
                        if (b.Need(a, next)) { b.OutputPath = next; i++; }
                        break;
                    case "-buildVersion":
                        if (b.Need(a, next)) { b.Version = next; i++; }
                        break;
                    case "-buildNumber":
                        if (b.Need(a, next)) { b.SetNumber(next); i++; }
                        break;
                    case "-appId":
                        if (b.Need(a, next)) { b.ApplicationId = next; i++; }
                        break;
                    case "-scenes":
                        if (b.Need(a, next))
                        {
                            b.Scenes = next.Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries);
                            i++;
                        }
                        break;
                    case "-development":
                        b.Development = true;
                        break;
                    case "-aab":
                        b.AppBundle = true;
                        break;
                }
            }
            b.Validate();
            return b;
        }

        private bool Need(string flag, string value)
        {
            if (value == null)
            {
                _errors.Add($"Falta el valor de {flag}");
                return false;
            }
            return true;
        }

        private void SetNumber(string text)
        {
            if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) && n > 0)
            {
                BuildNumber = n;
            }
            else
            {
                _errors.Add($"El número de build tiene que ser un entero positivo: «{text}»");
            }
        }

        private void Validate()
        {
            string ext = AppBundle ? ".aab" : ".apk";
            if (!OutputPath.EndsWith(ext, StringComparison.OrdinalIgnoreCase))
            {
                OutputPath = System.IO.Path.ChangeExtension(OutputPath, ext);
            }
            string[] partes = ApplicationId.Split('.');
            if (partes.Length < 2 || Array.Exists(partes, p => p.Length == 0 || !char.IsLetter(p[0])))
            {
                _errors.Add($"Identificador de paquete inválido: «{ApplicationId}» (ej.: com.utec.artigas1)");
            }
            foreach (string s in Scenes)
            {
                if (!s.EndsWith(".unity", StringComparison.OrdinalIgnoreCase))
                {
                    _errors.Add($"No es una escena: «{s}»");
                }
            }
        }
    }
}

// Copiado de xr-logistica-lab (vr-client/Assets/Scripts/Editor), adaptado a Artigas-1 (namespace, rutas e identificador).
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.XR.Management;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.Management;

namespace Artigas1.Editor
{
    /// <summary>
    /// Compilación sin interfaz (batchmode) del APK para Meta Quest 3 y Quest 2:
    /// <code>
    /// Unity -batchmode -quit -projectPath artigas1-vr -executeMethod Artigas1.Editor.BuildScript.BuildQuest \
    ///       -buildOutput Builds/Quest/Artigas1.apk -buildVersion 0.2.0 -buildNumber 7 -logFile -
    /// </code>
    /// Configura Android ARM64 con IL2CPP, Vulkan (con OpenGLES3 de respaldo), ASTC, espacio de color lineal y
    /// API mínima 32. Verifica que OpenXR esté activo para Android antes de compilar. Sale con código 0 si todo
    /// anduvo y 1 si no (para CI). Los argumentos están en <see cref="BuildArguments"/>.
    /// </summary>
    public static class BuildScript
    {
        private const string MenuPath = "Artigas-1/Compilar APK para Quest";

        /// <summary>Punto de entrada de -executeMethod.</summary>
        public static void BuildQuest()
        {
            int code;
            try
            {
                code = Run(Environment.GetCommandLineArgs()) ? 0 : 1;
            }
            catch (Exception e)
            {
                Debug.LogError($"[Artigas1] La compilación falló: {e}");
                code = 1;
            }
            if (Application.isBatchMode)
            {
                EditorApplication.Exit(code);
            }
        }

        [MenuItem(MenuPath)]
        private static void BuildFromMenu()
        {
            Run(Array.Empty<string>());
        }

        /// <summary>Configura y compila. Devuelve true si el APK quedó generado.</summary>
        public static bool Run(string[] commandLine)
        {
            BuildArguments args = BuildArguments.Parse(commandLine, Environment.GetEnvironmentVariable);
            if (args.Errors.Count > 0)
            {
                foreach (string e in args.Errors)
                {
                    Debug.LogError($"[Artigas1] {e}");
                }
                return false;
            }

            string[] scenes = args.Scenes.Count > 0
                ? args.Scenes.ToArray()
                : EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (scenes.Length == 0)
            {
                Debug.LogError("[Artigas1] No hay escenas para compilar: agregalas en Build Settings o pasá -scenes.");
                return false;
            }
            string missing = scenes.FirstOrDefault(s => !File.Exists(s));
            if (missing != null)
            {
                Debug.LogError($"[Artigas1] No existe la escena {missing}");
                return false;
            }

            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android &&
                !EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android))
            {
                Debug.LogError("[Artigas1] No se pudo cambiar la plataforma a Android (¿está instalado Android Build Support?).");
                return false;
            }

            ConfigureAndroid(args);
            if (!OpenXrActiveForAndroid())
            {
                Debug.LogError("[Artigas1] OpenXR no está activo para Android: Project Settings → XR Plug-in Management → pestaña Android → OpenXR (con el grupo de funciones Meta Quest).");
                return false;
            }

            string output = Path.GetFullPath(args.OutputPath);
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            var options = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = output,
                target = BuildTarget.Android,
                targetGroup = BuildTargetGroup.Android,
                options = args.Development ? BuildOptions.Development | BuildOptions.ConnectWithProfiler : BuildOptions.None,
            };

            Debug.Log($"[Artigas1] Compilando {args.ApplicationId} {args.Version} ({args.BuildNumber}) → {output}\nEscenas: {string.Join(", ", scenes)}");
            BuildReport report = BuildPipeline.BuildPlayer(options);
            BuildSummary summary = report.summary;
            if (summary.result != BuildResult.Succeeded)
            {
                Debug.LogError($"[Artigas1] Resultado: {summary.result}, {summary.totalErrors} errores.");
                return false;
            }
            Debug.Log($"[Artigas1] Listo: {summary.outputPath} ({summary.totalSize / (1024f * 1024f):0.0} MB) en {summary.totalTime.TotalSeconds:0} s.");
            return true;
        }

        /// <summary>Ajustes de reproductor que pide el Quest (se aplican en cada compilación para no depender del proyecto local).</summary>
        public static void ConfigureAndroid(BuildArguments args)
        {
            NamedBuildTarget android = NamedBuildTarget.Android;
            PlayerSettings.SetApplicationIdentifier(android, args.ApplicationId);
            PlayerSettings.bundleVersion = args.Version;
            PlayerSettings.Android.bundleVersionCode = args.BuildNumber;
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel32;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC;
            EditorUserBuildSettings.buildAppBundle = args.AppBundle;
            EditorUserBuildSettings.development = args.Development;
            // El visor necesita conexión a la red local para mandar la telemetría al backend.
            PlayerSettings.Android.forceInternetPermission = true;
            // En la red del aula el backend suele estar en http://IP-local: se permite HTTP también en release.
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
        }

        private static bool OpenXrActiveForAndroid()
        {
            XRGeneralSettings settings = XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(BuildTargetGroup.Android);
            if (settings == null || settings.Manager == null)
            {
                return false;
            }
            return settings.Manager.activeLoaders.Any(l => l != null && l.GetType().Name.Contains("OpenXR"));
        }
    }
}

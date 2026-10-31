// Firmas mínimas del editor de Unity (solo para compilar fuera del editor).
using System;
using UnityEngine;

namespace UnityEditor
{
    public enum BuildTarget
    {
        StandaloneWindows64 = 19,
        Android = 13,
    }

    public enum BuildTargetGroup
    {
        Standalone = 1,
        Android = 7,
    }

    [Flags]
    public enum BuildOptions
    {
        None = 0,
        Development = 1,
        ConnectWithProfiler = 256,
    }

    public enum ScriptingImplementation
    {
        Mono2x = 0,
        IL2CPP = 1,
    }

    [Flags]
    public enum AndroidArchitecture : uint
    {
        None = 0,
        ARMv7 = 1,
        ARM64 = 2,
    }

    public enum AndroidSdkVersions
    {
        AndroidApiLevelAuto = 0,
        AndroidApiLevel29 = 29,
        AndroidApiLevel32 = 32,
    }

    public enum MobileTextureSubtarget
    {
        Generic = 0,
        ETC2 = 3,
        ASTC = 4,
    }

    public enum InsecureHttpOption
    {
        NotAllowed = 0,
        DevelopmentOnly = 1,
        AlwaysAllowed = 2,
    }

    public struct BuildPlayerOptions
    {
        public string[] scenes { get; set; }
        public string locationPathName { get; set; }
        public BuildTarget target { get; set; }
        public BuildTargetGroup targetGroup { get; set; }
        public BuildOptions options { get; set; }
    }

    public sealed class EditorBuildSettingsScene
    {
        public bool enabled { get; set; }
        public string path { get; set; } = string.Empty;
    }

    public static class EditorBuildSettings
    {
        public static EditorBuildSettingsScene[] scenes { get; set; } = Array.Empty<EditorBuildSettingsScene>();
    }

    public static class EditorUserBuildSettings
    {
        public static BuildTarget activeBuildTarget => BuildTarget.Android;
        public static MobileTextureSubtarget androidBuildSubtarget { get; set; }
        public static bool buildAppBundle { get; set; }
        public static bool development { get; set; }
        public static bool SwitchActiveBuildTarget(BuildTargetGroup group, BuildTarget target) => true;
    }

    public static class PlayerSettings
    {
        public static string bundleVersion { get; set; } = string.Empty;
        public static ColorSpace colorSpace { get; set; }
        public static InsecureHttpOption insecureHttpOption { get; set; }
        public static void SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget target, string identifier) { }
        public static void SetScriptingBackend(UnityEditor.Build.NamedBuildTarget target, ScriptingImplementation backend) { }
        public static void SetUseDefaultGraphicsAPIs(BuildTarget target, bool automatic) { }
        public static void SetGraphicsAPIs(BuildTarget target, UnityEngine.Rendering.GraphicsDeviceType[] apis) { }

        public static class Android
        {
            public static int bundleVersionCode { get; set; }
            public static AndroidArchitecture targetArchitectures { get; set; }
            public static AndroidSdkVersions minSdkVersion { get; set; }
            public static bool forceInternetPermission { get; set; }
        }
    }

    public static class BuildPipeline
    {
        public static UnityEditor.Build.Reporting.BuildReport BuildPlayer(BuildPlayerOptions options) => new UnityEditor.Build.Reporting.BuildReport();
    }

    public static class EditorApplication
    {
        public static void Exit(int returnValue) { }
    }

    [AttributeUsage(AttributeTargets.Method)]
    public sealed class MenuItem : Attribute
    {
        public MenuItem(string itemName) { }
    }

    public class AssetPostprocessor
    {
        public string assetPath { get; set; } = string.Empty;
    }
}

namespace UnityEditor.Build
{
    public readonly struct NamedBuildTarget
    {
        public static readonly NamedBuildTarget Android = default;
        public static readonly NamedBuildTarget Standalone = default;
    }
}

namespace UnityEditor.Build.Reporting
{
    public enum BuildResult
    {
        Unknown = 0,
        Succeeded = 1,
        Failed = 2,
        Cancelled = 3,
    }

    public struct BuildSummary
    {
        public BuildResult result { get; set; }
        public int totalErrors { get; set; }
        public ulong totalSize { get; set; }
        public TimeSpan totalTime { get; set; }
        public string outputPath { get; set; }
    }

    public sealed class BuildReport
    {
        public BuildSummary summary { get; set; }
    }
}

namespace UnityEditor.XR.Management
{
    public sealed class XRGeneralSettingsPerBuildTarget
    {
        public static UnityEngine.XR.Management.XRGeneralSettings XRGeneralSettingsForBuildTarget(BuildTargetGroup targetGroup) => null;
    }
}

using System.IO;
using UnityEditor;
using UnityEngine;

namespace Artigas1.Editor
{
    /// <summary>
    /// Ajustes de importación del kit 3D de Artigas-1:
    /// <list type="bullet">
    /// <item>FBX de <c>Assets/Artigas1/Modelos</c>: escala 1, sin cámaras, luces ni animación; UV de lightmap para
    /// cascos, racks y bahías; y cada material del FBX se reemplaza por el de <c>Assets/Artigas1/Materiales</c> con
    /// el mismo nombre (los crea el menú Artigas-1 → 1).</item>
    /// <item>Texturas de <c>Assets/Artigas1/Texturas</c>: la paleta en Point y sin mipmaps (los colores no se mezclan
    /// entre celdas), los mapas de metal en lineal y ASTC para Android.</item>
    /// </list>
    /// </summary>
    public sealed class ArtigasImportador : AssetPostprocessor
    {
        public const string Modelos = "Assets/Artigas1/Modelos/";
        public const string Texturas = "Assets/Artigas1/Texturas/";
        public const string Materiales = "Assets/Artigas1/Materiales/";

        private void OnPreprocessModel()
        {
            if (!assetPath.StartsWith(Modelos))
            {
                return;
            }
            var mi = (ModelImporter)assetImporter;
            string nombre = Path.GetFileNameWithoutExtension(assetPath);
            mi.globalScale = 1f;
            mi.useFileScale = true;
            mi.importCameras = false;
            mi.importLights = false;
            mi.importVisibility = false;
            mi.importAnimation = false;
            mi.animationType = ModelImporterAnimationType.None;
            mi.importBlendShapes = false;
            mi.isReadable = false;
            mi.addCollider = false;
            mi.meshCompression = ModelImporterMeshCompression.Off;
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            mi.materialLocation = ModelImporterMaterialLocation.InPrefab;
            mi.generateSecondaryUV = nombre.Contains("Casco") || nombre.Contains("Rack") || nombre.Contains("Bahia") || nombre.StartsWith("Layout");
        }

        private void OnPostprocessModel(GameObject raiz)
        {
            if (!assetPath.StartsWith(Modelos))
            {
                return;
            }
            foreach (Renderer r in raiz.GetComponentsInChildren<Renderer>(true))
            {
                Material[] mats = r.sharedMaterials;
                bool cambio = false;
                for (int i = 0; i < mats.Length; i++)
                {
                    if (mats[i] == null)
                    {
                        continue;
                    }
                    Material propio = AssetDatabase.LoadAssetAtPath<Material>($"{Materiales}{NombreMaterial(mats[i].name)}.mat");
                    if (propio != null)
                    {
                        mats[i] = propio;
                        cambio = true;
                    }
                }
                if (cambio)
                {
                    r.sharedMaterials = mats;
                }
            }
        }

        /// <summary>"M_Artigas_Paleta.001" o "M_Artigas_Paleta (Instance)" → "M_Artigas_Paleta".</summary>
        public static string NombreMaterial(string n)
        {
            int i = n.IndexOf(" (", System.StringComparison.Ordinal);
            if (i > 0)
            {
                n = n.Substring(0, i);
            }
            int p = n.LastIndexOf('.');
            if (p > 0 && p < n.Length - 1 && int.TryParse(n.Substring(p + 1), out _))
            {
                n = n.Substring(0, p);
            }
            return n.Trim();
        }

        private void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(Texturas))
            {
                return;
            }
            var ti = (TextureImporter)assetImporter;
            string f = Path.GetFileNameWithoutExtension(assetPath);
            bool paleta = f.Contains("Paleta");
            bool lineal = f.Contains("Metallic");
            bool tierra = f.StartsWith("T_Tierra") || f.StartsWith("T_Estrellas");
            ti.textureType = TextureImporterType.Default;
            ti.sRGBTexture = !lineal;
            ti.mipmapEnabled = !paleta;
            ti.filterMode = paleta ? FilterMode.Point : FilterMode.Bilinear;
            ti.wrapModeU = tierra && !f.Contains("Detalle") ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;
            ti.wrapModeV = TextureWrapMode.Clamp;
            ti.alphaSource = f.Contains("Detalle") ? TextureImporterAlphaSource.FromInput : TextureImporterAlphaSource.None;
            ti.alphaIsTransparency = f.Contains("Detalle");
            if (paleta && lineal)
            {
                ti.alphaSource = TextureImporterAlphaSource.FromInput; // suavidad en el alfa
            }
            int max = f.Contains("4K") ? 4096 : (f.Contains("2K") || f.Contains("Detalle")) ? 2048 : 1024;
            ti.maxTextureSize = max;
            TextureImporterPlatformSettings android = ti.GetPlatformTextureSettings("Android");
            android.overridden = true;
            android.maxTextureSize = max;
            android.format = tierra ? TextureImporterFormat.ASTC_6x6 : TextureImporterFormat.ASTC_4x4;
            ti.SetPlatformTextureSettings(android);
        }
    }
}

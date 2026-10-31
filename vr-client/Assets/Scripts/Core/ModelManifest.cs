using System;
using UnityEngine;

namespace XRLab
{
    // Espejo de GET /api/v1/models/manifest (backend/app/schemas.py: ModelManifest). Los campos se llaman como en el
    // JSON (snake_case) porque JsonUtility los empareja por nombre; los diccionarios (sizes_bytes) se ignoran.
    // Las coordenadas vienen en ejes glTF (mano derecha, y arriba): usar ExplodedViewMath.GltfToUnity.

#pragma warning disable IDE1006 // nombres del contrato JSON

    [Serializable]
    public sealed class ModelFilesDto
    {
        public string glb;
        /// <summary>Puede faltar (null) en los modelos importados de otros proyectos.</summary>
        public string fbx;
        public string blend;
        /// <summary>Para la RA del iPhone; null si el modelo no lo trae.</summary>
        public string usdz;
    }

    [Serializable]
    public sealed class ModelPartDto
    {
        public string node;
        public string name;
        public string material;
        /// <summary>null en el JSON si se desconoce: JsonUtility lo deja en 0.</summary>
        public float mass_kg;
        public float[] explode_offset;
        public string parent;
    }

    [Serializable]
    public sealed class SnapPointDto
    {
        public string node;
        public string accepts;
        public float tolerance_m;
        public float[] position;
    }

    [Serializable]
    public sealed class ModelAssetDto
    {
        public string id;
        /// <summary>"laboratorio" (generados en el repo) o el proyecto de origen: puerto, autoelevador, atlas, robot.</summary>
        public string collection;
        public string collection_name;
        public string source;
        public string root_node;
        public string name;
        public string category;
        public string description;
        public ModelFilesDto files;
        public ModelFilesDto urls;
        public bool available;
        public float[] dimensions_m;
        public int triangles;
        public float mass_kg;
        public ModelPartDto[] parts;
        public SnapPointDto[] snap_points;
    }

    [Serializable]
    public sealed class ModelManifestDto
    {
        public int version;
        public string units;
        public string axes;
        public ModelAssetDto[] assets;

        /// <summary>Lee el JSON del manifest (lanza si no es válido).</summary>
        public static ModelManifestDto Parse(string json)
        {
            var m = JsonUtility.FromJson<ModelManifestDto>(json);
            if (m == null || m.assets == null)
            {
                throw new FormatException("El manifest no tiene la lista de activos");
            }
            return m;
        }

        public ModelAssetDto Find(string assetId)
        {
            if (assets == null)
            {
                return null;
            }
            foreach (ModelAssetDto a in assets)
            {
                if (a != null && a.id == assetId)
                {
                    return a;
                }
            }
            return null;
        }
    }

#pragma warning restore IDE1006

    /// <summary>Utilidades sobre el manifest, sin MonoBehaviour.</summary>
    public static class ManifestMath
    {
        /// <summary>Vector de 3 floats del JSON (ejes glTF) llevado a Unity. Si falta o es corto, cero.</summary>
        public static Vector3 ToUnity(float[] v)
        {
            if (v == null || v.Length < 3)
            {
                return Vector3.zero;
            }
            return ExplodedViewMath.GltfToUnity(new Vector3(v[0], v[1], v[2]));
        }

        /// <summary>Tipo de pieza que se usa en los encajes: "Part_Placa_OBC" → "placa_obc"; un nombre sin prefijo queda en minúsculas.</summary>
        public static string PartTypeFromNode(string nodeName)
        {
            if (string.IsNullOrEmpty(nodeName))
            {
                return string.Empty;
            }
            string n = nodeName.StartsWith("Part_", StringComparison.Ordinal) ? nodeName.Substring(5) : nodeName;
            int dot = n.IndexOf('.');
            if (dot > 0)
            {
                n = n.Substring(0, dot); // "Part_Rueda.001" → "rueda"
            }
            return n.ToLowerInvariant();
        }
    }
}

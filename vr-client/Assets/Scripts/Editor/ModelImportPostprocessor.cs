using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace XRLab.Editor
{
    /// <summary>
    /// Al importar un FBX del laboratorio (copiado de /models/fbx a Assets/Models/), arma el prefab listo para usar:
    /// <list type="bullet">
    /// <item>los vacíos Snap_* con la propiedad «encaje» se vuelven <see cref="SnapZone"/> (trigger esférico);</item>
    /// <item>la raíz recibe un <see cref="ExplodedViewManager"/> con los desplazamientos «explotar» de cada Part_*
    /// (vienen en ejes glTF y se pasan a Unity);</item>
    /// <item>las piezas cuyo tipo acepta algún encaje del mismo modelo se pueden tomar: Rigidbody sin gravedad,
    /// collider convexo, XRGrabInteractable y <see cref="SnappablePart"/>.</item>
    /// </list>
    /// Las convenciones están en models/README.md.
    /// </summary>
    public sealed class ModelImportPostprocessor : AssetPostprocessor
    {
        public const string ModelsFolder = "Assets/Models/";
        /// <summary>Radio del imán de los encajes: diez veces la tolerancia de ajuste, entre 3 y 15 cm.</summary>
        public const float MagnetFactor = 10f;

        private readonly Dictionary<GameObject, Vector3> _offsets = new Dictionary<GameObject, Vector3>();
        private readonly HashSet<string> _acceptedTypes = new HashSet<string>();

        private bool IsLabModel => assetPath.StartsWith(ModelsFolder, System.StringComparison.Ordinal) &&
                                   assetPath.EndsWith(".fbx", System.StringComparison.OrdinalIgnoreCase);

        private void OnPostprocessGameObjectWithUserProperties(GameObject go, string[] names, object[] values)
        {
            if (!IsLabModel)
            {
                return;
            }
            if (UserPropertyParser.TryVector3(UserPropertyParser.Find(names, values, "explotar"), out Vector3 gltf))
            {
                _offsets[go] = ExplodedViewMath.GltfToUnity(gltf);
            }
            if (UserPropertyParser.Find(names, values, "encaje") is string accepts)
            {
                UserPropertyParser.TryFloat(UserPropertyParser.Find(names, values, "tolerancia_m"), out float tol);
                float magnet = Mathf.Clamp(tol * MagnetFactor, 0.03f, 0.15f);
                var trigger = go.AddComponent<SphereCollider>();
                trigger.isTrigger = true;
                trigger.radius = magnet * SnapZone.FailRadiusFactor;
                var zone = go.AddComponent<SnapZone>();
                zone.Configure(accepts, tol, magnet);
                foreach (string t in accepts.Split(','))
                {
                    _acceptedTypes.Add(t.Trim().ToLowerInvariant());
                }
            }
        }

        private void OnPostprocessModel(GameObject root)
        {
            if (!IsLabModel)
            {
                return;
            }
            var parts = new List<Transform>();
            foreach (Transform t in root.GetComponentsInChildren<Transform>(true))
            {
                if (t.name.StartsWith("Part_", System.StringComparison.Ordinal))
                {
                    parts.Add(t);
                }
            }
            if (parts.Count == 0)
            {
                return;
            }
            // GetComponent devuelve un null «falso» de Unity: no usar ?? con objetos de Unity.
            ExplodedViewManager manager = root.GetComponent<ExplodedViewManager>();
            if (manager == null)
            {
                manager = root.AddComponent<ExplodedViewManager>();
            }
            manager.Discover();
            int conOffset = 0;
            foreach (Transform t in parts)
            {
                if (_offsets.TryGetValue(t.gameObject, out Vector3 offset) && manager.SetOffset(t, offset))
                {
                    conOffset++;
                }
                if (_acceptedTypes.Contains(ManifestMath.PartTypeFromNode(t.name)))
                {
                    MakeGrabbable(t.gameObject);
                }
            }
            Debug.Log($"[XRLab] {assetPath}: {parts.Count} piezas ({conOffset} con desplazamiento del modelo), {_acceptedTypes.Count} tipos de encaje.");
        }

        private static void MakeGrabbable(GameObject go)
        {
            Rigidbody body = go.GetComponent<Rigidbody>();
            if (body == null)
            {
                body = go.AddComponent<Rigidbody>();
            }
            body.useGravity = false; // en el laboratorio las piezas quedan flotando donde se sueltan
            body.isKinematic = true;
            if (go.GetComponent<Collider>() == null && go.GetComponent<MeshFilter>() != null)
            {
                var mc = go.AddComponent<MeshCollider>();
                mc.convex = true;
            }
            if (go.GetComponent<XRGrabInteractable>() == null)
            {
                go.AddComponent<XRGrabInteractable>();
            }
            if (go.GetComponent<SnappablePart>() == null)
            {
                go.AddComponent<SnappablePart>();
            }
        }
    }
}

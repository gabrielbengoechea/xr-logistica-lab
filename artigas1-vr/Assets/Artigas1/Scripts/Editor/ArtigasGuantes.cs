using System.Collections.Generic;
using System.IO;
using System.Linq;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace Artigas1.Editor
{
    /// <summary>
    /// Manos del astronauta: arma las mallas del guante (derecha e izquierda) a partir de guante.bin, el mismo modelo
    /// de Blender que usa el recorrido web, y pone un guante en cada control de las escenas F1 y F5.
    /// </summary>
    public static class ArtigasGuantes
    {
        private const string Carpeta = "Assets/Artigas1/Modelos/Guante/";
        private const string Generado = "Assets/Artigas1/Generado/";

        [System.Serializable]
        private sealed class Desplazamientos
        {
            public int posicion;
            public int normal;
            public int huesos;
            public int pesos;
            public int zona;
            public int costura;
            public int indices;
        }

        [System.Serializable]
        private sealed class InfoGuante
        {
            public int vertices;
            public int indices;
            public Desplazamientos desplazamientos;
            public int bytes;
        }

        // tela, goma, yema, refuerzo, puño (colores, rugosidad y metal de js/manos.js, ZONAS_GUANTE)
        private static readonly (string nombre, Color color, float rugosidad, float metal)[] Zonas =
        {
            ("Tela", Hex(0xeceae4), 0.92f, 0.00f),
            ("Goma", Hex(0x5a6068), 0.96f, 0.00f),
            ("Yema", Hex(0x3d4248), 0.90f, 0.00f),
            ("Refuerzo", Hex(0x8e98a4), 0.58f, 0.35f),
            ("Puno", Hex(0xc8ced4), 0.80f, 0.05f),
        };

        [MenuItem("Artigas-1/7. Guantes en las manos", priority = 17)]
        public static void PonerGuantes()
        {
            var bin = AssetDatabase.LoadAssetAtPath<TextAsset>(Carpeta + "guante.bytes");
            var json = AssetDatabase.LoadAssetAtPath<TextAsset>(Carpeta + "guante.json");
            if (bin == null || json == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", $"Faltan {Carpeta}guante.bytes y guante.json (copia de web-dashboard/public/artigas1).", "OK");
                return;
            }
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                return;
            }
            InfoGuante info = JsonUtility.FromJson<InfoGuante>(json.text);
            byte[] datos = bin.bytes;
            if (datos.Length != info.bytes)
            {
                Debug.LogError($"[Artigas1] guante.bytes tiene {datos.Length} bytes y se esperaban {info.bytes}.");
                return;
            }
            Directory.CreateDirectory(Generado + "Mallas");
            Directory.CreateDirectory(Generado + "Materiales");
            AssetDatabase.Refresh();
            Mesh derecha = ArmarMalla(info, datos, false);
            Mesh izquierda = ArmarMalla(info, datos, true);
            Material[] materiales = Zonas.Select(z => Mat($"M_Guante_{z.nombre}", z.color, z.metal, 1f - z.rugosidad)).ToArray();

            int puestos = 0;
            foreach (string escena in new[] { ArtigasMenu.EscenaF1, ArtigasExterior.EscenaEva })
            {
                if (AssetDatabase.LoadAssetAtPath<SceneAsset>(escena) == null)
                {
                    continue;
                }
                Scene s = EditorSceneManager.OpenScene(escena, OpenSceneMode.Single);
                XROrigin origen = Object.FindAnyObjectByType<XROrigin>();
                if (origen == null)
                {
                    Debug.LogWarning($"[Artigas1] {escena}: no hay XR Origin.");
                    continue;
                }
                bool eva = escena == ArtigasExterior.EscenaEva;
                foreach ((string control, bool izq) in new[] { ("Left Controller", true), ("Right Controller", false) })
                {
                    Transform t = origen.GetComponentsInChildren<Transform>(true).FirstOrDefault(x => x.name == control);
                    if (t == null)
                    {
                        Debug.LogWarning($"[Artigas1] {escena}: no encontré «{control}».");
                        continue;
                    }
                    PonerGuante(t, izq, izq ? izquierda : derecha, materiales, eva);
                    puestos++;
                }
                EditorSceneManager.MarkSceneDirty(s);
                EditorSceneManager.SaveScene(s);
            }
            AssetDatabase.SaveAssets();
            EditorSceneManager.OpenScene(ArtigasMenu.EscenaF1, OpenSceneMode.Single);
            Debug.Log($"[Artigas1] Guantes: {puestos} manos en las escenas, malla de {derecha.vertexCount} vértices y 16 huesos.");
        }

        private static void PonerGuante(Transform control, bool izquierda, Mesh malla, Material[] materiales, bool presurizado)
        {
            string nombre = izquierda ? "Guante_Izquierdo" : "Guante_Derecho";
            Transform viejo = control.Find(nombre);
            if (viejo != null)
            {
                Object.DestroyImmediate(viejo.gameObject);
            }
            var raiz = new GameObject(nombre);
            raiz.transform.SetParent(control, false);
            var huesos = new Transform[ManoCinematica.Huesos];
            var reposo = new Matrix4x4[ManoCinematica.Huesos];
            ManoCinematica.MarcosWeb(ManoCinematica.Molde, reposo);
            for (int h = 0; h < huesos.Length; h++)
            {
                var hueso = new GameObject(ManoCinematica.NombresHuesos[h]).transform;
                hueso.SetParent(raiz.transform, false);
                Matrix4x4 m = ManoCinematica.AUnity(reposo[h], izquierda);
                hueso.localPosition = m.GetColumn(3);
                hueso.localRotation = m.rotation;
                huesos[h] = hueso;
            }
            var smr = raiz.AddComponent<SkinnedMeshRenderer>();
            smr.sharedMesh = malla;
            smr.sharedMaterials = materiales;
            smr.bones = huesos;
            smr.rootBone = raiz.transform;
            smr.updateWhenOffscreen = false;
            smr.localBounds = new Bounds(new Vector3(0f, 0f, 0.05f), new Vector3(0.25f, 0.2f, 0.3f));
            smr.shadowCastingMode = ShadowCastingMode.Off;
            smr.receiveShadows = false;
            smr.lightProbeUsage = LightProbeUsage.BlendProbes;
            smr.quality = SkinQuality.Bone2;
            var guante = raiz.AddComponent<GuanteMano>();
            guante.Configurar(izquierda, smr, huesos, presurizado);
            EditorUtility.SetDirty(guante);
        }

        private static Mesh ArmarMalla(InfoGuante info, byte[] d, bool izquierda)
        {
            int n = info.vertices;
            var desp = info.desplazamientos;
            var pos = new Vector3[n];
            var nor = new Vector3[n];
            var pesos = new BoneWeight[n];
            var zona = new byte[n];
            for (int i = 0; i < n; i++)
            {
                Vector3 p = new Vector3(F(d, desp.posicion, i * 3), F(d, desp.posicion, i * 3 + 1), F(d, desp.posicion, i * 3 + 2));
                Vector3 q = new Vector3(F(d, desp.normal, i * 3), F(d, desp.normal, i * 3 + 1), F(d, desp.normal, i * 3 + 2));
                pos[i] = ManoCinematica.PuntoAUnity(p, izquierda);
                nor[i] = ManoCinematica.PuntoAUnity(q, izquierda).normalized;
                int b = desp.huesos + i * 4;
                int w = desp.pesos + i * 4;
                float suma = d[w] + d[w + 1] + d[w + 2] + d[w + 3];
                if (suma <= 0f)
                {
                    suma = 1f;
                }
                pesos[i] = new BoneWeight
                {
                    boneIndex0 = d[b], weight0 = d[w] / suma,
                    boneIndex1 = d[b + 1], weight1 = d[w + 1] / suma,
                    boneIndex2 = d[b + 2], weight2 = d[w + 2] / suma,
                    boneIndex3 = d[b + 3], weight3 = d[w + 3] / suma,
                };
                zona[i] = d[desp.zona + i];
            }
            // un reflejo (Z, para pasar a Unity) invierte el sentido de las caras; la izquierda suma otro (X) y vuelve
            bool invertir = !izquierda;
            var porZona = Enumerable.Range(0, Zonas.Length).Select(_ => new List<int>()).ToArray();
            for (int t = 0; t < info.indices; t += 3)
            {
                int a = U16(d, desp.indices, t);
                int b = U16(d, desp.indices, t + 1);
                int c = U16(d, desp.indices, t + 2);
                // la zona del triángulo es la que comparten al menos dos de sus vértices
                int z = zona[b] == zona[c] ? zona[b] : zona[a];
                z = Mathf.Clamp(z, 0, Zonas.Length - 1);
                porZona[z].AddRange(invertir ? new[] { a, c, b } : new[] { a, b, c });
            }
            var reposo = new Matrix4x4[ManoCinematica.Huesos];
            ManoCinematica.MarcosWeb(ManoCinematica.Molde, reposo);
            var bind = reposo.Select(m => ManoCinematica.AUnity(m, izquierda).inverse).ToArray();

            string nombre = izquierda ? "Guante_Izquierdo" : "Guante_Derecho";
            string ruta = $"{Generado}Mallas/{nombre}.asset";
            var malla = AssetDatabase.LoadAssetAtPath<Mesh>(ruta);
            if (malla == null)
            {
                malla = new Mesh();
                AssetDatabase.CreateAsset(malla, ruta);
            }
            malla.Clear();
            malla.name = nombre;
            malla.vertices = pos;
            malla.normals = nor;
            malla.boneWeights = pesos;
            malla.bindposes = bind;
            malla.subMeshCount = Zonas.Length;
            for (int z = 0; z < Zonas.Length; z++)
            {
                malla.SetTriangles(porZona[z], z);
            }
            malla.RecalculateBounds();
            EditorUtility.SetDirty(malla);
            return malla;
        }

        private static float F(byte[] d, int inicio, int i) => System.BitConverter.ToSingle(d, inicio + i * 4);

        private static int U16(byte[] d, int inicio, int i) => System.BitConverter.ToUInt16(d, inicio + i * 2);

        private static Material Mat(string nombre, Color color, float metal, float suavidad)
        {
            string ruta = $"{Generado}Materiales/{nombre}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            if (m == null)
            {
                m = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                AssetDatabase.CreateAsset(m, ruta);
            }
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Metallic", metal);
            m.SetFloat("_Smoothness", suavidad);
            m.enableInstancing = true;
            EditorUtility.SetDirty(m);
            return m;
        }

        private static Color Hex(int rgb) => new Color(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f);
    }
}

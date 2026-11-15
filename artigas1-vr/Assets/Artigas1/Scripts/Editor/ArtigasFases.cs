using System.Collections.Generic;
using System.Linq;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace Artigas1.Editor
{
    /// <summary>
    /// Pasos del menú Artigas-1 que mejoran la escena F1 ya armada (paso 3): configuración del Quest,
    /// iluminación horneada (fase 2) e interacción y actividades (fases 3 y 4).
    /// Se pueden correr de nuevo: borran lo que generaron antes y lo vuelven a crear.
    /// </summary>
    public static class ArtigasFases
    {
        private const string Raiz = "Assets/Artigas1/";
        private const string Materiales = Raiz + "Materiales/";
        private const string Iluminacion = Raiz + "Escenas/F1_Rivera_Iluminacion.lighting";

        // ------------------------------------------------------------------------------------------------ Quest
        [MenuItem("Artigas-1/Configurar proyecto para Quest", priority = 30)]
        public static void ConfigurarQuest()
        {
            PlayerSettings.companyName = "UTEC";
            PlayerSettings.productName = "Artigas-1";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.utec.artigas1");
            // la telemetría va al backend de XR Logística Lab en la red del aula, por http
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
            EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC;
            AssetDatabase.SaveAssets();
            Debug.Log("[Artigas1] Proyecto configurado: com.utec.artigas1, HTTP permitido para la telemetría, texturas ASTC.");
        }

        // ------------------------------------------------------------------------------------------------ 4
        [MenuItem("Artigas-1/4. Iluminación horneada (fase 2)", priority = 14)]
        public static void IluminacionHorneada()
        {
            if (!AbrirF1())
            {
                return;
            }
            GameObject modulo = GameObject.Find("Modulo_Rivera");
            if (modulo == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", "No encuentro «Modulo_Rivera» en la escena. Corré el paso 3.", "OK");
                return;
            }
            Bounds caja = Limites(modulo);
            bool ejeX = caja.size.x > caja.size.z;
            Vector3 eje = ejeX ? Vector3.right : Vector3.forward;
            Vector3 lado = Vector3.Cross(Vector3.up, eje);
            float largo = ejeX ? caja.size.x : caja.size.z;
            float ancho = ejeX ? caja.size.z : caja.size.x;

            // ambiente frío y tecnológico; la luz principal sale de las lámparas horneadas
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.16f, 0.20f, 0.26f);
            RenderSettings.ambientEquatorColor = new Color(0.11f, 0.13f, 0.17f);
            RenderSettings.ambientGroundColor = new Color(0.06f, 0.07f, 0.09f);

            foreach (Light l in Object.FindObjectsByType<Light>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                if (l.name.StartsWith("Luz_"))
                {
                    l.lightmapBakeType = LightmapBakeType.Baked;
                    l.color = new Color(0.86f, 0.92f, 1.00f);
                    l.intensity = 1.8f;
                    l.range = 4.5f;
                    l.shadows = LightShadows.Soft;
                }
            }

            Borrar("Iluminacion_Fase2");
            Transform raiz = new GameObject("Iluminacion_Fase2").transform;
            // dos tiras LED en el techo, a lo largo del módulo (luces de área: solo existen horneadas, costo cero en el visor)
            for (int s = -1; s <= 1; s += 2)
            {
                var led = new GameObject(s < 0 ? "LED_Techo_Babor" : "LED_Techo_Estribor").AddComponent<Light>();
                led.transform.SetParent(raiz, false);
                led.type = LightType.Rectangle;
                led.lightmapBakeType = LightmapBakeType.Baked;
                led.areaSize = new Vector2(0.06f, largo * 0.75f);
                led.color = new Color(0.80f, 0.90f, 1.00f);
                led.intensity = 3.5f;
                led.transform.position = caja.center + Vector3.up * (caja.extents.y - 0.18f) + lado * (s * ancho * 0.18f);
                led.transform.rotation = Quaternion.LookRotation(Vector3.down, eje);
            }
            // luz de acento cálida y tenue sobre el piso: separa el piso del techo y mejora la profundidad
            var acento = new GameObject("Acento_Piso").AddComponent<Light>();
            acento.transform.SetParent(raiz, false);
            acento.type = LightType.Rectangle;
            acento.lightmapBakeType = LightmapBakeType.Baked;
            acento.areaSize = new Vector2(0.05f, largo * 0.6f);
            acento.color = new Color(1.00f, 0.78f, 0.55f);
            acento.intensity = 0.9f;
            acento.transform.position = caja.center - Vector3.up * (caja.extents.y - 0.15f);
            acento.transform.rotation = Quaternion.LookRotation(Vector3.up, eje);

            // sondas de luz para lo que se mueve (cargas, escáner, manos) y para lo que no tiene UV de lightmap
            var sondas = new GameObject("Sondas_de_luz").AddComponent<LightProbeGroup>();
            sondas.transform.SetParent(raiz, false);
            sondas.transform.position = caja.center;
            var puntos = new List<Vector3>();
            int nl = Mathf.Max(2, Mathf.CeilToInt(largo / 1.0f) + 1);
            Vector3 medio = caja.extents - Vector3.one * 0.35f;
            for (int i = 0; i < nl; i++)
            {
                float u = Mathf.Lerp(-1f, 1f, i / (float)(nl - 1));
                for (int j = -1; j <= 1; j++)
                {
                    for (int k = -1; k <= 1; k++)
                    {
                        Vector3 p = eje * (u * Vector3.Dot(medio, Abs(eje))) + Vector3.up * (j * medio.y) + lado * (k * Vector3.Dot(medio, Abs(lado)));
                        puntos.Add(p);
                    }
                }
            }
            sondas.probePositions = puntos.ToArray();

            // un reflejo horneado con proyección de caja: los metales reflejan el módulo y no un cielo genérico
            var reflejo = new GameObject("Reflejos_Modulo").AddComponent<ReflectionProbe>();
            reflejo.transform.SetParent(raiz, false);
            reflejo.transform.position = caja.center;
            reflejo.mode = ReflectionProbeMode.Baked;
            reflejo.size = caja.size;
            reflejo.boxProjection = true;
            reflejo.resolution = 128;

            // lo que contribuye a la iluminación global pero no tiene UV de lightmap toma la luz de las sondas
            int conSondas = 0;
            foreach (MeshRenderer mr in Object.FindObjectsByType<MeshRenderer>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                MeshFilter mf = mr.GetComponent<MeshFilter>();
                bool contribuye = GameObjectUtility.GetStaticEditorFlags(mr.gameObject).HasFlag(StaticEditorFlags.ContributeGI);
                bool tieneUv2 = mf != null && mf.sharedMesh != null && mf.sharedMesh.HasVertexAttribute(VertexAttribute.TexCoord1);
                if (contribuye && !tieneUv2)
                {
                    mr.receiveGI = ReceiveGI.LightProbes;
                    conSondas++;
                }
            }

            // ajustes de horneado pensados para la laptop y para la memoria del Quest 2
            if (AssetDatabase.LoadAssetAtPath<LightingSettings>(Iluminacion) != null)
            {
                AssetDatabase.DeleteAsset(Iluminacion);
            }
            var ajustes = new LightingSettings
            {
                name = "F1_Rivera_Iluminacion",
                bakedGI = true,
                realtimeGI = false,
                lightmapper = LightingSettings.Lightmapper.ProgressiveCPU,
                directSampleCount = 16,
                indirectSampleCount = 64,
                environmentSampleCount = 64,
                maxBounces = 2,
                lightmapResolution = 10f,
                lightmapMaxSize = 1024,
                lightmapPadding = 2,
                ao = true,
                aoMaxDistance = 0.4f,
                directionalityMode = LightmapsMode.NonDirectional,
                lightmapCompression = LightmapCompression.NormalQuality,
                filteringMode = LightingSettings.FilterMode.Auto,
            };
            AssetDatabase.CreateAsset(ajustes, Iluminacion);
            Lightmapping.lightingSettings = ajustes;

            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
            Lightmapping.bakeCompleted -= AlTerminarHorneado;
            Lightmapping.bakeCompleted += AlTerminarHorneado;
            bool empezo = Lightmapping.BakeAsync();
            Debug.Log($"[Artigas1] Iluminación de la fase 2 lista ({puntos.Count} sondas, {conSondas} objetos con luz de sondas). Horneado {(empezo ? "en curso: mirá la barra de abajo a la derecha" : "NO arrancó")}.");
        }

        private static void AlTerminarHorneado()
        {
            Lightmapping.bakeCompleted -= AlTerminarHorneado;
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
            Debug.Log("[Artigas1] Horneado terminado y escena guardada.");
        }

        // ------------------------------------------------------------------------------------------------ 5
        [MenuItem("Artigas-1/5. Interacción y actividades (fases 3 y 4)", priority = 15)]
        public static void InteraccionYActividades()
        {
            if (!AbrirF1())
            {
                return;
            }
            GameObject sistemas = GameObject.Find("Sistemas");
            XROrigin rig = Object.FindAnyObjectByType<XROrigin>();
            GameObject modulo = GameObject.Find("Modulo_Rivera");
            if (sistemas == null || rig == null || modulo == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", "Faltan «Sistemas», el XR Origin o el módulo. Corré el paso 3.", "OK");
                return;
            }

            // ---- actividades del turno
            Borrar("Actividades");
            var actividades = new GameObject("Actividades");
            actividades.transform.SetParent(sistemas.transform, false);
            var a1 = new GameObject("A1_Ubicar_cargas").AddComponent<ActividadUbicarCargas>();
            a1.transform.SetParent(actividades.transform, false);
            a1.TextosPorDefecto();
            var a2 = new GameObject("A2_Control_de_inventario").AddComponent<ActividadEscaneo>();
            a2.transform.SetParent(actividades.transform, false);
            a2.TextosPorDefecto();
            var gestor = actividades.AddComponent<GestorActividades>();
            var sg = new SerializedObject(gestor);
            SerializedProperty lista = sg.FindProperty("actividades");
            lista.arraySize = 2;
            lista.GetArrayElementAtIndex(0).objectReferenceValue = a1;
            lista.GetArrayElementAtIndex(1).objectReferenceValue = a2;
            sg.ApplyModifiedPropertiesWithoutUndo();

            // ---- panel de actividades con botón físico, flotando en el pasillo frente al punto de inicio
            Borrar("Panel_Actividades");
            Bounds caja = Limites(modulo);
            Transform t = rig.transform;
            Vector3 lateral = Vector3.Cross(Vector3.up, t.forward).normalized;
            var panelGo = new GameObject("Panel_Actividades");
            panelGo.transform.SetPositionAndRotation(
                new Vector3(t.position.x, caja.center.y + 0.22f, t.position.z) + t.forward * 0.85f + lateral * 0.28f,
                Quaternion.LookRotation(t.forward, Vector3.up));
            BotonFisico boton = CrearBoton(panelGo.transform, new Vector3(0f, -0.27f, 0f));
            var panel = panelGo.AddComponent<PanelActividad>();
            var sp = new SerializedObject(panel);
            sp.FindProperty("gestor").objectReferenceValue = gestor;
            sp.FindProperty("boton").objectReferenceValue = boton;
            sp.ApplyModifiedPropertiesWithoutUndo();

            // ---- tablet del mapa en la mano izquierda
            Borrar("Tableta_Mapa");
            var tableta = new GameObject("Tableta_Mapa").AddComponent<TabletaMapa>();
            tableta.transform.SetParent(sistemas.transform, false);
            var st = new SerializedObject(tableta);
            st.FindProperty("materialCuerpo").objectReferenceValue = Mat("M_Tableta", new Color(0.12f, 0.13f, 0.15f), 0.2f, 0.55f);
            st.ApplyModifiedPropertiesWithoutUndo();

            // ---- pantalla del escáner
            foreach (EscanerHerramienta e in Object.FindObjectsByType<EscanerHerramienta>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                if (e.GetComponent<PantallaEscaner>() == null)
                {
                    e.gameObject.AddComponent<PantallaEscaner>();
                }
            }

            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
            Debug.Log("[Artigas1] Fases 3 y 4: 2 actividades, panel con botón físico, tablet del mapa (gatillo izquierdo o T) y pantalla del escáner.");
        }

        internal static BotonFisico CrearBotonPublico(Transform padre, Vector3 posLocal) => CrearBoton(padre, posLocal);

        private static BotonFisico CrearBoton(Transform padre, Vector3 posLocal)
        {
            var go = new GameObject("Boton_Principal");
            go.transform.SetParent(padre, false);
            go.transform.localPosition = posLocal;
            BoxCollider col = go.AddComponent<BoxCollider>();
            col.size = new Vector3(0.09f, 0.06f, 0.05f);

            GameObject baseB = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseB.name = "Base";
            Object.DestroyImmediate(baseB.GetComponent<Collider>());
            baseB.transform.SetParent(go.transform, false);
            baseB.transform.localScale = new Vector3(0.09f, 0.06f, 0.02f);
            baseB.transform.localPosition = new Vector3(0f, 0f, 0.012f);
            baseB.GetComponent<Renderer>().sharedMaterial = Mat("M_Boton_Base", new Color(0.18f, 0.20f, 0.23f), 0.6f, 0.5f);

            GameObject cap = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cap.name = "Capuchon";
            Object.DestroyImmediate(cap.GetComponent<Collider>());
            cap.transform.SetParent(go.transform, false);
            cap.transform.localScale = new Vector3(0.06f, 0.035f, 0.02f);
            cap.transform.localPosition = new Vector3(0f, 0f, -0.008f);
            cap.GetComponent<Renderer>().sharedMaterial = Mat("M_Boton_Capuchon", new Color(0.85f, 0.88f, 0.92f), 0f, 0.35f);

            GameObject led = GameObject.CreatePrimitive(PrimitiveType.Cube);
            led.name = "LED";
            Object.DestroyImmediate(led.GetComponent<Collider>());
            led.transform.SetParent(go.transform, false);
            led.transform.localScale = new Vector3(0.05f, 0.006f, 0.004f);
            led.transform.localPosition = new Vector3(0f, 0.026f, -0.001f);

            go.AddComponent<XRSimpleInteractable>();
            BotonFisico boton = go.AddComponent<BotonFisico>();
            boton.Configurar(cap.transform, led.GetComponent<Renderer>());
            EditorUtility.SetDirty(boton);
            return boton;
        }

        // ------------------------------------------------------------------------------------------------ ayudas
        private static bool AbrirF1()
        {
            if (SceneManager.GetActiveScene().path == ArtigasMenu.EscenaF1)
            {
                return true;
            }
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ArtigasMenu.EscenaF1) == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", "Todavía no existe la escena F1. Corré los pasos 1, 2 y 3.", "OK");
                return false;
            }
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                return false;
            }
            EditorSceneManager.OpenScene(ArtigasMenu.EscenaF1, OpenSceneMode.Single);
            return true;
        }

        private static Material Mat(string nombre, Color color, float metalico, float suavidad)
        {
            if (!AssetDatabase.IsValidFolder(Materiales.TrimEnd('/')))
            {
                AssetDatabase.CreateFolder(Raiz.TrimEnd('/'), "Materiales");
            }
            string ruta = $"{Materiales}{nombre}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            if (m == null)
            {
                m = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                AssetDatabase.CreateAsset(m, ruta);
            }
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Metallic", metalico);
            m.SetFloat("_Smoothness", suavidad);
            EditorUtility.SetDirty(m);
            return m;
        }

        private static void Borrar(string nombre)
        {
            foreach (GameObject go in Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include, FindObjectsSortMode.None)
                         .Where(g => g.name == nombre && g.scene.IsValid()).ToList())
            {
                Object.DestroyImmediate(go);
            }
        }

        private static Bounds Limites(GameObject go)
        {
            Renderer[] rs = go.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0)
            {
                return new Bounds(go.transform.position, Vector3.one);
            }
            Bounds b = rs[0].bounds;
            foreach (Renderer r in rs)
            {
                b.Encapsulate(r.bounds);
            }
            return b;
        }

        private static Vector3 Abs(Vector3 v) => new Vector3(Mathf.Abs(v.x), Mathf.Abs(v.y), Mathf.Abs(v.z));
    }
}

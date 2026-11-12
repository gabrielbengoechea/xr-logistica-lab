using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.XR.Interaction.Toolkit.Interactables;
using UnityEngine.XR.Interaction.Toolkit.Locomotion.Comfort;
using XRLab;
using Object = UnityEngine.Object;

namespace Artigas1.Editor
{
    /// <summary>
    /// Menú Artigas-1: arma materiales, prefabs y la escena de la fase 1 a partir del kit 3D.
    /// Se puede correr de nuevo cuando cambian los modelos: reemplaza lo generado.
    /// </summary>
    public static class ArtigasMenu
    {
        private const string Raiz = "Assets/Artigas1/";
        private const string Prefabs = Raiz + "Prefabs/";
        private const string Escenas = Raiz + "Escenas/";
        public const string EscenaF1 = Escenas + "F1_Rivera.unity";

        // ------------------------------------------------------------------------------------------------ 0
        [MenuItem("Artigas-1/0. Revisar el proyecto", priority = 0)]
        public static void Revisar()
        {
            var faltas = new List<string>();
            if (GraphicsSettings.currentRenderPipeline == null)
            {
                faltas.Add("No hay URP activo. Creá el proyecto con la plantilla VR o Universal 3D de Unity Hub (ver README).");
            }
            if (BuscarRigXri() == null)
            {
                faltas.Add("Falta el prefab «XR Origin (XR Rig)»: Package Manager → XR Interaction Toolkit → Samples → Starter Assets → Import.");
            }
            if (Shader.Find("Universal Render Pipeline/Lit") == null)
            {
                faltas.Add("No se encuentra el shader Universal Render Pipeline/Lit.");
            }
            string msg = faltas.Count == 0
                ? "Todo en orden. Seguí con los pasos 1, 2 y 3 del menú Artigas-1."
                : "Antes de seguir:\n\n• " + string.Join("\n• ", faltas);
            Debug.Log($"[Artigas1] {msg}");
            EditorUtility.DisplayDialog("Artigas-1", msg, "Entendido");
        }

        // ------------------------------------------------------------------------------------------------ 1
        [MenuItem("Artigas-1/1. Crear materiales", priority = 11)]
        public static void CrearMateriales()
        {
            Shader lit = Shader.Find("Universal Render Pipeline/Lit");
            Shader simple = Shader.Find("Universal Render Pipeline/Simple Lit");
            Shader unlit = Shader.Find("Universal Render Pipeline/Unlit");
            if (lit == null || simple == null || unlit == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", "No están los shaders de URP. Revisá el paso 0.", "OK");
                return;
            }
            Carpeta("Materiales");

            Material paleta = Mat("M_Artigas_Paleta", lit);
            paleta.SetTexture("_BaseMap", Tex("T_Artigas_Paleta_BaseColor"));
            paleta.SetColor("_BaseColor", Color.white);
            paleta.SetTexture("_MetallicGlossMap", Tex("T_Artigas_Paleta_MetallicSmoothness"));
            paleta.EnableKeyword("_METALLICSPECGLOSSMAP");
            paleta.SetFloat("_SmoothnessTextureChannel", 0f);
            paleta.SetFloat("_Smoothness", 1f);
            Emision(paleta, Tex("T_Artigas_Paleta_Emision"), 1.5f);

            foreach ((string mat, string tex) in new[]
            {
                ("M_Artigas_Senaletica", "T_Artigas_Senaletica"),
                ("M_Artigas_Senaletica_Colonia", "T_Artigas_Senaletica_Colonia"),
                ("M_Artigas_Senaletica_Nodo", "T_Artigas_Nodo"),
                ("M_Artigas_Senaletica_Cupula", "T_Artigas_Cupula"),
                ("M_Artigas_Senaletica_Tacuarembo", "T_Artigas_Tacuarembo"),
            })
            {
                Material m = Mat(mat, simple);
                m.SetTexture("_BaseMap", Tex(tex));
                m.SetColor("_BaseColor", Color.white);
            }
            foreach ((string mat, string tex) in new[]
            {
                ("M_Artigas_Pantallas", "T_Artigas_Senaletica_Colonia"),
                ("M_Artigas_Pantallas_Nodo", "T_Artigas_Nodo"),
                ("M_Artigas_Pantallas_Cupula", "T_Artigas_Cupula"),
                ("M_Artigas_Pantallas_Tacuarembo", "T_Artigas_Tacuarembo"),
            })
            {
                Material m = Mat(mat, unlit);
                m.SetTexture("_BaseMap", Tex(tex));
                m.SetColor("_BaseColor", Color.white);
            }
            Material vidrio = Mat("M_Artigas_Vidrio", lit);
            vidrio.SetColor("_BaseColor", new Color(0.7f, 0.85f, 0.95f, 0.10f));
            vidrio.SetFloat("_Smoothness", 0.95f);
            Transparente(vidrio);
            Material tierra = Mat("M_Tierra", simple);
            tierra.SetTexture("_BaseMap", Tex("T_Tierra_4K"));
            tierra.SetColor("_BaseColor", Color.white);
            Material detalle = Mat("M_Tierra_Detalle", simple);
            detalle.SetTexture("_BaseMap", Tex("T_Tierra_Detalle_Uruguay"));
            detalle.SetColor("_BaseColor", Color.white);
            Transparente(detalle);

            AssetDatabase.SaveAssets();
            // reimporta los modelos para que el importador use los materiales nuevos
            AssetDatabase.ImportAsset(ArtigasImportador.Modelos.TrimEnd('/'), ImportAssetOptions.ImportRecursive | ImportAssetOptions.ForceUpdate);
            Debug.Log("[Artigas1] Materiales creados y modelos reimportados.");
        }

        private static Material Mat(string nombre, Shader shader)
        {
            string ruta = $"{ArtigasImportador.Materiales}{nombre}.mat";
            Material m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            if (m == null)
            {
                m = new Material(shader) { name = nombre };
                AssetDatabase.CreateAsset(m, ruta);
            }
            else
            {
                m.shader = shader;
            }
            m.enableInstancing = true;
            EditorUtility.SetDirty(m);
            return m;
        }

        private static Texture2D Tex(string nombre)
        {
            Texture2D t = AssetDatabase.LoadAssetAtPath<Texture2D>($"{ArtigasImportador.Texturas}{nombre}.png");
            if (t == null)
            {
                Debug.LogWarning($"[Artigas1] Falta la textura {nombre}.png en {ArtigasImportador.Texturas}");
            }
            return t;
        }

        private static void Emision(Material m, Texture2D mapa, float intensidad)
        {
            m.SetTexture("_EmissionMap", mapa);
            m.SetColor("_EmissionColor", Color.white * intensidad);
            m.EnableKeyword("_EMISSION");
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.BakedEmissive;
        }

        private static void Transparente(Material m)
        {
            m.SetFloat("_Surface", 1f);
            m.SetFloat("_Blend", 0f);
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_ZWrite", 0f);
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            m.renderQueue = (int)RenderQueue.Transparent;
        }

        // ------------------------------------------------------------------------------------------------ 2
        [MenuItem("Artigas-1/2. Crear prefabs", priority = 12)]
        public static void CrearPrefabs()
        {
            Carpeta("Prefabs");
            var cargas = new (string modelo, string prefab, CargoSpec spec)[]
            {
                ("Props/SM_BTC_1", "P_BTC_1", new CargoSpec { codigo = "BTC1-0000", categoria = CategoriaCarga.Alimentos, talla = TallaCarga.Btc1, masaKg = 8f }),
                ("Props/SM_BTC_2", "P_BTC_2", new CargoSpec { codigo = "BTC2-0000", categoria = CategoriaCarga.Repuestos, talla = TallaCarga.Btc2, masaKg = 22f }),
                ("Props/SM_BTC_1_Danada", "P_BTC_1_Danada", new CargoSpec { codigo = "BTC1-0000", categoria = CategoriaCarga.Alimentos, talla = TallaCarga.Btc1, masaKg = 8f, danada = true }),
                ("Props/SM_BTC_1_SinEtiqueta", "P_BTC_1_SinEtiqueta", new CargoSpec { codigo = "BTC1-0000", categoria = CategoriaCarga.Higiene, talla = TallaCarga.Btc1, masaKg = 7f, etiquetaLegible = false }),
                ("Props/SM_Contenedor_Rigido", "P_Contenedor_Rigido", new CargoSpec { codigo = "CR-0000", categoria = CategoriaCarga.Experimento, talla = TallaCarga.Rigido, masaKg = 45f }),
            };
            int n = 0;
            foreach ((string modelo, string prefab, CargoSpec spec) in cargas)
            {
                GameObject go = Instanciar(modelo);
                if (go == null)
                {
                    continue;
                }
                AjustarColliderCaja(go);
                go.AddComponent<Rigidbody>();
                go.AddComponent<XRGrabInteractable>();
                CargoUnit cu = go.AddComponent<CargoUnit>();
                cu.Configurar(spec, true, Buscar(go.transform, "ETIQUETA_"));
                Guardar(go, prefab);
                n++;
            }
            foreach ((string modelo, string prefab) in new[] { ("Props/SM_Baranda_050", "P_Baranda_050"), ("Props/SM_Baranda_100", "P_Baranda_100") })
            {
                GameObject go = Instanciar(modelo);
                if (go == null)
                {
                    continue;
                }
                AjustarColliderCaja(go);
                go.AddComponent<XRSimpleInteractable>();
                go.AddComponent<Agarradera>();
                Guardar(go, prefab);
                n++;
            }
            GameObject esc = Instanciar("Props/SM_Escaner");
            if (esc != null)
            {
                AjustarColliderCaja(esc);
                Rigidbody rb = esc.AddComponent<Rigidbody>();
                rb.useGravity = false;
                rb.mass = 0.6f;
                rb.linearDamping = 0.05f;
                rb.angularDamping = 0.1f;
                esc.AddComponent<XRGrabInteractable>();
                EscanerHerramienta eh = esc.AddComponent<EscanerHerramienta>();
                Transform rayo = Buscar(esc.transform, "RAYO_");
                eh.Configurar(rayo, EjeDelEscaner(esc, rayo));
                LineRenderer lr = esc.AddComponent<LineRenderer>();
                lr.widthMultiplier = 0.004f;
                lr.positionCount = 2;
                lr.useWorldSpace = true;
                lr.sharedMaterial = AssetDatabase.LoadAssetAtPath<Material>($"{ArtigasImportador.Materiales}M_Artigas_Pantallas.mat");
                lr.startColor = lr.endColor = new Color(1f, 0.1f, 0.1f);
                lr.enabled = false;
                AudioSource au = esc.AddComponent<AudioSource>();
                au.playOnAwake = false;
                au.spatialBlend = 1f;
                var so = new SerializedObject(eh);
                so.FindProperty("laser").objectReferenceValue = lr;
                so.FindProperty("audioFuente").objectReferenceValue = au;
                so.ApplyModifiedPropertiesWithoutUndo();
                Guardar(esc, "P_Escaner");
                n++;
            }
            GameObject led = Instanciar("Props/SM_Indicador_Hueco");
            GameObject ledPrefab = led != null ? Guardar(led, "P_Indicador_Hueco") : null;

            GameObject rack = Instanciar("Modulo_Rivera/SM_Rack_Almacen");
            if (rack != null)
            {
                MeshFilter mf = rack.GetComponentInChildren<MeshFilter>();
                mf.gameObject.AddComponent<MeshCollider>().sharedMesh = mf.sharedMesh;
                foreach (Transform snap in Todos(rack.transform).Where(t => t.name.StartsWith("SNAP_")).ToList())
                {
                    BoxCollider bc = snap.gameObject.AddComponent<BoxCollider>();
                    bc.isTrigger = true;
                    bc.size = new Vector3(0.45f, 0.40f, 0.42f);
                    RackSlot slot = snap.gameObject.AddComponent<RackSlot>();
                    Renderer r = null;
                    Transform ind = Buscar(rack.transform, "INDICADOR_" + snap.name.Substring(5));
                    if (ind != null && ledPrefab != null)
                    {
                        var l = (GameObject)PrefabUtility.InstantiatePrefab(ledPrefab, ind);
                        l.transform.localPosition = Vector3.zero;
                        l.transform.localRotation = Quaternion.identity;
                        r = l.GetComponentInChildren<Renderer>();
                    }
                    slot.Configurar(new SlotSpec { codigo = snap.name.Substring(5) }, r, false);
                }
                Guardar(rack, "P_Rack_Almacen");
                n++;
            }
            AssetDatabase.SaveAssets();
            Debug.Log($"[Artigas1] {n} prefabs creados en {Prefabs}");
        }

        /// <summary>Eje del rayo en coordenadas del escáner: el eje principal de (lente − centro de la malla).</summary>
        private static Vector3 EjeDelEscaner(GameObject esc, Transform rayo)
        {
            MeshFilter mf = esc.GetComponentInChildren<MeshFilter>();
            if (rayo == null || mf == null)
            {
                return Vector3.forward;
            }
            Vector3 centro = esc.transform.InverseTransformPoint(mf.transform.TransformPoint(mf.sharedMesh.bounds.center));
            Vector3 d = esc.transform.InverseTransformPoint(rayo.position) - centro;
            Vector3 a = new Vector3(Mathf.Abs(d.x), Mathf.Abs(d.y), Mathf.Abs(d.z));
            if (a.x >= a.y && a.x >= a.z)
            {
                return new Vector3(Mathf.Sign(d.x), 0f, 0f);
            }
            return a.y >= a.z ? new Vector3(0f, Mathf.Sign(d.y), 0f) : new Vector3(0f, 0f, Mathf.Sign(d.z));
        }

        // ------------------------------------------------------------------------------------------------ 3
        [MenuItem("Artigas-1/3. Armar escena F1 (Módulo Rivera)", priority = 13)]
        public static void ArmarEscenaF1()
        {
            GameObject rigPrefab = BuscarRigXri();
            GameObject rackP = Prefab("P_Rack_Almacen");
            if (rigPrefab == null || rackP == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", "Faltan el rig de XR Interaction Toolkit o los prefabs. Corré los pasos 0, 1 y 2.", "OK");
                return;
            }
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                return;
            }
            Scene escena = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Mundo 0G").AddComponent<ZeroGWorld>();
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.50f, 0.52f, 0.56f);

            // ---- módulo
            var layout = (GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>($"{ArtigasImportador.Modelos}Layout/Layout_Modulo_Rivera.fbx"));
            layout.name = "Modulo_Rivera";
            PrefabUtility.UnpackPrefabInstance(layout, PrefabUnpackMode.OutermostRoot, InteractionMode.AutomatedAction);
            var slots = new List<RackSlot>();
            foreach (Transform hijo in layout.transform.Cast<Transform>().ToList())
            {
                if (hijo.name.StartsWith("Rack_"))
                {
                    GameObject rk = Reemplazar(hijo, rackP);
                    string rackId = hijo.name.Substring(5);
                    foreach (RackSlot s in rk.GetComponentsInChildren<RackSlot>())
                    {
                        s.Configurar(new SlotSpec { codigo = $"{rackId}-{s.Codigo}" }, s.Indicador, false);
                        Marcar(s);
                        slots.Add(s);
                    }
                    Estatico(rk);
                    Object.DestroyImmediate(hijo.gameObject);
                }
                else if (hijo.name.StartsWith("Baranda_"))
                {
                    MeshFilter mf = hijo.GetComponentInChildren<MeshFilter>();
                    bool corta = mf != null && mf.sharedMesh != null && mf.sharedMesh.name.Contains("050");
                    GameObject b = Reemplazar(hijo, Prefab(corta ? "P_Baranda_050" : "P_Baranda_100"));
                    Estatico(b);
                    Object.DestroyImmediate(hijo.gameObject);
                }
                else
                {
                    if (hijo.name.StartsWith("Casco") || hijo.name.StartsWith("Escotilla"))
                    {
                        foreach (MeshFilter mf in hijo.GetComponentsInChildren<MeshFilter>())
                        {
                            mf.gameObject.AddComponent<MeshCollider>().sharedMesh = mf.sharedMesh;
                        }
                    }
                    Estatico(hijo.gameObject);
                }
            }
            Bounds caja = Limites(layout);
            bool ejeX = caja.size.x > caja.size.z;
            Vector3 eje = ejeX ? Vector3.right : Vector3.forward;
            float largo = ejeX ? caja.extents.x : caja.extents.z;
            Vector3 inicio = caja.center - eje * (largo * 0.55f);

            // ---- carga: bolsas en los racks y tres cargas flotando para practicar
            var rnd = new System.Random(7);
            var cats = new[] { CategoriaCarga.Alimentos, CategoriaCarga.Repuestos, CategoriaCarga.Higiene, CategoriaCarga.Medico, CategoriaCarga.Experimento };
            int codigo = 1;
            var cargasRaiz = new GameObject("Carga").transform;
            foreach (RackSlot s in slots)
            {
                if (rnd.NextDouble() > 0.35)
                {
                    continue;
                }
                bool grande = rnd.NextDouble() < 0.3;
                CargoUnit c = NuevaCarga(grande ? "P_BTC_2" : "P_BTC_1", cargasRaiz, new CargoSpec
                {
                    codigo = $"{(grande ? "BTC2" : "BTC1")}-{codigo++:0000}",
                    categoria = cats[rnd.Next(cats.Length)],
                    talla = grande ? TallaCarga.Btc2 : TallaCarga.Btc1,
                    masaKg = grande ? 18f + (float)rnd.NextDouble() * 8f : 4f + (float)rnd.NextDouble() * 6f,
                });
                s.ColocarInmediato(c);
                Marcar(s);
                Marcar(c.transform);
                Marcar(c.GetComponent<Rigidbody>());
            }
            Vector3 lado = Vector3.Cross(Vector3.up, eje);
            var flotantes = new (string prefab, CargoSpec spec, Vector3 pos)[]
            {
                ("P_BTC_1", new CargoSpec { codigo = $"BTC1-{codigo++:0000}", categoria = CategoriaCarga.Alimentos, talla = TallaCarga.Btc1, masaKg = 8f }, inicio + eje * 1.0f + lado * 0.3f),
                ("P_BTC_2", new CargoSpec { codigo = $"BTC2-{codigo++:0000}", categoria = CategoriaCarga.Repuestos, talla = TallaCarga.Btc2, masaKg = 35f }, inicio + eje * 1.8f - lado * 0.3f + Vector3.up * 0.2f),
                ("P_Contenedor_Rigido", new CargoSpec { codigo = $"CR-{codigo++:0000}", categoria = CategoriaCarga.Experimento, talla = TallaCarga.Rigido, masaKg = 45f }, inicio + eje * 2.6f - Vector3.up * 0.3f),
            };
            foreach ((string prefab, CargoSpec spec, Vector3 pos) in flotantes)
            {
                CargoUnit c = NuevaCarga(prefab, cargasRaiz, spec);
                c.transform.SetPositionAndRotation(pos, Quaternion.Euler(10f, 25f, 5f));
                Marcar(c.transform);
            }
            var escaner = (GameObject)PrefabUtility.InstantiatePrefab(Prefab("P_Escaner"));
            escaner.transform.SetPositionAndRotation(inicio + eje * 0.5f + lado * 0.25f + Vector3.up * 0.1f, Quaternion.LookRotation(eje));
            Marcar(escaner.transform);

            // ---- luces (en tiempo real para la F1; en la F3 se hornean)
            for (int i = -1; i <= 1; i++)
            {
                var l = new GameObject($"Luz_{i + 2}").AddComponent<Light>();
                l.type = LightType.Point;
                l.range = 3.5f;
                l.intensity = 1.6f;
                l.color = new Color(1f, 0.97f, 0.92f);
                l.shadows = LightShadows.None;
                l.transform.position = caja.center + eje * (largo * 0.6f * i) + Vector3.up * 0.6f;
            }

            // ---- rig
            var rig = (GameObject)PrefabUtility.InstantiatePrefab(rigPrefab);
            rig.transform.SetPositionAndRotation(new Vector3(inicio.x, caja.center.y - 1.45f, inicio.z), Quaternion.LookRotation(eje));
            Marcar(rig.transform);
            AjustarRig(rig);

            // ---- sistemas
            var sistemas = new GameObject("Sistemas");
            sistemas.AddComponent<InventoryService>();
            sistemas.AddComponent<MedidorRendimiento>();
            TelemetryLogger tel = sistemas.AddComponent<TelemetryLogger>();
            var st = new SerializedObject(tel);
            Poner(st, "scenario", "artigas1-f1-rivera");
            PonerInt(st, "partsTotal", flotantes.Length);
            PonerEnum(st, "interaction", 1); // Controllers
            st.ApplyModifiedPropertiesWithoutUndo();

            System.IO.Directory.CreateDirectory(Escenas);
            EditorSceneManager.SaveScene(escena, EscenaF1);
            var lista = EditorBuildSettings.scenes.Where(s => s.path != EscenaF1).ToList();
            lista.Insert(0, new EditorBuildSettingsScene(EscenaF1, true));
            EditorBuildSettings.scenes = lista.ToArray();
            Debug.Log($"[Artigas1] Escena {EscenaF1}: {slots.Count} huecos, {codigo - 1} cargas, rig en {rig.transform.position}.");
        }

        /// <summary>Saca la locomoción con gravedad del rig de XRI y le pone la de 0G, la viñeta y los botones de prueba.</summary>
        private static void AjustarRig(GameObject rig)
        {
            var apagar = new HashSet<string>
            {
                "ContinuousMoveProvider", "DynamicMoveProvider", "TeleportationProvider", "ClimbProvider",
                "GrabMoveProvider", "TwoHandedGrabMoveProvider", "GravityProvider", "ContinuousTurnProvider",
                "ClimbTeleportInteractor", "TeleportationAnchor", "TeleportationArea",
            };
            foreach (MonoBehaviour mb in rig.GetComponentsInChildren<MonoBehaviour>(true))
            {
                if (mb == null)
                {
                    continue;
                }
                string tipo = mb.GetType().Name;
                if (apagar.Contains(tipo))
                {
                    mb.enabled = false;
                    Marcar(mb);
                }
                else if (tipo == "SnapTurnProvider")
                {
                    var so = new SerializedObject(mb);
                    SerializedProperty p = so.FindProperty("m_TurnAmount");
                    if (p != null)
                    {
                        p.floatValue = 30f;
                        so.ApplyModifiedPropertiesWithoutUndo();
                    }
                }
            }
            Camera cam = rig.GetComponentInChildren<Camera>(true);
            if (cam != null)
            {
                cam.nearClipPlane = 0.03f;
                cam.farClipPlane = 60f;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = Color.black;
                Marcar(cam);
            }
            ZeroGLocomotion loco = rig.AddComponent<ZeroGLocomotion>();
            var sl = new SerializedObject(loco);
            sl.FindProperty("rig").objectReferenceValue = rig.transform;
            sl.FindProperty("cabeza").objectReferenceValue = cam != null ? cam.transform : null;
            sl.ApplyModifiedPropertiesWithoutUndo();
            ConfortVineta vin = rig.AddComponent<ConfortVineta>();
            var sv = new SerializedObject(vin);
            sv.FindProperty("controlador").objectReferenceValue = rig.GetComponentInChildren<TunnelingVignetteController>(true);
            sv.FindProperty("locomocion").objectReferenceValue = loco;
            sv.ApplyModifiedPropertiesWithoutUndo();
            if (rig.GetComponentInChildren<TunnelingVignetteController>(true) == null)
            {
                Debug.LogWarning("[Artigas1] El rig no tiene TunnelingVignetteController: la viñeta no va a funcionar. Agregá el prefab «TunnelingVignette» de los Starter Assets debajo de la cámara.");
            }
            rig.AddComponent<ControlesBeta>();
        }

        // ------------------------------------------------------------------------------------------------ ayudas
        private static void Carpeta(string nombre)
        {
            if (!AssetDatabase.IsValidFolder(Raiz + nombre))
            {
                AssetDatabase.CreateFolder(Raiz.TrimEnd('/'), nombre);
            }
        }

        private static GameObject BuscarRigXri()
        {
            foreach (string guid in AssetDatabase.FindAssets("\"XR Origin (XR Rig)\" t:Prefab"))
            {
                string ruta = AssetDatabase.GUIDToAssetPath(guid);
                if (ruta.Contains("Starter Assets"))
                {
                    return AssetDatabase.LoadAssetAtPath<GameObject>(ruta);
                }
            }
            return null;
        }

        private static GameObject Instanciar(string modelo)
        {
            var m = AssetDatabase.LoadAssetAtPath<GameObject>($"{ArtigasImportador.Modelos}{modelo}.fbx");
            if (m == null)
            {
                Debug.LogWarning($"[Artigas1] No está el modelo {modelo}.fbx");
                return null;
            }
            return (GameObject)PrefabUtility.InstantiatePrefab(m);
        }

        private static GameObject Guardar(GameObject instancia, string nombre)
        {
            GameObject p = PrefabUtility.SaveAsPrefabAsset(instancia, $"{Prefabs}{nombre}.prefab");
            Object.DestroyImmediate(instancia);
            return p;
        }

        private static GameObject Prefab(string nombre) => AssetDatabase.LoadAssetAtPath<GameObject>($"{Prefabs}{nombre}.prefab");

        private static CargoUnit NuevaCarga(string prefab, Transform padre, CargoSpec spec)
        {
            var go = (GameObject)PrefabUtility.InstantiatePrefab(Prefab(prefab), padre);
            CargoUnit c = go.GetComponent<CargoUnit>();
            c.Configurar(spec, true, Buscar(go.transform, "ETIQUETA_"));
            go.name = spec.codigo;
            Marcar(c);
            Marcar(go.GetComponent<Rigidbody>());
            Marcar(go.GetComponent<XRGrabInteractable>());
            return c;
        }

        private static GameObject Reemplazar(Transform viejo, GameObject prefab)
        {
            var nuevo = (GameObject)PrefabUtility.InstantiatePrefab(prefab, viejo.parent);
            nuevo.name = viejo.name;
            nuevo.transform.localPosition = viejo.localPosition;
            nuevo.transform.localRotation = viejo.localRotation;
            nuevo.transform.localScale = viejo.localScale;
            Marcar(nuevo.transform);
            return nuevo;
        }

        private static void AjustarColliderCaja(GameObject go)
        {
            foreach (MeshFilter mf in go.GetComponentsInChildren<MeshFilter>())
            {
                if (mf.sharedMesh == null)
                {
                    continue;
                }
                BoxCollider bc = mf.gameObject.AddComponent<BoxCollider>();
                bc.center = mf.sharedMesh.bounds.center;
                bc.size = mf.sharedMesh.bounds.size;
            }
        }

        private static void Estatico(GameObject go)
        {
            foreach (Transform t in Todos(go.transform))
            {
                if (t.GetComponent<Rigidbody>() == null && t.GetComponent<RackSlot>() == null)
                {
                    GameObjectUtility.SetStaticEditorFlags(t.gameObject,
                        StaticEditorFlags.BatchingStatic | StaticEditorFlags.ContributeGI |
                        StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic);
                }
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

        private static IEnumerable<Transform> Todos(Transform t)
        {
            yield return t;
            foreach (Transform h in t)
            {
                foreach (Transform x in Todos(h))
                {
                    yield return x;
                }
            }
        }

        private static Transform Buscar(Transform t, string prefijo) => Todos(t).FirstOrDefault(x => x.name.StartsWith(prefijo, StringComparison.Ordinal));

        private static void Marcar(Object o)
        {
            if (o == null)
            {
                return;
            }
            EditorUtility.SetDirty(o);
            if (PrefabUtility.IsPartOfPrefabInstance(o))
            {
                PrefabUtility.RecordPrefabInstancePropertyModifications(o);
            }
        }

        private static void Poner(SerializedObject so, string campo, string valor)
        {
            SerializedProperty p = so.FindProperty(campo);
            if (p != null)
            {
                p.stringValue = valor;
            }
        }

        private static void PonerInt(SerializedObject so, string campo, int valor)
        {
            SerializedProperty p = so.FindProperty(campo);
            if (p != null)
            {
                p.intValue = valor;
            }
        }

        private static void PonerEnum(SerializedObject so, string campo, int indice)
        {
            SerializedProperty p = so.FindProperty(campo);
            if (p != null)
            {
                p.enumValueIndex = indice;
            }
        }
    }
}

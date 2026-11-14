using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Events;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace Artigas1.Editor
{
    /// <summary>
    /// Fase 5: escena exterior de la estación para la caminata espacial (EVA). Arma el casco exterior con manta
    /// térmica, aros, alas solares con celdas, radiadores, antena, pasamanos (las mismas barandas de la fase 1, así
    /// que la locomoción es la que ya funciona), cable de seguridad, la Tierra con día, noche y atmósfera, y una
    /// actividad de inspección. También agrega en el Módulo Rivera el botón para salir a la caminata.
    /// </summary>
    public static class ArtigasExterior
    {
        private const string Raiz = "Assets/Artigas1/";
        private const string Generado = Raiz + "Generado/";
        public const string EscenaEva = Raiz + "Escenas/F5_Exterior.unity";

        // tramos de la estación sobre su eje (kit 3D v0.5): inicio, fin y radio del casco, el mismo que usa el
        // exterior web (exterior.js, CASCOS), que envuelve la geometría interior medida
        private static readonly (string nombre, float z0, float z1, float r)[] Tramos =
        {
            ("Tacuarembo", -6.86f, -3.56f, 2.10f),
            ("Nodo", -3.56f, -0.66f, 1.76f),
            ("Rivera", -0.66f, 4.90f, 2.10f),
            ("Colonia", 4.90f, 8.72f, 1.72f),
            ("Carguero", 8.72f, 11.62f, 2.04f),
        };
        private static readonly float[] Aros = { -3.57f, -0.71f, 4.85f, 8.71f };
        private const float ZCupula = -2.11f;
        private const float ZEsclusa = 0.6f;

        [MenuItem("Artigas-1/6. Exterior y caminata espacial (fase 5)", priority = 16)]
        public static void ArmarExterior()
        {
            GameObject rigPrefab = ArtigasMenu.BuscarRigXri();
            GameObject baranda = ArtigasMenu.Prefab("P_Baranda_100");
            if (rigPrefab == null || baranda == null || AssetDatabase.LoadAssetAtPath<SceneAsset>(ArtigasMenu.EscenaF1) == null)
            {
                EditorUtility.DisplayDialog("Artigas-1", "Corré antes los pasos 1, 2 y 3 (prefabs y escena F1).", "OK");
                return;
            }
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                return;
            }
            Carpeta(Generado.TrimEnd('/'));
            Carpeta(Generado + "Mallas");
            Carpeta(Generado + "Texturas");
            Carpeta(Generado + "Materiales");

            // ---- medidas reales de la estación a partir del layout completo del kit
            (float ejeY, float signo) = MedirEstacion();
            float radio = RadioEn(ZEsclusa);

            Material manta = Mat("M_Ext_Manta", Textura("T_Ext_Manta", PintarManta), new Color(0.93f, 0.93f, 0.90f), 0f, 0.18f, new Vector2(1f, 1f));
            Material aro = Mat("M_Ext_Aro", null, new Color(0.62f, 0.64f, 0.67f), 0.85f, 0.55f, Vector2.one);
            Material celdas = Mat("M_Ext_Celdas", Textura("T_Ext_Celdas", PintarCeldas), Color.white, 0.35f, 0.78f, new Vector2(18f, 5f));
            Material marco = Mat("M_Ext_Marco", null, new Color(0.78f, 0.80f, 0.82f), 0.7f, 0.45f, Vector2.one);
            Material oro = Mat("M_Ext_Oro", null, new Color(1.00f, 0.76f, 0.33f), 1f, 0.62f, Vector2.one);
            Material radiador = Mat("M_Ext_Radiador", null, new Color(0.95f, 0.96f, 0.97f), 0f, 0.30f, Vector2.one);
            Material vidrio = Mat("M_Ext_Vidrio", null, new Color(0.04f, 0.07f, 0.10f), 0.2f, 0.95f, Vector2.one);
            Material antena = Mat("M_Ext_Antena", null, new Color(0.90f, 0.91f, 0.92f), 0.1f, 0.4f, Vector2.one);

            Scene escena = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("Mundo 0G").AddComponent<ZeroGWorld>();

            // ---- sol bajo (amanecer orbital): el terminador pasa cerca de Uruguay y se ven las luces urbanas
            var sol = new GameObject("Sol").AddComponent<Light>();
            sol.type = LightType.Directional;
            sol.color = new Color(1.00f, 0.97f, 0.92f);
            sol.intensity = 1.4f;
            sol.shadows = LightShadows.None;
            Vector3 haciaSol = new Vector3(1f, 0.15f, 0.3f).normalized;
            sol.transform.rotation = Quaternion.LookRotation(-haciaSol);
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.06f, 0.07f, 0.10f);
            RenderSettings.ambientEquatorColor = new Color(0.14f, 0.18f, 0.26f);
            RenderSettings.ambientGroundColor = new Color(0.20f, 0.30f, 0.45f);
            RenderSettings.skybox = Cielo();
            RenderSettings.sun = sol;

            // ---- la Tierra con el material día/noche
            ArmarTierra(sol);

            // ---- casco exterior
            Transform ext = new GameObject("Exterior_Estacion").transform;
            foreach ((string nombre, float z0, float z1, float rt) in Tramos)
            {
                float radioTramo = rt;
                float a = Mathf.Min(z0, z1) * signo;
                float b = Mathf.Max(z0, z1) * signo;
                GameObject casco = Malla($"Casco_{nombre}", Cilindro($"Casco_{nombre}", radioTramo, Mathf.Min(a, b), Mathf.Max(a, b), 28, nombre == "Tacuarembo", nombre == "Carguero", 1.2f), manta, ext);
                casco.transform.position = new Vector3(0f, ejeY, 0f);
                CapsuleCollider cap = casco.AddComponent<CapsuleCollider>();
                cap.direction = 2;
                cap.radius = radioTramo;
                // la cápsula no sobresale del tramo: su largo total es el del módulo
                cap.height = Mathf.Max(Mathf.Abs(b - a), 2f * radioTramo);
                cap.center = new Vector3(0f, 0f, (a + b) * 0.5f);
            }
            foreach (float z in Aros)
            {
                GameObject ar = Malla($"Aro_{z:0.00}", Cilindro($"Aro_{z:0.00}", Mathf.Max(RadioEn(z - 0.1f), RadioEn(z + 0.1f)) + 0.06f, z * signo - 0.08f, z * signo + 0.08f, 28, false, false, 1f), aro, ext);
                ar.transform.position = new Vector3(0f, ejeY, 0f);
            }

            // ---- Cúpula Faro: torre octogonal debajo del Nodo con ventana oscura
            float radioNodo = RadioEn(ZCupula);
            Vector3 baseCupula = new Vector3(0f, ejeY - radioNodo, ZCupula * signo);
            Primitiva("Cupula_Torre", PrimitiveType.Cylinder, baseCupula + Vector3.down * 0.35f, Quaternion.identity, new Vector3(1.5f, 0.35f, 1.5f), manta, ext);
            Primitiva("Cupula_Ventana", PrimitiveType.Cylinder, baseCupula + Vector3.down * 0.72f, Quaternion.identity, new Vector3(1.1f, 0.02f, 1.1f), vidrio, ext);

            // ---- esclusa sobre el Módulo Rivera
            Vector3 esclusa = new Vector3(0f, ejeY + radio, ZEsclusa * signo);
            Primitiva("Esclusa_Marco", PrimitiveType.Cylinder, esclusa + Vector3.up * 0.03f, Quaternion.identity, new Vector3(1.0f, 0.03f, 1.0f), oro, ext);
            Primitiva("Esclusa_Tapa", PrimitiveType.Cylinder, esclusa + Vector3.up * 0.06f, Quaternion.identity, new Vector3(0.8f, 0.02f, 0.8f), aro, ext);
            var ancla = new GameObject("Ancla_Tether").transform;
            ancla.SetParent(ext, false);
            ancla.position = esclusa + new Vector3(0.45f, 0.08f, 0f);
            Primitiva("Ancla_Anillo", PrimitiveType.Sphere, ancla.position, Quaternion.identity, Vector3.one * 0.06f, oro, ext);

            // ---- mástil y alas solares sobre el Nodo
            Vector3 pieMastil = new Vector3(0f, ejeY + radioNodo, ZCupula * signo);
            float altoMastil = 1.6f;
            Primitiva("Mastil", PrimitiveType.Cylinder, pieMastil + Vector3.up * (altoMastil * 0.5f), Quaternion.identity, new Vector3(0.16f, altoMastil * 0.5f, 0.16f), marco, ext);
            Vector3 viga = pieMastil + Vector3.up * altoMastil;
            Primitiva("Viga_Transversal", PrimitiveType.Cube, viga, Quaternion.identity, new Vector3(3.0f, 0.22f, 0.22f), marco, ext);
            Transform objetivo = null;
            foreach (int lado in new[] { -1, 1 })
            {
                Vector3 junta = viga + Vector3.right * (lado * 1.55f);
                Primitiva($"Junta_{(lado < 0 ? "Babor" : "Estribor")}", PrimitiveType.Cylinder, junta, Quaternion.Euler(0f, 0f, 90f), new Vector3(0.34f, 0.1f, 0.34f), oro, ext);
                var pivote = new GameObject($"Ala_Solar_{(lado < 0 ? "Babor" : "Estribor")}").transform;
                pivote.SetParent(ext, false);
                pivote.position = junta + Vector3.right * (lado * 0.1f);
                float largoAla = 8f;
                float anchoAla = 2.2f;
                Primitiva("Manta_Celdas", PrimitiveType.Cube, pivote.position + Vector3.right * (lado * (largoAla * 0.5f + 0.15f)), Quaternion.identity, new Vector3(largoAla, 0.02f, anchoAla), celdas, pivote, false);
                Primitiva("Larguero_Central", PrimitiveType.Cube, pivote.position + Vector3.right * (lado * (largoAla * 0.5f + 0.15f)) + Vector3.up * 0.03f, Quaternion.identity, new Vector3(largoAla + 0.3f, 0.05f, 0.06f), marco, pivote, false);
                Primitiva("Caja_Punta", PrimitiveType.Cube, pivote.position + Vector3.right * (lado * (largoAla + 0.35f)), Quaternion.identity, new Vector3(0.18f, 0.1f, anchoAla + 0.1f), marco, pivote, false);
                Primitiva("Caja_Pie", PrimitiveType.Cube, pivote.position + Vector3.right * (lado * 0.1f), Quaternion.identity, new Vector3(0.18f, 0.12f, anchoAla + 0.1f), marco, pivote, false);
                pivote.gameObject.AddComponent<RotacionLenta>().Configurar(Vector3.right, 10f, 90f, 0f);
                if (lado > 0)
                {
                    objetivo = new GameObject("Objetivo_Inspeccion").transform;
                    objetivo.SetParent(ext, false);
                    objetivo.position = junta + Vector3.up * 0.25f;
                }
            }

            // ---- radiadores de Tacuarembó, a los dos lados
            float zRad = (Tramos[0].z0 + Tramos[0].z1) * 0.5f * signo;
            foreach (int lado in new[] { -1, 1 })
            {
                Vector3 brazo = new Vector3(lado * (Tramos[0].r + 0.25f), ejeY, zRad);
                Primitiva($"Radiador_Brazo_{lado}", PrimitiveType.Cube, brazo, Quaternion.identity, new Vector3(0.5f, 0.08f, 0.08f), marco, ext);
                Primitiva($"Radiador_{lado}", PrimitiveType.Cube, brazo + new Vector3(lado * 0.9f, 0f, 0f), Quaternion.Euler(0f, 0f, lado * 15f), new Vector3(1.3f, 0.03f, 2.6f), radiador, ext);
            }

            // ---- antena de comunicaciones sobre Colonia: barre el cielo despacio
            Vector3 pieAntena = new Vector3(0f, ejeY + Tramos[3].r, (Tramos[3].z0 + 1.0f) * signo);
            Primitiva("Antena_Mastil", PrimitiveType.Cylinder, pieAntena + Vector3.up * 0.3f, Quaternion.identity, new Vector3(0.08f, 0.3f, 0.08f), marco, ext);
            var cabeza = new GameObject("Antena_Cabeza").transform;
            cabeza.SetParent(ext, false);
            cabeza.position = pieAntena + Vector3.up * 0.62f;
            GameObject plato = Malla("Antena_Plato", Plato("Antena_Plato", 0.45f, 0.12f, 20), antena, cabeza, false);
            plato.transform.localPosition = Vector3.zero;
            plato.transform.localRotation = Quaternion.Euler(-55f, 0f, 0f);
            Primitiva("Antena_Alimentador", PrimitiveType.Cylinder, cabeza.position + plato.transform.up * 0.22f, plato.transform.rotation, new Vector3(0.03f, 0.12f, 0.03f), marco, cabeza, false);
            cabeza.gameObject.AddComponent<RotacionLenta>().Configurar(Vector3.up, 0f, 1f, 3f);

            // ---- pasamanos: de la esclusa al Nodo por el lomo, subida por el mástil y la viga hasta la junta
            var ruta = new List<(Vector3 pos, Vector3 dir, Vector3 normal)>();
            float zIni = ZEsclusa * signo - 0.7f * signo;
            float zFin = ZCupula * signo + 0.5f * signo;
            int n = Mathf.Max(2, Mathf.CeilToInt(Mathf.Abs(zFin - zIni) / 0.85f));
            for (int i = 0; i <= n; i++)
            {
                float z = Mathf.Lerp(zIni, zFin, i / (float)n);
                float rz = RadioEn(z * signo);
                float x = (i % 2 == 0 ? 0.28f : -0.28f);
                float ang = Mathf.Asin(Mathf.Clamp(x / rz, -1f, 1f));
                Vector3 normal = new Vector3(Mathf.Sin(ang), Mathf.Cos(ang), 0f);
                ruta.Add((new Vector3(0f, ejeY, z) + normal * rz, Vector3.forward * -signo, normal));
            }
            for (float h = 0.35f; h < altoMastil - 0.2f; h += 0.55f)
            {
                ruta.Add((pieMastil + Vector3.up * h + Vector3.back * signo * 0.09f, Vector3.up, Vector3.back * signo));
            }
            for (float x = 0.3f; x < 1.45f; x += 0.55f)
            {
                ruta.Add((viga + Vector3.right * x + Vector3.up * 0.11f, Vector3.right, Vector3.up));
            }
            Transform rieles = new GameObject("Pasamanos_EVA").transform;
            (Vector3 largoLocal, Vector3 normalLocal) = EjesBaranda(baranda);
            foreach ((Vector3 pos, Vector3 dir, Vector3 normal) in ruta)
            {
                var b = (GameObject)PrefabUtility.InstantiatePrefab(baranda, rieles);
                b.transform.position = pos;
                b.transform.rotation = Quaternion.LookRotation(dir, normal) * Quaternion.Inverse(Quaternion.LookRotation(largoLocal, normalLocal));
            }

            // ---- baliza del objetivo
            GameObject baliza = Primitiva("Baliza", PrimitiveType.Sphere, objetivo.position, Quaternion.identity, Vector3.one * 0.08f, aro, ext, false);

            // ---- astronauta: el mismo rig y la misma locomoción 0G del interior
            var rig = (GameObject)PrefabUtility.InstantiatePrefab(rigPrefab);
            rig.transform.SetPositionAndRotation(esclusa, Quaternion.LookRotation(Vector3.forward * -signo));
            ArtigasMenu.AjustarRig(rig);
            Camera cam = rig.GetComponentInChildren<Camera>(true);
            // la cabeza queda unos 70 cm sobre la esclusa: los primeros pasamanos están al alcance de la mano
            float altoCabeza = cam != null ? cam.transform.position.y - rig.transform.position.y : 1.36f;
            rig.transform.position = esclusa + Vector3.up * (0.7f - altoCabeza);
            if (cam != null)
            {
                cam.farClipPlane = 2500f;
                cam.clearFlags = CameraClearFlags.Skybox;
            }

            // ---- cable de seguridad
            var tether = new GameObject("Tether");
            LineRenderer linea = tether.AddComponent<LineRenderer>();
            linea.widthMultiplier = 0.015f;
            linea.numCapVertices = 2;
            linea.shadowCastingMode = ShadowCastingMode.Off;
            linea.sharedMaterial = MatLinea();
            tether.AddComponent<Tether>().Configurar(ancla, 18f);

            // ---- sistemas, actividad, panel y botón de regreso
            var sistemas = new GameObject("Sistemas");
            sistemas.AddComponent<MedidorRendimiento>();
            var actividades = new GameObject("Actividades");
            actividades.transform.SetParent(sistemas.transform, false);
            var insp = new GameObject("A3_Inspeccion_ala_solar").AddComponent<ActividadInspeccion>();
            insp.transform.SetParent(actividades.transform, false);
            insp.Configurar(objetivo, "la junta del ala solar de estribor");
            var gestor = actividades.AddComponent<GestorActividades>();
            var sg = new SerializedObject(gestor);
            sg.FindProperty("actividades").arraySize = 1;
            sg.FindProperty("actividades").GetArrayElementAtIndex(0).objectReferenceValue = insp;
            sg.ApplyModifiedPropertiesWithoutUndo();
            baliza.AddComponent<Baliza>().Configurar(baliza.GetComponent<Renderer>(), insp);

            Vector3 adelante = Vector3.forward * -signo;
            var panelGo = new GameObject("Panel_Actividades");
            panelGo.transform.SetPositionAndRotation(esclusa + Vector3.up * 1.15f + adelante * 1.1f + Vector3.right * 0.35f, Quaternion.LookRotation(adelante));
            BotonFisico boton = ArtigasFases.CrearBotonPublico(panelGo.transform, new Vector3(0f, -0.27f, 0f));
            var panel = panelGo.AddComponent<PanelActividad>();
            var sp = new SerializedObject(panel);
            sp.FindProperty("gestor").objectReferenceValue = gestor;
            sp.FindProperty("boton").objectReferenceValue = boton;
            sp.FindProperty("encabezado").stringValue = "ARTIGAS-1 · CAMINATA ESPACIAL (EVA)";
            sp.ApplyModifiedPropertiesWithoutUndo();

            BotonConEscena("Boton_Volver", esclusa + Vector3.up * 0.75f + adelante * 0.6f - Vector3.right * 0.45f, Quaternion.LookRotation(adelante),
                "Volver a la esclusa", "F1_Rivera");

            var tableta = new GameObject("Tableta_Mapa").AddComponent<TabletaMapa>();
            tableta.transform.SetParent(sistemas.transform, false);
            var st = new SerializedObject(tableta);
            st.FindProperty("materialCuerpo").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Material>(Raiz + "Materiales/M_Tableta.mat");
            st.FindProperty("ubicacion").stringValue = "Afuera, sobre el Módulo Rivera (EVA)";
            st.ApplyModifiedPropertiesWithoutUndo();

            foreach (Transform t in ext.GetComponentsInChildren<Transform>(true))
            {
                if (t.GetComponentInParent<RotacionLenta>() == null)
                {
                    GameObjectUtility.SetStaticEditorFlags(t.gameObject, StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic);
                }
            }

            Directory.CreateDirectory(Path.GetDirectoryName(EscenaEva));
            EditorSceneManager.SaveScene(escena, EscenaEva);
            AgregarABuild(EscenaEva);

            // ---- en el Módulo Rivera: botón para salir a la caminata
            EditorSceneManager.OpenScene(ArtigasMenu.EscenaF1, OpenSceneMode.Single);
            Borrar("Boton_EVA");
            Unity.XR.CoreUtils.XROrigin origen = Object.FindAnyObjectByType<Unity.XR.CoreUtils.XROrigin>();
            GameObject panelF1 = GameObject.Find("Panel_Actividades");
            if (panelF1 != null)
            {
                BotonConEscena("Boton_EVA", panelF1.transform.position + panelF1.transform.right * 0.45f - Vector3.up * 0.27f, panelF1.transform.rotation,
                    "Salir a la caminata espacial", "F5_Exterior");
            }
            else if (origen != null)
            {
                BotonConEscena("Boton_EVA", origen.transform.position + Vector3.up * 1.2f + origen.transform.forward * 0.8f, origen.transform.rotation,
                    "Salir a la caminata espacial", "F5_Exterior");
            }
            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
            EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
            Debug.Log($"[Artigas1] Fase 5: escena {EscenaEva} (eje a {ejeY:0.00} m, radio en la esclusa {radio:0.00} m, {ruta.Count} pasamanos) y botón de salida en el Módulo Rivera.");
        }

        // ------------------------------------------------------------------------------------------------ Tierra y cielo
        private static void ArmarTierra(Light sol)
        {
            var fbx = AssetDatabase.LoadAssetAtPath<GameObject>(ArtigasImportador.Modelos + "Entorno/Tierra_Uruguay_al_nadir.fbx");
            if (fbx == null)
            {
                Debug.LogWarning("[Artigas1] No está el modelo de la Tierra: la escena exterior queda sin planeta.");
                return;
            }
            var inst = (GameObject)PrefabUtility.InstantiatePrefab(fbx);
            Renderer[] rs = inst.GetComponentsInChildren<Renderer>();
            Renderer esfera = rs.OrderByDescending(r => r.bounds.size.sqrMagnitude).First();
            var pivote = new GameObject("Tierra").transform;
            pivote.position = esfera.bounds.center;
            inst.transform.SetParent(pivote, true);
            Shader sh = Shader.Find("Artigas1/TierraDiaNoche");
            if (sh == null)
            {
                Debug.LogWarning("[Artigas1] No compiló el shader Artigas1/TierraDiaNoche: la Tierra queda con sus materiales de URP.");
                return;
            }
            string tex = ArtigasImportador.Texturas;
            Material baseM = MatTierra("M_Tierra_DiaNoche", sh, tex + "T_Tierra_Base_Dia.png", tex + "T_Tierra_Base_Luces.png", false);
            Material detalleM = MatTierra("M_Tierra_Detalle_DiaNoche", sh, tex + "T_Tierra_Detalle_Dia.png", tex + "T_Tierra_Detalle_Luces.png", true);
            foreach (Renderer r in rs)
            {
                r.sharedMaterial = r == esfera ? baseM : detalleM;
                r.shadowCastingMode = ShadowCastingMode.Off;
                r.receiveShadows = false;
            }
            TierraOrbital orbita = pivote.gameObject.AddComponent<TierraOrbital>();
            var so = new SerializedObject(orbita);
            so.FindProperty("sol").objectReferenceValue = sol;
            SerializedProperty sup = so.FindProperty("superficies");
            sup.arraySize = rs.Length;
            for (int i = 0; i < rs.Length; i++)
            {
                sup.GetArrayElementAtIndex(i).objectReferenceValue = rs[i];
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static Material MatTierra(string nombre, Shader sh, string dia, string noche, bool alfa)
        {
            string ruta = $"{Generado}Materiales/{nombre}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            if (m == null)
            {
                m = new Material(sh);
                AssetDatabase.CreateAsset(m, ruta);
            }
            m.shader = sh;
            m.SetTexture("_Dia", AssetDatabase.LoadAssetAtPath<Texture2D>(dia));
            m.SetTexture("_Noche", AssetDatabase.LoadAssetAtPath<Texture2D>(noche));
            m.SetFloat("_UsarAlfa", alfa ? 1f : 0f);
            m.SetFloat("_SrcBlend", alfa ? (float)BlendMode.SrcAlpha : (float)BlendMode.One);
            m.SetFloat("_DstBlend", alfa ? (float)BlendMode.OneMinusSrcAlpha : (float)BlendMode.Zero);
            m.SetFloat("_ZWrite", alfa ? 0f : 1f);
            m.renderQueue = alfa ? (int)RenderQueue.Transparent : (int)RenderQueue.Geometry;
            EditorUtility.SetDirty(m);
            return m;
        }

        private static Material Cielo()
        {
            string ruta = $"{Generado}Materiales/M_Cielo_Estrellas.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            Shader sh = Shader.Find("Skybox/Panoramic");
            if (sh == null)
            {
                return null;
            }
            if (m == null)
            {
                m = new Material(sh);
                AssetDatabase.CreateAsset(m, ruta);
            }
            m.SetTexture("_MainTex", AssetDatabase.LoadAssetAtPath<Texture2D>(ArtigasImportador.Texturas + "T_Estrellas_2K.png"));
            m.SetFloat("_Exposure", 0.8f);
            EditorUtility.SetDirty(m);
            return m;
        }

        // ------------------------------------------------------------------------------------------------ medidas
        private static float RadioEn(float zKit)
        {
            foreach ((string _, float z0, float z1, float r) in Tramos)
            {
                if (zKit >= z0 && zKit <= z1)
                {
                    return r;
                }
            }
            return 2.1f;
        }

        /// <summary>Altura del eje de la estación y sentido del eje Z, a partir del interior del Módulo Rivera.</summary>
        private static (float ejeY, float signo) MedirEstacion()
        {
            var fbx = AssetDatabase.LoadAssetAtPath<GameObject>(ArtigasImportador.Modelos + "Layout/Layout_Modulo_Rivera.fbx");
            if (fbx == null)
            {
                return (0f, 1f);
            }
            var tmp = (GameObject)Object.Instantiate(fbx);
            tmp.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            Renderer[] rs = tmp.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0)
            {
                Object.DestroyImmediate(tmp);
                return (0f, 1f);
            }
            Bounds b = rs[0].bounds;
            foreach (Renderer r in rs)
            {
                b.Encapsulate(r.bounds);
            }
            Object.DestroyImmediate(tmp);
            // el interior es simétrico respecto del eje del cilindro; el Rivera va de -0,66 a 4,90 sobre el eje
            float signo = b.center.z >= 0f ? 1f : -1f;
            return (b.center.y, signo);
        }

        private static (Vector3 largo, Vector3 normal) EjesBaranda(GameObject prefab)
        {
            var tmp = (GameObject)Object.Instantiate(prefab);
            tmp.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            Bounds b = new Bounds(Vector3.zero, Vector3.zero);
            foreach (Renderer r in tmp.GetComponentsInChildren<Renderer>())
            {
                b.Encapsulate(r.bounds);
            }
            Object.DestroyImmediate(tmp);
            Vector3[] ejes = { Vector3.right, Vector3.up, Vector3.forward };
            float[] med = { b.size.x, b.size.y, b.size.z };
            int[] orden = Enumerable.Range(0, 3).OrderByDescending(i => med[i]).ToArray();
            Vector3 largo = ejes[orden[0]];
            Vector3 normal = ejes[orden[1]];
            // el origen está en la cara de montaje: la baranda se levanta hacia donde está su centro
            if (Vector3.Dot(b.center, normal) < 0f)
            {
                normal = -normal;
            }
            return (largo, normal);
        }

        // ------------------------------------------------------------------------------------------------ geometría
        private static Mesh Cilindro(string nombre, float r, float z0, float z1, int lados, bool tapa0, bool tapa1, float metrosPorTile)
        {
            var v = new List<Vector3>();
            var nrm = new List<Vector3>();
            var uv = new List<Vector2>();
            var tri = new List<int>();
            float perimetro = 2f * Mathf.PI * r;
            for (int i = 0; i <= lados; i++)
            {
                float a = i / (float)lados * Mathf.PI * 2f;
                var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f);
                float u = i / (float)lados * perimetro / metrosPorTile;
                v.Add(d * r + Vector3.forward * z0); nrm.Add(d); uv.Add(new Vector2(u, z0 / metrosPorTile));
                v.Add(d * r + Vector3.forward * z1); nrm.Add(d); uv.Add(new Vector2(u, z1 / metrosPorTile));
            }
            for (int i = 0; i < lados; i++)
            {
                int k = i * 2;
                tri.AddRange(new[] { k, k + 1, k + 2, k + 1, k + 3, k + 2 });
            }
            if (tapa0)
            {
                Tapa(v, nrm, uv, tri, r, z0, lados, -1f);
            }
            if (tapa1)
            {
                Tapa(v, nrm, uv, tri, r, z1, lados, 1f);
            }
            return GuardarMalla(nombre, v, nrm, uv, tri);
        }

        private static void Tapa(List<Vector3> v, List<Vector3> nrm, List<Vector2> uv, List<int> tri, float r, float z, int lados, float sentido)
        {
            int centro = v.Count;
            Vector3 n = Vector3.forward * sentido;
            v.Add(Vector3.forward * z); nrm.Add(n); uv.Add(new Vector2(0.5f, 0.5f));
            for (int i = 0; i <= lados; i++)
            {
                float a = i / (float)lados * Mathf.PI * 2f;
                var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f);
                v.Add(d * r + Vector3.forward * z); nrm.Add(n); uv.Add(new Vector2(0.5f + d.x * 0.5f, 0.5f + d.y * 0.5f));
            }
            for (int i = 0; i < lados; i++)
            {
                int a = centro + 1 + i;
                int b = centro + 2 + i;
                if (sentido > 0f)
                {
                    tri.AddRange(new[] { centro, a, b });
                }
                else
                {
                    tri.AddRange(new[] { centro, b, a });
                }
            }
        }

        private static Mesh Plato(string nombre, float r, float hondo, int seg)
        {
            var v = new List<Vector3>();
            var nrm = new List<Vector3>();
            var uv = new List<Vector2>();
            var tri = new List<int>();
            int anillos = 6;
            for (int j = 0; j <= anillos; j++)
            {
                float t = j / (float)anillos;
                float rr = r * t;
                float y = hondo * t * t;
                for (int i = 0; i <= seg; i++)
                {
                    float a = i / (float)seg * Mathf.PI * 2f;
                    v.Add(new Vector3(Mathf.Cos(a) * rr, y, Mathf.Sin(a) * rr));
                    Vector3 n = new Vector3(-Mathf.Cos(a) * 2f * hondo * t / r, 1f, -Mathf.Sin(a) * 2f * hondo * t / r).normalized;
                    nrm.Add(n);
                    uv.Add(new Vector2(i / (float)seg, t));
                }
            }
            int fila = seg + 1;
            for (int j = 0; j < anillos; j++)
            {
                for (int i = 0; i < seg; i++)
                {
                    int a = j * fila + i;
                    int b = a + fila;
                    tri.AddRange(new[] { a, b, a + 1, a + 1, b, b + 1 });
                    // cara de atrás (el dorso del plato también se ve)
                    tri.AddRange(new[] { a, a + 1, b, a + 1, b + 1, b });
                }
            }
            return GuardarMalla(nombre, v, nrm, uv, tri);
        }

        private static Mesh GuardarMalla(string nombre, List<Vector3> v, List<Vector3> n, List<Vector2> uv, List<int> tri)
        {
            nombre = nombre.Replace(',', '_').Replace('.', '_');
            string ruta = $"{Generado}Mallas/{nombre}.asset";
            var m = AssetDatabase.LoadAssetAtPath<Mesh>(ruta);
            if (m == null)
            {
                m = new Mesh();
                AssetDatabase.CreateAsset(m, ruta);
            }
            m.Clear();
            m.name = nombre;
            m.SetVertices(v);
            m.SetNormals(n);
            m.SetUVs(0, uv);
            m.SetTriangles(tri, 0);
            m.RecalculateBounds();
            m.RecalculateTangents();
            EditorUtility.SetDirty(m);
            return m;
        }

        private static GameObject Malla(string nombre, Mesh malla, Material mat, Transform padre, bool sinColision = true)
        {
            var go = new GameObject(nombre);
            go.transform.SetParent(padre, false);
            go.AddComponent<MeshFilter>().sharedMesh = malla;
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        private static GameObject Primitiva(string nombre, PrimitiveType tipo, Vector3 pos, Quaternion rot, Vector3 escala, Material mat, Transform padre, bool colision = true)
        {
            GameObject go = GameObject.CreatePrimitive(tipo);
            go.name = nombre;
            if (!colision)
            {
                Object.DestroyImmediate(go.GetComponent<Collider>());
            }
            go.transform.SetParent(padre, true);
            go.transform.SetPositionAndRotation(pos, rot);
            go.transform.localScale = escala;
            go.GetComponent<Renderer>().sharedMaterial = mat;
            return go;
        }

        // ------------------------------------------------------------------------------------------------ texturas
        private delegate Color Pintor(int x, int y, int n);

        private static Color PintarManta(int x, int y, int n)
        {
            // manta térmica (MLI): acolchado en rombos, costuras y una variación suave para que no se vea plástica
            float u = x / (float)n;
            float w = y / (float)n;
            float rombo = Mathf.Abs(Mathf.Repeat(u * 4f + w * 4f, 1f) - 0.5f) < 0.02f || Mathf.Abs(Mathf.Repeat(u * 4f - w * 4f, 1f) - 0.5f) < 0.02f ? 0.82f : 1f;
            float costura = (x % (n / 2) < 2 || y % (n / 2) < 2) ? 0.7f : 1f;
            float ruido = 0.94f + 0.06f * Mathf.PerlinNoise(u * 18f, w * 18f);
            float k = rombo * costura * ruido;
            return new Color(k, k, k * 0.97f, 1f);
        }

        private static Color PintarCeldas(int x, int y, int n)
        {
            // celdas fotovoltaicas: azul oscuro, separadas por líneas plateadas, con barras colectoras finas
            int celda = n / 8;
            int cx = x % celda;
            int cy = y % celda;
            if (cx < 2 || cy < 2)
            {
                return new Color(0.72f, 0.74f, 0.78f, 1f);
            }
            if (cx == celda / 3 || cx == 2 * celda / 3)
            {
                return new Color(0.40f, 0.44f, 0.52f, 1f);
            }
            float ruido = 0.9f + 0.1f * Mathf.PerlinNoise(x * 0.11f, y * 0.11f);
            return new Color(0.05f * ruido, 0.10f * ruido, 0.26f * ruido, 1f);
        }

        private static Texture2D Textura(string nombre, Pintor pintor)
        {
            string ruta = $"{Generado}Texturas/{nombre}.png";
            const int n = 256;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false);
            for (int y = 0; y < n; y++)
            {
                for (int x = 0; x < n; x++)
                {
                    t.SetPixel(x, y, pintor(x, y, n));
                }
            }
            File.WriteAllBytes(ruta, t.EncodeToPNG());
            Object.DestroyImmediate(t);
            AssetDatabase.ImportAsset(ruta);
            var imp = (TextureImporter)AssetImporter.GetAtPath(ruta);
            imp.wrapMode = TextureWrapMode.Repeat;
            imp.mipmapEnabled = true;
            imp.anisoLevel = 2;
            imp.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(ruta);
        }

        private static Material Mat(string nombre, Texture2D tex, Color color, float metalico, float suavidad, Vector2 tiling)
        {
            string ruta = $"{Generado}Materiales/{nombre}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            if (m == null)
            {
                m = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                AssetDatabase.CreateAsset(m, ruta);
            }
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Metallic", metalico);
            m.SetFloat("_Smoothness", suavidad);
            if (tex != null)
            {
                m.SetTexture("_BaseMap", tex);
                m.SetTextureScale("_BaseMap", tiling);
            }
            m.enableInstancing = true;
            EditorUtility.SetDirty(m);
            return m;
        }

        private static Material MatLinea()
        {
            string ruta = $"{Generado}Materiales/M_Tether.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(ruta);
            Shader sh = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (m == null)
            {
                m = new Material(sh);
                AssetDatabase.CreateAsset(m, ruta);
            }
            EditorUtility.SetDirty(m);
            return m;
        }

        // ------------------------------------------------------------------------------------------------ ayudas
        private static void BotonConEscena(string nombre, Vector3 pos, Quaternion rot, string rotulo, string escena)
        {
            var go = new GameObject(nombre);
            go.transform.SetPositionAndRotation(pos, rot);
            BotonFisico boton = ArtigasFases.CrearBotonPublico(go.transform, Vector3.zero);
            CambioDeEscena cambio = go.AddComponent<CambioDeEscena>();
            cambio.Configurar(escena);
            UnityEventTools.AddPersistentListener(boton.AlPresionar, cambio.Ir);
            EditorUtility.SetDirty(boton);
            var etiqueta = new GameObject("Rotulo");
            etiqueta.transform.SetParent(go.transform, false);
            etiqueta.transform.localPosition = new Vector3(0f, 0.07f, 0f);
            etiqueta.AddComponent<EtiquetaFlotante>().Configurar(rotulo, new Vector2(0.24f, 0.045f));
        }

        private static void AgregarABuild(string ruta)
        {
            var lista = EditorBuildSettings.scenes.Where(s => s.path != ruta).ToList();
            int i = lista.FindIndex(s => s.path == ArtigasMenu.EscenaF1);
            lista.Insert(i >= 0 ? i + 1 : lista.Count, new EditorBuildSettingsScene(ruta, true));
            EditorBuildSettings.scenes = lista.ToArray();
        }

        private static void Carpeta(string ruta)
        {
            if (AssetDatabase.IsValidFolder(ruta))
            {
                return;
            }
            string padre = Path.GetDirectoryName(ruta).Replace('\\', '/');
            AssetDatabase.CreateFolder(padre, Path.GetFileName(ruta));
        }

        private static void Borrar(string nombre)
        {
            foreach (GameObject go in Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include, FindObjectsSortMode.None)
                         .Where(g => g.name == nombre && g.scene.IsValid()).ToList())
            {
                Object.DestroyImmediate(go);
            }
        }
    }
}

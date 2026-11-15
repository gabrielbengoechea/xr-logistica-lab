using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Artigas1.Editor
{
    /// <summary>
    /// Ajustes finales de las dos escenas: cielo de estrellas en el interior (por las ventanas se veía el cielo
    /// diurno por defecto de Unity) y el componente de optimización para el visor.
    /// </summary>
    public static class ArtigasAjustes
    {
        [MenuItem("Artigas-1/8. Ajustes finales para Quest", priority = 18)]
        public static void Ajustar()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                return;
            }
            Material cielo = ArtigasExterior.Cielo();
            foreach (string ruta in new[] { ArtigasMenu.EscenaF1, ArtigasExterior.EscenaEva })
            {
                if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ruta) == null)
                {
                    continue;
                }
                Scene s = EditorSceneManager.OpenScene(ruta, OpenSceneMode.Single);
                if (cielo != null)
                {
                    RenderSettings.skybox = cielo;
                }
                GameObject sistemas = GameObject.Find("Sistemas") ?? new GameObject("Sistemas");
                if (sistemas.GetComponent<OptimizacionQuest>() == null)
                {
                    sistemas.AddComponent<OptimizacionQuest>();
                }
                EditorSceneManager.MarkSceneDirty(s);
                EditorSceneManager.SaveScene(s);
            }
            EditorSceneManager.OpenScene(ArtigasMenu.EscenaF1, OpenSceneMode.Single);
            Debug.Log("[Artigas1] Ajustes finales: cielo de estrellas en F1 y F5, y optimización para Quest (foveado 0,5).");
        }
    }
}

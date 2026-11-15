using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Artigas1.Editor
{
    /// <summary>Menú para grabar un video de demostración del recorrido sin visor (cuadros en Builds/Video).</summary>
    [InitializeOnLoad]
    public static class ArtigasGrabacion
    {
        private const string Clave = "Artigas1.Grabar";

        static ArtigasGrabacion()
        {
            EditorApplication.playModeStateChanged += Cambio;
        }

        [MenuItem("Artigas-1/Grabar video del recorrido", priority = 40)]
        public static void Grabar()
        {
            if (EditorApplication.isPlaying || !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                return;
            }
            EditorSceneManager.OpenScene(ArtigasMenu.EscenaF1, OpenSceneMode.Single);
            SessionState.SetBool(Clave, true);
            EditorApplication.EnterPlaymode();
        }

        private static void Cambio(PlayModeStateChange estado)
        {
            if (estado != PlayModeStateChange.EnteredPlayMode || !SessionState.GetBool(Clave, false))
            {
                return;
            }
            SessionState.SetBool(Clave, false);
            var grabador = new GameObject("Grabador_Recorrido").AddComponent<GrabadorRecorrido>();
            grabador.alTerminar = () => EditorApplication.ExitPlaymode();
        }
    }
}

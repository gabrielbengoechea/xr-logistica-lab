#if UNITY_EDITOR
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Artigas1
{
    /// <summary>
    /// Graba un recorrido de demostración sin visor (solo en el editor): una cámara aparte recorre el Módulo Rivera y
    /// la caminata espacial, con los guantes delante de la cámara como si fueran las manos, y guarda cada cuadro en
    /// JPG. Usa <see cref="Time.captureFramerate"/>, así el video sale a velocidad real aunque la máquina sea lenta.
    /// </summary>
    public sealed class GrabadorRecorrido : MonoBehaviour
    {
        public const int Ancho = 960;
        public const int Alto = 540;
        public const int Fps = 20;

        public string carpeta = "Builds/Video";
        public string escenaExterior = "F5_Exterior";
        public float segundosInterior = 13f;
        public float segundosExterior = 15f;
        public System.Action alTerminar;

        private Camera _cam;
        private RenderTexture _rt;
        private Texture2D _tex;
        private int _cuadro;

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            Directory.CreateDirectory(carpeta);
            foreach (string f in Directory.GetFiles(carpeta, "f_*.jpg"))
            {
                File.Delete(f);
            }
            Time.captureFramerate = Fps;
            _rt = new RenderTexture(Ancho, Alto, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            _tex = new Texture2D(Ancho, Alto, TextureFormat.RGB24, false);
            var go = new GameObject("Camara_Grabacion");
            go.transform.SetParent(transform, false);
            _cam = go.AddComponent<Camera>();
            _cam.fieldOfView = 70f;
            _cam.nearClipPlane = 0.02f;
            _cam.farClipPlane = 2500f;
            _cam.targetTexture = _rt;
            _cam.depth = 10f;

            yield return null;
            yield return Tramo(segundosInterior, true);
            SceneManager.LoadScene(escenaExterior);
            yield return null;
            yield return null;
            yield return Tramo(segundosExterior, false);

            Time.captureFramerate = 0;
            Debug.Log($"[Artigas1] Grabación lista: {_cuadro} cuadros de {Ancho}x{Alto} a {Fps} fps en {Path.GetFullPath(carpeta)}");
            alTerminar?.Invoke();
        }

        private IEnumerator Tramo(float segundos, bool interior)
        {
            Camera principal = Camera.main;
            Transform cabeza = principal != null ? principal.transform : null;
            Vector3 inicio = cabeza != null ? cabeza.position : Vector3.up * 1.4f;
            Vector3 frente = cabeza != null ? Vector3.ProjectOnPlane(cabeza.forward, Vector3.up).normalized : Vector3.forward;
            if (frente.sqrMagnitude < 0.01f)
            {
                frente = Vector3.forward;
            }
            Vector3 derecha = Vector3.Cross(Vector3.up, frente);
            // la cámara del rig sigue andando (paneles, escáner), pero no se dibuja: graba la nuestra
            if (principal != null)
            {
                principal.enabled = false;
                // la viñeta de confort es una malla alrededor de la cabeza: taparía la cámara de grabación
                foreach (Renderer r in principal.GetComponentsInChildren<Renderer>(true))
                {
                    r.enabled = false;
                }
            }
            // sin controles, la plantilla de XRI apaga los objetos de los controles (y con ellos los guantes):
            // se apaga ese administrador y se vuelven a prender
            foreach (MonoBehaviour mb in FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None))
            {
                if (mb.GetType().Name == "XRInputModalityManager")
                {
                    mb.enabled = false;
                }
            }
            var lista = new System.Collections.Generic.List<GuanteMano>();
            foreach (GuanteMano g in Resources.FindObjectsOfTypeAll<GuanteMano>())
            {
                if (g.gameObject.scene.IsValid() && g.gameObject.scene.isLoaded)
                {
                    for (Transform p = g.transform; p != null; p = p.parent)
                    {
                        p.gameObject.SetActive(true);
                    }
                    lista.Add(g);
                }
            }
            GuanteMano[] guantes = lista.ToArray();
            foreach (GuanteMano g in guantes)
            {
                g.Simulado = true;
                foreach (Behaviour b in g.transform.parent.GetComponents<Behaviour>())
                {
                    // sin visor, el seguimiento del control no tiene datos: se apaga para mover las manos a mano
                    if (b.GetType().Name.Contains("TrackedPoseDriver"))
                    {
                        b.enabled = false;
                    }
                }
            }
            GestorActividades gestor = FindAnyObjectByType<GestorActividades>();
            if (gestor != null)
            {
                gestor.AccionPrincipal();
            }

            int n = Mathf.RoundToInt(segundos * Fps);
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)(n - 1);
                Vector3 pos;
                Quaternion rot;
                if (interior)
                {
                    // avanza por el pasillo del almacén mirando a un lado y al otro
                    pos = inicio + frente * Mathf.SmoothStep(0f, 1.8f, t) + Vector3.up * 0.05f * Mathf.Sin(t * 6f);
                    float giro = Mathf.Sin(t * Mathf.PI * 2f) * 50f;
                    float cabeceo = Mathf.Lerp(-6f, 4f, t);
                    rot = Quaternion.LookRotation(frente) * Quaternion.Euler(cabeceo, giro, 0f);
                }
                else
                {
                    // sale de la esclusa, sube y se aleja para ver la estación con las alas solares; al final, la Tierra
                    float s = Mathf.SmoothStep(0f, 1f, t);
                    pos = inicio + Vector3.up * (0.4f + 2.6f * s) - frente * (4.5f * s) + derecha * (2.0f * s);
                    float cabeceo = Mathf.Lerp(5f, 22f, s) + Mathf.SmoothStep(0f, 38f, Mathf.InverseLerp(0.7f, 1f, t));
                    float giro = Mathf.Lerp(0f, -20f, s);
                    rot = Quaternion.LookRotation(frente) * Quaternion.Euler(cabeceo, giro, 0f);
                }
                _cam.transform.SetPositionAndRotation(pos, rot);
                Manos(guantes, t, interior);
                yield return new WaitForEndOfFrame();
                Grabar();
            }
        }

        private void Manos(GuanteMano[] guantes, float t, bool interior)
        {
            Transform c = _cam.transform;
            foreach (GuanteMano g in guantes)
            {
                if (g == null)
                {
                    continue;
                }
                float lado = g.Izquierda ? -1f : 1f;
                float vaiven = Mathf.Sin(t * Mathf.PI * 4f + lado) * 0.012f;
                Transform control = g.transform.parent;
                control.position = c.TransformPoint(new Vector3(0.17f * lado, -0.20f + vaiven, 0.40f));
                control.rotation = c.rotation * Quaternion.Euler(-35f, -8f * lado, 0f);
                // derecha: relajada, gatillo, puño y vuelve; izquierda: grip (señala) a mitad del tramo
                if (g.Izquierda)
                {
                    g.GripSimulado = t > 0.45f && t < 0.75f ? 1f : 0f;
                    g.GatilloSimulado = 0f;
                }
                else
                {
                    g.GatilloSimulado = Mathf.Clamp01(Mathf.InverseLerp(0.15f, 0.30f, t)) * (t < 0.85f ? 1f : 0f);
                    g.GripSimulado = interior && t > 0.40f && t < 0.70f ? 1f : 0f;
                }
            }
        }

        private void Grabar()
        {
            RenderTexture previa = RenderTexture.active;
            RenderTexture.active = _rt;
            _tex.ReadPixels(new Rect(0, 0, Ancho, Alto), 0, 0);
            _tex.Apply(false);
            RenderTexture.active = previa;
            File.WriteAllBytes(Path.Combine(carpeta, $"f_{_cuadro:0000}.jpg"), _tex.EncodeToJPG(88));
            _cuadro++;
        }

        private void OnDestroy()
        {
            Time.captureFramerate = 0;
            if (_rt != null)
            {
                _rt.Release();
            }
        }
    }
}
#endif

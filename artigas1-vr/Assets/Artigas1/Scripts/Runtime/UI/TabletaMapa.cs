using System.Collections.Generic;
using TMPro;
using Unity.XR.CoreUtils;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR.Interaction.Toolkit.Interactors;

namespace Artigas1
{
    /// <summary>
    /// Tablet de navegación sujeta a la mano izquierda: el gatillo izquierdo la muestra y la guarda.
    /// Muestra el mapa de la estación, el módulo actual, la actividad en curso y el manifiesto.
    /// No toca la cámara ni la locomoción: va colgada del control y no tiene colisiones.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Tablet del mapa")]
    public sealed class TabletaMapa : MonoBehaviour
    {
        [SerializeField] private Material materialCuerpo;
        [Tooltip("Nombre del objeto del control izquierdo dentro del XR Origin.")]
        [SerializeField] private string nombreControl = "Left Controller";
        [SerializeField] private string moduloActual = "Rivera";
        [Tooltip("Texto de ubicación; vacío = «Usted está en el Módulo …».")]
        [SerializeField] private string ubicacion = "";
        [SerializeField] private Vector3 posicionLocal = new Vector3(0f, 0.05f, 0.07f);
        [SerializeField] private Vector3 rotacionLocal = new Vector3(35f, 0f, 0f);
        [SerializeField] private Vector2 tamanoMetros = new Vector2(0.17f, 0.115f);

        private static readonly (string id, string nombre)[] Modulos =
        {
            ("Tacuarembo", "Tacuarembó\nTaller"),
            ("Nodo", "Nodo\nMontevideo"),
            ("Rivera", "Rivera\nAlmacén"),
            ("Colonia", "Colonia\nRecepción"),
            ("Carguero", "Carguero\nCharrúa"),
        };

        private const float PxPorMetro = 4000f;
        private Transform _control;
        private Transform _raiz;
        private readonly List<IXRSelectInteractor> _interactores = new List<IXRSelectInteractor>();
        private InputAction _alternar;
        private GestorActividades _gestor;
        private InventoryService _inventario;
        private TextMeshProUGUI _actividad;
        private TextMeshProUGUI _inventarioTexto;
        private RectTransform _barra;
        private float _proxima;

        public bool Visible => _raiz != null && _raiz.gameObject.activeSelf;

        private void Awake()
        {
            _alternar = new InputAction("AlternarTablet", InputActionType.Button);
            _alternar.AddBinding("<XRController>{LeftHand}/triggerPressed");
            _alternar.AddBinding("<Keyboard>/t");
        }

        private void Start()
        {
            _gestor = FindAnyObjectByType<GestorActividades>();
            _inventario = FindAnyObjectByType<InventoryService>();
            _control = BuscarControl();
            if (_control == null)
            {
                Debug.LogWarning($"[Artigas1] Tablet: no encontré «{nombreControl}» en el XR Origin.", this);
                return;
            }
            foreach (MonoBehaviour mb in _control.GetComponentsInChildren<MonoBehaviour>(true))
            {
                if (mb is IXRSelectInteractor i)
                {
                    _interactores.Add(i);
                }
            }
            Armar();
            _raiz.gameObject.SetActive(false);
        }

        private void OnEnable()
        {
            _alternar.performed += OnAlternar;
            _alternar.Enable();
        }

        private void OnDisable()
        {
            _alternar.performed -= OnAlternar;
            _alternar.Disable();
        }

        private void OnDestroy()
        {
            _alternar?.Dispose();
        }

        private void OnAlternar(InputAction.CallbackContext ctx)
        {
            if (_raiz == null || ManoOcupada())
            {
                return;
            }
            _raiz.gameObject.SetActive(!_raiz.gameObject.activeSelf);
            _proxima = 0f;
        }

        // con el escáner (u otra cosa) en la mano izquierda, el gatillo es de esa herramienta
        private bool ManoOcupada()
        {
            foreach (IXRSelectInteractor i in _interactores)
            {
                if (i != null && i.hasSelection)
                {
                    return true;
                }
            }
            return false;
        }

        private Transform BuscarControl()
        {
            XROrigin origen = FindAnyObjectByType<XROrigin>();
            Transform raiz = origen != null ? origen.transform : null;
            if (raiz == null)
            {
                return null;
            }
            Transform alternativo = null;
            foreach (Transform t in raiz.GetComponentsInChildren<Transform>(true))
            {
                if (t.name == nombreControl)
                {
                    return t;
                }
                if (alternativo == null && t.name.Contains("Left") && t.name.Contains("Controller"))
                {
                    alternativo = t;
                }
            }
            return alternativo;
        }

        private void Armar()
        {
            _raiz = new GameObject("Tableta").transform;
            _raiz.SetParent(_control, false);
            _raiz.localPosition = posicionLocal;
            _raiz.localRotation = Quaternion.Euler(rotacionLocal);

            GameObject cuerpo = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cuerpo.name = "Cuerpo";
            Destroy(cuerpo.GetComponent<Collider>());
            cuerpo.transform.SetParent(_raiz, false);
            cuerpo.transform.localScale = new Vector3(tamanoMetros.x + 0.012f, tamanoMetros.y + 0.012f, 0.01f);
            cuerpo.transform.localPosition = new Vector3(0f, 0f, 0.006f);
            if (materialCuerpo != null)
            {
                cuerpo.GetComponent<Renderer>().sharedMaterial = materialCuerpo;
            }

            RectTransform lienzo = UiVR.Lienzo(_raiz, "Pantalla", tamanoMetros * PxPorMetro, 1f / PxPorMetro);
            lienzo.localPosition = Vector3.zero;
            UiVR.Caja(lienzo, "Fondo", UiVR.Fondo, Vector2.zero, Vector2.one);
            UiVR.Caja(lienzo, "Franja", UiVR.Acento, new Vector2(0f, 0.885f), new Vector2(1f, 0.895f));
            UiVR.Texto_(lienzo, "Titulo", 26f, UiVR.Texto, new Vector2(0f, 0.895f), new Vector2(1f, 1f), TextAlignmentOptions.MidlineLeft)
                .text = "ARTIGAS-1 · MAPA DE LA ESTACIÓN";

            // mapa esquemático: módulos en línea, la Cúpula Faro debajo del Nodo
            float ancho = 1f / Modulos.Length;
            for (int i = 0; i < Modulos.Length; i++)
            {
                (string id, string nombre) = Modulos[i];
                bool aca = id == moduloActual;
                var min = new Vector2(i * ancho + 0.01f, 0.58f);
                var max = new Vector2((i + 1) * ancho - 0.01f, 0.86f);
                UiVR.Caja(lienzo, $"Modulo_{id}", aca ? UiVR.Acento : UiVR.Marco, min, max);
                UiVR.Texto_(lienzo, $"Nombre_{id}", 17f, aca ? UiVR.Fondo : UiVR.Texto, min, max, TextAlignmentOptions.Center).text = nombre;
            }
            var cupMin = new Vector2(ancho + 0.03f, 0.43f);
            var cupMax = new Vector2(2f * ancho - 0.03f, 0.56f);
            UiVR.Caja(lienzo, "Modulo_Cupula", UiVR.Marco, cupMin, cupMax);
            UiVR.Texto_(lienzo, "Nombre_Cupula", 15f, UiVR.Texto, cupMin, cupMax, TextAlignmentOptions.Center).text = "Cúpula Faro";
            UiVR.Texto_(lienzo, "Aca", 16f, UiVR.Acento, new Vector2(0.42f, 0.43f), new Vector2(1f, 0.56f), TextAlignmentOptions.MidlineLeft)
                .text = string.IsNullOrEmpty(ubicacion) ? "▲ Usted está en el Módulo " + moduloActual : "▲ " + ubicacion;

            _actividad = UiVR.Texto_(lienzo, "Actividad", 18f, UiVR.Texto, new Vector2(0f, 0.20f), new Vector2(1f, 0.42f));
            _barra = UiVR.Barra(lienzo, "Avance", new Vector2(0.03f, 0.17f), new Vector2(0.97f, 0.20f));
            _inventarioTexto = UiVR.Texto_(lienzo, "Inventario", 17f, UiVR.TextoTenue, new Vector2(0f, 0.01f), new Vector2(1f, 0.16f));
        }

        private void Update()
        {
            if (!Visible || Time.time < _proxima)
            {
                return;
            }
            _proxima = Time.time + 0.5f;
            if (_gestor != null && _gestor.Actual != null)
            {
                ActividadBase a = _gestor.Actual;
                string estado = a.Estado == EstadoActividad.EnCurso ? a.DetalleProgreso
                    : a.Estado == EstadoActividad.Completada ? $"Completada · {a.Puntaje} puntos" : "Pendiente: comenzala en el panel del módulo";
                _actividad.text = $"<color=#33CCF2>Actividad:</color> {a.Titulo}\n{estado}";
                UiVR.Llenar(_barra, a.Progreso, a.Estado == EstadoActividad.Completada ? UiVR.Exito : UiVR.Acento);
            }
            else
            {
                _actividad.text = _gestor != null ? $"<color=#33CCF2>Turno completo</color> · {_gestor.PuntajeTotal} puntos" : "Sin actividades cargadas";
                UiVR.Llenar(_barra, _gestor != null ? 1f : 0f, UiVR.Exito);
            }
            _inventarioTexto.text = _inventario != null
                ? $"Manifiesto: {_inventario.Manifiesto.Leidas}/{_inventario.Manifiesto.Esperadas} cargas leídas · Gatillo izq.: guardar"
                : "Gatillo izquierdo: guardar la tablet";
        }
    }
}

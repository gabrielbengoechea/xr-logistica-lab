using TMPro;
using UnityEngine;

namespace Artigas1
{
    /// <summary>Pantallita del escáner: muestra el último resultado de lectura y mira siempre a la cabeza.</summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(EscanerHerramienta))]
    [AddComponentMenu("Artigas-1/Pantalla del escáner")]
    public sealed class PantallaEscaner : MonoBehaviour
    {
        [SerializeField] private Vector3 desplazamiento = new Vector3(0f, 0.09f, 0f);
        [SerializeField] private float segundosVisible = 4f;

        private EscanerHerramienta _escaner;
        private RectTransform _lienzo;
        private TextMeshProUGUI _texto;
        private float _hasta;
        private Transform _cabeza;

        private void Awake()
        {
            _escaner = GetComponent<EscanerHerramienta>();
            _lienzo = UiVR.Lienzo(transform, "Pantalla_Escaner", new Vector2(220f, 70f), 0.0006f);
            UiVR.Caja(_lienzo, "Fondo", UiVR.Fondo, Vector2.zero, Vector2.one);
            _texto = UiVR.Texto_(_lienzo, "Texto", 22f, UiVR.Acento, Vector2.zero, Vector2.one, TextAlignmentOptions.Midline);
            _lienzo.gameObject.SetActive(false);
        }

        private void OnEnable()
        {
            _escaner.Mensaje += OnMensaje;
        }

        private void OnDisable()
        {
            _escaner.Mensaje -= OnMensaje;
        }

        private void OnMensaje(string mensaje)
        {
            _texto.text = mensaje;
            bool problema = mensaje.Contains("NO ") || mensaje.Contains("ilegible") || mensaje.StartsWith("Sin lectura") || mensaje.StartsWith("Girá");
            _texto.color = problema ? UiVR.Alerta : UiVR.Exito;
            _hasta = Time.time + segundosVisible;
            _lienzo.gameObject.SetActive(true);
        }

        private void LateUpdate()
        {
            if (!_lienzo.gameObject.activeSelf)
            {
                return;
            }
            if (Time.time > _hasta)
            {
                _lienzo.gameObject.SetActive(false);
                return;
            }
            if (_cabeza == null && Camera.main != null)
            {
                _cabeza = Camera.main.transform;
            }
            _lienzo.position = transform.position + desplazamiento;
            if (_cabeza != null)
            {
                _lienzo.rotation = Quaternion.LookRotation(_lienzo.position - _cabeza.position, Vector3.up);
            }
        }
    }
}

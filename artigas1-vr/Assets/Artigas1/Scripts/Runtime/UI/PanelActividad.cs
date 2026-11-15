using TMPro;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Panel de la actividad del turno, en el mundo: título, introducción, instrucciones, avance y resultado.
    /// Arma su propia interfaz al arrancar y se conecta con el botón físico que tiene debajo.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Panel de actividades")]
    public sealed class PanelActividad : MonoBehaviour
    {
        [SerializeField] private GestorActividades gestor;
        [SerializeField] private BotonFisico boton;
        [SerializeField] private string encabezado = "ARTIGAS-1 · MÓDULO RIVERA · ALMACÉN";
        [SerializeField] private Vector2 tamanoMetros = new Vector2(0.62f, 0.42f);

        private const float PxPorMetro = 1000f;
        private TextMeshProUGUI _titulo;
        private TextMeshProUGUI _cuerpo;
        private TextMeshProUGUI _estado;
        private TextMeshProUGUI _botonTexto;
        private RectTransform _barra;
        private float _proxima;

        private void Awake()
        {
            if (gestor == null)
            {
                gestor = FindAnyObjectByType<GestorActividades>();
            }
            ArmarInterfaz();
        }

        private void OnEnable()
        {
            if (gestor != null)
            {
                gestor.Cambio += Refrescar;
            }
            if (boton != null)
            {
                boton.AlPresionar.AddListener(OnBoton);
            }
        }

        private void OnDisable()
        {
            if (gestor != null)
            {
                gestor.Cambio -= Refrescar;
            }
            if (boton != null)
            {
                boton.AlPresionar.RemoveListener(OnBoton);
            }
        }

        private void Start()
        {
            Refrescar();
        }

        private void Update()
        {
            // el tiempo de la actividad corre: se refresca cuatro veces por segundo, no en cada cuadro
            if (Time.time >= _proxima)
            {
                _proxima = Time.time + 0.25f;
                Refrescar();
            }
        }

        private void OnBoton()
        {
            if (gestor != null)
            {
                gestor.AccionPrincipal();
            }
        }

        private void ArmarInterfaz()
        {
            Vector2 px = tamanoMetros * PxPorMetro;
            RectTransform lienzo = UiVR.Lienzo(transform, "Pantalla", px, 1f / PxPorMetro);
            UiVR.Caja(lienzo, "Marco", UiVR.Marco, Vector2.zero, Vector2.one);
            UiVR.Caja(lienzo, "Fondo", UiVR.Fondo, new Vector2(0.008f, 0.012f), new Vector2(0.992f, 0.988f));
            UiVR.Caja(lienzo, "Franja", UiVR.Acento, new Vector2(0.008f, 0.90f), new Vector2(0.992f, 0.905f));
            UiVR.Texto_(lienzo, "Encabezado", 20f, UiVR.TextoTenue, new Vector2(0.02f, 0.905f), new Vector2(0.98f, 0.99f), TextAlignmentOptions.MidlineLeft).text = encabezado;
            _titulo = UiVR.Texto_(lienzo, "Titulo", 34f, UiVR.Texto, new Vector2(0.02f, 0.76f), new Vector2(0.98f, 0.90f), TextAlignmentOptions.MidlineLeft);
            _cuerpo = UiVR.Texto_(lienzo, "Cuerpo", 20f, UiVR.Texto, new Vector2(0.02f, 0.27f), new Vector2(0.98f, 0.76f));
            _barra = UiVR.Barra(lienzo, "Avance", new Vector2(0.04f, 0.21f), new Vector2(0.96f, 0.245f));
            _estado = UiVR.Texto_(lienzo, "Estado", 22f, UiVR.Acento, new Vector2(0.02f, 0.10f), new Vector2(0.98f, 0.20f), TextAlignmentOptions.MidlineLeft);
            _botonTexto = UiVR.Texto_(lienzo, "Boton", 22f, UiVR.TextoTenue, new Vector2(0.02f, 0.015f), new Vector2(0.98f, 0.10f), TextAlignmentOptions.Midline);
        }

        private void Refrescar()
        {
            if (_titulo == null)
            {
                return;
            }
            if (gestor == null || gestor.Actividades.Count == 0)
            {
                _titulo.text = "Sin actividades";
                _cuerpo.text = "Corré el paso 5 del menú Artigas-1 para crear las actividades del turno.";
                _estado.text = "";
                _botonTexto.text = "";
                UiVR.Llenar(_barra, 0f, UiVR.Acento);
                return;
            }
            if (gestor.TurnoTerminado)
            {
                _titulo.text = "Turno completo";
                _cuerpo.text = Resumen();
                _estado.text = $"Puntaje del turno: {gestor.PuntajeTotal}";
                _botonTexto.text = "Buen trabajo, tripulante.";
                UiVR.Llenar(_barra, 1f, UiVR.Exito);
                return;
            }
            ActividadBase a = gestor.Actual;
            int n = IndiceDe(a) + 1;
            _titulo.text = $"{n}/{gestor.Actividades.Count} · {a.Titulo}";
            switch (a.Estado)
            {
                case EstadoActividad.Pendiente:
                    _cuerpo.text = $"{a.Introduccion}\n\n<color=#33CCF2>Cómo se hace</color>\n{a.Instrucciones}";
                    _estado.text = "Lista para comenzar";
                    _botonTexto.text = "Apretá el botón para COMENZAR";
                    UiVR.Llenar(_barra, 0f, UiVR.Acento);
                    break;
                case EstadoActividad.EnCurso:
                    _cuerpo.text = $"<color=#33CCF2>Objetivo</color>\n{a.Instrucciones}";
                    _estado.text = a.DetalleProgreso;
                    _botonTexto.text = "En curso";
                    UiVR.Llenar(_barra, a.Progreso, UiVR.Acento);
                    break;
                default:
                    _cuerpo.text = $"Actividad completada en {a.Segundos:0} s.\n\n{a.DetalleProgreso}";
                    _estado.text = $"Puntaje: {a.Puntaje}";
                    _botonTexto.text = "Apretá el botón para la SIGUIENTE";
                    UiVR.Llenar(_barra, 1f, UiVR.Exito);
                    break;
            }
        }

        private int IndiceDe(ActividadBase a)
        {
            for (int i = 0; i < gestor.Actividades.Count; i++)
            {
                if (gestor.Actividades[i] == a)
                {
                    return i;
                }
            }
            return 0;
        }

        private string Resumen()
        {
            var sb = new System.Text.StringBuilder();
            foreach (ActividadBase a in gestor.Actividades)
            {
                sb.AppendLine($"• {a.Titulo}: {a.Puntaje} puntos en {a.Segundos:0} s");
            }
            return sb.ToString();
        }
    }
}

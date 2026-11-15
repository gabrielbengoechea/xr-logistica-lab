using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR.Interaction.Toolkit.Interactors;

namespace Artigas1
{
    /// <summary>
    /// Guante de astronauta en un control: la malla del guante (la misma del recorrido web, modelada en
    /// Blender/guante.py) con 16 huesos que se mueven por cinemática directa. Con controles no hay seguimiento de dedos:
    /// la pose sale del grip, del gatillo y de lo que la mano sostiene (baranda, carga, escáner, tablet), y se mezcla de
    /// a poco para que no salte. Esconde el modelo del control que trae la plantilla.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Guante de la mano")]
    public sealed class GuanteMano : MonoBehaviour
    {
        [SerializeField] private bool izquierda;
        [SerializeField] private SkinnedMeshRenderer malla;
        [SerializeField] private Transform[] huesos = new Transform[ManoCinematica.Huesos];
        [Tooltip("Rotación del marco del guante respecto del espacio de agarre del control (grados, ejes del recorrido web). La misma calibración por defecto del recorrido.")]
        [SerializeField] private Vector3 calibracion = new Vector3(-90f, 0f, 0f);
        [Tooltip("Guante presurizado de la caminata espacial: un poco más grande.")]
        [SerializeField] private bool presurizado;

        private const float Grosor = 1.12f;
        private const float RadioMango = 0.016f;
        private static readonly float[] IndiceBoton = { ManoCinematica.Boton.dedos[3], ManoCinematica.Boton.dedos[4], ManoCinematica.Boton.dedos[5] };

        private readonly Matrix4x4[] _marcos = new Matrix4x4[ManoCinematica.Huesos];
        private readonly List<IXRSelectInteractor> _interactores = new List<IXRSelectInteractor>();
        private readonly float[] _indice = new float[3];
        private PoseMano _pose;
        private InputAction _grip;
        private InputAction _gatillo;
        private TabletaMapa _tableta;

        /// <summary>Para grabar demostraciones sin visor: el grip y el gatillo salen de acá en lugar de los controles.</summary>
        public bool Simulado { get; set; }

        public float GripSimulado { get; set; }

        public float GatilloSimulado { get; set; }

        public bool Izquierda => izquierda;

        public void Configurar(bool esIzquierda, SkinnedMeshRenderer renderer, Transform[] bones, bool esPresurizado)
        {
            izquierda = esIzquierda;
            malla = renderer;
            huesos = bones;
            presurizado = esPresurizado;
        }

        private void Awake()
        {
            _pose = ManoCinematica.Relajada.Copia();
            string mano = izquierda ? "{LeftHand}" : "{RightHand}";
            _grip = new InputAction("Grip" + mano, InputActionType.Value, $"<XRController>{mano}/grip");
            _gatillo = new InputAction("Gatillo" + mano, InputActionType.Value, $"<XRController>{mano}/trigger");
            UbicarEnElControl();
        }

        private void OnEnable()
        {
            _grip.Enable();
            _gatillo.Enable();
        }

        private void OnDisable()
        {
            _grip.Disable();
            _gatillo.Disable();
        }

        private void OnDestroy()
        {
            _grip.Dispose();
            _gatillo.Dispose();
        }

        private void Start()
        {
            Transform control = transform.parent;
            if (control != null)
            {
                foreach (MonoBehaviour mb in control.GetComponentsInChildren<MonoBehaviour>(true))
                {
                    if (mb is IXRSelectInteractor i)
                    {
                        _interactores.Add(i);
                    }
                }
                // el modelo del control de la plantilla queda escondido: se ve el guante
                foreach (Renderer r in control.GetComponentsInChildren<Renderer>(true))
                {
                    // se respetan el guante, los rayos y la tablet del mapa (que también cuelga de este control)
                    if (r.transform.IsChildOf(transform) || r is LineRenderer || r is TrailRenderer || EnLaTableta(r.transform, control))
                    {
                        continue;
                    }
                    r.enabled = false;
                }
            }
            if (izquierda)
            {
                _tableta = FindAnyObjectByType<TabletaMapa>();
            }
            Posar(1f);
        }

        private static bool EnLaTableta(Transform t, Transform hasta)
        {
            for (Transform p = t; p != null && p != hasta; p = p.parent)
            {
                if (p.name == "Tableta")
                {
                    return true;
                }
            }
            return false;
        }

        private void LateUpdate()
        {
            Posar(1f - Mathf.Exp(-16f * Time.deltaTime));
        }

        /// <summary>
        /// Marco del guante en el control, igual que el recorrido: calibración × (giro de la palma y desplazamiento
        /// hasta el mango). En la mano izquierda ese desplazamiento va reflejado.
        /// </summary>
        private void UbicarEnElControl()
        {
            Vector3 c = calibracion * Mathf.Deg2Rad;
            Matrix4x4 calib = ManoCinematica.RotX(c.x) * ManoCinematica.RotY(c.y) * ManoCinematica.RotZ(c.z);
            float mango = RadioMango + 0.0135f * Grosor;
            Matrix4x4 b = Matrix4x4.Translate(new Vector3(mango, -0.012f, 0.012f)) * ManoCinematica.RotZ(-Mathf.PI / 2f);
            if (izquierda)
            {
                Matrix4x4 x = Matrix4x4.Scale(new Vector3(-1f, 1f, 1f));
                b = x * b * x;
            }
            Matrix4x4 local = ManoCinematica.AUnity(calib * b, false);
            transform.localPosition = local.GetColumn(3);
            transform.localRotation = local.rotation;
            transform.localScale = Vector3.one * (presurizado ? 1.08f : 1f);
        }

        private void Posar(float k)
        {
            float grip = Simulado ? GripSimulado : _grip.ReadValue<float>();
            float gatillo = Simulado ? GatilloSimulado : _gatillo.ReadValue<float>();
            PoseMano meta = PoseObjetivo(grip, gatillo, out float[] indiceMeta, out float mezclaIndice);
            float[] indice = null;
            if (indiceMeta != null)
            {
                // el índice acompaña al gatillo: mezcla entre su pose y la de apretar
                float t = Mathf.Clamp01(mezclaIndice);
                for (int j = 0; j < 3; j++)
                {
                    _indice[j] = Mathf.Lerp(meta.dedos[j], indiceMeta[j], t);
                }
                indice = _indice;
            }
            ManoCinematica.Mezclar(ref _pose, meta, k, indice);
            ManoCinematica.MarcosWeb(_pose, _marcos);
            for (int h = 0; h < ManoCinematica.Huesos && h < huesos.Length; h++)
            {
                if (huesos[h] == null)
                {
                    continue;
                }
                Matrix4x4 m = ManoCinematica.AUnity(_marcos[h], izquierda);
                huesos[h].localPosition = m.GetColumn(3);
                huesos[h].localRotation = m.rotation;
            }
        }

        private PoseMano PoseObjetivo(float grip, float gatillo, out float[] indice, out float mezclaIndice)
        {
            indice = null;
            mezclaIndice = 0f;
            if (_tableta != null && _tableta.Visible)
            {
                return ManoCinematica.Tableta;
            }
            Transform sostenido = Sostenido();
            if (sostenido != null)
            {
                if (sostenido.GetComponentInParent<Agarradera>() != null)
                {
                    return ManoCinematica.Baranda;
                }
                if (sostenido.GetComponentInParent<EscanerHerramienta>() != null)
                {
                    indice = ManoCinematica.IndicePistolaGatillo;
                    mezclaIndice = gatillo;
                    return ManoCinematica.Pistola;
                }
                if (sostenido.GetComponentInParent<CargoUnit>() != null)
                {
                    return ManoCinematica.Caja;
                }
                return ManoCinematica.Cilindro;
            }
            if (grip > 0.5f)
            {
                return gatillo > 0.4f ? ManoCinematica.Puno : ManoCinematica.Senalar;
            }
            if (gatillo > 0.05f)
            {
                indice = IndiceBoton;
                mezclaIndice = gatillo;
            }
            return ManoCinematica.Relajada;
        }

        private Transform Sostenido()
        {
            foreach (IXRSelectInteractor i in _interactores)
            {
                if (i != null && i.hasSelection && i.interactablesSelected.Count > 0)
                {
                    return i.interactablesSelected[0].transform;
                }
            }
            return null;
        }
    }
}

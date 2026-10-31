using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace XRLab
{
    /// <summary>Una pieza de la vista explotada y su desplazamiento (en el espacio de la raíz del conjunto).</summary>
    [Serializable]
    public sealed class ExplodedPart
    {
        [SerializeField] private Transform part;
        [Tooltip("Desplazamiento con el conjunto despiezado, en metros y en el espacio de la raíz (ejes de Unity).")]
        [SerializeField] private Vector3 offset;
        [Tooltip("Ignora el desplazamiento y lo calcula alejando la pieza del centro del conjunto.")]
        [SerializeField] private bool autoOffset;

        public ExplodedPart(Transform part, Vector3 offset, bool autoOffset = false)
        {
            this.part = part;
            this.offset = offset;
            this.autoOffset = autoOffset;
        }

        public Transform Part => part;
        public Vector3 Offset { get => offset; set => offset = value; }
        public bool AutoOffset { get => autoOffset; set => autoOffset = value; }
    }

    /// <summary>
    /// Vista explotada: interpola cada pieza entre su lugar ensamblado y su lugar despiezado (LERP con curva y
    /// escalonado). Las piezas se descubren por nombre (Part_*) o se cargan a mano; los desplazamientos pueden venir
    /// del manifest del backend (<see cref="ApplyManifest"/>), del importador de FBX o calcularse solos.
    /// Una pieza que el alumno tiene en la mano o que está encajada en otro lado no se mueve.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("XR Lab/Exploded View Manager")]
    public sealed class ExplodedViewManager : MonoBehaviour
    {
        [Header("Piezas")]
        [SerializeField] private List<ExplodedPart> parts = new List<ExplodedPart>();
        [Tooltip("Si la lista está vacía, busca hijos cuyo nombre empiece así.")]
        [SerializeField] private string discoverPrefix = "Part_";
        [Tooltip("Distancia de las piezas con desplazamiento automático (m).")]
        [Min(0f)] [SerializeField] private float autoDistance = 0.25f;

        [Header("Animación")]
        [Tooltip("Segundos de una transición completa.")]
        [Min(0f)] [SerializeField] private float duration = 1.2f;
        [SerializeField] private EaseCurve curve = EaseCurve.EaseInOutCubic;
        [Tooltip("0: todas las piezas a la vez; 1: una detrás de otra.")]
        [Range(0f, 0.9f)] [SerializeField] private float stagger = 0.2f;
        [SerializeField] private bool startExploded;

        [Header("Telemetría (opcional)")]
        [SerializeField] private TelemetryLogger telemetry;

        [Header("Eventos")]
        [SerializeField] private UnityEvent onExploded = new UnityEvent();
        [SerializeField] private UnityEvent onAssembled = new UnityEvent();

        private sealed class Runtime
        {
            public Transform Transform;
            public Vector3 AssembledLocal;
            public Vector3 OffsetInParent;
            public SnappablePart Snappable;
        }

        private readonly List<Runtime> _runtime = new List<Runtime>();
        private ExplodeState _state;

        /// <summary>Factor con la curva aplicada: 0 ensamblado, 1 despiezado.</summary>
        public float Factor { get; private set; }

        /// <summary>El objetivo actual es el despiece.</summary>
        public bool IsExploded => _state != null && _state.Target >= 0.5f;

        public bool IsMoving => _state != null && _state.IsMoving;

        public IReadOnlyList<ExplodedPart> Parts => parts;

        /// <summary>Cada cuadro en que cambia el factor.</summary>
        public event Action<float> FactorChanged;

        private void Awake()
        {
            if (telemetry == null)
            {
                telemetry = FindAnyObjectByType<TelemetryLogger>();
            }
            if (parts.Count == 0)
            {
                Discover();
            }
            Rebuild();
            _state = new ExplodeState(duration, startExploded ? 1f : 0f);
            Apply(_state.Raw);
        }

        private void Update()
        {
            if (_state == null || !_state.IsMoving)
            {
                return;
            }
            _state.Duration = duration;
            bool arrived = _state.Step(Time.deltaTime);
            Apply(_state.Raw);
            if (arrived)
            {
                if (_state.Target >= 1f)
                {
                    onExploded.Invoke();
                }
                else
                {
                    onAssembled.Invoke();
                }
            }
        }

        /// <summary>Despieza el conjunto (con animación).</summary>
        public void Explode()
        {
            SetTarget(1f);
        }

        /// <summary>Vuelve a ensamblar (con animación).</summary>
        public void Assemble()
        {
            SetTarget(0f);
        }

        /// <summary>Alterna entre despiezado y ensamblado (para un botón o un gesto).</summary>
        public void Toggle()
        {
            SetTarget(IsExploded ? 0f : 1f);
        }

        /// <summary>Lleva el despiece a un valor intermedio (por ejemplo, desde un deslizador).</summary>
        public void SetTarget(float target)
        {
            EnsureState();
            bool wasExploded = IsExploded;
            _state.SetTarget(target);
            if (IsExploded != wasExploded && telemetry != null)
            {
                telemetry.Log(IsExploded ? Telemetry.TelemetryEventType.Explode : Telemetry.TelemetryEventType.Assemble, null, name);
            }
        }

        /// <summary>Salta al estado pedido sin animación.</summary>
        public void SetImmediate(bool exploded)
        {
            EnsureState();
            _state.Snap(exploded ? 1f : 0f);
            Apply(_state.Raw);
        }

        /// <summary>Busca las piezas por prefijo de nombre en toda la jerarquía (con desplazamiento automático).</summary>
        public void Discover()
        {
            parts.Clear();
            if (string.IsNullOrEmpty(discoverPrefix))
            {
                return;
            }
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                if (t != transform && t.name.StartsWith(discoverPrefix, StringComparison.Ordinal))
                {
                    parts.Add(new ExplodedPart(t, Vector3.zero, true));
                }
            }
        }

        /// <summary>Fija el desplazamiento de una pieza (espacio de la raíz, ejes de Unity). Devuelve false si no es pieza de este conjunto.</summary>
        public bool SetOffset(Transform part, Vector3 offset)
        {
            foreach (ExplodedPart p in parts)
            {
                if (p.Part == part)
                {
                    p.Offset = offset;
                    p.AutoOffset = false;
                    Rebuild();
                    return true;
                }
            }
            if (part == null || !part.IsChildOf(transform))
            {
                return false;
            }
            parts.Add(new ExplodedPart(part, offset));
            Rebuild();
            return true;
        }

        /// <summary>
        /// Toma los desplazamientos del manifest del backend (ejes glTF, se convierten a Unity). Las piezas que el
        /// manifest no nombra conservan su desplazamiento. Devuelve cuántas piezas encontró.
        /// </summary>
        public int ApplyManifest(ModelAssetDto asset)
        {
            if (asset?.parts == null)
            {
                return 0;
            }
            var byName = new Dictionary<string, Transform>(StringComparer.Ordinal);
            foreach (Transform t in GetComponentsInChildren<Transform>(true))
            {
                if (!byName.ContainsKey(t.name))
                {
                    byName.Add(t.name, t);
                }
            }
            int found = 0;
            foreach (ModelPartDto p in asset.parts)
            {
                if (p != null && p.node != null && byName.TryGetValue(p.node, out Transform t))
                {
                    found++;
                    Vector3 offset = ManifestMath.ToUnity(p.explode_offset);
                    ExplodedPart existing = parts.Find(x => x.Part == t);
                    if (existing != null)
                    {
                        existing.Offset = offset;
                        existing.AutoOffset = false;
                    }
                    else
                    {
                        parts.Add(new ExplodedPart(t, offset));
                    }
                }
            }
            Rebuild();
            return found;
        }

        /// <summary>
        /// Recalcula lugares ensamblados y desplazamientos. Hay que llamarlo con el conjunto armado (factor 0): por eso
        /// primero vuelve las piezas a su lugar.
        /// </summary>
        public void Rebuild()
        {
            foreach (Runtime r in _runtime)
            {
                if (r.Transform != null)
                {
                    r.Transform.localPosition = r.AssembledLocal;
                }
            }
            _runtime.Clear();
            Vector3 center = AssemblyCenter();
            foreach (ExplodedPart p in parts)
            {
                if (p?.Part == null)
                {
                    continue;
                }
                Vector3 rootOffset = p.AutoOffset
                    ? transform.InverseTransformVector(ExplodedViewMath.AutoOffset(PartCenter(p.Part), center, autoDistance))
                    : p.Offset;
                Vector3 world = transform.TransformVector(rootOffset);
                Transform parent = p.Part.parent;
                _runtime.Add(new Runtime
                {
                    Transform = p.Part,
                    AssembledLocal = p.Part.localPosition,
                    OffsetInParent = parent != null ? parent.InverseTransformVector(world) : world,
                    Snappable = p.Part.GetComponent<SnappablePart>(),
                });
            }
            if (_state != null)
            {
                Apply(_state.Raw);
            }
        }

        private void EnsureState()
        {
            if (_state == null)
            {
                _state = new ExplodeState(duration, 0f);
            }
        }

        private void Apply(float raw)
        {
            int n = _runtime.Count;
            for (int i = 0; i < n; i++)
            {
                Runtime r = _runtime[i];
                if (r.Transform == null || (r.Snappable != null && (r.Snappable.IsHeld || r.Snappable.IsSnapped)))
                {
                    continue;
                }
                float k = ExplodedViewMath.Ease(ExplodedViewMath.StaggeredFactor(raw, i, n, stagger), curve);
                r.Transform.localPosition = r.AssembledLocal + r.OffsetInParent * k;
            }
            float f = ExplodedViewMath.Ease(raw, curve);
            if (!Mathf.Approximately(f, Factor))
            {
                Factor = f;
                FactorChanged?.Invoke(f);
            }
        }

        private Vector3 AssemblyCenter()
        {
            bool any = false;
            var b = new Bounds(transform.position, Vector3.zero);
            foreach (Renderer r in GetComponentsInChildren<Renderer>())
            {
                if (!any)
                {
                    b = r.bounds;
                    any = true;
                }
                else
                {
                    b.Encapsulate(r.bounds);
                }
            }
            return b.center;
        }

        private static Vector3 PartCenter(Transform part)
        {
            Renderer r = part.GetComponent<Renderer>();
            return r != null ? r.bounds.center : part.position;
        }
    }
}

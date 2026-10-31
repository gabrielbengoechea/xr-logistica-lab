using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace XRLab
{
    /// <summary>Evento de encaje con la pieza involucrada.</summary>
    [System.Serializable]
    public sealed class SnapEvent : UnityEvent<SnappablePart>
    {
    }

    /// <summary>Evento de rechazo con el texto para el alumno.</summary>
    [System.Serializable]
    public sealed class SnapRejectedEvent : UnityEvent<SnappablePart, string>
    {
    }

    /// <summary>
    /// Zona de encaje (Snap Zone): detecta las piezas que entran a su volumen (collider en modo trigger), muestra
    /// una silueta cuando una pieza en la mano está a tiro y es la correcta, y al soltarla la acopla
    /// magnéticamente: la pieza se desliza al punto de encaje con la orientación (o la simétrica) más cercana.
    /// Si la pieza no corresponde, o está girada, registra el error de ensamblaje con el motivo.
    /// Las reglas están en <see cref="SnapMath"/> (sin MonoBehaviour, probadas fuera de Unity).
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Collider))]
    [AddComponentMenu("XR Lab/Snap Zone")]
    public sealed class SnapZone : MonoBehaviour
    {
        /// <summary>Más allá de este múltiplo del radio del imán, soltar una pieza no cuenta como intento fallido.</summary>
        public const float FailRadiusFactor = 1.5f;

        [Header("Reglas")]
        [Tooltip("Tipos de pieza aceptados, separados por coma (\"placa_obc,placa_eps\"); * acepta cualquiera.")]
        [SerializeField] private string accepts = "*";
        [Tooltip("Radio del imán (m): si se suelta más cerca que esto, la pieza se acopla sola.")]
        [Min(0.001f)] [SerializeField] private float magnetRadius = 0.08f;
        [Tooltip("Desvío de giro aceptado (grados).")]
        [Range(1f, 180f)] [SerializeField] private float angleTolerance = 25f;
        [SerializeField] private SnapSymmetry symmetry = SnapSymmetry.None;
        [Tooltip("Tolerancia de ajuste del encaje real (m), del manifest. Se informa en la telemetría.")]
        [Min(0f)] [SerializeField] private float fitTolerance = 0.005f;

        [Header("Acople")]
        [Tooltip("Dónde queda la pieza encajada. Vacío: este mismo objeto.")]
        [SerializeField] private Transform attachPoint;
        [Min(0f)] [SerializeField] private float snapSeconds = 0.18f;
        [Tooltip("Una vez encajada, la pieza no se puede volver a sacar.")]
        [SerializeField] private bool lockWhenSnapped;

        [Header("Silueta (opcional)")]
        [Tooltip("Objeto que se muestra en el punto de encaje mientras una pieza correcta está a tiro.")]
        [SerializeField] private GameObject ghost;

        [Header("Telemetría (opcional)")]
        [SerializeField] private TelemetryLogger telemetry;

        [Header("Eventos")]
        [SerializeField] private SnapEvent onSnapped = new SnapEvent();
        [SerializeField] private SnapEvent onUnsnapped = new SnapEvent();
        [SerializeField] private SnapRejectedEvent onRejected = new SnapRejectedEvent();

        private readonly HashSet<SnappablePart> _candidates = new HashSet<SnappablePart>();

        public string Accepts => accepts;
        public SnappablePart Occupant { get; private set; }
        public bool IsOccupied => Occupant != null;
        public Transform AttachPoint => attachPoint != null ? attachPoint : transform;

        /// <summary>Configura la zona desde código (importador de modelos o manifest).</summary>
        public void Configure(string acceptsType, float fitToleranceMeters, float magnetRadiusMeters)
        {
            accepts = string.IsNullOrEmpty(acceptsType) ? "*" : acceptsType;
            fitTolerance = Mathf.Max(0f, fitToleranceMeters);
            magnetRadius = Mathf.Max(0.001f, magnetRadiusMeters);
        }

        private void Reset()
        {
            Collider c = GetComponent<Collider>();
            if (c != null)
            {
                c.isTrigger = true;
            }
        }

        private void Awake()
        {
            Collider c = GetComponent<Collider>();
            if (c != null && !c.isTrigger)
            {
                Debug.LogWarning($"[XRLab] El collider de la zona {name} no estaba en modo trigger: se cambia.", this);
                c.isTrigger = true;
            }
            if (telemetry == null)
            {
                telemetry = FindAnyObjectByType<TelemetryLogger>();
            }
            SetGhost(false);
        }

        private void OnDisable()
        {
            foreach (SnappablePart p in _candidates)
            {
                if (p != null)
                {
                    p.Released -= OnCandidateReleased;
                }
            }
            _candidates.Clear();
            SetGhost(false);
        }

        private void OnTriggerEnter(Collider other)
        {
            SnappablePart part = other.GetComponentInParent<SnappablePart>();
            if (part != null && part != Occupant && _candidates.Add(part))
            {
                part.Released += OnCandidateReleased;
            }
        }

        private void OnTriggerExit(Collider other)
        {
            SnappablePart part = other.GetComponentInParent<SnappablePart>();
            if (part != null && _candidates.Remove(part))
            {
                part.Released -= OnCandidateReleased;
            }
        }

        private void Update()
        {
            // Silueta: se muestra si alguna pieza en la mano encajaría al soltarla.
            bool show = false;
            if (Occupant == null && ghost != null)
            {
                foreach (SnappablePart p in _candidates)
                {
                    if (p != null && p.IsHeld && Evaluate(p).Accepted)
                    {
                        show = true;
                        break;
                    }
                }
            }
            SetGhost(show);
        }

        /// <summary>Evalúa una pieza contra esta zona con las reglas de <see cref="SnapMath"/>.</summary>
        public SnapEvaluation Evaluate(SnappablePart part)
        {
            Transform a = AttachPoint;
            return SnapMath.Evaluate(
                part.PartType, part.transform.position, part.transform.rotation,
                accepts, a.position, a.rotation,
                magnetRadius, angleTolerance, magnetRadius * FailRadiusFactor,
                symmetry, Occupant != null && Occupant != part);
        }

        /// <summary>Encaja la pieza sin evaluar (para armar el conjunto inicial o desde una pista del docente).</summary>
        public void ForceSnap(SnappablePart part, bool animate = false)
        {
            if (part == null || Occupant != null)
            {
                return;
            }
            DoSnap(part, animate ? snapSeconds : 0f, false);
        }

        /// <summary>La pieza encajada se sacó (la tomaron de nuevo). Lo llama <see cref="SnappablePart"/>.</summary>
        public void Unsnap(SnappablePart part)
        {
            if (part == null || part != Occupant)
            {
                return;
            }
            if (lockWhenSnapped)
            {
                return;
            }
            Occupant = null;
            part.Detach();
            if (telemetry != null)
            {
                telemetry.NotifyUnplaced();
            }
            onUnsnapped.Invoke(part);
        }

        private void OnCandidateReleased(SnappablePart part)
        {
            if (part == null || part.IsSnapped)
            {
                return;
            }
            // Si varias zonas reciben la misma pieza, la toma la más cercana que la acepte.
            SnapEvaluation e = Evaluate(part);
            if (e.Accepted)
            {
                if (IsClosestAcceptingZone(part, e.Distance))
                {
                    DoSnap(part, snapSeconds, true);
                }
                return;
            }
            if (!e.InMagnetRange || HasAcceptingZoneNearby(part) || !IsClosestZone(part, e.Distance))
            {
                return; // soltada lejos, otra zona la toma o la más cercana ya registra el error: no se cuenta dos veces
            }
            string reason = SnapMath.Explain(e.Rejection);
            if (telemetry != null)
            {
                telemetry.Log(Telemetry.TelemetryEventType.SnapFail, part.name, name,
                    $"{reason} (distancia {e.Distance * 100f:0.0} cm, giro {e.AngleDegrees:0}°)");
            }
            onRejected.Invoke(part, reason);
        }

        private void DoSnap(SnappablePart part, float seconds, bool log)
        {
            Transform a = AttachPoint;
            Quaternion rot = SnapMath.ClosestSymmetricRotation(part.transform.rotation, a.rotation, symmetry);
            Occupant = part;
            if (_candidates.Remove(part))
            {
                part.Released -= OnCandidateReleased;
            }
            part.AttachTo(this, a, rot, seconds);
            SetGhost(false);
            if (log && telemetry != null)
            {
                telemetry.Log(Telemetry.TelemetryEventType.SnapOk, part.name, name, $"tolerancia {fitTolerance * 1000f:0.#} mm");
            }
            onSnapped.Invoke(part);
        }

        private bool IsClosestAcceptingZone(SnappablePart part, float myDistance)
        {
            foreach (SnapZone z in OtherZonesWith(part))
            {
                SnapEvaluation o = z.Evaluate(part);
                if (o.Accepted && o.Distance < myDistance)
                {
                    return false;
                }
            }
            return true;
        }

        private bool IsClosestZone(SnappablePart part, float myDistance)
        {
            foreach (SnapZone z in OtherZonesWith(part))
            {
                float d = Vector3.Distance(part.transform.position, z.AttachPoint.position);
                if (d < myDistance || (Mathf.Approximately(d, myDistance) && z.GetInstanceID() < GetInstanceID()))
                {
                    return false;
                }
            }
            return true;
        }

        private bool HasAcceptingZoneNearby(SnappablePart part)
        {
            foreach (SnapZone z in OtherZonesWith(part))
            {
                if (z.Evaluate(part).Accepted)
                {
                    return true;
                }
            }
            return false;
        }

        // Zonas vecinas que también tienen a la pieza como candidata (se enteran por el mismo evento Released).
        private static readonly List<SnapZone> Registry = new List<SnapZone>();

        private void OnEnable()
        {
            if (!Registry.Contains(this))
            {
                Registry.Add(this);
            }
        }

        private void OnDestroy()
        {
            Registry.Remove(this);
        }

        private IEnumerable<SnapZone> OtherZonesWith(SnappablePart part)
        {
            foreach (SnapZone z in Registry)
            {
                if (z != this && z != null && z.isActiveAndEnabled && z._candidates.Contains(part))
                {
                    yield return z;
                }
            }
        }

        private void SetGhost(bool visible)
        {
            if (ghost != null && ghost.activeSelf != visible)
            {
                ghost.SetActive(visible);
            }
        }

        private void OnDrawGizmosSelected()
        {
            Transform a = AttachPoint;
            Gizmos.color = new Color(0.2f, 0.85f, 0.45f, 0.35f);
            Gizmos.DrawWireSphere(a.position, magnetRadius);
            Gizmos.color = new Color(1f, 0.35f, 0.3f, 0.25f);
            Gizmos.DrawWireSphere(a.position, magnetRadius * FailRadiusFactor);
        }
    }
}

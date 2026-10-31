using System;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace XRLab
{
    /// <summary>
    /// Pieza que se puede tomar (con las manos o los controles, vía XR Interaction Toolkit) y encajar en una
    /// <see cref="SnapZone"/>. Avisa cuándo se toma y se suelta, y hace el último tramo del encaje (el «imán»):
    /// se desliza hasta el punto de encaje y queda cinemática.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Rigidbody))]
    [AddComponentMenu("XR Lab/Snappable Part")]
    public sealed class SnappablePart : MonoBehaviour
    {
        [Tooltip("Tipo de pieza que comparan los encajes. Vacío: sale del nombre (Part_Placa_OBC → placa_obc).")]
        [SerializeField] private string partType;
        [SerializeField] private XRGrabInteractable grab;
        [SerializeField] private Rigidbody body;

        [Header("Telemetría (opcional)")]
        [SerializeField] private TelemetryLogger telemetry;

        private bool _wasKinematic;
        private Transform _originalParent; // padre antes de encajar: ahí vuelve al sacarla
        private Vector3 _fromPosition;
        private Quaternion _fromRotation;
        private Vector3 _toPosition;
        private Quaternion _toRotation;
        private float _snapDuration;
        private float _snapElapsed;
        private bool _animating;

        /// <summary>Tipo efectivo (ya resuelto desde el nombre si no se configuró).</summary>
        public string PartType => string.IsNullOrEmpty(partType) ? ManifestMath.PartTypeFromNode(name) : partType;

        /// <summary>La pieza está en la mano del alumno.</summary>
        public bool IsHeld { get; private set; }

        /// <summary>Encaje en el que está (null si está suelta).</summary>
        public SnapZone CurrentZone { get; private set; }

        public bool IsSnapped => CurrentZone != null;

        /// <summary>Se tomó la pieza.</summary>
        public event Action<SnappablePart> Grabbed;

        /// <summary>Se soltó la pieza (los encajes cercanos deciden si la toman).</summary>
        public event Action<SnappablePart> Released;

        private void Reset()
        {
            grab = GetComponent<XRGrabInteractable>();
            body = GetComponent<Rigidbody>();
        }

        private void Awake()
        {
            if (grab == null)
            {
                grab = GetComponent<XRGrabInteractable>();
            }
            if (body == null)
            {
                body = GetComponent<Rigidbody>();
            }
            if (telemetry == null)
            {
                telemetry = FindAnyObjectByType<TelemetryLogger>();
            }
        }

        private void OnEnable()
        {
            if (grab != null)
            {
                grab.selectEntered.AddListener(OnSelectEntered);
                grab.selectExited.AddListener(OnSelectExited);
            }
        }

        private void OnDisable()
        {
            if (grab != null)
            {
                grab.selectEntered.RemoveListener(OnSelectEntered);
                grab.selectExited.RemoveListener(OnSelectExited);
            }
        }

        private void Update()
        {
            if (!_animating)
            {
                return;
            }
            _snapElapsed += Time.deltaTime;
            float k = _snapDuration <= 0f ? 1f : ExplodedViewMath.Ease(_snapElapsed / _snapDuration, EaseCurve.SmoothStep);
            transform.SetPositionAndRotation(
                Vector3.Lerp(_fromPosition, _toPosition, k),
                Quaternion.Slerp(_fromRotation, _toRotation, k));
            if (k >= 1f)
            {
                _animating = false;
            }
        }

        /// <summary>Lo llama la pieza misma o un sistema de entrada propio (mouse en el editor, por ejemplo).</summary>
        public void NotifyGrabbed()
        {
            if (IsHeld)
            {
                return;
            }
            IsHeld = true;
            _animating = false;
            if (CurrentZone != null)
            {
                CurrentZone.Unsnap(this);
            }
            if (telemetry != null)
            {
                telemetry.Log(Telemetry.TelemetryEventType.Grab, name);
            }
            Grabbed?.Invoke(this);
        }

        public void NotifyReleased()
        {
            if (!IsHeld)
            {
                return;
            }
            IsHeld = false;
            if (telemetry != null)
            {
                telemetry.Log(Telemetry.TelemetryEventType.Release, name);
            }
            Released?.Invoke(this);
        }

        /// <summary>
        /// Encaja la pieza: queda cinemática, colgada del punto de encaje, y se desliza hasta él en
        /// <paramref name="seconds"/> segundos. Lo llama <see cref="SnapZone"/>.
        /// </summary>
        public void AttachTo(SnapZone zone, Transform attachPoint, Quaternion worldRotation, float seconds)
        {
            if (body == null)
            {
                body = GetComponent<Rigidbody>(); // por si se encaja antes de Awake (al armar la escena desde el editor)
            }
            if (CurrentZone == null)
            {
                _originalParent = transform.parent;
            }
            CurrentZone = zone;
            if (body != null)
            {
                _wasKinematic = body.isKinematic;
                body.linearVelocity = Vector3.zero;
                body.angularVelocity = Vector3.zero;
                body.isKinematic = true;
            }
            _fromPosition = transform.position;
            _fromRotation = transform.rotation;
            _toPosition = attachPoint.position;
            _toRotation = worldRotation;
            _snapDuration = Mathf.Max(0f, seconds);
            _snapElapsed = 0f;
            _animating = true;
            transform.SetParent(attachPoint, true);
            if (_snapDuration <= 0f)
            {
                transform.SetPositionAndRotation(_toPosition, _toRotation);
                _animating = false;
            }
        }

        /// <summary>Sale del encaje (la tomaron de nuevo): vuelve a su padre original y recupera la física.</summary>
        public void Detach()
        {
            CurrentZone = null;
            _animating = false;
            transform.SetParent(_originalParent, true);
            if (body != null)
            {
                body.isKinematic = _wasKinematic;
            }
        }

        private void OnSelectEntered(SelectEnterEventArgs args)
        {
            NotifyGrabbed();
        }

        private void OnSelectExited(SelectExitEventArgs args)
        {
            // Si otra mano la sigue sosteniendo (traspaso entre manos), no se suelta todavía.
            if (grab != null && grab.isSelected)
            {
                return;
            }
            NotifyReleased();
        }
    }
}

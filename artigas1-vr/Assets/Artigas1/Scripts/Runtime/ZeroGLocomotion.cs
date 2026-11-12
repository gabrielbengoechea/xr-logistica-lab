using System;
using System.Collections.Generic;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Locomoción «mano sobre mano» en gravedad cero (sección 1.1 del plan). Va en la raíz del XR Origin.
    /// <list type="bullet">
    /// <item>Con una o dos manos en una <see cref="Agarradera"/>, el cuerpo se mueve al revés que la mano: la mano
    /// queda clavada en la baranda y el cuerpo viaja.</item>
    /// <item>Al soltar, el cuerpo hereda la velocidad promedio de los últimos cuadros, con un tope.</item>
    /// <item>Sin agarre, flota con amortiguación y se frena contra las paredes (con o sin rebote).</item>
    /// </list>
    /// La rotación queda a cargo del giro por pasos de XR Interaction Toolkit.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Locomoción en gravedad cero")]
    public sealed class ZeroGLocomotion : MonoBehaviour
    {
        [Tooltip("Raíz que se mueve (el XR Origin). Vacío: este objeto.")]
        [SerializeField] private Transform rig;
        [Tooltip("Cámara del visor: de ahí se mide el choque del cuerpo.")]
        [SerializeField] private Transform cabeza;
        [SerializeField] private ModoConfort modo = ModoConfort.Confort;

        [Header("Choques")]
        [SerializeField] private float radioCuerpo = 0.25f;
        [SerializeField] private float piel = 0.02f;
        [SerializeField] private LayerMask capasChoque = ~0;

        [Header("Viñeta")]
        [Tooltip("Suavizado de la aceleración que maneja la viñeta (s).")]
        [SerializeField] private float suavizadoAceleracion = 0.15f;

        private readonly List<Agarre> _agarres = new List<Agarre>(2);
        private readonly RaycastHit[] _hits = new RaycastHit[16];
        private VelocityBuffer _buffer = new VelocityBuffer(8);
        private ComfortProfile _perfil;
        private Vector3 _velocidad;
        private Vector3 _velocidadAnterior;
        private float _aceleracion;
        private Quaternion _rotacionAnterior;

        private struct Agarre
        {
            public Transform mano;
            public Vector3 ancla;
            public Agarradera baranda;
        }

        /// <summary>Perfil activo (cambia con <see cref="CambiarModo"/>).</summary>
        public ComfortProfile Perfil => _perfil ??= ComfortProfile.For(modo);

        public ModoConfort Modo => modo;

        /// <summary>Velocidad actual del cuerpo (m/s).</summary>
        public Vector3 Velocidad => _velocidad;

        /// <summary>Hay al menos una mano en una baranda.</summary>
        public bool Agarrado => _agarres.Count > 0;

        /// <summary>Apertura de viñeta sugerida (1 = sin viñeta). La aplica <see cref="ConfortVineta"/>.</summary>
        public float AperturaVineta =>
            Perfil.vineta ? ZeroGMath.VignetteAperture(_aceleracion, Perfil.aceleracionVinetaMax, Perfil.aperturaMinima) : 1f;

        /// <summary>Se tomó (true) o se soltó (false) una baranda.</summary>
        public event Action<Agarradera, bool> AgarreCambiado;

        /// <summary>El cuerpo chocó contra algo, con la velocidad de entrada (m/s).</summary>
        public event Action<float> Choque;

        private void Awake()
        {
            if (rig == null)
            {
                rig = transform;
            }
            if (cabeza == null && Camera.main != null)
            {
                cabeza = Camera.main.transform;
            }
            _perfil = ComfortProfile.For(modo);
            _buffer = new VelocityBuffer(Mathf.Max(8, _perfil.cuadrosAlSoltar));
            _rotacionAnterior = rig.rotation;
        }

        public void CambiarModo(ModoConfort nuevo)
        {
            modo = nuevo;
            _perfil = ComfortProfile.For(nuevo);
        }

        public void AlternarModo()
        {
            CambiarModo(modo == ModoConfort.Confort ? ModoConfort.Realista : ModoConfort.Confort);
        }

        /// <summary>Una mano tomó una baranda. Lo llama <see cref="Agarradera"/>.</summary>
        public void BeginGrip(Transform mano, Agarradera baranda)
        {
            if (mano == null)
            {
                return;
            }
            for (int i = 0; i < _agarres.Count; i++)
            {
                if (_agarres[i].mano == mano)
                {
                    return;
                }
            }
            _agarres.Add(new Agarre { mano = mano, ancla = mano.position, baranda = baranda });
            if (_agarres.Count == 1)
            {
                _velocidad = Vector3.zero; // agarrarse frena
                _buffer.Clear();
            }
            AgarreCambiado?.Invoke(baranda, true);
        }

        /// <summary>Una mano soltó una baranda. Si era la última, el cuerpo sale con la velocidad de la mano.</summary>
        public void EndGrip(Transform mano)
        {
            for (int i = _agarres.Count - 1; i >= 0; i--)
            {
                if (_agarres[i].mano != mano)
                {
                    continue;
                }
                QuitarAgarre(i);
                if (_agarres.Count == 0)
                {
                    _velocidad = ZeroGMath.ReleaseVelocity(_buffer, Perfil.cuadrosAlSoltar, Perfil.velocidadMaxima);
                }
                return;
            }
        }

        private void QuitarAgarre(int i)
        {
            Agarradera b = _agarres[i].baranda;
            _agarres.RemoveAt(i);
            AgarreCambiado?.Invoke(b, false);
        }

        /// <summary>Corta todo agarre y deja el cuerpo quieto (p. ej. al cambiar de módulo por el mapa).</summary>
        public void Detener()
        {
            while (_agarres.Count > 0)
            {
                QuitarAgarre(_agarres.Count - 1);
            }
            _velocidad = Vector3.zero;
            _buffer.Clear();
        }

        private void LateUpdate()
        {
            float dt = Time.deltaTime;
            if (dt <= 0f)
            {
                return;
            }
            // El giro por pasos rota el rig alrededor de la cabeza: se re-anclan las manos para no arrastrar el cuerpo.
            if (rig.rotation != _rotacionAnterior)
            {
                for (int i = 0; i < _agarres.Count; i++)
                {
                    Agarre a = _agarres[i];
                    a.ancla = a.mano.position;
                    _agarres[i] = a;
                }
                _rotacionAnterior = rig.rotation;
            }

            if (_agarres.Count > 0)
            {
                Vector3 delta = Vector3.zero;
                for (int i = 0; i < _agarres.Count; i++)
                {
                    delta += _agarres[i].ancla - _agarres[i].mano.position;
                }
                delta /= _agarres.Count;
                Vector3 movido = Mover(delta, false);
                _buffer.Push(movido / dt);
                _velocidad = movido / dt;
            }
            else
            {
                _velocidad = ZeroGMath.Drift(_velocidad, Perfil.amortiguacion, Perfil.velocidadMinima, dt);
                if (_velocidad != Vector3.zero)
                {
                    Mover(_velocidad * dt, true);
                }
            }

            float a = (_velocidad - _velocidadAnterior).magnitude / dt;
            float k = suavizadoAceleracion > 0f ? 1f - Mathf.Exp(-dt / suavizadoAceleracion) : 1f;
            _aceleracion = Mathf.Lerp(_aceleracion, a, k);
            _velocidadAnterior = _velocidad;
        }

        /// <summary>Mueve el rig hasta donde lo deje la geometría. Devuelve el desplazamiento real.</summary>
        private Vector3 Mover(Vector3 delta, bool flotando)
        {
            float dist = delta.magnitude;
            if (dist < 1e-6f)
            {
                return Vector3.zero;
            }
            Vector3 dir = delta / dist;
            Vector3 origen = cabeza != null ? cabeza.position : rig.position;
            int n = Physics.SphereCastNonAlloc(origen, radioCuerpo, dir, _hits, dist + piel, capasChoque, QueryTriggerInteraction.Ignore);
            float permitido = dist;
            Vector3 normal = Vector3.zero;
            bool choco = false;
            for (int i = 0; i < n; i++)
            {
                RaycastHit h = _hits[i];
                if (h.collider == null || h.collider.transform.IsChildOf(rig))
                {
                    continue; // el propio cuerpo, los controles
                }
                if (h.rigidbody != null && !h.rigidbody.isKinematic)
                {
                    continue; // carga suelta: no frena al cuerpo
                }
                if (h.distance <= 0f)
                {
                    // ya estaba tocando: solo se frena si se mueve hacia adentro
                    if (Vector3.Dot(dir, h.normal) < 0f)
                    {
                        permitido = 0f;
                        normal = h.normal;
                        choco = true;
                    }
                    continue;
                }
                float d = Mathf.Max(0f, h.distance - piel);
                if (d < permitido)
                {
                    permitido = d;
                    normal = h.normal;
                    choco = true;
                }
            }
            Vector3 mov = dir * permitido;
            rig.position += mov;
            if (choco && flotando)
            {
                float entrada = -Vector3.Dot(_velocidad, normal);
                _velocidad = ZeroGMath.Collide(_velocidad, normal, Perfil.rebote);
                if (entrada > 0.05f)
                {
                    Choque?.Invoke(entrada);
                }
            }
            return mov;
        }
    }
}

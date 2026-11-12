using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Objeto suelto en microgravedad: una herramienta, un portapapeles, un paquete. Arranca con una deriva y un
    /// giro lentos y después lo mueve la física de Unity sin gravedad: rebota en la estación y el astronauta lo
    /// empuja al tocarlo. El aire de la cabina lo frena de a poco (amortiguación lineal baja; el giro no se frena).
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public sealed class ObjetoFlotante : MonoBehaviour
    {
        [SerializeField] private float masa = 0.3f;
        [SerializeField] private float deriva = 0.012f;
        [SerializeField] private float giroMinimo = 0.06f;
        [SerializeField] private float giroMaximo = 0.32f;
        [SerializeField] private float amortiguacion = 0.10f;

        private Rigidbody _cuerpo;

        private void Awake()
        {
            _cuerpo = GetComponent<Rigidbody>();
            _cuerpo.useGravity = false;
            _cuerpo.mass = masa;
            _cuerpo.linearDamping = amortiguacion;
            _cuerpo.angularDamping = 0f;
            _cuerpo.interpolation = RigidbodyInterpolation.Interpolate;
            _cuerpo.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            if (GetComponent<Collider>() == null)
            {
                // Una esfera alcanza para objetos chicos y es el collider más barato.
                MeshFilter filtro = GetComponent<MeshFilter>();
                SphereCollider esfera = gameObject.AddComponent<SphereCollider>();
                if (filtro != null && filtro.sharedMesh != null)
                {
                    Bounds b = filtro.sharedMesh.bounds;
                    esfera.center = b.center;
                    esfera.radius = Mathf.Clamp(b.extents.magnitude * 0.72f, 0.03f, 0.22f);
                }
                else
                {
                    esfera.radius = 0.08f;
                }
            }
        }

        private void Start()
        {
            _cuerpo.linearVelocity = Random.onUnitSphere * deriva;
            _cuerpo.angularVelocity = Random.onUnitSphere * Random.Range(giroMinimo, giroMaximo);
        }
    }
}

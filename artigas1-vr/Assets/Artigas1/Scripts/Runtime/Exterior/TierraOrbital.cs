using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Gira la Tierra muy despacio y siempre en el mismo sentido (sensación de órbita) y le pasa al material
    /// la dirección del sol, para que el terminador y las luces urbanas coincidan con la luz de la escena.
    /// </summary>
    [AddComponentMenu("Artigas-1/Tierra en órbita")]
    public sealed class TierraOrbital : MonoBehaviour
    {
        [SerializeField] private Light sol;
        [SerializeField] private Renderer[] superficies = new Renderer[0];
        [Tooltip("Grados por minuto. La órbita real es una vuelta cada 90 min (4°/min); para la demo alcanza con 0,5.")]
        [SerializeField] private float gradosPorMinuto = 0.5f;
        [SerializeField] private Vector3 ejeMundo = Vector3.right;

        private static readonly int SolDir = Shader.PropertyToID("_SolDir");
        private MaterialPropertyBlock _bloque;

        private void Awake()
        {
            _bloque = new MaterialPropertyBlock();
        }

        private void Update()
        {
            transform.Rotate(ejeMundo, gradosPorMinuto / 60f * Time.deltaTime, Space.World);
            if (sol == null)
            {
                return;
            }
            Vector4 dir = -sol.transform.forward;
            foreach (Renderer r in superficies)
            {
                if (r == null)
                {
                    continue;
                }
                r.GetPropertyBlock(_bloque);
                _bloque.SetVector(SolDir, dir);
                r.SetPropertyBlock(_bloque);
            }
        }
    }
}

using UnityEngine;
using UnityEngine.SceneManagement;

namespace Artigas1
{
    /// <summary>Pasa de una escena a otra (interior ↔ caminata espacial). Se conecta a un <see cref="BotonFisico"/>.</summary>
    [AddComponentMenu("Artigas-1/Cambio de escena")]
    public sealed class CambioDeEscena : MonoBehaviour
    {
        [SerializeField] private string escena = "F5_Exterior";

        public void Configurar(string nombre)
        {
            escena = nombre;
        }

        public void Ir()
        {
            Debug.Log($"[Artigas1] Cambio de escena: {escena}", this);
            SceneManager.LoadScene(escena);
        }
    }
}

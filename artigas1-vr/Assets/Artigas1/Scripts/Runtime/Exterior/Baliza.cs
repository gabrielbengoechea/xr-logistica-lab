using UnityEngine;

namespace Artigas1
{
    /// <summary>Luz intermitente que marca un objetivo de la actividad (se apaga cuando la actividad termina).</summary>
    [AddComponentMenu("Artigas-1/Baliza")]
    public sealed class Baliza : MonoBehaviour
    {
        [SerializeField] private Renderer luz;
        [SerializeField] private ActividadBase actividad;
        [SerializeField] private float periodo = 1.2f;

        public void Configurar(Renderer r, ActividadBase a)
        {
            luz = r;
            actividad = a;
        }

        private void Update()
        {
            if (luz == null)
            {
                return;
            }
            bool terminada = actividad != null && actividad.Estado == EstadoActividad.Completada;
            bool encendida = !terminada && Mathf.Repeat(Time.time, periodo) < periodo * 0.5f;
            LuzEstado.Pintar(luz, terminada ? LuzEstado.Verde : encendida ? LuzEstado.Ambar : LuzEstado.Apagada);
        }
    }
}

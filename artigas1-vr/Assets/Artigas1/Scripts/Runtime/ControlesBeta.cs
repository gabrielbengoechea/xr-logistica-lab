using UnityEngine;
using UnityEngine.InputSystem;

namespace Artigas1
{
    /// <summary>
    /// Botones de prueba de la fase 1 (sin menú todavía):
    /// <list type="bullet">
    /// <item>A (control derecho) o tecla M: alterna Confort / Realista.</item>
    /// <item>X (control izquierdo) o tecla F: frena el cuerpo en seco (para el observador de la prueba).</item>
    /// </list>
    /// Las acciones se crean en código para no depender de un asset de entrada.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("Artigas-1/Controles de la Beta")]
    public sealed class ControlesBeta : MonoBehaviour
    {
        [SerializeField] private ZeroGLocomotion locomocion;

        private InputAction _modo;
        private InputAction _frenar;

        private void Awake()
        {
            if (locomocion == null)
            {
                locomocion = FindAnyObjectByType<ZeroGLocomotion>();
            }
            _modo = new InputAction("AlternarModo", InputActionType.Button);
            _modo.AddBinding("<XRController>{RightHand}/primaryButton");
            _modo.AddBinding("<Keyboard>/m");
            _frenar = new InputAction("Frenar", InputActionType.Button);
            _frenar.AddBinding("<XRController>{LeftHand}/primaryButton");
            _frenar.AddBinding("<Keyboard>/f");
        }

        private void OnEnable()
        {
            _modo.performed += OnModo;
            _frenar.performed += OnFrenar;
            _modo.Enable();
            _frenar.Enable();
        }

        private void OnDisable()
        {
            _modo.performed -= OnModo;
            _frenar.performed -= OnFrenar;
            _modo.Disable();
            _frenar.Disable();
        }

        private void OnDestroy()
        {
            _modo?.Dispose();
            _frenar?.Dispose();
        }

        private void OnModo(InputAction.CallbackContext ctx)
        {
            if (locomocion == null)
            {
                return;
            }
            locomocion.AlternarModo();
            Debug.Log($"[Artigas1] Modo de locomoción: {locomocion.Modo}", this);
        }

        private void OnFrenar(InputAction.CallbackContext ctx)
        {
            if (locomocion != null)
            {
                locomocion.Detener();
            }
        }
    }
}

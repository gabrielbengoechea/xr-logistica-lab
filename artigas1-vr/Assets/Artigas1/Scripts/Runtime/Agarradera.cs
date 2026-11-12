using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace Artigas1
{
    /// <summary>
    /// Baranda, asa o borde de escotilla del que el astronauta se puede tomar para moverse. Usa un
    /// XRSimpleInteractable (botón de agarre del control) y le avisa a <see cref="ZeroGLocomotion"/>.
    /// Las dos manos pueden tomar la misma baranda.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(XRSimpleInteractable))]
    [AddComponentMenu("Artigas-1/Agarradera")]
    public sealed class Agarradera : MonoBehaviour
    {
        [SerializeField] private XRSimpleInteractable interactable;
        [SerializeField] private ZeroGLocomotion locomocion;

        private void Reset()
        {
            interactable = GetComponent<XRSimpleInteractable>();
        }

        private void Awake()
        {
            if (interactable == null)
            {
                interactable = GetComponent<XRSimpleInteractable>();
            }
            interactable.selectMode = InteractableSelectMode.Multiple;
            if (locomocion == null)
            {
                locomocion = FindAnyObjectByType<ZeroGLocomotion>();
            }
        }

        private void OnEnable()
        {
            interactable.selectEntered.AddListener(OnSelectEntered);
            interactable.selectExited.AddListener(OnSelectExited);
        }

        private void OnDisable()
        {
            interactable.selectEntered.RemoveListener(OnSelectEntered);
            interactable.selectExited.RemoveListener(OnSelectExited);
        }

        private void OnSelectEntered(SelectEnterEventArgs args)
        {
            if (locomocion != null)
            {
                locomocion.BeginGrip(args.interactorObject.transform, this);
            }
        }

        private void OnSelectExited(SelectExitEventArgs args)
        {
            if (locomocion != null)
            {
                locomocion.EndGrip(args.interactorObject.transform);
            }
        }
    }
}

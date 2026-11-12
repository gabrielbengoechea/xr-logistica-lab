using System.Collections.Generic;
using UnityEngine;

namespace Artigas1
{
    /// <summary>
    /// Portal RFID de la escotilla de acople (Módulo Colonia): toda carga que cruza el volumen se registra sola,
    /// una vez. La luz parpadea en verde si está en el manifiesto y en rojo si no.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(BoxCollider))]
    [AddComponentMenu("Artigas-1/Portal RFID")]
    public sealed class PortalRfid : MonoBehaviour
    {
        [SerializeField] private InventoryService inventario;
        [SerializeField] private Renderer luz;

        private readonly HashSet<CargoUnit> _leidas = new HashSet<CargoUnit>();
        private Color _color = LuzEstado.Verde;
        private float _hasta;
        private bool _encendida = true;

        public int Leidas => _leidas.Count;

        private void Awake()
        {
            GetComponent<BoxCollider>().isTrigger = true;
            if (inventario == null)
            {
                inventario = FindAnyObjectByType<InventoryService>();
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            CargoUnit c = other.attachedRigidbody != null ? other.attachedRigidbody.GetComponent<CargoUnit>() : null;
            if (c == null || !_leidas.Add(c) || inventario == null)
            {
                return;
            }
            ResultadoLectura r = inventario.Leer(c, "rfid");
            _color = r == ResultadoLectura.EnManifiesto || r == ResultadoLectura.Repetida ? LuzEstado.Verde : LuzEstado.Rojo;
            _hasta = Time.time + 1f;
        }

        private void Update()
        {
            bool parpadeo = Time.time < _hasta;
            bool encender = !parpadeo || Mathf.Repeat(Time.time * 5f, 1f) < 0.5f;
            if (encender != _encendida || parpadeo)
            {
                LuzEstado.Pintar(luz, encender ? (parpadeo ? _color : LuzEstado.Verde) : LuzEstado.Apagada);
                _encendida = encender;
            }
        }
    }
}

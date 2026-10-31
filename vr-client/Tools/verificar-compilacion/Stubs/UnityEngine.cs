// Firmas mínimas del motor de Unity (solo para compilar fuera del editor; los cuerpos no hacen nada útil).
using System;
using System.Collections.Generic;

namespace UnityEngine
{
    public class Object
    {
        public string name { get; set; } = string.Empty;
        public int GetInstanceID() => 0;
        public static T FindAnyObjectByType<T>() where T : Object => null;
        public static T[] FindObjectsByType<T>(FindObjectsSortMode sortMode) where T : Object => Array.Empty<T>();
        public static void Destroy(Object obj) { }
        public static void DestroyImmediate(Object obj) { }

        public static bool operator ==(Object a, Object b) => ReferenceEquals(a, b);
        public static bool operator !=(Object a, Object b) => !ReferenceEquals(a, b);
        public static implicit operator bool(Object o) => !ReferenceEquals(o, null);
        public override bool Equals(object other) => ReferenceEquals(this, other);
        public override int GetHashCode() => base.GetHashCode();
    }

    public enum FindObjectsSortMode
    {
        None,
        InstanceID,
    }

    public class Component : Object
    {
        public Transform transform => null;
        public GameObject gameObject => null;
        public T GetComponent<T>() => default;
        public bool TryGetComponent<T>(out T component) { component = default; return false; }
        public T GetComponentInParent<T>() => default;
        public T[] GetComponentsInChildren<T>() => Array.Empty<T>();
        public T[] GetComponentsInChildren<T>(bool includeInactive) => Array.Empty<T>();
    }

    public class Behaviour : Component
    {
        public bool enabled { get; set; }
        public bool isActiveAndEnabled => enabled;
    }

    public class MonoBehaviour : Behaviour
    {
    }

    public sealed class GameObject : Object
    {
        public GameObject() { }
        public GameObject(string name) { this.name = name; }
        public bool activeSelf => true;
        public Transform transform => null;
        public void SetActive(bool value) { }
        public T AddComponent<T>() where T : Component => null;
        public T GetComponent<T>() => default;
        public T[] GetComponentsInChildren<T>(bool includeInactive) => Array.Empty<T>();
    }

    public class Transform : Component, System.Collections.IEnumerable
    {
        public Vector3 position { get; set; }
        public Quaternion rotation { get; set; }
        public Vector3 localPosition { get; set; }
        public Quaternion localRotation { get; set; }
        public Vector3 localScale { get; set; }
        public Transform parent { get; set; }
        public int childCount => 0;
        public void SetParent(Transform parent, bool worldPositionStays) { }
        public void SetPositionAndRotation(Vector3 position, Quaternion rotation) { }
        public Vector3 TransformVector(Vector3 v) => v;
        public Vector3 InverseTransformVector(Vector3 v) => v;
        public Vector3 TransformPoint(Vector3 p) => p;
        public Vector3 InverseTransformPoint(Vector3 p) => p;
        public bool IsChildOf(Transform parent) => false;
        public Transform GetChild(int index) => null;
        public System.Collections.IEnumerator GetEnumerator() { yield break; }
    }

    public class Collider : Component
    {
        public bool isTrigger { get; set; }
        public Rigidbody attachedRigidbody => null;
        public Bounds bounds => default;
    }

    public sealed class SphereCollider : Collider
    {
        public float radius { get; set; }
        public Vector3 center { get; set; }
    }

    public sealed class BoxCollider : Collider
    {
        public Vector3 size { get; set; }
        public Vector3 center { get; set; }
    }

    public sealed class MeshCollider : Collider
    {
        public bool convex { get; set; }
    }

    public sealed class MeshFilter : Component
    {
    }

    public sealed class Rigidbody : Component
    {
        public bool isKinematic { get; set; }
        public bool useGravity { get; set; }
        public Vector3 linearVelocity { get; set; }
        public Vector3 angularVelocity { get; set; }
    }

    public class Renderer : Component
    {
        public Bounds bounds => default;
        public bool enabled { get; set; }
    }

    public static class Time
    {
        public static float deltaTime => 0f;
        public static float unscaledTime => 0f;
        public static float time => 0f;
        public static double realtimeSinceStartupAsDouble => 0d;
    }

    public static class Debug
    {
        public static void Log(object message) { }
        public static void Log(object message, Object context) { }
        public static void LogWarning(object message) { }
        public static void LogWarning(object message, Object context) { }
        public static void LogError(object message) { }
        public static void LogError(object message, Object context) { }
        public static void LogException(Exception exception) { }
    }

    public static class Application
    {
        public static bool isEditor => false;
        public static bool isBatchMode => false;
        public static string persistentDataPath => string.Empty;
        public static string unityVersion => "6000.0";
    }

    public static class PlayerPrefs
    {
        public static string GetString(string key, string defaultValue) => defaultValue;
        public static void SetString(string key, string value) { }
        public static void Save() { }
    }

    public static class SystemInfo
    {
        public static string deviceModel => string.Empty;
    }

    public static class Gizmos
    {
        public static Color color { get; set; }
        public static void DrawWireSphere(Vector3 center, float radius) { }
    }

    public static class JsonUtility
    {
        public static T FromJson<T>(string json) => default;
        public static string ToJson(object obj) => string.Empty;
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class SerializeField : Attribute
    {
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class HeaderAttribute : Attribute
    {
        public HeaderAttribute(string header) { }
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class TooltipAttribute : Attribute
    {
        public TooltipAttribute(string tooltip) { }
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class RangeAttribute : Attribute
    {
        public RangeAttribute(float min, float max) { }
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class MinAttribute : Attribute
    {
        public MinAttribute(float min) { }
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public sealed class RequireComponent : Attribute
    {
        public RequireComponent(Type requiredComponent) { }
    }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class DisallowMultipleComponent : Attribute
    {
    }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class AddComponentMenu : Attribute
    {
        public AddComponentMenu(string menuName) { }
    }
}

namespace UnityEngine.Events
{
    public class UnityEvent
    {
        public void AddListener(Action call) { }
        public void RemoveListener(Action call) { }
        public void Invoke() { }
    }

    public class UnityEvent<T0>
    {
        public void AddListener(Action<T0> call) { }
        public void RemoveListener(Action<T0> call) { }
        public void Invoke(T0 arg0) { }
    }

    public class UnityEvent<T0, T1>
    {
        public void AddListener(Action<T0, T1> call) { }
        public void RemoveListener(Action<T0, T1> call) { }
        public void Invoke(T0 arg0, T1 arg1) { }
    }
}

namespace UnityEngine.Rendering
{
    public enum GraphicsDeviceType
    {
        OpenGLES3 = 11,
        Vulkan = 21,
    }
}

namespace UnityEngine
{
    public class AsyncOperation
    {
        public bool isDone => false;
        public event Action<AsyncOperation> completed { add { } remove { } }
    }
}

namespace UnityEngine.Networking
{
    public sealed class UnityWebRequestAsyncOperation : AsyncOperation
    {
        public UnityWebRequest webRequest => null;
    }

    public class UploadHandler : IDisposable
    {
        public string contentType { get; set; }
        public void Dispose() { }
    }

    public sealed class UploadHandlerRaw : UploadHandler
    {
        public UploadHandlerRaw(byte[] data) { }
    }

    public class DownloadHandler : IDisposable
    {
        public string text => string.Empty;
        public void Dispose() { }
    }

    public sealed class DownloadHandlerBuffer : DownloadHandler
    {
    }

    public sealed class UnityWebRequest : IDisposable
    {
        public const string kHttpVerbGET = "GET";
        public const string kHttpVerbPOST = "POST";

        public enum Result
        {
            InProgress,
            Success,
            ConnectionError,
            ProtocolError,
            DataProcessingError,
        }

        public UnityWebRequest(string url, string method) { }
        public UploadHandler uploadHandler { get; set; }
        public DownloadHandler downloadHandler { get; set; }
        public int timeout { get; set; }
        public Result result => Result.InProgress;
        public long responseCode => 0;
        public string error => null;
        public void SetRequestHeader(string name, string value) { }
        public UnityWebRequestAsyncOperation SendWebRequest() => new UnityWebRequestAsyncOperation();
        public void Abort() { }
        public void Dispose() { }
        public static UnityWebRequest Get(string uri) => new UnityWebRequest(uri, kHttpVerbGET);
    }
}

namespace UnityEngine.XR.Management
{
    public class XRLoader : Object
    {
    }

    public sealed class XRManagerSettings : Object
    {
        public IReadOnlyList<XRLoader> activeLoaders => Array.Empty<XRLoader>();
    }

    public sealed class XRGeneralSettings : Object
    {
        public XRManagerSettings Manager => null;
    }
}

namespace UnityEngine.XR.Interaction.Toolkit
{
    public class BaseInteractionEventArgs
    {
    }

    public sealed class SelectEnterEventArgs : BaseInteractionEventArgs
    {
    }

    public sealed class SelectExitEventArgs : BaseInteractionEventArgs
    {
        public bool isCanceled => false;
    }

    public sealed class SelectEnterEvent : UnityEngine.Events.UnityEvent<SelectEnterEventArgs>
    {
    }

    public sealed class SelectExitEvent : UnityEngine.Events.UnityEvent<SelectExitEventArgs>
    {
    }
}

namespace UnityEngine.XR.Interaction.Toolkit.Interactables
{
    public class XRBaseInteractable : MonoBehaviour
    {
        public UnityEngine.XR.Interaction.Toolkit.SelectEnterEvent selectEntered { get; set; } = new UnityEngine.XR.Interaction.Toolkit.SelectEnterEvent();
        public UnityEngine.XR.Interaction.Toolkit.SelectExitEvent selectExited { get; set; } = new UnityEngine.XR.Interaction.Toolkit.SelectExitEvent();
        public bool isSelected => false;
    }

    public class XRGrabInteractable : XRBaseInteractable
    {
    }
}

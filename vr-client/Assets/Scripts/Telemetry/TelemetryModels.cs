using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace XRLab.Telemetry
{
    // Espejo del contrato del backend (backend/app/schemas.py). Los nombres JSON son los del backend.

    /// <summary>Tipos de evento (campo "type").</summary>
    public enum TelemetryEventType
    {
        SessionStart,
        Grab,
        Release,
        SnapOk,
        SnapFail,
        Explode,
        Assemble,
        Hint,
        SessionEnd,
    }

    /// <summary>Dispositivo (campo "device").</summary>
    public enum DeviceType
    {
        Quest3,
        Quest2,
        Editor,
        Web,
    }

    /// <summary>Modo de interacción (campo "interaction").</summary>
    public enum InteractionMode
    {
        Hands,
        Controllers,
        Mouse,
    }

    public static class TelemetryNames
    {
        public static string Of(TelemetryEventType t)
        {
            switch (t)
            {
                case TelemetryEventType.SessionStart: return "session_start";
                case TelemetryEventType.Grab: return "grab";
                case TelemetryEventType.Release: return "release";
                case TelemetryEventType.SnapOk: return "snap_ok";
                case TelemetryEventType.SnapFail: return "snap_fail";
                case TelemetryEventType.Explode: return "explode";
                case TelemetryEventType.Assemble: return "assemble";
                case TelemetryEventType.Hint: return "hint";
                case TelemetryEventType.SessionEnd: return "session_end";
                default: throw new ArgumentOutOfRangeException(nameof(t), t, null);
            }
        }

        public static string Of(DeviceType d)
        {
            switch (d)
            {
                case DeviceType.Quest3: return "quest3";
                case DeviceType.Quest2: return "quest2";
                case DeviceType.Editor: return "editor";
                case DeviceType.Web: return "web";
                default: throw new ArgumentOutOfRangeException(nameof(d), d, null);
            }
        }

        public static string Of(InteractionMode m)
        {
            switch (m)
            {
                case InteractionMode.Hands: return "hands";
                case InteractionMode.Controllers: return "controllers";
                case InteractionMode.Mouse: return "mouse";
                default: throw new ArgumentOutOfRangeException(nameof(m), m, null);
            }
        }

        /// <summary>Deduce el visor a partir de SystemInfo.deviceModel ("Oculus Quest 3", "Meta Quest 3S", "Oculus Quest 2"...).</summary>
        public static DeviceType DeviceFromModel(string deviceModel, bool isEditor)
        {
            if (isEditor)
            {
                return DeviceType.Editor;
            }
            string m = (deviceModel ?? string.Empty).ToLowerInvariant();
            if (m.Contains("quest 2") || m.Contains("quest2"))
            {
                return DeviceType.Quest2;
            }
            return DeviceType.Quest3;
        }
    }

    /// <summary>Un evento de la sesión (segundos desde el inicio).</summary>
    public readonly struct TelemetryEvent
    {
        public readonly double T;
        public readonly TelemetryEventType Type;
        public readonly string Part;
        public readonly string Target;
        public readonly string Detail;

        public TelemetryEvent(double t, TelemetryEventType type, string part = null, string target = null, string detail = null)
        {
            T = t;
            Type = type;
            Part = part;
            Target = target;
            Detail = detail;
        }
    }

    /// <summary>
    /// Escritor JSON mínimo y sin reflexión (JsonUtility no maneja null, DateTime ni diccionarios).
    /// Escapa según RFC 8259 y usa cultura invariante para los números.
    /// </summary>
    public sealed class JsonWriter
    {
        private readonly StringBuilder _sb = new StringBuilder(256);
        private bool _needComma;

        public JsonWriter BeginObject()
        {
            Separator();
            _sb.Append('{');
            _needComma = false;
            return this;
        }

        public JsonWriter EndObject()
        {
            _sb.Append('}');
            _needComma = true;
            return this;
        }

        public JsonWriter BeginArray(string name)
        {
            Name(name);
            _sb.Append('[');
            _needComma = false;
            return this;
        }

        public JsonWriter EndArray()
        {
            _sb.Append(']');
            _needComma = true;
            return this;
        }

        public JsonWriter Field(string name, string value)
        {
            Name(name);
            if (value == null)
            {
                _sb.Append("null");
            }
            else
            {
                Quote(value);
            }
            _needComma = true;
            return this;
        }

        public JsonWriter Field(string name, int value)
        {
            Name(name);
            _sb.Append(value.ToString(CultureInfo.InvariantCulture));
            _needComma = true;
            return this;
        }

        public JsonWriter Field(string name, double value)
        {
            Name(name);
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                _sb.Append("null");
            }
            else
            {
                _sb.Append(value.ToString("R", CultureInfo.InvariantCulture));
            }
            _needComma = true;
            return this;
        }

        public JsonWriter Field(string name, DateTime? value)
        {
            return Field(name, value.HasValue ? value.Value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture) : null);
        }

        /// <summary>Campo opcional: si el valor es null no se escribe.</summary>
        public JsonWriter Optional(string name, string value)
        {
            return value == null ? this : Field(name, value);
        }

        public override string ToString()
        {
            return _sb.ToString();
        }

        private void Name(string name)
        {
            Separator();
            if (name != null)
            {
                Quote(name);
                _sb.Append(':');
            }
            _needComma = false;
        }

        private void Separator()
        {
            if (_needComma)
            {
                _sb.Append(',');
            }
        }

        private void Quote(string s)
        {
            _sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': _sb.Append("\\\""); break;
                    case '\\': _sb.Append("\\\\"); break;
                    case '\n': _sb.Append("\\n"); break;
                    case '\r': _sb.Append("\\r"); break;
                    case '\t': _sb.Append("\\t"); break;
                    case '\b': _sb.Append("\\b"); break;
                    case '\f': _sb.Append("\\f"); break;
                    default:
                        if (c < 0x20)
                        {
                            _sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            _sb.Append(c);
                        }
                        break;
                }
            }
            _sb.Append('"');
        }
    }

    /// <summary>
    /// Sesión de práctica: acumula eventos y contadores y genera el JSON de POST /api/v1/telemetry/session
    /// (y el de POST /api/v1/telemetry/event para un evento suelto). No sabe nada de red ni de Unity.
    /// </summary>
    public sealed class TelemetrySession
    {
        public const int MaxEvents = 5000;
        public const int MaxText = 120;
        public const int MaxDetail = 500;

        private readonly List<TelemetryEvent> _events = new List<TelemetryEvent>();

        public string SessionId { get; }
        public string StudentId { get; }
        public string Scenario { get; }
        public DeviceType Device { get; }
        public InteractionMode Interaction { get; set; }
        public DateTime StartedAtUtc { get; }
        public DateTime? EndedAtUtc { get; private set; }
        public int PartsTotal { get; set; }
        public int PartsPlaced { get; private set; }
        public int AssemblyErrors { get; private set; }
        public int HintsUsed { get; private set; }
        public int DroppedEvents { get; private set; }
        public IReadOnlyList<TelemetryEvent> Events => _events;
        public bool Finished => EndedAtUtc.HasValue;

        public TelemetrySession(string sessionId, string studentId, string scenario, DeviceType device, InteractionMode interaction,
            DateTime startedAtUtc, int partsTotal)
        {
            if (string.IsNullOrEmpty(sessionId) || sessionId.Length < 8)
            {
                throw new ArgumentException("El id de sesión necesita al menos 8 caracteres", nameof(sessionId));
            }
            SessionId = sessionId;
            StudentId = string.IsNullOrEmpty(studentId) ? "anonimo" : studentId;
            Scenario = string.IsNullOrEmpty(scenario) ? "libre" : scenario;
            Device = device;
            Interaction = interaction;
            StartedAtUtc = startedAtUtc.ToUniversalTime();
            PartsTotal = Math.Max(0, partsTotal);
        }

        /// <summary>Id nuevo para una sesión (32 caracteres hexadecimales).</summary>
        public static string NewId()
        {
            return Guid.NewGuid().ToString("N");
        }

        /// <summary>Registra un evento; los tiempos nunca retroceden (el backend los exige ordenados). Devuelve el evento guardado.</summary>
        public TelemetryEvent Add(double t, TelemetryEventType type, string part = null, string target = null, string detail = null)
        {
            double last = _events.Count > 0 ? _events[_events.Count - 1].T : 0d;
            var e = new TelemetryEvent(Math.Max(Math.Max(0d, t), last), type, Clip(part, MaxText), Clip(target, MaxText), Clip(detail, MaxDetail));
            switch (type)
            {
                case TelemetryEventType.SnapOk:
                    PartsPlaced = Math.Min(PartsTotal > 0 ? PartsTotal : int.MaxValue, PartsPlaced + 1);
                    break;
                case TelemetryEventType.SnapFail:
                    AssemblyErrors++;
                    break;
                case TelemetryEventType.Hint:
                    HintsUsed++;
                    break;
            }
            if (_events.Count < MaxEvents)
            {
                _events.Add(e);
            }
            else
            {
                DroppedEvents++;
            }
            return e;
        }

        /// <summary>Una pieza que estaba encajada se sacó: deja de contar como colocada.</summary>
        public void Unplace()
        {
            PartsPlaced = Math.Max(0, PartsPlaced - 1);
        }

        public void End(DateTime endedAtUtc, double t)
        {
            if (Finished)
            {
                return;
            }
            Add(t, TelemetryEventType.SessionEnd);
            DateTime fin = endedAtUtc.ToUniversalTime();
            EndedAtUtc = fin < StartedAtUtc ? StartedAtUtc : fin;
        }

        /// <summary>Cuerpo de POST /api/v1/telemetry/session.</summary>
        public string ToSessionJson()
        {
            var w = new JsonWriter().BeginObject()
                .Field("session_id", SessionId)
                .Field("student_id", StudentId)
                .Field("scenario", Scenario)
                .Field("device", TelemetryNames.Of(Device))
                .Field("interaction", TelemetryNames.Of(Interaction))
                .Field("started_at", StartedAtUtc)
                .Field("ended_at", EndedAtUtc)
                .Field("parts_total", PartsTotal)
                .Field("parts_placed", Math.Min(PartsPlaced, PartsTotal))
                .Field("assembly_errors", AssemblyErrors)
                .Field("hints_used", HintsUsed)
                .BeginArray("events");
            foreach (TelemetryEvent e in _events)
            {
                WriteEvent(w, e);
            }
            return w.EndArray().EndObject().ToString();
        }

        /// <summary>Cuerpo de POST /api/v1/telemetry/event (evento en vivo para el tablero).</summary>
        public string ToLiveEventJson(TelemetryEvent e)
        {
            var w = new JsonWriter().BeginObject()
                .Field("session_id", SessionId)
                .Field("student_id", StudentId)
                .Field("scenario", Scenario);
            w.Field("event", (string)null);
            // "event" es un objeto: se reescribe el valor null por el objeto (más simple que un API de anidado por nombre).
            string head = w.ToString();
            head = head.Substring(0, head.Length - "null".Length);
            var ev = new JsonWriter();
            WriteEvent(ev, e);
            return head + ev + "}";
        }

        private static void WriteEvent(JsonWriter w, TelemetryEvent e)
        {
            w.BeginObject()
                .Field("t", Math.Round(e.T, 3))
                .Field("type", TelemetryNames.Of(e.Type))
                .Optional("part", e.Part)
                .Optional("target", e.Target)
                .Optional("detail", e.Detail)
                .EndObject();
        }

        private static string Clip(string s, int max)
        {
            if (string.IsNullOrEmpty(s))
            {
                return null;
            }
            return s.Length <= max ? s : s.Substring(0, max);
        }
    }

    /// <summary>Esperas entre reintentos: exponencial con tope y un poco de azar (para que 30 visores no reintenten juntos).</summary>
    public sealed class RetryPolicy
    {
        public int MaxAttempts { get; }
        public double BaseDelaySeconds { get; }
        public double MaxDelaySeconds { get; }
        private readonly Random _random;

        public RetryPolicy(int maxAttempts = 5, double baseDelaySeconds = 1d, double maxDelaySeconds = 30d, int? seed = null)
        {
            MaxAttempts = Math.Max(1, maxAttempts);
            BaseDelaySeconds = Math.Max(0d, baseDelaySeconds);
            MaxDelaySeconds = Math.Max(BaseDelaySeconds, maxDelaySeconds);
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
        }

        /// <summary>Espera antes del intento <paramref name="attempt"/> (el primero, 0, no espera).</summary>
        public double DelayFor(int attempt)
        {
            if (attempt <= 0)
            {
                return 0d;
            }
            double exp = Math.Min(MaxDelaySeconds, BaseDelaySeconds * Math.Pow(2d, attempt - 1));
            double jitter = 0.8d + 0.4d * _random.NextDouble();
            return Math.Min(MaxDelaySeconds, exp * jitter);
        }

        /// <summary>¿Vale la pena reintentar con este código HTTP? (0 = sin conexión). Los 4xx, salvo 408 y 429, no.</summary>
        public static bool IsRetryable(long httpStatus)
        {
            return httpStatus == 0 || httpStatus == 408 || httpStatus == 429 || httpStatus >= 500;
        }
    }

    /// <summary>
    /// Bandeja de salida: los informes de sesión que no se pudieron mandar (sin wifi) quedan guardados por id y se
    /// reintentan después. Como el backend hace upsert por session_id, guardar solo el último de cada sesión alcanza.
    /// Se serializa como líneas "id\tjson" (los JSON no tienen saltos de línea ni tabulaciones sin escapar).
    /// </summary>
    public sealed class TelemetryOutbox
    {
        private readonly Dictionary<string, string> _pending = new Dictionary<string, string>();
        private readonly List<string> _order = new List<string>();
        public int MaxItems { get; }

        public TelemetryOutbox(int maxItems = 200)
        {
            MaxItems = Math.Max(1, maxItems);
        }

        public int Count => _pending.Count;

        public void Put(string sessionId, string json)
        {
            if (_pending.ContainsKey(sessionId))
            {
                _order.Remove(sessionId);
            }
            _pending[sessionId] = json;
            _order.Add(sessionId);
            while (_order.Count > MaxItems)
            {
                _pending.Remove(_order[0]);
                _order.RemoveAt(0);
            }
        }

        public bool Remove(string sessionId)
        {
            _order.Remove(sessionId);
            return _pending.Remove(sessionId);
        }

        /// <summary>Copia de lo pendiente, del más viejo al más nuevo.</summary>
        public List<KeyValuePair<string, string>> Snapshot()
        {
            var list = new List<KeyValuePair<string, string>>(_order.Count);
            foreach (string id in _order)
            {
                list.Add(new KeyValuePair<string, string>(id, _pending[id]));
            }
            return list;
        }

        public string Serialize()
        {
            var sb = new StringBuilder();
            foreach (string id in _order)
            {
                sb.Append(id).Append('\t').Append(_pending[id]).Append('\n');
            }
            return sb.ToString();
        }

        public static TelemetryOutbox Deserialize(string text, int maxItems = 200)
        {
            var box = new TelemetryOutbox(maxItems);
            if (string.IsNullOrEmpty(text))
            {
                return box;
            }
            foreach (string line in text.Split('\n'))
            {
                int tab = line.IndexOf('\t');
                if (tab > 0 && tab < line.Length - 1)
                {
                    box.Put(line.Substring(0, tab), line.Substring(tab + 1));
                }
            }
            return box;
        }
    }
}

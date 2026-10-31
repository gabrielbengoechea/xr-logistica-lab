using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using XRLab.Telemetry;

namespace XRLab
{
    /// <summary>
    /// Registro de la sesión de práctica y envío asíncrono al backend:
    /// <list type="bullet">
    /// <item>cada evento (tomar, soltar, encajar, error, despiece, pista) se guarda en la sesión y, si está activado, se
    /// manda al instante a POST /api/v1/telemetry/event para que el docente lo vea en vivo;</item>
    /// <item>el informe completo va a POST /api/v1/telemetry/session periódicamente, al pausar la app y al terminar
    /// (el backend lo actualiza por session_id, así que mandarlo varias veces no duplica nada);</item>
    /// <item>sin conexión, el informe queda en una bandeja en disco y se reintenta con espera exponencial.</item>
    /// </list>
    /// La lógica (JSON, reintentos, bandeja) está en clases sin Unity: <see cref="TelemetrySession"/> y
    /// <see cref="TelemetryUploader"/>.
    /// </summary>
    [DisallowMultipleComponent]
    [AddComponentMenu("XR Lab/Telemetry Logger")]
    public sealed class TelemetryLogger : MonoBehaviour
    {
        public const string PrefServer = "xrlab.server";
        public const string PrefStudent = "xrlab.student";
        public const string PrefApiKey = "xrlab.apikey";
        private const string OutboxFile = "telemetria_pendiente.txt";

        [Header("Servidor")]
        [Tooltip("URL del backend (sin barra final). Se puede cambiar en el visor y queda guardada (PlayerPrefs).")]
        [SerializeField] private string serverUrl = "http://192.168.0.10:8000";
        [Tooltip("Clave del backend (XRLAB_API_KEY), si la exige. Va en la cabecera X-API-Key.")]
        [SerializeField] private string apiKey;
        [Min(1)] [SerializeField] private int requestTimeoutSeconds = 10;
        [Min(1)] [SerializeField] private int maxAttempts = 5;

        [Header("Sesión")]
        [SerializeField] private string studentId = "anonimo";
        [Tooltip("Id del activo practicado (models/manifest.json): forklift, pallet, rack, sensor, motor, cubesat.")]
        [SerializeField] private string scenario = "cubesat";
        [Tooltip("Piezas a encajar. 0: cuenta las zonas de encaje de la escena al empezar.")]
        [Min(0)] [SerializeField] private int partsTotal;
        [SerializeField] private InteractionMode interaction = InteractionMode.Hands;
        [SerializeField] private bool startOnAwake = true;

        [Header("Envío")]
        [Tooltip("Mandar cada evento al tablero apenas ocurre.")]
        [SerializeField] private bool sendLiveEvents = true;
        [Tooltip("Cada cuántos segundos se manda el informe parcial (0: solo al pausar y al terminar).")]
        [Min(0f)] [SerializeField] private float reportIntervalSeconds = 20f;
        [SerializeField] private bool verboseLog;

        private TelemetryUploader _uploader;
        private TelemetrySession _session;
        private double _sessionStartTime;
        private float _nextReport;
        private bool _dirty;
        private bool _sendingReport;
        private int _liveInFlight;
        private CancellationTokenSource _cancel;
        private string _outboxPath;

        /// <summary>Sesión en curso (null si no empezó).</summary>
        public TelemetrySession Session => _session;

        public string ServerUrl => serverUrl;
        public string LastError => _uploader?.LastError;
        public int PendingReports => _uploader?.Outbox.Count ?? 0;

        /// <summary>Cambió el estado del envío (para un indicador en el visor): true si el último envío salió bien.</summary>
        public event Action<bool> ConnectionChanged;

        private void Awake()
        {
            serverUrl = PlayerPrefs.GetString(PrefServer, serverUrl).TrimEnd('/');
            studentId = PlayerPrefs.GetString(PrefStudent, studentId);
            apiKey = PlayerPrefs.GetString(PrefApiKey, apiKey ?? string.Empty);
            _cancel = new CancellationTokenSource();
            _outboxPath = Path.Combine(Application.persistentDataPath, OutboxFile);
            _uploader = new TelemetryUploader(SendJsonAsync, DelayAsync, new RetryPolicy(maxAttempts), LoadOutbox());
            _uploader.OutboxChanged += SaveOutbox;
        }

        private void Start()
        {
            if (startOnAwake)
            {
                StartSession();
            }
            Fire(FlushPendingAsync());
        }

        private void Update()
        {
            if (_session == null || _session.Finished || reportIntervalSeconds <= 0f || !_dirty)
            {
                return;
            }
            if (Time.unscaledTime >= _nextReport)
            {
                _nextReport = Time.unscaledTime + reportIntervalSeconds;
                Fire(SendReportAsync());
            }
        }

        private void OnApplicationPause(bool paused)
        {
            // El Quest pausa la app al sacarse el visor: buen momento para guardar el informe parcial.
            if (paused && _session != null && !_session.Finished)
            {
                _uploader.Outbox.Put(_session.SessionId, _session.ToSessionJson());
                SaveOutbox(_uploader.Outbox);
                Fire(SendReportAsync());
            }
        }

        private void OnApplicationQuit()
        {
            if (_session != null && !_session.Finished)
            {
                _session.End(DateTime.UtcNow, Elapsed());
                // Al cerrar no hay tiempo de esperar la red: queda en la bandeja y sale en la próxima ejecución.
                _uploader.Outbox.Put(_session.SessionId, _session.ToSessionJson());
                SaveOutbox(_uploader.Outbox);
            }
        }

        private void OnDestroy()
        {
            _cancel?.Cancel();
            _cancel?.Dispose();
            _cancel = null;
        }

        /// <summary>Configura el servidor, el alumno y la clave (por ejemplo, desde un menú en el visor). Quedan guardados.</summary>
        public void Configure(string url, string student, string key = null)
        {
            if (key != null)
            {
                apiKey = key.Trim();
                PlayerPrefs.SetString(PrefApiKey, apiKey);
            }
            if (!string.IsNullOrWhiteSpace(url))
            {
                serverUrl = url.Trim().TrimEnd('/');
                PlayerPrefs.SetString(PrefServer, serverUrl);
            }
            if (!string.IsNullOrWhiteSpace(student))
            {
                studentId = student.Trim();
                PlayerPrefs.SetString(PrefStudent, studentId);
            }
            PlayerPrefs.Save();
        }

        public void SetInteractionMode(InteractionMode mode)
        {
            interaction = mode;
            if (_session != null)
            {
                _session.Interaction = mode;
            }
        }

        /// <summary>
        /// Empieza una sesión nueva (si había otra sin terminar, la cierra). <paramref name="parts"/> &lt; 0 usa lo
        /// configurado; 0 cuenta las zonas de encaje de la escena.
        /// </summary>
        public void StartSession(string scenarioId = null, int parts = -1)
        {
            if (_session != null && !_session.Finished)
            {
                Fire(EndSessionAsync());
            }
            if (!string.IsNullOrEmpty(scenarioId))
            {
                scenario = scenarioId;
            }
            int total = parts >= 0 ? parts : partsTotal;
            if (total == 0)
            {
                total = FindObjectsByType<SnapZone>(FindObjectsSortMode.None).Length;
            }
            Telemetry.DeviceType device = TelemetryNames.DeviceFromModel(SystemInfo.deviceModel, Application.isEditor);
            _session = new TelemetrySession(TelemetrySession.NewId(), studentId, scenario, device, interaction, DateTime.UtcNow, total);
            _sessionStartTime = Time.realtimeSinceStartupAsDouble;
            _nextReport = Time.unscaledTime + reportIntervalSeconds;
            Log(TelemetryEventType.SessionStart, null, null, $"{SystemInfo.deviceModel} · Unity {Application.unityVersion}");
        }

        /// <summary>Registra un evento de la sesión y, si corresponde, lo manda en vivo.</summary>
        public void Log(TelemetryEventType type, string part = null, string target = null, string detail = null)
        {
            if (_session == null || _session.Finished)
            {
                return;
            }
            Telemetry.TelemetryEvent e = _session.Add(Elapsed(), type, part, target, detail);
            _dirty = true;
            if (verboseLog)
            {
                Debug.Log($"[XRLab] {TelemetryNames.Of(type)} {part} {target} {detail}", this);
            }
            if (sendLiveEvents && _liveInFlight < 4)
            {
                Fire(SendLiveAsync(_session.ToLiveEventJson(e)));
            }
        }

        public void LogHint(string part, string detail = null)
        {
            Log(TelemetryEventType.Hint, part, null, detail);
        }

        /// <summary>Una pieza encajada se volvió a sacar: deja de contar como colocada.</summary>
        public void NotifyUnplaced()
        {
            _session?.Unplace();
            _dirty = true;
        }

        /// <summary>Termina la sesión y manda el informe final. Devuelve true si el backend lo recibió.</summary>
        public async Task<bool> EndSessionAsync()
        {
            if (_session == null || _session.Finished)
            {
                return false;
            }
            _session.End(DateTime.UtcNow, Elapsed());
            TelemetrySession s = _session;
            bool ok = await _uploader.SendSessionAsync(s.SessionId, s.ToSessionJson(), Token);
            ConnectionChanged?.Invoke(ok);
            return ok;
        }

        /// <summary>Para enganchar desde un botón (UnityEvent no espera tareas).</summary>
        public void EndSession()
        {
            Fire(EndSessionAsync());
        }

        private double Elapsed()
        {
            return Math.Max(0d, Time.realtimeSinceStartupAsDouble - _sessionStartTime);
        }

        private CancellationToken Token => _cancel != null ? _cancel.Token : CancellationToken.None;

        private async Task SendReportAsync()
        {
            if (_sendingReport || _session == null)
            {
                return;
            }
            _sendingReport = true;
            _dirty = false;
            try
            {
                bool ok = await _uploader.SendSessionAsync(_session.SessionId, _session.ToSessionJson(), Token);
                ConnectionChanged?.Invoke(ok);
            }
            finally
            {
                _sendingReport = false;
            }
        }

        private async Task SendLiveAsync(string json)
        {
            _liveInFlight++;
            try
            {
                await _uploader.SendLiveEventAsync(json, Token);
            }
            finally
            {
                _liveInFlight--;
            }
        }

        private async Task FlushPendingAsync()
        {
            if (_uploader.Outbox.Count == 0)
            {
                return;
            }
            int n = await _uploader.FlushOutboxAsync(Token);
            if (n > 0)
            {
                Debug.Log($"[XRLab] Se mandaron {n} informes de sesión pendientes.", this);
            }
        }

        /// <summary>POST con UnityWebRequest, esperado sin corrutinas (vuelve al hilo principal por el contexto de Unity).</summary>
        private async Task<SendResult> SendJsonAsync(string path, string json, CancellationToken cancel)
        {
            using (var req = new UnityWebRequest(serverUrl + path, UnityWebRequest.kHttpVerbPOST))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json)) { contentType = "application/json" };
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");
                if (!string.IsNullOrEmpty(apiKey))
                {
                    req.SetRequestHeader("X-API-Key", apiKey);
                }
                req.timeout = requestTimeoutSeconds;
                var done = new TaskCompletionSource<bool>();
                UnityWebRequestAsyncOperation op = req.SendWebRequest();
                op.completed += _ => done.TrySetResult(true);
                using (cancel.Register(() => { req.Abort(); done.TrySetCanceled(); }))
                {
                    await done.Task;
                }
                if (req.result == UnityWebRequest.Result.Success)
                {
                    return new SendResult(req.responseCode);
                }
                string body = req.downloadHandler != null ? req.downloadHandler.text : null;
                string error = string.IsNullOrEmpty(body) ? req.error : req.error + " · " + Truncate(body, 300);
                return new SendResult(req.result == UnityWebRequest.Result.ProtocolError ? req.responseCode : 0, error);
            }
        }

        private static Task DelayAsync(double seconds, CancellationToken cancel)
        {
            return Task.Delay(TimeSpan.FromSeconds(seconds), cancel);
        }

        private TelemetryOutbox LoadOutbox()
        {
            try
            {
                return File.Exists(_outboxPath) ? TelemetryOutbox.Deserialize(File.ReadAllText(_outboxPath, Encoding.UTF8)) : new TelemetryOutbox();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[XRLab] No se pudo leer la bandeja de telemetría: {e.Message}", this);
                return new TelemetryOutbox();
            }
        }

        private void SaveOutbox(TelemetryOutbox box)
        {
            try
            {
                if (box.Count == 0)
                {
                    if (File.Exists(_outboxPath))
                    {
                        File.Delete(_outboxPath);
                    }
                    return;
                }
                File.WriteAllText(_outboxPath, box.Serialize(), Encoding.UTF8);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[XRLab] No se pudo guardar la bandeja de telemetría: {e.Message}", this);
            }
        }

        /// <summary>Lanza una tarea sin esperarla, pero sin tragarse los errores.</summary>
        private void Fire(Task task)
        {
            task.ContinueWith(t =>
            {
                if (t.IsFaulted && !(t.Exception?.GetBaseException() is OperationCanceledException))
                {
                    Debug.LogException(t.Exception.GetBaseException());
                }
            }, TaskScheduler.FromCurrentSynchronizationContext());
        }

        private static string Truncate(string s, int max)
        {
            return s.Length <= max ? s : s.Substring(0, max) + "…";
        }
    }
}

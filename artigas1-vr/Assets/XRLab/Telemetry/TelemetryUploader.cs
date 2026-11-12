using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace XRLab.Telemetry
{
    /// <summary>Resultado de un envío HTTP: código (0 si no hubo conexión) y texto de error, si lo hubo.</summary>
    public readonly struct SendResult
    {
        public readonly long Status;
        public readonly string Error;

        public SendResult(long status, string error = null)
        {
            Status = status;
            Error = error;
        }

        public bool Ok => Status >= 200 && Status < 300;
    }

    /// <summary>Envía un cuerpo JSON por POST a una ruta de la API. Lo implementa el cliente (UnityWebRequest en el visor).</summary>
    public delegate Task<SendResult> JsonSender(string path, string json, CancellationToken cancel);

    /// <summary>Espera los segundos pedidos (Task.Delay en el visor; en las pruebas, un reloj falso).</summary>
    public delegate Task Delayer(double seconds, CancellationToken cancel);

    /// <summary>
    /// Despachador de telemetría sin Unity: manda el informe de sesión con reintentos y, si no puede, lo deja en la
    /// bandeja de salida para el próximo intento. Los eventos en vivo se mandan una sola vez (si se pierden, el informe
    /// de la sesión los trae igual).
    /// </summary>
    public sealed class TelemetryUploader
    {
        public const string SessionPath = "/api/v1/telemetry/session";
        public const string EventPath = "/api/v1/telemetry/event";

        private readonly JsonSender _send;
        private readonly Delayer _delay;
        private readonly RetryPolicy _retry;

        public TelemetryOutbox Outbox { get; }

        /// <summary>Último error de red (para mostrarlo en el visor o en el registro).</summary>
        public string LastError { get; private set; }

        /// <summary>Se llama cada vez que cambia la bandeja (para guardarla en disco).</summary>
        public event Action<TelemetryOutbox> OutboxChanged;

        public TelemetryUploader(JsonSender send, Delayer delay, RetryPolicy retry, TelemetryOutbox outbox = null)
        {
            _send = send ?? throw new ArgumentNullException(nameof(send));
            _delay = delay ?? throw new ArgumentNullException(nameof(delay));
            _retry = retry ?? new RetryPolicy();
            Outbox = outbox ?? new TelemetryOutbox();
        }

        /// <summary>
        /// Manda el informe de una sesión. Mientras se intenta queda en la bandeja, así no se pierde si se cierra la app;
        /// sale de ella cuando el backend lo acepta o lo rechaza por inválido (un 4xx no mejora reintentando).
        /// </summary>
        public async Task<bool> SendSessionAsync(string sessionId, string json, CancellationToken cancel = default)
        {
            Outbox.Put(sessionId, json);
            OutboxChanged?.Invoke(Outbox);
            bool ok = await PostWithRetryAsync(SessionPath, json, cancel);
            if (ok || !_lastRetryable)
            {
                Outbox.Remove(sessionId);
                OutboxChanged?.Invoke(Outbox);
            }
            return ok;
        }

        /// <summary>Evento en vivo para el tablero: un solo intento, sin bandeja.</summary>
        public async Task<bool> SendLiveEventAsync(string json, CancellationToken cancel = default)
        {
            SendResult r = await SafeSend(EventPath, json, cancel);
            if (!r.Ok)
            {
                LastError = Describe(r);
            }
            return r.Ok;
        }

        /// <summary>Reintenta lo que quedó pendiente (de esta ejecución o de una anterior). Devuelve cuántos se mandaron.</summary>
        public async Task<int> FlushOutboxAsync(CancellationToken cancel = default)
        {
            int sent = 0;
            foreach (KeyValuePair<string, string> item in Outbox.Snapshot())
            {
                cancel.ThrowIfCancellationRequested();
                SendResult r = await SafeSend(SessionPath, item.Value, cancel);
                if (r.Ok || !RetryPolicy.IsRetryable(r.Status))
                {
                    Outbox.Remove(item.Key);
                    if (r.Ok)
                    {
                        sent++;
                    }
                    else
                    {
                        LastError = Describe(r);
                    }
                }
                else
                {
                    LastError = Describe(r);
                    break; // sin conexión: no tiene sentido seguir con los demás ahora
                }
            }
            OutboxChanged?.Invoke(Outbox);
            return sent;
        }

        private bool _lastRetryable;

        private async Task<bool> PostWithRetryAsync(string path, string json, CancellationToken cancel)
        {
            _lastRetryable = true;
            for (int attempt = 0; attempt < _retry.MaxAttempts; attempt++)
            {
                double wait = _retry.DelayFor(attempt);
                if (wait > 0d)
                {
                    await _delay(wait, cancel);
                }
                SendResult r = await SafeSend(path, json, cancel);
                if (r.Ok)
                {
                    LastError = null;
                    return true;
                }
                LastError = Describe(r);
                if (!RetryPolicy.IsRetryable(r.Status))
                {
                    _lastRetryable = false;
                    return false;
                }
            }
            return false;
        }

        private async Task<SendResult> SafeSend(string path, string json, CancellationToken cancel)
        {
            try
            {
                return await _send(path, json, cancel);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception e)
            {
                return new SendResult(0, e.Message);
            }
        }

        private static string Describe(SendResult r)
        {
            if (r.Status == 0)
            {
                return "Sin conexión con el servidor" + (string.IsNullOrEmpty(r.Error) ? string.Empty : ": " + r.Error);
            }
            return "HTTP " + r.Status + (string.IsNullOrEmpty(r.Error) ? string.Empty : ": " + r.Error);
        }
    }
}

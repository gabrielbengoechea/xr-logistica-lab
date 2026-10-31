using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using XRLab.Telemetry;

namespace XRLab.Pruebas
{
    public static class PruebasTelemetria
    {
        private static readonly DateTime Inicio = new DateTime(2026, 10, 31, 14, 0, 0, DateTimeKind.Utc);

        private static TelemetrySession Sesion(int piezas = 4)
        {
            return new TelemetrySession("sesion-0001", "ana", "cubesat", DeviceType.Quest2, InteractionMode.Hands, Inicio, piezas);
        }

        [Prueba]
        public static void ElInformeTieneLosCamposDelContrato()
        {
            TelemetrySession s = Sesion();
            s.Add(0.5, TelemetryEventType.SessionStart);
            s.Add(2.25, TelemetryEventType.Grab, "Part_Placa_OBC");
            s.Add(3.0, TelemetryEventType.SnapFail, "Part_Placa_OBC", "Snap_Ranura_EPS", "Esa pieza no va en este lugar");
            s.Add(4.0, TelemetryEventType.SnapOk, "Part_Placa_OBC", "Snap_Ranura_OBC");
            s.Add(5.0, TelemetryEventType.Hint, null, null, "mirá el color");
            using JsonDocument doc = JsonDocument.Parse(s.ToSessionJson());
            JsonElement r = doc.RootElement;
            var esperados = new[] { "session_id", "student_id", "scenario", "device", "interaction", "started_at", "ended_at",
                "parts_total", "parts_placed", "assembly_errors", "hints_used", "events" };
            Afirmar.Igual(string.Join(",", esperados), string.Join(",", r.EnumerateObject().Select(p => p.Name)), "campos y orden");
            Afirmar.Igual("quest2", r.GetProperty("device").GetString());
            Afirmar.Igual("hands", r.GetProperty("interaction").GetString());
            Afirmar.Igual("2026-10-31T14:00:00.000Z", r.GetProperty("started_at").GetString());
            Afirmar.Igual(JsonValueKind.Null, r.GetProperty("ended_at").ValueKind);
            Afirmar.Igual(1, r.GetProperty("parts_placed").GetInt32());
            Afirmar.Igual(1, r.GetProperty("assembly_errors").GetInt32());
            Afirmar.Igual(1, r.GetProperty("hints_used").GetInt32());
            JsonElement ev = r.GetProperty("events")[2];
            Afirmar.Igual("snap_fail", ev.GetProperty("type").GetString());
            Afirmar.Igual("Snap_Ranura_EPS", ev.GetProperty("target").GetString());
            Afirmar.Falso(r.GetProperty("events")[0].TryGetProperty("part", out _), "los opcionales nulos no se escriben");
        }

        [Prueba]
        public static void LosTiemposNuncaRetroceden()
        {
            TelemetrySession s = Sesion();
            s.Add(5, TelemetryEventType.Grab);
            TelemetryEvent e = s.Add(3, TelemetryEventType.Release);
            Afirmar.Igual(5d, e.T, "el backend exige eventos ordenados");
            Afirmar.Igual(5d, s.Add(-1, TelemetryEventType.Grab).T);
        }

        [Prueba]
        public static void LasPiezasColocadasNoSuperanElTotalYSePuedenSacar()
        {
            TelemetrySession s = Sesion(2);
            for (int i = 0; i < 5; i++)
            {
                s.Add(i, TelemetryEventType.SnapOk, "p");
            }
            Afirmar.Igual(2, s.PartsPlaced);
            s.Unplace();
            Afirmar.Igual(1, s.PartsPlaced);
            s.Unplace();
            s.Unplace();
            Afirmar.Igual(0, s.PartsPlaced);
        }

        [Prueba]
        public static void TerminarEsIdempotenteYCierraConSessionEnd()
        {
            TelemetrySession s = Sesion();
            s.End(Inicio.AddMinutes(3), 180);
            s.End(Inicio.AddMinutes(9), 540);
            Afirmar.Verdadero(s.Finished);
            Afirmar.Igual(Inicio.AddMinutes(3), s.EndedAtUtc.Value);
            Afirmar.Igual(1, s.Events.Count(e => e.Type == TelemetryEventType.SessionEnd));
            var antes = Sesion();
            antes.End(Inicio.AddMinutes(-5), 0);
            Afirmar.Igual(Inicio, antes.EndedAtUtc.Value, "nunca termina antes de empezar");
        }

        [Prueba]
        public static void LosTextosSeRecortanYLosEventosTienenTope()
        {
            TelemetrySession s = Sesion();
            TelemetryEvent e = s.Add(1, TelemetryEventType.Grab, new string('x', 300), null, new string('y', 900));
            Afirmar.Igual(TelemetrySession.MaxText, e.Part.Length);
            Afirmar.Igual(TelemetrySession.MaxDetail, e.Detail.Length);
            for (int i = 0; i < TelemetrySession.MaxEvents + 10; i++)
            {
                s.Add(2, TelemetryEventType.Grab);
            }
            Afirmar.Igual(TelemetrySession.MaxEvents, s.Events.Count);
            Afirmar.Igual(11, s.DroppedEvents);
        }

        [Prueba]
        public static void ElEventoEnVivoEsJsonValidoConElEventoAnidado()
        {
            TelemetrySession s = Sesion();
            TelemetryEvent e = s.Add(1.23456, TelemetryEventType.SnapOk, "Part_\"Comillas\"\n", "Snap_X");
            using JsonDocument doc = JsonDocument.Parse(s.ToLiveEventJson(e));
            JsonElement ev = doc.RootElement.GetProperty("event");
            Afirmar.Igual("snap_ok", ev.GetProperty("type").GetString());
            Afirmar.Igual(1.235, ev.GetProperty("t").GetDouble());
            Afirmar.Igual("Part_\"Comillas\"\n", ev.GetProperty("part").GetString());
            Afirmar.Igual("sesion-0001", doc.RootElement.GetProperty("session_id").GetString());
        }

        [Prueba]
        public static void ElEscritorJsonEscapaControlesYNumerosInvariantes()
        {
            string json = new JsonWriter().BeginObject().Field("a", "\u0001\t\\").Field("n", 0.1).Field("x", double.NaN).EndObject().ToString();
            using JsonDocument doc = JsonDocument.Parse(json);
            Afirmar.Igual("\u0001\t\\", doc.RootElement.GetProperty("a").GetString());
            Afirmar.Contiene(json, "\"n\":0.1");
            Afirmar.Igual(JsonValueKind.Null, doc.RootElement.GetProperty("x").ValueKind);
        }

        [Prueba]
        public static void ElIdDeSesionSeValida()
        {
            Afirmar.Lanza<ArgumentException>(() => new TelemetrySession("corto", "a", "b", DeviceType.Editor, InteractionMode.Mouse, Inicio, 1));
            Afirmar.Igual(32, TelemetrySession.NewId().Length);
            var s = new TelemetrySession("12345678", "", "", DeviceType.Web, InteractionMode.Mouse, Inicio, -3);
            Afirmar.Igual("anonimo", s.StudentId);
            Afirmar.Igual("libre", s.Scenario);
            Afirmar.Igual(0, s.PartsTotal);
        }

        [Prueba]
        public static void ElVisorSeDeduceDelModelo()
        {
            Afirmar.Igual(DeviceType.Quest2, TelemetryNames.DeviceFromModel("Oculus Quest 2", false));
            Afirmar.Igual(DeviceType.Quest3, TelemetryNames.DeviceFromModel("Meta Quest 3S", false));
            Afirmar.Igual(DeviceType.Editor, TelemetryNames.DeviceFromModel("Oculus Quest 2", true));
        }

        [Prueba]
        public static void LosReintentosCrecenConTopeYAzarAcotado()
        {
            var p = new RetryPolicy(6, 1, 10, seed: 7);
            Afirmar.Igual(0d, p.DelayFor(0));
            for (int i = 1; i < 6; i++)
            {
                double esperado = Math.Min(10, Math.Pow(2, i - 1));
                double d = p.DelayFor(i);
                Afirmar.Verdadero(d >= esperado * 0.8 - 1e-9 && d <= Math.Min(10, esperado * 1.2) + 1e-9, $"intento {i}: {d}");
            }
            Afirmar.Verdadero(RetryPolicy.IsRetryable(0) && RetryPolicy.IsRetryable(503) && RetryPolicy.IsRetryable(429));
            Afirmar.Falso(RetryPolicy.IsRetryable(422) || RetryPolicy.IsRetryable(404));
        }

        [Prueba]
        public static void LaBandejaGuardaElUltimoDeCadaSesionYSeSerializa()
        {
            var b = new TelemetryOutbox(2);
            b.Put("a", "{\"v\":1}");
            b.Put("b", "{\"v\":2}");
            b.Put("a", "{\"v\":3}");
            Afirmar.Igual("b,a", string.Join(",", b.Snapshot().Select(x => x.Key)), "la actualizada pasa al final");
            b.Put("c", "{}");
            Afirmar.Igual("a,c", string.Join(",", b.Snapshot().Select(x => x.Key)), "con tope se descarta la más vieja");
            TelemetryOutbox copia = TelemetryOutbox.Deserialize(b.Serialize(), 2);
            Afirmar.Igual("{\"v\":3}", copia.Snapshot()[0].Value);
            Afirmar.Igual(0, TelemetryOutbox.Deserialize("").Count);
            Afirmar.Verdadero(copia.Remove("a"));
            Afirmar.Falso(copia.Remove("a"));
        }

        // ---------------------------------------------------------------------------------------------------------
        // Despachador
        // ---------------------------------------------------------------------------------------------------------
        private sealed class ServidorFalso
        {
            public readonly Queue<SendResult> Respuestas = new Queue<SendResult>();
            public readonly List<string> Rutas = new List<string>();
            public readonly List<double> Esperas = new List<double>();
            public SendResult PorDefecto = new SendResult(200);

            public TelemetryUploader Despachador(TelemetryOutbox bandeja = null, int intentos = 4)
            {
                return new TelemetryUploader(
                    (ruta, json, _) =>
                    {
                        Rutas.Add(ruta);
                        return Task.FromResult(Respuestas.Count > 0 ? Respuestas.Dequeue() : PorDefecto);
                    },
                    (s, _) =>
                    {
                        Esperas.Add(s);
                        return Task.CompletedTask;
                    },
                    new RetryPolicy(intentos, 1, 30, seed: 1),
                    bandeja);
            }
        }

        [Prueba]
        public static async Task ElInformeSaleAlPrimerIntentoYDejaLaBandejaVacia()
        {
            var srv = new ServidorFalso();
            TelemetryUploader u = srv.Despachador();
            int cambios = 0;
            u.OutboxChanged += _ => cambios++;
            Afirmar.Verdadero(await u.SendSessionAsync("s1", "{}"));
            Afirmar.Igual(0, u.Outbox.Count);
            Afirmar.Igual(TelemetryUploader.SessionPath, srv.Rutas.Single());
            Afirmar.Igual(0, srv.Esperas.Count);
            Afirmar.Igual(2, cambios, "se guarda al entrar y al salir de la bandeja");
        }

        [Prueba]
        public static async Task UnErrorDelServidorSeReintentaConEspera()
        {
            var srv = new ServidorFalso();
            srv.Respuestas.Enqueue(new SendResult(503, "ocupado"));
            srv.Respuestas.Enqueue(new SendResult(0, "sin red"));
            TelemetryUploader u = srv.Despachador();
            Afirmar.Verdadero(await u.SendSessionAsync("s1", "{}"));
            Afirmar.Igual(3, srv.Rutas.Count);
            Afirmar.Igual(2, srv.Esperas.Count);
            Afirmar.Verdadero(srv.Esperas[1] > srv.Esperas[0], "espera exponencial");
            Afirmar.Igual(null, u.LastError);
        }

        [Prueba]
        public static async Task UnInformeInvalidoNoSeReintentaNiQuedaPendiente()
        {
            var srv = new ServidorFalso();
            srv.Respuestas.Enqueue(new SendResult(422, "parts_placed no puede superar parts_total"));
            TelemetryUploader u = srv.Despachador();
            Afirmar.Falso(await u.SendSessionAsync("s1", "{}"));
            Afirmar.Igual(1, srv.Rutas.Count);
            Afirmar.Igual(0, u.Outbox.Count);
            Afirmar.Contiene(u.LastError, "422");
        }

        [Prueba]
        public static async Task SinConexionQuedaEnLaBandejaYSaleDespues()
        {
            var srv = new ServidorFalso { PorDefecto = new SendResult(0, "sin red") };
            var bandeja = new TelemetryOutbox();
            TelemetryUploader u = srv.Despachador(bandeja, intentos: 3);
            Afirmar.Falso(await u.SendSessionAsync("s1", "{\"a\":1}"));
            Afirmar.Falso(await u.SendSessionAsync("s2", "{\"a\":2}"));
            Afirmar.Igual(2, bandeja.Count);
            Afirmar.Contiene(u.LastError, "Sin conexión");
            // Al día siguiente, ya con wifi (otra ejecución: la bandeja viene del disco).
            var srv2 = new ServidorFalso();
            TelemetryUploader u2 = srv2.Despachador(TelemetryOutbox.Deserialize(bandeja.Serialize()));
            Afirmar.Igual(2, await u2.FlushOutboxAsync());
            Afirmar.Igual(0, u2.Outbox.Count);
        }

        [Prueba]
        public static async Task LaBandejaSeDetieneEnElPrimerCorteDeRed()
        {
            var bandeja = new TelemetryOutbox();
            bandeja.Put("a", "{}");
            bandeja.Put("b", "{}");
            bandeja.Put("c", "{}");
            var srv = new ServidorFalso();
            srv.Respuestas.Enqueue(new SendResult(201));
            srv.Respuestas.Enqueue(new SendResult(0));
            TelemetryUploader u = srv.Despachador(bandeja);
            Afirmar.Igual(1, await u.FlushOutboxAsync());
            Afirmar.Igual(2, srv.Rutas.Count, "no siguió con la tercera");
            Afirmar.Igual("b,c", string.Join(",", bandeja.Snapshot().Select(x => x.Key)));
        }

        [Prueba]
        public static async Task ElEventoEnVivoEsUnSoloIntentoYUnaExcepcionCuentaComoSinRed()
        {
            var srv = new ServidorFalso { PorDefecto = new SendResult(500) };
            TelemetryUploader u = srv.Despachador();
            Afirmar.Falso(await u.SendLiveEventAsync("{}"));
            Afirmar.Igual(TelemetryUploader.EventPath, srv.Rutas.Single());
            var roto = new TelemetryUploader((_, __, ___) => throw new InvalidOperationException("DNS"), (_, __) => Task.CompletedTask, new RetryPolicy(2, 0, 0));
            Afirmar.Falso(await roto.SendLiveEventAsync("{}"));
            Afirmar.Contiene(roto.LastError, "DNS");
        }

        [Prueba]
        public static async Task CancelarCortaLosReintentos()
        {
            var cts = new CancellationTokenSource();
            var u = new TelemetryUploader(
                (_, __, ___) => Task.FromResult(new SendResult(0)),
                (s, c) => { cts.Cancel(); c.ThrowIfCancellationRequested(); return Task.CompletedTask; },
                new RetryPolicy(5, 1, 1));
            bool cancelado = false;
            try
            {
                await u.SendSessionAsync("s1", "{}", cts.Token);
            }
            catch (OperationCanceledException)
            {
                cancelado = true;
            }
            Afirmar.Verdadero(cancelado);
            Afirmar.Igual(1, u.Outbox.Count, "queda pendiente para la próxima");
        }
    }
}

namespace XRLab.Pruebas
{
    public static class MuestraContrato
    {
        /// <summary>Con XRLAB_MUESTRA=carpeta escribe un informe y un evento de ejemplo para validarlos contra el backend.</summary>
        [Prueba]
        public static void EscribeMuestrasSiSeLasPide()
        {
            string dir = System.Environment.GetEnvironmentVariable("XRLAB_MUESTRA");
            if (string.IsNullOrEmpty(dir))
            {
                return;
            }
            var s = new TelemetrySession(TelemetrySession.NewId(), "ana", "cubesat", DeviceType.Quest3, InteractionMode.Hands,
                new System.DateTime(2026, 10, 31, 14, 0, 0, System.DateTimeKind.Utc), 4);
            s.Add(0, TelemetryEventType.SessionStart, null, null, "Meta Quest 3");
            s.Add(1.5, TelemetryEventType.Grab, "Part_Placa_OBC");
            s.Add(2.0, TelemetryEventType.SnapFail, "Part_Placa_OBC", "Snap_Ranura_EPS", "Esa pieza no va en este lugar");
            TelemetryEvent ok = s.Add(3.25, TelemetryEventType.SnapOk, "Part_Placa_OBC", "Snap_Ranura_OBC", "tolerancia 4 mm");
            s.Add(4, TelemetryEventType.Explode, null, "CubeSat");
            s.End(new System.DateTime(2026, 10, 31, 14, 3, 0, System.DateTimeKind.Utc), 180);
            System.IO.File.WriteAllText(System.IO.Path.Combine(dir, "sesion.json"), s.ToSessionJson());
            System.IO.File.WriteAllText(System.IO.Path.Combine(dir, "evento.json"), s.ToLiveEventJson(ok));
        }
    }
}

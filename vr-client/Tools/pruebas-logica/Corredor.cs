using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading.Tasks;

namespace XRLab.Pruebas
{
    /// <summary>Marca un método de prueba (estático, sin parámetros; puede devolver Task).</summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class PruebaAttribute : Attribute
    {
    }

    public sealed class FalloPrueba : Exception
    {
        public FalloPrueba(string mensaje) : base(mensaje) { }
    }

    public static class Afirmar
    {
        public static void Verdadero(bool condicion, string que = "se esperaba verdadero")
        {
            if (!condicion)
            {
                throw new FalloPrueba(que);
            }
        }

        public static void Falso(bool condicion, string que = "se esperaba falso")
        {
            Verdadero(!condicion, que);
        }

        public static void Igual<T>(T esperado, T obtenido, string que = null)
        {
            if (!EqualityComparer<T>.Default.Equals(esperado, obtenido))
            {
                throw new FalloPrueba($"{que ?? "valores distintos"}: se esperaba «{esperado}» y llegó «{obtenido}»");
            }
        }

        public static void Cerca(double esperado, double obtenido, double tolerancia = 1e-4, string que = null)
        {
            if (Math.Abs(esperado - obtenido) > tolerancia)
            {
                throw new FalloPrueba($"{que ?? "fuera de tolerancia"}: se esperaba {esperado} ± {tolerancia} y llegó {obtenido}");
            }
        }

        public static void Contiene(string texto, string parte)
        {
            if (texto == null || !texto.Contains(parte, StringComparison.Ordinal))
            {
                throw new FalloPrueba($"«{texto}» no contiene «{parte}»");
            }
        }

        public static void Lanza<TEx>(Action accion) where TEx : Exception
        {
            try
            {
                accion();
            }
            catch (TEx)
            {
                return;
            }
            throw new FalloPrueba($"se esperaba la excepción {typeof(TEx).Name}");
        }
    }

    public static class Programa
    {
        public static async Task<int> Main(string[] args)
        {
            string filtro = args.Length > 0 ? args[0] : null;
            int ok = 0;
            var fallas = new List<string>();
            foreach (Type t in typeof(Programa).Assembly.GetTypes())
            {
                foreach (MethodInfo m in t.GetMethods(BindingFlags.Public | BindingFlags.Static))
                {
                    if (m.GetCustomAttribute<PruebaAttribute>() == null)
                    {
                        continue;
                    }
                    string nombre = $"{t.Name}.{m.Name}";
                    if (filtro != null && !nombre.Contains(filtro, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    try
                    {
                        object r = m.Invoke(null, null);
                        if (r is Task task)
                        {
                            await task;
                        }
                        ok++;
                        Console.WriteLine($"  ✓ {nombre}");
                    }
                    catch (Exception e)
                    {
                        Exception real = e is TargetInvocationException tie && tie.InnerException != null ? tie.InnerException : e;
                        fallas.Add($"{nombre}: {real.Message}");
                        Console.WriteLine($"  ✗ {nombre}: {real.Message}");
                    }
                }
            }
            Console.WriteLine();
            Console.WriteLine(fallas.Count == 0 ? $"{ok} pruebas pasaron." : $"{fallas.Count} fallaron, {ok} pasaron.");
            return fallas.Count == 0 && ok > 0 ? 0 : 1;
        }
    }
}

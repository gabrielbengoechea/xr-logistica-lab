using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace Artigas1.Pruebas
{
    /// <summary>Marca un método de prueba (estático, sin parámetros).</summary>
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

        public static void Falso(bool condicion, string que = "se esperaba falso") => Verdadero(!condicion, que);

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
    }

    public static class Corredor
    {
        public static int Main()
        {
            var pruebas = typeof(Corredor).Assembly.GetTypes()
                .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static))
                .Where(m => m.GetCustomAttribute<PruebaAttribute>() != null)
                .OrderBy(m => m.DeclaringType.Name).ThenBy(m => m.Name)
                .ToList();
            int fallas = 0;
            foreach (MethodInfo m in pruebas)
            {
                try
                {
                    m.Invoke(null, null);
                    Console.WriteLine($"  ok   {m.DeclaringType.Name}.{m.Name}");
                }
                catch (TargetInvocationException e)
                {
                    fallas++;
                    Console.WriteLine($"  FALLA {m.DeclaringType.Name}.{m.Name}: {e.InnerException?.Message}");
                }
            }
            Console.WriteLine($"{pruebas.Count - fallas} de {pruebas.Count} pruebas pasaron.");
            return fallas == 0 ? 0 : 1;
        }
    }
}

// Firmas mínimas de NUnit (las que usan las pruebas EditMode), para compilarlas fuera de Unity.
using System;

namespace NUnit.Framework
{
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class TestAttribute : Attribute
    {
    }

    [AttributeUsage(AttributeTargets.Method)]
    public sealed class SetUpAttribute : Attribute
    {
    }

    [AttributeUsage(AttributeTargets.Method)]
    public sealed class TearDownAttribute : Attribute
    {
    }

    public static class Assert
    {
        public static void IsTrue(bool condition, string message = null) { }
        public static void IsFalse(bool condition, string message = null) { }
        public static void IsNull(object anObject, string message = null) { }
        public static void IsNotNull(object anObject, string message = null) { }
        public static void AreSame(object expected, object actual, string message = null) { }
        public static void AreEqual(object expected, object actual, string message = null) { }
        public static void AreEqual(float expected, float actual, float delta, string message = null) { }
    }
}

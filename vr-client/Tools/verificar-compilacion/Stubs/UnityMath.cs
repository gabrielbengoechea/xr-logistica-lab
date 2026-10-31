// Firmas mínimas de la API de Unity para compilar los scripts fuera del editor (sin licencia).
// La matemática (Vector3, Quaternion, Mathf) está implementada de verdad, con las mismas fórmulas que Unity,
// porque las pruebas de lógica (Tools/pruebas-logica) corren sobre estas clases.
// Solo se declara lo que usan los scripts: si un script usa algo nuevo de Unity, se agrega acá con la firma real.
using System;

namespace UnityEngine
{
    public static class Mathf
    {
        public const float PI = (float)Math.PI;
        public const float Deg2Rad = PI / 180f;
        public const float Rad2Deg = 180f / PI;
        public const float Epsilon = 1.401298E-45f;

        public static float Clamp(float value, float min, float max) => value < min ? min : value > max ? max : value;
        public static int Clamp(int value, int min, int max) => value < min ? min : value > max ? max : value;
        public static float Clamp01(float value) => Clamp(value, 0f, 1f);
        public static float Max(float a, float b) => a > b ? a : b;
        public static int Max(int a, int b) => a > b ? a : b;
        public static float Min(float a, float b) => a < b ? a : b;
        public static int Min(int a, int b) => a < b ? a : b;
        public static float Abs(float f) => Math.Abs(f);
        public static float Sqrt(float f) => (float)Math.Sqrt(f);
        public static float Pow(float f, float p) => (float)Math.Pow(f, p);
        public static float Sin(float f) => (float)Math.Sin(f);
        public static float Cos(float f) => (float)Math.Cos(f);
        public static float Acos(float f) => (float)Math.Acos(f);
        public static float Atan2(float y, float x) => (float)Math.Atan2(y, x);
        public static float Sign(float f) => f >= 0f ? 1f : -1f;
        public static float Lerp(float a, float b, float t) => a + (b - a) * Clamp01(t);

        public static float MoveTowards(float current, float target, float maxDelta)
        {
            if (Math.Abs(target - current) <= maxDelta)
            {
                return target;
            }
            return current + Math.Sign(target - current) * maxDelta;
        }

        public static bool Approximately(float a, float b)
        {
            return Math.Abs(b - a) < Math.Max(1E-06f * Math.Max(Math.Abs(a), Math.Abs(b)), Epsilon * 8f);
        }
    }

    [Serializable]
    public struct Vector3 : IEquatable<Vector3>
    {
        public float x;
        public float y;
        public float z;

        public Vector3(float x, float y, float z)
        {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        public static Vector3 zero => new Vector3(0f, 0f, 0f);
        public static Vector3 one => new Vector3(1f, 1f, 1f);
        public static Vector3 up => new Vector3(0f, 1f, 0f);
        public static Vector3 forward => new Vector3(0f, 0f, 1f);
        public static Vector3 right => new Vector3(1f, 0f, 0f);

        public float sqrMagnitude => x * x + y * y + z * z;
        public float magnitude => (float)Math.Sqrt(sqrMagnitude);

        public Vector3 normalized
        {
            get
            {
                float m = magnitude;
                return m > 1E-05f ? this / m : zero;
            }
        }

        public static float Distance(Vector3 a, Vector3 b) => (a - b).magnitude;
        public static float Dot(Vector3 a, Vector3 b) => a.x * b.x + a.y * b.y + a.z * b.z;
        public static Vector3 Cross(Vector3 a, Vector3 b) => new Vector3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
        public static Vector3 Lerp(Vector3 a, Vector3 b, float t) => a + (b - a) * Mathf.Clamp01(t);
        public static Vector3 Scale(Vector3 a, Vector3 b) => new Vector3(a.x * b.x, a.y * b.y, a.z * b.z);
        public static Vector3 Min(Vector3 a, Vector3 b) => new Vector3(Math.Min(a.x, b.x), Math.Min(a.y, b.y), Math.Min(a.z, b.z));
        public static Vector3 Max(Vector3 a, Vector3 b) => new Vector3(Math.Max(a.x, b.x), Math.Max(a.y, b.y), Math.Max(a.z, b.z));

        public static Vector3 operator +(Vector3 a, Vector3 b) => new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
        public static Vector3 operator -(Vector3 a, Vector3 b) => new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
        public static Vector3 operator -(Vector3 a) => new Vector3(-a.x, -a.y, -a.z);
        public static Vector3 operator *(Vector3 a, float d) => new Vector3(a.x * d, a.y * d, a.z * d);
        public static Vector3 operator *(float d, Vector3 a) => a * d;
        public static Vector3 operator /(Vector3 a, float d) => new Vector3(a.x / d, a.y / d, a.z / d);
        public static bool operator ==(Vector3 a, Vector3 b) => (a - b).sqrMagnitude < 9.99999944E-11f;
        public static bool operator !=(Vector3 a, Vector3 b) => !(a == b);

        public bool Equals(Vector3 other) => x.Equals(other.x) && y.Equals(other.y) && z.Equals(other.z);
        public override bool Equals(object obj) => obj is Vector3 v && Equals(v);
        public override int GetHashCode() => HashCode.Combine(x, y, z);
        public override string ToString() => $"({x:F2}, {y:F2}, {z:F2})";
    }

    [Serializable]
    public struct Vector4
    {
        public float x;
        public float y;
        public float z;
        public float w;

        public Vector4(float x, float y, float z, float w)
        {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }
    }

    [Serializable]
    public struct Quaternion : IEquatable<Quaternion>
    {
        public float x;
        public float y;
        public float z;
        public float w;

        public Quaternion(float x, float y, float z, float w)
        {
            this.x = x;
            this.y = y;
            this.z = z;
            this.w = w;
        }

        public static Quaternion identity => new Quaternion(0f, 0f, 0f, 1f);

        public static float Dot(Quaternion a, Quaternion b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

        /// <summary>Igual que Unity: ángulo en grados entre dos rotaciones (0 si son casi iguales).</summary>
        public static float Angle(Quaternion a, Quaternion b)
        {
            float dot = Math.Min(Math.Abs(Dot(a, b)), 1f);
            return dot > 0.999999f ? 0f : (float)(Math.Acos(dot) * 2.0 * Mathf.Rad2Deg);
        }

        /// <summary>Igual que Unity: rotación Z, luego X, luego Y (grados).</summary>
        public static Quaternion Euler(float x, float y, float z)
        {
            double hx = x * Mathf.Deg2Rad * 0.5, hy = y * Mathf.Deg2Rad * 0.5, hz = z * Mathf.Deg2Rad * 0.5;
            double cx = Math.Cos(hx), sx = Math.Sin(hx), cy = Math.Cos(hy), sy = Math.Sin(hy), cz = Math.Cos(hz), sz = Math.Sin(hz);
            return new Quaternion(
                (float)(cy * sx * cz + sy * cx * sz),
                (float)(sy * cx * cz - cy * sx * sz),
                (float)(cy * cx * sz - sy * sx * cz),
                (float)(cy * cx * cz + sy * sx * sz));
        }

        public static Quaternion Euler(Vector3 e) => Euler(e.x, e.y, e.z);

        public static Quaternion AngleAxis(float angle, Vector3 axis)
        {
            Vector3 n = axis.normalized;
            double h = angle * Mathf.Deg2Rad * 0.5;
            float s = (float)Math.Sin(h);
            return new Quaternion(n.x * s, n.y * s, n.z * s, (float)Math.Cos(h));
        }

        public static Quaternion Normalize(Quaternion q)
        {
            float m = (float)Math.Sqrt(Dot(q, q));
            return m < Mathf.Epsilon ? identity : new Quaternion(q.x / m, q.y / m, q.z / m, q.w / m);
        }

        public static Quaternion Slerp(Quaternion a, Quaternion b, float t)
        {
            t = Mathf.Clamp01(t);
            float dot = Dot(a, b);
            if (dot < 0f)
            {
                b = new Quaternion(-b.x, -b.y, -b.z, -b.w);
                dot = -dot;
            }
            if (dot > 0.9995f)
            {
                return Normalize(new Quaternion(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t));
            }
            double th = Math.Acos(dot);
            double s = Math.Sin(th);
            float wa = (float)(Math.Sin((1 - t) * th) / s);
            float wb = (float)(Math.Sin(t * th) / s);
            return new Quaternion(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb, a.w * wa + b.w * wb);
        }

        public static Quaternion operator *(Quaternion l, Quaternion r) => new Quaternion(
            l.w * r.x + l.x * r.w + l.y * r.z - l.z * r.y,
            l.w * r.y + l.y * r.w + l.z * r.x - l.x * r.z,
            l.w * r.z + l.z * r.w + l.x * r.y - l.y * r.x,
            l.w * r.w - l.x * r.x - l.y * r.y - l.z * r.z);

        public static Vector3 operator *(Quaternion q, Vector3 v)
        {
            var u = new Vector3(q.x, q.y, q.z);
            Vector3 t = 2f * Vector3.Cross(u, v);
            return v + q.w * t + Vector3.Cross(u, t);
        }

        public bool Equals(Quaternion o) => x.Equals(o.x) && y.Equals(o.y) && z.Equals(o.z) && w.Equals(o.w);
        public override bool Equals(object obj) => obj is Quaternion q && Equals(q);
        public override int GetHashCode() => HashCode.Combine(x, y, z, w);
    }

    [Serializable]
    public struct Color
    {
        public float r;
        public float g;
        public float b;
        public float a;

        public Color(float r, float g, float b, float a = 1f)
        {
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
        }
    }

    public struct Bounds
    {
        public Vector3 center;
        public Vector3 size;

        public Bounds(Vector3 center, Vector3 size)
        {
            this.center = center;
            this.size = size;
        }

        public Vector3 min => center - size * 0.5f;
        public Vector3 max => center + size * 0.5f;

        public void Encapsulate(Bounds b)
        {
            Vector3 lo = Vector3.Min(min, b.min);
            Vector3 hi = Vector3.Max(max, b.max);
            center = (lo + hi) * 0.5f;
            size = hi - lo;
        }
    }

    public enum ColorSpace
    {
        Uninitialized = -1,
        Gamma = 0,
        Linear = 1,
    }

    /// <summary>Existe en Unity (Handheld, Desktop...): los scripts tienen que evitar la ambigüedad con XRLab.Telemetry.DeviceType.</summary>
    public enum DeviceType
    {
        Unknown,
        Handheld,
        Console,
        Desktop,
    }
}

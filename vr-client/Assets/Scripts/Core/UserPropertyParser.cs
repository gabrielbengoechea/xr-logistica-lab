using System;
using System.Collections;
using System.Globalization;
using UnityEngine;

namespace XRLab
{
    /// <summary>
    /// Lee las propiedades personalizadas que Blender escribe en el FBX (pieza, material, masa_kg, explotar, encaje,
    /// tolerancia_m). Según la versión del exportador, un vector llega como Vector3, Vector4, arreglo o texto
    /// ("[0.0, 1.6, 0.0]"), y un número como float, double, int o texto: acá se aceptan todas las formas.
    /// </summary>
    public static class UserPropertyParser
    {
        public static bool TryVector3(object value, out Vector3 result)
        {
            result = Vector3.zero;
            switch (value)
            {
                case null:
                    return false;
                case Vector3 v3:
                    result = v3;
                    return true;
                case Vector4 v4:
                    result = new Vector3(v4.x, v4.y, v4.z);
                    return true;
                case string s:
                    return TryParseText(s, out result);
                case IEnumerable list:
                    return TryFromList(list, out result);
                default:
                    return false;
            }
        }

        public static bool TryFloat(object value, out float result)
        {
            result = 0f;
            switch (value)
            {
                case null:
                    return false;
                case float f:
                    result = f;
                    return true;
                case double d:
                    result = (float)d;
                    return true;
                case int i:
                    result = i;
                    return true;
                case long l:
                    result = l;
                    return true;
                case string s:
                    return float.TryParse(s.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out result);
                default:
                    return false;
            }
        }

        /// <summary>Busca una propiedad por nombre en los arreglos que da AssetPostprocessor.</summary>
        public static object Find(string[] names, object[] values, string name)
        {
            if (names == null || values == null)
            {
                return null;
            }
            for (int i = 0; i < names.Length && i < values.Length; i++)
            {
                if (string.Equals(names[i], name, StringComparison.Ordinal))
                {
                    return values[i];
                }
            }
            return null;
        }

        private static bool TryParseText(string s, out Vector3 result)
        {
            result = Vector3.zero;
            string[] parts = s.Trim().TrimStart('[', '(').TrimEnd(']', ')').Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 3)
            {
                return false;
            }
            var v = new float[3];
            for (int i = 0; i < 3; i++)
            {
                if (!float.TryParse(parts[i], NumberStyles.Float, CultureInfo.InvariantCulture, out v[i]))
                {
                    return false;
                }
            }
            result = new Vector3(v[0], v[1], v[2]);
            return true;
        }

        private static bool TryFromList(IEnumerable list, out Vector3 result)
        {
            result = Vector3.zero;
            var v = new float[3];
            int n = 0;
            foreach (object o in list)
            {
                if (n >= 3 || !TryFloat(o, out v[n]))
                {
                    return false;
                }
                n++;
            }
            if (n != 3)
            {
                return false;
            }
            result = new Vector3(v[0], v[1], v[2]);
            return true;
        }
    }
}

using UnityEngine;

namespace Artigas1
{
    /// <summary>Curvatura de cada falange (radianes) de índice, medio, anular y meñique; abanico; y pulgar [abre, f1, f2, f3].</summary>
    public struct PoseMano
    {
        public float[] dedos;   // 4 dedos × 3 falanges
        public float abanico;
        public float[] pulgar;  // 4 valores

        public PoseMano(float[] dedos, float abanico, float[] pulgar)
        {
            this.dedos = dedos;
            this.abanico = abanico;
            this.pulgar = pulgar;
        }

        public PoseMano Copia() => new PoseMano((float[])dedos.Clone(), abanico, (float[])pulgar.Clone());
    }

    /// <summary>
    /// Cinemática de la mano del guante, la misma del recorrido web (js/manos.js, cinematicaMano) y del modelo de
    /// Blender (Blender/guante.py, esqueleto). Las cuentas se hacen en el marco «modelo» de la mano derecha de three.js
    /// (dedos hacia -Z, palma hacia -Y, pulgar del lado -X, mano derecha) y recién al final se pasan a Unity, que es
    /// de mano izquierda, reflejando Z. Clase sin MonoBehaviour para probarla fuera de Unity.
    /// </summary>
    public static class ManoCinematica
    {
        public const int Huesos = 16;

        public static readonly string[] NombresHuesos =
        {
            "palma", "indice_1", "indice_2", "indice_3", "medio_1", "medio_2", "medio_3",
            "anular_1", "anular_2", "anular_3", "menique_1", "menique_2", "menique_3", "pulgar_1", "pulgar_2", "pulgar_3",
        };

        private static readonly Vector3[] BaseDedo =
        {
            new Vector3(-0.030f, 0.000f, -0.046f), new Vector3(-0.010f, 0.001f, -0.051f),
            new Vector3(0.010f, 0.000f, -0.048f), new Vector3(0.028f, -0.001f, -0.041f),
        };
        private static readonly float[,] LargoDedo =
        {
            { 0.042f, 0.026f, 0.021f }, { 0.046f, 0.030f, 0.022f }, { 0.042f, 0.028f, 0.021f }, { 0.033f, 0.021f, 0.018f },
        };
        private static readonly float[] AbanicoDedo = { 0.10f, 0.02f, -0.06f, -0.15f };
        private static readonly Vector3 BasePulgar = new Vector3(-0.033f, -0.006f, 0.014f);
        private static readonly float[] LargoPulgar = { 0.040f, 0.032f, 0.026f };

        // poses (mismas cifras que js/manos.js, POSES)
        public static readonly PoseMano Molde = P(new[] { 0.10f, 0.14f, 0.08f, 0.10f, 0.15f, 0.08f, 0.12f, 0.16f, 0.09f, 0.14f, 0.17f, 0.10f }, 1.1f, new[] { 0.25f, 0.10f, 0.10f, 0.08f });
        public static readonly PoseMano Abierta = P(new[] { 0.05f, 0.05f, 0.03f, 0.04f, 0.05f, 0.03f, 0.05f, 0.06f, 0.03f, 0.07f, 0.07f, 0.04f }, 1.5f, new[] { 0.45f, 0.05f, 0.05f, 0.05f });
        public static readonly PoseMano Relajada = P(new[] { 0.22f, 0.34f, 0.20f, 0.28f, 0.40f, 0.24f, 0.34f, 0.44f, 0.26f, 0.38f, 0.46f, 0.28f }, 1.0f, new[] { 0.15f, 0.20f, 0.18f, 0.12f });
        public static readonly PoseMano Puno = P(new[] { 1.42f, 1.62f, 1.05f, 1.45f, 1.66f, 1.08f, 1.47f, 1.66f, 1.08f, 1.48f, 1.62f, 1.05f }, 0.3f, new[] { -0.25f, 0.55f, 0.60f, 0.75f });
        public static readonly PoseMano Senalar = P(new[] { 0.04f, 0.05f, 0.03f, 1.42f, 1.62f, 1.05f, 1.45f, 1.64f, 1.06f, 1.46f, 1.60f, 1.04f }, 0.4f, new[] { -0.25f, 0.60f, 0.70f, 0.70f });
        public static readonly PoseMano Boton = P(new[] { 0.10f, 0.12f, 0.08f, 1.05f, 1.30f, 0.85f, 1.15f, 1.36f, 0.90f, 1.20f, 1.36f, 0.90f }, 0.5f, new[] { -0.10f, 0.45f, 0.55f, 0.50f });
        public static readonly PoseMano Baranda = P(new[] { 1.05f, 1.38f, 0.92f, 1.08f, 1.42f, 0.95f, 1.10f, 1.42f, 0.95f, 1.12f, 1.40f, 0.92f }, 0.4f, new[] { -0.30f, 0.50f, 0.55f, 0.60f });
        public static readonly PoseMano Cilindro = P(new[] { 1.00f, 1.32f, 0.88f, 1.04f, 1.36f, 0.92f, 1.06f, 1.36f, 0.92f, 1.08f, 1.34f, 0.90f }, 0.4f, new[] { -0.20f, 0.45f, 0.50f, 0.55f });
        public static readonly PoseMano Pistola = P(new[] { 0.42f, 0.62f, 0.36f, 1.04f, 1.36f, 0.92f, 1.06f, 1.36f, 0.92f, 1.08f, 1.34f, 0.90f }, 0.4f, new[] { -0.20f, 0.45f, 0.50f, 0.45f });
        public static readonly float[] IndicePistolaGatillo = { 0.74f, 1.05f, 0.62f };
        public static readonly PoseMano Caja = P(new[] { 0.48f, 0.52f, 0.34f, 0.50f, 0.54f, 0.34f, 0.52f, 0.56f, 0.36f, 0.54f, 0.58f, 0.38f }, 1.4f, new[] { 0.35f, 0.22f, 0.26f, 0.24f });
        public static readonly PoseMano Tableta = P(new[] { 0.95f, 0.55f, 0.30f, 1.00f, 0.58f, 0.32f, 1.05f, 0.60f, 0.34f, 1.10f, 0.62f, 0.36f }, 0.55f, new[] { 0.10f, 0.30f, 0.20f, 0.15f });

        private static PoseMano P(float[] d, float a, float[] p) => new PoseMano(d, a, p);

        /// <summary>
        /// Acerca <paramref name="actual"/> a <paramref name="meta"/> con una mezcla exponencial. <paramref name="indice"/>
        /// (3 valores o null) reemplaza las falanges del índice, para que acompañe al gatillo.
        /// </summary>
        public static void Mezclar(ref PoseMano actual, PoseMano meta, float k, float[] indice = null)
        {
            for (int d = 0; d < 4; d++)
            {
                for (int j = 0; j < 3; j++)
                {
                    float m = d == 0 && indice != null ? indice[j] : meta.dedos[d * 3 + j];
                    actual.dedos[d * 3 + j] += (m - actual.dedos[d * 3 + j]) * k;
                }
            }
            actual.abanico += (meta.abanico - actual.abanico) * k;
            for (int j = 0; j < 4; j++)
            {
                actual.pulgar[j] += (meta.pulgar[j] - actual.pulgar[j]) * k;
            }
        }

        /// <summary>
        /// Marcos de los 16 huesos en el marco «modelo» de three.js: palma en el origen y cada falange con origen en su
        /// centro y -Z a lo largo del dedo.
        /// </summary>
        public static void MarcosWeb(PoseMano pose, Matrix4x4[] salida)
        {
            salida[0] = Matrix4x4.identity;
            int h = 1;
            for (int d = 0; d < 4; d++)
            {
                Matrix4x4 a = Matrix4x4.Translate(BaseDedo[d]) * RotY(AbanicoDedo[d] * pose.abanico);
                for (int j = 0; j < 3; j++)
                {
                    a *= RotX(-pose.dedos[d * 3 + j]);
                    float l = LargoDedo[d, j];
                    salida[h++] = a * Matrix4x4.Translate(new Vector3(0f, 0f, -l * 0.5f));
                    a *= Matrix4x4.Translate(new Vector3(0f, 0f, -l));
                }
            }
            Matrix4x4 b = Matrix4x4.Translate(BasePulgar) * RotY(0.85f + pose.pulgar[0]) * RotZ(1.0f);
            for (int j = 0; j < 3; j++)
            {
                b *= RotX(-pose.pulgar[j + 1]);
                float l = LargoPulgar[j];
                salida[h++] = b * Matrix4x4.Translate(new Vector3(0f, 0f, -l * 0.5f));
                b *= Matrix4x4.Translate(new Vector3(0f, 0f, -l));
            }
        }

        /// <summary>
        /// Pasa una matriz rígida de three.js a Unity (reflejo de Z). Con <paramref name="izquierda"/> también la refleja
        /// en X, como hace el recorrido con la mano izquierda. El resultado sigue siendo una rotación propia.
        /// </summary>
        public static Matrix4x4 AUnity(Matrix4x4 web, bool izquierda)
        {
            Matrix4x4 s = Matrix4x4.Scale(new Vector3(izquierda ? -1f : 1f, 1f, -1f));
            return s * web * s;
        }

        /// <summary>Punto de three.js a Unity (reflejo de Z y, en la mano izquierda, de X).</summary>
        public static Vector3 PuntoAUnity(Vector3 web, bool izquierda) => new Vector3(izquierda ? -web.x : web.x, web.y, -web.z);

        public static Matrix4x4 RotX(float a)
        {
            float c = Mathf.Cos(a), s = Mathf.Sin(a);
            var m = Matrix4x4.identity;
            m.m11 = c; m.m12 = -s; m.m21 = s; m.m22 = c;
            return m;
        }

        public static Matrix4x4 RotY(float a)
        {
            float c = Mathf.Cos(a), s = Mathf.Sin(a);
            var m = Matrix4x4.identity;
            m.m00 = c; m.m02 = s; m.m20 = -s; m.m22 = c;
            return m;
        }

        public static Matrix4x4 RotZ(float a)
        {
            float c = Mathf.Cos(a), s = Mathf.Sin(a);
            var m = Matrix4x4.identity;
            m.m00 = c; m.m01 = -s; m.m10 = s; m.m11 = c;
            return m;
        }
    }
}

using UnityEngine;

namespace XRLab
{
    /// <summary>Por qué una pieza no encaja (o <see cref="None"/> si encaja).</summary>
    public enum SnapRejection
    {
        None,
        WrongType,
        TooFar,
        BadOrientation,
        Occupied,
    }

    /// <summary>Resultado de evaluar una pieza contra un encaje.</summary>
    public readonly struct SnapEvaluation
    {
        public readonly float Distance;
        public readonly float AngleDegrees;
        public readonly bool InMagnetRange;
        public readonly SnapRejection Rejection;

        public SnapEvaluation(float distance, float angleDegrees, bool inMagnetRange, SnapRejection rejection)
        {
            Distance = distance;
            AngleDegrees = angleDegrees;
            InMagnetRange = inMagnetRange;
            Rejection = rejection;
        }

        public bool Accepted => Rejection == SnapRejection.None;
    }

    /// <summary>Simetrías que se aceptan al encajar: una pieza girada 180° (o 90°) alrededor de su eje vertical puede valer igual.</summary>
    public enum SnapSymmetry
    {
        None,
        Yaw180,
        Yaw90,
    }

    /// <summary>Reglas de encaje sin MonoBehaviour (se prueban fuera de Unity).</summary>
    public static class SnapMath
    {
        /// <summary>Ángulo (grados) entre dos orientaciones, tomando la mejor de las simetrías permitidas.</summary>
        public static float AngleWithSymmetry(Quaternion part, Quaternion zone, SnapSymmetry symmetry)
        {
            float best = Quaternion.Angle(part, zone);
            int steps = symmetry == SnapSymmetry.Yaw180 ? 2 : symmetry == SnapSymmetry.Yaw90 ? 4 : 1;
            for (int i = 1; i < steps; i++)
            {
                Quaternion alt = zone * Quaternion.Euler(0f, 360f * i / steps, 0f);
                best = Mathf.Min(best, Quaternion.Angle(part, alt));
            }
            return best;
        }

        /// <summary>La orientación del encaje (o su simétrica) más cercana a la de la pieza: así no gira de más al encajar.</summary>
        public static Quaternion ClosestSymmetricRotation(Quaternion part, Quaternion zone, SnapSymmetry symmetry)
        {
            Quaternion best = zone;
            float bestAngle = Quaternion.Angle(part, zone);
            int steps = symmetry == SnapSymmetry.Yaw180 ? 2 : symmetry == SnapSymmetry.Yaw90 ? 4 : 1;
            for (int i = 1; i < steps; i++)
            {
                Quaternion alt = zone * Quaternion.Euler(0f, 360f * i / steps, 0f);
                float a = Quaternion.Angle(part, alt);
                if (a < bestAngle)
                {
                    bestAngle = a;
                    best = alt;
                }
            }
            return best;
        }

        /// <summary>
        /// Evalúa una pieza contra un encaje. El orden de los rechazos es el que se le explica al alumno:
        /// primero el tipo (pieza equivocada), después si está ocupado, la distancia y por último el giro.
        /// </summary>
        public static SnapEvaluation Evaluate(
            string partType, Vector3 partPosition, Quaternion partRotation,
            string acceptsType, Vector3 zonePosition, Quaternion zoneRotation,
            float positionTolerance, float angleToleranceDegrees, float magnetRadius,
            SnapSymmetry symmetry, bool occupied)
        {
            float distance = Vector3.Distance(partPosition, zonePosition);
            float angle = AngleWithSymmetry(partRotation, zoneRotation, symmetry);
            bool inMagnet = distance <= Mathf.Max(magnetRadius, positionTolerance);
            SnapRejection r = SnapRejection.None;
            if (!TypeMatches(partType, acceptsType))
            {
                r = SnapRejection.WrongType;
            }
            else if (occupied)
            {
                r = SnapRejection.Occupied;
            }
            else if (distance > positionTolerance)
            {
                r = SnapRejection.TooFar;
            }
            else if (angle > angleToleranceDegrees)
            {
                r = SnapRejection.BadOrientation;
            }
            return new SnapEvaluation(distance, angle, inMagnet, r);
        }

        /// <summary>Tipos separados por coma en el encaje ("placa_obc,placa_eps"); "*" acepta cualquiera. No distingue mayúsculas.</summary>
        public static bool TypeMatches(string partType, string acceptsType)
        {
            if (string.IsNullOrEmpty(acceptsType) || acceptsType == "*")
            {
                return true;
            }
            if (string.IsNullOrEmpty(partType))
            {
                return false;
            }
            foreach (string t in acceptsType.Split(','))
            {
                if (string.Equals(t.Trim(), partType.Trim(), System.StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        /// <summary>
        /// Fuerza de la atracción magnética mientras la pieza está en la mano: 0 en el borde del radio y 1 en el centro,
        /// con caída cuadrática (se siente como un imán: suave lejos, firme cerca).
        /// </summary>
        public static float MagnetStrength(float distance, float magnetRadius)
        {
            if (magnetRadius <= 0f || distance >= magnetRadius)
            {
                return 0f;
            }
            float k = 1f - distance / magnetRadius;
            return k * k;
        }

        /// <summary>Texto para el alumno (y para la telemetría) según el rechazo.</summary>
        public static string Explain(SnapRejection r)
        {
            switch (r)
            {
                case SnapRejection.WrongType: return "Esa pieza no va en este lugar";
                case SnapRejection.TooFar: return "Acercala más al punto de encaje";
                case SnapRejection.BadOrientation: return "Girala hasta alinearla con el encaje";
                case SnapRejection.Occupied: return "Este lugar ya está ocupado";
                default: return "Encajada";
            }
        }
    }
}

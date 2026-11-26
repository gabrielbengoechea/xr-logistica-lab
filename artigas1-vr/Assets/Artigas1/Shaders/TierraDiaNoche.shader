// Tierra vista desde la órbita: mezcla día/noche según la dirección del sol, luces urbanas del lado de la noche
// y un borde de atmósfera. Sin luces de URP ni sombras: una sola pasada, apta para Quest 2 (multiview).
//
// Versión 2 (26/11/2026), con lo que ya usa el recorrido web (web-dashboard/public/artigas1/js/entorno.js):
//  - La normal se calcula por píxel desde el centro de la esfera (el origen del objeto), no con la de la malla.
//    Así el terminador y la luz siguen la curvatura real, sin el facetado de los triángulos.
//  - Terminador con crepúsculo: el sol bajo tiñe de cálido y el lado de la noche queda oscuro, con un mínimo
//    de luz de cielo cerca de la línea día/noche.
//  - Brillo del sol sobre el agua. La textura de noche de Unity solo trae las luces, así que el agua se estima
//    del color de día (azul y oscuro). La tierra firme no brilla.
//  - Las ciudades se encienden de a poco a medida que entran en la noche.
//  - Atmósfera más fina en el borde (sin halo exagerado).
// El costo sigue siendo el de un shader sin luces: dos lecturas de textura y unas cuentas por píxel.
Shader "Artigas1/TierraDiaNoche"
{
    Properties
    {
        _Dia ("Superficie de día", 2D) = "white" {}
        _Noche ("Luces de noche", 2D) = "black" {}
        _SolDir ("Dirección hacia el sol (mundo)", Vector) = (1, 0.15, 0.3, 0)
        _Atmosfera ("Color de la atmósfera", Color) = (0.35, 0.60, 1.00, 1)
        _BrilloLuces ("Brillo de las luces urbanas", Float) = 1.6
        _BrilloAgua ("Brillo del sol en el agua", Range(0, 2)) = 0.9
        _Centro ("Centro de la esfera (mundo; w = 1 lo usa, w = 0 usa el origen del objeto)", Vector) = (0, 0, 0, 0)
        _UsarAlfa ("Usar alfa de la textura (casquete de detalle)", Float) = 0
        [HideInInspector] _SrcBlend ("_SrcBlend", Float) = 1
        [HideInInspector] _DstBlend ("_DstBlend", Float) = 0
        [HideInInspector] _ZWrite ("_ZWrite", Float) = 1
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
        Pass
        {
            Name "Tierra"
            Tags { "LightMode" = "UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            ZWrite [_ZWrite]

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_Dia);   SAMPLER(sampler_Dia);
            TEXTURE2D(_Noche); SAMPLER(sampler_Noche);

            CBUFFER_START(UnityPerMaterial)
                float4 _Dia_ST;
                float4 _Noche_ST;
                float4 _SolDir;
                half4 _Atmosfera;
                half _BrilloLuces;
                half _BrilloAgua;
                float4 _Centro;
                half _UsarAlfa;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
                float2 uv : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                float3 positionWS : TEXCOORD1;
                float3 centroWS : TEXCOORD2;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            Varyings vert (Attributes v)
            {
                Varyings o;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                VertexPositionInputs p = GetVertexPositionInputs(v.positionOS.xyz);
                o.positionCS = p.positionCS;
                o.positionWS = p.positionWS;
                // de fábrica, el origen del objeto: los casquetes de Blender (cupula.py) nacen con los vértices a
                // radio R del origen. Si el editor detecta otra cosa, pone el centro en _Centro (w = 1).
                o.centroWS = _Centro.w > 0.5 ? _Centro.xyz : TransformObjectToWorld(float3(0.0, 0.0, 0.0));
                o.uv = TRANSFORM_TEX(v.uv, _Dia);
                return o;
            }

            half4 frag (Varyings i) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
                // normal de la esfera en este píxel (no la de la malla): terminador sin facetas
                float3 n = normalize(i.positionWS - i.centroWS);
                float3 s = normalize(_SolDir.xyz);
                float3 vista = GetWorldSpaceNormalizeViewDir(i.positionWS);
                float ndl = dot(n, s);

                half4 texDia = SAMPLE_TEXTURE2D(_Dia, sampler_Dia, i.uv);
                half3 albedo = texDia.rgb;

                // día con sol cálido cuando está bajo; crepúsculo con un poco de luz de cielo; noche oscura
                float dia = smoothstep(-0.08, 0.22, ndl);
                half3 colorSol = lerp(half3(1.0, 0.40, 0.14), half3(1.0, 0.96, 0.90), smoothstep(0.0, 0.32, ndl));
                half3 col = albedo * colorSol * dia * 1.6;
                float crepusculo = smoothstep(-0.30, 0.0, ndl) * (1.0 - dia);
                col += albedo * half3(0.40, 0.41, 0.47) * crepusculo;
                col += albedo * 0.012;

                // agua estimada del color de día: más azul que roja y oscura (mar, Río de la Plata, embalses)
                half lum = dot(albedo, half3(0.2126, 0.7152, 0.0722));
                half agua = saturate((albedo.b - albedo.r) * 4.0) * saturate(1.4 - lum * 2.5);
                float3 medio = normalize(s + vista);
                float nh = saturate(dot(n, medio));
                float brillo = (pow(nh, 220.0) * 0.9 + pow(nh, 24.0) * 0.05) * agua * smoothstep(-0.02, 0.10, ndl) * _BrilloAgua;
                col += colorSol * brillo;

                // luces urbanas: se encienden de a poco al entrar en la noche
                float noche = smoothstep(0.03, -0.09, ndl);
                col += SAMPLE_TEXTURE2D(_Noche, sampler_Noche, i.uv).rgb * half3(1.0, 0.60, 0.24) * _BrilloLuces * noche;

                // atmósfera: bruma fina en el borde, azul de día y cálida en el terminador
                float rasante = pow(1.0 - saturate(dot(n, vista)), 4.0);
                half3 cielo = lerp(half3(1.0, 0.42, 0.12) * 0.55, _Atmosfera.rgb, saturate(ndl * 4.0 + 0.4)) * saturate(ndl * 2.5 + 0.3);
                col = lerp(col, cielo, rasante * 0.55);

                half alfa = _UsarAlfa > 0.5 ? texDia.a : 1.0;
                return half4(col, alfa);
            }
            ENDHLSL
        }
    }
    FallBack Off
}

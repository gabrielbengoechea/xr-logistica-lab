// Tierra vista desde la órbita: mezcla día/noche según la dirección del sol, luces urbanas del lado de la noche
// y un borde de atmósfera. Sin luces de URP ni sombras: una sola pasada, apta para Quest 2 (multiview).
Shader "Artigas1/TierraDiaNoche"
{
    Properties
    {
        _Dia ("Superficie de día", 2D) = "white" {}
        _Noche ("Luces de noche", 2D) = "black" {}
        _SolDir ("Dirección hacia el sol (mundo)", Vector) = (1, 0.15, 0.3, 0)
        _Atmosfera ("Color de la atmósfera", Color) = (0.35, 0.60, 1.00, 1)
        _BrilloLuces ("Brillo de las luces urbanas", Float) = 1.6
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
                float3 normalWS : TEXCOORD1;
                float3 positionWS : TEXCOORD2;
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
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = TRANSFORM_TEX(v.uv, _Dia);
                return o;
            }

            half4 frag (Varyings i) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
                float3 n = normalize(i.normalWS);
                float3 s = normalize(_SolDir.xyz);
                float ndl = dot(n, s);
                // terminador suave: unos grados de crepúsculo entre el día y la noche
                float dia = smoothstep(-0.10, 0.16, ndl);
                half4 texDia = SAMPLE_TEXTURE2D(_Dia, sampler_Dia, i.uv);
                half3 colDia = texDia.rgb * (0.18 + 0.82 * saturate(ndl + 0.08));
                half3 luces = SAMPLE_TEXTURE2D(_Noche, sampler_Noche, i.uv).rgb * _BrilloLuces * (1.0 - dia);
                half3 col = colDia * dia + luces;
                // atmósfera: borde azul que se aclara del lado iluminado y enrojece en el terminador
                float3 vista = GetWorldSpaceNormalizeViewDir(i.positionWS);
                float borde = pow(1.0 - saturate(dot(n, vista)), 3.0);
                float luzAtm = saturate(ndl * 2.5 + 0.35);
                half3 atm = lerp(half3(1.0, 0.45, 0.25), _Atmosfera.rgb, saturate(ndl * 4.0 + 0.5));
                col += atm * borde * luzAtm;
                half alfa = _UsarAlfa > 0.5 ? texDia.a : 1.0;
                return half4(col, alfa);
            }
            ENDHLSL
        }
    }
    FallBack Off
}

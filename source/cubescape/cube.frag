
precision lowp float;
precision lowp int;

@import ../shaders/facade.frag;


#if __VERSION__ == 100
    #define fragColor gl_FragColor
#else 
    layout(location = 0) out vec4 fragColor;
#endif


uniform sampler2D u_patches;
uniform int u_numcubes;

varying float v_heightAddition;
varying float v_vertexHeight;
varying vec3 v_position;


vec2 extract(in vec3 coords)
{
    return mix(mix(
            coords.xy,
            coords.xz,
            float(abs(coords.y) > 0.999)
        ),
        coords.zy,
        float(abs(coords.x) > 0.999)
    );
}


void main()
{
	vec2 texCoord = extract(v_position) * 0.5 + 0.5;
	float cubeHeight = 2.0 / float(u_numcubes);
	if(v_position.y < 0.999)
		texCoord.y = mod(v_vertexHeight, cubeHeight) / cubeHeight;
	texCoord.x *= 0.25;

	float t = (2.0 / 3.0 - v_heightAddition) * 1.5 * 4.0 - 1.0;
	vec4 c0 = texture(u_patches, texCoord + max(floor(t), 0.0) * vec2(0.25, 0.0));
	vec4 c1 = texture(u_patches, texCoord + min(floor(t) + 1.0, 3.0) * vec2(0.25, 0.0));

	fragColor = mix(c0, c1, smoothstep(0.25, 0.75, fract(t)));
}

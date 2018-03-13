
precision lowp float;

@import ../shaders/facade.vert;


#if __VERSION__ == 100
    attribute vec2 a_vertex;
#else 
    layout(location = 0) in vec2 a_vertex;
#endif


uniform mat4 u_transform;

varying vec2 v_uv;
varying vec3 v_ray;

void main()
{
    v_uv = a_vertex * 0.5 + 0.5; 
    vec4 ray = u_transform * vec4(a_vertex, 0.0, 1.0);
    v_ray = ray.xyz / ray.w;
    gl_Position = vec4(a_vertex, 0.0, 1.0);
}

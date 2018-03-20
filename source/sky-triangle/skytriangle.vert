
precision lowp float;

@import ../shaders/facade.vert;


#if __VERSION__ == 100
    attribute vec2 a_vertex;
#else 
    layout(location = 0) in vec2 a_vertex;
#endif


uniform mat4 u_inverseViewProjection;
uniform vec3 u_eye;

varying vec3 v_ray;


void main(void)
{
    vec4 ray = u_inverseViewProjection * vec4(a_vertex, 1.0, 1.0);
    v_ray = (ray.xyz / ray.w) - u_eye;

    gl_Position = vec4(a_vertex, 1.0, 1.0);
}

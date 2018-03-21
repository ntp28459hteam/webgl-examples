
@import ../shaders/facade.frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
    #extension GL_OES_standard_derivatives : enable
    precision lowp float;
#else
    precision lowp float;
    layout(location = 0) out vec4 fragColor;
#endif


uniform sampler2D u_vertices; // 1D
uniform sampler2D u_indices;  // 1D
uniform sampler2D u_colors;   // 1D
const float NUM_VERTICES = 24.0;
const float NUM_TRIANGLES = 30.0;
const float NUM_COLORS = 5.0;


uniform int u_frame;
uniform int u_rand;
uniform vec3 u_eye;
uniform vec4 u_viewport;

uniform sampler2D u_hsphere;
uniform sampler2D u_lights;
const vec2 LIGHT_SAMPLER_SIZE = vec2(32, 32); // textureSize(u_lights, 0);

varying vec2 v_uv;
varying vec4 v_ray;

const vec3 up = vec3(0.0, 1.0, 0.0);
const vec4 SPHERE = vec4(-0.5, +0.0, +0.5, 0.25); // center, radius
const vec3 LIGHT_COLOR = vec3(1.0, 10.76 / 16.86, 3.7 / 16.86);

const float EPSILON  = 1e-6;
const float INFINITY = 1e+4;

const int BOUNCES = 4;
const float EXPOSURE = 4.0;
const float GAMMA = 2.1;


vec3 vertexFetch(const in float index) {
    return texture(u_vertices, vec2(index / (NUM_VERTICES-1.0), 0)).xyz;
}


// intersection with triangle
bool intersectionTriangle(
	const in vec3  triangle[3]
,	const in vec3  origin
,	const in vec3  ray
,	const in float t_min
,   out float t)
{
    vec3 e0 = triangle[1] - triangle[0];
	vec3 e1 = triangle[2] - triangle[0];

	vec3  h = cross(ray, e1);
	float a = dot(e0, h);

	// if(a > -EPSILON && a < EPSILON) // backface culling off
	if(a < EPSILON) // backface culling on
		return false;

	float f = 1.0 / a;

	vec3  s = origin - triangle[0];
	float u = f * dot(s, h);

	if(u < 0.0 || u > 1.0)
		return false;

	vec3  q = cross(s, e0);
	float v = f * dot(ray, q);

	if(v < 0.0 || u + v > 1.0)
		return false;

	t = f * dot(e1, q);

	return EPSILON < t && t < t_min;
}

bool intersectionSphere(
    const in vec4  sphere
,   const in vec3  origin
,   const in vec3  ray
,   const in float t_min
,   out float t)
{
    float radius = sphere.w;
    vec3 center = sphere.xyz; 
    vec3 rayOriginToSphereCenter = origin - center;
    float dist = length(rayOriginToSphereCenter);
    float dot_term = dot(ray, rayOriginToSphereCenter);
    float someVar = dot_term * dot_term - dist * dist + radius * radius;
    if (someVar < EPSILON) { // no intersection
        return false;
    }
    t = -dot_term - sqrt(someVar);
    return EPSILON < t && t < t_min;
}

// intersection with scene geometry
float intersection(
    const in vec3 origin
,   const in vec3 ray
,   out vec3 normal
,   out vec3 color
,   out bool reflecting)
{
    float t_min = INFINITY;
    float t = INFINITY;

    float colorIndex;

    // intersection with triangles
	for(int i = 0; i < int(NUM_TRIANGLES); ++i)
	{
        vec3 triangle[3];
        vec4 triangleIndices = texture(u_indices, vec2(float(i) / (NUM_TRIANGLES-1.0), 0));
		triangle[0] = vertexFetch(triangleIndices[0]);
		triangle[1] = vertexFetch(triangleIndices[1]);
		triangle[2] = vertexFetch(triangleIndices[2]);

		if(intersectionTriangle(triangle, origin, ray, t_min, t))
		{
			normal = normalize(cross(
                triangle[1] - triangle[0],
                triangle[2] - triangle[0]
            ));
			colorIndex = triangleIndices[3];
			t_min = t;
            reflecting = colorIndex == 5.0;
		}
	}

    // intersection with sphere
    if(intersectionSphere(SPHERE, origin, ray, t_min, t))
    {
        vec3 intersectionPoint = origin + ray*t;
        normal = normalize(intersectionPoint - SPHERE.xyz);
        colorIndex = 4.0;
        t_min = t;
        reflecting = true;
    }

    color = texture(u_colors, vec2(colorIndex / (NUM_COLORS-1.0), 0)).xyz;

    return t_min;
}

// intersection with scene geometry
float shadow(
	const in int fragID
,	const in vec3 origin
,	const in vec3 normal
,   out float sqDistToLight)
{
    // get random point in light
	float i = mod(float(fragID), LIGHT_SAMPLER_SIZE.x * LIGHT_SAMPLER_SIZE.y);
    float x = mod(float(i), LIGHT_SAMPLER_SIZE.x);
    float y = i / LIGHT_SAMPLER_SIZE.x;
    vec3 pointInLight = texture(u_lights, vec2(x / (LIGHT_SAMPLER_SIZE.x - 1.0), y / (LIGHT_SAMPLER_SIZE.y - 1.0))).xyz;
    float distToLight = distance(pointInLight, origin);

	vec3 ray_direction = normalize(pointInLight - origin);

	float a = dot(ray_direction, normal);
	if(a < EPSILON)
	 	return 0.0;

    vec3 v1,v2; bool r; // unused
    float dist = intersection(origin, ray_direction, v1, v2, r);
    if(EPSILON < dist && dist <= distToLight)
        return 0.0;
        
    sqDistToLight = distToLight * distToLight;
	return a;
}

mat3 computeTbn(in vec3 normal)
{
    vec3 arbNormal = vec3(-1.241284e-02, -7.011432e-01, +2.043006e-01);
    arbNormal = mix(arbNormal, vec3(+2.019038e-01, +9.717299e-01, +1.223763e-01), 
        step(0.0, abs(dot(arbNormal, normal))));

    vec3 e0 = cross(arbNormal, normal);
	vec3 e1 = cross(e0, normal);

    return mat3(e0, normal, e1);
}

// select random point on hemisphere
vec3 randomPointOnHemisphere(const in int fragID)
{
    vec2 hspheresize = vec2(45.0); // textureSize(u_hsphere, 0);
	float i = mod(float(fragID), (hspheresize[0] * hspheresize[1]));

    float x = mod(i, hspheresize[0]);
    float y = i / hspheresize[0];

	return texture(u_hsphere, vec2(x / (hspheresize.x - 1.0), y / (hspheresize.y-1.0) )).xyz;
}

// http://gpupathtracer.blogspot.de/
// http://www.iquilezles.org/www/articles/simplepathtracing/simplepathtracing.htm
// http://undernones.blogspot.de/2010/12/gpu-ray-tracing-with-glsl.html
// http://www.iquilezles.org/www/articles/simplegpurt/simplegpurt.htm
// http://www.lighthouse3d.com/tutorials/maths/ray-triangle-intersection/

void main()
{
    vec3 ray_origin = u_eye;
    vec3 ray_direction = normalize((v_ray.xyz / v_ray.w) - ray_origin);

    // fragment index for random variation
	vec2 xy = v_uv * vec2(u_viewport[0], u_viewport[1]);
	int fragID = int(xy.y * u_viewport[0] + xy.x + float(u_frame) + float(u_rand));

	// path color accumulation
	vec3 maskColor = vec3(1.0);
	vec3 pathColor = vec3(0.0);

    // fragment is transparent before any intersection
    float alpha = 0.0;

	for(int bounce = 0; bounce < BOUNCES; ++bounce)
	{
        // check intersection with scene geometry
        vec3 normal;
        vec3 color;
        bool reflecting;
        float dist = intersection(ray_origin, ray_direction, normal, color, reflecting); 

        if(dist == INFINITY)
            break; // TODO: break on no intersection, with correct path color weight?

        // update ray for next bounce
        ray_origin = ray_origin + ray_direction * dist;
        if(reflecting){
            ray_direction = reflect(ray_direction, normal);
            if(bounce == 0) {
                alpha = 1.0;
            }
            continue;
        }
        ray_direction = computeTbn(normal) * randomPointOnHemisphere(fragID + bounce);

        // compute lighting and color
        alpha = 1.0;
        float squaredDistToLight = 1.0;
  		float lighting = shadow(fragID + bounce, ray_origin, normal, squaredDistToLight);
  	    maskColor *= color;
  		pathColor += maskColor * LIGHT_COLOR * lighting / squaredDistToLight;
    }

    fragColor = vec4(pow(EXPOSURE * pathColor, vec3(1.0 / GAMMA)), alpha);
}

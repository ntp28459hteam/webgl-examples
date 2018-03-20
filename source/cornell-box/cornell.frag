
precision lowp float;
precision lowp usampler2D;

@import ../shaders/facade.frag;

#if __VERSION__ == 100
    #define fragColor gl_FragColor
    #extension GL_OES_standard_derivatives : enable
#else
    layout(location = 0) out vec4 fragColor;
#endif


const int NUM_TRIANGLES = 32;
const int NUM_VERTICES = 24;
const int NUM_COLORS = 5;

const float vertices[NUM_VERTICES * 3] = float[NUM_VERTICES * 3]
(   // room
    -1.000000, -1.000000, -1.000000, -1.000000, -1.000000, +1.000000,
    -1.000000, +1.000000, -1.000000, -1.000000, +1.000000, +1.000000,
    +0.988489, -1.000000, -1.000000, +0.976978, -1.000000, +1.000000,
    +1.000000, +1.000000, -1.000000, +1.000000, +1.000000, +1.000000,
    // short block
    +0.043165, -1.000000, -0.592275, +0.043165, -0.398688, -0.592275,
    -0.136691, -1.000000, -0.027182, -0.136691, -0.398688, -0.027182,
    -0.705036, -1.000000, -0.195279, -0.705036, -0.398688, -0.195279,
    -0.532374, -1.000000, -0.767525, -0.532374, -0.398688, -0.767525,
    // tall block
    +0.521583, -1.000000, -0.116595, +0.521583, +0.202624, -0.116595,
    +0.697842, -1.000000, +0.452074, +0.697842, +0.202624, +0.452074,
    +0.129496, -1.000000, +0.630901, +0.129496, +0.202624, +0.630901,
    -0.046763, -1.000000, +0.058655, -0.046763, +0.202624, +0.058655
);

// v0, v1, v2, color
const int indices[NUM_TRIANGLES * 4] = int[NUM_TRIANGLES * 4]
(
    // room ceiling
    6, 7, 3, 1,
    6, 3, 2, 1,
    // room floor
    4, 0, 1, 1,
    4, 1, 5, 1,
    // room front wall
    6, 2, 0, 1,
    6, 0, 4, 1,
    // room back wall
    5, 1, 3, 1,
    5, 3, 7, 1,
    // room right wall
    1, 0, 2, 3,
    1, 2, 3, 3,
    // room left wall
    4, 5, 7, 2,
    4, 7, 6, 2,
    // short block
    15, 13, 11, 1,
    15, 11,  9, 1,
     8,  9, 11, 1,
     8, 11, 10, 1,
    14, 15,  9, 1,
    14,  9,  8, 1,
    12, 13, 15, 1,
    12, 15, 14, 1,
    10, 11, 13, 1,
    10, 13, 12, 1,
    // tall block
    23, 21, 19, 1,
    23, 19, 17, 1,
    16, 17, 19, 1,
    16, 19, 18, 1,
    22, 23, 17, 1,
    22, 17, 16, 1,
    20, 21, 23, 1,
    20, 23, 22, 1,
    18, 19, 21, 1,
    18, 21, 20, 1
);

const float colors[NUM_COLORS * 3] = float[NUM_COLORS * 3]
(
    0.0000, 0.0000, 0.0000,  // 0 black
    0.7295, 0.7355, 0.7290,  // 1 white
    0.6110, 0.0555, 0.0620,  // 2 red
    0.1170, 0.4125, 0.1150,  // 3 green
    0.0620, 0.0555, 0.6110   // 4 blue
); 

uniform int u_frame;
uniform int u_rand;
uniform vec3 u_eye;
uniform vec4 u_viewport;

uniform sampler2D u_hsphere;
uniform sampler2D u_lights;

varying vec2 v_uv;
varying vec4 v_ray;

const vec3 up = vec3(0.0, 1.0, 0.0);
const vec4 SPHERE = vec4(0.7, 0.7, 0.7, 0.2); // center, radius
const vec3 LIGHT_COLOR = vec3(1.0, 10.76 / 16.86, 3.7 / 16.86);

const float EPSILON  = 1e-6;
const float INFINITY = 1e+4;

const int BOUNCES = 6;
const float EXPOSURE = 5.2;
const float GAMMA = 2.1;


vec3 vertexFetch(const in int index) {
    return vec3(vertices[index * 3 + 0], vertices[index * 3 + 1], vertices[index * 3 + 2]);
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

    int colorIndex;

    // intersection with triangles
	for(int i = 0; i < 32; ++i)
	{
        vec3 triangle[3];
		triangle[0] = vertexFetch(indices[i*4+0]);
		triangle[1] = vertexFetch(indices[i*4+1]);
		triangle[2] = vertexFetch(indices[i*4+2]);

		if(intersectionTriangle(triangle, origin, ray, t_min, t))
		{
			normal = normalize(cross(
                triangle[1] - triangle[0],
                triangle[2] - triangle[0]
            ));
			colorIndex = indices[i*4+3];
			t_min = t;
            reflecting = colorIndex == 3;
		}
	}

    // intersection with sphere
    if(intersectionSphere(SPHERE, origin, ray, t_min, t))
    {
        vec3 intersectionPoint = origin + ray*t;
        normal = normalize(intersectionPoint - SPHERE.xyz);
        colorIndex = 4;
        t_min = t;
        reflecting = true;
    }

    color[0] = colors[colorIndex * 3 + 0];
    color[1] = colors[colorIndex * 3 + 1];
    color[2] = colors[colorIndex * 3 + 2];

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
	ivec2 lightssize = textureSize(u_lights, 0);
	int i = fragID % (lightssize[0] * lightssize[1]);
    int x = i % lightssize[0];
    int y = i / lightssize[0];
    vec3 pointInLight = texelFetch(u_lights, ivec2(x, y), 0).rgb;
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
    ivec2 hspheresize = textureSize(u_hsphere, 0);
	int i = fragID % (hspheresize[0] * hspheresize[1]);

    int x = i % hspheresize[0];
    int y = i / hspheresize[0];

	return texelFetch(u_hsphere, ivec2(x, y), 0).rgb;
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

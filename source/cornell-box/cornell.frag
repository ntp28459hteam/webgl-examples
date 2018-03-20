
precision lowp float;
precision lowp usampler2D;

@import ../shaders/facade.frag;


#if __VERSION__ == 100
    #define fragColor gl_FragColor
    #extension GL_OES_standard_derivatives : enable
#else
    layout(location = 0) out vec4 fragColor;
#endif


uniform int u_frame;
uniform int u_rand;
uniform vec3 u_eye;
uniform vec4 u_viewport;

uniform sampler2D u_vertices; // 1D
uniform usampler2D u_indices; // 1D
uniform sampler2D u_colors;   // 1D

uniform sampler2D u_hsphere;
uniform sampler2D u_lights;

varying vec2 v_uv;
varying vec4 v_ray;

const vec3 up = vec3(0.0, 1.0, 0.0);

const float EPSILON  = 1e-6;
const float INFINITY = 1e+4;

// intersection with triangle
bool intersectionTriangle(
	const in vec3  triangle[3]
,	const in vec3  origin
,	const in vec3  ray
,	const in float tm
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

	if (t < EPSILON)
		return false;

	return (t > 0.0) && (t < tm);
}

// plane intersection
bool intersectionPlane(
    const in vec4  plane
,   const in vec3  origin
,   const in vec3  ray
,   const in float tm
,   out float t)
{
    t = -(dot(plane.xyz, origin) + plane.w) / dot(plane.xyz, ray);
    return (t > 0.0) && (t < tm);
}


bool intersectionSphere(
    const in vec4  sphere
,   const in vec3  origin
,   const in vec3  ray
,   const in float tm
,   out float t)
{
    float radius = sphere.w;
    vec3 center = sphere.xyz; 
    vec3 rayOriginToSphereCenter = origin - center;
    float dist = length(rayOriginToSphereCenter);
    float dot_term = dot(ray, rayOriginToSphereCenter);
    float someVar = dot_term * dot_term - dist * dist + radius * radius;
    if (someVar <= 0.0) { // no intersection
        return false;
    }
    t = -dot_term - sqrt(someVar);
    return t < tm && t > EPSILON;
}

// intersection with scene geometry
float intersection(
    const in vec3 origin
,   const in vec3 ray
,   out vec3 triangle[3]
,   out int colorIndex)
{
    float t_min = INFINITY;
    float t = INFINITY;

	 vec3 triangleVertices[3];
	ivec4 triangleIndices;

	for(int i = 2; i < 34; ++i)
	{
		triangleIndices = ivec4(texelFetch(u_indices, ivec2(i, 0), 0));

		triangleVertices[0] = texelFetch(u_vertices, ivec2(triangleIndices[0], 0), 0).xyz;
		triangleVertices[1] = texelFetch(u_vertices, ivec2(triangleIndices[1], 0), 0).xyz;
		triangleVertices[2] = texelFetch(u_vertices, ivec2(triangleIndices[2], 0), 0).xyz;

		if(intersectionTriangle(triangleVertices, origin, ray, t_min, t))
		{
			triangle = triangleVertices;
			colorIndex = triangleIndices[3];
			t_min = t;
		}
	}

    return t_min;
}

// intersection with scene geometry
float shadow(
	const in int fragID
,	const in ivec2 lightssize
,	const in vec3 origin
,	const in vec3 n
,   out float dist)
{

    float tm = INFINITY;
	float t = INFINITY;

	 vec3 tv[3];
	 vec4 tc;
	ivec4 ti;

	int i = fragID % (lightssize[0] * lightssize[1]);

    int x = i % lightssize[0];
    int y = i / lightssize[0];

    vec3 pointInLight = texelFetch(u_lights, ivec2(x, y), 0).rgb;
	vec3 ray = normalize(pointInLight - origin);

	float a = dot(ray, n);

	if(a < EPSILON)
		return 0.0;

	for(int i = 4; i < 34; ++i)
	{
		ti = ivec4(texelFetch(u_indices, ivec2(i, 0), 0));

		tv[0] = texelFetch(u_vertices, ivec2(ti[0], 0), 0).xyz;
		tv[1] = texelFetch(u_vertices, ivec2(ti[1], 0), 0).xyz;
		tv[2] = texelFetch(u_vertices, ivec2(ti[2], 0), 0).xyz;

		if(intersectionTriangle( tv, origin, ray, tm, t))
			return 0.0;
	}

    vec3 sphereCenter = vec3(0.7, 0.7, 0.7);
    if(intersectionSphere(vec4(sphereCenter, 0.2), origin, ray, tm, t))
        return 0.0;
    
    // light is visible from origin
    dist = distance(origin, pointInLight);
	return a;
}

mat3 computeTbn(in vec3 normal)
{
    vec3 mathlyCorrectly = normalize(vec3(-1.241284e-02, -7.011432e-01, +2.043006e-01));
    mathlyCorrectly = mix(mathlyCorrectly, normalize(vec3(+2.019038e-01, +9.717299e-01, +1.223763e-01)), step(0.0, abs(dot(mathlyCorrectly, normal))));
    mat3 tangentspace;
    vec3 e0 = cross(mathlyCorrectly, normal);
	vec3 e1 = cross(e0, normal);

    tangentspace[0] = e0; 
    tangentspace[1] = normal; 
    tangentspace[2] = e1;

    return tangentspace;
}


// retrieve normal of triangle, and provide tangentspace
vec3 normal(const in vec3 triangle[3])
{
	vec3 e0 = triangle[1] - triangle[0];
	vec3 e1 = triangle[2] - triangle[0];

    vec3 n = normalize(cross(e0, e1));

    return n;
}

// select random point on hemisphere
vec3 randomPointOnHemisphere(const in int fragID, const in ivec2 hspheresize)
{
	int i = fragID % (hspheresize[0] * hspheresize[1]);

    int x = i % hspheresize[0];
    int y = i / hspheresize[0];

	return texelFetch(u_hsphere, ivec2(x, y), 0).rgb;
}

// http://gpupathtracer.blogspot.de/
// http://www.iquilezles.org/www/articles/simplepathtracing/simplepathtracing.htm
// http://www.cs.dartmouth.edu/~fabio/teaching/graphics08/lectures/18_PathTracing_Web.pdf
// http://undernones.blogspot.de/2010/12/gpu-ray-tracing-with-glsl.html
// http://www.iquilezles.org/www/articles/simplegpurt/simplegpurt.htm
// http://www.lighthouse3d.com/tutorials/maths/ray-triangle-intersection/

void main()
{
    vec3 origin = u_eye;
    vec3 ray = normalize((v_ray.xyz / v_ray.w) - origin);

	ivec2 hspheresize = textureSize(u_hsphere, 0);
	ivec2 lightssize = textureSize(u_lights, 0);

    // fragment index for random variation
	vec2 xy = v_uv * vec2(u_viewport[0], u_viewport[1]);
	int fragID = int(xy.y * u_viewport[0] + xy.x + float(u_frame) + float(u_rand));

	// path color accumulation
	vec3 maskColor = vec3(1.0);
	vec3 pathColor = vec3(0.0);
	vec3 lastColor = vec3(0.0);
    
    mat3 tangentspace;
    vec3 rSphere;
    
	float t = INFINITY;
    float alpha = 0.0;
    float attenuationSum = 0.0;
    int bounces = 5;
    float gamma = 1.0;

        vec3 n;
	for(int bounce = 0; bounce < bounces; ++bounce)
	{
        // triangle data
        vec3 triangle[3];
        int colorIndex;

  		t = intersection(origin, ray, triangle, colorIndex); // compute t from objects

        float dist;
        vec3 sphereCenter = vec3(0.7, 0.7, 0.7);
        if(intersectionSphere(vec4(sphereCenter, 0.2), origin, ray, t, dist))
        {
            colorIndex = 4;
            origin = dist*ray + origin;
            n = normalize(origin - sphereCenter);
        }
        else
        { 
            if(t == INFINITY)
                break; // TODO: break on no intersection, with correct path color weight?

            origin = origin + ray * t;
            n = normal(triangle);
        }

        tangentspace = computeTbn(n);
        alpha = 1.0;

  		vec3 color = texelFetch(u_colors, ivec2(colorIndex, 0), 0).xyz; // compute material color from hit
        float distToLight = 1.0;
  		float lighting = shadow(fragID + bounce, lightssize, origin, n, distToLight); // compute direct lighting from hit

  		// accumulate incoming light

        float attenuation = 1.0 / (distToLight * distToLight);
        attenuationSum += attenuation;
  		maskColor *= color;
  		pathColor += maskColor * lighting * attenuation;

        rSphere = randomPointOnHemisphere(fragID + bounce, hspheresize);

        // ray = reflect(ray, n);
        ray = tangentspace * rSphere; // compute next ray
    }

    fragColor = vec4(pow(pathColor, vec3(1.0 / gamma)), alpha);
    // fragColor = vec4(n, 1.0);
}

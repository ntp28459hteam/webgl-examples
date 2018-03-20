
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

// uniform sampler2D u_vertices; // 1D
const float vertices[72] = float[72]
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

// uniform sampler2D u_colors;   // 1D
const float colors[12] = float[12]
    (0.0000, 0.0000, 0.0000,  // 0 black
     0.7295, 0.7355, 0.7290,  // 1 white
     0.6110, 0.0555, 0.0620,  // 2 red
     0.1170, 0.4125, 0.1150); // 3 green

const vec3 light = vec3(1.0, 10.76 / 16.86, 3.7 / 16.86);

uniform usampler2D u_indices; // 1D
uniform sampler2D u_hsphere;
uniform sampler2D u_lights;

varying vec2 v_uv;
varying vec4 v_ray;

const vec3 up = vec3(0.0, 1.0, 0.0);

const float EPSILON  = 1e-6;
const float INFINITY = 1e+4;

const int BOUNCES = 3;
const float EXPOSURE = 5.2;
const float GAMMA = 2.1;


vec3 vertexFetch(const in int index) {
    int i = index - 4;
    return vec3(vertices[i * 3 + 0], vertices[i * 3 + 1], vertices[i * 3 + 2]);
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

	if (t < EPSILON)
		return false;

	return (t > 0.0) && (t < t_min);
}

// // plane intersection
// bool intersectionPlane(
//     const in vec4  plane
// ,   const in vec3  origin
// ,   const in vec3  ray
// ,   const in float tm
// ,   out float t)
// {
//     t = -(dot(plane.xyz, origin) + plane.w) / dot(plane.xyz, ray);
//     return (t > 0.0) && (t < tm);
// }

// // sphere intersection
// bool intersectionSphere(
//     const in vec4  sphere
// ,   const in vec3  origin
// ,   const in vec3  ray
// ,   const in float tm
// ,   out float t)
// {
//     bool  r = false;
//     vec3  d = origin - sphere.xyz;  // distance

//     float b = dot(ray, d);
//     float c = dot(d, d) - sphere.w * sphere.w;

//     t = b * b - c;

//     if(t > 0.0)
//     {
//         t = -b - sqrt(t);
//         r = (t > 0.0) && (t < tm);
//     }
//     return r;
// }

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

	for(int i = 0; i < 30; ++i)
	{
		triangleIndices = ivec4(texelFetch(u_indices, ivec2(i, 0), 0));

		triangleVertices[0] = vertexFetch(triangleIndices[0]);
		triangleVertices[1] = vertexFetch(triangleIndices[1]);
		triangleVertices[2] = vertexFetch(triangleIndices[2]);

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
    float t_min = INFINITY;
	float t = INFINITY;

	 vec3 tv[3];
	 vec4 tc;
	ivec4 ti;

	int i = fragID % (lightssize[0] * lightssize[1]);

    int x = i % lightssize[0];
    int y = i / lightssize[0];

    vec3 pointInLight = texelFetch(u_lights, ivec2(x, y), 0).rgb;
    float t_check = distance(pointInLight, origin);
	vec3 ray = normalize(pointInLight - origin);

	float a = dot(ray, n);
	if(a < EPSILON)
	 	return 0.0;

	for(int i = 0; i < 30; ++i)
	{
		ti = ivec4(texelFetch(u_indices, ivec2(i, 0), 0));

		tv[0] = vertexFetch(ti[0]);
		tv[1] = vertexFetch(ti[1]);
		tv[2] = vertexFetch(ti[2]);

        intersectionTriangle(tv, origin, ray, t_min, t);
		if(t > 0.0 && t <= t_check)
		 	return 0.0;
	}
    
    vec3 delta = origin - pointInLight;
    dist = dot(delta, delta);
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


// retrieve normal of triangle
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

highp float rand(vec2 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

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
    
    mat3 tangentspace;
    vec3 rSphere;

	float t = INFINITY;
    float alpha = 0.0;
	for(int bounce = 0; bounce < BOUNCES; ++bounce)
	{
        // triangle data
        vec3 triangle[3];
        int colorIndex;
  		t = intersection(origin, ray, triangle, colorIndex); // compute t from objects

		if(t >= INFINITY)
			break;

        alpha = 1.0;

		origin = origin + ray * t;

		vec3 n = normal(triangle);
        tangentspace = computeTbn(n);

  		vec3 color;
          color[0] = colors[colorIndex * 3 + 0];
          color[1] = colors[colorIndex * 3 + 1];
          color[2] = colors[colorIndex * 3 + 2];

        float squaredDistToLight = 1.0;
  		float lighting = shadow(fragID + bounce, lightssize, origin, n, squaredDistToLight); // compute direct lighting from hit

  	    maskColor *= color;
  		pathColor += maskColor * light * lighting / squaredDistToLight; // /* maskColor * light **/ lighting;

        rSphere = randomPointOnHemisphere(fragID + bounce, hspheresize);

        // ray = reflect(ray, n);
        ray = tangentspace * rSphere; // compute next ray
	}

    fragColor = vec4(pow(EXPOSURE * pathColor, vec3(1.0 / GAMMA)), alpha);
}

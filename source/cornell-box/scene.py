import numpy as np

lights = np.array([
    343.0, 448.8, 227.0, 343.0, 548.8, 332.0, 213.0, 548.8, 332.0,  213.0, 548.8, 227.0])
room = np.array([
    0.0, 0.0, 0.0, 0.0, 0.0, 559.2, 0.0, 548.8, 0.0, 0.0, 548.8, 559.2, 552.8, 0.0, 0.0, 549.6, 0.0, 559.2,  556.0, 548.8, 0.0, 556.0, 548.8, 559.2])
short_block = np.array([
    290.0, 0.0, 114.0, 290.0, 165.0, 114.0, 240.0, 0.0, 272.0, 240.0, 165.0, 272.0, 82.0, 0.0, 225.0, 82.0, 165.0, 225.0, 130.0, 0.0, 65.0, 130.0, 165.0, 65.0])
tall_block = np.array([
    423.0, 0.0, 247.0, 423.0, 330.0, 247.0,    472.0, 0.0, 406.0,    472.0, 330.0, 406.0,    314.0, 0.0, 456.0,    314.0, 330.0, 456.0,    265.0, 0.0, 296.0,    265.0, 330.0, 296.0])

camera = np.array([278.0, 273.0, -800.0, 278.0, 273.0, 279.6, 0.0, 1.0, 0.0])

room_min = np.array([np.amin(room[0::3]), np.amin(
    room[1::3]), np.amin(room[2::3])])
room_max = np.array([np.amax(room[0::3]), np.amax(
    room[1::3]), np.amax(room[2::3])])
room_scale = 2.0 * np.reciprocal(np.subtract(room_max, room_min))

print(room_max, room_min, room_scale)

lights[0::3] *= room_scale[0]
lights[1::3] *= room_scale[1]
lights[2::3] *= room_scale[2]
lights -= 1.0

room[0::3] *= room_scale[0]
room[1::3] *= room_scale[1]
room[2::3] *= room_scale[2]
room -= 1.0

short_block[0::3] *= room_scale[0]
short_block[1::3] *= room_scale[1]
short_block[2::3] *= room_scale[2]
short_block -= 1.0

tall_block[0::3] *= room_scale[0]
tall_block[1::3] *= room_scale[1]
tall_block[2::3] *= room_scale[2]
tall_block -= 1.0

camera[0::3] *= room_scale[0]
camera[1::3] *= room_scale[1]
camera[2::3] *= room_scale[2]
camera -= 1.0


np.set_printoptions(precision=6, floatmode='fixed', sign='+')

print('lights', np.array2string(lights, separator=', '))
print('room', np.array2string(room, separator=', '))
print('short_block', np.array2string(short_block, separator=', '))
print('tall_block', np.array2string(tall_block, separator=', '))
print('camera', np.array2string(camera, separator=', '))

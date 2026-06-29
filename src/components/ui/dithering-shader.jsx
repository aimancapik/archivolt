import { useEffect, useRef } from 'react';

const vertexShaderSource = `#version 300 es
precision mediump float;
layout(location = 0) in vec4 a_position;
void main() {
  gl_Position = a_position;
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_pxSize;

out vec4 fragColor;

#define TWO_PI 6.28318530718

const int bayer8x8[64] = int[64](
   0, 32,  8, 40,  2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44,  4, 36, 14, 46,  6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
   3, 35, 11, 43,  1, 33,  9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47,  7, 39, 13, 45,  5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv) {
  ivec2 pos = ivec2(mod(uv, 8.0));
  int index = pos.y * 8 + pos.x;
  return float(bayer8x8[index]) / 64.0;
}

void main() {
  float t = 0.5 * u_time;
  vec2 pxSizeUv = gl_FragCoord.xy - 0.5 * u_resolution;
  pxSizeUv /= u_pxSize;

  vec2 shapeUv = floor(pxSizeUv) * u_pxSize / u_resolution.xy;

  float shape = 0.0;
  if (u_shape < 1.5) {
    shapeUv *= 4.0;
    float wave = cos(0.5 * shapeUv.x - 2.0 * t) * sin(1.5 * shapeUv.x + t) * (0.75 + 0.25 * cos(3.0 * t));
    shape = 1.0 - smoothstep(-1.0, 1.0, shapeUv.y + wave);
  } else if (u_shape < 2.5) {
    float dist = length(shapeUv * vec2(u_resolution.x / u_resolution.y, 1.0));
    shape = sin(pow(dist, 1.7) * 9.0 - 3.0 * t) * 0.5 + 0.5;
  } else {
    shapeUv *= 3.0;
    for (float i = 1.0; i < 5.0; i++) {
      shapeUv.x += 0.35 / i * cos(i * 2.5 * shapeUv.y + t);
      shapeUv.y += 0.35 / i * cos(i * 1.5 * shapeUv.x + t);
    }
    shape = smoothstep(0.08, 0.8, 0.12 / abs(sin(t - shapeUv.y - shapeUv.x)));
  }

  float res = step(0.5, shape + getBayerValue(pxSizeUv) - 0.5);

  float opacity = u_colorFront.a * res;
  fragColor = vec4(u_colorFront.rgb * opacity, opacity);
}
`;

function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1, alpha];

  return [
    Number.parseInt(result[1], 16) / 255,
    Number.parseInt(result[2], 16) / 255,
    Number.parseInt(result[3], 16) / 255,
    alpha,
  ];
}

const SHAPES = {
  wave: 1,
  ripple: 2,
  warp: 3,
};

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function DitheringShader({
  color = '#ffffff',
  alpha = 0.08,
  shape = 'wave',
  pxSize = 3,
  speed = 0.6,
  className = '',
  style,
  ...props
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const gl = canvas?.getContext('webgl2', { alpha: true });
    if (!canvas || !wrap || !gl) return undefined;

    const program = createProgram(gl);
    if (!program) return undefined;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      colorFront: gl.getUniformLocation(program, 'u_colorFront'),
      shape: gl.getUniformLocation(program, 'u_shape'),
      pxSize: gl.getUniformLocation(program, 'u_pxSize'),
    };

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    const startedAt = Date.now();

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const render = () => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(uniforms.time, (Date.now() - startedAt) * 0.001 * speed);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform4fv(uniforms.colorFront, hexToRgba(color, alpha));
      gl.uniform1f(uniforms.shape, SHAPES[shape] || SHAPES.wave);
      gl.uniform1f(uniforms.pxSize, pxSize);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = requestAnimationFrame(render);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  }, [alpha, color, pxSize, shape, speed]);

  return (
    <div ref={wrapRef} className={className} style={style} {...props}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

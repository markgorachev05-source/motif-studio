const canvas = document.querySelector("#world");
const status = document.querySelector("#scene-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uMvp;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;
void main() {
  vec4 worldPosition = uModel * vec4(aPosition, 1.0);
  vPosition = worldPosition.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}`;

const fragmentSource = `
precision mediump float;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(-vPosition);
  vec3 keyLight = normalize(vec3(-0.45, 0.72, 0.62));
  vec3 fillLight = normalize(vec3(0.72, -0.16, 0.52));
  float diffuse = max(dot(normal, keyLight), 0.0);
  float fill = max(dot(normal, fillLight), 0.0);
  vec3 halfVector = normalize(keyLight + viewDir);
  float specular = pow(max(dot(normal, halfVector), 0.0), 38.0);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8);
  vec3 color = vColor * (0.20 + diffuse * 0.84 + fill * 0.18);
  color += vec3(0.72, 0.88, 0.69) * specular * 0.8;
  color += vec3(0.30, 0.58, 0.37) * rim * 0.34;
  float haze = smoothstep(8.2, 4.0, length(vPosition));
  color = mix(color * 0.52, color, haze);
  gl_FragColor = vec4(color, uOpacity);
}`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Shader compile failed");
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
  return program;
}

const hex = (value) => {
  const color = value.replace("#", "");
  return [0, 2, 4].map((start) => parseInt(color.slice(start, start + 2), 16) / 255);
};
const vec = (x, y, z) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, amount) => [a[0] * amount, a[1] * amount, a[2] * amount];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const length = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / length, a[1] / length, a[2] / length]; };

class GeometryBuilder {
  constructor() { this.positions = []; this.normals = []; this.colors = []; this.indices = []; }
  vertex(position, normal, color) {
    this.positions.push(...position); this.normals.push(...norm(normal)); this.colors.push(...color);
    return this.positions.length / 3 - 1;
  }
  triangle(a, b, c) { this.indices.push(a, b, c); }
  tube(points, radius, color, sides = 12) {
    const segments = (points.length - 1) * 10;
    const centers = [];
    for (let i = 0; i <= segments; i++) {
      const scaled = (i / segments) * (points.length - 1);
      const section = Math.min(points.length - 2, Math.floor(scaled));
      const t = scaled - section;
      const p0 = points[Math.max(0, section - 1)];
      const p1 = points[section];
      const p2 = points[section + 1];
      const p3 = points[Math.min(points.length - 1, section + 2)];
      const sample = [0, 1, 2].map((axis) => 0.5 * (
        2 * p1[axis] + (-p0[axis] + p2[axis]) * t +
        (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t * t +
        (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t * t * t
      ));
      centers.push(sample);
    }
    const start = this.positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const tangent = norm(sub(centers[Math.min(i + 1, segments)], centers[Math.max(i - 1, 0)]));
      const guide = Math.abs(tangent[1]) > 0.9 ? vec(1, 0, 0) : vec(0, 1, 0);
      const normal = norm(cross(tangent, guide));
      const binormal = norm(cross(tangent, normal));
      const taper = 0.48 + 0.52 * Math.sin(Math.PI * i / segments) ** 0.45;
      const localRadius = radius * taper;
      for (let j = 0; j <= sides; j++) {
        const angle = (j / sides) * Math.PI * 2;
        const radial = add(mul(normal, Math.cos(angle)), mul(binormal, Math.sin(angle)));
        this.vertex(add(centers[i], mul(radial, localRadius)), radial, color);
      }
    }
    const row = sides + 1;
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = start + i * row + j, b = a + row, c = b + 1, d = a + 1;
      this.triangle(a, b, d); this.triangle(b, c, d);
    }
  }
  sphere(center, radius, color, rows = 14, columns = 20) {
    const start = this.positions.length / 3;
    for (let y = 0; y <= rows; y++) {
      const v = y / rows;
      const latitude = v * Math.PI;
      for (let x = 0; x <= columns; x++) {
        const u = x / columns;
        const longitude = u * Math.PI * 2;
        const normal = [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)];
        this.vertex(add(center, mul(normal, radius)), normal, color);
      }
    }
    const row = columns + 1;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = start + y * row + x, b = a + row, c = b + 1, d = a + 1;
      this.triangle(a, d, b); this.triangle(b, d, c);
    }
  }
  petal(center, angle, length, width, color, lift = 0.18, depth = 0.04) {
    const rows = 12, columns = 10, start = this.positions.length / 3;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (let i = 0; i <= rows; i++) {
      const u = i / rows;
      const spread = width * Math.sin(Math.PI * u) ** 0.82 * (0.82 + u * 0.18);
      for (let j = 0; j <= columns; j++) {
        const v = (j / columns) * 2 - 1;
        const localX = Math.cos(angle) * (0.045 + u * length) - Math.sin(angle) * v * spread;
        const localY = Math.sin(angle) * (0.045 + u * length) + Math.cos(angle) * v * spread;
        const localZ = depth + lift * Math.sin(Math.PI * u) * (1 - v * v);
        const px = center[0] + localX, py = center[1] + localY, pz = center[2] + localZ;
        const derivativeU = lift * Math.PI * Math.cos(Math.PI * u) * (1 - v * v) / length;
        const derivativeV = -lift * v / Math.max(width, 0.02);
        const localNormal = norm([-derivativeU, -derivativeV, 1]);
        const rotatedNormal = [localNormal[0] * c - localNormal[1] * s, localNormal[0] * s + localNormal[1] * c, localNormal[2]];
        this.vertex([px, py, pz], rotatedNormal, color);
      }
    }
    const row = columns + 1;
    for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
      const a = start + i * row + j, b = a + row, d = a + 1, cc = b + 1;
      this.triangle(a, d, b); this.triangle(b, d, cc);
    }
  }
  buffer(gl) {
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normals), gl.STATIC_DRAW);
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colors), gl.STATIC_DRAW);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);
    return { vertexBuffer, normalBuffer, colorBuffer, indexBuffer, count: this.indices.length };
  }
}

function buildVines(mobile = false) {
  const builder = new GeometryBuilder();
  const x = mobile ? 0.48 : 1;
  const base = [
    { color: "#668858", radius: .28, pts: [[-4.15,-.75,-.1],[-3.55,-1.22,-.15],[-3.46,-.58,.1],[-3.95,.08,.25],[-3.36,.5,.15],[-2.94,1.1,-.1],[-3.2,1.73,-.2]] },
    { color: "#8bab76", radius: .19, pts: [[-4.2,1.55,-.35],[-3.48,1.36,-.2],[-2.9,1.65,.0],[-2.35,1.34,.25],[-2.1,.95,.2],[-2.52,.73,-.05]] },
    { color: "#728e5b", radius: .3, pts: [[-4.1,-1.65,.05],[-3.32,-1.38,.12],[-2.7,-1.59,.32],[-2.28,-1.44,.4],[-2.15,-1.12,.12],[-2.62,-.97,-.05]] },
    { color: "#91a971", radius: .22, pts: [[4.08,1.57,-.25],[3.32,1.46,-.1],[2.83,1.12,.12],[2.92,.61,.23],[3.51,.34,.2],[4.04,.62,0]] },
    { color: "#66875c", radius: .31, pts: [[4.13,-.82,-.25],[3.43,-.72,-.18],[2.94,-1.08,.13],[3.13,-1.62,.26],[3.71,-1.77,.16],[4.15,-1.43,-.05]] },
    { color: "#88a66b", radius: .17, pts: [[3.97,-1.47,.02],[3.39,-1.19,.24],[2.77,-.94,.18],[2.34,-1.12,-.08],[2.18,-1.4,-.15]] },
    { color: "#9c473d", radius: .12, pts: [[-3.87,1.3,.22],[-3.44,.93,.5],[-3.06,1.02,.64],[-2.76,1.42,.32]] },
    { color: "#c46b51", radius: .095, pts: [[3.98,1.15,.18],[3.48,.83,.45],[3.06,.97,.52],[2.81,1.38,.22]] },
  ];
  for (const vine of base) {
    const points = vine.pts.map(([px, py, pz]) => vec(px * x, mobile ? py * .88 : py, pz));
    builder.tube(points, mobile ? vine.radius * .8 : vine.radius, hex(vine.color), 14);
  }
  const pearls = [
    [-2.52,.38,.48,.12,"#df274b"],[-2.59,.38,.58,.064,"#ffd26d"],[-2.59,.38,.64,.026,"#11120f"],
    [2.8,.56,.48,.1,"#e5483e"],[2.8,.56,.58,.05,"#f7cb62"],[2.8,.56,.62,.023,"#161310"],
    [-3.57,-.06,.35,.075,"#de8164"],[3.73,-.2,.44,.07,"#dcd8be"],[1.98,-1.04,.23,.045,"#d1b58b"],[-1.88,1.22,.28,.054,"#e4d3c0"]
  ];
  for (const [px,py,pz,r,color] of pearls) builder.sphere(vec(px * x, py, pz), r, hex(color), 10, 16);
  return builder;
}

function buildFlowers(mobile = false) {
  const builder = new GeometryBuilder();
  const palette = ["#e94362", "#f34a30", "#f2a832", "#e43991", "#a955ca", "#ffda56", "#f06435", "#cb3f63"];
  const centers = mobile
    ? [[-1.18,.95,.05,.45],[-.46,1.38,-.1,.38],[.63,1.26,.0,.45],[1.05,.43,-.1,.37],[-1.12,-.17,-.05,.4],[.3,-.42,.04,.5],[1.12,-1.1,-.1,.38],[-.72,-1.38,.02,.38]]
    : [[-3.02,.9,.05,.52],[-2.25,-.5,-.08,.63],[-1.56,1.18,.0,.48],[-1.08,-1.16,-.04,.55],[-.37,.43,.08,.58],[.35,-.66,-.03,.53],[.96,1.18,-.1,.51],[1.55,-1.04,.02,.58],[2.17,.41,-.08,.64],[3.03,-.32,.04,.48],[-2.7,-1.47,.0,.39],[2.7,1.39,-.05,.42]];
  centers.forEach(([x, y, z, size], index) => {
    const center = vec(x, y, z);
    const petals = 7 + index % 3;
    const twist = (index % 2) * .19 + index * .37;
    for (let petal = 0; petal < petals; petal++) {
      const angle = (petal / petals) * Math.PI * 2 + twist;
      const color = hex(palette[(petal + index * 2) % palette.length]);
      builder.petal(center, angle, size * (0.7 + (petal % 3) * .06), size * .24, color, size * .17, z + .035);
    }
    builder.sphere(vec(x, y, z + .115), size * .15, hex(index % 2 ? "#f8c94d" : "#efab42"), 10, 16);
    builder.sphere(vec(x, y, z + .18), size * .062, hex("#62311e"), 8, 12);
  });
  return builder;
}

function multiplyMatrix(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
  }
  return out;
}
function translate(x, y, z) { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }
function scale(x, y, z) { return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]); }
function rotateX(a) { const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); }
function rotateY(a) { const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); }
function rotateZ(a) { const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); }
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,(2*far*near)*nf,0]);
}
function compose(position, rotation, size) {
  let model = translate(position[0], position[1], position[2]);
  model = multiplyMatrix(model, rotateZ(rotation[2]));
  model = multiplyMatrix(model, rotateY(rotation[1]));
  model = multiplyMatrix(model, rotateX(rotation[0]));
  return multiplyMatrix(model, scale(size[0], size[1], size[2]));
}

function startScene() {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power", depth: true });
  if (!gl) throw new Error("WebGL is not available");
  const program = createProgram(gl);
  const loc = {
    position: gl.getAttribLocation(program, "aPosition"), normal: gl.getAttribLocation(program, "aNormal"), color: gl.getAttribLocation(program, "aColor"),
    mvp: gl.getUniformLocation(program, "uMvp"), model: gl.getUniformLocation(program, "uModel"), opacity: gl.getUniformLocation(program, "uOpacity")
  };
  const vineDesktop = buildVines(false).buffer(gl);
  const vineMobile = buildVines(true).buffer(gl);
  const flowerDesktop = buildFlowers(false).buffer(gl);
  const flowerMobile = buildFlowers(true).buffer(gl);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let width = 0, height = 0, targetProgress = 0, progress = 0, time = 0, lastFrame = 0, framePending = false;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const mobile = () => window.innerWidth < 700;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, mobile() ? 1.18 : 1.48);
    width = Math.max(1, Math.floor(window.innerWidth * dpr));
    height = Math.max(1, Math.floor(window.innerHeight * dpr));
    canvas.width = width; canvas.height = height;
    gl.viewport(0, 0, width, height);
    requestDraw();
  }
  function readScroll() {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    targetProgress = range > 0 ? Math.max(0, Math.min(1, window.scrollY / range)) : 0;
    if (reducedMotion.matches) { progress = targetProgress; draw(performance.now()); }
    else requestDraw();
  }
  function bindMesh(mesh) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.enableVertexAttribArray(loc.position);
    gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
    gl.enableVertexAttribArray(loc.normal);
    gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
    gl.enableVertexAttribArray(loc.color);
    gl.vertexAttribPointer(loc.color, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  }
  function renderMesh(mesh, projection, model, opacity) {
    if (opacity <= .002) return;
    const mvp = multiplyMatrix(projection, model);
    gl.uniformMatrix4fv(loc.model, false, model);
    gl.uniformMatrix4fv(loc.mvp, false, mvp);
    gl.uniform1f(loc.opacity, opacity);
    bindMesh(mesh);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }
  function smooth(edge0, edge1, value) {
    const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return x * x * (3 - 2 * x);
  }
  function draw(now) {
    framePending = false;
    if (!width || !height) return;
    const seconds = now * .001;
    const delta = lastFrame ? Math.min(.05, (now - lastFrame) * .001) : .016;
    lastFrame = now;
    if (!reducedMotion.matches) {
      progress += (targetProgress - progress) * .075;
      time += delta;
      pointer.x += (pointer.targetX - pointer.x) * .025;
      pointer.y += (pointer.targetY - pointer.y) * .025;
    }
    const aspect = width / height;
    const projection = perspective((mobile() ? 50 : 46) * Math.PI / 180, aspect, .1, 100);
    const phase = progress * 4;
    const vineModel = compose(
      [pointer.x * .14, pointer.y * .11 + Math.sin(time * .29) * .04, -5.35],
      [Math.sin(time * .17) * .045 + pointer.y * .025, Math.sin(time * .12) * .065 + phase * .17 + pointer.x * .025, Math.sin(time * .1) * .025],
      [1, 1, 1]
    );
    const bloom = smooth(.54, .96, phase) * (1 - smooth(1.37, 1.92, phase));
    const flowerScale = mobile() ? .92 : 1;
    const flowerModel = compose(
      [pointer.x * .08, .0 + Math.sin(time * .32) * .025, -5.12],
      [pointer.y * .035, Math.sin(time * .15) * .08 + phase * .09, Math.sin(time * .11) * .018],
      [flowerScale * (.86 + bloom * .14), flowerScale * (.86 + bloom * .14), 1]
    );

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    renderMesh(mobile() ? vineMobile : vineDesktop, projection, vineModel, .96);
    const flowerModelAlpha = bloom * .98;
    renderMesh(mobile() ? flowerMobile : flowerDesktop, projection, flowerModel, flowerModelAlpha);

    if (!reducedMotion.matches) {
      if (Math.abs(targetProgress - progress) > .0003 || !document.hidden) requestDraw();
    }
  }
  function requestDraw() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(draw);
  }
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("pointermove", (event) => {
    if (mobile() || reducedMotion.matches) return;
    pointer.targetX = (event.clientX / window.innerWidth - .5) * 2;
    pointer.targetY = (.5 - event.clientY / window.innerHeight) * 2;
  }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) requestDraw(); });
  reducedMotion.addEventListener?.("change", () => requestDraw());
  resize();
  readScroll();
  requestDraw();
  document.body.classList.add("scene-ready");
  status.textContent = "WORLD READY";
}

try {
  startScene();
} catch (error) {
  console.warn("MOTIF scene fallback:", error);
  document.body.classList.add("scene-failed");
  status.textContent = "STATIC VIEW / SCENE UNAVAILABLE";
}

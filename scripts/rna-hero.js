// Rouskin Lab — RNA hero
// Fine-grained folded RNA particle field inspired by scientific network imagery:
// one continuous strand, local paired stems, loops, bulges, junctions, and
// restrained mouse-reactive field motion. No DNA double helix, no rubber tube.

let useThree = true;
const stage = document.querySelector(".rna-stage");
const canvas = document.querySelector("#rnaHero");

function markFallback(reason) {
  useThree = false;
  if (stage) stage.setAttribute("data-canvas-failed", "true");
  if (reason) console.warn("[rna-hero] falling back:", reason);
}

if (!canvas || !stage) {
  // nothing to mount
} else if (!window.WebGLRenderingContext) {
  markFallback("no WebGL");
} else {
  import("../vendor/three.module.min.js")
    .then((mod) => {
      try { buildScene(mod, canvas, stage); }
      catch (err) { markFallback(err && err.message || err); }
    })
    .catch((err) => markFallback(err && err.message || err));
}

function buildScene(THREE, canvas, stage) {
  stage.removeAttribute("data-canvas-failed");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.1, 10.8);
  camera.lookAt(0, 0, 0);

  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  const zAxis = V(0, 0, 1);

  const COL = {
    ink: new THREE.Color("#1f4288"),
    inkDeep: new THREE.Color("#142a61"),
    inkSoft: new THREE.Color("#48639a"),
    backbone: new THREE.Color("#26334f"),
    sugar: new THREE.Color("#38517f"),
    pair: new THREE.Color("#6f6a5f"),
    ensemble: new THREE.Color("#2f7d78"),
    dms: new THREE.Color("#a72336"),
    dmsSoft: new THREE.Color("#cf6a72"),
    amber: new THREE.Color("#c4901a"),
    sage: new THREE.Color("#3e6e69"),
    pale: new THREE.Color("#fff5dc")
  };

  const BASES = ["A", "U", "G", "C"];
  const BASE_COLORS = {
    A: new THREE.Color("#1f4288"),
    U: new THREE.Color("#284d91"),
    G: new THREE.Color("#26477f"),
    C: new THREE.Color("#31598f")
  };

  const group = new THREE.Group();
  group.position.set(0.0, -0.08, 0);
  group.rotation.set(-0.08, -0.16, -0.04);
  group.scale.setScalar(0.93);
  scene.add(group);

  function rotatePoint(x, y, angle, origin, zLift = 0) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    return V(
      origin.x + x * ca - y * sa,
      origin.y + x * sa + y * ca,
      origin.z + zLift
    );
  }

  function curveBetween(a, b, steps, bend = 0.35, zLift = 0.0) {
    const pts = [];
    const dir = b.clone().sub(a);
    const n = V(-dir.y, dir.x, 0).normalize();
    for (let i = 1; i <= steps; i += 1) {
      const t = i / (steps + 1);
      const p = a.clone().lerp(b, t);
      const wave = Math.sin(t * Math.PI);
      p.addScaledVector(n, bend * wave);
      p.z += zLift * wave + Math.sin(t * Math.PI * 2) * 0.08;
      pts.push(p);
    }
    return pts;
  }

  function makeHairpin({ origin, angle, length, width, pairs, loopBases, zCurl, bulges = [] }) {
    const left = [];
    const right = [];
    const pairRefs = [];
    const bulgeMap = new Map(bulges.map((b) => [`${b.side}:${b.at}`, b]));

    for (let i = 0; i < pairs; i += 1) {
      const t = pairs === 1 ? 0 : i / (pairs - 1);
      const pinch = Math.sin(t * Math.PI) * 0.05;
      const localY = t * length;
      const phase = t * Math.PI * 2.2;
      const leftExtra = bulgeMap.has(`left:${i}`) ? 0.22 : 0;
      const rightExtra = bulgeMap.has(`right:${i}`) ? 0.22 : 0;
      left.push({
        pos: rotatePoint(-width * 0.5 - leftExtra - pinch + Math.sin(phase) * 0.03, localY, angle, origin, Math.sin(t * Math.PI) * zCurl),
        pairable: !leftExtra,
        motif: leftExtra ? "bulge" : "stem"
      });
      right.push({
        pos: rotatePoint(width * 0.5 + rightExtra + pinch + Math.cos(phase) * 0.03, localY, angle, origin, -Math.sin(t * Math.PI) * zCurl * 0.65),
        pairable: !rightExtra,
        motif: rightExtra ? "bulge" : "stem"
      });
    }

    for (let i = 0; i < pairs; i += 1) {
      if (left[i].pairable && right[i].pairable) {
        pairRefs.push([i, left.length + loopBases + (pairs - 1 - i)]);
      }
    }

    const loop = [];
    const loopCenter = rotatePoint(0, length + width * 0.45, angle, origin, zCurl * 0.2);
    const rx = width * 0.74;
    const ry = width * 0.9;
    for (let i = 1; i <= loopBases; i += 1) {
      const t = i / (loopBases + 1);
      const a = Math.PI * (1 - t);
      const wobble = 1 + Math.sin(t * Math.PI * 3) * 0.08;
      loop.push({
        pos: rotatePoint(Math.cos(a) * rx * wobble, length + Math.sin(a) * ry + width * 0.1, angle, origin, zCurl * Math.sin(t * Math.PI)),
        pairable: false,
        motif: "loop"
      });
    }

    return {
      nts: [...left, ...loop, ...right.reverse()],
      pairs: pairRefs,
      start: left[0].pos,
      end: right[0].pos,
      tip: loopCenter
    };
  }

  function addNucleotide(pos, motif = "single", baseOverride = null) {
    const index = nucleotides.length;
    const base = baseOverride || BASES[(index * 7 + motif.length) % BASES.length];
    nucleotides.push({
      rest: pos.clone(),
      current: pos.clone(),
      base,
      motif,
      pair: -1,
      phase: Math.random() * Math.PI * 2
    });
    return index;
  }

  function addMotif(motif, connectBend = 0.28) {
    if (nucleotides.length) {
      const prev = nucleotides[nucleotides.length - 1].rest;
      curveBetween(prev, motif.start, 6, connectBend, 0.1).forEach((p) => addNucleotide(p, "junction"));
    }
    const startIndex = nucleotides.length;
    motif.nts.forEach((nt) => addNucleotide(nt.pos, nt.motif));
    motif.pairs.forEach(([a, b]) => {
      const ia = startIndex + a;
      const ib = startIndex + b;
      nucleotides[ia].pair = ib;
      nucleotides[ib].pair = ia;
      pairSegments.push([ia, ib]);
    });
  }

  const nucleotides = [];
  const pairSegments = [];
  const tertiarySegments = [];

  const tail5 = [
    V(-4.6, -2.55, -0.2),
    V(-4.05, -2.43, -0.12),
    V(-3.52, -2.2, 0.08),
    V(-3.03, -1.92, 0.18),
    V(-2.55, -1.55, 0.05)
  ];
  tail5.forEach((p) => addNucleotide(p, "tail"));
  curveBetween(tail5[tail5.length - 1], V(-1.25, -0.7, 0.08), 8, -0.45, 0.24)
    .forEach((p) => addNucleotide(p, "single"));

  addMotif(makeHairpin({
    origin: V(-1.24, -0.72, 0.06),
    angle: -2.38,
    length: 2.55,
    width: 0.58,
    pairs: 10,
    loopBases: 14,
    zCurl: 0.52,
    bulges: [{ side: "left", at: 3 }, { side: "right", at: 6 }]
  }), -0.18);

  addMotif(makeHairpin({
    origin: V(-0.08, -0.15, 0.18),
    angle: 0.95,
    length: 2.72,
    width: 0.5,
    pairs: 9,
    loopBases: 16,
    zCurl: -0.44,
    bulges: [{ side: "right", at: 2 }, { side: "left", at: 7 }]
  }), 0.38);

  addMotif(makeHairpin({
    origin: V(0.56, -0.35, -0.12),
    angle: -0.15,
    length: 2.22,
    width: 0.47,
    pairs: 7,
    loopBases: 10,
    zCurl: 0.34,
    bulges: [{ side: "left", at: 4 }]
  }), -0.34);

  curveBetween(nucleotides[nucleotides.length - 1].rest, V(3.95, -1.78, -0.16), 12, -0.36, -0.12)
    .forEach((p) => addNucleotide(p, "tail"));
  [V(4.42, -2.05, -0.2), V(4.82, -2.34, -0.12)].forEach((p) => addNucleotide(p, "tail"));

  // Sparse ensemble-supported alternative contacts: secondary to the main stem grammar.
  [[24, 74], [34, 96], [52, 112], [82, 126]].forEach(([a, b]) => {
    if (a < nucleotides.length && b < nucleotides.length) tertiarySegments.push([a, b]);
  });

  const dmsSites = nucleotides
    .map((nt, index) => ({ nt, index }))
    .filter(({ nt, index }) => {
      const exposed = nt.pair < 0 && ["loop", "bulge", "junction", "single"].includes(nt.motif);
      const dmsBase = nt.base === "A" || nt.base === "C";
      return exposed && dmsBase && index % 3 !== 1;
    })
    .map(({ nt, index }) => {
      const motifScore = nt.motif === "bulge" ? 0.98 :
        nt.motif === "loop" ? 0.82 :
        nt.motif === "junction" ? 0.58 : 0.44;
      const sequenceJitter = ((index * 37) % 17) / 100;
      return { index, score: Math.min(1, motifScore + sequenceJitter), phase: nt.phase + index * 0.19 };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 26);

  const nodeCount = nucleotides.length * 3;
  const atomData = [];
  const atomPositions = Array.from({ length: nodeCount }, () => V(0, 0, 0));
  const atomRestPositions = Array.from({ length: nodeCount }, () => V(0, 0, 0));
  const atomBaseScale = new Float32Array(nodeCount);

  nucleotides.forEach((nt, i) => {
    const hue = BASE_COLORS[nt.base];
    const motifBoost = nt.motif === "loop" || nt.motif === "junction" ? 1.12 : 1;
    atomData.push({ nt: i, kind: "phosphate", color: COL.inkDeep.clone(), scale: 0.027 * motifBoost, phase: nt.phase });
    atomData.push({ nt: i, kind: "sugar", color: COL.sugar.clone(), scale: 0.02 * motifBoost, phase: nt.phase + 1.2 });
    atomData.push({ nt: i, kind: "base", color: hue.clone(), scale: 0.03 * motifBoost, phase: nt.phase + 2.4 });
  });
  atomData.forEach((atom, i) => { atomBaseScale[i] = atom.scale; });

  function nucleotideNormal(i) {
    const nt = nucleotides[i];
    if (nt.pair >= 0) {
      return nucleotides[nt.pair].current.clone().sub(nt.current).normalize();
    }
    const prev = nucleotides[Math.max(0, i - 1)].current;
    const next = nucleotides[Math.min(nucleotides.length - 1, i + 1)].current;
    const tangent = next.clone().sub(prev).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, zAxis).normalize();
    if (!Number.isFinite(normal.x)) return V(0, 1, 0);
    const side = i % 2 === 0 ? 1 : -1;
    return normal.multiplyScalar(side);
  }

  function refreshAtomPositions(t) {
    for (let i = 0; i < nucleotides.length; i += 1) {
      const nt = nucleotides[i];
      const normal = nucleotideNormal(i);
      const tangent = nucleotides[Math.min(nucleotides.length - 1, i + 1)].current
        .clone()
        .sub(nucleotides[Math.max(0, i - 1)].current)
        .normalize();
      const zMicro = V(0, 0, Math.sin(t * 1.3 + nt.phase) * 0.015);
      atomPositions[i * 3 + 0].copy(nt.current).addScaledVector(tangent, -0.028).add(zMicro);
      atomPositions[i * 3 + 1].copy(nt.current).addScaledVector(normal, 0.074).add(zMicro);
      atomPositions[i * 3 + 2].copy(nt.current).addScaledVector(normal, nt.pair >= 0 ? 0.18 : 0.135).addScaledVector(tangent, 0.025).add(zMicro);

      atomRestPositions[i * 3 + 0].copy(nt.rest);
      atomRestPositions[i * 3 + 1].copy(nt.rest).addScaledVector(normal, 0.074);
      atomRestPositions[i * 3 + 2].copy(nt.rest).addScaledVector(normal, nt.pair >= 0 ? 0.18 : 0.135);
    }
  }

  const atomGeometry = new THREE.SphereGeometry(1, 10, 8);
  const atomMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.44,
    metalness: 0.0,
    emissive: "#12275f",
    emissiveIntensity: 0.08
  });
  const atoms = new THREE.InstancedMesh(atomGeometry, atomMaterial, nodeCount);
  atoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  atomData.forEach((atom, i) => atoms.setColorAt(i, atom.color));
  if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
  group.add(atoms);

  function makeLineSegments(count, color, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });
    const lines = new THREE.LineSegments(geo, mat);
    group.add(lines);
    return lines;
  }

  const backboneLines = makeLineSegments(nucleotides.length - 1, COL.backbone, 0.58);
  const atomBondLines = makeLineSegments(nucleotides.length * 2, COL.inkSoft, 0.12);
  const pairLines = makeLineSegments(pairSegments.length, COL.pair, 0.38);
  const tertiaryLines = makeLineSegments(tertiarySegments.length, COL.ensemble, 0.14);

  function writeSegment(array, index, a, b) {
    const o = index * 6;
    array[o + 0] = a.x; array[o + 1] = a.y; array[o + 2] = a.z;
    array[o + 3] = b.x; array[o + 4] = b.y; array[o + 5] = b.z;
  }

  const cloudCount = 320;
  const cloudRest = new Float32Array(cloudCount * 3);
  const cloudPositions = new Float32Array(cloudCount * 3);
  const cloudPhase = new Float32Array(cloudCount);

  for (let i = 0; i < cloudCount; i += 1) {
    const anchorIndex = (Math.random() * nucleotides.length) | 0;
    const anchor = nucleotides[anchorIndex].rest;
    const ring = Math.random() * Math.PI * 2;
    const motif = nucleotides[anchorIndex].motif;
    const spread = Math.random() ** 1.6 * (motif === "loop" || motif === "junction" ? 0.54 : 0.34);
    cloudRest[i * 3 + 0] = anchor.x + Math.cos(ring) * spread;
    cloudRest[i * 3 + 1] = anchor.y + Math.sin(ring) * spread;
    cloudRest[i * 3 + 2] = anchor.z + (Math.random() - 0.5) * 0.55;
    cloudPhase[i] = Math.random() * Math.PI * 2;
  }

  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(cloudPositions, 3));
  const cloudMat = new THREE.PointsMaterial({
    color: COL.ink,
    size: 0.02,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    sizeAttenuation: true
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  group.add(cloud);

  const pulseCount = 5;
  const pulseGeo = new THREE.SphereGeometry(1, 14, 10);
  const pulseMat = new THREE.MeshStandardMaterial({
    color: COL.amber,
    roughness: 0.26,
    emissive: COL.amber,
    emissiveIntensity: 0.42,
    transparent: true,
    opacity: 0.62
  });
  const pulses = new THREE.InstancedMesh(pulseGeo, pulseMat, pulseCount);
  pulses.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(pulses);

  const dmsGeo = new THREE.SphereGeometry(1, 12, 8);
  const dmsMat = new THREE.MeshStandardMaterial({
    color: COL.dms,
    roughness: 0.3,
    emissive: COL.dmsSoft,
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.58
  });
  const dmsMarks = new THREE.InstancedMesh(dmsGeo, dmsMat, dmsSites.length);
  dmsMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(dmsMarks);

  scene.add(new THREE.AmbientLight(0xf8f2e7, 1.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1.8, 4.2, 6.5);
  scene.add(key);
  const rim = new THREE.PointLight(0xc4901a, 1.15, 12);
  rim.position.set(-2.4, 1.8, 4.8);
  scene.add(rim);
  const cool = new THREE.PointLight(0x284a72, 0.7, 12);
  cool.position.set(2.8, -1.8, 5.2);
  scene.add(cool);

  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let hover = 0;
  let targetHover = 0;
  const pointerWorld = V(99, 99, 0);

  function updatePointer(e) {
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    targetX = (x - 0.5) * 2;
    targetY = (y - 0.5) * 2;
    pointerWorld.set(targetX * 4.8, -targetY * 3.7, 0);
  }

  stage.addEventListener("pointerenter", (e) => {
    targetHover = 1;
    updatePointer(e);
  }, { passive: true });
  stage.addEventListener("pointermove", updatePointer, { passive: true });
  stage.addEventListener("pointerleave", () => {
    targetHover = 0;
  }, { passive: true });

  function resize() {
    const rect = stage.getBoundingClientRect();
    const w = Math.max(280, Math.floor(rect.width));
    const h = Math.max(280, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  let visible = true;
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  observer.observe(stage);

  const clock = new THREE.Clock();
  let raf = 0;

  function updateMolecule(t) {
    pointerX += (targetX - pointerX) * 0.06;
    pointerY += (targetY - pointerY) * 0.06;
    hover += (targetHover - hover) * 0.075;

    const activePointer = V(pointerX * 4.8, -pointerY * 3.7, 0);

    nucleotides.forEach((nt, i) => {
      const p = nt.rest.clone();
      const wave = Math.sin(t * 0.9 + nt.phase + p.x * 0.65) * 0.035;
      const slow = Math.cos(t * 0.42 + nt.phase * 0.7 + p.y) * 0.025;
      p.x += wave;
      p.y += slow;
      p.z += Math.sin(t * 0.72 + nt.phase + p.x) * 0.055;

      const dx = p.x - activePointer.x;
      const dy = p.y - activePointer.y;
      const d2 = dx * dx + dy * dy;
      const influence = hover * Math.exp(-d2 / 1.35);
      if (influence > 0.001) {
        const d = Math.sqrt(d2) || 1;
        const focusPull = influence * 0.115;
        p.x += (dx / d) * focusPull + (-dy / d) * influence * 0.025;
        p.y += (dy / d) * focusPull + (dx / d) * influence * 0.025;
        p.z += influence * 0.09;
      }
      nt.current.copy(p);
    });

    refreshAtomPositions(t);

    for (let i = 0; i < atomData.length; i += 1) {
      const atom = atomData[i];
      const pos = atomPositions[i];
      const dx = pos.x - activePointer.x;
      const dy = pos.y - activePointer.y;
      const focus = hover * Math.exp(-(dx * dx + dy * dy) / 1.05);
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t * 1.25 + atom.phase) * 0.05;
      const scale = atomBaseScale[i] * breathe * (1 + focus * 0.28);
      tmpScale.setScalar(scale);
      tmpMatrix.compose(pos, tmpQuat, tmpScale);
      atoms.setMatrixAt(i, tmpMatrix);
    }
    atoms.instanceMatrix.needsUpdate = true;

    const bpos = backboneLines.geometry.attributes.position.array;
    for (let i = 0; i < nucleotides.length - 1; i += 1) {
      writeSegment(bpos, i, atomPositions[i * 3], atomPositions[(i + 1) * 3]);
    }
    backboneLines.geometry.attributes.position.needsUpdate = true;

    const bondPos = atomBondLines.geometry.attributes.position.array;
    for (let i = 0; i < nucleotides.length; i += 1) {
      writeSegment(bondPos, i * 2, atomPositions[i * 3], atomPositions[i * 3 + 1]);
      writeSegment(bondPos, i * 2 + 1, atomPositions[i * 3 + 1], atomPositions[i * 3 + 2]);
    }
    atomBondLines.geometry.attributes.position.needsUpdate = true;

    const pairPos = pairLines.geometry.attributes.position.array;
    pairSegments.forEach(([a, b], i) => {
      writeSegment(pairPos, i, atomPositions[a * 3 + 2], atomPositions[b * 3 + 2]);
    });
    pairLines.geometry.attributes.position.needsUpdate = true;
    pairLines.material.opacity = 0.38 + hover * 0.04;

    const tertiaryPos = tertiaryLines.geometry.attributes.position.array;
    tertiarySegments.forEach(([a, b], i) => {
      writeSegment(tertiaryPos, i, atomPositions[a * 3 + 2], atomPositions[b * 3 + 2]);
    });
    tertiaryLines.geometry.attributes.position.needsUpdate = true;
    tertiaryLines.material.opacity = 0.14 + hover * 0.04;

    for (let i = 0; i < cloudCount; i += 1) {
      const o = i * 3;
      const phase = cloudPhase[i];
      cloudPositions[o + 0] = cloudRest[o + 0] + Math.sin(t * 0.33 + phase) * 0.035 + pointerX * hover * 0.012;
      cloudPositions[o + 1] = cloudRest[o + 1] + Math.cos(t * 0.37 + phase) * 0.035 - pointerY * hover * 0.012;
      cloudPositions[o + 2] = cloudRest[o + 2] + Math.sin(t * 0.29 + phase) * 0.025;
    }
    cloudGeo.attributes.position.needsUpdate = true;
    cloudMat.opacity = 0.18 + hover * 0.035;

    for (let i = 0; i < pulseCount; i += 1) {
      const phase = (t * (reduceMotion ? 0.01 : 0.075) + i / pulseCount) % 1;
      const f = phase * (nucleotides.length - 1);
      const a = Math.floor(f);
      const b = Math.min(nucleotides.length - 1, a + 1);
      const local = f - a;
      const p = nucleotides[a].current.clone().lerp(nucleotides[b].current, local);
      const s = 0.034 + Math.sin(phase * Math.PI) * 0.016;
      tmpScale.setScalar(s);
      tmpMatrix.compose(p, tmpQuat, tmpScale);
      pulses.setMatrixAt(i, tmpMatrix);
    }
    pulses.instanceMatrix.needsUpdate = true;

    dmsSites.forEach((site, i) => {
      const nt = nucleotides[site.index];
      const basePos = atomPositions[site.index * 3 + 2];
      const normal = nucleotideNormal(site.index);
      const shimmer = reduceMotion ? 0.35 : (Math.sin(t * 1.7 + site.phase) + 1) * 0.5;
      const dx = basePos.x - activePointer.x;
      const dy = basePos.y - activePointer.y;
      const localFocus = hover * Math.exp(-(dx * dx + dy * dy) / 0.72);
      const offset = 0.052 + site.score * 0.04 + shimmer * 0.012;
      const p = basePos.clone()
        .addScaledVector(normal, offset)
        .add(V(0, 0, 0.018 + site.score * 0.015));
      const s = (0.015 + site.score * 0.022) * (0.86 + shimmer * 0.22 + localFocus * 0.75);
      tmpScale.setScalar(s);
      tmpMatrix.compose(p, tmpQuat, tmpScale);
      dmsMarks.setMatrixAt(i, tmpMatrix);
    });
    dmsMarks.instanceMatrix.needsUpdate = true;
    dmsMat.emissiveIntensity = 0.22 + hover * 0.16;

    group.rotation.y = -0.16 + Math.sin(t * 0.16) * 0.035 + pointerX * hover * 0.025;
    group.rotation.x = -0.08 + Math.cos(t * 0.18) * 0.02 - pointerY * hover * 0.018;
    group.position.x = 0.05 + pointerX * hover * 0.018;
    group.position.y = -0.03 - pointerY * hover * 0.014;
  }

  function animate() {
    raf = requestAnimationFrame(animate);
    if (!visible) return;
    const t = reduceMotion ? 0.001 : clock.getElapsedTime();
    updateMolecule(t);
    renderer.render(scene, camera);
  }
  animate();

  setTimeout(() => {
    const gl = renderer.getContext();
    if (!gl || (gl.isContextLost && gl.isContextLost())) {
      cancelAnimationFrame(raf);
      markFallback("context lost");
    }
  }, 600);
}

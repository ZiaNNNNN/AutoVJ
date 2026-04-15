import * as THREE from 'three';

export class GeometryVisual {
  constructor() {
    this.scene = new THREE.Scene();
    this.shapes = [];
    this.rings = [];
    this.colorOffset = 0;

    // Black background plane
    const bgGeo = new THREE.PlaneGeometry(100, 100);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.z = -20;
    this.scene.add(bg);

    this._createCenterShape();
    this._createRings();
    this._createAmbientLight();
  }

  _createCenterShape() {
    const geo = new THREE.IcosahedronGeometry(0.8, 1);
    const mat = new THREE.MeshPhongMaterial({
      color: 0xff006e,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    this.centerMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.centerMesh);

    // Inner solid
    const innerGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const innerMat = new THREE.MeshPhongMaterial({
      color: 0x8338ec,
      emissive: 0x8338ec,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.6,
    });
    this.innerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.scene.add(this.innerMesh);
  }

  _createRings() {
    for (let i = 0; i < 5; i++) {
      const radius = 1.2 + i * 0.5;
      const geo = new THREE.TorusGeometry(radius, 0.015, 8, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x3a86ff,
        transparent: true,
        opacity: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;
      this.scene.add(mesh);
      this.rings.push(mesh);
    }
  }

  _createAmbientLight() {
    this.scene.add(new THREE.AmbientLight(0x333333));
    const point = new THREE.PointLight(0xffffff, 1.5, 10);
    point.position.set(2, 2, 3);
    this.scene.add(point);
    this.pointLight = point;
  }

  update(analyzer, time) {
    this.colorOffset += 0.003;
    const bass = analyzer.bass;
    const mid = analyzer.mid;
    const treble = analyzer.treble;
    const beat = analyzer.beatIntensity;

    // Center shape pulses with bass
    const scale = 0.8 + bass * 1.5 + beat * 0.5;
    this.centerMesh.scale.setScalar(scale);
    this.centerMesh.rotation.x = time * 0.3 + bass * 0.5;
    this.centerMesh.rotation.y = time * 0.5 + mid * 0.3;

    const hue1 = (this.colorOffset) % 1;
    this.centerMesh.material.color.setHSL(hue1, 0.8, 0.5);

    // Inner shape
    this.innerMesh.scale.setScalar(0.5 + mid * 0.8);
    this.innerMesh.rotation.x = -time * 0.4;
    this.innerMesh.rotation.z = time * 0.3;
    this.innerMesh.material.emissiveIntensity = 0.3 + beat * 0.7;
    const hue2 = (this.colorOffset + 0.3) % 1;
    this.innerMesh.material.color.setHSL(hue2, 0.7, 0.5);
    this.innerMesh.material.emissive.setHSL(hue2, 0.8, 0.4);

    // Rings rotate and scale with different bands
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const speed = 0.2 + i * 0.1;
      ring.rotation.x += speed * 0.01 + bass * 0.02;
      ring.rotation.y += speed * 0.015 + treble * 0.01;

      const ringScale = 1 + mid * 0.3 + (analyzer.isBeat ? beat * 0.2 : 0);
      ring.scale.setScalar(ringScale);

      const hue = (this.colorOffset + i * 0.15) % 1;
      ring.material.color.setHSL(hue, 0.7, 0.5);
      ring.material.opacity = 0.3 + treble * 0.4;
    }

    // Point light follows beat
    this.pointLight.intensity = 1 + beat * 3;
    this.pointLight.color.setHSL(hue1, 0.5, 0.7);
  }

  dispose() {
    this.centerMesh.geometry.dispose();
    this.centerMesh.material.dispose();
    this.innerMesh.geometry.dispose();
    this.innerMesh.material.dispose();
    this.rings.forEach((r) => { r.geometry.dispose(); r.material.dispose(); });
  }
}

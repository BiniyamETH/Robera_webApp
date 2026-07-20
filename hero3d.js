(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // On narrow screens the hero text takes the full width, so the 3D object
  // has nowhere to sit without overlapping and obscuring it — skip it there
  // (also saves GPU/battery on mobile, where it'd be hidden work anyway).
  // Checked on every resize (not just at load) so a window that starts
  // narrow and later widens past the breakpoint still gets the object.
  const BREAKPOINT = 720;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let scene, camera, renderer, level;
  let mouseX = 0, mouseY = 0;
  let scrollY = 0;
  let initialized = false;

  function initScene() {
    if (initialized) return;
    initialized = true;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Without tone mapping, the key light blows the bolt head's flat cap
    // out to solid white instead of a lit steel gray — ACES rolls off
    // highlights instead of hard-clipping them.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene.add(new THREE.HemisphereLight(0xaeb8c9, 0x14171c, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 6, 8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-4, 2, 6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf5a623, 0.6);
    rim.position.set(-6, -2, -4);
    scene.add(rim);

    // Wrench + hex bolt, built from primitives — a shape with an unmistakable
    // silhouette (narrow shaft, wide open-jaw ends) so it can't be mistaken
    // for a row of speaker drivers the way repeated circles were.
    level = new THREE.Group();

    const steelMat = new THREE.MeshStandardMaterial({ color: 0xc7cfd9, metalness: 0.5, roughness: 0.55 });
    const steelDarkMat = new THREE.MeshStandardMaterial({ color: 0x717c8c, metalness: 0.45, roughness: 0.55 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, metalness: 0.4, roughness: 0.45 });

    const wrench = new THREE.Group();

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.32), steelMat);
    wrench.add(shaft);

    [-1, 1].forEach((dir) => {
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.38), steelMat);
      head.position.x = dir * 1.85;
      wrench.add(head);

      // Recessed ring on each head — reads as a ring-spanner socket opening.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 12, 24), steelDarkMat);
      ring.position.set(dir * 1.85, 0, 0.22);
      wrench.add(ring);
    });

    wrench.rotation.z = Math.PI / 12;
    wrench.position.set(-0.1, 0.8, 0);
    level.add(wrench);

    // Hex bolt sitting just below/beside the wrench.
    const bolt = new THREE.Group();
    const boltHead = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.42, 6), steelMat);
    bolt.add(boltHead);
    const boltShank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 20), steelDarkMat);
    boltShank.position.y = -0.7;
    bolt.add(boltShank);
    const boltStripe = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 6), accentMat);
    boltStripe.rotation.x = Math.PI / 2;
    boltStripe.position.y = 0.12;
    bolt.add(boltStripe);

    bolt.rotation.x = Math.PI / 2.4;
    bolt.position.set(1.5, -1.15, 0.5);
    level.add(bolt);

    level.rotation.z = 0.05;
    level.position.x = 3.0;
    scene.add(level);

    if (!reduceMotion) {
      window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      });

      window.addEventListener('scroll', () => { scrollY = window.scrollY; });
    }

    const clock = new THREE.Clock();
    function animate() {
      const t = clock.getElapsedTime();
      level.rotation.y = -0.5 + mouseX * 0.5 + Math.sin(t * 0.25) * 0.08;
      level.rotation.x = 0.15 + mouseY * 0.25;
      level.position.y = -scrollY * 0.0015;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    if (reduceMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
    }
  }

  function handleResize() {
    const wide = window.innerWidth >= BREAKPOINT;

    if (!initialized) {
      if (wide) initScene();
      return;
    }

    canvas.style.display = wide ? '' : 'none';
    if (!wide) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // animate()'s rAF loop keeps repainting on its own when motion isn't
    // reduced, but that loop never starts in the reduceMotion path, so a
    // resize would otherwise leave a stale, stretched frame on screen.
    if (reduceMotion) renderer.render(scene, camera);
  }

  if (window.innerWidth >= BREAKPOINT) {
    initScene();
  } else {
    canvas.style.display = 'none';
  }

  window.addEventListener('resize', handleResize);
})();

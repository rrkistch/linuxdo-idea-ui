/**
 * app.js - 蒙娜丽莎 3D 分层拆解与笔触堆叠解析核心交互逻辑
 */

// 全局应用状态
const AppState = {
    explosion: 0.55,           // 爆炸拉伸度 0.0 - 1.0
    activePreset: "iso",       // 'front', 'iso', 'side', 'free'
    activeLayerId: null,       // 选中的图层 ID
    soloLayerId: null,         // 独奏隔离的图层 ID
    activeHotspotId: null,     // 当前聚焦的热点 ID
    activeSpectralKey: "visible", // 多光谱模式
    isTourRunning: false,      // 导览状态
    tourStep: 0,
    audioEnabled: true
};

// Three.js 核心对象
let scene, camera, renderer, controls;
let layerMeshes = [];
let hotspotElements = [];
let targetCameraPos = null;
let targetLookAt = null;

// 音效系统 (Web Audio API 程序化合成柔和文艺复兴音调)
class SoundFX {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playChime(freq = 440, type = 'sine', duration = 0.4) {
        if (!AppState.audioEnabled) return;
        try {
            this.init();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio error silently ignored
        }
    }
    click() { this.playChime(520, 'sine', 0.15); }
    focus() { this.playChime(660, 'triangle', 0.35); }
    explode() { this.playChime(320, 'sine', 0.25); }
}
const sound = new SoundFX();

// ==================== 初始化与 Three.js 场景构建 ====================
function init() {
    const container = document.getElementById("canvas-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. 创建场景
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090a0f, 0.0008);

    // 2. 创建透视相机
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 4000);
    camera.position.set(220, 120, 320);

    // 3. WebGL 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 4. 控制器 OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 80;
    controls.maxDistance = 800;
    controls.maxPolarAngle = Math.PI / 2 + 0.15; // 允许稍微俯仰，不允许穿入地板
    controls.target.set(0, 0, 0);

    // 5. 博物馆级高级光影
    setupLighting();

    // 6. 加载并构建 8 大物理图层
    buildLayerPlanes();

    // 7. 初始化 3D 热点标记
    setupHotspots();

    // 8. 绑定 UI 事件
    bindUIEvents();

    // 9. 初始化显微横截面切片
    initCrossSectionCanvas();

    // 10. 响应窗口缩放
    window.addEventListener("resize", onWindowResize);

    // 11. 开启渲染循环
    animate();

    // 默认执行平滑切到轴测视角
    applyCameraPreset("iso");
}

function setupLighting() {
    // 整体温润环境光
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.75);
    scene.add(ambientLight);

    // 博物馆正面聚光灯 (画作主照明)
    const mainSpot = new THREE.DirectionalLight(0xfffaed, 1.25);
    mainSpot.position.set(60, 200, 350);
    scene.add(mainSpot);

    // 侧翼轮廓光 (在 3D 炸开时突显各层边缘与厚度)
    const rimLight1 = new THREE.DirectionalLight(0xd4af37, 0.6);
    rimLight1.position.set(-250, 80, -100);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x7090b0, 0.4);
    rimLight2.position.set(250, -50, 100);
    scene.add(rimLight2);
}

// 蒙娜丽莎原画比例 77cm x 53cm => 高度约 204，宽度 140
const PLANE_W = 140;
const PLANE_H = 204;

function buildLayerPlanes() {
    const textureLoader = new THREE.TextureLoader();
    const planeGeo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 1, 1);

    MONA_LISA_DATA.layers.forEach((layerData, idx) => {
        const texture = textureLoader.load(layerData.textureFile, (tex) => {
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            renderer.render(scene, camera);
        });

        // 材质配置：设置透明、双面渲染与针对透明度叠放优化的混合方式
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            opacity: layerData.opacity,
            roughness: 0.45,
            metalness: 0.05,
            side: THREE.DoubleSide,
            depthWrite: idx === 0, // 底层木板写深度，上层透明层不写深度避免半透明遮挡剔除
            alphaTest: 0.01
        });

        const mesh = new THREE.Mesh(planeGeo, material);
        mesh.userData = {
            layerId: layerData.id,
            key: layerData.key,
            baseZ: layerData.zOffset,
            defaultOpacity: layerData.opacity,
            originalZ: 0
        };

        scene.add(mesh);
        layerMeshes.push(mesh);
    });

    // 计算初次爆炸位移
    updateExplosionPositions();
}

function updateExplosionPositions() {
    const factor = AppState.explosion; // 0.0 - 1.0
    layerMeshes.forEach(mesh => {
        // 根据各图层特有的 baseZ 乘以爆炸因子
        const targetZ = mesh.userData.baseZ * factor;
        mesh.position.z = targetZ;
    });
}

// ==================== 3D 热点标记 Hotspots ====================
function setupHotspots() {
    const container = document.getElementById("canvas-container");

    MONA_LISA_DATA.hotspots.forEach(hotspot => {
        const el = document.createElement("div");
        el.className = "three-hotspot";
        el.dataset.id = hotspot.id;
        el.innerHTML = `
            <div class="hotspot-ring"></div>
            <div class="hotspot-core"></div>
            <div class="hotspot-tooltip">${hotspot.name.split("：")[0]}</div>
        `;

        el.addEventListener("click", (e) => {
            e.stopPropagation();
            focusOnHotspot(hotspot.id);
        });

        container.appendChild(el);
        hotspotElements.push({ el, hotspot });
    });
}

function updateHotspotsScreenPositions() {
    if (!camera) return;

    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;

    hotspotElements.forEach(({ el, hotspot }) => {
        // 计算热点在 3D 空间中对应的物理位置
        // 归一化坐标: x (0左 ~ 1右) -> (-PLANE_W/2 ~ PLANE_W/2)
        // y (0上 ~ 1下) -> (PLANE_H/2 ~ -PLANE_H/2)
        const posX = (hotspot.coords.x - 0.5) * PLANE_W;
        const posY = -(hotspot.coords.y - 0.5) * PLANE_H;

        // 根据热点所在图层的当前 Z 轴位移
        const targetMesh = layerMeshes.find(m => m.userData.layerId === hotspot.coords.zLayer);
        const posZ = targetMesh ? targetMesh.position.z + 1.2 : 0;

        const vector = new THREE.Vector3(posX, posY, posZ);

        // 检测热点是否在相机前方 (视锥体检测)
        vector.project(camera);

        const isBehind = vector.z > 1.0;
        const isLayerVisible = targetMesh ? targetMesh.visible && targetMesh.material.opacity > 0.1 : true;

        if (isBehind || !isLayerVisible) {
            el.style.display = "none";
        } else {
            el.style.display = "flex";
            const screenX = (vector.x * widthHalf) + widthHalf;
            const screenY = -(vector.y * heightHalf) + heightHalf;
            el.style.left = `${screenX}px`;
            el.style.top = `${screenY}px`;
        }
    });
}

// 聚焦到具体笔触热点
function focusOnHotspot(hotspotId) {
    const hotspot = MONA_LISA_DATA.hotspots.find(h => h.id === hotspotId);
    if (!hotspot) return;

    sound.focus();
    AppState.activeHotspotId = hotspotId;

    // 高亮底部按钮
    document.querySelectorAll(".hotspot-pill-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.id === hotspotId);
    });

    // 计算三维局部微距相机位
    const posX = (hotspot.coords.x - 0.5) * PLANE_W;
    const posY = -(hotspot.coords.y - 0.5) * PLANE_H;
    const targetMesh = layerMeshes.find(m => m.userData.layerId === hotspot.coords.zLayer);
    const posZ = targetMesh ? targetMesh.position.z : 0;

    targetLookAt = new THREE.Vector3(posX, posY, posZ);
    targetCameraPos = new THREE.Vector3(posX + 15, posY - 5, posZ + 90);

    // 选中对应图层
    selectLayer(hotspot.coords.zLayer, false);

    // 弹出详尽笔触分析卡
    openHotspotModal(hotspot);
}

// ==================== 相机预设切换 (Camera Presets) ====================
function applyCameraPreset(presetKey) {
    sound.click();
    AppState.activePreset = presetKey;

    document.querySelectorAll(".cam-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.preset === presetKey);
    });

    targetLookAt = new THREE.Vector3(0, 0, 0);

    switch (presetKey) {
        case "front":
            targetCameraPos = new THREE.Vector3(0, 0, 290);
            break;
        case "iso":
            targetCameraPos = new THREE.Vector3(180, 110, 260);
            break;
        case "side":
            targetCameraPos = new THREE.Vector3(340, 20, 20);
            break;
        case "macro":
            // 面部特写
            targetLookAt = new THREE.Vector3(0, 45, 0);
            targetCameraPos = new THREE.Vector3(0, 45, 110);
            break;
        default:
            break;
    }
}

// ==================== 图层操作 (Solo, Hide, Opacity) ====================
function selectLayer(layerId, triggerCamera = true) {
    AppState.activeLayerId = layerId;

    // UI 高亮
    document.querySelectorAll(".layer-card").forEach(card => {
        card.classList.toggle("active", parseInt(card.dataset.id) === layerId);
    });

    if (triggerCamera) {
        const mesh = layerMeshes.find(m => m.userData.layerId === layerId);
        if (mesh) {
            targetLookAt = new THREE.Vector3(0, 0, mesh.position.z);
            targetCameraPos = new THREE.Vector3(
                camera.position.x * 0.85,
                camera.position.y * 0.85,
                mesh.position.z + 180
            );
        }
    }
}

function toggleLayerVisibility(layerId, e) {
    if (e) e.stopPropagation();
    const mesh = layerMeshes.find(m => m.userData.layerId === layerId);
    const card = document.querySelector(`.layer-card[data-id="${layerId}"]`);
    if (!mesh || !card) return;

    mesh.visible = !mesh.visible;
    card.classList.toggle("hidden-layer", !mesh.visible);

    const eyeIcon = card.querySelector(".eye-icon");
    if (eyeIcon) {
        eyeIcon.textContent = mesh.visible ? "👁️" : "🚫";
    }
    sound.click();
}

function toggleLayerSolo(layerId, e) {
    if (e) e.stopPropagation();
    sound.click();

    if (AppState.soloLayerId === layerId) {
        // 取消独奏，恢复全部
        AppState.soloLayerId = null;
        layerMeshes.forEach(m => {
            m.visible = true;
            const card = document.querySelector(`.layer-card[data-id="${m.userData.layerId}"]`);
            if (card) {
                card.classList.remove("hidden-layer");
                const soloBtn = card.querySelector(".solo-btn");
                if (soloBtn) soloBtn.classList.remove("active-solo");
            }
        });
    } else {
        // 激活独奏
        AppState.soloLayerId = layerId;
        layerMeshes.forEach(m => {
            const isSolo = m.userData.layerId === layerId;
            m.visible = isSolo;
            const card = document.querySelector(`.layer-card[data-id="${m.userData.layerId}"]`);
            if (card) {
                card.classList.toggle("hidden-layer", !isSolo);
                const soloBtn = card.querySelector(".solo-btn");
                if (soloBtn) soloBtn.classList.toggle("active-solo", isSolo);
            }
        });
        selectLayer(layerId);
    }
}

function setLayerOpacity(layerId, value) {
    const mesh = layerMeshes.find(m => m.userData.layerId === layerId);
    if (mesh) {
        mesh.material.opacity = parseFloat(value);
    }
}

// ==================== 多光谱模式切换 (Multispectral Lab) ====================
function setMultispectralMode(modeKey) {
    sound.click();
    AppState.activeSpectralKey = modeKey;

    document.querySelectorAll(".spectral-card").forEach(card => {
        card.classList.toggle("active", card.dataset.key === modeKey);
    });

    const mode = MONA_LISA_DATA.multispectralModes.find(m => m.key === modeKey);
    if (!mode) return;

    // 动态将模式贴图应用到顶层或相应图层
    const topVarnishMesh = layerMeshes[layerMeshes.length - 1];
    const textureLoader = new THREE.TextureLoader();

    textureLoader.load(mode.textureFile, (newTex) => {
        newTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (modeKey === "visible") {
            // 恢复各图层原有贴图
            resetAllLayerMaterials();
        } else {
            // 在多光谱模式下，将最顶层换为该光谱图，并临时让下层半透明淡化以凸显科学分析
            topVarnishMesh.material.map = newTex;
            topVarnishMesh.material.opacity = 1.0;
            topVarnishMesh.material.needsUpdate = true;
            layerMeshes.forEach(m => {
                if (m !== topVarnishMesh) {
                    m.material.opacity = 0.2;
                }
            });
        }
    });
}

function resetAllLayerMaterials() {
    const textureLoader = new THREE.TextureLoader();
    layerMeshes.forEach((mesh, idx) => {
        const layerData = MONA_LISA_DATA.layers[idx];
        textureLoader.load(layerData.textureFile, (tex) => {
            mesh.material.map = tex;
            mesh.material.opacity = layerData.opacity;
            mesh.material.needsUpdate = true;
        });
    });
}

// ==================== 显微横切面切片画布 (Microscopic Cross-Section) ====================
function initCrossSectionCanvas() {
    const canvas = document.getElementById("cross-section-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const coreLayers = MONA_LISA_DATA.crossSection.coreLayers;

    function renderSection() {
        const w = canvas.width = canvas.clientWidth * window.devicePixelRatio;
        const h = canvas.height = canvas.clientHeight * window.devicePixelRatio;

        ctx.clearRect(0, 0, w, h);

        let currentX = 0;
        // 计算纯颜料层总比例
        const totalSimulatedWidth = 320; // 模拟总宽度

        coreLayers.forEach((layer, i) => {
            let layerWidth = (layer.thickness / totalSimulatedWidth) * w;
            if (i === coreLayers.length - 1) {
                // 木板层占右侧剩余全部
                layerWidth = w - currentX;
            }

            // 绘制层基底颜色
            ctx.fillStyle = layer.color;
            ctx.fillRect(currentX, 0, layerWidth, h);

            // 绘制微观颗粒与纹理
            drawMicroParticles(ctx, currentX, layerWidth, h, i);

            // 绘制层间物理交界面微裂缝与起伏线
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(currentX, 0);
            ctx.lineTo(currentX, h);
            ctx.stroke();

            currentX += layerWidth;
        });
    }

    function drawMicroParticles(ctx, x, width, height, layerIndex) {
        ctx.save();
        // 根据层级绘制不同颗粒
        if (layerIndex === 0) {
            // 清漆龟裂纹
            ctx.strokeStyle = "rgba(40, 25, 10, 0.5)";
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(x + (width * i) / 4, 0);
                ctx.lineTo(x + (width * i) / 4 + 4, height);
                ctx.stroke();
            }
        } else if (layerIndex === 2) {
            // Sfumato 纳米骨黑粉末
            ctx.fillStyle = "rgba(20, 15, 10, 0.6)";
            for (let i = 0; i < 40; i++) {
                ctx.fillRect(x + Math.random() * width, Math.random() * height, 1.5, 1.5);
            }
        } else if (layerIndex === 3) {
            // 固有色天然青金石结晶
            ctx.fillStyle = "rgba(40, 120, 220, 0.8)";
            for (let i = 0; i < 20; i++) {
                ctx.fillRect(x + Math.random() * width, Math.random() * height, 2.5, 2.5);
            }
        } else if (layerIndex === 6) {
            // 石膏结晶晶体
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            for (let i = 0; i < 60; i++) {
                ctx.fillRect(x + Math.random() * width, Math.random() * height, 1.2, 1.2);
            }
        }
        ctx.restore();
    }

    renderSection();

    // 显微横切面鼠标划过联动
    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const ratio = mouseX / rect.width;

        const reticle = document.querySelector(".microscope-reticle");
        if (reticle) reticle.style.left = `${mouseX}px`;

        // 根据比例计算当前命中的切片层
        let accum = 0;
        const totalSim = 320;
        let matched = coreLayers[0];

        for (let i = 0; i < coreLayers.length; i++) {
            const l = coreLayers[i];
            const span = (i === coreLayers.length - 1) ? (totalSim - accum) : l.thickness;
            accum += span;
            if (ratio <= accum / totalSim) {
                matched = l;
                break;
            }
        }

        const nameEl = document.querySelector(".micro-layer-name");
        const descEl = document.querySelector(".micro-layer-desc");
        if (nameEl && descEl) {
            nameEl.textContent = `${matched.name} [${matched.depthRange}]`;
            descEl.textContent = `颗粒特征：${matched.particleType} | 媒介：${matched.medium}`;
        }
    });
}

// ==================== 笔触细节 Modal 弹窗 ====================
function openHotspotModal(hotspot) {
    const overlay = document.getElementById("hotspot-modal-overlay");
    if (!overlay) return;

    document.getElementById("modal-title").textContent = hotspot.name;
    document.getElementById("modal-subtitle").textContent = `${hotspot.subtitle} · 深度位置：${hotspot.region}`;
    document.getElementById("modal-quote").textContent = hotspot.daVinciManuscript;
    document.getElementById("modal-analysis-content").innerHTML = hotspot.analysis.replace(/\n\n/g, '<p></p>');

    const metricsBox = document.getElementById("modal-metrics-box");
    metricsBox.innerHTML = hotspot.keyMetrics.map(m => `
        <div class="metric-card">
            <span class="metric-label">${m.label}</span>
            <span class="metric-value">${m.value}</span>
        </div>
    `).join("");

    overlay.classList.add("open");
}

function closeHotspotModal() {
    const overlay = document.getElementById("hotspot-modal-overlay");
    if (overlay) overlay.classList.remove("open");
    sound.click();
}

// ==================== 达芬奇创作工序全景导览 (Guided Tour) ====================
const TOUR_STEPS = [
    {
        title: "第 1 步：白杨木料精选与石膏镜面打底",
        desc: "达·芬奇挑选整块无节托斯卡纳白杨木，双层涂覆熟石膏并反复水磨，打造出象牙般绝无瑕疵的反光基底。",
        layerId: 1,
        cameraPreset: "side",
        explosion: 0.8
    },
    {
        title: "第 2 步：Spolvero 针孔粉扑起稿与修改痕迹",
        desc: "将草图沿轮廓扎孔，以炭粉包轻轻扑打留下点阵，再以极细笔墨连接。在此层红外线发现了被抹去的珍珠发簪（Pentimenti）。",
        layerId: 3,
        cameraPreset: "front",
        explosion: 0.6
    },
    {
        title: "第 3 步：赭褐单色明暗雕塑 (Chiaroscuro)",
        desc: "在上色之前，达·芬奇先以熟赭与单色油脂薄涂建立面部骨骼、眼窝与鼻梁的立体光影，如同用单色雕刻永恒形体。",
        layerId: 4,
        cameraPreset: "iso",
        explosion: 0.5
    },
    {
        title: "第 4 步：空气透视风景与深橄榄长袍固有色",
        desc: "远山融入高空漫射的青金石碧蓝之中，近景桥梁为温润暖色；两侧地平线刻意设计为左低右高，赋予静态画面以呼吸动势。",
        layerId: 5,
        cameraPreset: "front",
        explosion: 0.4
    },
    {
        title: "第 5 步：30 层微米级渐隐晕涂 (Sfumato)",
        desc: "长达十余年的精妙罩染！每层油彩仅 1~2 微米厚，面部没有任何一条生硬边界，创造出若隐若现的永恒神秘微笑。",
        layerId: 6,
        cameraPreset: "macro",
        explosion: 0.2
    },
    {
        title: "第 6 步：微观高光织物笔触与岁月清漆沉淀",
        desc: "透明头纱轻抚发际，金色刺绣纤毫毕现；500 年岁月让表层树脂化为琥珀金泽，交织出天然网状龟裂纹指纹。",
        layerId: 8,
        cameraPreset: "iso",
        explosion: 0.7
    }
];

function startGuidedTour() {
    sound.focus();
    AppState.isTourRunning = true;
    AppState.tourStep = 0;
    showTourStep(0);
}

function showTourStep(index) {
    if (index < 0 || index >= TOUR_STEPS.length) {
        endGuidedTour();
        return;
    }
    AppState.tourStep = index;
    const step = TOUR_STEPS[index];

    // 更新 HUD
    const hud = document.getElementById("tour-hud-box");
    if (hud) {
        hud.classList.add("active");
        document.getElementById("tour-step-badge").textContent = `工序阶段 ${index + 1} / ${TOUR_STEPS.length}`;
        document.getElementById("tour-hud-title").textContent = step.title;
        document.getElementById("tour-hud-desc").textContent = step.desc;
    }

    // 动态调整爆炸与视角
    AppState.explosion = step.explosion;
    document.getElementById("explosion-slider").value = step.explosion * 100;
    document.getElementById("explosion-val").textContent = `${Math.round(step.explosion * 100)}%`;
    updateExplosionPositions();

    selectLayer(step.layerId, false);
    applyCameraPreset(step.cameraPreset);
}

function nextTourStep() {
    if (AppState.tourStep + 1 < TOUR_STEPS.length) {
        showTourStep(AppState.tourStep + 1);
    } else {
        endGuidedTour();
    }
}

function prevTourStep() {
    if (AppState.tourStep > 0) {
        showTourStep(AppState.tourStep - 1);
    }
}

function endGuidedTour() {
    AppState.isTourRunning = false;
    const hud = document.getElementById("tour-hud-box");
    if (hud) hud.classList.remove("active");
    applyCameraPreset("iso");
}

// ==================== 绑定 DOM UI 事件 ====================
function bindUIEvents() {
    // 1. 爆炸滑块
    const expSlider = document.getElementById("explosion-slider");
    const expVal = document.getElementById("explosion-val");
    if (expSlider) {
        expSlider.addEventListener("input", (e) => {
            AppState.explosion = parseFloat(e.target.value) / 100;
            if (expVal) expVal.textContent = `${Math.round(AppState.explosion * 100)}%`;
            updateExplosionPositions();
        });
    }

    // 爆炸快捷按钮
    document.querySelectorAll(".quick-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const pct = parseInt(btn.dataset.pct);
            AppState.explosion = pct / 100;
            if (expSlider) expSlider.value = pct;
            if (expVal) expVal.textContent = `${pct}%`;
            updateExplosionPositions();
            sound.explode();
        });
    });

    // 2. 渲染图层列表
    const layersListEl = document.getElementById("layers-list-container");
    if (layersListEl) {
        layersListEl.innerHTML = MONA_LISA_DATA.layers.map(layer => `
            <div class="layer-card" data-id="${layer.id}">
                <div class="layer-main-row">
                    <div class="layer-info-left">
                        <div class="layer-index">${layer.id}</div>
                        <div class="layer-names">
                            <span class="layer-name-cn">${layer.name}</span>
                            <span class="layer-subname">${layer.subname.split(" ")[0]}</span>
                        </div>
                    </div>
                    <div class="layer-meta-right">
                        <span class="thickness-pill">${layer.thickness.split(" ")[0]}</span>
                        <button class="layer-action-btn solo-btn" title="单层隔离观察">◎</button>
                        <button class="layer-action-btn eye-btn" title="显示/隐藏"><span class="eye-icon">👁️</span></button>
                    </div>
                </div>
                <div class="layer-controls-row">
                    <div class="layer-slider-box">
                        <span>透明度</span>
                        <input type="range" class="custom-range opacity-slider" min="0" max="1" step="0.05" value="${layer.opacity}">
                    </div>
                </div>
            </div>
        `).join("");

        // 图层卡片交互
        layersListEl.querySelectorAll(".layer-card").forEach(card => {
            const id = parseInt(card.dataset.id);
            card.addEventListener("click", () => selectLayer(id));

            card.querySelector(".eye-btn").addEventListener("click", (e) => toggleLayerVisibility(id, e));
            card.querySelector(".solo-btn").addEventListener("click", (e) => toggleLayerSolo(id, e));

            const opSlider = card.querySelector(".opacity-slider");
            if (opSlider) {
                opSlider.addEventListener("input", (e) => {
                    e.stopPropagation();
                    setLayerOpacity(id, e.target.value);
                });
            }
        });
    }

    // 3. 多光谱模式卡片
    const spectralContainer = document.getElementById("spectral-grid-container");
    if (spectralContainer) {
        spectralContainer.innerHTML = MONA_LISA_DATA.multispectralModes.map(mode => `
            <div class="spectral-card ${mode.key === 'visible' ? 'active' : ''}" data-key="${mode.key}">
                <div class="spectral-title-group">
                    <div class="spectral-dot" style="color: ${mode.hudColor}; background: ${mode.hudColor}"></div>
                    <div class="spectral-texts">
                        <span class="spectral-name">${mode.name}</span>
                        <span class="spectral-sub">${mode.subname.split("(")[0]}</span>
                    </div>
                </div>
            </div>
        `).join("");

        spectralContainer.querySelectorAll(".spectral-card").forEach(card => {
            card.addEventListener("click", () => setMultispectralMode(card.dataset.key));
        });
    }

    // 4. 相机视角预设按钮
    document.querySelectorAll(".cam-btn").forEach(btn => {
        btn.addEventListener("click", () => applyCameraPreset(btn.dataset.preset));
    });

    // 5. 底部笔触热点胶囊按钮
    const hotspotsBar = document.getElementById("hotspots-pill-container");
    if (hotspotsBar) {
        hotspotsBar.innerHTML = MONA_LISA_DATA.hotspots.map(h => `
            <button class="hotspot-pill-btn" data-id="${h.id}">
                <span class="hotspot-icon">✦</span>
                <span>${h.name.split("：")[0]}</span>
            </button>
        `).join("");

        hotspotsBar.querySelectorAll(".hotspot-pill-btn").forEach(btn => {
            btn.addEventListener("click", () => focusOnHotspot(btn.dataset.id));
        });
    }

    // 6. 弹窗关闭
    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", closeHotspotModal);
    const modalOverlay = document.getElementById("hotspot-modal-overlay");
    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) closeHotspotModal();
        });
    }

    // 7. 导览按钮
    const startTourBtn = document.getElementById("start-tour-btn");
    if (startTourBtn) startTourBtn.addEventListener("click", startGuidedTour);
    const tourNext = document.getElementById("tour-next-btn");
    if (tourNext) tourNext.addEventListener("click", nextTourStep);
    const tourPrev = document.getElementById("tour-prev-btn");
    if (tourPrev) tourPrev.addEventListener("click", prevTourStep);
    const tourClose = document.getElementById("tour-close-btn");
    if (tourClose) tourClose.addEventListener("click", endGuidedTour);

    // 8. 重置视角与全屏
    const resetCamBtn = document.getElementById("reset-cam-btn");
    if (resetCamBtn) resetCamBtn.addEventListener("click", () => applyCameraPreset("iso"));

    const fullscreenBtn = document.getElementById("fullscreen-btn");
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });
    }
}

// ==================== 动画与平滑过渡循环 ====================
function animate() {
    requestAnimationFrame(animate);

    // 平滑插值相机位置与目标点 (Lerp Camera Transition)
    if (targetCameraPos) {
        camera.position.lerp(targetCameraPos, 0.07);
        if (camera.position.distanceTo(targetCameraPos) < 0.5) {
            targetCameraPos = null;
        }
    }
    if (targetLookAt) {
        controls.target.lerp(targetLookAt, 0.07);
        if (controls.target.distanceTo(targetLookAt) < 0.2) {
            targetLookAt = null;
        }
    }

    controls.update();

    // 更新 3D 热点在屏幕上的投影坐标
    updateHotspotsScreenPositions();

    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById("canvas-container");
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// 页面加载完成后启动
window.addEventListener("DOMContentLoaded", init);

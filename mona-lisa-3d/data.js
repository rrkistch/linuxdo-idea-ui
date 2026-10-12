/**
 * data.js - 蒙娜丽莎 3D 分层拆解、笔触堆叠与艺术科学检测核心数据库
 * 数据依据：巴黎卢浮宫研究与修复中心 (C2RMF) 科学检测报告与达·芬奇手稿文献
 */

const MONA_LISA_DATA = {
    info: {
        title: "《蒙娜丽莎》(La Gioconda / Mona Lisa)",
        artist: "列奥纳多·达·芬奇 (Leonardo da Vinci, 1452–1519)",
        creationPeriod: "约 1503 年 – 1517 年（达·芬奇随身携带修改直至逝世）",
        medium: "白杨木板油彩 (Oil on Poplar Wood Panel)",
        dimensions: "77 cm × 53 cm × 13 mm",
        location: "法国巴黎卢浮宫博物馆 (Musée du Louvre, Paris)",
        conservationLab: "法国博物馆研究与修复中心 (C2RMF) 物理/化学多光谱分析"
    },

    // 8大物理与技法工程图层
    layers: [
        {
            id: 1,
            key: "wood",
            name: "白杨木板基底",
            subname: "Poplar Wood Support (Supporto di Pioppo)",
            date: "c. 1503 初",
            thickness: "13,000 μm (13 mm)",
            textureFile: "assets/layer_01_wood.jpg",
            opacity: 1.0,
            zOffset: -280,
            pigmentFormula: "纯天然托斯卡纳白杨木 (Populus alba)、无纺布亚麻绷带加固、动物骨胶防裂涂层",
            technique: "整块单块白杨木径切板（Radial Cut）。达·芬奇严苛挑选无树瘤木料，并用热亚麻籽油与骨胶浸润木板背部以减缓吸湿膨胀。顶部有一条长约 12 cm 的天然应力纵向干裂，现代保护使用蝴蝶榫（Butterfly Cleats / Dovetails）与横向橡木框架稳固。",
            scientificNotes: "X射线断层扫描（CT）显示木板内部存在轻度弧形形变（Warping），年轮密度显示该树砍伐于 15 世纪末期，含水率长期稳定在 11% 左右。",
            highlights: ["单块天然白杨木板", "背部蝴蝶榫修复构件", "顶部天然干裂纹理", "热骨胶防潮封底"]
        },
        {
            id: 2,
            key: "gesso",
            name: "石膏胶质底基",
            subname: "Gesso Primer Ground (Preparazione a Gesso)",
            date: "c. 1503",
            thickness: "110 – 140 μm",
            textureFile: "assets/layer_02_gesso.png",
            opacity: 0.96,
            zOffset: -200,
            pigmentFormula: "粗底粗石膏 (Gesso Grosso) + 细底软石膏 (Gesso Sottile) + 兔皮胶 (Rabbit-skin Glue)",
            technique: "两道不同细度的熟石膏涂覆工艺。达·芬奇先刮涂粗石膏填充木纹孔隙，再涂抹 4~6 层极细腻的细石膏，彻底阴干后用水磨石与马尾草反复研磨打磨，直至呈现象牙般无瑕、反光均匀的温润纯白镜面，为后续罩染提供绝佳光线内反射基底。",
            scientificNotes: "拉曼光谱分析检测出高纯度二水硫酸钙（CaSO4·2H2O）结晶及动物明胶蛋白胶结物，底基极平整，微观起伏低于 3 微米。",
            highlights: ["水磨镜面纯白基底", "兔皮胶渗透粘接", "双层高纯度硫酸钙", "内反射光学增强层"]
        },
        {
            id: 3,
            key: "underdrawing",
            name: "透印针孔与木炭底稿",
            subname: "Spolvero & Charcoal Underdrawing",
            date: "c. 1503 – 1504",
            thickness: "5 – 10 μm",
            textureFile: "assets/layer_03_underdrawing.png",
            opacity: 0.90,
            zOffset: -120,
            pigmentFormula: "葡萄藤煅烧木炭粉 (Vine Charcoal)、骨黑粉末、天然墨水及水性固定液",
            technique: "针孔透印转印法（Spolvero）：达·芬奇先在草图纸（Cartone）上精细起稿，沿轮廓线密密扎出微孔，盖在石膏底上后用木炭粉包轻轻扑打，留下微小炭粉点阵；随后用细狼毫笔蘸稀薄墨汁将点连成精确轮廓线。此层留存了珍贵的手指姿态与发簪修改隐痕（Pentimenti）。",
            scientificNotes: "2020年法国科学家帕斯卡·科特（Pascal Cotte）利用多光谱层析相机，在额头发际线及手部首次确凿拍到了微型针孔透印黑点，证实了达·芬奇的转印起草工艺。",
            highlights: ["Spolvero 针孔粉扑点阵", "细笔墨线解剖骨骼起稿", "发簪与头纱位置修改痕迹", "红外反射清晰可辨"]
        },
        {
            id: 4,
            key: "grisaille",
            name: "赭褐单色明暗塑形层",
            subname: "Imprimatura & Grisaille Chiaroscuro",
            date: "c. 1504",
            thickness: "15 – 25 μm",
            textureFile: "assets/layer_04_grisaille.jpg",
            opacity: 0.88,
            zOffset: -40,
            pigmentFormula: "煅烧生赭 (Raw Sienna)、天然生褐 (Raw Umber)、少许铅白 (Lead White) 与浓缩核桃油",
            technique: "单色明暗对照雕塑（Chiaroscuro）。达·芬奇在色彩上阵前，先以单色油脂薄涂建立起强烈的立体积感。如同用光线雕刻面部：鼻梁、眼窝深处、面颊弧度、颈部胸口及远景山石的凹凸起伏，皆在此阶段确立了永恒的光影骨骼。",
            scientificNotes: "通过近红外与太赫兹扫描，此层含铁氧化物极高，单色层次极其细腻，从完全透明的淡褐到深重的焦茶色，跨越了 16 级连续灰度阶调。",
            highlights: ["三维光影骨架确立", "眼窝与鼻梁凹凸雕塑", "纯单色调明暗对照法", "为后续透明色彩提供明度依托"]
        },
        {
            id: 5,
            key: "colors",
            name: "局部固有色与大气透视",
            subname: "Local Colors & Atmospheric Landscape",
            date: "c. 1504 – 1506",
            thickness: "20 – 35 μm",
            textureFile: "assets/layer_05_colors.jpg",
            opacity: 0.85,
            zOffset: 40,
            pigmentFormula: "阿富汗天然青金石 (Lapis Lazuli / Ultramarine)、碱式碳酸铜 (铜绿 Verdigris)、绿土 (Terre Verte)、黄赭石、天然铅锡黄",
            technique: "首创“空气/大气透视法”（Atmospheric Perspective）。达·芬奇洞察到空气中的微粒与水汽会吸收长波红光、散射短波蓝光，因此近景道路桥梁偏暖色土黄，而远方阿尔卑斯冰川峭壁与高山湖泊则逐渐融于青冷空灵的青金石碧蓝之中；长袍使用了华贵的深橄榄绿与天鹅绒厚涂层。",
            scientificNotes: "显微颗粒分析显示远景山体含有昂贵的高纯度青金石晶体，与结晶铜绿树脂酸铜混合，创造出流动而虚幻的自然界原生韵律。",
            highlights: ["空气透视法（近暖远冷）", "天然阿富汗青金石颜料", "深橄榄绿丝绒褶皱固有色", "两旁不对称地平线虚景"]
        },
        {
            id: 6,
            key: "sfumato",
            name: "微米级渐隐晕涂罩染层",
            subname: "20-30 Sfumato Glazes (Micro-Glazing)",
            date: "c. 1506 – 1515",
            thickness: "30 – 45 μm (每层仅 1~2 μm)",
            textureFile: "assets/layer_06_sfumato.png",
            opacity: 0.92,
            zOffset: 120,
            pigmentFormula: "超微粒骨黑 (Bone Black)、煅赭石纳米级粉末、特制脱水清澈核桃油 (Walnut Oil) 与微量薰衣草精油",
            technique: "达·芬奇登峰造极的绝技——微米晕涂法（Sfumato，“如烟消散”）。达·芬奇不用普通画笔涂抹，而是用极稀、含颜料量低于 1% 的透明核桃油层，涂覆了 20 到 30 层！每层厚度仅 1~2 微米（相当于头发丝直径的五十分之一），每一层必须干燥数月才涂下一层。面部、嘴角没有任何笔触痕迹（Senza Traccia di Pennello），如烟雾蒸腾在空气中。",
            scientificNotes: "欧洲同步辐射装置（ESRF）利用 X 射线荧光高光谱测定，在蒙娜丽莎眼角与嘴角周围，达·芬奇施加了多达 30 道厚度不到 2 微米的极薄罩染层，证实了长达十余年的精雕细琢。",
            highlights: ["20-30 层极薄微米罩染", "单层厚度仅 1~2 μm", "毫无可见刷痕与生硬边缘", "创造举世闻名的神秘微笑视错觉"]
        },
        {
            id: 7,
            key: "details",
            name: "微观笔触与高光提亮",
            subname: "Micro-Details, Veil & Specular Highlights",
            date: "c. 1510 – 1517",
            thickness: "5 – 12 μm",
            textureFile: "assets/layer_07_details.png",
            opacity: 0.95,
            zOffset: 200,
            pigmentFormula: "荷兰精炼铅白 (Lead White)、天然群青极细提亮、天然土红、生赭金粉",
            technique: "精绝纤巧的微观细节堆叠：透明轻纱（Guarnello）以最细的丝状油彩笔触罩在卷曲的发丝上；胸前领口点缀了极为繁复的达·芬奇式金色几何莫比乌斯结绳刺绣（Ricamo a nodi）；双眸边缘轻点反光晶点，下眼睑泪阜微光水润；唇间裂线微量茜草红的温润提亮。",
            scientificNotes: "放大 100 倍显微摄影显示，衣领金线宽仅 0.15 毫米，笔触流畅一气呵成；眼球高光由微粒铅白点染，产生随光线漫射而动人的通透眼神光。",
            highlights: ["透明丝织头纱微观纤维", "衣领金色结绳几何刺绣", "眼睑泪阜水润反光晶点", "发丝卷曲的微妙高光笔触"]
        },
        {
            id: 8,
            key: "varnish",
            name: "老化树脂清漆与龟裂网",
            subname: "Aged Resin Varnish & Craquelure Network",
            date: "1517 封层 – 至今（500余年时光沉淀）",
            thickness: "25 – 40 μm",
            textureFile: "assets/layer_08_varnish.png",
            opacity: 0.85,
            zOffset: 280,
            pigmentFormula: "乳香天然树脂 (Mastic)、琥珀树脂 (Sandarac)、精炼松节油与数百年来多次历史罩光漆复合层",
            technique: "清漆本为无色透明保护层，但历经五个世纪的紫外线照射、木材收缩应力与氧化作用，树脂自然黄化为琥珀金/橄榄褐色调，赋予整幅画作独特的文艺复兴古雅黄昏光泽；受白杨木板收缩挤压与树脂脆化影响，形成了遍布全画的微观“网状龟裂纹”（Craquelure）。",
            scientificNotes: "红外光谱测定表层存在多次早期维护时添加的达玛树脂与虫胶清漆层，微观龟裂纹间距约为 0.4~1.2 mm，已达稳定热力学平衡状态，成为鉴别真伪的核心物理指纹。",
            highlights: ["数百年自然黄化的琥珀色调", "独特的微观网状龟裂纹网", "白杨木热胀冷缩物理指纹", "保护底层颜料免遭外界氧化"]
        }
    ],

    // 重点部位笔触与微观堆叠深度解析热点 (Hotspots)
    hotspots: [
        {
            id: "smile",
            name: "神秘微笑：口轮匝肌晕涂与动态视错觉",
            subtitle: "30层微米级无边界渐隐阴影的视错觉奇迹",
            coords: { x: 0.525, y: 0.334, zLayer: 6 },
            region: "面部唇部 (Mouth & Orbicularis Oris)",
            depthLayers: "Layer 03 (起稿) → Layer 04 (单色明暗) → Layer 06 (30层晕涂罩染)",
            strokeThickness: "38 μm 累计堆叠（单层 1.4 μm）",
            opticalPrinciple: "视网膜空间频率响应原理 (Spatial Frequency Perception)",
            analysis: `
                达·芬奇在创作蒙娜丽莎的嘴唇时，深度结合了他在佛罗伦萨圣玛丽亚诺瓦医院解剖尸体时对人类口部肌肉的精深研究。

                【运笔与堆叠细节】：
                1. 嘴角两侧（提口角肌与降口角肌交汇处）完全**没有使用任何一条明确的轮廓线条**。
                2. 达·芬奇先在底层以极淡的熟赭石勾出柔和骨架，随后使用了含有极低浓度骨黑与焦赭的清澈核桃油，连续罩染了近 30 道超薄透明油层。
                3. 每一层的笔意顺着笑肌收缩的肌理方向轻轻抚扫，笔触相互交融，消融在皮肤固有色中。

                【视错觉科学奥秘】：
                哈佛大学神经生物学家玛格丽特·利文斯通（Margaret Livingstone）研究发现：人类视网膜中心凹（Fovea）负责高清晰度高空间频率（直视），而周边视网膜负责捕捉低空间频率（漫视）。
                • 当你的视线**注视她的眼睛**时：余光感受到嘴角周边大片柔和晕染的低频暗部，大脑将其解读为向上扬起的生动笑容；
                • 当你转过目光**直视她的嘴唇**时：高清晰度视线过滤掉了漫射的柔光阴影，微笑仿佛悄然敛去。这正是“若有若无、捉摸不透”微笑的科学根源！
            `,
            daVinciManuscript: "“绘制肖像时，当置于昏暗的庭院中，光线从高处落下，使面庞的阴影柔和消散，宛如烟气化入空中……” —— 达·芬奇手稿《绘画论》",
            keyMetrics: [
                { label: "微米罩染层数", value: "30 层" },
                { label: "单层平均厚度", value: "1.2 - 1.8 μm" },
                { label: "轮廓线锐度", value: "0% (完全羽化)" },
                { label: "视错觉敏感度", value: "极高 (周边视网膜频响)" }
            ]
        },
        {
            id: "eyes",
            name: "无眉明眸：水光泪阜与消失的眉睫笔触",
            subtitle: "微量白色高光与五百年清洗褪色的微观史实",
            coords: { x: 0.510, y: 0.255, zLayer: 7 },
            region: "双眸与眼眶 (Ocular Anatomy)",
            depthLayers: "Layer 03 (底稿) → Layer 05 (瞳孔固有色) → Layer 07 (高光水汽)",
            strokeThickness: "8 μm 微观高光点",
            opticalPrinciple: "角膜高光漫反射与镜面反射叠加",
            analysis: `
                【为什么蒙娜丽莎没有眉毛？】：
                长久以来人们认为佛罗伦萨文艺复兴时期的贵妇以剃眉为风尚。然而 2007 年法国工程师帕斯卡·科特使用多光谱 2.4 亿像素高精度扫描，在左眼眶上方发现了**一根极其纤细的孤立笔触纤维**！
                达·芬奇在初成画作时，曾用最细微的色粉调和胶质画出了精妙的眉毛与睫毛。但由于这些微量笔触画在油画表层且无厚重光漆庇护，在 16~18 世纪多次皇家藏品粗暴清洁（如使用强碱或腐蚀性松节油擦洗）过程中，被逐渐剥离抹去。

                【眼睑与泪阜的运笔】：
                达·芬奇以最精细的笔尖在内眼角泪阜处点出了一个微小的铅白与浅粉色反光点。眼白（巩膜）并非死板的纯白，而是加入了微量青灰与极淡暖黄，眼睑上下投下的阴影渐变，营造出眼球在湿润眼窝中转动的极致生动感。
            `,
            daVinciManuscript: "“眼睛是心灵之窗，光线在湿润角膜上的反射，应当具有球体受光的柔和曲率……” ——《大西洋古抄本》(Codex Atlanticus)",
            keyMetrics: [
                { label: "睫毛留存现状", value: "残存微痕 (高光谱检测可见)" },
                { label: "巩膜用色", value: "铅白+青灰+淡暖灰" },
                { label: "泪阜高光直径", value: "0.4 mm" },
                { label: "眼神聚焦度", value: "散点多维注视 (直视观者)" }
            ]
        },
        {
            id: "veil",
            name: "透明薄纱 (Guarnello) 与领口金线刺绣",
            subtitle: "半透明油彩的折射与几何拓扑美学的结晶",
            coords: { x: 0.440, y: 0.160, zLayer: 7 },
            region: "头部头纱与发际 (Diaphanous Veil & Guarnello)",
            depthLayers: "Layer 04 (发丝单色) → Layer 05 (发色底色) → Layer 07 (半透明薄纱笔触)",
            strokeThickness: "6 μm 半透明悬浮笔触",
            opticalPrinciple: "次表面半透明介质折射 (Subsurface Translucency)",
            analysis: `
                【透明薄纱的织造笔法】：
                蒙娜丽莎头上覆盖着一种名为“Guarnello”的轻薄丝麻混纺透明面纱。在 16 世纪初的意大利，新晋成为母亲或刚经历分娩的女性会佩戴这种头纱，这有力地印证了画中人丽莎·格拉迪尼（Lisa Gherardini）在生下次子后定制此画的历史记录。
                达·芬奇用近乎油水交融的超稀悬浮铅白，顺着深色卷曲长发的外侧轻巧掠过，白色颜料厚度极薄，使底层的深黑发丝透过光影隐约可见，完美再现了蚕丝织物的折射与漂浮质感。

                【领口金线结绳花纹 (Ricamo a nodi)】：
                胸口长袍边缘装饰着精细复杂的几何连续环结图案。达·芬奇对几何拓扑学、无解绳结图样具有终身痴迷，他运用极细的貂毫画笔，以铅锡黄与金赭色点缀细密连续的纽结花纹，每组结扣仅数毫米大，展现出惊人的手部精控力。
            `,
            daVinciManuscript: "“描绘轻薄之纱，需让其下的肉体与发丝明暗隐隐透露，不可重滞遮蔽……” ——《乌尔比诺手稿》(Codex Urbinas)",
            keyMetrics: [
                { label: "头纱织物类型", value: "透明丝麻织物 (Guarnello)" },
                { label: "半透明透光率", value: "约 65% 透光" },
                { label: "金线刺绣宽度", value: "0.15 - 0.25 mm" },
                { label: "历史象征", value: "准母亲/新育女性典范身份" }
            ]
        },
        {
            id: "hands",
            name: "右手搭叠左手：解剖学与生命律动的巅峰",
            subtitle: "骨骼、肌腱与静脉微冷青调的皮下血液透视",
            coords: { x: 0.550, y: 0.810, zLayer: 6 },
            region: "双叠手部 (The Clasped Hands)",
            depthLayers: "Layer 03 (手指起稿) → Layer 04 (关节明暗) → Layer 06 (皮下血液微温)",
            strokeThickness: "28 μm",
            opticalPrinciple: "皮肤次表面散射与皮下静脉冷暖互补",
            analysis: `
                【西方肖像史上最优雅的双手】：
                蒙娜丽莎的右手自然搭在左臂与椅圈上，手指微曲、从容闲适。双手不仅在构图上构成了稳定的黄金三角金字塔底座，更展示了达·芬奇对人体手部骨骼肌腱力学解剖的透彻掌握。

                【皮下血管与冷暖微差运笔】：
                仔细观察右手手背与指关节：
                1. 在食指与中指根部的皮下，达·芬奇以极微量的**天青/绿土冷色调**隐现出静脉血管的走向；
                2. 随后在指尖、指腹处罩上一层含微量茜草红的温润暖调，模拟毛细血管带来的充血生命感；
                3. X 射线荧光检测显示，达·芬奇在画左手食指时曾多次修改（Pentimento），最初手指较为僵直，后被修改为更具圆润弧度的弯曲姿态，手指间没有任何僵硬切边。
            `,
            daVinciManuscript: "“手之各指，当顺从其动作而有屈伸起伏之韵，骨节转折处须以温润皮肉包裹，不可如枯木断折……” ——《解剖学笔记》",
            keyMetrics: [
                { label: "皮下静脉冷调", value: "微量天青/绿土罩染" },
                { label: "指腹红晕", value: "天然茜草红 (Madder Lake)" },
                { label: "构图功能", value: "金字塔稳定基底" },
                { label: "底稿修改痕迹", value: "左手食指弧度修正 (X射线证实)" }
            ]
        },
        {
            id: "horizon",
            name: "不对称地平线：阿诺河桥梁与动态视域错觉",
            subtitle: "左低右高的奇幻喀斯特地貌与观者视线牵引机理",
            coords: { x: 0.800, y: 0.380, zLayer: 5 },
            region: "背景山水与地平线 (Asymmetric Landscape)",
            depthLayers: "Layer 03 (山体轮廓) → Layer 04 (峡谷深邃) → Layer 05 (青金石空气远近)",
            strokeThickness: "32 μm",
            opticalPrinciple: "构图倾斜动势与视知觉重心偏移",
            analysis: `
                【左右地平线的惊人高度差】：
                绝大多数观众初看时不会察觉：蒙娜丽莎头颈两旁的背景地平线是**完全不对称**的！
                • **左侧（观者视角左方）**：地平线明显偏低（低了约 3~4 厘米），呈现一条蜿蜒泥泞的河谷、低矮山丘以及一座古老的六孔石拱桥（推测为阿诺河上的布里亚诺桥 Ponte Buriano）；
                • **右侧（观者视角右方）**：地平线陡然拔高，展现出险峻尖锐的原始冰川喀斯特高山与幽深的高山峡湖。

                【构图心理学巧思】：
                当观者的视线从左向右扫描画面时，地平线的高度跳跃会在视觉大脑中产生一种人物正在“微倾”、“向右微转”或“挺拔而起”的动态暗示。达·芬奇刻意破坏对称平衡，赋予了静态肖像画一种潜藏的呼吸感与时空流动性。
            `,
            daVinciManuscript: "“山峰越远，空气越深，则山色必渐转深蓝；地质之变迁，河流冲刷山谷而成此奇崛之状……” ——《莱斯特古抄本》(Codex Leicester)",
            keyMetrics: [
                { label: "左右地平线高度差", value: "约 3.5 cm (左低右高)" },
                { label: "历史桥梁考证", value: "布里亚诺古桥 (Ponte Buriano)" },
                { label: "地貌类型", value: "原始喀斯特侵蚀冰川地貌" },
                { label: "视觉动态心理", value: "引导产生轻微转向动态感" }
            ]
        },
        {
            id: "pentimenti",
            name: "底层修改隐痕 (Pentimenti)：消失的珍珠发簪",
            subtitle: "红外反射光谱揭示的大师心境演变",
            coords: { x: 0.600, y: 0.190, zLayer: 3 },
            region: "右侧发际高位 (Hidden Hairpin & Veil Repositioning)",
            depthLayers: "Layer 03 (木炭底稿点线) → 被 Layer 06/07 完全覆盖",
            strokeThickness: "底稿深度 8 μm (外层覆盖 60 μm)",
            opticalPrinciple: "红外线穿透油彩吸收与碳素高反射",
            analysis: `
                【什么是 Pentimenti（悔笔痕）？】：
                意大利语“Pentimento”意为“悔改、修改”，指艺术家在画布底层改变构想而留下的早期绘制痕迹。这些肉眼不可见的线索唯有现代红外光谱仪器方能勘测。

                【红外反射发现的惊人细节】：
                在蒙娜丽莎头部右侧靠近头纱上方约 10 厘米处，红外反射图像（Infrared Reflectography）清晰揭示达·芬奇最初用木炭笔画了一枚精美的**珍珠发簪（Spillone）**！
                但在后来的绘制阶段，达·芬奇彻底放弃了这个发簪，用多层暗色油彩将其完全封盖抹去。
                艺术史学家推论：达·芬奇在此刻决定剥离所有世俗虚荣的珠光宝气，让观者的全部注意力聚焦在丽莎夫人的神情与心灵深处，升华为一种具有普遍人道光辉的永恒女性圣像。
            `,
            daVinciManuscript: "“智者当审视自然之本真，过饰者失于轻浮，唯简素静穆者能通天地之神采……” ——《思维草稿》",
            keyMetrics: [
                { label: "隐蔽物件", value: "珍珠长发簪 (Spillone)" },
                { label: "探测手段", value: "近红外反射光谱 (IRR)" },
                { label: "舍弃动机", value: "祛除世俗珠宝、追求静穆超然" },
                { label: "肉眼可见度", value: "0% (完全封于底稿层)" }
            ]
        }
    ],

    // 显微横截面切片分层数据 (Microscopic Cross-Section)
    crossSection: {
        totalThicknessMicrons: 13240, // 包含木板
        paintThicknessMicrons: 240,   // 纯颜料层总厚度
        coreLayers: [
            {
                name: "老化清漆与龟裂层 (Aged Varnish & Craquelure)",
                depthRange: "0 – 35 μm",
                thickness: 35,
                color: "#9c813a",
                particleType: "琥珀色均质树脂胶质，内部有垂直张力龟裂微缝隙",
                medium: "天然乳香树脂 (Mastic Resin) + 松节油"
            },
            {
                name: "微观高光提亮与透明织物笔触 (Highlights & Glaze Filaments)",
                depthRange: "35 – 45 μm",
                thickness: 10,
                color: "#e8dcba",
                particleType: "高折射率碱式碳酸铅（铅白）超微团簇微粒",
                medium: "熟核桃油 (Walnut Oil)"
            },
            {
                name: "Sfumato 晕涂罩染堆叠层 (30 Micro-Glazes)",
                depthRange: "45 – 85 μm",
                thickness: 40,
                color: "#6b4929",
                particleType: "纳米级骨黑无定形微炭粒、煅烧铁红，分散度 < 0.5 μm",
                medium: "精炼脱脂核桃油，极低颜料配比（<1.5%）"
            },
            {
                name: "固有色与风景色块层 (Local Color Body Layer)",
                depthRange: "85 – 115 μm",
                thickness: 30,
                color: "#3d5747",
                particleType: "天然青金石多面体透明晶体、微量铜绿板状结晶、绿土",
                medium: "冷榨亚麻油与核桃油混合媒介"
            },
            {
                name: "单色明暗塑形层 (Imprimatura & Grisaille)",
                depthRange: "115 – 135 μm",
                thickness: 20,
                color: "#573c24",
                particleType: "天然生赭石多孔质铁锰氧化物颗粒",
                medium: "稀释核桃油清漆"
            },
            {
                name: "木炭粉与透印底稿 (Spolvero Charcoal Underdrawing)",
                depthRange: "135 – 145 μm",
                thickness: 10,
                color: "#1c1815",
                particleType: "葡萄藤煅烧不规则针状炭黑碎片 (Carbon Black)",
                medium: "微量水性动物胶固定液"
            },
            {
                name: "极细水磨石膏打底层 (Gesso Ground Primer)",
                depthRange: "145 – 250 μm",
                thickness: 105,
                color: "#ebe6db",
                particleType: "致密双水硫酸钙二水结晶 (CaSO4·2H2O)，极平整压实",
                medium: "高纯度精制兔皮胶 (Rabbit-skin Glue)"
            },
            {
                name: "白杨木板木纤维基底 (Poplar Wood Support)",
                depthRange: "250 μm – 13.2 mm",
                thickness: 13000,
                color: "#c29e6b",
                particleType: "管胞、导管与木质素纵向纤维束，含水率约 11%",
                medium: "天然木质素 (Lignin) 与热骨胶浸润层"
            }
        ]
    },

    // 多光谱科学检测技术模式
    multispectralModes: [
        {
            key: "visible",
            name: "可见光真实色彩",
            subname: "Visible Light Photography",
            desc: "在 400nm - 700nm 标准日光色温（5500K）下捕捉的高清原画，展现经历五百年氧化后的原初视觉状态。",
            textureFile: "assets/mona_lisa_norm.jpg",
            hudColor: "#d4af37"
        },
        {
            key: "infrared",
            name: "红外反射成像 (IRR)",
            subname: "Infrared Reflectography (1000 - 2500nm)",
            desc: "红外波穿透表面清漆与油彩氧化层，被底层含碳黑（Carbon）的透印底稿强力吸收，清晰呈现达·芬奇的起稿笔迹、修改痕迹（发簪与手位）及针孔印记。",
            textureFile: "assets/spec_infrared.jpg",
            hudColor: "#50c878"
        },
        {
            key: "xray",
            name: "X 射线荧光透视 (XRF)",
            subname: "X-Ray Radiography",
            desc: "重原子（如铅白中的铅原子 Pb）对 X 射线产生强烈吸收呈亮白色，揭示木板内部天然树轮密度、虫蛀空隙、蝴蝶榫榫卯构件以及重金属颜料分布。",
            textureFile: "assets/spec_xray.jpg",
            hudColor: "#00d2ff"
        },
        {
            key: "uv",
            name: "紫外荧光反应 (UVF)",
            subname: "Ultraviolet Fluorescence (365nm)",
            desc: "表层老化的天然树脂清漆在紫外线激发下发出特征性的绿黄色荧光，而近代修复重绘涂补的区域由于没有经历数百年氧化，呈现为明显的深紫黑色暗斑。",
            textureFile: "assets/spec_uv.jpg",
            hudColor: "#b24bf3"
        },
        {
            key: "heatmap",
            name: "Sfumato 晕涂厚度热力图",
            subname: "Sfumato Glaze Thickness Heatmap",
            desc: "欧洲同步辐射装置（ESRF）科学测绘的伪彩色色温图：蓝色代表薄涂底色（1-5层），绿色为中度罩染，橙红色（面部嘴角、眼窝、发际）代表高达 20-30 层的密集微米罩染。",
            textureFile: "assets/spec_heatmap.jpg",
            hudColor: "#ff4d4d"
        }
    ]
};

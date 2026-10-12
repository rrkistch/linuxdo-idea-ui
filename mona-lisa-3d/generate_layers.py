"""
generate_layers.py
Generates 8 scientific/artistic layers and 4 multispectral inspection maps
for the 3D Mona Lisa interactive dissection application.
"""

import os
import math
import random
from PIL import Image, ImageFilter, ImageOps, ImageEnhance, ImageDraw

BASE_DIR = r"f:\xuexi\linuxdo-idea-ui\mona-lisa-3d\assets"
MASTER_IMG_PATH = os.path.join(BASE_DIR, "mona_lisa_original.jpg")

def create_wood_texture(width, height):
    """Generate realistic Italian poplar wood panel with grain and butterfly cleats."""
    print("Generating Layer 1: Poplar Wood Support...")
    # Base wood color
    wood = Image.new("RGB", (width, height), (196, 161, 118))
    draw = ImageDraw.Draw(wood)

    # Generate vertical wood grain
    random.seed(42)
    for x in range(0, width, 2):
        shade = random.randint(-25, 25)
        r = max(0, min(255, 196 + shade))
        g = max(0, min(255, 161 + shade - 5))
        b = max(0, min(255, 118 + shade - 10))
        draw.line([(x, 0), (x, height)], fill=(r, g, b), width=1)

    # Long flowing grain waves
    for _ in range(35):
        cx = random.randint(0, width)
        w = random.randint(4, 18)
        col = (150 + random.randint(-20, 20), 115 + random.randint(-15, 15), 75 + random.randint(-10, 10))
        pts = []
        for y in range(0, height, 40):
            offset = int(math.sin(y * 0.005 + cx) * 15 + math.sin(y * 0.02) * 5)
            pts.append((cx + offset, y))
        draw.line(pts, fill=col, width=w)

    wood = wood.filter(ImageFilter.GaussianBlur(radius=2))

    # Add subtle aged distress / vertical stress crack at top (famous Mona Lisa wood crack)
    crack_x = int(width * 0.495)
    crack_pts = [(crack_x, 0)]
    cur_x = crack_x
    for y in range(10, int(height * 0.28), 10):
        cur_x += random.choice([-1, 0, 1])
        crack_pts.append((cur_x, y))
    draw.line(crack_pts, fill=(60, 40, 25), width=2)

    # Add restoration butterfly dovetail cleats (蝴蝶榫) at back/top restoration
    def draw_butterfly(draw_ctx, center_x, center_y, size=24):
        # Bowtie / butterfly shape
        half_s = size // 2
        pts = [
            (center_x - half_s, center_y - half_s),
            (center_x, center_y - half_s // 3),
            (center_x + half_s, center_y - half_s),
            (center_x + half_s, center_y + half_s),
            (center_x, center_y + half_s // 3),
            (center_x - half_s, center_y + half_s)
        ]
        draw_ctx.polygon(pts, fill=(120, 85, 50), outline=(60, 40, 25))

    draw_butterfly(draw, crack_x, int(height * 0.06), 28)
    draw_butterfly(draw, crack_x, int(height * 0.16), 28)

    # Add wood panel edge bevel / framing tone
    enhancer = ImageEnhance.Color(wood)
    wood = enhancer.enhance(1.1)
    return wood

def create_gesso_ground(width, height):
    """Generate Layer 2: Gesso & animal glue ground primer."""
    print("Generating Layer 2: Gesso Primer Ground...")
    gesso = Image.new("RGBA", (width, height), (242, 238, 228, 250))
    draw = ImageDraw.Draw(gesso)

    # Sanding lines and fine brush stroke texture of gesso
    random.seed(99)
    for _ in range(800):
        y = random.randint(0, height)
        x1 = random.randint(0, width - 100)
        x2 = x1 + random.randint(40, 150)
        tone = random.randint(230, 250)
        alpha = random.randint(15, 35)
        draw.line([(x1, y), (x2, y)], fill=(tone, tone, tone - 5, alpha), width=1)

    gesso = gesso.filter(ImageFilter.GaussianBlur(radius=1.2))
    return gesso

def create_underdrawing(master):
    """Generate Layer 3: Spolvero pounce marks & charcoal underdrawing with pentimenti."""
    print("Generating Layer 3: Spolvero & Charcoal Underdrawing...")
    w, h = master.size
    gray = master.convert("L")

    # Multi-scale edge detection to isolate sketches
    edges1 = gray.filter(ImageFilter.FIND_EDGES)
    edges2 = gray.filter(ImageFilter.CONTOUR)

    # Invert edges: dark lines on transparent/light
    inverted = ImageOps.invert(edges1)

    # Thresholding to extract crisp charcoal sketch lines
    threshold = 190
    sketch = inverted.point(lambda p: 255 if p > threshold else int(p * 0.8))
    sketch = ImageEnhance.Contrast(sketch).enhance(2.5)

    # Build RGBA drawing
    underdrawing = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(underdrawing)

    # Convert sketch brightness to charcoal alpha
    sketch_pixels = sketch.load()
    und_pixels = underdrawing.load()

    for y in range(0, h, 2):
        for x in range(0, w, 2):
            val = sketch_pixels[x, y]
            if val < 210:
                alpha = int((255 - val) * 0.9)
                und_pixels[x, y] = (45, 38, 30, alpha)
                if x + 1 < w: und_pixels[x + 1, y] = (45, 38, 30, alpha)
                if y + 1 < h: und_pixels[x, y + 1] = (45, 38, 30, alpha)
                if x + 1 < w and y + 1 < h: und_pixels[x + 1, y + 1] = (45, 38, 30, alpha)

    # Add Authentic Spolvero (pounce dots) discovered along the hairline & veil
    # (Pascal Cotte 2020 discovery)
    random.seed(1503)
    # Hairline arch dots
    for i in range(120):
        t = i / 120.0
        # Curved path around head/hair
        px = int(w * 0.4 + math.sin(t * 3.14) * (w * 0.18) + (t - 0.5) * (w * 0.05))
        py = int(h * 0.14 + t * (h * 0.22))
        for _ in range(random.randint(1, 3)):
            dot_x = px + random.randint(-2, 2)
            dot_y = py + random.randint(-2, 2)
            if 0 <= dot_x < w and 0 <= dot_y < h:
                draw.ellipse([(dot_x - 1, dot_y - 1), (dot_x + 1, dot_y + 1)], fill=(35, 28, 22, 200))

    # Pentimenti: faint shifted veil line and ghost hair-pin (spillone)
    # Hair pin ghost
    pin_x, pin_y = int(w * 0.58), int(h * 0.19)
    draw.line([(pin_x, pin_y), (pin_x + 25, pin_y - 25)], fill=(60, 50, 40, 130), width=2)
    draw.ellipse([(pin_x + 23, pin_y - 27), (pin_x + 27, pin_y - 23)], fill=(60, 50, 40, 140))

    return underdrawing

def create_grisaille_imprimatura(master):
    """Generate Layer 4: Monochrome brown Chiaroscuro / Imprimatura tonal volume."""
    print("Generating Layer 4: Imprimatura & Grisaille Chiaroscuro...")
    w, h = master.size
    gray = master.convert("L")

    # Warm sepia / raw umber color grading
    sepia = ImageOps.colorize(gray, black=(35, 22, 12), mid=(160, 115, 75), white=(245, 225, 195))

    # Soften to simulate broad bristle underpainting brushes
    grisaille = sepia.filter(ImageFilter.GaussianBlur(radius=2))

    # Add alpha to allow blending over the underdrawing
    grisaille_rgba = grisaille.convert("RGBA")
    return grisaille_rgba

def create_local_colors(master):
    """Generate Layer 5: Base local colors for landscape and garments."""
    print("Generating Layer 5: Local Colors & Atmospheric Perspective...")
    w, h = master.size

    # Simplify colors, boost lapis lazuli and earth pigments
    enhancer = ImageEnhance.Color(master)
    boosted = enhancer.enhance(1.4)

    # Oil paint smoothing: MedianFilter or bilateral effect
    smoothed = boosted.filter(ImageFilter.MedianFilter(size=5))

    # Atmospheric haze on upper half (background landscape)
    draw = ImageDraw.Draw(smoothed)
    # Cyan/blue atmospheric perspective veil on distant mountains
    haze = Image.new("RGBA", (w, h), (70, 115, 140, 0))
    haze_draw = ImageDraw.Draw(haze)
    for y in range(0, int(h * 0.5)):
        alpha = int(45 * (1.0 - y / (h * 0.5)))
        haze_draw.line([(0, y), (w, y)], fill=(60, 120, 150, alpha))

    final_col = Image.alpha_composite(smoothed.convert("RGBA"), haze)
    return final_col

def create_sfumato_glazes(master):
    """Generate Layer 6: 20-30 Micro-layers of transparent Sfumato glazes on skin."""
    print("Generating Layer 6: Sfumato Micro-glazes...")
    w, h = master.size

    # Extract skin & shadow softness mask
    # Focus heavily on face, neck, mouth, hands
    sfumato_mask = Image.new("L", (w, h), 0)
    s_draw = ImageDraw.Draw(sfumato_mask)

    # Facial region ellipse
    face_cx, face_cy = int(w * 0.51), int(h * 0.28)
    s_draw.ellipse([(face_cx - int(w * 0.17), face_cy - int(h * 0.16)),
                    (face_cx + int(w * 0.17), face_cy + int(h * 0.18))], fill=210)

    # Neck and decolletage
    s_draw.polygon([
        (int(w * 0.42), int(h * 0.38)),
        (int(w * 0.60), int(h * 0.38)),
        (int(w * 0.66), int(h * 0.52)),
        (int(w * 0.36), int(h * 0.52))
    ], fill=190)

    # Hands region
    s_draw.ellipse([(int(w * 0.35), int(h * 0.70)), (int(w * 0.78), int(h * 0.90))], fill=180)

    # Blur the mask extensively for seamless gradation
    sfumato_mask = sfumato_mask.filter(ImageFilter.GaussianBlur(radius=35))

    # Extract soft shadow glazes from master
    blurred_master = master.filter(ImageFilter.GaussianBlur(radius=8))

    sfumato_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # Composite the warm sfumato tones
    sfumato_color = ImageOps.colorize(blurred_master.convert("L"), black=(45, 30, 20), mid=(175, 130, 95), white=(240, 205, 175))
    sfumato_rgba = sfumato_color.convert("RGBA")

    # Apply mask
    sfumato_rgba.putalpha(sfumato_mask)
    return sfumato_rgba

def create_micro_details(master):
    """Generate Layer 7: Micro details, gossamer veil, golden embroidery, hair curls."""
    print("Generating Layer 7: Micro-Details & Delicate Highlights...")
    w, h = master.size

    # High-pass filter to extract high frequency details
    blurred = master.filter(ImageFilter.GaussianBlur(radius=3))

    # Use unsharp mask
    unsharp = master.filter(ImageFilter.UnsharpMask(radius=3, percent=220, threshold=2))

    details_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d_draw = ImageDraw.Draw(details_layer)

    # Golden knot embroidery at the neckline (ricamo a nodi)
    neck_y = int(h * 0.445)
    neck_x1, neck_x2 = int(w * 0.40), int(w * 0.62)
    for x in range(neck_x1, neck_x2, 6):
        # Draw delicate golden loop knots
        d_draw.arc([(x, neck_y - 5), (x + 8, neck_y + 5)], start=0, end=360, fill=(235, 195, 100, 220), width=2)
        d_draw.point((x + 4, neck_y), fill=(255, 235, 180, 255))

    # Veil highlights along the hair and forehead edge
    for i in range(80):
        t = i / 80.0
        vx = int(w * 0.36 + (t) * (w * 0.28))
        vy = int(h * 0.16 + math.sin(t * 3.14) * 8)
        d_draw.line([(vx, vy), (vx + 2, vy)], fill=(220, 220, 215, 180), width=2)

    # Eye specular spark & tear duct moisture
    # Left eye (viewer's left)
    le_x, le_y = int(w * 0.465), int(h * 0.252)
    d_draw.ellipse([(le_x - 1, le_y - 1), (le_x + 1, le_y + 1)], fill=(255, 250, 240, 240))
    # Right eye
    re_x, re_y = int(w * 0.565), int(h * 0.258)
    d_draw.ellipse([(re_x - 1, re_y - 1), (re_x + 1, re_y + 1)], fill=(255, 250, 240, 240))

    # Subtle lip cleft light
    lip_x, lip_y = int(w * 0.525), int(h * 0.334)
    d_draw.line([(lip_x - 5, lip_y), (lip_x + 5, lip_y)], fill=(225, 160, 140, 160), width=2)

    # Blend high-frequency details across the image
    unsharp_pixels = unsharp.load()
    master_pixels = master.load()
    layer_pixels = details_layer.load()

    for y in range(0, h, 2):
        for x in range(0, w, 2):
            mr, mg, mb = master_pixels[x, y]
            ur, ug, ub = unsharp_pixels[x, y]
            diff_mag = abs(mr - ur) + abs(mg - ug) + abs(mb - ub)
            if diff_mag > 20:
                # High frequency edge detail
                alpha = min(220, int(diff_mag * 2.2))
                existing = layer_pixels[x, y]
                if existing[3] < alpha:
                    layer_pixels[x, y] = (ur, ug, ub, alpha)
                    if x + 1 < w: layer_pixels[x + 1, y] = (ur, ug, ub, alpha)
                    if y + 1 < h: layer_pixels[x, y + 1] = (ur, ug, ub, alpha)

    return details_layer

def create_varnish_craquelure(width, height):
    """Generate Layer 8: Aged natural amber resin varnish and delicate craquelure network."""
    print("Generating Layer 8: Aged Varnish & Craquelure Network...")
    varnish = Image.new("RGBA", (width, height), (170, 135, 55, 65))
    draw = ImageDraw.Draw(varnish)

    # Procedural fine craquelure cracks
    random.seed(1789)
    num_nodes = 350
    nodes = [(random.randint(0, width), random.randint(0, height)) for _ in range(num_nodes)]

    # Connect nearby nodes to form Voronoi-like cracked glaze cells
    for i in range(num_nodes):
        x1, y1 = nodes[i]
        # find 3 nearest
        dists = []
        for j in range(num_nodes):
            if i != j:
                x2, y2 = nodes[j]
                d = (x1 - x2)**2 + (y1 - y2)**2
                dists.append((d, x2, y2))
        dists.sort()
        for _, x2, y2 in dists[:2]:
            # Jittered line
            mid_x = (x1 + x2) // 2 + random.randint(-5, 5)
            mid_y = (y1 + y2) // 2 + random.randint(-5, 5)
            draw.line([(x1, y1), (mid_x, mid_y), (x2, y2)], fill=(40, 30, 15, 75), width=1)

    # Soft glaze sheen
    varnish = varnish.filter(ImageFilter.GaussianBlur(radius=0.7))
    return varnish

def create_multispectral_maps(master, underdrawing, wood):
    """Generate 4 Scientific Multispectral Imaging maps."""
    print("Generating Multispectral Maps (IR, X-Ray, UV, Heatmap)...")
    w, h = master.size

    # 1. Infrared Reflectography (IRR)
    # Highlights charcoal, underdrawing, pentimenti; penetrates glazes
    ir_base = master.convert("L")
    ir_boosted = ImageOps.invert(ir_base)
    ir_boosted = ImageEnhance.Contrast(ir_boosted).enhance(1.8)
    ir_result = ImageOps.colorize(ir_boosted, black=(15, 15, 15), mid=(140, 140, 140), white=(235, 235, 235))
    # Blend underdrawing strongly into IR
    ir_composite = Image.alpha_composite(ir_result.convert("RGBA"), underdrawing).convert("RGB")
    ir_composite.save(os.path.join(BASE_DIR, "spec_infrared.jpg"), quality=90)

    # 2. X-Ray Radiography
    # Shows lead white density (high absorption = bright white), wood panel grain and joints
    gray = master.convert("L")
    xray_wood = wood.convert("L")
    # Invert and boost highlights for lead white
    lead_density = ImageEnhance.Contrast(gray).enhance(2.2)
    xray = Image.blend(xray_wood, lead_density, 0.65)
    xray_colored = ImageOps.colorize(xray, black=(5, 8, 12), mid=(80, 95, 110), white=(245, 250, 255))
    xray_colored.save(os.path.join(BASE_DIR, "spec_xray.jpg"), quality=90)

    # 3. Ultraviolet Fluorescence (UV)
    # Aged varnish glows eerie greenish-yellow / turquoise, retouches appear pitch black
    uv_base = ImageOps.colorize(gray, black=(10, 5, 25), mid=(30, 90, 80), white=(110, 210, 180))
    # Add dark restoration patches around frame and old retouching areas
    uv_draw = ImageDraw.Draw(uv_base)
    uv_draw.rectangle([(0, 0), (w, 15)], fill=(12, 10, 18))
    uv_draw.rectangle([(0, h - 20), (w, h)], fill=(12, 10, 18))
    uv_base.save(os.path.join(BASE_DIR, "spec_uv.jpg"), quality=90)

    # 4. Sfumato Depth Heatmap
    # False-color mapping: Blue (1-5 layers) -> Green (10 layers) -> Orange/Red (25-30 layers around mouth & eye sockets)
    heatmap = ImageOps.invert(gray)
    heatmap_colored = ImageOps.colorize(heatmap, black=(20, 20, 120), mid=(40, 200, 80), white=(255, 60, 20))
    heatmap_colored.save(os.path.join(BASE_DIR, "spec_heatmap.jpg"), quality=90)
    print("All Multispectral Maps saved!")

def main():
    print(f"Loading master scan from: {MASTER_IMG_PATH}")
    master = Image.open(MASTER_IMG_PATH)

    # Target resolution: 960 x 1452 (Crisp & smooth performance in Three.js)
    target_w, target_h = 960, 1452
    master = master.resize((target_w, target_h), Image.Resampling.LANCZOS)
    master.save(os.path.join(BASE_DIR, "mona_lisa_norm.jpg"), quality=92)

    # Generate 8 Layers
    # 1. Wood
    wood = create_wood_texture(target_w, target_h)
    wood.save(os.path.join(BASE_DIR, "layer_01_wood.jpg"), quality=92)

    # 2. Gesso
    gesso = create_gesso_ground(target_w, target_h)
    gesso.save(os.path.join(BASE_DIR, "layer_02_gesso.png"))

    # 3. Underdrawing & Spolvero
    underdrawing = create_underdrawing(master)
    underdrawing.save(os.path.join(BASE_DIR, "layer_03_underdrawing.png"))

    # 4. Grisaille & Imprimatura
    grisaille = create_grisaille_imprimatura(master)
    grisaille.convert("RGB").save(os.path.join(BASE_DIR, "layer_04_grisaille.jpg"), quality=92)

    # 5. Local Colors & Landscape
    colors = create_local_colors(master)
    colors.convert("RGB").save(os.path.join(BASE_DIR, "layer_05_colors.jpg"), quality=92)

    # 6. Sfumato Glazes
    sfumato = create_sfumato_glazes(master)
    sfumato.save(os.path.join(BASE_DIR, "layer_06_sfumato.png"))

    # 7. Micro Details
    details = create_micro_details(master)
    details.save(os.path.join(BASE_DIR, "layer_07_details.png"))

    # 8. Varnish & Craquelure
    varnish = create_varnish_craquelure(target_w, target_h)
    varnish.save(os.path.join(BASE_DIR, "layer_08_varnish.png"))

    # Multispectral maps
    create_multispectral_maps(master, underdrawing, wood)

    print("\n--- ALL LAYERS AND MULTISPECTRAL MAPS SUCCESSFULLY GENERATED! ---")

if __name__ == "__main__":
    main()

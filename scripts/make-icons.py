"""生成 PWA 图标：淡紫→粉渐变 + 白色小花"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

S = 1024
C1 = (183, 155, 255)   # 淡紫
C2 = (245, 160, 196)   # 粉
C3 = (255, 226, 155)   # 淡黄

# 渐变底
base = Image.new('RGB', (S, S))
px = base.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        if t < 0.55:
            k = t / 0.55
            c = tuple(int(C1[i] + (C2[i] - C1[i]) * k) for i in range(3))
        else:
            k = (t - 0.55) / 0.45
            c = tuple(int(C2[i] + (C3[i] - C2[i]) * k * 0.75) for i in range(3))
        px[x, y] = c

# 圆角遮罩
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.235), fill=255)

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
img.paste(base, (0, 0), mask)

# 白色花朵：5 片花瓣
petal = Image.new('RGBA', (S, S), (0, 0, 0, 0))
pd = ImageDraw.Draw(petal)
cx = cy = S // 2
R = S * 0.185          # 花瓣离中心距离
PRX = S * 0.135        # 花瓣横半径
PRY = S * 0.175        # 花瓣纵半径
for i in range(5):
    a = math.radians(-90 + i * 72)
    x = cx + R * math.cos(a)
    y = cy + R * math.sin(a)
    pd.ellipse([x - PRX, y - PRY, x + PRX, y + PRY], fill=(255, 255, 255, 236))
petal = petal.filter(ImageFilter.GaussianBlur(S * 0.004))
img.alpha_composite(petal)

# 花心
d = ImageDraw.Draw(img)
cr = S * 0.072
d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 214, 122, 255))
cr2 = S * 0.036
d.ellipse([cx - cr2, cy - cr2, cx + cr2, cy + cr2], fill=(255, 246, 210, 255))

# 小绿点装饰
d.ellipse([S * 0.70, S * 0.68, S * 0.70 + S * 0.062, S * 0.68 + S * 0.062], fill=(150, 226, 190, 235))

for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), 'PNG', optimize=True)
    print('ok', name)

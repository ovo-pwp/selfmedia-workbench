"""生成扫码入口图（二维码 + 中文说明）"""
import os
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

URL = "https://selfmedia-workbench-33729.app.workbuddy.host/?sharecode=KLEYZT3KBE"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "扫码打开.png")

qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M, box_size=12, border=3)
qr.add_data(URL)
qr.make(fit=True)
img = qr.make_image(fill_color=(59, 52, 80), back_color=(255, 255, 255)).convert("RGB")

W, H = img.size
PAD = 56
TOP = 44
BOTTOM = 150
canvas = Image.new("RGB", (W + PAD * 2, H + TOP + BOTTOM), (255, 255, 255))
canvas.paste(img, (PAD, TOP))

d = ImageDraw.Draw(canvas)


def font(size):
    for p in [
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


f1 = font(40)
f2 = font(24)

t1 = "扫码打开 · 我的小工作台"
t2 = "微信 / 相机 / 浏览器扫码都可以"
for text, f, y, color in [(t1, f1, H + TOP + 18, (59, 52, 80)), (t2, f2, H + TOP + 74, (154, 147, 172))]:
    w = d.textbbox((0, 0), text, font=f)[2]
    d.text(((canvas.width - w) / 2, y), text, font=f, fill=color)

canvas.save(OUT, "PNG", optimize=True)
print("已生成:", OUT, canvas.size)

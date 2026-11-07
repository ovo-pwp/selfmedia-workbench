#!/usr/bin/env bash
# 重新打包安卓 APK（不需要 Android Studio / Gradle，只用 aapt2 + javac + d8 + apksigner）
# 用法：bash android/build.sh
set -e

SDK="${SDK:-/d/android-sdk-zmt}"
BT="$SDK/bt35/android-15"          # build-tools 35.0.1（d8 需 JDK17+，34 的 d8 在 JDK21 下会崩）
AJAR="$SDK/pf/android-35/android.jar"
AJARW="D:\\android-sdk-zmt\\pf\\android-35\\android.jar"   # cmd 调用要 Windows 路径
SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$(cd "$SRC/.." && pwd)"
B=/d/zmt-build                      # 构建目录必须全 ASCII，cmd 调 bat 时中文路径会乱码

rm -rf "$B"
mkdir -p "$B"
cp -r "$SRC/." "$B/"
cd "$B"

"$BT/aapt2.exe" compile --dir res -o res.zip
"$BT/aapt2.exe" link -o unsigned.apk -I "$AJAR" \
  --manifest AndroidManifest.xml -A assets --java gen res.zip \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 1 --version-name 1.0

mkdir -p classes dex
javac --release 8 -nowarn -cp "$AJAR" -d classes \
  gen/com/zimeiti/workbench/R.java java/com/zimeiti/workbench/MainActivity.java

cmd //c "D:\\android-sdk-zmt\\bt35\\android-15\\d8.bat --min-api 24 --lib $AJARW --output D:\\zmt-build\\dex D:\\zmt-build\\classes\\com\\zimeiti\\workbench\\*.class"

python - <<'PY'
import zipfile, shutil
shutil.copy('unsigned.apk', 'withdex.apk')
with zipfile.ZipFile('withdex.apk', 'a', zipfile.ZIP_DEFLATED) as z:
    z.write('dex/classes.dex', 'classes.dex')
PY

"$BT/zipalign.exe" -f -p 4 withdex.apk aligned.apk
cmd //c "D:\\android-sdk-zmt\\bt35\\android-15\\apksigner.bat sign --ks D:\\zmt-build\\zimeiti.keystore --ks-pass pass:zimeiti2026 --key-pass pass:zimeiti2026 --ks-key-alias zimeiti --out D:\\zmt-build\\app.apk D:\\zmt-build\\aligned.apk"

cp "$B/app.apk" "$OUT/工作台-v1.0.apk"
echo "✅ $OUT/工作台-v1.0.apk"
